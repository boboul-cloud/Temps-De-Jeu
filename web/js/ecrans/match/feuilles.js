// Feuilles du match en direct (MatchView.swift : ScoreSheet, GoalScorerPicker, CardSheet,
// SubstitutionSheet, FoulSheet, AssistSheet ; CardsManagementView.swift : MatchCardsListView ;
// TimelineView.swift : TimelineView, StoppageDetailSheet).
// Glisser pour supprimer (iPhone) → bouton corbeille sur la ligne.
import * as M from '../../model.js';
import {
  definirPage, action, ouvrirFeuille, fermerFeuille, h, icone, boutonBarre, etat, rafraichir,
} from '../../ui.js';
import { vm } from './vm.js';
import { carton, couleurCarton } from './commun.js';

const params = (page) => {
  const f = etat.feuilles[etat.feuilles.length - 1];
  return f?.page === page ? f.params : etat.feuilles.find((x) => x.page === page)?.params ?? null;
};
const fermer = { gauche: '', droite: boutonBarre({ libelle: 'Fermer', action: 'nav.fermer' }) };
const nomCourt = (cote) => (cote === 'home' ? (vm.match.homeTeam || 'DOM') : (vm.match.awayTeam || 'EXT'));

action('match.ouvrir', (el) => {
  const page = el.dataset.page;
  if (['match.score', 'match.carton', 'match.remplacement', 'match.faute', 'match.passeDecisive'].includes(page)) vm.loadMatchRoster();
  ouvrirFeuille(page, {});
});

// MARK: - Score (ScoreSheet)

definirPage('match.score', (p) => {
  const m = vm.match;
  const joueurs = [...vm.matchRoster].sort((a, b) => a.shirtNumber - b.shirtNumber);
  const choisi = joueurs.find((j) => j.id === p.selectedPlayerId);
  const colonne = (cote) => {
    const moi = cote === 'home' ? m.isMyTeamHome : !m.isMyTeamHome;
    return `<div class="m-score-col">
      <b>${h(cote === 'home' ? (m.homeTeam || 'Domicile') : (m.awayTeam || 'Extérieur'))}</b>
      ${moi ? '<span class="m-tag-moi">Mon équipe</span>' : ''}
      <span class="m-score-valeur">${cote === 'home' ? m.homeScore : m.awayScore}</span>
      <div class="m-score-boutons">
        <button type="button" style="color:var(--rouge)" data-action="match.score.moins" data-cote="${cote}" aria-label="Retirer un but">${icone('minus.circle.fill')}</button>
        <button type="button" style="color:var(--vert)" data-action="match.score.plus" data-cote="${cote}" aria-label="Ajouter un but">${icone('plus.circle.fill')}</button>
      </div>
    </div>`;
  };
  return {
    titre: 'Score',
    ...fermer,
    contenu: `<div class="colonne m-feuille">
      <div class="m-score-feuille">${colonne('home')}<span class="m-score-tiret">-</span>${colonne('away')}</div>
      ${joueurs.length ? `<div class="m-groupe-centre">
        <span class="m-petit secondaire">Buteur (mon équipe)</span>
        <button type="button" class="m-selecteur-joueur" data-action="match.score.buteur">
          <span style="color:var(--orange)">${icone('person.fill')}</span>
          <span class="${choisi ? '' : 'secondaire'}">${choisi ? `${choisi.shirtNumber} - ${h(`${choisi.firstName} ${choisi.lastName}`)}` : 'Sélectionner un buteur'}</span>
          <span class="secondaire">${icone('chevron.right')}</span>
        </button>
      </div>` : ''}
    </div>`,
  };
});

action('match.score.moins', (el) => vm.retirerScore(el.dataset.cote === 'home'));
action('match.score.plus', (el) => {
  const p = params('match.score');
  const choisi = vm.matchRoster.find((j) => j.id === p?.selectedPlayerId);
  const nom = choisi ? `${choisi.firstName} ${choisi.lastName}` : '';
  const domicile = el.dataset.cote === 'home';
  const moi = domicile ? vm.match.isMyTeamHome : !vm.match.isMyTeamHome;
  vm.addGoal(domicile, moi ? nom : '');
  if (p) p.selectedPlayerId = null;
});
action('match.score.buteur', () => ouvrirFeuille('match.buteur', {}));

definirPage('match.buteur', () => {
  const sp = params('match.score');
  const joueurs = [...vm.matchRoster].sort((a, b) => a.shirtNumber - b.shirtNumber);
  const coche = `<span style="color:var(--bleu)">${icone('checkmark')}</span>`;
  return {
    titre: 'Buteur',
    ...fermer,
    contenu: `<section class="section"><div class="section-corps">
      <button type="button" class="ligne tactile" data-action="match.buteur.choisir" data-id="">
        <span class="ligne-textes secondaire">— Aucun —</span>${sp?.selectedPlayerId ? '' : coche}
      </button>
      ${joueurs.map((j) => `<button type="button" class="ligne tactile" data-action="match.buteur.choisir" data-id="${j.id}">
        <span class="m-numero-rond">${j.shirtNumber}</span>
        <span class="ligne-textes">${h(`${j.firstName} ${j.lastName}`)}</span>${sp?.selectedPlayerId === j.id ? coche : ''}
      </button>`).join('')}
    </div></section>`,
  };
});
action('match.buteur.choisir', (el) => {
  const sp = params('match.score');
  if (sp) sp.selectedPlayerId = el.dataset.id || null;
  fermerFeuille('match.buteur');
});

// MARK: - Sélection rapide d'un joueur (puces)

function puceJoueur(j, { action: a, choisi, couleurChoix, extra = '', fond = '' }) {
  return `<button type="button" class="m-puce-joueur" data-action="${a}" data-id="${j.id}"
    style="${choisi ? `background:color-mix(in srgb, ${couleurChoix} 25%, transparent)` : fond}">
    ${j.isCaptain && a === 'match.carton.joueur' ? `<span class="m-etoile">${icone('star.fill')}</span>` : ''}#${j.shirtNumber} ${h(M.matchPlayerDisplayName(j))}${extra}
  </button>`;
}

function champNom(page, placeholder, valeur) {
  return `<input type="text" class="m-champ-arrondi" placeholder="${h(placeholder)}" value="${h(valeur)}"
    data-input="match.nom" data-page="${page}" data-key="nom-${page}" autocomplete="off" aria-label="${h(placeholder)}">`;
}

/** Saisie du nom : la référence au joueur est perdue si le texte ne correspond plus */
action('match.nom', (el) => {
  const p = params(el.dataset.page);
  if (!p) return false;
  p.playerName = el.value;
  if (p.selectedPlayerId) {
    const mp = vm.allMatchPlayers.find((j) => j.id === p.selectedPlayerId);
    if (mp && el.value !== M.matchPlayerDisplayName(mp)) p.selectedPlayerId = null;
  }
});

function choisirJoueur(page, el) {
  const p = params(page);
  const mp = vm.matchRoster.find((j) => j.id === el.dataset.id);
  if (!p || !mp) return;
  p.playerName = M.matchPlayerDisplayName(mp);
  p.selectedPlayerId = mp.id;
}

// MARK: - Carton (CardSheet)

const TYPES = ['Jaune', '2ème Jaune', 'Rouge', 'Blanc'];

definirPage('match.carton', (p) => {
  p.cardType ??= 'Jaune';
  p.playerName ??= '';
  const expulses = vm.matchRoster.filter((j) => j.status === 'Expulsé');
  return {
    titre: 'Carton',
    contenu: `<div class="colonne m-feuille">
      <div class="m-types-carton">${TYPES.map((t) => {
        const choisi = p.cardType === t;
        const c = t === 'Blanc' ? 'var(--gris)' : couleurCarton(t);
        return `<button type="button" class="m-type-carton${choisi ? ' choisi' : ''}" style="--c:${c}" data-action="match.carton.type" data-type="${h(t)}">
          ${carton(t, 28, 38)}<span>${h(t)}</span></button>`;
      }).join('')}</div>
      ${champNom('match.carton', 'Nom du joueur', p.playerName)}
      ${vm.matchRoster.length ? `<div class="m-puces-defile">${vm.allMatchPlayers.map((j) => {
        const jaune = vm.match.cards.some((c) => c.playerId === j.id && c.type === 'Jaune');
        const temp = j.status === 'Expulsé temp.';
        return puceJoueur(j, {
          action: 'match.carton.joueur', choisi: p.selectedPlayerId === j.id, couleurChoix: 'var(--orange)',
          fond: temp ? 'background:color-mix(in srgb, var(--gris) 15%, transparent)' : '',
          extra: `${jaune ? carton('Jaune', 8, 11) : ''}${temp ? `<span class="secondaire" style="font-size:9px">${icone('rectangle.fill')}</span>` : ''}`,
        });
      }).join('')}</div>
      ${expulses.length ? `<div class="m-expulses"><b style="color:var(--rouge)">Expulsés</b>
        <div class="m-puces-defile">${expulses.map((j) => `<span class="m-puce-joueur m-puce-expulse">
          <s>#${j.shirtNumber} ${h(M.matchPlayerDisplayName(j))}</s>${vm.match.cards.filter((c) => c.playerId === j.id).map((c) => `<span class="m-carton" style="width:8px;height:11px;background:${c.type === 'Rouge' ? M.COULEURS.cardRed : c.type === '2ème Jaune' ? M.COULEURS.cardOrange : M.COULEURS.cardYellow}"></span>`).join('')}
        </span>`).join('')}</div></div>` : ''}` : ''}
      <button type="button" class="m-confirmer" style="--c:var(--orange)" data-action="match.carton.confirmer" ${p.playerName === '' ? 'disabled' : ''}>Confirmer le carton</button>
    </div>`,
  };
});
action('match.carton.type', (el) => { const p = params('match.carton'); if (p) p.cardType = el.dataset.type; });
action('match.carton.joueur', (el) => choisirJoueur('match.carton', el));
action('match.carton.confirmer', () => {
  const p = params('match.carton');
  if (!p || p.playerName === '') return;
  vm.addCard(p.cardType, p.playerName, p.selectedPlayerId ?? null);
  fermerFeuille('match.carton');
});

// MARK: - Remplacement (SubstitutionSheet)

definirPage('match.remplacement', (p) => {
  p.playerOut ??= '';
  p.playerIn ??= '';
  const pret = p.playerOut !== '' && p.playerIn !== '';
  return {
    titre: 'Remplacement',
    contenu: `<div class="colonne m-feuille">
      <div class="m-champ-libelle"><span style="color:var(--rouge)">${icone('arrow.down.circle.fill')} Sort</span>
        <input type="text" class="m-champ-arrondi" placeholder="Joueur sortant" value="${h(p.playerOut)}" data-input="match.rempl.sortant" data-key="rempl-out" autocomplete="off" aria-label="Joueur sortant"></div>
      <div class="m-champ-libelle"><span style="color:var(--vert)">${icone('arrow.up.circle.fill')} Entre</span>
        <input type="text" class="m-champ-arrondi" placeholder="Joueur entrant" value="${h(p.playerIn)}" data-input="match.rempl.entrant" data-key="rempl-in" autocomplete="off" aria-label="Joueur entrant"></div>
      ${vm.matchRoster.length ? `
        <span class="m-sous-titre">Titulaires (sortants)</span>
        <div class="m-puces-defile">${vm.titulaires.map((j) => puceJoueur(j, { action: 'match.rempl.choisirSortant', choisi: p.selectedOutId === j.id, couleurChoix: 'var(--rouge)' })).join('')}</div>
        <span class="m-sous-titre">Remplaçants (entrants)</span>
        <div class="m-puces-defile">${vm.remplacants.map((j) => puceJoueur(j, { action: 'match.rempl.choisirEntrant', choisi: p.selectedInId === j.id, couleurChoix: 'var(--vert)' })).join('')}</div>` : ''}
      <button type="button" class="m-confirmer" style="--c:var(--violet)" data-action="match.rempl.confirmer" ${pret ? '' : 'disabled'}>Confirmer le remplacement</button>
    </div>`,
  };
});
action('match.rempl.sortant', (el) => {
  const p = params('match.remplacement');
  if (!p) return false;
  p.playerOut = el.value;
  const mp = vm.titulaires.find((j) => j.id === p.selectedOutId);
  if (mp && el.value !== M.matchPlayerDisplayName(mp)) p.selectedOutId = null;
});
action('match.rempl.entrant', (el) => {
  const p = params('match.remplacement');
  if (!p) return false;
  p.playerIn = el.value;
  const mp = vm.remplacants.find((j) => j.id === p.selectedInId);
  if (mp && el.value !== M.matchPlayerDisplayName(mp)) p.selectedInId = null;
});
action('match.rempl.choisirSortant', (el) => {
  const p = params('match.remplacement');
  const mp = vm.titulaires.find((j) => j.id === el.dataset.id);
  if (p && mp) { p.playerOut = M.matchPlayerDisplayName(mp); p.selectedOutId = mp.id; }
});
action('match.rempl.choisirEntrant', (el) => {
  const p = params('match.remplacement');
  const mp = vm.remplacants.find((j) => j.id === el.dataset.id);
  if (p && mp) { p.playerIn = M.matchPlayerDisplayName(mp); p.selectedInId = mp.id; }
});
action('match.rempl.confirmer', () => {
  const p = params('match.remplacement');
  if (!p || p.playerOut === '' || p.playerIn === '') return;
  vm.addSubstitution(p.playerOut, p.playerIn, p.selectedOutId ?? null, p.selectedInId ?? null);
  if (vm.isPlaying) vm.stopPlay('Remplacement');
  fermerFeuille('match.remplacement');
});

// MARK: - Faute (FoulSheet) et passe décisive (AssistSheet)

function feuilleJoueur(p, { page, titre, ic, couleur, texte, compter, confirmer }) {
  p.playerName ??= '';
  return {
    titre,
    contenu: `<div class="colonne m-feuille">
      <div class="m-feuille-intro"><span style="color:${couleur}">${icone(ic)}</span><span class="secondaire">${h(texte)}</span></div>
      ${champNom(page, 'Nom du joueur', p.playerName)}
      ${vm.matchRoster.length ? `<div class="m-puces-defile">${vm.allMatchPlayers.map((j) => {
        const n = compter(j.id);
        return puceJoueur(j, {
          action: `${page}.joueur`, choisi: p.selectedPlayerId === j.id, couleurChoix: couleur,
          extra: n > 0 ? `<span class="m-compte" style="background:${couleur}">${n}</span>` : '',
        });
      }).join('')}</div>` : ''}
      <button type="button" class="m-confirmer" style="--c:${couleur}" data-action="${page}.confirmer" ${p.playerName === '' ? 'disabled' : ''}>${h(confirmer)}</button>
    </div>`,
  };
}

definirPage('match.faute', (p) => feuilleJoueur(p, {
  page: 'match.faute', titre: 'Faute', ic: 'exclamationmark.triangle.fill', couleur: 'var(--orange)',
  texte: 'Attribuer une faute à un joueur', compter: (id) => vm.foulCount(id), confirmer: 'Confirmer la faute',
}));
action('match.faute.joueur', (el) => choisirJoueur('match.faute', el));
action('match.faute.confirmer', () => {
  const p = params('match.faute');
  if (!p || p.playerName === '') return;
  vm.addFoul(p.playerName, p.selectedPlayerId ?? null);
  fermerFeuille('match.faute');
});

definirPage('match.passeDecisive', (p) => feuilleJoueur(p, {
  page: 'match.passeDecisive', titre: 'Passe décisive', ic: 'hand.point.up.fill', couleur: 'var(--bleu)',
  texte: 'Attribuer une passe décisive à un joueur', compter: (id) => vm.assistCount(id), confirmer: 'Confirmer la passe décisive',
}));
action('match.passeDecisive.joueur', (el) => choisirJoueur('match.passeDecisive', el));
action('match.passeDecisive.confirmer', () => {
  const p = params('match.passeDecisive');
  if (!p || p.playerName === '') return;
  vm.addAssist(p.playerName, p.selectedPlayerId ?? null);
  fermerFeuille('match.passeDecisive');
});

// MARK: - Cartons du match (MatchCardsListView)

definirPage('match.cartons', () => {
  const cartes = vm.match.cards;
  if (!cartes.length) {
    return {
      titre: 'Cartons du match',
      contenu: `<div class="vide"><span class="vide-icone">${icone('rectangle.on.rectangle.slash')}</span><p class="vide-message">Aucun carton pour ce match</p></div>`,
    };
  }
  const nb = (t) => cartes.filter((c) => c.type === t).length;
  const badge = (t, libelle) => `<div class="m-badge-carton"><span class="ligne-flex"><span class="m-carton" style="width:14px;height:20px;background:${couleurCarton(t)}"></span><b style="color:${couleurCarton(t)}">${nb(t)}</b></span><small>${libelle}</small></div>`;
  return {
    titre: 'Cartons du match',
    contenu: `<div class="colonne">
      <div class="m-badges-cartons">${badge('Jaune', 'Jaunes')}${badge('2ème Jaune', '2è Jaunes')}${badge('Rouge', 'Rouges')}${badge('Blanc', 'Blancs')}</div>
      ${M.PERIODES.map((periode) => {
        const liste = cartes.filter((c) => c.period === periode);
        if (!liste.length) return '';
        return `<section class="section"><h2 class="section-entete">${h(periode)}</h2><div class="section-corps">${liste.map((c) => `
          <div class="ligne" data-key="carte-${c.id}">
            ${carton(c.type, 20, 28)}
            <span class="ligne-textes"><b>${h(c.playerName)}</b><span class="ligne-sous-titre">${h(c.type)} • ${Math.trunc(c.minute / 60)}'</span></span>
            <b class="m-mono" style="color:${couleurCarton(c.type)}">${Math.trunc(c.minute / 60)}'</b>
            <button type="button" class="m-corbeille" data-action="match.cartons.supprimer" data-id="${c.id}" aria-label="Supprimer">${icone('trash')}</button>
          </div>`).join('')}</div></section>`;
      }).join('')}
    </div>`,
  };
});
action('match.cartons.supprimer', (el) => vm.supprimerCarton(el.dataset.id));

// MARK: - Chronologie (TimelineView) et détail d'un arrêt (StoppageDetailSheet)

const tagEquipe = (cote) => `<span class="m-tag-equipe ${cote}">${h(nomCourt(cote))}</span>`;

definirPage('match.timeline', () => {
  const arrets = vm.match.stoppages;
  return {
    titre: 'Timeline',
    ...fermer,
    contenu: arrets.length === 0
      ? `<div class="vide"><span class="vide-icone">${icone('timeline.selection')}</span><p class="vide-titre secondaire" style="font-size:17px">Aucun événement</p><p class="vide-message">Les arrêts de jeu apparaîtront ici</p></div>`
      : `<div class="colonne m-timeline">${arrets.map((s, i) => {
        const a = M.arret(s.type);
        const c = M.couleur(a.couleur);
        const dernier = i === arrets.length - 1;
        return `<button type="button" class="m-tl-ligne" data-action="match.timeline.detail" data-id="${s.id}" data-key="tl-${s.id}">
          <span class="m-tl-minute m-mono">${M.formatMatchMinute(s.startTime, M.dureeReglementaire(s.period))}</span>
          <span class="m-tl-axe"><span class="m-tl-point" style="background:${c}"></span>${dernier ? '' : '<span class="m-tl-trait"></span>'}</span>
          <span class="m-tl-detail${dernier ? '' : ' espace'}">
            <span class="ligne-flex"><span style="color:${c}">${icone(a.icone)}</span><b>${h(s.type)}</b>${s.beneficiaryTeam ? tagEquipe(s.beneficiaryTeam) : ''}
              <span class="m-tl-duree m-mono" style="background:color-mix(in srgb, ${c} 15%, transparent)">${M.formatShort(M.dureeArret(s))}</span></span>
            <small class="secondaire">${h(s.period)}</small>
          </span>
        </button>`;
      }).join('')}</div>`,
  };
});
action('match.timeline.detail', (el) => ouvrirFeuille('match.arretDetail', { id: el.dataset.id }));

definirPage('match.arretDetail', (p) => {
  const s = vm.match.stoppages.find((x) => x.id === p.id);
  if (!s) return { titre: '', contenu: '' };
  const a = M.arret(s.type);
  const c = M.couleur(a.couleur);
  const bloc = (titre, valeur, couleur = '') => `<div class="m-detail-bloc"><small class="secondaire">${titre}</small><b class="m-mono"${couleur ? ` style="color:${couleur}"` : ''}>${valeur}</b></div>`;
  return {
    titre: '',
    contenu: `<div class="colonne m-feuille">
      <div class="m-detail-entete"><span style="color:${c};font-size:30px">${icone(a.icone)}</span>
        <span class="m-bouton-ligne-textes"><span class="ligne-flex"><b>${h(s.type)}</b>${s.beneficiaryTeam ? tagEquipe(s.beneficiaryTeam) : ''}</span>
        <span class="secondaire">${h(s.period)}</span></span></div>
      <div class="m-detail-blocs">
        ${bloc('Début', M.formatTime(s.startTime))}
        ${s.endTime != null ? bloc('Fin', M.formatTime(s.endTime)) : ''}
        ${bloc('Durée', M.formatShort(M.dureeArret(s)), c)}
      </div>
      <button type="button" class="m-supprimer-arret" data-action="match.arret.supprimer" data-id="${s.id}">${icone('trash')}<span>Supprimer cet arrêt</span></button>
    </div>`,
  };
});
action('match.arret.supprimer', (el) => {
  vm.deleteStoppage(el.dataset.id);
  fermerFeuille('match.arretDetail');
  rafraichir();
});
