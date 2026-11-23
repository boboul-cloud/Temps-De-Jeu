// « Mode d'emploi » (UserGuideView.swift) : mêmes sections et mêmes textes que l'app iPhone.
// Adapté au web seulement là où l'app iPhone dit autre chose que la version web :
// widget (section 15 → installation sur l'écran d'accueil), rappel par notification (section 14),
// achats (astuces), onglet « Autres » d'iOS (« Plus » sur téléphone).
import { definirPage, icone, h } from '../../ui.js';
import { couleur } from '../../model.js';

/** **gras** → <strong>, le reste échappé */
const gras = (texte) => h(texte).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

const SECTIONS = [
  { n: '1', titre: 'Créer son effectif', icone: 'person.3.fill', c: 'blue', etapes: [
    "Allez dans l'onglet **Joueurs**",
    'Appuyez sur **+** pour ajouter un joueur',
    'Renseignez le nom, prénom, numéro et position',
    'Vous pouvez importer un effectif existant via **Import JSON**',
  ] },
  { n: '2', titre: 'Préparer un match', icone: 'sportscourt.fill', c: 'green', etapes: [
    "Allez dans l'onglet **Match**",
    'Renseignez les équipes, la compétition et la date',
    'Appuyez sur **Sélectionner les joueurs**',
    'Cochez les joueurs convoqués pour ce match',
    "Le nombre de joueurs sélectionnés s'affiche en haut",
  ] },
  'cascade',
  { n: '4', titre: 'Pendant le match', icone: 'timer', c: 'orange', etapes: [
    'Appuyez sur **Démarrer le match**',
    'Le chrono démarre automatiquement',
    'Les joueurs **sur le terrain** sont en haut',
    'Les joueurs **remplaçants** sont en bas',
    'Le temps de jeu de chaque joueur est affiché',
  ] },
  { n: '5', titre: 'Faire un remplacement', icone: 'arrow.left.arrow.right', c: 'purple', etapes: [
    "Appuyez sur le bouton **Rempl.** en haut de l'écran de match",
    'Sélectionnez le **titulaire sortant** parmi la liste des titulaires',
    'Sélectionnez le **remplaçant entrant** parmi la liste des remplaçants',
    'Appuyez sur **Confirmer le remplacement**',
    'Le remplacement est enregistré avec le temps exact',
    "Consultez la **Timeline** pour voir l'historique",
  ] },
  { n: '6', titre: 'Enregistrer des événements', icone: 'flag.fill', c: 'red', etapes: [
    '**But** : Appuyez sur le score pour ajouter/retirer un but',
    '**Carton** : Appuyez sur un joueur → Carton jaune/rouge',
    '**Arrêt de jeu** : Appuyez sur ⏸️ pour mettre en pause',
    'Tous les événements apparaissent dans la **Timeline**',
  ] },
  { n: '7', titre: 'Mi-temps et fin de match', icone: 'clock.badge.checkmark.fill', c: 'teal', etapes: [
    'À la mi-temps, appuyez sur **Mi-temps**',
    'Le chrono se met en pause',
    'Appuyez sur **Reprendre** pour la 2ème mi-temps',
    'En fin de match, appuyez sur **Terminer**',
    "Le match est sauvegardé dans l'**Historique des matchs**",
  ] },
  { n: '8', titre: 'Consulter les statistiques', icone: 'chart.bar.fill', c: 'indigo', etapes: [
    "Allez dans l'onglet **Stats**",
    'Visualisez le temps de jeu par joueur',
    'Filtrez par période (saison, mois...)',
    'Exportez en **PDF** pour partager',
  ] },
  { n: '9', titre: 'Historique des matchs', icone: 'clock.arrow.circlepath', c: 'brown', etapes: [
    "Allez dans l'onglet **Historique des matchs**",
    'Retrouvez tous vos matchs passés',
    'Appuyez sur un match pour voir les détails',
    'Exportez le rapport PDF du match',
  ] },
  { n: '10', titre: 'Gérer les catégories', icone: 'rectangle.stack.fill', c: 'cyan', etapes: [
    "Allez dans l'onglet **Catégories**",
    "Créez vos catégories d'âge (U13, U15, Seniors…)",
    "Les joueurs sont créés dans **Joueurs** dans leur catégorie d'origine",
    "Dans **Catégories**, assignez des joueurs à d'autres catégories si nécessaire",
    'Chaque catégorie a ses propres **matchs**, **entraînements** et **statistiques**',
    "Un badge coloré signale les joueurs venant d'une autre catégorie",
  ] },
  { n: '11', titre: 'Joueurs inter-catégories', icone: 'person.2.badge.plus', c: 'orange', etapes: [
    "Un joueur a **une catégorie d'origine** (là où il est créé)",
    "Il peut être **assigné à d'autres catégories** pour les matchs",
    "Lors d'un entraînement, dépliez **Joueurs d'autres catégories** pour inviter des joueurs",
    "Les entraînements avec d'autres catégories sont comptés dans ses **statistiques de présence**",
    "Un joueur sélectionné dans un match d'une catégorie est **verrouillé** dans les autres",
  ] },
  { n: '12', titre: 'Présences aux entraînements', icone: 'figure.run.circle.fill', c: 'mint', etapes: [
    "Allez dans l'onglet **Présences**",
    'Appuyez sur **⋯** puis **Nouvel entraînement**',
    "Choisissez la **date** de l'entraînement",
    'Cochez les **joueurs présents** dans la liste',
    'Utilisez **Tout sélectionner** pour pointer rapidement',
    "Ajoutez une note optionnelle (thème de l'entraînement)",
    'Appuyez sur un entraînement pour le modifier ou **exporter en PDF**',
    'Pour **supprimer** un entraînement : bouton corbeille rouge sur sa ligne, avec confirmation',
    'Consultez les **Statistiques** pour voir le taux de présence par joueur',
    '**Exportez** les présences en PDF ou JSON sur une période',
  ] },
  { n: '13', titre: "Gérer l'encadrement", icone: 'person.badge.shield.checkmark.fill', c: 'brown', etapes: [
    "Allez dans l'onglet **Encadrement** (dans « Plus » sur téléphone)",
    'Appuyez sur **+** puis **Ajouter un encadrant**',
    'Renseignez le **nom**, **prénom**, **rôle**, **téléphone** et **email**',
    'Ajoutez une **photo** pour identifier facilement chaque encadrant',
    '**8 rôles prédéfinis** : Coach, Adjoint, Arbitre, Délégué, Préparateur physique, Entraîneur des gardiens, Intendant, Responsable médical',
    'Créez vos propres rôles via **Gérer les rôles** dans le menu **+**',
    'Assignez un encadrant à **plusieurs catégories** depuis sa fiche',
    "**Appelez directement** un encadrant en appuyant sur l'icône téléphone ou par le bouton **⋯**",
    'Supprimez un encadrant par le bouton **⋯** de sa ligne ou depuis sa fiche',
  ] },
  { n: '14', titre: 'Sondage de disponibilité', icone: 'paperplane.fill', c: 'orange', etapes: [
    'Ouvrez un entraînement existant et appuyez sur **Sondage disponibilité**',
    '**Partagez le lien** à vos joueurs via WhatsApp, SMS, iMessage…',
    "Les joueurs répondent depuis **n'importe quel téléphone** (iPhone ou Android)",
    'Les réponses apparaissent : **Présent**, **Absent** ou **Incertain** — dans la version web, touchez le lien reçu du joueur ou **collez sa réponse** dans Présences',
    'Appuyez sur **Appliquer aux présences** pour reporter automatiquement les réponses',
    "Les joueurs ajoutés après la création de l'entraînement sont **intégrés automatiquement**",
  ] },
  { n: '15', titre: "Sur l'écran d'accueil", icone: 'square.grid.2x2.fill', c: 'blue', etapes: [
    "Sur iPhone et iPad : ouvrez l'adresse dans **Safari**, puis **Partager** › **Sur l'écran d'accueil**",
    "Sur Android : menu du navigateur › **Installer l'application** (ou **Ajouter à l'écran d'accueil**)",
    "Sur ordinateur : **Installer** dans Chrome ou Edge, ou **Réglages et Exports › Installer l'application**",
    "L'app s'ouvre alors en plein écran, avec son icône, et fonctionne **hors ligne**",
    "Le widget **Prochain événement** n'existe que dans l'app iPhone et iPad",
  ] },
  { n: '16', titre: 'Placement 3D et tactiques', icone: 'cube.transparent.fill', c: 'teal', etapes: [
    'Dans **Match › Placement**, basculez sur **3D** pour voir votre composition sur un terrain en relief',
    'Glissez un joueur ou le ballon pour le déplacer ; faites pivoter et zoomez la caméra ailleurs sur le terrain',
    'Changez de point de vue : **Coach**, **Tribune**, **Dessus** ou **Immersion**',
    'Créez une **séquence pas à pas** : placez joueurs et ballon, validez la **Mise en place**, puis une action par étape',
    "**Course** : déplacez un joueur sans ballon · **Conduite** : déplacez le porteur, le ballon suit · **Passe** : glissez le ballon sur un partenaire · **Tir** : glissez-le dans le but · **En l'air** pour un centre",
    "Les flèches s'affichent **avant** de valider : vous voyez ce qui sera enregistré. Touchez un numéro d'étape pour la corriger",
    "▶︎ **Lire la démonstration** : joueurs et ballon s'animent d'une étape à l'autre, avec vos consignes",
    "Pour les exercices d'entraînement, utilisez plutôt l'**Atelier** (section suivante)",
    'Partagez ou importez des tactiques au format **.tdjt** (fichier JSON lisible) par la feuille de partage du téléphone (Messages, WhatsApp, e-mail…) ou en téléchargeant le fichier sur ordinateur',
  ] },
  { n: '17', titre: "Atelier d'exercices", icone: 'square.and.pencil', c: 'green', etapes: [
    "Onglet **Présences › Atelier** (ou Placement › Atelier d'exercices) : l'Atelier s'ouvre en plein écran",
    "**Nouvel exercice** : choisissez un élément dans le tiroir du bas (joueur, gardien, ballon, plot, coupelle, piquet, mannequin, mini-but, but, zone, ligne de plots, cerceau, échelle, haie, ballons) puis **touchez le terrain** : l'outil reste actif pour en poser plusieurs",
    '✨ **Raccourcis** : carré de plots, rondo, jeu 4 contre 4 avec mini-buts, slalom… posés en un geste',
    'Touchez un objet pour le régler : **8 couleurs** de chasubles et de matériel, numéro, gardien, tourner, copier, enlever. Glissez-le pour le déplacer',
    "**Étapes** : « + Étape » copie la précédente ; déplacez les joueurs, **glissez le ballon sur un partenaire** pour une passe (Passe, Centre ou Tir). Les flèches se tracent toutes seules, la position d'avant reste en transparence",
    "**Plusieurs ballons** : l'outil **Ballon** reste actif, chaque touche pose un ballon de plus (un par binôme, un par joueur…) ; chacun se passe et se conduit séparément. **Ballon posé** sert aux ballons qui attendent au sol",
    '▶︎ **Aperçu** sur le terrain, ou **Cinéma** : la 3D en plein écran, avec la consigne en sous-titre',
    '**Évolutions** : « + Évolution » repart du même terrain pour une variante (2 touches maximum, un défenseur en plus…)',
    '**Fiche** : objectif, consignes et **matériel à prévoir calculé tout seul** (« 12 plots jaunes, 6 chasubles rouges… »), fiche PDF à imprimer',
    '**Séances** : enchaînez des exercices minutés ; le matériel total se calcule, et **Faire les équipes** répartit les joueurs pointés présents par couleur de chasuble. Pour supprimer une séance : **Supprimer la séance** en bas de sa page, ou la corbeille de sa ligne dans la liste',
    "**Enregistrement automatique** : l'exercice s'enregistre au fur et à mesure (« Enregistré » s'affiche sous son nom), même si l'app est fermée. **Enregistrer** le range dans « Mes exercices » et revient à l'Atelier. Les séances s'enregistrent aussi toutes seules",
    "↶ Annuler / ↷ Rétablir à tout moment ; sur ordinateur : ⌘Z (Ctrl+Z hors Mac), ⇧⌘Z pour rétablir, ⌘S pour enregistrer, espace pour l'aperçu, ⌫ pour enlever",
  ] },
];

const ASTUCES = [
  ['icloud.fill', 'Vos données sont sauvegardées automatiquement dans ce navigateur, sur votre appareil'],
  ['arrow.clockwise', "Changez d'appareil avec la sauvegarde complète (.tdjb) de Réglages et Exports : le même fichier s'ouvre dans l'app iPhone"],
  ['square.and.arrow.up', 'Exportez régulièrement votre effectif en JSON pour avoir une sauvegarde'],
  ['person.crop.circle.badge.plus', 'Ajoutez une photo à vos joueurs pour les identifier plus facilement'],
];

function section(s) {
  return `<section class="guide-section" style="--c:${couleur(s.c)}">
    <div class="guide-tete">
      <span class="guide-numero">${h(s.n)}</span>
      <span class="guide-titres"><b>${h(s.titre)}</b><small>${icone(s.icone)}${s.icone === 'timer' ? ' Onglet Match' : ''}</small></span>
    </div>
    <ul class="guide-etapes">${s.etapes.map((e) => `<li><span class="guide-coche">${icone('checkmark.circle.fill')}</span><span>${gras(e)}</span></li>`).join('')}</ul>
  </section>`;
}

const cascadeEtape = (n, texte) => `<li><span class="guide-cascade-n">${n}</span><span>${gras(texte)}</span></li>`;
const boutonPartage = (ic, libelle, c, desc) =>
  `<span class="guide-partage" style="--c:${couleur(c)}"><span class="guide-partage-pilule">${icone(ic)}<b>${h(libelle)}</b></span><small>${h(desc)}</small></span>`;

function cascade() {
  return `<section class="guide-section" style="--c:${couleur('cyan')}">
    <div class="guide-tete">
      <span class="guide-numero">3</span>
      <span class="guide-titres"><b>Système Cascade</b><small>${icone('arrow.triangle.branch')} Pour clubs multi-catégories</small></span>
    </div>
    <p class="guide-texte">Idéal pour les clubs avec plusieurs catégories (Seniors, U15A, U15B, U13...) :</p>
    <ol class="guide-cascade">
      ${cascadeEtape('1', 'La catégorie **Seniors** sélectionne ses joueurs')}
      ${cascadeEtape('2', 'Elle exporte les **joueurs disponibles** via le bouton Partager')}
      ${cascadeEtape('3', 'La catégorie **U15A** importe le fichier → les joueurs pris par les Seniors sont marqués indisponibles')}
      ${cascadeEtape('4', 'U15A sélectionne ses joueurs et exporte pour **U15B**, etc.')}
    </ol>
    <div class="guide-partages">
      ${boutonPartage('doc.fill', 'Fichier', 'green', 'Fichier .tdj')}
      ${boutonPartage('link', 'Lien', 'blue', 'Lien web à envoyer')}
      ${boutonPartage('doc.richtext', 'PDF', 'red', 'Pour imprimer')}
    </div>
  </section>`;
}

definirPage('guide', () => ({
  titre: "Mode d'emploi",
  libelleRetour: 'Retour',
  contenu: `<div class="lecture guide">
    <div class="guide-intro">
      <div class="guide-bienvenue"><span class="guide-ballon">⚽</span><span><small>Bienvenue dans</small><b>Temps De Jeu</b></span></div>
      <p class="secondaire">Cette application vous aide à gérer équitablement le temps de jeu de vos joueurs pendant les matchs de football, les entraînements et bien plus encore.</p>
    </div>
    ${SECTIONS.map((s) => `<hr class="guide-filet">${s === 'cascade' ? cascade() : section(s)}`).join('')}
    <hr class="guide-filet">
    <section class="guide-astuces">
      <div class="guide-tete"><span class="guide-numero astuce">${icone('lightbulb.fill')}</span><span class="guide-titres"><b>Astuces</b></span></div>
      <ul>${ASTUCES.map(([ic, t]) => `<li><span class="guide-astuce-icone">${icone(ic)}</span><span>${h(t)}</span></li>`).join('')}</ul>
    </section>
  </div>`,
}));
