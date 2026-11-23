// Texte du récapitulatif d'après-match (PostMatchRecapView.buildRecapText), sans interface : testable.
import * as M from '../../model.js';

/** Résultat pour mon équipe : { emoji, label, couleur } */
export function resultatMatch(m) {
  const moi = M.myScore(m);
  const adv = M.opponentScore(m);
  if (moi > adv) return { emoji: '🏆', label: 'Victoire', couleur: 'green' };
  if (moi < adv) return { emoji: '😔', label: 'Défaite', couleur: 'red' };
  return { emoji: '🤝', label: 'Match nul', couleur: 'orange' };
}

/** « 61:04 » (String(format: "%d:%02d")) */
export function tempsRecap(t) {
  const s = Math.trunc(Math.max(0, t));
  return `${Math.trunc(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Buts de mon équipe avec un buteur nommé */
export const mesButs = (m) => m.goals.filter((g) => g.isHome === m.isMyTeamHome && g.playerName !== '');

/** Regroupe par nom, du plus fréquent au moins fréquent (ordre d'apparition à égalité) */
export function grouper(evenements) {
  const groupes = new Map();
  for (const e of evenements) {
    if (!groupes.has(e.playerName)) groupes.set(e.playerName, []);
    groupes.get(e.playerName).push(e);
  }
  return [...groupes.entries()].sort((a, b) => b[1].length - a[1].length);
}

const minutes = (liste) => liste.map((e) => `${Math.trunc(e.minute / 60)}'`).join(', ');
const EMOJI_CARTON = { Jaune: '🟨', '2ème Jaune': '🟨🟨', Rouge: '🟥', Blanc: '⬜' };

export function texteRecap(m) {
  const r = resultatMatch(m);
  const dom = m.homeTeam === '' ? 'Domicile' : m.homeTeam;
  const ext = m.awayTeam === '' ? 'Extérieur' : m.awayTeam;
  const lignes = [`${r.emoji} ${dom} ${m.homeScore} - ${m.awayScore} ${ext}`, ''];
  lignes.push(`📅 ${M.formatDate(m.date, 'long')}`);
  lignes.push(`⏱ Temps effectif : ${tempsRecap(M.totalEffectivePlayTime(m))} / ${tempsRecap(M.totalMatchDuration(m))} (${Math.trunc(M.effectivePercentage(m))}%)`);
  lignes.push(`🛑 ${m.stoppages.length} arrêts · 🔄 ${m.substitutions.length} remplacements`);
  const buts = mesButs(m);
  if (buts.length) {
    lignes.push('');
    for (const [nom, l] of grouper(buts)) lignes.push(`⚽ ${nom} (${minutes(l)})`);
  }
  if (m.assists.length) {
    lignes.push('');
    for (const [nom, l] of grouper(m.assists)) lignes.push(`🅰️ ${nom} (${minutes(l)})`);
  }
  if (m.cards.length) {
    lignes.push('');
    for (const c of m.cards) lignes.push(`${EMOJI_CARTON[c.type] ?? '🟨'} ${c.playerName} (${Math.trunc(c.minute / 60)}')`);
  }
  lignes.push('', '— Temps De Jeu ⚽');
  return lignes.join('\n');
}
