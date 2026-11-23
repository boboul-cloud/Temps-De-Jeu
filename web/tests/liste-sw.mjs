// Met à jour la liste des fichiers mis en cache par sw.js (mode hors ligne) d'après le contenu du dossier web/.
// À lancer après avoir ajouté ou retiré un fichier : node tests/liste-sw.mjs (depuis web/).
// Penser aussi à incrémenter VERSION en tête de sw.js avant chaque mise en ligne.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXCLUS = new Set(['tests', 'README.md', 'wrangler.jsonc', '.assetsignore', '.wrangler', 'sw.js', 'index.html', '.DS_Store', 'node_modules']);

function parcourir(dossier, prefixe = '') {
  const res = [];
  for (const nom of fs.readdirSync(dossier).sort()) {
    if (EXCLUS.has(nom) || nom.endsWith('.app') || nom.startsWith('.')) continue;
    const chemin = path.join(dossier, nom);
    const rel = prefixe ? `${prefixe}/${nom}` : nom;
    if (fs.statSync(chemin).isDirectory()) res.push(...parcourir(chemin, rel));
    else res.push(rel);
  }
  return res;
}

const fichiers = ['./', ...parcourir(RACINE).map((f) => `./${f}`)];
const sw = path.join(RACINE, 'sw.js');
const texte = fs.readFileSync(sw, 'utf8');
const nouveau = texte.replace(/const APP_FILES = \[[\s\S]*?\];/, `const APP_FILES = [\n${fichiers.map((f) => `  '${f}',`).join('\n')}\n];`);
fs.writeFileSync(sw, nouveau);
console.log(`${fichiers.length} fichiers dans sw.js`);
