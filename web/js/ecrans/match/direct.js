// Match en direct (MatchView.swift) et indicateur d'équité du temps de jeu
// (PlayingTimeFairnessView.swift). Fond vert quand le jeu tourne, rouge pendant un arrêt.
// Vibrations de l'iPhone : aucune sur le web. L'écran reste allumé pendant le match (wakeLock).
import * as M from '../../model.js';
import { store } from '../../store.js';
import {
  action, definirMontage, ouvrirFeuille, alerte, choix, h, icone, boutonBarre, rafraichir, surChaqueRendu,
} from '../../ui.js';
import { vm, ETATS } from './vm.js';
import { carton, statBox, maillotIcone, minSec, nomEquipe } from './commun.js';
import { viderPrep } from './preparation.js';

const ui = { equiteOuverte: false };

// MARK: - Composants

function boutonPossession(cote) {
  const m = vm.match;
  const couleurId = cote === 'home' ? m.homeJerseyColor : m.awayJerseyColor;
  const maillot = M.maillot(couleurId);
  const actif = vm.currentPossession === cote;
  const possible = vm.isPlaying;
  const temps = cote === 'home' ? vm.currentHomePossessionTime : vm.currentAwayPossessionTime;
  return `<button type="button" class="m-possession${actif ? ' actif' : ''}" style="--c:${maillot.css};--texte-maillot:${maillot.texte}"
      data-action="match.possession" data-equipe="${cote}" ${possible ? '' : 'disabled'}>
    ${maillotIcone(couleurId, 16)}
    <span class="m-possession-textes"><b>${h(nomEquipe(m, cote))}</b><span class="m-mono">${M.formatTime(temps)}</span></span>
  </button>`;
}

function actionRapide({ icone: ic, libelle, badge, couleur, page }) {
  return `<button type="button" class="m-action-rapide" style="--c:${couleur}" data-action="match.ouvrir" data-page="${page}">
    <span class="m-action-rapide-icone">${ic}${badge ? `<span class="m-action-badge">${badge}</span>` : ''}</span>
    <span>${h(libelle)}</span>
  </button>`;
}

function compteurPasses(cote) {
  const m = vm.match;
  const couleurId = cote === 'home' ? m.homeJerseyColor : m.awayJerseyColor;
  const maillot = M.maillot(couleurId);
  const n = cote === 'home' ? m.homePasses : m.awayPasses;
  return `<div class="m-passes">
    <button type="button" class="m-passes-rond${couleurId === 'Blanc' ? ' blanc' : ''}" style="--c:${maillot.css};color:${maillot.texte}"
      data-action="match.passe.ajouter" data-equipe="${cote}" data-monter="match.appuiLong" data-key="passes-${cote}"
      aria-label="Passe ${h(nomEquipe(m, cote, true))} (appui long : retirer)" title="Appui long : retirer une passe">
      <span class="m-passes-icone">${icone('sportscourt.fill')}</span><b>${n}</b>
    </button>
    <span class="m-passes-libelle">Passes</span>
  </div>`;
}

function infoArret() {
  const type = vm.timerState.stoppageType;
  const a = M.arret(type);
  const equipe = vm.currentBeneficiaryTeam;
  return `<div class="m-arret-en-cours">
    <span class="m-arret-icone">${icone(a.icone)}</span>
    <div class="m-arret-textes">
      <div class="ligne-flex"><b>${h(type)}</b>${equipe ? `<span class="m-tag-equipe ${equipe}">${h(nomEquipe(vm.match, equipe, true))}</span>` : ''}</div>
      <span class="m-mono m-arret-temps">${M.formatTimePrecise(vm.stoppageElapsed)}</span>
    </div>
    <button type="button" class="m-reprise" data-action="match.reprise">${icone('play.fill')}<span>REPRISE</span></button>
  </div>`;
}

function progressionCirculaire(ratio, couleur) {
  const r = 11; const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, ratio));
  return `<svg class="m-cercle" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
    <circle cx="14" cy="14" r="${r}" fill="none" stroke="${couleur}" stroke-opacity=".2" stroke-width="3"/>
    <circle cx="14" cy="14" r="${r}" fill="none" stroke="${couleur}" stroke-width="3" stroke-linecap="round"
      stroke-dasharray="${(c * p).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 14 14)"/>
  </svg>`;
}

function banniereExpulsions() {
  const actives = vm.activeTempExpulsions.filter((e) => !e.isCompleted);
  if (!actives.length) return '';
  return `<div class="m-expulsions">${actives.map((e) => {
    const reste = vm.remainingTempExpulsionTime(e);
    const alerteProche = reste < 120;
    const couleur = alerteProche ? 'var(--orange)' : 'var(--bleu)';
    return `<div class="m-expulsion" style="--c:${couleur}" data-key="exp-${e.id}">
      <span class="m-carton-blanc-grand"></span>
      <span class="m-expulsion-textes"><b>${h(e.playerName)}</b><small>Expulsion temporaire</small></span>
      <span class="m-mono m-expulsion-reste"${alerteProche ? ' style="color:var(--orange)"' : ''}>${M.formatTime(reste)}</span>
      ${progressionCirculaire(1 - reste / e.totalDuration, couleur)}
    </div>`;
  }).join('')}</div>`;
}

function boutonsArrets() {
  const courant = vm.currentStoppageType ? M.arret(vm.currentStoppageType) : null;
  return `<div class="m-arrets">${M.ARRETS.map((a) => {
    const enchaine = vm.isStopped && Boolean(courant?.enchaine.includes(a.id));
    const possible = vm.isPlaying || enchaine;
    return `<button type="button" class="m-arret${enchaine ? ' enchaine' : ''}" style="--c:${M.couleur(a.couleur)}"
      data-action="match.arret" data-type="${h(a.id)}" ${possible ? '' : 'disabled'}>
      <span class="m-arret-bouton-icone">${icone(a.icone)}</span><span class="m-arret-nom">${h(a.id)}</span>
    </button>`;
  }).join('')}</div>`;
}

function statsRapides() {
  const periode = vm.currentPeriod;
  const pourcent = vm.currentEffectiveTime > 0 ? Math.trunc((vm.currentEffectiveTime / Math.max(1, vm.elapsedTime)) * 100) : 0;
  const pilule = (libelle, valeur, c) => `<div class="m-pilule"><b class="m-mono" style="color:${M.couleur(c)}">${valeur}</b><span>${libelle}</span></div>`;
  return `<div class="m-stats-rapides">
    ${pilule('Arrêts', vm.match.stoppages.filter((s) => s.period === periode).length, 'red')}
    ${pilule('Effectif', `${pourcent}%`, 'green')}
    ${pilule('Fautes', vm.match.fouls.filter((f) => f.period === periode).length, 'orange')}
  </div>`;
}

function miTemps() {
  const p = vm.currentPeriod;
  return `<div class="m-mi-temps">
    <span class="m-mi-temps-icone">${icone('pause.circle.fill')}</span>
    <h2>Fin de la ${h(p)}</h2>
    <div class="m-statboxes">
      ${statBox('Temps total', M.formatTime(vm.match.periodDurations[p] ?? vm.elapsedTime), 'blue')}
      ${statBox('Effectif', M.formatTime(vm.currentEffectiveTime), 'green')}
      ${statBox('Arrêts', M.formatTime(vm.currentTotalStoppageTime), 'red')}
      ${statBox('À ajouter', `+${Math.ceil(vm.currentAddedTime / 60)}'`, 'orange')}
    </div>
    ${vm.isLastPeriod ? '' : `<button type="button" class="m-gros-bouton vert" data-action="match.periodeSuivante">${icone('play.fill')}<span>Lancer la ${h(vm.nextPeriod)}</span></button>`}
    <button type="button" class="m-gros-bouton rouge-clair" data-action="match.finMatch">${icone('stop.fill')}<span>Terminer le match</span></button>
  </div>`;
}

// MARK: - Équité du temps de jeu (PlayingTimeFairnessView)

function couleurBarre(j) {
  if (j.totalTime < 1 && !j.isOnField) return 'color-mix(in srgb, var(--rouge) 70%, transparent)';
  if (j.isOnField) return 'var(--vert)';
  return 'color-mix(in srgb, var(--bleu) 60%, transparent)';
}

export function equite() {
  const temps = vm.livePlayerPlayingTimes();
  if (!temps.length) return '';
  const max = temps[temps.length - 1].totalTime;
  const min = temps[0].totalTime;
  const ecart = max - min;
  const pasJoue = temps.filter((j) => j.totalTime < 1 && !j.isOnField).length;
  const couleur = ecart < 300 ? 'var(--vert)' : ecart < 600 ? 'var(--orange)' : 'var(--rouge)';
  const maxSur = Math.max(max, 1);
  return `<div class="m-equite" style="--c:${couleur}" data-key="equite">
    <button type="button" class="m-equite-barre" data-action="match.equite" aria-expanded="${ui.equiteOuverte}">
      <span style="color:${couleur}">${icone('chart.bar.fill')}</span>
      <span class="m-mini-barres">${temps.map((j) => `<span style="height:max(2px, ${((j.totalTime / maxSur) * 100).toFixed(1)}%);background:${couleurBarre(j)}"></span>`).join('')}</span>
      <span class="m-equite-ecart"><b class="m-mono" style="color:${couleur}">Δ ${minSec(ecart)}</b>${pasJoue ? `<small>${pasJoue} pas joué</small>` : ''}</span>
      <span class="secondaire">${icone(ui.equiteOuverte ? 'chevron.up' : 'chevron.down')}</span>
    </button>
    ${ui.equiteOuverte ? `<div class="m-equite-detail">${temps.map((j) => `
      <div class="m-equite-ligne">
        <span class="m-mono m-equite-num">#${j.shirtNumber}</span>
        <span class="m-point" style="background:${j.isOnField ? 'var(--vert)' : 'color-mix(in srgb, var(--gris) 40%, transparent)'}"></span>
        <span class="m-equite-nom">${h(j.playerName)}</span>
        <span class="m-jauge"><span style="width:${((j.totalTime / maxSur) * 100).toFixed(1)}%;background:${couleurBarre(j)}"></span></span>
        <span class="m-mono m-equite-temps">${minSec(j.totalTime)}</span>
      </div>`).join('')}</div>` : ''}
  </div>`;
}

action('match.equite', () => { ui.equiteOuverte = !ui.equiteOuverte; });

// MARK: - Page du match en direct

export function rendreDirect() {
  const m = vm.match;
  const t = vm.timerState.type;
  const nbCartons = m.cards.length;
  const cartonJaune = (l, hauteur) => `<span class="m-carton-ombre">${carton('Jaune', l, hauteur)}</span>`;
  return {
    titre: '',
    gauche: boutonBarre({ icone: 'timeline.selection', titre: 'Timeline', action: 'match.ouvrir', data: { page: 'match.timeline' } }),
    droite: `<button type="button" class="bouton-barre m-bouton-cartons" data-action="match.ouvrir" data-page="match.cartons" aria-label="Cartons du match">
        ${carton('Jaune', 10, 14)}${nbCartons ? `<b>${nbCartons}</b>` : ''}</button>
      ${boutonBarre({ icone: 'chart.bar.fill', titre: 'Statistiques', action: 'match.ouvrir', data: { page: 'match.statistiques' } })}`,
    classe: `m-direct etat-${t}`,
    contenu: `<div class="colonne m-direct-colonne">
      <div class="m-entete-match">
        <div class="m-equipe"><b>${h(nomEquipe(m, 'home'))}</b>${m.isMyTeamHome ? '<span class="m-tag">Mon équipe</span>' : ''}</div>
        <div class="m-periode"><span>${M.PERIODE_COURTE[vm.currentPeriod]}</span>${vm.isOverRegulationTime ? `<small>+${vm.overtimeMinutes}'</small>` : ''}</div>
        <div class="m-equipe droite"><b>${h(nomEquipe(m, 'away'))}</b>${m.isMyTeamHome ? '' : '<span class="m-tag">Mon équipe</span>'}</div>
      </div>
      <div class="m-possessions">${boutonPossession('home')}${boutonPossession('away')}</div>
      <button type="button" class="m-score" data-action="match.ouvrir" data-page="match.score" aria-label="Score">
        <b>${m.homeScore}</b><span>-</span><b>${m.awayScore}</b>
      </button>
      <div class="m-actions-rapides">
        ${actionRapide({ icone: cartonJaune(14, 19), libelle: 'Carton', badge: nbCartons || '', couleur: M.COULEURS.cardYellow, page: 'match.carton' })}
        ${actionRapide({ icone: icone('arrow.left.arrow.right'), libelle: 'Rempl.', badge: m.substitutions.length || '', couleur: 'var(--cyan)', page: 'match.remplacement' })}
        ${actionRapide({ icone: icone('exclamationmark.triangle.fill'), libelle: 'Faute', badge: m.fouls.length || '', couleur: 'var(--orange)', page: 'match.faute' })}
        ${actionRapide({ icone: icone('hand.point.up.fill'), libelle: 'Passe D.', badge: m.assists.length || '', couleur: 'var(--bleu)', page: 'match.passeDecisive' })}
      </div>

      <div class="m-chrono">
        <div class="m-chrono-total m-mono">${M.formatTimePrecise(vm.elapsedTime)}</div>
        <div class="m-chrono-details">
          <div><span>Effectif</span><b class="m-mono">${M.formatTime(vm.currentEffectiveTime)}</b></div>
          <div><span>Arrêts</span><b class="m-mono" style="color:var(--jaune)">${M.formatTime(vm.currentTotalStoppageTime)}</b></div>
          <div><span>À ajouter</span><b class="m-mono" style="color:var(--orange)">+${Math.ceil(vm.currentAddedTime / 60)}'</b></div>
        </div>
      </div>

      <div class="m-compteurs-passes">${compteurPasses('home')}${compteurPasses('away')}</div>

      ${vm.isStopped ? infoArret() : ''}
      ${t === ETATS.periodEnded ? miTemps() : `${banniereExpulsions()}${boutonsArrets()}`}
      ${statsRapides()}
      ${t !== ETATS.idle && vm.matchRoster.length ? equite() : ''}
    </div>`,
    pied: t === ETATS.periodEnded ? undefined : `<div class="m-controles colonne">
      <button type="button" class="m-controle orange" data-action="match.finPeriode" ${t === ETATS.idle ? 'disabled' : ''}>${icone('flag.checkered')}<span>Fin ${M.PERIODE_COURTE[vm.currentPeriod]}</span></button>
      <button type="button" class="m-controle rouge" data-action="match.finMatch">${icone('stop.fill')}<span>Fin match</span></button>
    </div>`,
  };
}

// MARK: - Actions

action('match.possession', (el) => vm.selectPossession(el.dataset.equipe));

action('match.passe.ajouter', (el) => {
  if (el.__appuiLong) { el.__appuiLong = false; return false; }
  vm.addPass(el.dataset.equipe);
});

// Appui long sur le compteur de passes : retirer une passe (correction)
definirMontage('match.appuiLong', (el) => {
  let minuterie = null;
  const annuler = () => { clearTimeout(minuterie); minuterie = null; };
  const debut = () => {
    annuler();
    minuterie = setTimeout(() => {
      minuterie = null;
      el.__appuiLong = true;
      vm.removePass(el.dataset.equipe);
      rafraichir();
    }, 500);
  };
  const menu = (e) => e.preventDefault();
  el.addEventListener('pointerdown', debut);
  for (const t of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(t, annuler);
  el.addEventListener('contextmenu', menu);
  return () => {
    annuler();
    el.removeEventListener('pointerdown', debut);
    for (const t of ['pointerup', 'pointerleave', 'pointercancel']) el.removeEventListener(t, annuler);
    el.removeEventListener('contextmenu', menu);
  };
});

action('match.arret', (el) => {
  const type = el.dataset.type;
  const a = M.arret(type);
  const enchaine = vm.isStopped && Boolean(M.arret(vm.currentStoppageType).enchaine.includes(type));
  const faire = (equipe) => {
    if (enchaine) vm.chainStoppage(type, equipe); else vm.stopPlay(type, equipe);
    rafraichir();
  };
  if (!a.equipe) { faire(null); return; }
  choix({
    titre: 'Quelle équipe bénéficie ?',
    actions: [
      { libelle: nomEquipe(vm.match, 'home'), faire: () => faire('home') },
      { libelle: nomEquipe(vm.match, 'away'), faire: () => faire('away') },
    ],
  });
});

action('match.reprise', () => vm.resumePlay());
action('match.periodeSuivante', () => vm.startMatch());

action('match.finPeriode', () => {
  alerte('Fin de période', `Siffler la fin de la ${vm.currentPeriod} ?`, [
    { libelle: 'Confirmer', role: 'detruire', faire: () => { vm.endPeriod(); rafraichir(); } },
    { libelle: 'Annuler', role: 'annuler' },
  ]);
});

action('match.finMatch', () => {
  alerte('Fin du match', 'Êtes-vous sûr de vouloir terminer le match ?', [
    { libelle: 'Terminer', role: 'detruire', faire: terminerMatch },
    { libelle: 'Annuler', role: 'annuler' },
  ]);
});

function terminerMatch() {
  vm.endMatch();
  store.enregistrerMatch(structuredClone(vm.match));
  vm.afficherRecap = true;
  vm.changer();
  ouvrirFeuille('match.recap', { bloquerRetour: true }, { plein: true });
}

/** Ferme le récapitulatif : retour à la préparation d'un nouveau match */
export function quitterMatch() {
  vm.afficherRecap = false;
  vm.afficherMatch = false;
  if (vm.match.isFinished) { vm.resetMatch(); viderPrep(); } else vm.changer();
  ui.equiteOuverte = false;
  liberer();
}

// MARK: - Écran allumé pendant le match (wakeLock)

let verrou = null;
let demandeEnCours = false;
async function garderEcranAllume() {
  if (verrou || demandeEnCours || !navigator.wakeLock || document.visibilityState !== 'visible') return;
  demandeEnCours = true;
  try {
    verrou = await navigator.wakeLock.request('screen');
    verrou.addEventListener('release', () => { verrou = null; });
  } catch { verrou = null; } finally { demandeEnCours = false; }
}
function liberer() {
  if (verrou) { verrou.release().catch(() => {}); verrou = null; }
}
surChaqueRendu(() => {
  const actif = vm.afficherMatch && [ETATS.running, ETATS.stopped, ETATS.periodEnded].includes(vm.timerState.type);
  if (actif) garderEcranAllume(); else if (verrou) liberer();
});
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { vm.tick(); rafraichir(); }
  });
}
