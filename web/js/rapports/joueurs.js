// Fiche PDF de l'effectif (ExportService.generatePlayersPDF) : joueurs par poste,
// temps de jeu cumulé (si des matchs sont fournis) et cartons.
import { DocumentPDF, MiseEnPage } from '../pdf.js';
import { playerPlayingTimes, fullName, formatTime, comparer } from '../model.js';
import { UI, styles, filet, dateLongue } from './commun.js';

const POSTES_SECTIONS = [
  ['Gardiens', 'Gardien'],
  ['Défenseurs', 'Défenseur'],
  ['Milieux', 'Milieu'],
  ['Attaquants', 'Attaquant'],
];

/**
 * players : Player[] ; allCards : CardEvent[] ; matches : Match[] (facultatif, comme l'app :
 * l'écran Export / Import n'en passe pas, la fiche n'a alors pas de colonnes de temps de jeu).
 * → Uint8Array
 */
export function genererPDFJoueurs({ players, allCards = [], matches = [], maintenant = new Date() }) {
  const largeurPage = 595;
  const marge = 40;
  const largeur = largeurPage - 2 * marge;

  // Temps de jeu cumulé par joueur (matchs terminés)
  const statsParId = new Map();
  const termines = matches.filter((m) => m.isFinished);
  for (const m of termines) {
    for (const pt of playerPlayingTimes(m)) {
      if (!(pt.totalTime > 0)) continue;
      const s = statsParId.get(pt.playerId) ?? { totalTime: 0, matchCount: 0 };
      s.totalTime += pt.totalTime;
      s.matchCount += 1;
      statsParId.set(pt.playerId, s);
    }
  }

  const doc = new DocumentPDF({ titre: 'Effectif - Temps De Jeu' });
  const p = new MiseEnPage(doc, { marge });

  doc.texte('Effectif - Temps De Jeu', marge, p.y, styles.titre24);
  p.y += 40;
  doc.texte(`Exporté le ${dateLongue(maintenant)}`, marge, p.y, styles.date);
  p.y += 30;

  const compte = (poste) => players.filter((j) => j.position === poste).length;
  doc.texte(`${players.length} joueurs : ${compte('Gardien')} G · ${compte('Défenseur')} DEF · ${compte('Milieu')} MIL · ${compte('Attaquant')} ATT`,
    marge, p.y, styles.resume);
  p.y += 20;
  if (termines.length) {
    const n = termines.length;
    doc.texte(`${n} match${n > 1 ? 's' : ''} joué${n > 1 ? 's' : ''}`, marge, p.y, styles.resume);
    p.y += 20;
  }
  p.y += 10;

  filet(doc, p.y, marge, largeur);
  p.y += 15;

  const enteteCol = { taille: 9, gras: true, couleur: UI.gray };
  if (termines.length) {
    doc.texte('Matchs', marge + 200, p.y, enteteCol);
    doc.texte('Tps cumulé', marge + 260, p.y, enteteCol);
    doc.texte('Moy/match', marge + 340, p.y, enteteCol);
  }
  doc.texte('Cartons', largeurPage - marge - 80, p.y, enteteCol);
  p.y += 16;

  const stylesStats = { taille: 10, couleur: UI.darkGray };
  const stylesCarton = { taille: 10, couleur: UI.red };

  for (const [nomSection, poste] of POSTES_SECTIONS) {
    const joueurs = players.filter((j) => j.position === poste).sort((a, b) => comparer(a.lastName, b.lastName));
    if (!joueurs.length) continue;
    p.assurer(40);
    doc.texte(nomSection, marge, p.y, styles.entete);
    p.y += 22;

    for (const j of joueurs) {
      p.assurer(22);
      const nom = fullName(j) === '' ? 'Joueur' : fullName(j);
      // L'app écrit « 📞 » devant le numéro : remplacé par « Tél. » (pas d'emoji dans les polices standard)
      const nomTel = j.phoneNumber ? `${nom}  Tél. ${j.phoneNumber}` : nom;
      doc.texte(nomTel, marge + 10, p.y, { ...styles.corps, largeurMax: termines.length ? 185 : 400 });

      const s = statsParId.get(j.id);
      if (s) {
        doc.texte(`${s.matchCount}`, marge + 210, p.y + 1, stylesStats);
        doc.texte(formatTime(s.totalTime), marge + 270, p.y + 1, stylesStats);
        doc.texte(formatTime(s.matchCount > 0 ? s.totalTime / s.matchCount : 0), marge + 350, p.y + 1, stylesStats);
      } else if (termines.length) {
        doc.texte('0', marge + 210, p.y + 1, stylesStats);
        doc.texte('00:00', marge + 270, p.y + 1, stylesStats);
        doc.texte('00:00', marge + 350, p.y + 1, stylesStats);
      }

      const cartons = allCards.filter((c) => c.playerId === j.id);
      if (cartons.length) {
        const n = (type) => cartons.filter((c) => c.type === type).length;
        const parts = [];
        if (n('Jaune') > 0) parts.push(`${n('Jaune')} J`);
        if (n('2ème Jaune') > 0) parts.push(`${n('2ème Jaune')} 2J`);
        if (n('Rouge') > 0) parts.push(`${n('Rouge')} R`);
        if (n('Blanc') > 0) parts.push(`${n('Blanc')} B`);
        doc.texte(parts.join(' · '), largeurPage - marge - 80, p.y + 1, stylesCarton);
      }
      p.y += 20;
    }
    p.y += 10;
  }
  return doc.octets();
}
