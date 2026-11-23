// Rapport PDF des statistiques globales (ExportService.generateStatsPDF) : vue d'ensemble,
// répartition des arrêts, cartons, buteurs, passeurs et historique des matchs terminés.
import { DocumentPDF, MiseEnPage } from '../pdf.js';
import * as M from '../model.js';
import { styles, filet, dateLongue, dateMoyenne, grouperParNombre } from './commun.js';

/** matches : tous les matchs de la catégorie (seuls les terminés comptent) ; players : effectif → Uint8Array */
export function genererPDFStats({ matches, players, maintenant = new Date() }) {
  const largeurPage = 595;
  const marge = 40;
  const largeur = largeurPage - 2 * marge;
  const doc = new DocumentPDF({ titre: 'Statistiques globales' });
  const p = new MiseEnPage(doc, { marge });
  const titreSection = (texte) => { doc.texte(texte, marge, p.y, styles.entete); p.y += 22; };

  doc.texte('Statistiques globales', marge, p.y, styles.titre22);
  p.y += 30;
  doc.texte(`Temps De Jeu · ${dateLongue(maintenant)}`, marge, p.y, styles.sousTitre);
  p.y += 25;
  filet(doc, p.y, marge, largeur);
  p.y += 20;

  // Vue d'ensemble
  titreSection("Vue d'ensemble");
  const termines = matches.filter((m) => m.isFinished);
  const n = termines.length;
  const dureeTotale = termines.reduce((t, m) => t + M.totalMatchDuration(m), 0);
  const effectifTotal = termines.reduce((t, m) => t + M.totalEffectivePlayTime(m), 0);
  const effectifMoyen = n ? effectifTotal / n : 0;
  const ratioMoyen = n ? termines.reduce((t, m) => t + M.effectivePercentage(m), 0) / n : 0;
  const totalArrets = termines.reduce((t, m) => t + m.stoppages.length, 0);
  for (const [libelle, valeur] of [
    ['Matchs joués', `${n}`],
    ['Durée totale cumulée', M.formatTime(dureeTotale)],
    ['Temps effectif cumulé', M.formatTime(effectifTotal)],
    ['Temps effectif moyen/match', M.formatTime(effectifMoyen)],
    ['Ratio effectif moyen', `${Math.trunc(ratioMoyen)}%`],
    ["Nombre total d'arrêts", `${totalArrets}`],
    ["Joueurs dans l'effectif", `${players.length}`],
  ]) {
    p.assurer(20);
    doc.texte(libelle, marge + 10, p.y, styles.corps);
    doc.texte(valeur, largeurPage - marge - 100, p.y, styles.corpsGras);
    p.y += 18;
  }
  p.y += 15;

  // Répartition des arrêts
  filet(doc, p.y, marge, largeur);
  p.y += 15;
  titreSection('Répartition globale des arrêts');
  for (const type of M.TYPES_ARRET) {
    const compte = termines.reduce((t, m) => t + M.stoppageCount(m, type), 0);
    if (compte <= 0) continue;
    const temps = termines.reduce((t, m) => t + M.totalTimeFor(m, type), 0);
    p.assurer(20);
    doc.texte(`${type} : ${compte}x · ${M.formatShort(temps)}`, marge + 10, p.y, styles.corps);
    p.y += 18;
  }
  p.y += 15;

  // Cartons
  const cartons = termines.flatMap((m) => m.cards);
  if (cartons.length) {
    filet(doc, p.y, marge, largeur);
    p.y += 15;
    titreSection('Cartons');
    const nb = (liste, type) => liste.filter((c) => c.type === type).length;
    doc.texte(`Jaunes: ${nb(cartons, 'Jaune')} · 2èmes jaunes: ${nb(cartons, '2ème Jaune')} · Rouges: ${nb(cartons, 'Rouge')} · Blancs: ${nb(cartons, 'Blanc')}`,
      marge + 10, p.y, styles.corpsGras);
    p.y += 22;
    const classement = grouperParNombre(cartons.filter((c) => c.playerId != null), (c) => c.playerId).slice(0, 10);
    if (classement.length) {
      doc.texte('Top joueurs sanctionnés :', marge + 10, p.y, styles.corpsGras);
      p.y += 18;
      for (const { liste } of classement) {
        p.assurer(20);
        const nom = liste[0]?.playerName ?? '?';
        const parts = [];
        if (nb(liste, 'Jaune') > 0) parts.push(`${nb(liste, 'Jaune')}J`);
        if (nb(liste, '2ème Jaune') > 0) parts.push(`${nb(liste, '2ème Jaune')}×2J`);
        if (nb(liste, 'Rouge') > 0) parts.push(`${nb(liste, 'Rouge')}R`);
        if (nb(liste, 'Blanc') > 0) parts.push(`${nb(liste, 'Blanc')}B`);
        doc.texte(`  ${nom} : ${parts.join(' · ')}`, marge + 20, p.y, styles.corps);
        p.y += 16;
      }
    }
    p.y += 10;
  }

  // Buteurs
  const mesButs = termines.flatMap((m) => m.goals.filter((g) => g.isHome === m.isMyTeamHome && g.playerName !== ''));
  if (mesButs.length) {
    p.assurer(60);
    filet(doc, p.y, marge, largeur);
    p.y += 15;
    titreSection('Buteurs');
    const pour = termines.reduce((t, m) => t + M.myScore(m), 0);
    const contre = termines.reduce((t, m) => t + M.opponentScore(m), 0);
    doc.texte(`Mon équipe: ${pour} buts · Adversaires: ${contre} buts`, marge + 10, p.y, styles.corpsGras);
    p.y += 22;
    doc.texte('Top buteurs :', marge + 10, p.y, styles.corpsGras);
    p.y += 18;
    for (const { nom, liste } of grouperParNombre(mesButs, (g) => g.playerName).slice(0, 10)) {
      p.assurer(20);
      doc.texte(`  ${nom} : ${liste.length} but${liste.length > 1 ? 's' : ''}`, marge + 20, p.y, styles.corps);
      p.y += 16;
    }
    p.y += 10;
  }

  // Passes décisives
  const passes = termines.flatMap((m) => m.assists.filter((a) => a.playerId != null));
  if (passes.length) {
    p.assurer(60);
    filet(doc, p.y, marge, largeur);
    p.y += 15;
    titreSection('Passes décisives');
    const np = passes.length;
    doc.texte(`Total : ${np} passe${np > 1 ? 's' : ''} décisive${np > 1 ? 's' : ''}`, marge + 10, p.y, styles.corpsGras);
    p.y += 22;
    doc.texte('Top passeurs :', marge + 10, p.y, styles.corpsGras);
    p.y += 18;
    for (const { nom, liste } of grouperParNombre(passes, (a) => a.playerName).slice(0, 10)) {
      p.assurer(20);
      doc.texte(`  ${nom} : ${liste.length} passe${liste.length > 1 ? 's' : ''}`, marge + 20, p.y, styles.corps);
      p.y += 16;
    }
    p.y += 10;
  }

  // Historique des matchs
  if (termines.length) {
    filet(doc, p.y, marge, largeur);
    p.y += 15;
    titreSection('Historique des matchs');
    for (const m of termines) {
      p.assurer(35);
      const h = m.homeTeam === '' ? 'Dom.' : m.homeTeam;
      const a = m.awayTeam === '' ? 'Ext.' : m.awayTeam;
      const moi = m.isMyTeamHome ? '*' : '';
      const adv = m.isMyTeamHome ? '' : '*';
      doc.texte(`${h}${moi} ${m.homeScore}-${m.awayScore} ${a}${adv}`, marge + 10, p.y, { ...styles.corpsGras, largeurMax: largeur - 10 });
      p.y += 16;
      doc.texte(`${dateMoyenne(m.date)} · Effectif: ${M.formatTime(M.totalEffectivePlayTime(m))} (${Math.trunc(M.effectivePercentage(m))}%) · ${m.stoppages.length} arrêts`,
        marge + 10, p.y, styles.petit);
      p.y += 18;
    }
  }

  // Pied de page
  p.assurer(40);
  p.y += 20;
  filet(doc, p.y, marge, largeur);
  p.y += 10;
  doc.texte(`Temps De Jeu · ${dateLongue(maintenant)}`, marge, p.y, styles.pied);
  return doc.octets();
}
