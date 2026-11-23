// Récapitulatif d'après-match (PostMatchRecapView.swift), affiché après « Terminer le match » :
// score, temps, buteurs, passes décisives, cartons, temps de jeu des joueurs, partage du texte.
import * as M from '../../model.js';
import { definirPage, action, fermerFeuille, h, icone, boutonBarre, partager, copier, toast, rafraichir } from '../../ui.js';
import { vm } from './vm.js';
import { resultatMatch, texteRecap, tempsRecap, mesButs, grouper } from './recap-texte.js';
import { quitterMatch } from './direct.js';

const carte = (contenu) => `<section class="m-recap-carte">${contenu}</section>`;
const titreCarte = (texte, ic) => `<div class="m-recap-titre">${icone(ic)}<b>${h(texte)}</b></div>`;
const statItem = (libelle, valeur) => `<div class="m-recap-stat"><b>${h(valeur)}</b><small>${h(libelle)}</small></div>`;

function iconeCarton(type) {
  if (type === '2ème Jaune') return '<span class="m-recap-carton double"><span style="background:var(--jaune)"></span><span style="background:var(--rouge)"></span></span>';
  const fond = type === 'Rouge' ? 'var(--rouge)' : type === 'Blanc' ? '#fff' : 'var(--jaune)';
  return `<span class="m-recap-carton"><span style="background:${fond}${type === 'Blanc' ? ';box-shadow:inset 0 0 0 .5px var(--gris)' : ''}"></span></span>`;
}

function listeGroupee(evenements, emoji) {
  return grouper(evenements).map(([nom, l]) => `<div class="m-recap-ligne">
    <span>${emoji} ${h(nom)}</span><span class="m-espace"></span>
    <small class="secondaire">${l.map((e) => `${Math.trunc(e.minute / 60)}'`).join(', ')}</small>${l.length > 1 ? `<small><b>×${l.length}</b></small>` : ''}
  </div>`).join('');
}

definirPage('match.recap', () => {
  const m = vm.match;
  const r = resultatMatch(m);
  const buts = mesButs(m);
  const temps = M.playerPlayingTimes(m);
  const max = temps[0]?.totalTime || 1;
  return {
    titre: 'Résumé du match',
    gauche: '',
    droite: boutonBarre({ libelle: 'Fermer', action: 'match.recap.fermer', gras: true }),
    contenu: `<div class="colonne m-recap">
      ${carte(`<div class="m-recap-score">
        <span class="m-recap-emoji">${r.emoji}</span>
        <div class="m-recap-equipes">
          <div class="droite"><span class="${m.isMyTeamHome ? '' : 'secondaire'}">${h(m.homeTeam || 'Domicile')}</span>${m.isMyTeamHome ? '<small style="color:var(--orange)">Mon équipe</small>' : ''}</div>
          <b class="m-recap-resultat">${m.homeScore} - ${m.awayScore}</b>
          <div><span class="${m.isMyTeamHome ? 'secondaire' : ''}">${h(m.awayTeam || 'Extérieur')}</span>${m.isMyTeamHome ? '' : '<small style="color:var(--orange)">Mon équipe</small>'}</div>
        </div>
        <b style="color:${M.couleur(r.couleur)}">${r.label}</b>
      </div>`)}
      ${carte(`${titreCarte('Temps de jeu', 'timer')}
        <div class="m-recap-stats">${statItem('Durée totale', tempsRecap(M.totalMatchDuration(m)))}${statItem('Temps effectif', tempsRecap(M.totalEffectivePlayTime(m)))}${statItem('Ratio', `${Math.trunc(M.effectivePercentage(m))}%`)}</div>
        <div class="m-recap-stats">${statItem('Arrêts', String(m.stoppages.length))}${statItem('Remplacements', String(m.substitutions.length))}${statItem('Fautes', String(m.fouls.length))}</div>`)}
      ${buts.length ? carte(`${titreCarte(`Buteurs (${buts.length})`, 'soccerball')}${listeGroupee(buts, '⚽')}`) : ''}
      ${m.assists.length ? carte(`${titreCarte(`Passes décisives (${m.assists.length})`, 'hand.point.up.fill')}${listeGroupee(m.assists, '🅰️')}`) : ''}
      ${m.cards.length ? carte(`${titreCarte(`Cartons (${m.cards.length})`, 'rectangle.portrait.fill')}${m.cards.map((c) => `<div class="m-recap-ligne">
        ${iconeCarton(c.type)}<span>${h(c.playerName)}</span><span class="m-espace"></span><small class="secondaire">${Math.trunc(c.minute / 60)}'</small></div>`).join('')}`) : ''}
      ${temps.length ? carte(`${titreCarte('Temps de jeu', 'clock.fill')}
        ${temps.slice(0, 14).map((t) => `<div class="m-recap-joueur">
          <small class="m-mono secondaire m-recap-num">#${t.shirtNumber}</small>
          <span class="m-recap-nom">${h(t.playerName)}</span>
          <span class="m-jauge m-recap-jauge"><span style="width:${((t.totalTime / max) * 100).toFixed(1)}%;background:${t.isTitulaire ? 'color-mix(in srgb, var(--vert) 70%, transparent)' : 'color-mix(in srgb, var(--bleu) 70%, transparent)'}"></span></span>
          <small class="m-mono m-recap-temps">${tempsRecap(t.totalTime)}</small>
        </div>`).join('')}
        ${temps.length > 14 ? `<small class="secondaire">+ ${temps.length - 14} autres joueurs</small>` : ''}`) : ''}
      <button type="button" class="m-gros-bouton orange" data-action="match.recap.partager">${icone('square.and.arrow.up')}<span>Partager le résumé</span></button>
      <button type="button" class="m-gros-bouton gris" data-action="match.recap.copier">${icone('doc.on.doc')}<span>Copier le texte</span></button>
    </div>`,
  };
});

action('match.recap.partager', () => { partager({ texte: texteRecap(vm.match) }); return false; });
action('match.recap.copier', async () => {
  if (await copier(texteRecap(vm.match))) toast('📋 Copié !');
  return false;
});
action('match.recap.fermer', () => {
  fermerFeuille('match.recap');
  quitterMatch();
  rafraichir({ hautDePage: true });
});
