// PDF de la composition du match (ExportService.generateRosterPDF) : même mise en page A4,
// titulaires en vert, remplaçants en orange, résumé en bas.
// Le symbole « Ⓒ » du capitaine n'existe pas dans les polices standard du PDF : il devient « (C) ».
import { DocumentPDF, MiseEnPage } from '../pdf.js';
import * as M from '../model.js';

const VERT = [0.204, 0.78, 0.349];
const ORANGE = [1, 0.584, 0];
const GRIS_FONCE = [1 / 3, 1 / 3, 1 / 3];
const GRIS = [0.5, 0.5, 0.5];

/** Nom du fichier : « Composition_Equipe_A_2026-11-23 » (sans extension) */
export function titreComposition(teamName, matchDate) {
  const equipe = teamName.replaceAll(' ', '_').replaceAll('/', '-');
  return `Composition_${equipe}_${M.formatDateMotif(matchDate, 'yyyy-MM-dd')}`;
}

/** roster : MatchPlayer[] ; renvoie les octets du PDF */
export function genererPDFComposition({ roster, teamName, competition, matchDate, opponent = '' }) {
  const doc = new DocumentPDF({ titre: `Composition - ${teamName || 'Mon équipe'}` });
  const page = new MiseEnPage(doc, { marge: 40 });
  const marge = 40;
  const largeur = doc.largeur;

  doc.texte(`Composition - ${teamName === '' ? 'Mon équipe' : teamName}`, marge, page.y, { taille: 24, gras: true });
  page.y += 35;
  if (opponent !== '') {
    doc.texte(`vs ${opponent}`, marge, page.y, { taille: 16, gras: true, couleur: GRIS_FONCE });
    page.y += 25;
  }
  if (competition !== '') {
    doc.texte(competition, marge, page.y, { taille: 16, gras: true, couleur: GRIS_FONCE });
    page.y += 25;
  }
  doc.texte(M.formatDate(matchDate, 'long'), marge, page.y, { taille: 12, couleur: GRIS });
  page.y += 30;
  doc.ligne(marge, page.y, marge + page.largeurUtile, page.y, { couleur: [2 / 3, 2 / 3, 2 / 3], epaisseur: 0.5 });
  page.y += 20;

  const parNumero = (a, b) => a.shirtNumber - b.shirtNumber;
  const titulaires = roster.filter((p) => p.status === 'Titulaire').sort(parNumero);
  const remplacants = roster.filter((p) => p.status === 'Remplaçant').sort(parNumero);

  const liste = (joueurs, titre, couleur) => {
    page.assurer(30);
    doc.texte(`${titre} (${joueurs.length})`, marge, page.y, { taille: 14, gras: true, couleur });
    page.y += 25;
    for (const p of joueurs) {
      page.assurer(25);
      doc.texte(`#${p.shirtNumber}`, marge, page.y, { taille: 13, gras: true, couleur });
      const nom = M.matchPlayerDisplayName(p) || 'Joueur';
      doc.texte(nom + (p.isCaptain ? ' (C)' : ''), marge + 45, page.y, { taille: 13 });
      doc.texte(M.POSTE_COURT[p.position], largeur - marge - 40, page.y, { taille: 11, couleur: GRIS });
      page.y += 22;
    }
  };

  if (titulaires.length) {
    liste(titulaires, 'TITULAIRES', VERT);
    page.y += 15;
  }
  if (remplacants.length) liste(remplacants, 'REMPLAÇANTS', ORANGE);

  page.y += 30;
  page.assurer(40);
  doc.ligne(marge, page.y, marge + page.largeurUtile, page.y, { couleur: [2 / 3, 2 / 3, 2 / 3], epaisseur: 0.5 });
  page.y += 15;
  doc.texte(`Total: ${roster.length} joueurs · ${titulaires.length} titulaires · ${remplacants.length} remplaçants`, marge, page.y, { taille: 11, couleur: GRIS_FONCE });
  return doc.octets();
}
