// Lecteur 3D (TacticPlayerView.swift) : démonstration pas à pas d'un exercice en 3D —
// étapes, lecture automatique, vitesse, flèches, caméras, évolutions, mode cinéma,
// fiche de l'exercice (TacticInfoSheet), partage .tdjt.
// Page plein écran : ouvrirFeuille('lecteur.3d', { tactique, palette?, roster?, cinema?, evolutionInitiale?, surEnregistrer? }, { plein: true })
import {
  resolvedFrames, flechesEtape, estAerien, idsBallons, variante, categorieTactique, resumeMateriel,
  ecrireFichierTactiques, TYPES_FLECHE,
} from '../../model.js';
import {
  definirPage, definirMontage, action, rafraichir, fermerFeuille, ouvrirFeuille, boutonBarre, section, ligne,
  interrupteur, choix, partager, h, icone, etat,
} from '../../ui.js';
import { Terrain3D, CAMERAS } from './terrain3d.js';
import {
  titreEtape, texteEtape, tempsArret, libelleVitesse, VITESSES, joueursDuMatch, acteurs3D, zoneUtile, aUnBallon,
  nomFichierTactiques,
} from './logique.js';

// MARK: - Pictogrammes absents du socle

const svg = (corps, plein = true) => `<svg viewBox="0 0 24 24" class="ic" ${plein ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true">${corps}</svg>`;
const LOCALES = {
  eye: svg('<path d="M12 5C6.5 5 2.7 9.2 1.5 12c1.2 2.8 5 7 10.5 7s9.3-4.2 10.5-7C21.3 9.2 17.5 5 12 5zm0 11.2a4.2 4.2 0 1 1 0-8.4 4.2 4.2 0 0 1 0 8.4zm0-6.5a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z"/>'),
  'backward.fill': svg('<path d="M11.5 6v12a.8.8 0 0 1-1.3.6L2.6 12.6a.8.8 0 0 1 0-1.2l7.6-6a.8.8 0 0 1 1.3.6zm10 0v12a.8.8 0 0 1-1.3.6l-7.6-6a.8.8 0 0 1 0-1.2l7.6-6a.8.8 0 0 1 1.3.6z"/>'),
  'forward.fill': svg('<path d="M12.5 6v12a.8.8 0 0 0 1.3.6l7.6-6a.8.8 0 0 0 0-1.2l-7.6-6a.8.8 0 0 0-1.3.6zm-10 0v12a.8.8 0 0 0 1.3.6l7.6-6a.8.8 0 0 0 0-1.2l-7.6-6a.8.8 0 0 0-1.3.6z"/>'),
  'arrow.triangle.turn.up.right.diamond.fill': svg('<path fill-rule="evenodd" d="M10.6 1.6a2 2 0 0 1 2.8 0l9 9a2 2 0 0 1 0 2.8l-9 9a2 2 0 0 1-2.8 0l-9-9a2 2 0 0 1 0-2.8zM13 7.5v2.4H9.8a1.8 1.8 0 0 0-1.8 1.8V16h2v-4.1h3v2.4l3.6-3.4z"/>'),
  'arrow.triangle.turn.up.right.diamond': svg('<path d="M12 2.3 21.7 12 12 21.7 2.3 12z"/><path d="M9 15.5v-3.4a1.4 1.4 0 0 1 1.4-1.4H15M13.2 8.4 15.5 10.7 13.2 13"/>', false),
};
export const ic = (nom) => LOCALES[nom] ?? icone(nom);

// MARK: - Composants partagés (bibliothèque, placement, aide)

/** Sélecteur de caméra (CameraPresetPicker) */
export function selecteurCamera(choisie, actionNom, data = {}) {
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${h(v)}"`).join('');
  return `<div class="cameras">${CAMERAS.map((c) => `<button type="button" class="camera${c.id === choisie ? ' choisie' : ''}"
    data-action="${actionNom}" data-camera="${c.id}"${attrs} aria-label="Caméra ${h(c.nom)}">${ic(c.icone)}<span>${h(c.nom)}</span></button>`).join('')}</div>`;
}

/** Petit dessin d'une flèche (ArrowSample) */
export function echantillonFleche(type, sombre, l = 40, ht = 12) {
  const y = ht / 2;
  const coul = type === 'course' ? (sombre ? '#ffffff' : 'var(--texte)') : type === 'passe' ? 'rgb(242,191,0)' : type === 'conduite' ? 'var(--orange)' : 'var(--rouge)';
  let d;
  if (type === 'conduite') {
    const pts = [];
    for (let x = 0; x <= l - 5; x += 1) pts.push(`${x.toFixed(1)},${(y + Math.sin(x / 3) * ht * 0.3).toFixed(2)}`);
    d = `M${pts.join(' L')}`;
  } else d = `M0,${y} L${l - 5},${y}`;
  return `<svg class="echantillon" width="${l}" height="${ht}" viewBox="0 0 ${l} ${ht}" aria-hidden="true">
    <path d="${d}" fill="none" stroke="${coul}" stroke-width="${type === 'tir' ? 3 : 2}" stroke-linecap="round" ${type === 'course' ? 'stroke-dasharray="4 3"' : ''}/>
    <path d="M${l},${y} L${l - 6},${y - 4} L${l - 6},${y + 4} Z" fill="${coul}"/></svg>`;
}

/** Légende des flèches (ArrowLegend) */
export function legendeFleches(compacte = false) {
  const types = ['passe', 'course', 'conduite', 'tir'];
  if (compacte) {
    return `<div class="legende compacte">${types.map((t) => `<span>${echantillonFleche(t, true, 22, 10)}${h(TYPES_FLECHE[t])}</span>`).join('')}</div>`;
  }
  return `<div class="legende">${types.map((t) => `<span>${echantillonFleche(t, false)}${h(TYPES_FLECHE[t])}</span>`).join('')}</div>`;
}

// MARK: - État du lecteur

let courant = null;   // paramètres de la page affichée (le montage 3D s'y raccroche)

const jouee = (p) => variante(p.tactique, p.variant);
const derniere = (p) => Math.max(0, p.frames.length - 1);

function initialiser(p) {
  if (p.init) return;
  p.init = true;
  const debut = Number.isInteger(p.evolutionInitiale) && p.tactique.evolutions?.[p.evolutionInitiale] ? p.evolutionInitiale : null;
  p.variant = debut;
  p.frames = resolvedFrames(variante(p.tactique, debut));
  p.etape = 0;
  p.lecture = false;
  p.vitesse = 1;
  p.fleches = true;
  p.mesJoueurs = false;
  p.jeton = 0;
  p.enregistre = false;
  p.cinema = Boolean(p.cinema);
  p.roster = p.roster ?? [];
}

function configurerActeurs(p) {
  const t = jouee(p);
  const remplacements = p.mesJoueurs ? joueursDuMatch(t, p.roster) : {};
  p.moteur?.configure(acteurs3D(t, { remplacements, nomsVisibles: p.mesJoueurs || t.categorie === 'perso' }), t.materiel ?? [], p.palette ?? {});
}

function rafraichirSurcouches(p, anime) {
  const t = jouee(p);
  if (!t.etapes[p.etape] || !p.moteur) return;
  p.moteur.showArrows(p.fleches ? flechesEtape(t, p.etape, p.frames) : [], anime);
  p.moteur.setHighlights(t.etapes[p.etape].focus ?? []);
}

function preparer(p) {
  if (!p.frames.length || !p.moteur) return;
  const t = jouee(p);
  configurerActeurs(p);
  const z = zoneUtile(t);
  p.moteur.setFocus(z.min, z.max);
  p.moteur.setBallVisible(aUnBallon(t));
  p.moteur.setFrame(p.frames[p.etape] ?? p.frames[0]);
  rafraichirSurcouches(p, false);
  p.moteur.applyCamera(p.camera ?? 'coach', false);
  if (p.cinema && !p.demarreCinema) {
    p.demarreCinema = true;
    setTimeout(() => { if (!p.lecture && p.moteur) basculerLecture(p); }, 800);
  }
}

function arreterAuto(p) {
  p.lecture = false;
  p.jeton += 1;
}

function sauter(p, i, garderLecture = false) {
  if (!p.frames[i]) return;
  if (!garderLecture) arreterAuto(p);
  p.jeton += 1;
  p.etape = i;
  p.moteur?.setFrame(p.frames[i]);
  rafraichirSurcouches(p, false);
  rafraichir();
}

function avancer(p) {
  if (p.etape >= derniere(p)) { p.lecture = false; rafraichir(); return; }
  p.jeton += 1;
  const jeton = p.jeton;
  p.etape += 1;
  const cible = p.etape;
  rafraichirSurcouches(p, true);
  const t = jouee(p);
  const duree = (t.etapes[cible].duree ?? 2) / p.vitesse;
  rafraichir();
  // Les flèches apparaissent d'abord, puis les joueurs se déplacent
  setTimeout(() => {
    if (jeton !== p.jeton || !p.moteur) return;
    const autres = new Set(idsBallons(t.etapes).filter((id) => estAerien(t, cible, id)));
    p.moteur.animate(p.frames[cible], {
      aerien: estAerien(t, cible), autresAeriens: autres, duree,
      fin: () => { if (jeton === p.jeton && p.lecture) programmerSuite(p, jeton); },
    });
  }, (0.45 / p.vitesse) * 1000);
}

function programmerSuite(p, jeton) {
  const texte = jouee(p).etapes[p.etape]?.texte ?? '';
  setTimeout(() => {
    if (jeton !== p.jeton || !p.lecture) return;
    if (p.etape < derniere(p)) avancer(p);
    else { p.lecture = false; rafraichir(); }
  }, tempsArret(texte, p.vitesse) * 1000);
}

function basculerLecture(p) {
  if (p.lecture) { arreterAuto(p); rafraichir(); return; }
  p.lecture = true;
  if (p.etape >= derniere(p)) {
    sauter(p, 0, true);
    p.jeton += 1;
    const jeton = p.jeton;
    setTimeout(() => { if (jeton === p.jeton && p.lecture) avancer(p); }, 800);
  } else avancer(p);
  rafraichir();
}

function precedente(p) {
  if (p.etape <= 0) return;
  arreterAuto(p);
  p.jeton += 1;
  p.etape -= 1;
  rafraichirSurcouches(p, true);
  p.moteur?.animate(p.frames[p.etape], { aerien: false, duree: 0.6 });
}

function revoirEtape(p) {
  if (p.etape <= 0) return;
  arreterAuto(p);
  const cible = p.etape;
  p.jeton += 1;
  const jeton = p.jeton;
  p.moteur?.setFrame(p.frames[cible - 1]);
  rafraichirSurcouches(p, true);
  const t = jouee(p);
  const duree = (t.etapes[cible].duree ?? 2) / p.vitesse;
  setTimeout(() => {
    if (jeton !== p.jeton || !p.moteur) return;
    const autres = new Set(idsBallons(t.etapes).filter((id) => estAerien(t, cible, id)));
    p.moteur.animate(p.frames[cible], { aerien: estAerien(t, cible), autresAeriens: autres, duree });
  }, (0.45 / p.vitesse) * 1000);
}

function choisirVariante(p, index) {
  arreterAuto(p);
  p.variant = index;
  p.frames = resolvedFrames(jouee(p));
  p.etape = 0;
  if (!p.frames.length || !p.moteur) return;
  const t = jouee(p);
  configurerActeurs(p);
  const z = zoneUtile(t);
  p.moteur.setFocus(z.min, z.max);
  p.moteur.setBallVisible(aUnBallon(t));
  p.moteur.setFrame(p.frames[0]);
  rafraichirSurcouches(p, false);
  p.moteur.applyCamera(p.moteur.cameraPreset, true);
}

// MARK: - Montage 3D

/** Hôte du canvas WebGL : un shadow DOM le met à l'abri du rendu par comparaison */
export function hoteCanvas(el, etiquette) {
  const racine = el.shadowRoot ?? el.attachShadow({ mode: 'open' });
  racine.innerHTML = '<style>:host{display:block;position:relative}canvas{display:block;width:100%;height:100%;outline:none;touch-action:none}</style>';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', etiquette);
  racine.appendChild(canvas);
  return canvas;
}

definirMontage('lecteur.terrain', (el) => {
  const p = courant;
  if (!p) return null;
  const canvas = hoteCanvas(el, `Terrain 3D : ${p.tactique.titre}`);
  const moteur = new Terrain3D(canvas);
  moteur.onCamera = (preset) => { p.camera = preset; rafraichir(); };
  p.moteur = moteur;
  preparer(p);
  const clavier = (e) => {
    if (e.key !== ' ' || /INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)) return;
    const haut = etat.feuilles[etat.feuilles.length - 1];
    if (haut?.params !== p || haut.pile.length) return;
    e.preventDefault();
    basculerLecture(p);
  };
  document.addEventListener('keydown', clavier);
  return () => {
    document.removeEventListener('keydown', clavier);
    arreterAuto(p);
    moteur.detruire();
    if (p.moteur === moteur) p.moteur = null;
  };
});

// MARK: - Page

function boutonCommande(nom, libelle, actionNom, desactive, extra = '') {
  return `<button type="button" class="commande${extra}" data-action="${actionNom}" aria-label="${h(libelle)}" title="${h(libelle)}" ${desactive ? 'disabled' : ''}>${ic(nom)}</button>`;
}

function commandes(p) {
  const der = derniere(p);
  return `<div class="commandes">
    ${boutonCommande('backward.end.fill', 'Début', 'lecteur.debut', p.etape === 0)}
    ${boutonCommande('backward.fill', 'Étape précédente', 'lecteur.precedente', p.etape === 0)}
    <button type="button" class="commande lecture" data-action="lecteur.lecture" aria-label="${p.lecture ? 'Pause' : 'Lecture automatique'}">${ic(p.lecture ? 'pause.circle.fill' : 'play.circle.fill')}</button>
    ${boutonCommande('forward.fill', 'Étape suivante', 'lecteur.suivante', p.etape >= der)}
    ${boutonCommande('arrow.counterclockwise', "Revoir l'étape", 'lecteur.revoir', p.etape === 0)}
    <button type="button" class="commande vitesse" data-action="lecteur.vitesse" aria-label="Vitesse">${h(libelleVitesse(p.vitesse))}</button>
    ${boutonCommande(p.fleches ? 'arrow.triangle.turn.up.right.diamond.fill' : 'arrow.triangle.turn.up.right.diamond', p.fleches ? 'Masquer les flèches' : 'Afficher les flèches', 'lecteur.fleches', false)}
  </div>`;
}

function libelleVariante(p) {
  return p.variant != null ? (p.tactique.evolutions?.[p.variant]?.titre ?? 'Exercice de base') : 'Exercice de base';
}

function menuVariante(p, classe = '') {
  if (!p.tactique.evolutions?.length) return '';
  return `<button type="button" class="menu-variante ${classe}" data-action="lecteur.variante" aria-label="Évolution">${icone('square.stack.3d.up')}<span>${h(libelleVariante(p))}</span>${icone('chevron.down')}</button>`;
}

function panneau(p) {
  const t = jouee(p);
  const cat = categorieTactique(t.categorie);
  const n = p.frames.length;
  return `<div class="lecteur-panneau">
    <div class="progression-etapes">${Array.from({ length: n }, (_, i) => `<button type="button" class="${i <= p.etape ? 'faite' : ''}" data-action="lecteur.sauter" data-index="${i}" aria-label="Étape ${i + 1}"></button>`).join('')}</div>
    <div class="ligne-flex entre petit secondaire"><b>Étape ${p.etape + 1} / ${n}</b><span class="categorie">${icone(cat.icone)} ${h(cat.nom)}</span></div>
    <p class="titre-etape">${h(titreEtape(t, p.etape))}</p>
    <div class="texte-etape">${h(texteEtape(t, p.etape))}</div>
    ${commandes(p)}
    ${p.roster.length && t.acteurs.some((a) => a.camp === 'equipe') ? `<div class="mes-joueurs">${interrupteur({ titre: 'Afficher mes joueurs', icone: 'person.crop.circle.badge.checkmark', actif: p.mesJoueurs, action: 'lecteur.mesJoueurs' })}</div>` : ''}
  </div>`;
}

function surcoucheCinema(p) {
  const t = jouee(p);
  const texte = texteEtape(t, p.etape);
  return `<div class="cinema-haut">
      <button type="button" class="rond-verre" data-action="lecteur.fermer" aria-label="Fermer">${icone('xmark')}</button>
      ${selecteurCamera(p.moteur?.cameraPreset ?? p.camera ?? 'coach', 'lecteur.camera')}
    </div>
    <div class="cinema-bas">
      <div class="cinema-legende">
        ${menuVariante(p, 'dans-cinema')}
        <div class="ligne-flex entre"><b>${h(titreEtape(t, p.etape))}</b><span class="compteur">${p.etape + 1} / ${p.frames.length}</span></div>
        ${texte ? `<p>${h(texte)}</p>` : ''}
      </div>
      ${commandes(p)}
    </div>`;
}

definirPage('lecteur.3d', (p) => {
  initialiser(p);
  courant = p;
  const t = jouee(p);
  const preset = p.moteur?.cameraPreset ?? p.camera ?? 'coach';
  const droite = [
    p.tactique.evolutions?.length ? boutonBarre({ icone: 'square.stack.3d.up', titre: `Évolution : ${libelleVariante(p)}`, action: 'lecteur.variante' }) : '',
    boutonBarre({ icone: 'arrow.up.left.and.arrow.down.right', titre: 'Cinéma', action: 'lecteur.cinema' }),
    p.surEnregistrer ? boutonBarre({ icone: p.enregistre ? 'checkmark.circle.fill' : 'square.and.arrow.down', titre: p.enregistre ? 'Enregistrée' : 'Enregistrer', action: 'lecteur.enregistrer', desactive: p.enregistre }) : '',
    boutonBarre({ icone: 'square.and.arrow.up', titre: 'Partager', action: 'lecteur.partager' }),
    boutonBarre({ icone: 'info.circle', titre: 'Fiche', action: 'lecteur.fiche' }),
  ].join('');
  return {
    titre: t.titre,
    gauche: boutonBarre({ icone: 'xmark.circle.fill', titre: 'Fermer', action: 'lecteur.fermer' }),
    droite,
    classe: 'sans-marge defile-lecteur',
    contenu: `<div class="lecteur${p.cinema ? ' cinema' : ''}">
      <div class="lecteur-terrain">
        <div class="lecteur-3d" data-monter="lecteur.terrain" data-key="lecteur-3d"></div>
        ${p.cinema ? surcoucheCinema(p) : `<div class="lecteur-cameras">${selecteurCamera(preset, 'lecteur.camera')}</div>
          ${p.fleches ? `<div class="lecteur-legende">${legendeFleches(true)}</div>` : ''}`}
      </div>
      ${p.cinema ? '' : panneau(p)}
    </div>`,
  };
});

const lecteur = () => courant;

action('lecteur.fermer', () => {
  const p = lecteur();
  if (p) arreterAuto(p);
  fermerFeuille('lecteur.3d');
});
action('lecteur.camera', (el) => { lecteur()?.moteur?.applyCamera(el.dataset.camera, true); });
action('lecteur.lecture', () => { const p = lecteur(); if (p) basculerLecture(p); });
action('lecteur.debut', () => { const p = lecteur(); if (p) sauter(p, 0); });
action('lecteur.sauter', (el) => { const p = lecteur(); if (p) sauter(p, Number(el.dataset.index)); });
action('lecteur.precedente', () => { const p = lecteur(); if (p) precedente(p); });
action('lecteur.suivante', () => { const p = lecteur(); if (p) { arreterAuto(p); avancer(p); } });
action('lecteur.revoir', () => { const p = lecteur(); if (p) revoirEtape(p); });
action('lecteur.fleches', () => {
  const p = lecteur();
  if (!p) return;
  p.fleches = !p.fleches;
  rafraichirSurcouches(p, true);
});
action('lecteur.mesJoueurs', (el) => {
  const p = lecteur();
  if (!p) return;
  p.mesJoueurs = el.checked;
  configurerActeurs(p);
});
action('lecteur.vitesse', () => {
  const p = lecteur();
  if (!p) return false;
  choix({
    titre: 'Vitesse',
    actions: VITESSES.map((v) => ({ libelle: libelleVitesse(v), icone: v === p.vitesse ? 'checkmark' : '', faire: () => { p.vitesse = v; } })),
  });
  return false;
});
action('lecteur.variante', () => {
  const p = lecteur();
  if (!p) return false;
  choix({
    titre: 'Évolution',
    actions: [
      { libelle: 'Exercice de base', icone: p.variant == null ? 'checkmark' : '', faire: () => choisirVariante(p, null) },
      ...p.tactique.evolutions.map((ev, i) => ({ libelle: ev.titre, icone: p.variant === i ? 'checkmark' : '', faire: () => choisirVariante(p, i) })),
    ],
  });
  return false;
});
action('lecteur.cinema', () => {
  const p = lecteur();
  if (!p) return;
  p.cinema = true;
  if (!p.lecture) setTimeout(() => { if (!p.lecture && p.moteur) basculerLecture(p); }, 400);
});
action('lecteur.enregistrer', () => {
  const p = lecteur();
  if (!p?.surEnregistrer) return;
  p.surEnregistrer(p.tactique);
  p.enregistre = true;
});
action('lecteur.partager', () => {
  const p = lecteur();
  if (!p) return false;
  partager({ fichiers: [{ nom: nomFichierTactiques([p.tactique]), contenu: ecrireFichierTactiques([p.tactique]), type: 'application/json' }] });
  return false;
});
action('lecteur.fiche', () => {
  const p = lecteur();
  if (p) ouvrirFeuille('lecteur.fiche', { tactique: jouee(p) });
});

// MARK: - Fiche de l'exercice (TacticInfoSheet)

definirPage('lecteur.fiche', ({ tactique: t }) => {
  const cat = categorieTactique(t.categorie);
  const materiel = resumeMateriel(t);
  const info = (titre, valeur) => ligne({ titre, valeur });
  return {
    titre: t.titre,
    gauche: '',
    droite: boutonBarre({ libelle: 'OK', gras: true, action: 'nav.fermer' }),
    contenu: `<div class="colonne">
      ${t.objectif ? section({ entete: 'Objectif', lignes: [`<div class="ligne"><span class="ligne-textes">${h(t.objectif)}</span></div>`] }) : ''}
      ${t.consignes.length ? section({ entete: 'Consignes de coaching', lignes: t.consignes.map((c) => ligne({ titre: c, icone: 'checkmark.circle', classe: 'avec-icone multiligne' })) }) : ''}
      ${section({
        entete: 'Organisation',
        lignes: [
          info('Catégorie', cat.nom),
          t.effectif != null ? info('Effectif', t.effectif) : '',
          t.niveau != null ? info('Niveau', t.niveau) : '',
          t.duree != null ? info('Durée', t.duree) : '',
          materiel ? info('Matériel', materiel) : '',
          info('Étapes', String(t.etapes.length)),
        ],
      })}
      ${section({
        entete: 'Déroulé',
        lignes: t.etapes.map((e, i) => `<div class="ligne"><span class="ligne-textes"><span class="ligne-titre gras petit-titre">${i + 1}. ${h(e.titre || `Étape ${i + 1}`)}</span>${e.texte ? `<span class="ligne-sous-titre">${h(e.texte)}</span>` : ''}</span></div>`),
      })}
      ${section({
        entete: 'Légende',
        lignes: [
          `<div class="ligne">${legendeFleches(false)}</div>`,
          ligne({ titre: "Halo jaune : joueur clé de l'étape", icone: 'circle.dashed', classe: 'avec-icone petit-titre' }),
        ],
      })}
      ${t.source ? section({ entete: 'Source', lignes: [`<div class="ligne"><span class="ligne-textes">${h(t.source)}</span></div>`] }) : ''}
    </div>`,
  };
});

