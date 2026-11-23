// Atelier plein écran (TacticsLibraryView.swift) : mes exercices, mes séances et la
// bibliothèque d'exercices animés ; import / export de fichiers .tdjt.
// ouvrirFeuille('atelier.accueil', { palette?, roster? }, { plein: true })
import { store } from '../../store.js';
import { categorieTactique, CATEGORIES_TACTIQUES, resumeTactique, ecrireFichierTactiques, nouveauPlan, couleur } from '../../model.js';
import {
  definirPage, action, rafraichir, fermerFeuille, ouvrirFeuille, pousser, boutonBarre, section, ligne, segmente,
  vide, alerte, choix, partager, choisirFichier, apercuPDF, pageExiste, h, icone,
} from '../../ui.js';
import { diagrammeHTML } from './diagramme.js';
import { ficheExercicePDF } from '../../rapports/atelier.js';
import { correspond, resumeCarte, resumeSeance, titreNouvelleSeance, nouvelExercice, nomFichierTactiques, TEINTE_CATEGORIE } from './logique.js';

const ONGLETS = [['exercices', 'Mes exercices'], ['seances', 'Séances'], ['bibliotheque', 'Bibliothèque']];

let courant = null;
const accueil = () => courant;

definirPage('atelier.accueil', (p) => {
  p.onglet ??= 'exercices';
  p.recherche ??= '';
  courant = p;
  let contenu = '';
  if (p.onglet === 'exercices') contenu = ongletExercices(p);
  else if (p.onglet === 'seances') contenu = ongletSeances();
  else contenu = ongletBibliotheque(p);
  return {
    titre: 'Atelier',
    gauche: boutonBarre({ libelle: 'Fermer', action: 'atelier.fermer' }),
    droite: boutonBarre({ icone: 'ellipsis.circle', titre: 'Importer / exporter', action: 'atelier.menu' }),
    classe: 'atelier-accueil',
    contenu: `<div class="colonne-large">
      ${segmente({ valeur: p.onglet, options: ONGLETS, action: 'atelier.onglet' })}
      <label class="recherche">${icone('magnifyingglass')}<input type="search" placeholder="Rechercher un exercice" value="${h(p.recherche)}"
        data-input="atelier.recherche" data-key="atelier-recherche" aria-label="Rechercher un exercice" autocomplete="off"></label>
      ${contenu}
    </div>`,
  };
});

// MARK: - Mes exercices

function ongletExercices(p) {
  const miens = store.tactiquesPerso().filter((t) => correspond(t, p.recherche));
  const nouveau = `<button type="button" class="nouvel-exercice" data-action="atelier.nouveau">
    <span class="nouvel-exercice-plus">${icone('plus')}</span>
    <span class="nouvel-exercice-textes"><b>Nouvel exercice</b><span>Terrain, matériel, chasubles et étapes animées</span></span>
  </button>`;
  if (!miens.length) {
    return `${nouveau}<div class="atelier-vide">
      <b>${p.recherche.trim() ? 'Aucun exercice trouvé' : "Aucun exercice pour l'instant"}</b>
      <p>Partez de zéro, ou ouvrez la Bibliothèque et touchez « Copier dans mes exercices » pour en adapter un.</p>
    </div>`;
  }
  return `${nouveau}<div class="grille-exercices">${miens.map(carteExercice).join('')}</div>`;
}

function carteExercice(t) {
  return `<div class="carte-exercice" data-key="carte-${h(t.id)}">
    <button type="button" class="carte-diagramme" data-action="atelier.modifier" data-id="${h(t.id)}" aria-label="Modifier ${h(t.titre)}">
      ${diagrammeHTML(t, { rotation: false, cle: `diag-carte-${t.id}` })}
    </button>
    <div class="carte-corps">
      <b class="carte-titre">${h(t.titre)}</b>
      <span class="carte-resume">${h(resumeCarte(t))}</span>
      <div class="carte-boutons">
        <button type="button" class="bouton teinte petit" data-action="atelier.modifier" data-id="${h(t.id)}">Modifier</button>
        <button type="button" class="bouton teinte petit" style="--bouton:var(--violet)" data-action="atelier.cinema" data-id="${h(t.id)}" aria-label="Cinéma">${icone('play.fill')}</button>
        <span class="espace"></span>
        <button type="button" class="bouton-plus" data-action="atelier.menuExercice" data-id="${h(t.id)}" aria-label="Plus d'actions">${icone('ellipsis.circle')}</button>
      </div>
    </div>
  </div>`;
}

// MARK: - Séances

function ongletSeances() {
  const plans = store.plans();
  return `${section({
    lignes: [ligne({ titre: 'Nouvelle séance', icone: 'calendar.badge.plus', action: 'atelier.nouvelleSeance', teinte: true, classe: 'avec-icone gras' })],
    pied: 'Enchaînez vos exercices, minutez-les : la liste du matériel se fait toute seule, et les équipes se composent avec les joueurs présents.',
  })}
  ${plans.length ? section({
    entete: 'Mes séances',
    lignes: plans.map((plan) => `<div class="ligne ligne-seance" data-key="seance-${h(plan.id)}">
      <button type="button" class="ligne-seance-corps" data-action="atelier.ouvrirSeance" data-id="${h(plan.id)}">
        <span class="ligne-textes"><span class="ligne-titre gras">${h(plan.titre)}</span><span class="ligne-sous-titre">${h(resumeSeance(plan))}</span></span>
        <span class="ligne-chevron">${icone('chevron.right')}</span>
      </button>
      <button type="button" class="ligne-supprimer" data-action="atelier.supprimerSeance" data-id="${h(plan.id)}" aria-label="Supprimer">${icone('trash')}</button>
    </div>`),
  }) : ''}`;
}

// MARK: - Bibliothèque

function ongletBibliotheque(p) {
  const groupes = CATEGORIES_TACTIQUES.map((c) => [c, store.bibliotheque.filter((t) => t.categorie === c.id && correspond(t, p.recherche))])
    .filter(([, liste]) => liste.length);
  const entete = `<div class="entete-bibliotheque">
    <span class="entete-bibliotheque-icone">${icone('books.vertical.fill')}</span>
    <span><b>Exercices prêts à l'emploi</b><span>Touchez pour les voir en 3D. « Copier » les place dans vos exercices pour les adapter.</span></span>
  </div>`;
  if (!groupes.length) {
    return entete + vide({
      icone: 'magnifyingglass',
      titre: p.recherche.trim() ? `Aucun résultat pour «\u00a0${p.recherche.trim()}\u00a0»` : 'Aucun exercice',
      message: p.recherche.trim() ? 'Vérifiez l’orthographe ou lancez une nouvelle recherche.' : '',
    });
  }
  return entete + groupes.map(([c, liste]) => section({
    entete: `${icone(c.icone)} ${h(c.nom)}`,
    lignes: liste.map((t) => ligneBibliotheque(t)),
  })).join('');
}

function ligneBibliotheque(t) {
  const teinte = couleur(TEINTE_CATEGORIE[t.categorie] ?? 'gray');
  return `<div class="ligne ligne-biblio" data-key="biblio-${h(t.id)}">
    <button type="button" class="ligne-biblio-corps" data-action="atelier.voir" data-id="${h(t.id)}">
      <span class="vignette">${diagrammeHTML(t, { rotation: false, cle: `diag-biblio-${t.id}` })}</span>
      <span class="ligne-textes">
        <span class="ligne-titre gras petit-titre">${h(t.titre)}</span>
        <span class="ligne-sous-titre">${h(resumeTactique(t))}</span>
        ${t.objectif ? `<span class="ligne-objectif">${h(t.objectif)}</span>` : ''}
      </span>
      <span class="lire" style="color:${teinte}">${icone('play.circle.fill')}</span>
    </button>
    <button type="button" class="bouton-plus" data-action="atelier.menuBibliotheque" data-id="${h(t.id)}" aria-label="Plus d'actions">${icone('ellipsis.circle')}</button>
  </div>`;
}

// MARK: - Actions

const exercice = (id) => store.tactique(id);

function ouvrirLecteur(t, cinema) {
  const p = accueil();
  ouvrirFeuille('lecteur.3d', { tactique: t, palette: p?.palette, roster: p?.roster ?? [], cinema }, { plein: true });
}

function ouvrirEditeur(t) {
  if (!pageExiste('editeur.atelier')) { alerte('Atelier', "L'éditeur d'exercices n'est pas disponible."); return; }
  ouvrirFeuille('editeur.atelier', { tactique: structuredClone(t), palette: accueil()?.palette }, { plein: true });
}

function copierDansMesExercices(t) {
  const copie = store.dupliquer(t);
  store.enregistrerTactique(copie);
  ouvrirEditeur(copie);
}

function partagerExercices(liste) {
  if (!liste.length) return;
  try {
    partager({ fichiers: [{ nom: nomFichierTactiques(liste), contenu: ecrireFichierTactiques(liste), type: 'application/json' }] });
  } catch (e) {
    alerte('Atelier', `Export impossible : ${e.message}`);
  }
}

action('atelier.fermer', () => fermerFeuille('atelier.accueil'));
action('atelier.onglet', (el) => { const p = accueil(); if (p) p.onglet = el.dataset.valeur; });
action('atelier.recherche', (el) => { const p = accueil(); if (p) p.recherche = el.value; });
action('atelier.nouveau', () => ouvrirEditeur(nouvelExercice()));
action('atelier.modifier', (el) => { const t = exercice(el.dataset.id); if (t) ouvrirEditeur(t); });
action('atelier.cinema', (el) => { const t = exercice(el.dataset.id); if (t) ouvrirLecteur(t, true); });
action('atelier.voir', (el) => { const t = exercice(el.dataset.id); if (t) ouvrirLecteur(t, false); });

action('atelier.menuExercice', (el) => {
  const t = exercice(el.dataset.id);
  if (!t) return false;
  choix({
    titre: t.titre,
    actions: [
      { libelle: 'Voir en 3D', icone: 'cube.transparent', faire: () => ouvrirLecteur(t, false) },
      { libelle: 'Dupliquer', icone: 'plus.square.on.square', faire: () => { const c = store.dupliquer(t); store.enregistrerTactique(c); ouvrirEditeur(c); } },
      { libelle: 'Fiche à imprimer (PDF)', icone: 'printer', faire: () => apercuPDF(ficheExercicePDF(t), `${nomFichierTactiques([t]).replace(/\.tdjt$/, '')}.pdf`, t.titre) },
      { libelle: 'Envoyer (.tdjt)', icone: 'square.and.arrow.up', faire: () => partagerExercices([t]) },
      {
        libelle: 'Supprimer', icone: 'trash', role: 'detruire',
        faire: () => choix({ titre: 'Supprimer cet exercice ?', message: t.titre, actions: [{ libelle: 'Supprimer', role: 'detruire', faire: () => store.supprimerTactique(t.id) }] }),
      },
    ],
  });
  return false;
});

action('atelier.menuBibliotheque', (el) => {
  const t = exercice(el.dataset.id);
  if (!t) return false;
  choix({
    titre: t.titre,
    actions: [
      { libelle: 'Cinéma', icone: 'film.stack', faire: () => ouvrirLecteur(t, true) },
      { libelle: 'Copier dans mes exercices', icone: 'plus.square.on.square', faire: () => copierDansMesExercices(t) },
      { libelle: 'Partager (.tdjt)', icone: 'square.and.arrow.up', faire: () => partagerExercices([t]) },
    ],
  });
  return false;
});

action('atelier.nouvelleSeance', () => {
  const plan = nouveauPlan(titreNouvelleSeance());
  store.enregistrerPlan(plan);
  ouvrirSeance(plan.id);
});
action('atelier.ouvrirSeance', (el) => ouvrirSeance(el.dataset.id));
action('atelier.supprimerSeance', (el) => {
  const id = el.dataset.id;
  choix({
    titre: 'Supprimer cette séance ?',
    message: 'Les exercices restent dans « Mes exercices ».',
    actions: [{ libelle: 'Supprimer', role: 'detruire', faire: () => store.supprimerPlan(id) }],
  });
  return false;
});

function ouvrirSeance(planId) {
  if (!pageExiste('atelier.seance')) { alerte('Atelier', "La séance n'est pas disponible."); return; }
  pousser('atelier.seance', { planId, palette: accueil()?.palette });
}

action('atelier.menu', () => {
  const miens = store.tactiquesPerso();
  choix({
    actions: [
      { libelle: 'Importer un fichier .tdjt', icone: 'square.and.arrow.down', faire: importer },
      ...(miens.length ? [{ libelle: 'Exporter mes exercices', icone: 'square.and.arrow.up', faire: () => partagerExercices(store.tactiquesPerso()) }] : []),
      { libelle: 'Exporter la bibliothèque', icone: 'books.vertical', faire: () => partagerExercices(store.bibliotheque) },
    ],
  });
  return false;
});

async function importer() {
  const fichiers = await choisirFichier({ accept: '.tdjt,.json,application/json', multiple: true });
  if (!fichiers.length) return;
  let total = 0;
  const echecs = [];
  for (const f of fichiers) {
    try { total += store.importerTactiques(await f.text()); } catch { echecs.push(f.name); }
  }
  let message;
  if (!echecs.length) {
    message = total === 0 ? 'Aucun nouvel exercice dans ce fichier.' : `${total} exercice${total > 1 ? 's importés' : ' importé'} dans « Mes exercices ».`;
  } else {
    message = `${total} importé(s). Fichier(s) illisible(s) : ${echecs.join(', ')}.`;
  }
  const p = accueil();
  if (p) p.onglet = 'exercices';
  alerte('Atelier', message);
  rafraichir();
}
