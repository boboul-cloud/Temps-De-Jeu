// Échange avec l'app native, vérifié pour de vrai : les modèles Swift de l'app (Models/*.swift)
// sont compilés avec swiftc (UIKit retiré d'AtelierModels.swift), lisent chaque fichier écrit
// par le web, le réécrivent avec JSONEncoder (.iso8601), puis le web relit ce fichier : contenu identique.
// Sauté si swiftc est absent. cd web && node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as M from '../js/model.js';
import { store } from '../js/store.js';
import { semer } from './graine.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const MODELES = path.join(ICI, '..', '..', 'Temps De Jeu', 'Models');
const FICHIERS = ['PlayerModels', 'MatchModels', 'StoppageType', 'TeamProfile', 'SeasonModels', 'StaffModels',
  'TrainingModels', 'TrainingPlanModels', 'TacticModels', 'AtelierModels'];
const swiftc = spawnSync('xcrun', ['--find', 'swiftc'], { encoding: 'utf8' }).status === 0;

let programme = null;
function compiler() {
  if (programme) return programme;
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'tdj-swift-'));
  for (const f of FICHIERS) {
    let source = fs.readFileSync(path.join(MODELES, `${f}.swift`), 'utf8');
    if (f === 'AtelierModels') {
      source = source.replace('import UIKit\n', '')
        .replace(/ {4}var uiColor: UIColor \{[\s\S]*?\n {4}\}\n/, '')
        .replace('    var color: Color { Color(uiColor: uiColor) }\n', '')
        .replace('    var textUIColor: UIColor { isLight ? .black : .white }\n', '');
    }
    fs.writeFileSync(path.join(dossier, `${f}.swift`), source);
  }
  fs.copyFileSync(path.join(ICI, 'swift', 'main.swift'), path.join(dossier, 'main.swift'));
  programme = path.join(dossier, 'aller-retour');
  execFileSync('xcrun', ['swiftc', '-O', '-o', programme, ...fs.readdirSync(dossier).filter((f) => f.endsWith('.swift')).map((f) => path.join(dossier, f))],
    { stdio: 'pipe' });
  return programme;
}

const ENSEMBLES = new Set(['playerIds', 'profileIds']);   // Set<UUID> : sans ordre
const trier = (v, cle = '') => (Array.isArray(v) ? (ENSEMBLES.has(cle) ? [...v].sort() : v.map((x) => trier(x)))
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, trier(v[k], k)])) : v);

function allerRetour(mode, texte) {
  const dossier = path.dirname(compiler());
  const entree = path.join(dossier, `web-${mode}.json`);
  const sortie = path.join(dossier, `swift-${mode}.json`);
  fs.writeFileSync(entree, texte);
  const args = mode === 'sauvegarde' ? [entree, sortie] : [mode, entree, sortie];
  execFileSync(programme, args, { stdio: 'pipe' });
  return fs.readFileSync(sortie, 'utf8');
}

async function donnees() {
  semer();
  await store.chargerBibliotheque(fs.readFileSync(path.join(ICI, '..', 'data', 'exercices.json'), 'utf8'));
  const copie = store.dupliquer(store.bibliotheque.find((t) => t.evolutions?.length) ?? store.bibliotheque[0]);
  copie.cadrage = { x: 0.1, y: 0.2, largeur: 0.5, longueur: 0.4 };
  store.enregistrerTactique(copie);
}

test('UUID stables identiques à Swift', { skip: !swiftc }, () => {
  const sortie = execFileSync(compiler(), ['stable', 'biblio-rondo-4c2', 'biblio-pressing-haut']).toString().trim().split('\n');
  assert.deepEqual(sortie, [M.uuidStable('biblio-rondo-4c2'), M.uuidStable('biblio-pressing-haut')]);
});

test('sauvegarde complète : web → Swift → web identique', { skip: !swiftc }, async () => {
  await donnees();
  const web = store.exporterSauvegarde();
  const swift = allerRetour('sauvegarde', web);
  assert.ok(M.lireSauvegarde(JSON.parse(swift)));
  assert.deepEqual(trier(JSON.parse(swift)), trier(JSON.parse(web)));
});

test('autres fichiers : composition, matchs, joueurs, encadrement, présences, exercices, séances', { skip: !swiftc }, async () => {
  await donnees();
  const profil = store.profilActif();
  const joueurs = store.joueurs();
  const seances = store.seances();
  const cas = {
    roster: [M.ecrireComposition(M.composerExportComposition({
      allPlayers: joueurs, selectedPlayerIds: joueurs.slice(0, 9).map((j) => j.id), teamName: 'Équipe A', competition: 'Coupe',
      matchDate: new Date(), previousUnavailableIds: [joueurs[13].id], previousChain: ['Élite'], targetTeamCode: 'Q7RT2B',
    })), M.lireComposition],
    matches: [M.ecrireMatchsJSON(store.matchs(), profil), M.lireMatchsJSON],
    players: [M.ecrireJoueursJSON(joueurs, profil), M.lireJoueursJSON],
    staff: [M.ecrireEncadrementJSON(store.encadrants(), store.roles(), profil), M.lireEncadrementJSON],
    training: [M.ecrirePresencesJSON(seances, M.calculatePlayerStats(seances), new Date(2026, 8, 1), new Date()), M.lirePresencesJSON],
    tactics: [M.ecrireFichierTactiques(store.bibliotheque.map((t) => ({ ...t, perso: true }))), (o) => M.lireFichierTactiques(o).length === 12],
    draft: [JSON.stringify(store.plans()), (o) => o.map(M.lirePlan).length === 1],
  };
  for (const [mode, [texte, relire]] of Object.entries(cas)) {
    const swift = allerRetour(mode, texte);
    assert.ok(relire(JSON.parse(swift)), `${mode} relu par le web`);
    assert.deepEqual(trier(JSON.parse(swift)), trier(JSON.parse(texte)), mode);
  }
});
