// Service worker de Temps De Jeu : l'application fonctionne hors ligne une fois ouverte.
// Changer VERSION à chaque mise en ligne pour que les appareils récupèrent les nouveaux fichiers.
// La liste se met à jour avec : node tests/liste-sw.mjs
const VERSION = 'tempsdejeu-web-1.0.0';

// La page d'accueil est mise en cache sous './' et non './index.html' : l'hébergement
// (Cloudflare) redirige /index.html vers /, et une réponse redirigée ne peut pas servir
// l'ouverture d'une page (le navigateur la rejette : écran d'erreur au deuxième lancement).
const APP_FILES = [
  './',
  './css/app.css',
  './css/atelier.css',
  './css/editeur.css',
  './css/historique.css',
  './css/joueurs.css',
  './css/match.css',
  './css/presences.css',
  './data/exercices.json',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './js/app.js',
  './js/dom.js',
  './js/ecrans/atelier/bibliotheque.js',
  './js/ecrans/atelier/diagramme.js',
  './js/ecrans/atelier/editeur-modele.js',
  './js/ecrans/atelier/editeur.js',
  './js/ecrans/atelier/lecteur.js',
  './js/ecrans/atelier/logique.js',
  './js/ecrans/atelier/placement.js',
  './js/ecrans/atelier/seance.js',
  './js/ecrans/atelier/sequences.js',
  './js/ecrans/atelier/terrain3d.js',
  './js/ecrans/atelier.js',
  './js/ecrans/cartons.js',
  './js/ecrans/categories.js',
  './js/ecrans/effectif/commun.js',
  './js/ecrans/effectif/logique.js',
  './js/ecrans/encadrement.js',
  './js/ecrans/historique/export-import.js',
  './js/ecrans/historique/guide.js',
  './js/ecrans/historique/imports.js',
  './js/ecrans/historique/legal.js',
  './js/ecrans/historique/liste.js',
  './js/ecrans/historique/rapport.js',
  './js/ecrans/historique.js',
  './js/ecrans/joueurs.js',
  './js/ecrans/match/commun.js',
  './js/ecrans/match/direct.js',
  './js/ecrans/match/feuilles.js',
  './js/ecrans/match/preparation.js',
  './js/ecrans/match/recap-texte.js',
  './js/ecrans/match/recap.js',
  './js/ecrans/match/statistiques.js',
  './js/ecrans/match/vm.js',
  './js/ecrans/match.js',
  './js/ecrans/presences/logique.js',
  './js/ecrans/presences/seance.js',
  './js/ecrans/presences/sondage.js',
  './js/ecrans/presences/stats.js',
  './js/ecrans/presences.js',
  './js/ecrans/reglages.js',
  './js/ecrans/saisons.js',
  './js/entrees.js',
  './js/icones.js',
  './js/model.js',
  './js/pdf.js',
  './js/rapports/atelier.js',
  './js/rapports/commun.js',
  './js/rapports/composition.js',
  './js/rapports/encadrement.js',
  './js/rapports/entrainements.js',
  './js/rapports/joueurs.js',
  './js/rapports/match.js',
  './js/rapports/stats.js',
  './js/store.js',
  './js/ui.js',
  './manifest.webmanifest',
  './vendor/three.LICENSE.txt',
  './vendor/three.module.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(APP_FILES.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Par précaution, une réponse issue d'une redirection est recopiée « à plat » avant d'être servie.
async function unredirected(response) {
  if (!response || !response.redirected) return response;
  const body = await response.blob();
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

// Cache d'abord (démarrage instantané, hors ligne), puis mise à jour du cache en arrière-plan.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === 'navigate';
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const key = isNavigation ? './' : request;
    const cached = await unredirected(await cache.match(key, { ignoreSearch: true }));
    const network = fetch(request)
      .then(async (response) => {
        if (response && response.ok && response.type === 'basic') {
          await cache.put(key, await unredirected(response.clone()));
        }
        return response;
      })
      .catch(() => null);
    if (cached) {
      event.waitUntil(network);
      return cached;
    }
    const fresh = await unredirected(await network);
    return fresh || new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
