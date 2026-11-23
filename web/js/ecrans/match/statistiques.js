// Statistiques du match en cours (StatisticsView.swift) : résumé, possession, passes,
// répartition des arrêts, détail par période, buteurs, passes décisives, fautes, événements.
import * as M from '../../model.js';
import { definirPage, h, icone, boutonBarre } from '../../ui.js';
import { vm } from './vm.js';
import { enteteSection, statBox, maillotIcone, nomEquipe } from './commun.js';

const carte = (contenu) => `<section class="m-carte">${contenu}</section>`;
const vide = (texte) => `<p class="m-vide-carte">${h(texte)}</p>`;

function jauge(ratio) {
  const r = 70; const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, ratio));
  return `<div class="m-jauge-ronde">
    <svg viewBox="0 0 160 160" width="160" height="160" aria-hidden="true">
      <circle cx="80" cy="80" r="${r}" fill="none" stroke="color-mix(in srgb, var(--rouge) 20%, transparent)" stroke-width="20"/>
      <circle cx="80" cy="80" r="${r}" fill="none" stroke="var(--vert)" stroke-width="20" stroke-linecap="round"
        stroke-dasharray="${(c * p).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 80 80)"/>
    </svg>
    <div class="m-jauge-texte"><b>${Math.trunc(p * 100)}%</b><small>Temps effectif</small></div>
  </div>`;
}

function resume() {
  const ratio = vm.elapsedTime > 0 ? vm.currentEffectiveTime / vm.elapsedTime : 1;
  return carte(`${enteteSection('Résumé du match', 'chart.pie.fill')}
    ${jauge(ratio)}
    <div class="m-statboxes trois">
      ${statBox('Temps total', M.formatTime(vm.elapsedTime), 'blue')}
      ${statBox('Jeu effectif', M.formatTime(vm.currentEffectiveTime), 'green')}
      ${statBox('Arrêts', M.formatTime(vm.currentAddedTime), 'red')}
    </div>`);
}

function possession() {
  const m = vm.match;
  const dom = vm.currentHomePossessionTime;
  const ext = vm.currentAwayPossessionTime;
  const total = dom + ext;
  if (total <= 0) {
    return carte(`${enteteSection('Possession par équipe', 'tshirt.fill')}
      <div class="m-vide-icone"><span class="secondaire">${icone('tshirt.fill')}</span><b class="secondaire">Aucune donnée de possession</b><small class="secondaire">Utilisez les boutons de possession pendant le match</small></div>`);
  }
  const couleurTexte = (id) => (id === 'Blanc' ? 'var(--texte)' : M.maillot(id).css);
  const arretsDom = m.stoppages.filter((s) => s.beneficiaryTeam === 'home');
  const arretsExt = m.stoppages.filter((s) => s.beneficiaryTeam === 'away');
  const duree = (l) => l.reduce((t, s) => t + M.dureeArret(s), 0);
  const bordure = (id) => (id === 'Blanc' ? ';box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--gris) 30%, transparent)' : '');
  return carte(`${enteteSection('Possession par équipe', 'tshirt.fill')}
    <div class="ligne-flex entre"><span class="ligne-flex">${maillotIcone(m.homeJerseyColor, 13)}<b>${h(nomEquipe(m, 'home'))}</b></span>
      <span class="ligne-flex"><b>${h(nomEquipe(m, 'away'))}</b>${maillotIcone(m.awayJerseyColor, 13)}</span></div>
    <div class="m-barre-double">
      <span style="width:${((dom / total) * 100).toFixed(2)}%;background:${M.maillot(m.homeJerseyColor).css}${bordure(m.homeJerseyColor)}"></span>
      <span style="flex:1;background:${M.maillot(m.awayJerseyColor).css}${bordure(m.awayJerseyColor)}"></span>
    </div>
    <div class="ligne-flex entre">
      <div><b class="m-gros-pourcent" style="color:${couleurTexte(m.homeJerseyColor)}">${Math.trunc(vm.homePossessionPercentage)}%</b><small class="m-mono secondaire" style="display:block">${M.formatTime(dom)}</small></div>
      <div style="text-align:right"><b class="m-gros-pourcent" style="color:${couleurTexte(m.awayJerseyColor)}">${Math.trunc(vm.awayPossessionPercentage)}%</b><small class="m-mono secondaire" style="display:block">${M.formatTime(ext)}</small></div>
    </div>
    ${arretsDom.length || arretsExt.length ? `<div class="m-separateur"></div>
      <div class="m-arrets-equipes">
        <div><b>${arretsDom.length}</b><small class="secondaire">Arrêts</small><b style="color:var(--rouge);font-size:12px">${M.formatShort(duree(arretsDom))}</b></div>
        <span class="m-trait-vertical"></span>
        <div><b>${arretsExt.length}</b><small class="secondaire">Arrêts</small><b style="color:var(--rouge);font-size:12px">${M.formatShort(duree(arretsExt))}</b></div>
      </div>` : ''}`);
}

function passes() {
  const m = vm.match;
  const total = m.homePasses + m.awayPasses;
  if (total <= 0) {
    return carte(`${enteteSection('Passes par équipe', 'sportscourt.fill')}
      <div class="m-vide-icone"><span class="secondaire">${icone('sportscourt.fill')}</span><b class="secondaire">Aucune passe enregistrée</b><small class="secondaire">Utilisez les boutons ronds pendant le match</small></div>`);
  }
  return carte(`${enteteSection('Passes par équipe', 'sportscourt.fill')}
    <div class="m-barre-passes"><span style="width:${((m.homePasses / total) * 100).toFixed(2)}%;background:${M.maillot(m.homeJerseyColor).css}"></span><span style="flex:1;background:${M.maillot(m.awayJerseyColor).css}"></span></div>
    <div class="ligne-flex entre">
      <div><small><b>${h(nomEquipe(m, 'home'))}</b></small><b class="m-moyen" style="display:block">${m.homePasses}</b></div>
      <div style="text-align:right"><small><b>${h(nomEquipe(m, 'away'))}</b></small><b class="m-moyen" style="display:block">${m.awayPasses}</b></div>
    </div>`);
}

function repartition() {
  const m = vm.match;
  const types = M.ARRETS.filter((a) => m.stoppages.some((s) => s.type === a.id));
  if (!types.length) return carte(`${enteteSection('Répartition des arrêts', 'chart.bar.fill')}${vide('Aucun arrêt enregistré')}`);
  const maxTemps = Math.max(...M.TYPES_ARRET.map((t) => M.totalTimeFor(m, t)), 1);
  return carte(`${enteteSection('Répartition des arrêts', 'chart.bar.fill')}
    ${types.map((a) => {
      const c = M.couleur(a.couleur);
      const temps = M.totalTimeFor(m, a.id);
      const dom = M.stoppageCount(m, a.id, 'home');
      const ext = M.stoppageCount(m, a.id, 'away');
      return `<div class="m-stat-ligne">
        <span class="m-stat-icone" style="color:${c}">${icone(a.icone)}</span>
        <div class="m-stat-corps">
          <div class="ligne-flex"><b>${h(a.id)}</b><span class="m-espace"></span><small class="secondaire"><b>${M.stoppageCount(m, a.id)}x</b></small><b style="color:${c}">${M.formatShort(temps)}</b></div>
          ${dom || ext ? `<div class="ligne-flex m-mini-tags">
            ${dom ? `<span class="m-mini-tag" style="background:color-mix(in srgb, var(--bleu) 15%, transparent)">${h(nomEquipe(m, 'home', true))} <span class="m-mono">${dom}</span></span>` : ''}
            ${ext ? `<span class="m-mini-tag" style="background:color-mix(in srgb, var(--orange) 15%, transparent)">${h(nomEquipe(m, 'away', true))} <span class="m-mono">${ext}</span></span>` : ''}
          </div>` : ''}
          <span class="m-barre-fine"><span style="width:${((temps / maxTemps) * 100).toFixed(1)}%;background:color-mix(in srgb, ${c} 30%, transparent)"></span></span>
        </div>
      </div>`;
    }).join('')}`);
}

function parPeriode() {
  const m = vm.match;
  const actives = M.PERIODES.filter((p) => m.periodDurations[p] != null || p === vm.currentPeriod);
  return carte(`${enteteSection('Par période', 'clock.fill')}
    ${actives.map((p) => {
      const courante = p === vm.currentPeriod;
      const duree = courante ? vm.elapsedTime : (m.periodDurations[p] ?? 0);
      const arrets = M.totalStoppageTime(m, p) + (courante ? vm.stoppageElapsed : 0);
      const nb = m.stoppages.filter((s) => s.period === p).length;
      return `<div class="m-periode-ligne">
        <span class="m-periode-badge">${M.PERIODE_COURTE[p]}</span>
        <span class="m-bouton-ligne-textes"><span>Effectif: ${M.formatTime(duree - arrets)}</span><small class="secondaire">${nb} arrêts · ${M.formatShort(arrets)} perdues</small></span>
        <span class="m-mono secondaire">${M.formatTime(duree)}</span>
      </div>`;
    }).join('')}`);
}

function classement(evenements) {
  const groupes = new Map();
  for (const e of evenements) {
    if (!groupes.has(e.playerName)) groupes.set(e.playerName, []);
    groupes.get(e.playerName).push(e);
  }
  return [...groupes.entries()].map(([nom, l]) => ({ nom, liste: l, n: l.length }))
    .sort((a, b) => (a.n !== b.n ? b.n - a.n : (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0)));
}

function listeJoueurs({ titre, ic, couleur, entrees, unite, pluriel, minutes }) {
  const max = entrees[0]?.n ?? 1;
  return entrees.map((e) => `<div class="m-stat-ligne">
    <span class="m-stat-icone" style="color:${couleur}">${icone(ic)}</span>
    <div class="m-stat-corps">
      <div class="ligne-flex"><b>${h(e.nom)}</b><span class="m-espace"></span><b style="color:${couleur}">${e.n}</b><small class="secondaire">${e.n > 1 ? pluriel : unite}</small></div>
      <div class="ligne-flex m-mini-tags">${minutes(e).map((t) => `<span class="m-mini-tag m-mono" style="background:color-mix(in srgb, ${couleur} 15%, transparent)">${t}</span>`).join('')}</div>
      <span class="m-barre-fine"><span style="width:${((e.n / max) * 100).toFixed(1)}%;background:color-mix(in srgb, ${couleur} 30%, transparent)"></span></span>
    </div>
  </div>`).join('') + (titre ? '' : '');
}

function buteurs() {
  const m = vm.match;
  const mesButs = m.goals.filter((g) => g.isHome === m.isMyTeamHome && g.playerName !== '');
  const entrees = classement(mesButs);
  return carte(`${enteteSection(`Buteurs (${mesButs.length})`, 'soccerball')}
    ${entrees.length ? listeJoueurs({ ic: 'soccerball', couleur: 'var(--vert)', entrees, unite: 'but', pluriel: 'buts', minutes: (e) => e.liste.map((g) => `${Math.trunc(g.minute / 60)}'`) }) : vide('Aucun but enregistré')}`);
}

function passesDecisives() {
  const m = vm.match;
  const entrees = classement(m.assists.filter((a) => a.playerName !== ''));
  return carte(`${enteteSection(`Passes D. (${m.assists.length})`, 'hand.point.up.fill')}
    ${entrees.length ? listeJoueurs({ ic: 'hand.point.up.fill', couleur: 'var(--bleu)', entrees, unite: 'passe', pluriel: 'passes', minutes: (e) => e.liste.map((a) => `${Math.trunc(a.minute / 60)}'`) }) : vide('Aucune passe décisive enregistrée')}`);
}

function fautes() {
  const m = vm.match;
  const entrees = classement(m.fouls);
  const parPeriodeFautes = (e) => {
    const compte = new Map();
    for (const f of e.liste) { const k = M.PERIODE_COURTE[f.period]; compte.set(k, (compte.get(k) ?? 0) + 1); }
    return [...compte.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, n]) => `${k} <span class="m-mono">${n}</span>`);
  };
  return carte(`${enteteSection(`Fautes (${m.fouls.length})`, 'exclamationmark.triangle.fill')}
    ${entrees.length ? listeJoueurs({ ic: 'person.fill', couleur: 'var(--orange)', entrees, unite: 'faute', pluriel: 'fautes', minutes: parPeriodeFautes }) : vide('Aucune faute enregistrée')}`);
}

function evenements() {
  const m = vm.match;
  if (!m.stoppages.length) return carte(`${enteteSection('Événements (0)', 'list.bullet')}${vide('Aucun événement')}`);
  const premier = m.stoppages[0]?.id;
  return carte(`${enteteSection(`Événements (${m.stoppages.length})`, 'list.bullet')}
    ${[...m.stoppages].reverse().map((s) => {
      const a = M.arret(s.type);
      const d = M.dureeArret(s);
      return `<div class="m-stat-ligne m-evenement">
        <span class="m-stat-icone" style="color:${M.couleur(a.couleur)}">${icone(a.icone)}</span>
        <span class="m-bouton-ligne-textes"><span class="ligne-flex"><b>${h(s.type)}</b>${s.beneficiaryTeam ? `<span class="m-tag-equipe ${s.beneficiaryTeam}">${h(nomEquipe(m, s.beneficiaryTeam, true))}</span>` : ''}</span>
          <small class="secondaire">${M.PERIODE_COURTE[s.period]} · ${M.formatMatchMinute(s.startTime, M.dureeReglementaire(s.period))}</small></span>
        <span class="m-mono"${d > 60 ? ' style="color:var(--rouge)"' : ''}>${M.formatShort(d)}</span>
      </div>${s.id !== premier ? '<div class="m-separateur fin"></div>' : ''}`;
    }).join('')}`);
}

definirPage('match.statistiques', () => ({
  titre: 'Statistiques',
  gauche: '',
  droite: boutonBarre({ libelle: 'Fermer', action: 'nav.fermer' }),
  classe: 'm-fond-page',
  contenu: `<div class="colonne m-stats">
    ${resume()}${possession()}${passes()}${repartition()}${parPeriode()}${buteurs()}${passesDecisives()}${fautes()}${evenements()}
  </div>`,
}));
