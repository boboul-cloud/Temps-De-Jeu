# Temps De Jeu — version web (PWA)

La même application que Temps De Jeu pour iPhone et iPad, dans un navigateur : préparation du match
et composition, chronomètre avec arrêts de jeu et temps additionnel, temps de jeu de chaque joueur,
remplacements, cartons (carton blanc compris), statistiques, présences aux entraînements et sondage de
disponibilité, encadrement, saisons, exports PDF et JSON, bibliothèque d'exercices animés en 3D,
Atelier et séances. Elle s'installe sur l'écran d'accueil (iPhone, Android, ordinateur) et fonctionne
ensuite **hors ligne**. **Tout est gratuit** : pas de limite de matchs, pas d'achat, pas de compte.

**En ligne : https://tempsdejeu.riskelo-salon.workers.dev**

Aucune étape de compilation : ce dossier se publie tel quel sur un hébergement statique.

## Lancer en local

Double-clic sur **Temps De Jeu Web.app** (dans ce dossier) : il démarre un petit serveur sur le port
8658 et ouvre l'app dans le navigateur. Ou à la main :

```bash
cd ~/Desktop/"temps de jeu"/"Temps De Jeu"/web
python3 -m http.server 8658
# puis ouvrir http://localhost:8658
```

Un serveur est nécessaire (les modules JS ne marchent pas en `file://`). En local, le mode hors ligne
(service worker) est volontairement désactivé, pour toujours voir la dernière version des fichiers.
Les données enregistrées en local (port 8658) et en ligne sont **distinctes** : chaque adresse a son
propre stockage. Passez de l'une à l'autre par la sauvegarde complète (`.tdjb`).

Données de démonstration (local) : dans la console du navigateur,
`await (await import('/tests/graine.js')).semer()` — remplace les données par une catégorie U13 de
démonstration (le dossier `tests/` n'est pas mis en ligne).

## Mettre en ligne / installer

Même méthode que BobSurface : le dossier est publié tel quel sur Cloudflare (Workers, fichiers statiques).

```bash
cd ~/Desktop/"temps de jeu"/"Temps De Jeu"/web
node --test               # d'abord : les tests doivent passer
node tests/liste-sw.mjs   # si des fichiers ont été ajoutés ou retirés
npx wrangler deploy
```

Pour publier une mise à jour : incrémente `VERSION` en tête de `sw.js` (sinon les appareils déjà
installés gardent l'ancienne version), puis relance `npx wrangler deploy`.
`.assetsignore` liste les fichiers locaux qui ne sont pas mis en ligne (README, tests, lanceur,
configuration).

Installer sur iPhone : ouvrir l'adresse dans **Safari**, puis **Partager** ▸ **Sur l'écran d'accueil**.
L'app s'ouvre alors en plein écran, avec son icône, et démarre sans réseau. Sur Android et ordinateur,
Chrome et Edge proposent « Installer l'application » (aussi dans **Réglages et Exports ▸ Installer
l'application**). Installée avec Chrome ou Edge sur ordinateur, l'app ouvre directement les fichiers
`.tdjb`, `.tdj`, `.tdjm` et `.tdjt`.

## Données

- Tout est enregistré dans le navigateur (`localStorage`), sur cet appareil uniquement : rien n'est
  envoyé sur internet. Les clés reprennent celles de l'app native (`teamPlayers`, `teamProfiles`,
  `profile_<UUID>_savedMatches`…), préfixées par `tdj.`. Safari peut effacer les données d'un site non
  installé resté inutilisé plusieurs semaines : installez l'app sur l'écran d'accueil, et faites
  régulièrement une sauvegarde complète.
- **Réglages et Exports ▸ Export / Import ▸ Sauvegarde complète** produit un fichier `.tdjb` au
  **même format que l'app native** : il s'importe dans Temps De Jeu pour iPhone et iPad, et
  inversement. L'import remplace toutes les données, après confirmation.
- Les autres fichiers sont aussi ceux de l'app : composition `.tdj` (cascade A → B → C), matchs
  `.tdjm`, joueurs et encadrement `.json`, présences `.json`, exercices `.tdjt`. On les ouvre par
  **Réglages et Exports ▸ Ouvrir un fichier Temps De Jeu**, par glisser-déposer sur la fenêtre, ou
  depuis l'écran qui les concerne.
- Format de la sauvegarde complète (`ExportService.FullBackup` côté Swift) :
  `{ version: 1, exportDate, appVersion, players, staffMembers, staffRoles, profilesData: [{ profile,
  matches, trainingSessions, currentSeason?, seasonArchives }], tactics, trainingPlans }`.
  Dates ISO 8601 sans fractions de seconde, identifiants UUID en majuscules, valeurs absentes omises ;
  exercices et séances de l'Atelier au format des fichiers `.tdjt` (clés françaises, points `[x, y]`).
- Vérifié pour de vrai : `tests/echange-swift.test.mjs` compile les modèles Swift de l'app
  (`Temps De Jeu/Models/*.swift`) avec `swiftc`, leur fait lire chaque fichier écrit par le web, le
  réécrire, puis le web relit ce fichier : contenu identique.

## Ce qui change par rapport au natif

| | iPhone (Swift) | Web |
|---|---|---|
| Prix | 5 matchs gratuits, puis achat unique Premium | tout est gratuit, sans limite |
| Navigation | `TabView` de 9 onglets | téléphone : 4 onglets + « Plus » ; au-delà de 860 px : barre latérale avec les 9 |
| Stockage | `UserDefaults` et fichiers de l'app | `localStorage` du navigateur ; même fichier de sauvegarde `.tdjb` |
| Fichiers reçus (`.tdjb`, `.tdj`, `.tdjm`, `.tdjt`) | ouverts depuis Messages, Mail, AirDrop | Réglages ▸ Ouvrir un fichier, glisser-déposer, ou app installée (Chrome, Edge) |
| Lien de composition (cascade) | `tempsdejeu://r/…` (compression LZFSE) | fichier `.tdj` (lu par l'iPhone) et lien web `…workers.dev/#c=…` ; le lien `tempsdejeu://` de l'iPhone ne s'ouvre pas dans le web : demander le fichier |
| Sondage de disponibilité | feuille Messages intégrée | lien `sms:` (plusieurs destinataires), WhatsApp, Copier |
| Réponses au sondage | le lien reçu ouvre l'app | bouton « Ouvrir la version web » de la page de réponse, ou « Coller une réponse reçue » |
| PDF | `UIGraphicsPDFRenderer` | même contenu, PDF écrit à la main (`js/pdf.js`, polices standard) ; les emoji ne sont pas imprimés |
| Partage | feuille de partage iOS | Web Share sur téléphone, téléchargement ou copie sur ordinateur |
| Match en direct | chronomètre de l'app | même calcul (horodatages), match en cours sauvegardé en continu et repris si la page se recharge ; écran gardé allumé (Wake Lock) |
| Vue 3D | SceneKit | Three.js (même stade, ombres, caméras et formules) ; glisser pour tourner, molette ou pincement pour zoomer ; pas de déplacement à deux doigts ni de VoiceOver sur les joueurs 3D |
| Glisser pour supprimer, menus contextuels (appui long) | gestes iOS | boutons visibles : corbeille, « ⋯ » (Blessé, Absent, Suspendu, Appeler, Supprimer…), « Modifier » puis rond rouge dans l'historique, « Purger » pour un carton |
| Menus de l'Atelier (cadrage, raccourcis), ordre d'une séance | menus et glisser | panneau dans l'éditeur ; « Réordonner » avec flèches ↑ ↓ |
| Raccourcis clavier de l'Atelier | ⌘Z, ⇧⌘Z, ⌘S, espace, ⌫ | les mêmes (Ctrl hors Mac) ; enregistrement automatique aussi quand la page passe en arrière-plan |
| Calendrier (entraînements) | sélecteur iOS | champs Date et Heure |
| Rappel de sondage « demain à 9 h » | notification locale | retiré (pas de notifications) |
| Envoi individuel du sondage | Messages, un joueur après l'autre | « Envoyer à tous par SMS » ouvre les SMS un par un (SMS 1/7…), ou WhatsApp, ou Copier |
| Fiches qui s'ouvraient à mi-hauteur | feuille moyenne | feuille pleine hauteur |
| Placement | fermer en glissant la feuille vers le bas | bouton ✕ « fermer sans enregistrer » |
| Textes légaux, mode d'emploi | achats intégrés, widget, gestes | version web gratuite, stockage dans le navigateur, installation sur l'écran d'accueil, boutons |
| Notifications, widget, vibrations | oui | non |

## Tests

```bash
cd web
node --test        # calculs, textes, formats d'échange, aller-retour avec les modèles Swift (si swiftc est là)
```

## Organisation

```
index.html              page unique, métadonnées iPhone
manifest.webmanifest    installation (nom, icônes, mode autonome, fichiers ouverts par l'app)
sw.js                   mode hors ligne (pré-cache versionné ; liste : node tests/liste-sw.mjs)
wrangler.jsonc          publication Cloudflare (npx wrangler deploy)
.assetsignore           fichiers locaux exclus de la mise en ligne
Temps De Jeu Web.app    lanceur local (serveur sur le port 8658)
css/app.css             interface façon iOS (listes groupées, couleurs système, clair / sombre)
css/<zone>.css          styles propres à chaque groupe d'écrans
js/model.js             cœur : port fidèle des modèles Swift (Models/*.swift), calculs, formats d'échange
js/store.js             données : équivalent des gestionnaires Swift (catégories, joueurs, matchs, entraînements…)
js/ui.js                navigation (onglets, piles, feuilles), dialogues dessinés, composants, partage, aperçu PDF
js/dom.js               mise à jour de l'écran sans perdre le champ en cours de saisie
js/pdf.js               écriture des PDF
js/entrees.js           fichiers et liens reçus (sauvegarde, composition, matchs, réponses au sondage)
js/icones.js            pictogrammes (équivalents des SF Symbols)
js/app.js               la coque : onglets, barre latérale, catégories
js/ecrans/              les écrans (match, joueurs, présences, catégories, historique, encadrement,
                        cartons, saisons, réglages, atelier)
js/rapports/            les PDF (composition, joueurs, match, statistiques, présences, encadrement, Atelier)
data/exercices.json     bibliothèque d'exercices (copie de TactiquesEntrainement.json)
vendor/                 three.js (licence MIT)
icons/                  icônes générées depuis l'icône de l'app native
tests/                  tests Node, données de démonstration, vérification Swift
```
