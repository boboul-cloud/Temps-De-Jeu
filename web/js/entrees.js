// Ce qui arrive de l'extérieur : fichiers Temps De Jeu ouverts ou déposés (.tdjb, .tdj, .tdjm,
// .tdjt, .json), réponses au sondage de disponibilité (liens …/dispo.html?r=, tempsdejeu://a/),
// compositions partagées en lien web (#c=). Équivalent de DeepLinkManager + ContentView.
import * as M from './model.js';
import { store } from './store.js';
import { alerte, choix, changerOnglet, ouvrirFeuille, pageExiste, rafraichir } from './ui.js';

/** Récepteurs enregistrés par les écrans : type → fn(donnees) */
const recepteurs = {};
export function surReception(type, fn) { recepteurs[type] = fn; }

function transmettre(type, donnees) {
  const fn = recepteurs[type];
  if (fn) { fn(donnees); return true; }
  return false;
}

/**
 * Ouvre le texte d'un fichier Temps De Jeu, en devinant son contenu comme l'app native
 * (sauvegarde complète, composition, matchs, entraînements, joueurs, exercices).
 */
export function ouvrirTexte(texte, nomFichier = '') {
  const ext = (nomFichier.split('.').pop() ?? '').toLowerCase();
  const o = M.lireJSON(texte);
  if (o == null) { alerte("Erreur d'import", 'Format de fichier non reconnu.'); return; }
  if (ext === 'tdjt') { importerTactiques(o); return; }
  const sauvegarde = M.lireSauvegarde(o);
  if (sauvegarde) { if (!transmettre('sauvegarde', sauvegarde)) alerte('Import', 'Ouvrez Réglages et Exports ▸ Export / Import.'); return; }
  const composition = M.lireComposition(o);
  if (composition) { recevoirComposition(composition); return; }
  const matchs = M.lireMatchsJSON(o);
  if (matchs) { proposerImportMatchs(matchs); return; }
  const presences = M.lirePresencesJSON(o);
  if (presences) { changerOnglet('presences'); transmettre('entrainements', presences); return; }
  const joueurs = M.lireJoueursJSON(o);
  if (joueurs && joueurs.players.length) {
    recevoirComposition({
      teamName: '', competition: '', matchDate: M.iso(), selectedPlayers: [], availablePlayers: joueurs.players,
      unavailablePlayerIds: [], selectionChain: [], formatVersion: 1,
    });
    return;
  }
  try {
    if (M.lireFichierTactiques(o).length) { importerTactiques(o); return; }
  } catch { /* pas des tactiques */ }
  alerte("Erreur d'import", 'Format de fichier non reconnu.');
}

/** Lit un fichier (File) puis l'ouvre */
export async function ouvrirFichier(fichier) {
  try {
    ouvrirTexte(await fichier.text(), fichier.name);
  } catch {
    alerte("Erreur d'import", 'Impossible de lire le fichier.');
  }
}

function importerTactiques(o) {
  try {
    store.importerTactiques(o);
    if (pageExiste('atelier.accueil')) ouvrirFeuille('atelier.accueil', {}, { plein: true });
  } catch (e) {
    alerte("Erreur d'import", `Fichier tactique illisible : ${e.message}`);
  }
}

/** Composition reçue (cascade) : bascule sur la catégorie du code d'équipe, puis l'onglet Match */
export function recevoirComposition(roster) {
  if (roster.targetTeamCode) {
    const cible = store.profils.find((p) => p.teamCode.toUpperCase() === roster.targetTeamCode.toUpperCase());
    if (cible && cible.id !== store.profilActifId) store.basculerProfil(cible.id);
  }
  changerOnglet('match');
  if (!transmettre('composition', roster)) alerte('Composition reçue', `${roster.availablePlayers.length} joueurs disponibles.`);
}

// MARK: - Import de matchs (.tdjm) : fusion dans la bonne catégorie (ContentView)

function categorieCible(r) {
  if (r.teamCode) {
    const p = store.profils.find((x) => x.teamCode.toUpperCase() === r.teamCode.toUpperCase());
    if (p) return p;
  }
  if (r.teamName) {
    const p = store.profils.find((x) => M.comparer(x.name, r.teamName) === 0);
    if (p) return p;
  }
  return store.profilActif();
}

export function proposerImportMatchs(r) {
  const cible = categorieCible(r);
  const existants = store.matchs(cible?.id ?? store.profilActifId);
  const ids = new Set(existants.map((m) => m.id));
  const empreintes = new Set(existants.map(M.empreinteMatch));
  const nouveaux = r.matches.filter((m) => !ids.has(m.id) && !empreintes.has(M.empreinteMatch(m))).length;
  const deja = r.matches.length - nouveaux;
  const n = r.matches.length;
  const titre = `Importer ${n} match${n > 1 ? 's' : ''}`;
  const message = cible?.name
    ? `${n} match${n > 1 ? 's' : ''} → catégorie « ${cible.name} ».\n${nouveaux} nouveau${nouveaux > 1 ? 'x' : ''}, ${deja} déjà présent${deja > 1 ? 's' : ''}.`
    : `${nouveaux} nouveau${nouveaux > 1 ? 'x' : ''} match${nouveaux > 1 ? 's' : ''}, ${deja} déjà présent${deja > 1 ? 's' : ''}.`;
  choix({ titre, message, actions: [{ libelle: 'Fusionner (ajouter les nouveaux)', faire: () => importerMatchs(r) }] });
}

function importerMatchs(r) {
  const cible = categorieCible(r);
  if (!cible) { alerte('Erreur', 'Impossible de déterminer la catégorie cible.'); return; }
  const liste = store.matchs(cible.id);
  let ajoutes = 0; let maj = 0;
  for (const importe of r.matches) {
    const parId = liste.find((m) => m.id === importe.id);
    const parEmpreinte = liste.find((m) => M.empreinteMatch(m) === M.empreinteMatch(importe));
    if (parId || parEmpreinte) { M.fusionnerEvenements(parId ?? parEmpreinte, importe); maj += 1; }
    else { liste.unshift(importe); ajoutes += 1; }
  }
  store.enregistrerMatchs(liste, cible.id);
  alerte('Import réussi', `${ajoutes} match${ajoutes > 1 ? 's' : ''} ajouté${ajoutes > 1 ? 's' : ''}, ${maj} mis à jour${cible.name ? ` dans ${cible.name}` : ''}.`);
}

// MARK: - Réponse au sondage de disponibilité

/** Applique une réponse (lien ou message collé). Renvoie true si elle a été reconnue. */
export function recevoirReponse(texte) {
  const r = M.lireReponseSondage(texte);
  if (!r) { alerte('Réponse non reconnue', 'Collez le message reçu du joueur (il contient un lien vers la réponse).'); return false; }
  const res = store.recevoirReponseSondage(r);
  if (res.erreur) { alerte("Erreur d'import", res.erreur); return false; }
  changerOnglet('presences');
  const emoji = r.r === 1 ? '✅' : r.r === 0 ? '❌' : '🤔';
  let message = `${emoji} ${r.n} : ${M.reponse(r.r).label}`;
  if (r.c) message += `\n« ${r.c} »`;
  alerte('⚽ Réponse reçue', message);
  transmettre('reponse', res);
  rafraichir();
  return true;
}

/** Au lancement : lien de réponse (#r= / ?r=) ou composition (#c=) dans l'adresse */
export async function traiterAdresse() {
  const adresse = location.href;
  let traite = false;
  if (/[?#&]r=/.test(adresse)) { recevoirReponse(adresse); traite = true; }
  else if (/#c=/.test(adresse)) {
    const roster = await M.lireLienComposition(adresse);
    if (roster) recevoirComposition(roster); else alerte("Erreur d'import", 'Lien de composition illisible.');
    traite = true;
  }
  if (traite) history.replaceState(null, '', location.pathname);
}
