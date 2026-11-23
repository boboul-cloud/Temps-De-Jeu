// Onglet « Match » (ContentView, onglet 1) : préparation du match (MatchSetupView) tant que le match
// n'a pas commencé, puis le match en direct (MatchView). Feuilles : composition, maillots, score,
// cartons, remplacements, fautes, passes décisives, chronologie, statistiques, récapitulatif.
import { store } from '../store.js';
import { definirPage, action, ouvrirFeuille, alerte, rafraichir, etat } from '../ui.js';
import { surReception } from '../entrees.js';
import { vm, MatchViewModel, ETATS } from './match/vm.js';
import { rendrePreparation, processRosterImport, chargerPrep, prep, viderPrep } from './match/preparation.js';
import { rendreDirect } from './match/direct.js';
import './match/feuilles.js';
import './match/statistiques.js';
import './match/recap.js';

definirPage('match.racine', () => (vm.afficherMatch ? rendreDirect() : rendrePreparation()));

/** Le match est-il à l'écran (onglet Match ou une de ses feuilles) ? */
const matchVisible = () => etat.onglet === 'match' || etat.feuilles.some((f) => f.page.startsWith('match.'));

vm.surTic = () => { if (matchVisible()) rafraichir(); };
vm.surFinExpulsion = (nom) => {
  vm.showTempExpulsionEndAlert = false;
  alerte("Fin d'expulsion temporaire", `${nom} peut revenir sur le terrain !`);
};

// « Démarrer le match » : le match s'affiche et le chronomètre part (MatchView.onAppear)
action('match.demarrer', () => {
  vm.afficherMatch = true;
  if (vm.timerState.type === ETATS.idle) vm.startMatch();
  else vm.changer();
  rafraichir({ hautDePage: true });
});

// Changement de catégorie : le brouillon de l'ancienne est gardé, celui de la nouvelle est repris
let dernierProfil = store.profilActifId;
store.ecouter(() => {
  if (store.profilActifId === dernierProfil) return;
  const ancien = dernierProfil;
  dernierProfil = store.profilActifId;
  if (vm.afficherMatch || vm.afficherRecap) return;
  if (ancien && store.profils.some((p) => p.id === ancien)) {
    store.enregistrerBrouillon({
      match: vm.match, matchRoster: vm.matchRoster,
      unavailablePlayerIds: [...prep.unavailablePlayerIds], importChain: prep.importChain,
    }, ancien);
  }
  const brouillon = MatchViewModel.loadDraft();
  if (brouillon) {
    vm.match = brouillon.match;
    vm.matchRoster = brouillon.matchRoster;
    chargerPrep();
  } else {
    vm.resetMatch();
    viderPrep();
  }
});

// Composition reçue par fichier ou par lien (cascade entre catégories)
surReception('composition', (roster) => {
  processRosterImport(roster);
  rafraichir();
});

chargerPrep();
// Un récapitulatif était à l'écran quand la page a été rechargée
if (vm.afficherRecap) ouvrirFeuille('match.recap', { bloquerRetour: true }, { plein: true });
