// PDF des présences aux entraînements (ExportService.generateTrainingAttendancePDF et
// generateTrainingSessionPDF) : même mise en page A4, mêmes textes.
import { DocumentPDF } from '../pdf.js';
import * as M from '../model.js';

const MARGE = 40;
const GRIS_FONCE = [1 / 3, 1 / 3, 1 / 3];
const GRIS_CLAIR = [2 / 3, 2 / 3, 2 / 3];
const VERT_SYSTEME = [0.204, 0.78, 0.349];
const ORANGE_SYSTEME = [1, 0.584, 0];
const ROUGE_SYSTEME = [1, 0.231, 0.188];

const longue = (d) => M.formatDate(d, 'long');      // dateFormatter (.long)
const moyenne = (d) => M.formatDate(d, 'medium');   // shortDateFormatter (.medium)
const taux = (s) => (s.attendances.length > 0 ? (M.presentCount(s) / s.attendances.length) * 100 : 0);

function trait(doc, y) {
  doc.ligne(MARGE, y, MARGE + (doc.largeur - 2 * MARGE), y, { couleur: GRIS_CLAIR, epaisseur: 0.5 });
}

/** Présences sur une période : statistiques par joueur puis détail par entraînement */
export function presencesPDF({ sessions, playerStats, startDate, endDate, guestCategoryNames = {}, maintenant = new Date() }) {
  const doc = new DocumentPDF({ titre: 'Présences aux entraînements' });
  const H = doc.hauteur;
  const largeurUtile = doc.largeur - 2 * MARGE;
  let y = MARGE;
  const nouvellePage = () => { doc.nouvellePage(); y = MARGE; };
  const assurer = (h) => { if (y + h > H - MARGE) nouvellePage(); };

  nouvellePage();
  doc.texte('Présences aux entraînements', MARGE, y, { taille: 24, gras: true });
  y += 35;
  doc.texte(`Du ${moyenne(startDate)} au ${moyenne(endDate)}`, MARGE, y, { taille: 14, couleur: GRIS_FONCE });
  y += 25;

  const totalPresences = sessions.reduce((t, s) => t + M.presentCount(s), 0);
  const totalPossible = sessions.reduce((t, s) => t + s.attendances.length, 0);
  const moyenneTaux = totalPossible > 0 ? (totalPresences / totalPossible) * 100 : 0;
  doc.texte(`${sessions.length} entraînements · Présence moyenne: ${Math.trunc(moyenneTaux)}%`, MARGE, y, { taille: 12 });
  y += 30;
  trait(doc, y);
  y += 15;

  doc.texte('Statistiques par joueur', MARGE, y, { taille: 16, gras: true });
  y += 25;

  assurer(20);
  const colonnes = [largeurUtile * 0.5, largeurUtile * 0.25, largeurUtile * 0.25];
  doc.texte('Joueur', MARGE, y, { taille: 11, gras: true });
  doc.texte('Présences', MARGE + colonnes[0], y, { taille: 11, gras: true });
  doc.texte('Taux', MARGE + colonnes[0] + colonnes[1], y, { taille: 11, gras: true });
  y += 18;
  trait(doc, y);
  y += 8;

  for (const st of [...playerStats].sort((a, b) => M.tauxPresence(b) - M.tauxPresence(a))) {
    assurer(18);
    const nom = M.fullName(st);
    const libelle = guestCategoryNames[st.playerId] ? `${nom} (${guestCategoryNames[st.playerId]})` : nom;
    doc.texte(libelle, MARGE, y, { taille: 11, largeurMax: colonnes[0] - 6 });
    doc.texte(`${st.presentSessions}/${st.totalSessions}`, MARGE + colonnes[0], y, { taille: 11 });
    const t = M.tauxPresence(st);
    const couleur = t >= 75 ? VERT_SYSTEME : t >= 50 ? ORANGE_SYSTEME : ROUGE_SYSTEME;
    doc.texte(`${Math.trunc(t)}%`, MARGE + colonnes[0] + colonnes[1], y, { taille: 11, gras: true, couleur });
    y += 16;
  }

  y += 20;
  trait(doc, y);
  y += 15;

  assurer(30);
  doc.texte('Détail par entraînement', MARGE, y, { taille: 16, gras: true });
  y += 25;

  for (const s of [...sessions].sort((a, b) => M.dateDe(b.date) - M.dateDe(a.date))) {
    assurer(50);
    doc.texte(longue(s.date), MARGE, y, { taille: 11, gras: true });
    y += 16;
    doc.texte(`Présents: ${M.presentCount(s)}/${s.attendances.length} (${Math.trunc(taux(s))}%)`, MARGE + 10, y, { taille: 10, couleur: GRIS_FONCE });
    y += 14;
    if (s.notes !== '') {
      doc.texte(`Note: ${s.notes}`, MARGE + 10, y, { taille: 10, couleur: GRIS_FONCE, largeurMax: largeurUtile - 10 });
      y += 14;
    }
    const presents = s.attendances.filter((a) => a.isPresent).map((a) => (guestCategoryNames[a.id] ? `${M.fullName(a)} (${guestCategoryNames[a.id]})` : M.fullName(a))).join(', ');
    if (presents !== '') {
      const texte = `Présents: ${presents}`;
      const largeurTexte = largeurUtile - 20;
      const hauteur = doc.hauteurBloc(texte, largeurTexte, { taille: 10 });
      assurer(hauteur);
      doc.texteBloc(texte, MARGE + 10, y, largeurTexte, { taille: 10, couleur: GRIS_FONCE });
      y += hauteur + 10;
    }
    y += 8;
  }

  assurer(40);
  y += 20;
  trait(doc, y);
  y += 10;
  doc.texte(`Temps De Jeu · ${longue(maintenant)}`, MARGE, y, { taille: 9, couleur: GRIS_CLAIR });
  return doc.octets();
}

/** Feuille de présence d'un entraînement : présents puis absents */
export function feuillePresencePDF(session, guestCategoryNames = {}, maintenant = new Date()) {
  const doc = new DocumentPDF({ titre: 'Feuille de présence' });
  const H = doc.hauteur;
  const largeurUtile = doc.largeur - 2 * MARGE;
  let y = MARGE;
  const assurer = (h) => { if (y + h > H - MARGE) { doc.nouvellePage(); y = MARGE; } };

  doc.nouvellePage();
  doc.texte('Feuille de présence', MARGE, y, { taille: 24, gras: true });
  y += 35;
  doc.texte(longue(session.date), MARGE, y, { taille: 16, couleur: GRIS_FONCE });
  y += 30;

  if (session.location !== '') {
    // 📍 : épingle dessinée (les polices standard du PDF n'ont pas d'emoji)
    doc.cercle(MARGE + 5, y + 6, 4, { remplissage: ROUGE_SYSTEME });
    doc.polygone([[MARGE + 1.6, y + 8], [MARGE + 8.4, y + 8], [MARGE + 5, y + 14]], { remplissage: ROUGE_SYSTEME });
    doc.cercle(MARGE + 5, y + 6, 1.5, { remplissage: [1, 1, 1] });
    doc.texte(session.location, MARGE + 14, y, { taille: 14, couleur: GRIS_FONCE, largeurMax: largeurUtile - 14 });
    y += 25;
  }

  if (session.notes !== '') {
    doc.texte(`Note: ${session.notes}`, MARGE, y, { taille: 12, italique: true, couleur: GRIS_FONCE, largeurMax: largeurUtile });
    y += 25;
  }

  doc.texte(`Présents: ${M.presentCount(session)}/${session.attendances.length} (${Math.trunc(taux(session))}%)`, MARGE, y, { taille: 14, gras: true });
  y += 30;
  trait(doc, y);
  y += 15;

  const liste = (titre, couleur, joueurs, vide) => {
    doc.texte(titre, MARGE, y, { taille: 16, gras: true, couleur });
    y += 25;
    joueurs.forEach((a, i) => {
      assurer(20);
      const nom = M.fullName(a);
      const libelle = guestCategoryNames[a.id] ? `${i + 1}. ${nom} (${guestCategoryNames[a.id]})` : `${i + 1}. ${nom}`;
      doc.texte(libelle, MARGE + 10, y, { taille: 12, largeurMax: largeurUtile - 10 });
      y += 18;
    });
    if (!joueurs.length) {
      doc.texte(vide, MARGE + 10, y, { taille: 12 });
      y += 18;
    }
  };
  const tri = (a, b) => M.comparer(a.lastName, b.lastName);

  liste('Joueurs présents', [0, 0.6, 0], session.attendances.filter((a) => a.isPresent).sort(tri), 'Aucun joueur présent');
  y += 15;
  trait(doc, y);
  y += 15;
  liste('Joueurs absents', ROUGE_SYSTEME, session.attendances.filter((a) => !a.isPresent).sort(tri), 'Aucun joueur absent');

  assurer(40);
  y += 30;
  trait(doc, y);
  y += 10;
  doc.texte(`Temps De Jeu · ${longue(maintenant)}`, MARGE, y, { taille: 9, couleur: GRIS_CLAIR });
  return doc.octets();
}

/** Nom de fichier de l'aperçu (PDFPreviewView : espaces → « _ ») */
export const nomFichierPDF = (titre) => `${titre.replaceAll(' ', '_')}.pdf`;
