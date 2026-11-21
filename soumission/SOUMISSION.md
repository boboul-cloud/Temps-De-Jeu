# Temps De Jeu — dossier de soumission App Store

Version **1.7**, build **30** — mise à jour de l'app publiée en 1.6.1 (build 29).

La build 30 a été archivée et envoyée chez Apple le **21/11/2026 à 16 h 04** (Xcode :
« Uploaded to Apple », sans erreur ni avertissement). Elle contient l'Atelier d'exercices
(branche `atelier`, commit `3882247`) et aucune donnée de démonstration.

## À remplir à la main dans App Store Connect (mise à jour)

**AgentDouble ne prend pas cette app** : il écarte toute app qui a déjà une version en vente
(verrou « déjà publiée », `src/app/etat.ts`), donc Temps De Jeu n'apparaît pas dans
« + Choisir une app ». Pour une mise à jour, seuls les champs de la version changent ; le
reste (nom, sous-titre, catégories, adresses, confidentialité, classification) est déjà en
place depuis la 1.6.1 et ne bouge pas.

Dans App Store Connect › Temps De Jeu › onglet Distribution, version iOS **1.7** (la créer avec
« + » à côté de « App iOS » si elle n'existe pas), dans cet ordre :

1. **Captures** : supprimer les anciennes, déposer les 6 de `captures/iphone-6.9/` dans
   « iPhone 6,9 pouces » et les 6 de `captures/ipad-13/` dans « iPad 13 pouces », dans
   l'ordre des numéros.
2. **Texte promotionnel** : bloc de la section 3.
3. **Description** : bloc de la section 4.
4. **Mots-clés** : bloc de la section 5.
5. **Nouveautés de cette version** : bloc « Nouveautés de cette version ».
6. **Build** : « Ajouter une build » › 30 (une fois le traitement d'Apple terminé).
7. **Informations pour la vérification de l'app** › Notes : bloc de la section 6. Pas de
   compte de démonstration (« Connexion requise » décoché).
8. Achat intégré : rien à joindre, Premium est déjà validé.
9. Enregistrer, relire, puis « Ajouter pour vérification » et soumettre.

## 1. Identité de l'app

| Champ | Valeur |
|---|---|
| Nom | `Temps De Jeu` (12/30) |
| Sous-titre | `Matchs, effectifs, tactique 3D` (30/30) |
| Identifiant du bundle | `bob.oulhen-gmail.com.Temps-De-Jeu` |
| Catégorie principale | Sports |
| Catégorie secondaire | Productivité |
| Langue principale | Français (France) |
| Droits d'auteur | `2026 Robert Oulhen` |

## 2. Adresses

| Champ | Adresse |
|---|---|
| URL d'assistance | `https://boboul-cloud.github.io/Temps-De-Jeu/` |
| URL marketing | `https://boboul-cloud.github.io/Temps-De-Jeu/` |
| Politique de confidentialité | `https://boboul-cloud.github.io/Temps-De-Jeu/privacy.html` |

Les trois adresses répondent (vérifié le 21/11/2026, code 200) et parlent bien de Temps De Jeu.

## 3. Texte promotionnel (170)

160/170 caractères.

```
Nouveau : l'Atelier d'exercices. Plots, chasubles, joueurs et ballons sur le terrain, étapes animées en 3D, séances minutées avec le matériel calculé tout seul.
```

## 4. Description (4000)

3967/4000 caractères.

```
TEMPS DE JEU, l'outil des éducateurs de football amateur. Gérez vos matchs, vos entraînements et vos effectifs depuis votre iPhone ou votre iPad. Conçue par un éducateur, pour les éducateurs.

NOUVEAU : L'ATELIER D'EXERCICES
• Dessinez vos exercices en plein écran : joueurs, gardiens, ballons, plots, coupelles, piquets, mannequins, mini-buts, zones, cerceaux, échelles, haies
• 8 couleurs de chasubles et de matériel, et des raccourcis prêts à poser : carrés, rondos, jeux réduits avec mini-buts, slaloms
• Étapes animées : glissez le ballon sur un partenaire pour une passe, déplacez le porteur pour une conduite ; les flèches se tracent toutes seules
• Mode cinéma : votre exercice en 3D plein écran, avec la consigne en sous-titre
• Fiche d'exercice : objectif, consignes et matériel à prévoir calculé tout seul, en PDF à imprimer
• Séances : enchaînez des exercices minutés, obtenez le matériel total et faites les équipes avec les joueurs présents

PLACEMENT ET TACTIQUES EN 3D
• Votre composition sur un terrain en relief : déplacez joueurs et ballon du bout du doigt
• Quatre caméras : coach, tribune, vue de dessus, immersion
• Construisez vos séquences au doigt : conduite, passe, tir. Les flèches s'affichent avant de valider chaque étape
• 12 exercices animés prêts à l'emploi (rondo, relance à 3, troisième homme, pressing haut, contre-attaque, corner…), à copier et adapter
• Partagez exercices et tactiques en fichier .tdjt par Messages, AirDrop ou e-mail

GESTION DE MATCH EN TEMPS RÉEL
Lancez le chrono, faites vos remplacements en un geste et suivez en direct le temps de jeu de chaque joueur. Chaque arrêt de jeu est chronométré (touche, corner, coup franc, penalty, blessure, VAR…) et le temps additionnel se calcule tout seul (blessures, VAR, anti-jeu, 30 s par remplacement). Enregistrez buts, passes décisives, fautes et cartons au fil du match.

ÉQUITÉ DU TEMPS DE JEU
Un indicateur vous alerte en direct si l'écart de temps de jeu se creuse entre vos joueurs. Vert, orange ou rouge : impossible d'oublier quelqu'un sur le banc.

SUIVI DES CARTONS
Jaunes, rouges, doubles jaunes et cartons blancs (exclusion temporaire avec compte à rebours). Tableau de bord dédié, historique par joueur, suspensions purgées.

STATISTIQUES COMPLÈTES
Possession, passes, fautes par joueur et par période, temps de jeu effectif, détail des arrêts. Récapitulatif de match généré automatiquement et partageable.

MULTI-CATÉGORIES
De U7 à Seniors : toutes vos équipes dans une seule app, avec une base de joueurs partagée et des badges de couleur pour les prêts entre catégories.

CASCADE INTER-ÉQUIPES
Partagez votre composition par iMessage : l'équipe suivante voit automatiquement les joueurs déjà retenus. Fini les doublons le week-end.

ENCADREMENT
Entraîneurs adjoints, arbitres, délégués, préparateurs physiques… Rôles personnalisables et coordonnées à portée de main.

ENTRAÎNEMENTS ET PRÉSENCES
Pointez les présences, invitez des joueurs d'autres catégories, ajoutez des notes et exportez les feuilles de présence en PDF.

SONDAGES DE DISPONIBILITÉ
Créez un sondage et partagez le lien : vos joueurs répondent Présent, Absent ou Incertain depuis leur navigateur, et les réponses s'intègrent automatiquement.

SAISONS ET HISTORIQUE
Organisez matchs et entraînements par saison. Archivez et repartez de zéro en un geste, sans perdre vos données.

EXPORT ET PARTAGE
PDF, compositions (.tdj), matchs (.tdjm), exercices et tactiques (.tdjt) : partage par iMessage, AirDrop ou e-mail, avec import automatique chez le destinataire.

WIDGET
Votre prochain match ou entraînement sur l'écran d'accueil.

PREMIUM
5 matchs gratuits pour tout essayer. Premium (achat unique, sans abonnement) : matchs illimités et toutes les futures mises à jour incluses. L'Atelier, les exercices 3D et les séances sont accessibles sans achat.

Toutes vos données restent sur votre appareil. Aucun compte, aucune publicité.

TEMPS DE JEU, c'est moins de paperasse et plus de terrain.
```

## 5. Mots-clés (100, virgules comprises, sans espace)

97/100 caractères. Aucun mot du nom (temps, jeu) ni du sous-titre (matchs, effectifs, tactique, 3D).
« pressing » laisse sa place à « séance », plus cherché depuis l'arrivée de l'Atelier.

```
football,coach,entraîneur,éducateur,remplacements,chrono,stats,cartons,exercices,rondo,séance,U13
```

## 6. Notes pour l'examinateur

1945/4000 caractères.

```
Aucun compte n'est nécessaire : toutes les données restent sur l'appareil.

ESSAYER L'APP EN DEUX MINUTES
1. Onglet Joueurs : ajoutez quelques joueurs avec le bouton +.
2. Onglet Match : renseignez les équipes, touchez « Sélectionner les joueurs pour ce match », cochez-les et désignez les titulaires.
3. Touchez « Placement » puis le sélecteur 2D/3D en haut à droite : la composition s'affiche sur un terrain 3D ; faites glisser un joueur pour le déplacer.
4. Onglet Présences > bouton « Atelier » en haut à gauche : l'Atelier d'exercices s'ouvre en plein écran. Onglet « Bibliothèque » : 12 exercices animés en 3D ; touchez-en un, puis Lecture.
5. Onglet « Mes exercices » > « Nouvel exercice ». Touchez « Raccourcis » (étoiles jaunes) > « Rondo 4 contre 2 » : plots, joueurs et ballon se posent. Touchez « Étape », glissez le ballon sur un autre joueur (passe), puis « Cinéma » pour la 3D plein écran. « Fiche » affiche le matériel à prévoir, calculé tout seul. « Enregistrer » range l'exercice dans « Mes exercices ».
6. Onglet « Séances » > « Nouvelle séance » > « Ajouter un exercice » : la durée et le matériel total se calculent.
7. Onglet Match > « Démarrer le match » : chrono, arrêts de jeu, remplacements.

ACHAT INTÉGRÉ
Un seul achat non consommable, « Temps De Jeu Premium » (com.tempsDeJeu.premium) : matchs illimités au-delà des 5 matchs gratuits. Il est proposé dans l'onglet Réglages et Exports > « Version gratuite » > Upgrade, et quand la limite de 5 matchs est atteinte. « Restaurer mes achats » se trouve sur le même écran. L'Atelier, les exercices 3D et les séances sont accessibles sans achat.

AUTORISATIONS
Notifications : signaler une réponse reçue à un sondage de disponibilité et rappeler les joueurs qui n'ont pas encore répondu. Refuser n'empêche rien d'autre.
Photos : la photo d'un joueur ou d'un membre du staff se choisit avec le sélecteur système ; aucune autorisation d'accès à la photothèque n'est demandée.
```

## Nouveautés de cette version (4000)

1804/4000 caractères. Obligatoire pour une mise à jour : à coller dans App Store Connect
(« Nouveautés de cette version »).

```
NOUVEAUTÉS DE LA VERSION 1.7

ATELIER D'EXERCICES
Onglet Présences › Atelier : dessinez vos exercices en plein écran. Posez joueurs, gardiens, ballons, plots, coupelles, piquets, mannequins, mini-buts, zones, échelles ou haies, en 8 couleurs, ou partez d'un raccourci (carré, rondo, jeu réduit, slalom). Ajoutez des étapes : les flèches de course, de passe et de conduite se tracent toutes seules. Regardez le résultat en 3D plein écran avec le mode cinéma, la consigne en sous-titre.

FICHES ET SÉANCES
Chaque exercice a sa fiche : objectif, consignes et matériel à prévoir calculé tout seul, en PDF à imprimer. Enchaînez vos exercices en séances minutées : matériel total, équipes faites avec les joueurs présents, fiche de séance en PDF.

PLACEMENT EN 3D
Basculez la vue Placement en 3D : votre composition sur un terrain en relief, joueurs et ballon déplaçables du bout du doigt, quatre caméras (coach, tribune, dessus, immersion).

SÉQUENCES PAS À PAS
Construisez vos situations au doigt : le ballon se colle au joueur, déplacer le porteur fait une conduite, glisser le ballon sur un partenaire une passe, dans le but un tir, et « En l'air » un centre. Les flèches s'affichent avant de valider chaque étape. Ajoutez une consigne par étape, revenez sur une étape pour la corriger, puis lancez la démonstration animée.

BIBLIOTHÈQUE D'EXERCICES 3D
12 exercices animés avec objectif, consignes et déroulé : rondo, conservation, relance à 3, troisième homme, chevauchement, une-deux, remise du pivot, pressing haut, coulissement, contre-attaque, contre-pressing, corner. « Copier dans mes exercices » pour les adapter dans l'Atelier.

PARTAGE
Partagez exercices et tactiques en fichier .tdjt par Messages, AirDrop ou e-mail : ils s'ouvrent directement dans l'app.

Corrections et améliorations diverses.
```

## 7. Confidentialité de l'app

Réponse au questionnaire : **Aucune donnée collectée.** Inchangée : l'Atelier enregistre
exercices et séances sur l'appareil (`Application Support/Tactiques/`).

- Tout est stocké sur l'appareil (UserDefaults, fichiers locaux) ; aucun serveur, aucune analyse d'audience, aucune publicité, aucun SDK tiers.
- Les sondages de disponibilité passent par une page web statique (GitHub Pages) qui ne stocke rien : les réponses reviennent dans un lien que l'éducateur ouvre.
- L'achat Premium passe par StoreKit (traité par Apple, pas par l'app).

## 8. Classification par âge

Toutes les réponses à « Aucun » / « Non » → **4+**. Inchangé depuis la 1.6.1 : outil de gestion
sportive, pas de contenu généré partagé, pas de messagerie, pas d'accès web libre.

## 9. Captures d'écran

Prises le **21/11/2026** par le test d'interface `TempsDeJeuUITests/CaptureTests.swift`
(`./tools/captures.sh`), barre d'état 9:41, langue française, données de démonstration
fictives (catégorie U13 « FC Rivière », prénoms et noms inventés). Mêmes écrans sur iPhone
6,9 pouces (`captures/iphone-6.9/`, 1320 × 2868) et iPad 13 pouces (`captures/ipad-13/`, 2064 × 2752).

1. `01-match` — match en direct : chrono 27:22, score 2-1, temps effectif, arrêts, passes.
2. `02-placement-3d` — Placement en 3D, 4-3-3 avec les noms, trois adversaires et le ballon.
3. `03-sequence` — séquence en construction, cadrage « zone de jeu » : aperçu « Conduite n°6 · Course n°10 » avant validation de l'étape 2.
4. `04-tactique` — exercice « Chevauchement du latéral et centre », étape 4/6 : flèches de passe et de course, halo sur le latéral.
5. `05-atelier` — **nouveau** : l'Atelier, exercice « Jeu 4 contre 4 + 2 jokers » sur un carré 25 × 30 m avec mini-buts et plots, étape 2 (course et conduite tracées), tiroir de matériel en bas.
6. `06-joueurs` — effectif de la catégorie (16 joueurs par poste).

La 05 remplace l'ancienne `05-bibliotheque` (bibliothèque Tactiques 3D, écran devenu l'accueil
de l'Atelier). Sur iPhone, l'onglet système « More » reste en anglais (01 et 06) : c'est ce que
voient les utilisateurs, l'app ne déclarant pas le français comme langue (voir section 10).

## 10. À vérifier avant d'envoyer

- [x] caractères recomptés champ par champ (script, achats compris)
- [x] les trois adresses répondent dans un navigateur
- [x] identifiant du bundle et version = projet Xcode (1.7, build 30, app et widget)
- [x] captures aux dimensions exactes, vérifiées avec `sips`
- [x] mise à jour d'une app déjà publiée, pas une variante
- [x] rien n'a été créé ni soumis chez Apple
- [x] build 30 archivée et envoyée chez Apple (21/11/2026, 16 h 04)
- [x] l'archive n'embarque aucune donnée de démonstration (« FC Rivière » absent du binaire)
- [x] build 30 choisie dans la version 1.7
- [x] champs de la version remplis à la main (AgentDouble refuse les apps déjà publiées)
- [x] captures : celles de la 1.6.1 gardées (choix du 21/11/2026) ; les nouvelles restent dans
      `captures/` pour une prochaine fois
- [x] conformité Chine : évaluation de sécurité « Non », contenu généré par IA « Non »
- [x] nouveau questionnaire de classification par âge (2025) : tout à « Non » / « Aucun » → 4+
- [x] **soumise pour vérification le 21/11/2026**
- [x] la version Mac en DMG (hors App Store, sans limite) n'est pas concernée par cette soumission
- [ ] plus tard (build suivante, pas bloquant) : déclarer le français (`developmentRegion = fr`
      ou `CFBundleLocalizations = fr`) pour que « More », « Edit » et les feuilles système
      s'affichent en français
