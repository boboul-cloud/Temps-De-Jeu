// Temps De Jeu — version web : la coque de l'app (ContentView). Neuf onglets comme sur iPhone :
// Match, Joueurs, Présences, Catégories, Historique des matchs, Encadrement, Cartons, Saisons,
// Réglages et Exports. Sur téléphone, les quatre premiers + « Plus » ; au-delà de 860 px, barre latérale.
import { store } from './store.js';
import * as M from './model.js';
import {
  etat, onglets, definirOnglet, definirPage, demarrer, rendrePage, rendreCadre, rendreSurcouches,
  action, changerOnglet, pousser, h, icone, section, ligne, rafraichir,
} from './ui.js';
import { ouvrirFichier, traiterAdresse } from './entrees.js';

// Les écrans (chacun enregistre ses pages et ses actions)
import './ecrans/match.js';
import './ecrans/joueurs.js';
import './ecrans/presences.js';
import './ecrans/categories.js';
import './ecrans/historique.js';
import './ecrans/encadrement.js';
import './ecrans/cartons.js';
import './ecrans/saisons.js';
import './ecrans/reglages.js';
import './ecrans/atelier.js';

definirOnglet('match', { titre: 'Match', icone: 'sportscourt.fill', page: 'match.racine' });
definirOnglet('joueurs', { titre: 'Joueurs', icone: 'person.3.fill', page: 'joueurs.racine' });
definirOnglet('presences', { titre: 'Présences', icone: 'figure.run.circle.fill', page: 'presences.racine' });
definirOnglet('categories', { titre: 'Catégories', icone: 'person.2.badge.gearshape', page: 'categories.racine' });
definirOnglet('historique', { titre: 'Historique des matchs', icone: 'clock.arrow.circlepath', page: 'historique.racine' });
definirOnglet('encadrement', { titre: 'Encadrement', icone: 'person.badge.key.fill', page: 'encadrement.racine' });
definirOnglet('cartons', { titre: 'Cartons', icone: 'rectangle.fill', page: 'cartons.racine' });
definirOnglet('saisons', { titre: 'Saisons', icone: 'calendar.circle.fill', page: 'saisons.racine' });
definirOnglet('reglages', { titre: 'Réglages et Exports', icone: 'gearshape.fill', page: 'reglages.racine' });

const NB_ONGLETS_TELEPHONE = 4;

// « Plus » : les onglets qui ne tiennent pas dans la barre du téléphone (écran More d'iOS)
definirOnglet('plus', { titre: 'Plus', icone: 'ellipsis.circle.fill', page: 'plus.racine', cache: true });
definirPage('plus.racine', () => ({
  titre: 'Plus',
  grandTitre: true,
  contenu: section({
    lignes: onglets.filter((o) => !o.cache).slice(NB_ONGLETS_TELEPHONE)
      .map((o) => ligne({ titre: o.titre, icone: o.icone, chevron: true, action: 'plus.ouvrir', data: { onglet: o.id }, classe: 'avec-icone' })),
  }),
}));
action('plus.ouvrir', (el) => {
  const o = onglets.find((x) => x.id === el.dataset.onglet);
  if (o) pousser(o.page, {});
});

// MARK: - Rendu de la coque

const racine = document.getElementById('app');

function barreProfils() {
  if (store.profils.length <= 1) return '';
  return `<div class="barre-profils" role="tablist" aria-label="Catégories">${store.profils.map((p) => {
    const actif = p.id === store.profilActifId;
    return `<button type="button" role="tab" aria-selected="${actif}" class="puce-profil${actif ? ' actif' : ''}" style="--c:${M.couleur(M.couleurProfil(p.colorIndex))}"
      data-action="profil.basculer" data-id="${h(p.id)}"><span class="point"></span>${h(p.name)}</button>`;
  }).join('')}</div>`;
}
action('profil.basculer', (el) => store.basculerProfil(el.dataset.id));

function ongletVisible() {
  // Sur téléphone, un onglet au-delà du 4e s'affiche dans « Plus »
  return etat.onglet;
}

function rendreOnglet() {
  const o = onglets.find((x) => x.id === ongletVisible()) ?? onglets[0];
  const pile = etat.piles[o.id] ?? [];
  const haut = pile[pile.length - 1];
  const def = haut ? rendrePage(haut.page, haut.params) : rendrePage(o.page, {});
  return `<div class="couche couche-onglet" data-key="onglet-${h(o.id)}-${pile.length}">${rendreCadre(def, { retourPossible: pile.length > 0, libelleRetour: def.libelleRetour ?? (pile.length > 1 ? 'Retour' : o.titre) })}</div>`;
}

function rendreFeuilles() {
  return etat.feuilles.map((f, i) => {
    const haut = f.pile[f.pile.length - 1];
    const def = haut ? rendrePage(haut.page, haut.params) : rendrePage(f.page, f.params);
    const classes = `feuille${f.plein ? ' plein' : ''}${def.large ? ' large' : ''}`;
    return `<div class="couche-feuille" data-key="feuille-${i}-${h(f.page)}">
      ${f.plein ? '' : '<div class="voile-feuille"></div>'}
      <div class="${classes}" role="dialog" aria-modal="true">${rendreCadre(def, { retourPossible: f.pile.length > 0, feuille: true })}</div>
    </div>`;
  }).join('');
}

function barreOnglets() {
  const visibles = onglets.filter((o) => !o.cache).slice(0, NB_ONGLETS_TELEPHONE);
  const plus = onglets.find((o) => o.id === 'plus');
  const actif = visibles.some((o) => o.id === etat.onglet) ? etat.onglet : 'plus';
  return `<nav class="barre-onglets" aria-label="Onglets">${[...visibles, plus].map((o) => `
    <button type="button" class="onglet${o.id === actif ? ' actif' : ''}" data-action="onglet.choisir" data-onglet="${o.id}" aria-label="${h(o.titre)}">
      ${icone(o.icone)}<span>${h(o.titre)}</span></button>`).join('')}</nav>`;
}
action('onglet.choisir', (el) => {
  const id = el.dataset.onglet;
  // Depuis « Plus », un onglet secondaire ouvert en ordinateur reste accessible
  changerOnglet(id);
});

function barreLaterale() {
  return `<nav class="barre-laterale" aria-label="Sections">
    <div class="marque"><img src="icons/icon-192.png" alt=""><span>Temps De Jeu</span></div>
    ${onglets.filter((o) => !o.cache).map((o) => `<button type="button" class="entree-laterale${o.id === etat.onglet ? ' actif' : ''}" data-action="onglet.choisir" data-onglet="${o.id}">
      ${icone(o.icone)}<span>${h(o.titre)}</span></button>`).join('')}
    <p class="pied-lateral">Version web · gratuite<br>Données gardées sur cet appareil</p>
  </nav>`;
}

function shell() {
  const teinte = M.couleur(store.couleurActive());
  return `<div class="app${store.profils.length > 1 ? ' avec-profils' : ''}" style="--teinte:${teinte}">
    ${barreLaterale()}
    <div class="principal">
      ${barreProfils()}
      <div class="zone-pages">
        ${rendreOnglet()}
        ${barreOnglets()}
      </div>
    </div>
    ${rendreFeuilles()}
    ${rendreSurcouches()}
  </div>`;
}

// MARK: - Démarrage

store.ecouter(() => rafraichir());
demarrer(racine, shell);
store.chargerBibliotheque();
traiterAdresse();

// Couleur de la barre d'état du navigateur = teinte de la catégorie
// (theme-color reste celle du fond, comme une app iOS)

// Fichiers déposés sur la fenêtre (ordinateur)
let profondeurDepot = 0;
addEventListener('dragenter', (e) => { if (e.dataTransfer?.types?.includes('Files')) { profondeurDepot += 1; document.body.classList.add('depot-actif'); } });
addEventListener('dragleave', () => { profondeurDepot = Math.max(0, profondeurDepot - 1); if (!profondeurDepot) document.body.classList.remove('depot-actif'); });
addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
addEventListener('drop', (e) => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault();
  profondeurDepot = 0;
  document.body.classList.remove('depot-actif');
  ouvrirFichier(e.dataTransfer.files[0]);
});

// Fichiers ouverts avec l'app installée (Chrome, Edge : file_handlers du manifeste)
if ('launchQueue' in window) {
  window.launchQueue.setConsumer(async (params) => {
    for (const handle of params.files ?? []) ouvrirFichier(await handle.getFile());
  });
}

// Demande au navigateur de ne pas effacer les données
navigator.storage?.persist?.().catch(() => {});

// Hors ligne : service worker (pas en local, pour toujours voir la dernière version des fichiers)
const enLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && !enLocal) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Invitation « Installer » de Chrome / Edge (proposée dans Réglages)
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  etat.installation = e;
  rafraichir();
});

export { changerOnglet };
