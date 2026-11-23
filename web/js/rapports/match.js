// Rapport PDF d'un match (ExportService.generateMatchPDF) : résumé des temps, possession,
// passes, périodes, arrêts, buts, cartons, remplacements, fautes, passes décisives,
// composition, chronologie des arrêts et temps de jeu par joueur.
import { DocumentPDF, MiseEnPage } from '../pdf.js';
import * as M from '../model.js';
import { UI, styles, filet, dateLongue, grouperParNombre } from './commun.js';

/** Titre du rapport : « Rapport FC Exemple vs AS Voisins » (aperçu) */
export function titreRapport(match) {
  const domicile = match.homeTeam === '' ? 'Match' : match.homeTeam;
  const exterieur = match.awayTeam === '' ? '' : ` vs ${match.awayTeam}`;
  return `${domicile}${exterieur}`;
}

/** Nom du fichier partagé : « rapport_FC_Exemple_vs_AS_Voisins_2026-11-23.pdf » */
export function nomFichierRapport(match, maintenant = new Date()) {
  const domicile = match.homeTeam === '' ? 'match' : match.homeTeam;
  const exterieur = match.awayTeam === '' ? '' : `_vs_${match.awayTeam}`;
  const propre = `${domicile}${exterieur}`.replaceAll(' ', '_');
  return `rapport_${propre}_${M.formatDateMotif(maintenant, 'yyyy-MM-dd')}.pdf`;
}

/** → Uint8Array */
export function genererPDFMatch(match, { maintenant = new Date() } = {}) {
  const largeurPage = 595;
  const marge = 40;
  const largeur = largeurPage - 2 * marge;
  const doc = new DocumentPDF({ titre: titreRapport(match) });
  const p = new MiseEnPage(doc, { marge });
  const titreSection = (texte) => { doc.texte(texte, marge, p.y, styles.entete); p.y += 22; };
  const separer = () => { filet(doc, p.y, marge, largeur); p.y += 15; };

  // En-tête
  const domicile = match.homeTeam === '' ? 'Domicile' : match.homeTeam;
  const exterieur = match.awayTeam === '' ? 'Extérieur' : match.awayTeam;
  const suffixeDom = match.isMyTeamHome ? ' *' : '';
  const suffixeExt = match.isMyTeamHome ? '' : ' *';
  // L'app écrit sur une ligne (qui peut sortir de la page) : ici, coupé sur plusieurs lignes si besoin
  const hTitre = doc.texteBloc(`${domicile}${suffixeDom}  ${match.homeScore} - ${match.awayScore}  ${exterieur}${suffixeExt}`, marge, p.y, largeur, styles.titre22);
  p.y += 30 + hTitre - doc.hauteurLigne(22);

  let sous = `* Mon équipe ${match.isMyTeamHome ? '(domicile)' : '(extérieur)'} · ${dateLongue(match.date)}`;
  if (match.competition !== '') sous = `${match.competition} · ${sous}`;
  const hSous = doc.texteBloc(sous, marge, p.y, largeur, styles.sousTitre);
  p.y += 25 + hSous - doc.hauteurLigne(14);

  const arbitres = [
    [match.refereeCentre !== '', `Arbitre central : ${match.refereeCentre}`],
    [match.refereeAssistant1 !== '', `Assistant 1 : ${match.refereeAssistant1}`],
    [match.refereeAssistant2 !== '', `Assistant 2 : ${match.refereeAssistant2}`],
  ].filter(([ok]) => ok);
  if (arbitres.length) {
    for (const [, ligne] of arbitres) { doc.texte(ligne, marge, p.y, styles.petit); p.y += 16; }
    p.y += 5;
  }

  filet(doc, p.y, marge, largeur);
  p.y += 20;

  // Résumé des temps
  titreSection('Résumé des temps');
  const lignes = [
    ['Durée totale', M.formatTime(M.totalMatchDuration(match))],
    ['Temps effectif', M.formatTime(M.totalEffectivePlayTime(match))],
    ["Temps d'arrêts", M.formatTime(M.totalStoppageTime(match))],
    ['Ratio effectif', `${Math.trunc(M.effectivePercentage(match))}%`],
    ["Nombre d'arrêts", `${match.stoppages.length}`],
  ];
  for (const [libelle, valeur] of lignes) {
    p.assurer(20);
    doc.texte(libelle, marge + 10, p.y, styles.corps);
    doc.texte(valeur, largeurPage - marge - 80, p.y, styles.corpsGras);
    p.y += 18;
  }
  p.y += 10;

  // Possession par équipe
  const possession = match.homePossessionTime + match.awayPossessionTime;
  if (possession > 0) {
    filet(doc, p.y, marge, largeur);
    p.y += 15;
    titreSection('Possession par équipe');
    const pctDom = Math.trunc((match.homePossessionTime / possession) * 100);
    const pctExt = 100 - pctDom;
    for (const [libelle, valeur] of [
      [domicile, `${M.formatTime(match.homePossessionTime)}  (${pctDom}%)`],
      [exterieur, `${M.formatTime(match.awayPossessionTime)}  (${pctExt}%)`],
    ]) {
      p.assurer(20);
      doc.texte(libelle, marge + 10, p.y, { ...styles.corps, largeurMax: largeur - 150 });
      doc.texte(valeur, largeurPage - marge - 130, p.y, styles.corpsGras);
      p.y += 18;
    }
    // Barre de possession
    p.assurer(20);
    const yBarre = p.y + 2;
    const hBarre = 12;
    const lDom = largeur * (match.homePossessionTime / possession);
    const lExt = largeur - lDom;
    doc.rect(marge, yBarre, largeur, hBarre, { remplissage: UI.systemOrange, rayon: 4 });
    if (lDom > 0) {
      doc.rect(marge, yBarre, lDom, hBarre, { remplissage: UI.systemBlue, rayon: Math.min(4, lDom / 2) });
      if (lExt > 0 && lDom > 4) doc.rect(marge + lDom - 4, yBarre, 4, hBarre, { remplissage: UI.systemBlue });
    }
    const texteBarre = { taille: 8, gras: true, couleur: UI.white };
    if (lDom > 30) doc.texte(`${pctDom}%`, marge + 4, yBarre + 1, texteBarre);
    if (lExt > 30) doc.texte(`${pctExt}%`, marge + lDom + lExt - 28, yBarre + 1, texteBarre);
    p.y += hBarre + 12;
  }

  // Passes par équipe
  if (match.homePasses + match.awayPasses > 0) {
    p.assurer(60);
    filet(doc, p.y, marge, largeur);
    p.y += 15;
    titreSection('Passes par équipe');
    for (const [libelle, valeur] of [[domicile, `${match.homePasses}`], [exterieur, `${match.awayPasses}`]]) {
      doc.texte(libelle, marge + 10, p.y, { ...styles.corps, largeurMax: largeur - 120 });
      doc.texte(valeur, marge + largeur - 100, p.y, styles.corpsGras);
      p.y += 18;
    }
    p.y += 8;
  }

  // Par période
  separer();
  titreSection('Détail par période');
  for (const periode of M.PERIODES) {
    const duree = match.periodDurations[periode];
    if (duree == null) continue;
    p.assurer(50);
    const effectif = M.effectivePlayTime(match, periode);
    const arrets = M.totalStoppageTime(match, periode);
    const ajoute = M.suggestedAddedTime(match, periode);
    doc.texte(periode, marge + 10, p.y, styles.corpsGras);
    p.y += 18;
    doc.texte(`  Durée: ${M.formatTime(duree)} · Effectif: ${M.formatTime(effectif)} · Arrêts: ${M.formatTime(arrets)} · T.A. suggéré: +${Math.ceil(ajoute / 60)}'`,
      marge + 10, p.y, styles.petit);
    p.y += 20;
  }
  p.y += 10;

  // Arrêts par type
  separer();
  titreSection('Arrêts par type');
  const libDom = match.homeTeam === '' ? 'DOM' : match.homeTeam;
  const libExt = match.awayTeam === '' ? 'EXT' : match.awayTeam;
  for (const type of M.TYPES_ARRET) {
    const n = M.stoppageCount(match, type);
    if (n <= 0) continue;
    p.assurer(20);
    const nDom = M.stoppageCount(match, type, 'home');
    const nExt = M.stoppageCount(match, type, 'away');
    let detail = '';
    if (nDom > 0 || nExt > 0) {
      const parts = [];
      if (nDom > 0) parts.push(`${libDom}: ${nDom}`);
      if (nExt > 0) parts.push(`${libExt}: ${nExt}`);
      detail = ` (${parts.join(' / ')})`;
    }
    doc.texte(`${type} : ${n}x · ${M.formatShort(M.totalTimeFor(match, type))}${detail}`, marge + 10, p.y, { ...styles.corps, largeurMax: largeur - 10 });
    p.y += 18;
  }
  p.y += 10;

  // Buts
  if (match.goals.length) {
    separer();
    titreSection('Buts');
    for (const g of match.goals) {
      p.assurer(20);
      const cote = g.isHome ? domicile : exterieur;
      const buteur = g.playerName === '' ? '' : ` (${g.playerName})`;
      doc.texte(`${Math.trunc(g.minute / 60)}' ${M.PERIODE_COURTE[g.period]} - ${cote}${buteur}`, marge + 10, p.y, styles.corps);
      p.y += 18;
    }
    p.y += 10;
  }

  // Cartons
  if (match.cards.length) {
    separer();
    titreSection('Cartons');
    for (const c of match.cards) {
      p.assurer(20);
      doc.texte(`${Math.trunc(c.minute / 60)}' ${M.PERIODE_COURTE[c.period]} - ${c.type} · ${c.playerName}`, marge + 10, p.y, styles.corps);
      p.y += 18;
    }
    p.y += 10;
  }

  // Remplacements (« ⇄ » n'existe pas dans les polices standard du PDF : « <-> »)
  if (match.substitutions.length) {
    separer();
    titreSection('Remplacements');
    for (const s of match.substitutions) {
      p.assurer(20);
      doc.texte(`${Math.trunc(s.minute / 60)}' ${M.PERIODE_COURTE[s.period]} - ${s.playerOut} <-> ${s.playerIn}`, marge + 10, p.y, styles.corps);
      p.y += 18;
    }
    p.y += 10;
  }

  // Fautes
  if (match.fouls.length) {
    separer();
    titreSection(`Fautes (${match.fouls.length})`);
    for (const { nom, liste } of grouperParNombre(match.fouls, (f) => f.playerName)) {
      p.assurer(20);
      doc.texte(`${nom} : ${liste.length} faute${liste.length > 1 ? 's' : ''}`, marge + 10, p.y, styles.corps);
      p.y += 18;
    }
    p.y += 10;
  }

  // Passes décisives
  if (match.assists.length) {
    separer();
    titreSection(`Passes décisives (${match.assists.length})`);
    for (const { nom, liste } of grouperParNombre(match.assists, (a) => a.playerName)) {
      p.assurer(20);
      const minutes = liste.map((a) => `${Math.trunc(a.minute / 60)}'`).join(', ');
      doc.texte(`${nom} : ${liste.length} passe${liste.length > 1 ? 's' : ''} (${minutes})`, marge + 10, p.y, styles.corps);
      p.y += 18;
    }
    p.y += 10;
  }

  // Composition
  if (match.matchRoster.length) {
    separer();
    titreSection('Composition');
    const parNumero = (a, b) => a.shirtNumber - b.shirtNumber;
    const titulaires = match.matchRoster.filter((x) => x.status === 'Titulaire').sort(parNumero);
    const remplacants = match.matchRoster.filter((x) => x.status === 'Remplaçant').sort(parNumero);
    if (titulaires.length) {
      doc.texte('Titulaires :', marge + 10, p.y, styles.corpsGras);
      p.y += 18;
      for (const mp of titulaires) {
        p.assurer(20);
        doc.texte(`#${mp.shirtNumber} ${M.fullName(mp)} (${M.POSTE_COURT[mp.position]})`, marge + 20, p.y, styles.corps);
        p.y += 16;
      }
      p.y += 5;
    }
    if (remplacants.length) {
      p.assurer(20);
      doc.texte('Remplaçants :', marge + 10, p.y, styles.corpsGras);
      p.y += 18;
      for (const mp of remplacants) {
        p.assurer(20);
        doc.texte(`#${mp.shirtNumber} ${M.fullName(mp)} (${M.POSTE_COURT[mp.position]})`, marge + 20, p.y, styles.corps);
        p.y += 16;
      }
    }
    p.y += 10;
  }

  // Chronologie des arrêts
  if (match.stoppages.length) {
    separer();
    titreSection('Chronologie des arrêts');
    match.stoppages.forEach((s, i) => {
      p.assurer(20);
      const minute = M.formatMatchMinute(s.startTime, M.dureeReglementaire(s.period));
      const duree = M.formatShort(M.dureeArret(s));
      let equipe = '';
      if (s.beneficiaryTeam) equipe = ` (${s.beneficiaryTeam === 'home' ? libDom : libExt})`;
      doc.texte(`${i + 1}. ${minute} ${M.PERIODE_COURTE[s.period]} · ${s.type}${equipe} · ${duree}`, marge + 10, p.y, styles.petit);
      p.y += 16;
    });
  }

  // Temps de jeu par joueur
  const temps = M.playerPlayingTimes(match);
  if (temps.length) {
    filet(doc, p.y, marge, largeur);
    p.y += 15;
    titreSection('Temps de jeu par joueur');
    const enteteCol = { taille: 10, gras: true, couleur: UI.gray };
    doc.texte('Joueur', marge + 10, p.y, enteteCol);
    doc.texte('Pos.', marge + 220, p.y, enteteCol);
    doc.texte('Total', marge + 280, p.y, enteteCol);
    doc.texte('Effectif', marge + 350, p.y, enteteCol);
    p.y += 16;
    for (const pt of temps) {
      p.assurer(18);
      doc.texte(`#${pt.shirtNumber} ${pt.playerName}`, marge + 10, p.y, { ...styles.corps, largeurMax: 205 });
      doc.texte(`${M.POSTE_COURT[pt.position]} ${pt.isTitulaire ? 'TIT' : 'RMP'}`, marge + 220, p.y, styles.petit);
      doc.texte(M.formatTime(pt.totalTime), marge + 280, p.y, styles.corpsGras);
      doc.texte(M.formatTime(pt.effectiveTime), marge + 350, p.y, styles.corps);
      p.y += 16;
    }
    p.y += 10;
  }

  // Pied de page
  p.assurer(40);
  p.y += 20;
  filet(doc, p.y, marge, largeur);
  p.y += 10;
  doc.texte(`Temps De Jeu · ${dateLongue(maintenant)}`, marge, p.y, styles.pied);
  return doc.octets();
}
