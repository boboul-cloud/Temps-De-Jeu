// Atelier — fiches à imprimer (A4), port d'AtelierPDF.swift. Une page par exercice : schéma de
// la mise en place avec toutes les flèches, objectif, consignes, déroulé, matériel et évolutions.
// La séance ajoute une page de garde (programme, matériel, équipes).
//
// Contrat : ficheExercicePDF(tactique) → Uint8Array ; ficheSeancePDF(plan, tactiques) → Uint8Array
// (`tactiques` : exercices de la séance dans l'ordre, ou paires [item, tactique]).
// Plus : nomFichierFiche(titre) → « Titre.pdf ».
import { DocumentPDF } from '../pdf.js';
import * as M from '../model.js';
import { dessinerSchema } from '../ecrans/atelier/diagramme.js';
import { effectif } from '../ecrans/atelier/editeur-modele.js';

const PAGE = { largeur: 595, hauteur: 842 };
const MARGE = 36;
const VERT_TITRES = [0.1, 0.45, 0.2];
const GRIS_FONCE = [1 / 3, 1 / 3, 1 / 3];

/** Nom de fichier sans caractères interdits (comme AtelierPDF.write) */
export function nomFichierFiche(titre, extension = 'pdf') {
  const sur = String(titre ?? '').split(/[/\\:?%*|"<>]/).join('-').trim();
  return `${sur === '' ? 'Fiche' : sur}.${extension}`;
}

/** Image JPEG du schéma (rendu à 3×, coins arrondis de 8 points sur fond blanc) */
function imageSchema(t, largeur, hauteur) {
  const echelle = 3;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(largeur * echelle);
  canvas.height = Math.round(hauteur * echelle);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(echelle, 0, 0, echelle, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, largeur, hauteur);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, largeur, hauteur, 8);
  ctx.clip();
  dessinerSchema(ctx, largeur, hauteur, t, { etape: 0, toutesFleches: true, rotation: true });
  ctx.restore();
  return { donnees: canvas.toDataURL('image/jpeg', 0.9), largeur, hauteur };
}

/** Mise en page qui coule de haut en bas et passe à la page suivante au besoin (PDFFlow) */
class Flux {
  constructor(doc) {
    this.doc = doc;
    this.y = 0;
    this.numero = 0;
    this.gauche = MARGE;
    this.largeur = PAGE.largeur - 2 * MARGE;
    this.bas = PAGE.hauteur - MARGE - 14;
  }

  nouvellePage() {
    this.doc.nouvellePage();
    this.numero += 1;
    this.y = MARGE;
    this.doc.texte(`Temps de Jeu · Atelier — page ${this.numero}`, this.gauche, PAGE.hauteur - MARGE + 2, { taille: 8, couleur: 'gris' });
  }

  assurer(hauteur) {
    if (this.y + hauteur > this.bas) this.nouvellePage();
  }

  texte(chaine, { taille = 11, gras = false, couleur = 'noir', retrait = 0, espace = 4, caseACocher = false } = {}) {
    const decalage = caseACocher ? 16 : 0;
    const largeur = this.largeur - retrait - decalage;
    const hauteur = this.doc.hauteurBloc(chaine, largeur, { taille, gras });
    this.assurer(hauteur);
    if (caseACocher) {
      const c = taille * 0.78;
      this.doc.rect(this.gauche + retrait, this.y + (taille * 1.2 - c) / 2, c, c, { trait: 'noir', epaisseur: 0.8 });
    }
    this.doc.texteBloc(chaine, this.gauche + retrait + decalage, this.y, largeur, { taille, gras, couleur });
    this.y += Math.ceil(hauteur) + espace;
    return hauteur;
  }

  titre(chaine) {
    this.assurer(30);
    this.y += 6;
    this.texte(chaine.toLocaleUpperCase('fr'), { taille: 9.5, gras: true, couleur: VERT_TITRES, espace: 3 });
  }

  image(img, hauteur) {
    if (!img) return;
    this.assurer(hauteur);
    const rapport = img.largeur / Math.max(1, img.hauteur);
    const w = Math.min(this.largeur, hauteur * rapport);
    const x = this.gauche + (this.largeur - w) / 2;
    this.doc.image(img.donnees, x, this.y, w, w / rapport);
    this.y += w / rapport + 8;
  }

  // MARK: Exercice

  exercice(t, numero = null, minutes = null) {
    const prefixe = numero != null ? `${numero}. ` : '';
    this.texte(prefixe + t.titre, { taille: 20, gras: true, espace: 2 });
    const details = [M.categorieTactique(t.categorie).nom];
    if (t.niveau) details.push(t.niveau);
    if (minutes != null) details.push(`${minutes} min`);
    else if (t.duree) details.push(t.duree);
    const e = effectif(t.acteurs);
    if (e) details.push(e);
    this.texte(details.join(' · '), { taille: 10, couleur: GRIS_FONCE, espace: 10 });

    this.image(imageSchema(t, 520, 330), 330);

    if (t.objectif) {
      this.titre('Objectif');
      this.texte(t.objectif);
    }
    if (t.consignes?.length) {
      this.titre('Consignes de coaching');
      for (const c of t.consignes) this.texte(`•  ${c}`, { retrait: 6, espace: 2 });
    }
    const etapes = t.etapes.map((e, i) => [i, e]).filter(([i, e]) => i > 0 || e.texte !== '');
    if (etapes.length) {
      this.titre('Déroulé');
      for (const [i, e] of etapes) {
        const titre = e.titre === '' ? (i === 0 ? 'Mise en place' : `Étape ${i}`) : e.titre;
        this.texte(e.texte === '' ? `${i}. ${titre}` : `${i}. ${titre} — ${e.texte}`, { retrait: 6, espace: 2 });
      }
    }
    const lignes = M.materielExercice(t);
    if (lignes.length) {
      this.titre('Matériel');
      this.texte(lignes.map((l) => l.texte).join(' · '));
    }
    (t.evolutions ?? []).forEach((ev, i) => {
      this.titre(`Évolution ${i + 1} : ${ev.titre}`);
      if (ev.texte) this.texte(ev.texte);
      this.image(imageSchema(M.variante(t, i), 360, 220), 200);
    });
  }

  // MARK: Page de garde de la séance

  garde(plan, entrees) {
    this.texte(plan.titre, { taille: 24, gras: true, espace: 2 });
    const details = [];
    if (plan.date) {
      details.push(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
        .format(M.dateDe(plan.date)));
    }
    details.push(`Durée totale : ${M.minutesPlan(plan)} min`);
    this.texte(details.join(' · '), { taille: 11, couleur: GRIS_FONCE, espace: 12 });
    if (plan.notes) {
      this.titre('Thème de la séance');
      this.texte(plan.notes);
    }
    this.titre('Programme');
    let horloge = 0;
    entrees.forEach(([item, t], i) => {
      const debut = horloge;
      horloge += item.minutes;
      // Les polices standard n'ont ni « ′ » ni « → »
      let ligne = `${i + 1}. ${t.titre} — ${item.minutes} min  (${debut}' – ${horloge}')`;
      if (item.note) ligne += `\n     ${item.note}`;
      this.texte(ligne, { taille: 12, retrait: 6, espace: 4 });
    });
    const lignes = M.combinerMateriel(entrees.map(([, t]) => M.materielExercice(t)), plan.simultane);
    if (lignes.length) {
      this.titre(plan.simultane ? 'Matériel (ateliers montés en même temps)' : 'Matériel à prévoir');
      for (const l of lignes) this.texte(l.texte, { taille: 12, retrait: 6, espace: 3, caseACocher: true });
    }
    if (plan.equipes?.length) {
      this.titre('Équipes');
      for (const e of plan.equipes) {
        this.texte(`${M.nomCouleurAtelier(e.color)} : ${e.players.join(', ')}`, { taille: 11, retrait: 6, espace: 3 });
      }
    }
  }
}

/** Fiche d'un exercice */
export function ficheExercicePDF(tactique) {
  const doc = new DocumentPDF({ titre: tactique.titre });
  const flux = new Flux(doc);
  flux.nouvellePage();
  flux.exercice(tactique);
  return doc.octets();
}

/**
 * Fiche d'une séance : page de garde puis une page par exercice.
 * `tactiques` : [tactique] dans l'ordre des exercices du plan (les manquants sont ignorés),
 * ou directement des paires [item, tactique].
 */
export function ficheSeancePDF(plan, tactiques) {
  let entrees;
  if (tactiques.length && Array.isArray(tactiques[0])) entrees = tactiques;
  else {
    const parId = new Map(tactiques.map((t) => [t.id, t]));
    entrees = plan.exercices.filter((i) => parId.has(i.exercice)).map((i) => [i, parId.get(i.exercice)]);
  }
  const doc = new DocumentPDF({ titre: plan.titre });
  const flux = new Flux(doc);
  flux.nouvellePage();
  flux.garde(plan, entrees);
  entrees.forEach(([item, t], i) => {
    flux.nouvellePage();
    flux.exercice(t, i + 1, item.minutes);
  });
  return doc.octets();
}
