#!/usr/bin/env python3
"""
Génère la bibliothèque d'exercices tactiques de Temps De Jeu.

Sortie : Temps De Jeu/Resources/TactiquesEntrainement.json (format .tdjt,
décodé par TacticFile.decode(from:) dans Models/TacticModels.swift).

Usage (depuis la racine du dépôt) :
    python3 -I tools/generer_tactiques.py

Repère de rédaction : MÈTRES sur un terrain de 68 m × 105 m.
  x = distance depuis la touche gauche (0 → 68)
  y = distance depuis la ligne de but ATTAQUÉE par « equipe » (0 → 105)
« equipe » attaque vers y décroissant (but adverse en haut, y = 0) ;
« adversaire » attaque vers y croissant. Les points sont convertis en
coordonnées normalisées [x/68, y/105] arrondies à 3 décimales.
"""

import itertools
import json
import os
import re
import sys

LARGEUR = 68.0
LONGUEUR = 105.0
ECART_MIN = 1.5          # m entre deux acteurs d'une même étape
MARGE = 0.5              # m de marge avec les lignes pour les acteurs
DUREE_MIN, DUREE_MAX = 1.4, 3.0
SOURCE = "Bibliothèque Temps De Jeu"
CATEGORIES = {"conservation", "construction", "attaque", "finition", "pressing",
              "defense", "transition", "cpa", "perso", "autre"}
POSTES = {"Gardien", "Défenseur", "Milieu", "Attaquant"}
COULEURS = {"jaune", "orange", "rouge", "bleu", "blanc", "vert", "violet"}

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(RACINE, "Temps De Jeu", "Resources", "TactiquesEntrainement.json")


# ---------------------------------------------------------------------------
# Utilitaires de rédaction
# ---------------------------------------------------------------------------

def m(x, y):
    """Point en mètres → point normalisé [x, y]."""
    return [round(x / LARGEUR, 3), round(y / LONGUEUR, 3)]


def taille(largeur, longueur):
    """Dimensions en mètres → taille normalisée [largeur, longueur]."""
    return [round(largeur / LARGEUR, 3), round(longueur / LONGUEUR, 3)]


def equipe(id_, numero, poste, nom=None):
    a = {"id": id_, "camp": "equipe", "numero": numero, "poste": poste}
    if nom:
        a["nom"] = nom
    return a


def adv(id_, numero, nom=None, poste=None):
    a = {"id": id_, "camp": "adversaire", "numero": numero}
    if nom:
        a["nom"] = nom
    if poste:
        a["poste"] = poste
    return a


def joker(id_, nom=None):
    a = {"id": id_, "camp": "joker", "numero": "J"}
    if nom:
        a["nom"] = nom
    return a


def plot(x, y, couleur="orange"):
    return {"type": "plot", "pos": m(x, y), "couleur": couleur}


def mannequin(x, y, couleur="jaune"):
    return {"type": "mannequin", "pos": m(x, y), "couleur": couleur}


def zone(cx, cy, largeur, longueur, couleur="blanc"):
    return {"type": "zone", "pos": m(cx, cy), "taille": taille(largeur, longueur), "couleur": couleur}


def carre_plots(cx, cy, largeur, longueur, couleur="orange"):
    dx, dy = largeur / 2, longueur / 2
    return [plot(cx - dx, cy - dy, couleur), plot(cx + dx, cy - dy, couleur),
            plot(cx - dx, cy + dy, couleur), plot(cx + dx, cy + dy, couleur)]


def etape(titre, texte, positions, duree=None, porteur=None, ballon=None,
          action=None, aerien=None, focus=None):
    e = {"titre": titre, "texte": texte,
         "positions": {k: m(*p) for k, p in positions.items()}}
    if duree is not None:
        e["duree"] = duree
    if porteur is not None:
        e["porteur"] = porteur
    if ballon is not None:
        e["ballon"] = m(*ballon)
    if action is not None:
        e["action"] = action
    if aerien is not None:
        e["aerien"] = aerien
    if focus:
        e["focus"] = list(focus)
    return e


def tactique(id_, titre, categorie, niveau, duree, effectif, objectif, consignes,
             acteurs, etapes, materiel=()):
    return {
        "id": id_,
        "titre": titre,
        "categorie": categorie,
        "niveau": niveau,
        "duree": duree,
        "effectif": effectif,
        "objectif": objectif,
        "consignes": list(consignes),
        "source": SOURCE,
        "acteurs": acteurs,
        "materiel": list(materiel),
        "etapes": etapes,
    }


# ---------------------------------------------------------------------------
# 1. Rondo 4 c 2
# ---------------------------------------------------------------------------

def rondo_4c2():
    cx, cy = 34, 52.5
    acteurs = [
        equipe("a1", "6", "Milieu", "Appui bas"),
        equipe("a2", "8", "Milieu", "Appui gauche"),
        equipe("a3", "10", "Milieu", "Appui haut"),
        equipe("a4", "4", "Défenseur", "Appui droit"),
        adv("d1", "7", "Défenseur 1"),
        adv("d2", "9", "Défenseur 2"),
    ]
    materiel = [zone(cx, cy, 12, 12)] + carre_plots(cx, cy, 12, 12)
    etapes = [
        etape("Mise en place",
              "Carré de 12 m de côté délimité par 4 plots. Un joueur en appui sur chaque côté, "
              "deux défenseurs au centre. Le 6 a le ballon.",
              {"a1": (34, 58.5), "a2": (28, 52.5), "a3": (34, 46.5), "a4": (40, 52.5),
               "d1": (32.5, 53.5), "d2": (35.5, 51)},
              porteur="a1"),
        etape("Passe à l'appui latéral",
              "Le 6 joue sur son partenaire de gauche. Les appuis glissent le long de leur côté "
              "pour offrir un angle de passe ; le premier défenseur sort au pressing.",
              {"a1": (31.5, 58.5), "a3": (32, 46.5), "d1": (30.5, 53.5), "d2": (33.5, 51.5)},
              duree=1.6, porteur="a2", focus=["a2", "d1"]),
        etape("Passe qui casse la ligne",
              "Le ballon traverse entre les deux défenseurs vers l'appui opposé. "
              "C'est la passe à rechercher en priorité : elle élimine les deux défenseurs.",
              {"a1": (36.5, 58.5), "a3": (36.5, 46.5), "d1": (32.5, 54), "d2": (37, 53)},
              duree=1.6, porteur="a4", focus=["a2", "a4"]),
        etape("Jeu en une touche",
              "L'appui droit remise immédiatement vers le haut avant que le défenseur n'arrive. "
              "L'appui gauche remonte déjà pour proposer la solution suivante.",
              {"a2": (28, 49.5), "d1": (34.5, 52), "d2": (37, 49.5)},
              duree=1.4, porteur="a3", focus=["a4", "a3"]),
        etape("Interception et changement de rôle",
              "La passe axiale est coupée par un défenseur. Le joueur fautif prend sa place au "
              "centre ; le défenseur présent depuis le plus longtemps sort en appui.",
              {"d1": (35.5, 53.5)},
              duree=1.4, porteur="d1", focus=["d1", "a3"]),
    ]
    return tactique(
        "biblio-rondo-4c2", "Rondo 4 contre 2", "conservation", "U11+", "12 min", "4 c 2",
        "Conserver le ballon sous pression en trouvant la passe qui élimine les deux défenseurs.",
        ["Corps orienté pour voir deux solutions avant de recevoir",
         "Passer dans le pied opposé au défenseur le plus proche",
         "Deux touches maximum, puis une touche pour les plus forts",
         "Les défenseurs pressent à deux : l'un sort, l'autre ferme la passe axiale"],
        acteurs, etapes, materiel)


# ---------------------------------------------------------------------------
# 2. Conservation 5 c 5 + 2 jokers
# ---------------------------------------------------------------------------

def conservation_5c5():
    cx, cy = 34, 52.5
    acteurs = [
        equipe("e1", "4", "Défenseur"),
        equipe("e2", "6", "Milieu"),
        equipe("e3", "8", "Milieu"),
        equipe("e4", "10", "Milieu"),
        equipe("e5", "7", "Attaquant"),
        adv("o1", "2"), adv("o2", "6"), adv("o3", "3"), adv("o4", "8"), adv("o5", "5"),
        joker("j1", "Joker haut"),
        joker("j2", "Joker bas"),
    ]
    materiel = [zone(cx, cy, 30, 24)] + carre_plots(cx, cy, 30, 24, "jaune")
    etapes = [
        etape("Mise en place",
              "Zone de 30 m × 24 m. Deux équipes de 5 et deux jokers placés aux extrémités, "
              "qui jouent toujours avec l'équipe en possession.",
              {"e1": (24, 60), "e2": (34, 56), "e3": (44, 60), "e4": (26, 46), "e5": (42, 45),
               "o1": (27, 57.5), "o2": (34, 52.5), "o3": (41, 57), "o4": (29, 48), "o5": (40, 48),
               "j1": (34, 41), "j2": (36, 64)},
              porteur="e2"),
        etape("Sortir de la pression par le joker",
              "Pressé de face, le 6 s'appuie sur le joker bas. Le latéral gauche s'écarte "
              "pour agrandir l'espace de jeu.",
              {"o2": (34.5, 54), "e1": (21, 61)},
              duree=1.5, porteur="j2", focus=["e2", "j2"]),
        etape("Renverser le jeu",
              "Le joker joue côté opposé, là où l'adversaire est moins nombreux. "
              "Le bloc adverse doit coulisser.",
              {"o3": (42.5, 57.5), "o2": (39.5, 56), "o5": (42, 50), "e5": (45, 48)},
              duree=1.8, porteur="e3", focus=["j2", "e3"]),
        etape("Trouver le joueur entre les lignes",
              "Le 10 profite du décalage pour se glisser entre les lignes adverses "
              "et reçoit une passe vers l'avant.",
              {"e4": (36, 51), "o4": (32, 49)},
              duree=1.6, porteur="e4", focus=["e3", "e4"]),
        etape("Point marqué : joker opposé",
              "Le 10 se retourne et trouve le joker haut. Le ballon est passé d'un joker à "
              "l'autre : l'équipe marque un point et garde le ballon.",
              {"o4": (33, 46.5)},
              duree=1.5, porteur="j1", focus=["e4", "j1"]),
    ]
    return tactique(
        "biblio-conservation-5c5-2j", "Conservation 5 c 5 + 2 jokers", "conservation", "U13+",
        "20 min", "5 c 5 + 2 jokers",
        "Conserver collectivement le ballon, utiliser la largeur et faire circuler d'un joker à l'autre.",
        ["Jokers en deux touches, toujours avec l'équipe qui a le ballon",
         "Écarter au maximum : largeur et profondeur à chaque possession",
         "Chercher le joueur entre les lignes avant de renverser",
         "À la perte, contre-presser pendant 5 secondes"],
        acteurs, etapes, materiel)


# ---------------------------------------------------------------------------
# 3. Relance courte à 3 (décrochage du 6)
# ---------------------------------------------------------------------------

def relance_a_3():
    acteurs = [
        equipe("g", "1", "Gardien", "Gardien"),
        equipe("d4", "4", "Défenseur", "Défenseur central gauche"),
        equipe("d5", "5", "Défenseur", "Défenseur central droit"),
        equipe("d2", "2", "Défenseur", "Latéral droit"),
        equipe("d3", "3", "Défenseur", "Latéral gauche"),
        equipe("m6", "6", "Milieu", "Milieu défensif"),
        equipe("m8", "8", "Milieu", "Relayeur droit"),
        equipe("m10", "10", "Milieu", "Relayeur gauche"),
        adv("o9", "9", "Attaquant 1"),
        adv("o10", "10", "Attaquant 2"),
        adv("o8", "8", "Milieu"),
    ]
    etapes = [
        etape("Mise en place",
              "Le gardien a le ballon. Deux attaquants adverses pressent les centraux, "
              "un milieu adverse surveille le 6.",
              {"g": (34, 101), "d4": (27, 96), "d5": (41, 96), "d2": (58, 88), "d3": (10, 88),
               "m6": (34, 86), "m8": (45, 78), "m10": (23, 78),
               "o9": (30, 90), "o10": (38, 90), "o8": (34, 81)},
              porteur="g"),
        etape("Le 6 décroche entre les centraux",
              "Le 6 se place entre les deux centraux, qui s'écartent à hauteur de la surface. "
              "Les latéraux montent pour étirer le bloc adverse.",
              {"m6": (34, 95), "d4": (19, 94), "d5": (49, 94), "d2": (60, 78), "d3": (8, 78),
               "o9": (28, 91), "o10": (40, 91), "o8": (34, 85)},
              duree=2.5, focus=["m6", "d4", "d5"]),
        etape("Passe au 6 : 3 contre 2",
              "Le gardien joue court sur le 6. La première ligne de relance est à trois "
              "contre deux attaquants : un joueur est forcément libre.",
              {"o9": (33, 92)},
              duree=1.4, porteur="m6", focus=["m6"]),
        etape("Le central gauche est libre",
              "Un attaquant sort sur le 6 : le 6 trouve immédiatement le central gauche, "
              "laissé libre.",
              {"o9": (26, 92)},
              duree=1.5, porteur="d4", focus=["m6", "d4"]),
        etape("Conduire pour fixer",
              "Le central avance balle au pied. Le milieu adverse doit sortir sur lui ; "
              "le relayeur gauche se décale dans son dos.",
              {"d4": (20, 83), "o8": (24, 80), "m10": (28, 72), "o9": (24, 88)},
              duree=2.2, focus=["d4", "o8"]),
        etape("Passe qui élimine la première ligne",
              "Le relayeur reçoit face au jeu, dans le dos du milieu adverse : "
              "les trois adversaires sont éliminés.",
              {},
              duree=1.6, porteur="m10", focus=["d4", "m10"]),
    ]
    return tactique(
        "biblio-relance-a-3", "Relance courte à 3 (décrochage du 6)", "construction", "U15+",
        "20 min", "8 c 3",
        "Sortir proprement le ballon face à un pressing à deux attaquants grâce à la supériorité numérique.",
        ["Le 6 décroche quand les deux attaquants pressent les centraux",
         "Centraux très écartés, à hauteur de la surface de réparation",
         "Latéraux hauts et larges pour étirer le bloc adverse",
         "Le joueur libre conduit pour fixer avant de passer"],
        acteurs, etapes)


# ---------------------------------------------------------------------------
# 4. Jeu à trois / troisième homme
# ---------------------------------------------------------------------------

def troisieme_homme():
    acteurs = [
        equipe("d4", "4", "Défenseur", "Défenseur central"),
        equipe("m8", "8", "Milieu", "Relayeur (troisième homme)"),
        equipe("a9", "9", "Attaquant", "Pivot"),
        equipe("a7", "7", "Attaquant", "Ailier droit"),
        adv("o8", "8"), adv("o5", "5"), adv("o3", "3"),
    ]
    etapes = [
        etape("Mise en place",
              "Le central a le ballon. La passe directe vers le relayeur est fermée "
              "par un milieu adverse ; le pivot est marqué dans son dos.",
              {"d4": (30, 66), "m8": (38, 60), "a9": (31, 52), "a7": (58, 50),
               "o8": (36, 61.5), "o5": (31, 49.5), "o3": (55, 46)},
              porteur="d4"),
        etape("Passe verticale dans le pivot",
              "L'avant-centre décroche au contact de son défenseur et reçoit "
              "une passe appuyée dans les pieds.",
              {"a9": (31, 55), "o5": (31, 52.5)},
              duree=1.5, porteur="a9", focus=["d4", "a9"]),
        etape("Remise au troisième homme",
              "Le pivot remet en une touche au relayeur qui arrive lancé, face au jeu. "
              "Le milieu adverse, tourné vers le central, est éliminé.",
              {"m8": (37, 57.5)},
              duree=1.4, porteur="m8", focus=["a9", "m8"]),
        etape("Passe en profondeur pour l'ailier",
              "Au moment de la remise, l'ailier attaque l'espace dans le dos du latéral. "
              "Le relayeur le lance en profondeur pendant que le 9 pivote vers le but.",
              {"a7": (50, 38), "o3": (52.5, 41), "a9": (35, 44), "o5": (33, 47), "d4": (31, 60)},
              duree=2.2, porteur="a7", focus=["m8", "a7"]),
    ]
    return tactique(
        "biblio-troisieme-homme", "Jeu à trois : le troisième homme", "construction", "U13+",
        "15 min", "4 c 3",
        "Atteindre un partenaire marqué en passant par un appui : passe verticale, remise, passe vers l'avant.",
        ["Le pivot vient au contact puis remise en une touche",
         "Le troisième homme arrive face au jeu au moment de la passe verticale",
         "Communiquer : appel de balle et annonce « remise ! »",
         "L'ailier déclenche sa course au moment de la remise"],
        acteurs, etapes)


# ---------------------------------------------------------------------------
# 5. Chevauchement du latéral + centre
# ---------------------------------------------------------------------------

def chevauchement_centre():
    acteurs = [
        equipe("d2", "2", "Défenseur", "Latéral droit"),
        equipe("a7", "7", "Attaquant", "Ailier droit"),
        equipe("m8", "8", "Milieu", "Relayeur"),
        equipe("a9", "9", "Attaquant", "Avant-centre"),
        equipe("a11", "11", "Attaquant", "Ailier gauche"),
        adv("o1", "1", "Gardien", poste="Gardien"),
        adv("o3", "3", "Latéral"),
        adv("o4", "4", "Central"),
        adv("o5", "5", "Central"),
        adv("o6", "6", "Milieu"),
    ]
    etapes = [
        etape("Mise en place",
              "Attaque côté droit. Le relayeur a le ballon, l'ailier droit est marqué par "
              "le latéral adverse, le latéral droit est en soutien.",
              {"d2": (52, 42), "a7": (60, 30), "m8": (42, 36), "a9": (36, 22), "a11": (16, 26),
               "o1": (34, 4), "o3": (57, 27), "o4": (30, 14), "o5": (38, 15), "o6": (44, 30)},
              porteur="m8"),
        etape("Passe à l'ailier",
              "Le relayeur ouvre sur l'ailier droit, qui reçoit près de la ligne de touche. "
              "Le latéral adverse sort sur lui.",
              {"o3": (58, 26.5)},
              duree=1.6, porteur="a7", focus=["a7"]),
        etape("L'ailier rentre, le latéral chevauche",
              "L'ailier conduit vers l'intérieur pour attirer son défenseur. Le latéral "
              "droit déborde à l'extérieur en annonçant « derrière ! ».",
              {"a7": (54, 26), "o3": (55.5, 23.5), "d2": (63, 24), "o6": (47, 28)},
              duree=2.2, focus=["a7", "d2"]),
        etape("Passe dans la course du latéral",
              "L'ailier glisse le ballon dans la course du latéral. Dans la surface, "
              "les attaquants se préparent à attaquer les deux poteaux.",
              {"d2": (63, 16), "o3": (59, 20), "a9": (37, 14), "o5": (36, 11),
               "a11": (24, 14), "o4": (28, 10), "m8": (42, 22), "o6": (44, 24.5)},
              duree=1.8, porteur="d2", focus=["d2"]),
        etape("Centre et attaque des deux poteaux",
              "Le 9 attaque le premier poteau et emmène son défenseur ; le centre est "
              "dosé au second poteau pour l'ailier gauche. Le relayeur couvre le point de penalty.",
              {"a9": (38, 6), "o5": (36, 7.5), "a11": (29, 6), "o4": (31, 9),
               "o1": (36, 3), "m8": (40, 17), "o6": (43, 19)},
              duree=2.4, porteur="a11", action="centre", aerien=True, focus=["d2", "a9", "a11"]),
        etape("Reprise au second poteau",
              "L'ailier gauche reprend le centre au second poteau, loin du gardien attiré "
              "au premier.",
              {"o1": (35, 2.5)},
              duree=1.4, ballon=(31.5, 0.3), action="tir", focus=["a11"]),
    ]
    return tactique(
        "biblio-chevauchement-centre", "Chevauchement du latéral et centre", "attaque", "U13+",
        "20 min", "5 c 5",
        "Créer un surnombre sur un côté grâce au chevauchement, puis centrer pour les deux poteaux.",
        ["L'ailier rentre balle au pied pour fixer son vis-à-vis",
         "Le latéral annonce « derrière ! » et passe à l'extérieur",
         "Centrer devant le gardien, avant la ligne de sortie de but",
         "Attaquer les deux poteaux, un joueur au point de penalty"],
        acteurs, etapes)


# ---------------------------------------------------------------------------
# 6. Une-deux pour éliminer + frappe
# ---------------------------------------------------------------------------

def une_deux_frappe():
    acteurs = [
        equipe("m10", "10", "Milieu", "Meneur"),
        equipe("a9", "9", "Attaquant", "Pivot (mur)"),
        adv("o6", "6", "Milieu"),
        adv("o4", "4", "Central"),
        adv("o1", "1", "Gardien", poste="Gardien"),
    ]
    etapes = [
        etape("Mise en place",
              "Le 10 a le ballon face à un milieu adverse, à 30 m du but. "
              "L'avant-centre sert d'appui, marqué dans son dos.",
              {"m10": (30, 33), "a9": (37, 22), "o6": (30.5, 28.5), "o4": (37.5, 18.5), "o1": (34, 3)},
              porteur="m10"),
        etape("Conduire pour fixer",
              "Le 10 conduit vite vers son adversaire pour l'obliger à s'arrêter et à se "
              "positionner face à lui.",
              {"m10": (30, 30), "o6": (30.5, 27)},
              duree=1.6, focus=["m10", "o6"]),
        etape("La une : passe au mur",
              "Le 9 vient à la rencontre ; le 10 lui donne une passe appuyée dans les pieds.",
              {"a9": (36, 23), "o4": (36.5, 20)},
              duree=1.4, porteur="a9", focus=["m10", "a9"]),
        etape("La deux : remise dans la course",
              "Juste après sa passe, le 10 accélère dans le dos du milieu adverse. "
              "Le 9 remet en une touche dans sa course.",
              {"m10": (27, 18), "o6": (33.5, 24.5)},
              duree=1.6, porteur="m10", focus=["m10", "a9"]),
        etape("Frappe",
              "Le 10 frappe dès sa première touche, côté opposé au gardien.",
              {"o1": (32.5, 3.5)},
              duree=1.4, ballon=(36.8, 0.3), action="tir", focus=["m10"]),
    ]
    return tactique(
        "biblio-une-deux-frappe", "Une-deux pour éliminer et frappe", "attaque", "U11+",
        "15 min", "2 c 2 + gardien",
        "Éliminer un défenseur par une combinaison à deux puis conclure rapidement.",
        ["Conduite rapide vers le défenseur pour le fixer",
         "Passe appuyée dans le pied du partenaire",
         "Accélérer dans le dos du défenseur juste après la passe",
         "Remise en une touche, frappe en une ou deux touches"],
        acteurs, etapes)


# ---------------------------------------------------------------------------
# 7. Remise du pivot + frappe
# ---------------------------------------------------------------------------

def remise_pivot_frappe():
    acteurs = [
        equipe("m6", "6", "Milieu", "Milieu défensif"),
        equipe("a9", "9", "Attaquant", "Pivot"),
        equipe("m8", "8", "Milieu", "Milieu gauche"),
        equipe("m10", "10", "Milieu", "Milieu droit"),
        adv("o5", "5", "Central"),
        adv("o1", "1", "Gardien", poste="Gardien"),
    ]
    materiel = [mannequin(28, 31), mannequin(40, 31)]
    etapes = [
        etape("Mise en place",
              "Le 6 a le ballon à 40 m du but. Deux mannequins figurent la ligne "
              "du milieu adverse ; le pivot est marqué par un central.",
              {"m6": (34, 40), "a9": (34, 22), "m8": (24, 30), "m10": (44, 30),
               "o5": (34, 19), "o1": (34, 3)},
              porteur="m6"),
        etape("Le pivot décroche et reçoit",
              "L'avant-centre décroche entre les mannequins et reçoit dos au but, "
              "corps entre le défenseur et le ballon.",
              {"a9": (34, 25), "o5": (34, 22.5)},
              duree=1.6, porteur="a9", focus=["m6", "a9"]),
        etape("Remise en retrait",
              "Le milieu gauche arrive lancé ; le pivot lui remet le ballon en une touche, "
              "devant lui. Le milieu droit attaque la surface.",
              {"m8": (29, 23), "m10": (41, 15)},
              duree=1.4, porteur="m8", focus=["a9", "m8"]),
        etape("Frappe en une touche et suivi",
              "Le milieu frappe sans contrôle. Le pivot et le milieu droit suivent la "
              "frappe pour un éventuel rebond.",
              {"a9": (31, 11), "o5": (35, 17), "m10": (39, 8), "o1": (32.5, 3.5)},
              duree=1.6, ballon=(37, 0.3), action="tir", focus=["m8"]),
    ]
    return tactique(
        "biblio-remise-pivot-frappe", "Remise du pivot et frappe", "finition", "U13+",
        "15 min", "4 c 1 + gardien",
        "Enchaîner jeu en pivot, remise et frappe lointaine en une touche.",
        ["Le pivot protège le ballon, corps entre défenseur et ballon",
         "Remise en une touche, appuyée, devant le milieu",
         "Le milieu arrive lancé et frappe sans contrôle",
         "Les attaquants suivent systématiquement la frappe"],
        acteurs, etapes, materiel)


# ---------------------------------------------------------------------------
# 8. Pressing haut déclenché par la passe vers le latéral
# ---------------------------------------------------------------------------

def pressing_lateral():
    acteurs = [
        equipe("a9", "9", "Attaquant", "Avant-centre"),
        equipe("a11", "11", "Attaquant", "Ailier gauche"),
        equipe("a7", "7", "Attaquant", "Ailier droit"),
        equipe("m10", "10", "Milieu", "Milieu offensif"),
        equipe("m8", "8", "Milieu", "Relayeur"),
        equipe("m6", "6", "Milieu", "Milieu défensif"),
        equipe("d3", "3", "Défenseur", "Latéral gauche"),
        adv("o1", "1", "Gardien", poste="Gardien"),
        adv("o4", "4", "Central"), adv("o5", "5", "Central"),
        adv("o2", "2", "Latéral"), adv("o3", "3", "Latéral"),
        adv("o6", "6", "Milieu"), adv("o8", "8", "Milieu"), adv("o7", "7", "Ailier"),
    ]
    etapes = [
        etape("Mise en place",
              "L'adversaire relance depuis ses centraux. Notre bloc attend, chaque joueur "
              "placé entre le ballon et un adversaire.",
              {"a9": (34, 17), "a11": (17, 19), "a7": (51, 19), "m10": (34, 29), "m8": (44, 32),
               "m6": (24, 34), "d3": (12, 46),
               "o1": (34, 4), "o4": (27, 11), "o5": (41, 11), "o2": (8, 24), "o3": (60, 24),
               "o6": (34, 24), "o8": (22, 30), "o7": (10, 42)},
              porteur="o4"),
        etape("Orienter la relance",
              "L'avant-centre presse le central par une course courbée : il ferme la passe vers "
              "l'autre central et vers le 6. La relance est orientée vers le côté.",
              {"a9": (31, 14), "m10": (34, 27.5), "a11": (17, 18)},
              duree=2.0, focus=["a9"]),
        etape("Déclencheur : passe vers le latéral",
              "La passe vers le latéral est le signal. Pendant la course du ballon, l'ailier "
              "sort au pressing et tout le bloc se resserre sur le joueur le plus proche.",
              {"a11": (12, 21), "a9": (25, 14), "m10": (33, 26.5), "m6": (22.5, 32.5),
               "d3": (11, 44.5), "a7": (41, 17), "m8": (36, 32)},
              duree=2.2, porteur="o2", focus=["a11", "o2"]),
        etape("Fermer les lignes, récupérer",
              "Toutes les passes courtes sont fermées. Le latéral adverse doit jouer long le "
              "long de la ligne : notre latéral gauche anticipe et intercepte.",
              {"a11": (9.5, 22.5), "d3": (10, 38.5)},
              duree=1.8, porteur="d3", focus=["a11", "d3"]),
        etape("Attaquer vite après la récupération",
              "Le latéral joue immédiatement vers l'avant sur le 6 pendant que l'avant-centre "
              "attaque la profondeur dans le dos du central.",
              {"m6": (19, 29), "a9": (30, 8)},
              duree=1.8, porteur="m6", focus=["d3", "m6", "a9"]),
        etape("Passe en profondeur",
              "Moins de trois passes après la récupération : l'avant-centre est lancé "
              "face au gardien.",
              {"a9": (31, 7), "o4": (29, 10.5), "o1": (33, 4.5)},
              duree=2.0, porteur="a9", focus=["m6", "a9"]),
    ]
    return tactique(
        "biblio-pressing-lateral", "Pressing haut déclenché sur le latéral", "pressing", "U15+",
        "20 min", "7 c 8",
        "Orienter la relance adverse vers un côté puis presser collectivement au signal pour récupérer haut.",
        ["Attendre le déclencheur (passe vers le latéral) avant de sortir",
         "Course courbée pour couper la passe en retrait",
         "Le bloc coulisse : chacun prend le joueur le plus proche du ballon",
         "Après la récupération, attaquer la profondeur en moins de trois passes"],
        acteurs, etapes)


# ---------------------------------------------------------------------------
# 9. Coulissement de la ligne de 4
# ---------------------------------------------------------------------------

def coulissement_ligne_4():
    acteurs = [
        equipe("g", "1", "Gardien", "Gardien"),
        equipe("d2", "2", "Défenseur", "Latéral droit"),
        equipe("d5", "5", "Défenseur", "Central droit"),
        equipe("d4", "4", "Défenseur", "Central gauche"),
        equipe("d3", "3", "Défenseur", "Latéral gauche"),
        equipe("m6", "6", "Milieu", "Milieu défensif"),
        adv("o10", "10", "Meneur"), adv("o11", "11", "Ailier"), adv("o7", "7", "Ailier"),
        adv("o9", "9", "Avant-centre"), adv("o8", "8", "Milieu"),
    ]
    etapes = [
        etape("Mise en place",
              "Ligne de quatre à plat devant son gardien, le 6 devant elle. "
              "L'adversaire a le ballon dans l'axe.",
              {"g": (34, 100), "d3": (14, 82), "d4": (28, 82), "d5": (40, 82), "d2": (54, 82),
               "m6": (36, 68),
               "o10": (40, 58), "o11": (60, 66), "o7": (8, 64), "o9": (34, 74), "o8": (24, 58)},
              porteur="o10"),
        etape("Ballon côté droit : tout le bloc coulisse",
              "Le latéral droit sort sur l'ailier, les autres défenseurs coulissent en gardant "
              "10 à 12 m entre eux. Le côté opposé est volontairement laissé libre.",
              {"d2": (58, 72), "d5": (48, 79), "d4": (38, 80), "d3": (27, 80), "m6": (46, 68),
               "o9": (36, 73), "g": (37, 100)},
              duree=2.4, porteur="o11", focus=["d2", "d5"]),
        etape("Passe en retrait : la ligne remonte",
              "Le ballon revient vers l'arrière : la ligne remonte ensemble pour réduire "
              "l'espace entre les lignes et piéger les attaquants hors-jeu.",
              {"o10": (42, 56), "d2": (56, 75), "d5": (46, 76), "d4": (36, 76), "d3": (26, 76),
               "o9": (34, 71), "m6": (42, 64)},
              duree=2.0, porteur="o10", focus=["d5", "d4"]),
        etape("Renversement : coulisser de l'autre côté",
              "Transversale vers l'ailier opposé. Pendant le vol du ballon, toute la ligne "
              "glisse ; le latéral gauche sort, le latéral droit rentre dans l'axe.",
              {"d3": (12, 70), "d4": (22, 76), "d5": (32, 77), "d2": (44, 76), "m6": (26, 64),
               "o9": (32, 72), "g": (31, 100)},
              duree=2.8, porteur="o7", aerien=True, focus=["d3", "d2"]),
        etape("Contenir et fermer l'intérieur",
              "Le latéral se place côté intérieur et pousse l'ailier vers la touche ; "
              "le central gauche couvre dans son dos.",
              {"o7": (9, 72), "d3": (12, 74), "d4": (20, 78), "d5": (30, 79), "d2": (42, 78),
               "o9": (30, 74)},
              duree=2.2, focus=["d3", "d4"]),
    ]
    return tactique(
        "biblio-coulissement-ligne-4", "Coulissement de la ligne de 4", "defense", "U15+",
        "20 min", "5 + gardien c 5",
        "Rester compact en coulissant collectivement du côté du ballon et en couvrant le partenaire qui sort.",
        ["10 à 12 m entre deux défenseurs, jamais plus",
         "Le latéral côté ballon sort, les autres couvrent en diagonale",
         "Ballon en retrait : la ligne remonte ensemble",
         "Le latéral opposé rentre dans l'axe et laisse le côté faible",
         "Communiquer : « sors ! », « couvre ! », « monte ! »"],
        acteurs, etapes)


# ---------------------------------------------------------------------------
# 10. Contre-attaque 3 c 2
# ---------------------------------------------------------------------------

def contre_attaque_3c2():
    acteurs = [
        equipe("m8", "8", "Milieu", "Porteur axial"),
        equipe("a7", "7", "Attaquant", "Ailier droit"),
        equipe("a11", "11", "Attaquant", "Ailier gauche"),
        adv("o4", "4", "Central"),
        adv("o5", "5", "Central"),
        adv("o1", "1", "Gardien", poste="Gardien"),
    ]
    materiel = [plot(12, 50, "jaune"), plot(56, 50, "jaune")]
    etapes = [
        etape("Mise en place",
              "Ballon récupéré au milieu : trois attaquants contre deux défenseurs "
              "qui reculent. Départ à hauteur des plots.",
              {"m8": (34, 50), "a7": (52, 48), "a11": (16, 48),
               "o4": (29, 36), "o5": (39, 36), "o1": (34, 4)},
              porteur="m8"),
        etape("Conduite axiale, ailiers larges",
              "Le porteur attaque vite dans l'axe. Les ailiers sprintent en restant larges "
              "pour écarter les deux défenseurs.",
              {"m8": (34, 36), "o4": (29, 28), "o5": (39, 28), "a7": (54, 32), "a11": (14, 32)},
              duree=2.6, focus=["m8"]),
        etape("Fixer un défenseur",
              "Le porteur continue vers le central droit pour l'obliger à sortir. "
              "Les deux défenseurs ne peuvent plus couvrir les deux ailiers.",
              {"m8": (36, 27), "o5": (39, 23.5), "o4": (31, 20), "a7": (52, 21), "a11": (16, 21)},
              duree=2.0, focus=["m8", "o5"]),
        etape("Passe au joueur libre",
              "Dès que le défenseur s'engage, passe pour l'ailier droit libre. "
              "Le porteur poursuit sa course vers le but.",
              {"a7": (50, 16), "o4": (33, 14), "o5": (42, 18), "m8": (37, 19), "a11": (22, 12)},
              duree=1.8, porteur="a7", focus=["m8", "a7"]),
        etape("Déborder et attirer",
              "L'ailier conduit vers la surface et attire le dernier défenseur. "
              "L'ailier gauche file au second poteau.",
              {"a7": (48, 9), "o5": (45, 11), "m8": (36, 12), "o4": (33, 10), "a11": (28, 8),
               "o1": (36, 3.5)},
              duree=1.8, focus=["a7"]),
        etape("Centre à ras de terre",
              "Centre en retrait devant le but : l'ailier opposé, oublié au second poteau, "
              "est seul.",
              {"a11": (29, 7)},
              duree=1.6, porteur="a11", focus=["a7", "a11"]),
        etape("Finition",
              "Reprise du plat du pied, côté opposé au gardien. L'action doit durer moins de "
              "8 secondes.",
              {"o1": (34.5, 2.5)},
              duree=1.4, ballon=(31.5, 0.3), action="tir", focus=["a11"]),
    ]
    return tactique(
        "biblio-contre-attaque-3c2", "Contre-attaque 3 contre 2", "transition", "U13+",
        "15 min", "3 c 2 + gardien",
        "Exploiter rapidement une supériorité numérique après la récupération du ballon.",
        ["Le porteur conduit vite dans l'axe pour fixer un défenseur",
         "Les ailiers restent larges, puis attaquent le but",
         "Passer au moment où le défenseur s'engage",
         "Finir l'action en moins de 8 secondes"],
        acteurs, etapes, materiel)


# ---------------------------------------------------------------------------
# 11. Contre-pressing après perte
# ---------------------------------------------------------------------------

def contre_pressing():
    acteurs = [
        equipe("m8", "8", "Milieu", "Relayeur"),
        equipe("m10", "10", "Milieu", "Milieu offensif"),
        equipe("a9", "9", "Attaquant", "Avant-centre"),
        equipe("a7", "7", "Attaquant", "Ailier droit"),
        equipe("a11", "11", "Attaquant", "Ailier gauche"),
        equipe("m6", "6", "Milieu", "Milieu défensif"),
        adv("o6", "6", "Milieu"), adv("o8", "8", "Milieu"), adv("o10", "10", "Meneur"),
        adv("o4", "4", "Central"), adv("o2", "2", "Latéral"),
    ]
    etapes = [
        etape("Mise en place",
              "Nous attaquons dans le camp adverse. Le relayeur a le ballon au milieu, "
              "pressé par le 6 adverse.",
              {"m8": (40, 40), "m10": (31, 36), "a9": (36, 27), "a7": (57, 34), "a11": (14, 32),
               "m6": (32, 52),
               "o6": (42, 37.5), "o8": (26, 44), "o10": (50, 50), "o4": (37, 22), "o2": (54, 26)},
              porteur="m8"),
        etape("Perte du ballon",
              "Le relayeur perd le ballon. C'est le déclencheur : pas de temps mort, "
              "tout le monde réagit immédiatement.",
              {"o6": (41.5, 38)},
              duree=1.4, porteur="o6", focus=["m8", "o6"]),
        etape("Réaction immédiate : encercler",
              "Les trois joueurs les plus proches encerclent le porteur ; les autres ferment "
              "les passes courtes vers ses partenaires.",
              {"m8": (43, 40.5), "m10": (38.5, 37), "a9": (41, 34), "m6": (28, 45),
               "a7": (49, 45), "a11": (22, 38)},
              duree=1.8, focus=["m8", "m10", "a9"]),
        etape("Récupérer en moins de 5 secondes",
              "Enfermé, le porteur tente une passe vers son meneur : l'ailier droit, "
              "placé sur la ligne de passe, intercepte.",
              {"a7": (47, 43)},
              duree=1.4, porteur="a7", focus=["a7"]),
        etape("Attaquer immédiatement",
              "La défense adverse, qui s'était projetée, est désorganisée : passe tout de "
              "suite vers l'avant pour l'avant-centre qui a pivoté.",
              {"a9": (44, 24), "a11": (24, 22)},
              duree=1.8, porteur="a9", focus=["a7", "a9"]),
    ]
    return tactique(
        "biblio-contre-pressing", "Contre-pressing après la perte", "transition", "U15+",
        "15 min", "6 c 5",
        "Récupérer le ballon dans les 5 secondes qui suivent la perte, puis attaquer immédiatement.",
        ["Règle des 5 secondes : les trois joueurs les plus proches pressent",
         "Encercler le porteur et fermer les lignes de passe proches",
         "Si la récupération échoue, se replacer vite derrière le ballon",
         "Récupération = attaque immédiate vers l'avant"],
        acteurs, etapes)


# ---------------------------------------------------------------------------
# 12. Corner offensif : appel premier poteau + déviation
# ---------------------------------------------------------------------------

def corner_premier_poteau():
    acteurs = [
        equipe("a7", "7", "Attaquant", "Tireur du corner"),
        equipe("a9", "9", "Attaquant", "Appel premier poteau"),
        equipe("d4", "4", "Défenseur", "Second poteau"),
        equipe("d5", "5", "Défenseur", "Point de penalty"),
        equipe("m10", "10", "Milieu", "Second ballon"),
        equipe("m8", "8", "Milieu", "Second ballon"),
        adv("o1", "1", "Gardien", poste="Gardien"),
        adv("o2", "2", "Premier poteau"),
        adv("o4", "4", "Zone"),
        adv("o5", "5", "Zone"),
        adv("o3", "3", "Marque le 4"),
        adv("o8", "8", "Marque le 9"),
        adv("o6", "6", "Marque le 5"),
    ]
    etapes = [
        etape("Mise en place",
              "Corner côté droit. Les grands gabarits sont regroupés au point de penalty, "
              "deux joueurs restent à l'entrée de la surface pour le second ballon.",
              {"a7": (67, 1), "a9": (41, 13), "d4": (33, 15), "d5": (27, 14), "m10": (44, 20),
               "m8": (30, 21),
               "o1": (34, 1.5), "o2": (37.4, 1.2), "o4": (38, 5.5), "o5": (33, 6),
               "o8": (41, 11), "o3": (33, 13), "o6": (27.5, 12)},
              porteur="a7"),
        etape("Mouvements avant le centre",
              "Le tireur lève le bras : le 9 démarre vers le premier poteau, le 4 feinte "
              "vers l'avant pour fixer son marqueur.",
              {"a9": (41.5, 9), "o8": (40, 7.5), "d4": (31.5, 12), "o3": (32.5, 10),
               "d5": (34.5, 11), "o6": (33.5, 13)},
              duree=1.6, focus=["a9", "d4"]),
        etape("Centre au premier poteau",
              "Centre tendu au premier poteau : le 9 attaque le ballon devant son défenseur. "
              "Le 4 part tard, dans le dos de son marqueur, vers le second poteau.",
              {"a9": (39.5, 4.5), "o8": (41, 6.5), "o1": (35.5, 1.8), "d4": (29.5, 4.5),
               "o3": (31.5, 8.5), "m10": (43, 17), "m8": (30, 18)},
              duree=2.2, porteur="a9", action="centre", aerien=True, focus=["a7", "a9"]),
        etape("Déviation vers le second poteau",
              "Le 9 dévie de la tête vers l'arrière, sans chercher le but : le ballon "
              "file au second poteau, hors de portée du gardien.",
              {"o1": (34, 1.8)},
              duree=1.4, porteur="d4", action="passe", aerien=True, focus=["a9", "d4"]),
        etape("Reprise au second poteau",
              "Le 4, seul au second poteau, reprend de la tête vers le but.",
              {"o1": (33, 1.5)},
              duree=1.4, ballon=(30.8, 0.3), action="tir", focus=["d4"]),
    ]
    return tactique(
        "biblio-corner-premier-poteau", "Corner : appel premier poteau et déviation", "cpa",
        "U15+", "15 min", "6 c 6 + gardien",
        "Marquer sur corner grâce à une déviation au premier poteau reprise au second.",
        ["Le joueur du premier poteau attaque le ballon devant son défenseur",
         "Déviation légère de la tête vers l'arrière, sans chercher le but",
         "Le joueur du second poteau part tard, dans le dos de son marqueur",
         "Deux joueurs restent hors de la surface pour le second ballon"],
        acteurs, etapes)


TACTIQUES = [
    rondo_4c2,
    conservation_5c5,
    relance_a_3,
    troisieme_homme,
    chevauchement_centre,
    une_deux_frappe,
    remise_pivot_frappe,
    pressing_lateral,
    coulissement_ligne_4,
    contre_attaque_3c2,
    contre_pressing,
    corner_premier_poteau,
]


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def en_metres(p):
    return p[0] * LARGEUR, p[1] * LONGUEUR


def decalage_ballon(camp):
    """Même décalage que TacticPlay.ballOffset (≈ 0,7 m vers le but attaqué)."""
    return {"equipe": -0.0067, "adversaire": 0.0067}.get(camp, 0.0)


def valider(tactiques):
    erreurs = []
    ids_tactiques = set()

    def err(t, msg):
        erreurs.append(f"[{t.get('id', '?')}] {msg}")

    def dans_terrain(t, quoi, p, marge):
        if not (isinstance(p, list) and len(p) == 2):
            err(t, f"{quoi} : point invalide {p!r}")
            return
        if not (0 <= p[0] <= 1 and 0 <= p[1] <= 1):
            err(t, f"{quoi} : coordonnée hors [0, 1] {p}")
            return
        if marge:
            x, y = en_metres(p)
            # tolérance d'arrondi (3 décimales)
            tol = 0.06
            if not (MARGE - tol <= x <= LARGEUR - MARGE + tol and MARGE - tol <= y <= LONGUEUR - MARGE + tol):
                err(t, f"{quoi} : à moins de {MARGE} m d'une ligne ({x:.2f}, {y:.2f})")

    for t in tactiques:
        if t["id"] in ids_tactiques:
            err(t, "id de tactique en double")
        ids_tactiques.add(t["id"])
        if t["categorie"] not in CATEGORIES:
            err(t, f"catégorie inconnue {t['categorie']!r}")
        if not 3 <= len(t["consignes"]) <= 5:
            err(t, "il faut 3 à 5 consignes")
        if not 4 <= len(t["etapes"]) <= 7:
            err(t, "il faut 1 étape de mise en place + 3 à 6 étapes")

        camps = {}
        for a in t["acteurs"]:
            if a["id"] in camps:
                err(t, f"acteur en double {a['id']}")
            camps[a["id"]] = a["camp"]
            if a["camp"] not in ("equipe", "adversaire", "joker"):
                err(t, f"camp inconnu pour {a['id']}")
            if a["camp"] == "equipe" and a.get("poste") not in POSTES:
                err(t, f"poste manquant ou invalide pour {a['id']}")
            if "poste" in a and a["poste"] not in POSTES:
                err(t, f"poste invalide pour {a['id']}")

        for i, mat in enumerate(t.get("materiel", [])):
            dans_terrain(t, f"matériel {i}", mat["pos"], marge=False)
            if mat.get("couleur") and mat["couleur"] not in COULEURS:
                err(t, f"matériel {i} : couleur inconnue {mat['couleur']}")
            if "taille" in mat:
                w, h = mat["taille"]
                if not (0 < w <= 1 and 0 < h <= 1):
                    err(t, f"matériel {i} : taille invalide")

        positions = {}
        porteur = None
        ballon = [0.5, 0.5]
        for n, e in enumerate(t["etapes"]):
            lieu = f"étape {n} « {e['titre']} »"
            for k, p in e["positions"].items():
                if k not in camps:
                    err(t, f"{lieu} : acteur inconnu {k!r}")
                dans_terrain(t, f"{lieu} / {k}", p, marge=True)
            for k in e.get("focus", []):
                if k not in camps:
                    err(t, f"{lieu} : focus sur acteur inconnu {k!r}")
            if "porteur" in e and e["porteur"] not in camps:
                err(t, f"{lieu} : porteur inexistant {e['porteur']!r}")
            if "ballon" in e:
                dans_terrain(t, f"{lieu} / ballon", e["ballon"], marge=False)
            if "duree" in e and not DUREE_MIN <= e["duree"] <= DUREE_MAX:
                err(t, f"{lieu} : durée {e['duree']} hors [{DUREE_MIN}, {DUREE_MAX}]")

            if n == 0:
                manquants = set(camps) - set(e["positions"])
                if manquants:
                    err(t, f"{lieu} : positions manquantes {sorted(manquants)}")
                if "porteur" not in e and "ballon" not in e:
                    err(t, f"{lieu} : ni porteur ni ballon")
                if "action" in e:
                    err(t, f"{lieu} : pas d'action à la mise en place")
            elif "duree" not in e:
                err(t, f"{lieu} : durée manquante")

            # Résolution identique à TacticPlay.resolvedFrames()
            positions.update(e["positions"])
            if e.get("porteur") in positions:
                porteur = e["porteur"]
            elif "ballon" in e:
                porteur = None
                ballon = e["ballon"]
            if porteur is not None and porteur in positions:
                p = positions[porteur]
                ballon = [p[0], p[1] + decalage_ballon(camps.get(porteur))]
            if not (0 <= ballon[0] <= 1 and 0 <= ballon[1] <= 1):
                err(t, f"{lieu} : ballon résolu hors terrain {ballon}")

            for (ka, pa), (kb, pb) in itertools.combinations(sorted(positions.items()), 2):
                xa, ya = en_metres(pa)
                xb, yb = en_metres(pb)
                d = ((xa - xb) ** 2 + (ya - yb) ** 2) ** 0.5
                if d < ECART_MIN:
                    err(t, f"{lieu} : {ka} et {kb} à {d:.2f} m (< {ECART_MIN} m)")
    return erreurs


# ---------------------------------------------------------------------------
# Écriture
# ---------------------------------------------------------------------------

def formater(document):
    texte = json.dumps(document, ensure_ascii=False, indent=2)
    # Points [x, y] sur une seule ligne
    texte = re.sub(r"\[\s*(-?[\d.]+),\s*(-?[\d.]+)\s*\]", r"[\1, \2]", texte)
    # Listes d'ids (focus) sur une seule ligne
    texte = re.sub(r'\[\s*((?:"[^"\n]*",\s*)*"[^"\n]*")\s*\]',
                   lambda mo: "[" + re.sub(r",\s+", ", ", mo.group(1)) + "]"
                   if len(mo.group(0)) < 120 and "\n" in mo.group(0) and all(
                       len(s) < 12 for s in re.findall(r'"([^"]*)"', mo.group(1))) else mo.group(0),
                   texte)
    return texte + "\n"


def main():
    tactiques = [f() for f in TACTIQUES]
    erreurs = valider(tactiques)
    if erreurs:
        print(f"Validation : {len(erreurs)} erreur(s)", file=sys.stderr)
        for e in erreurs:
            print("  - " + e, file=sys.stderr)
        sys.exit(1)

    document = {"format": "tempsdejeu.tactique", "version": 1, "tactiques": tactiques}
    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write(formater(document))

    print(f"Validation OK — {len(tactiques)} tactiques écrites dans {os.path.relpath(SORTIE, RACINE)}")
    for t in tactiques:
        print(f"  • {t['titre']} [{t['categorie']}] — {len(t['etapes'])} étapes")


if __name__ == "__main__":
    main()
