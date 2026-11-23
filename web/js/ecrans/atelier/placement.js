// Placement tactique (FormationView.swift) : formations adaptées au nombre de joueurs,
// joueurs à glisser, miroir, cadrage, adversaires, dessin, ballon, vue 3D, et construction
// d'une séquence pas à pas (SequenceBuilder) avec sa liste d'étapes et son aide.
// ouvrirFeuille('placement', { roster, jerseyColor, opponentJerseyColor, savedFormation,
//   surEnregistrer(positions, formationName), trainingMode?, initialPlay? }, { plein: true })
import { store } from '../../store.js';
import { uuid, maillot, matchPlayerDisplayName, POSTE_COURT, decimal } from '../../model.js';
import {
  definirPage, definirMontage, action, rafraichir, fermerFeuille, ouvrirFeuille, boutonBarre, section, ligne,
  interrupteur, choix, saisie, segmente, champ, h, icone, etat,
} from '../../ui.js';
import { Terrain3D } from './terrain3d.js';
import { selecteurCamera, legendeFleches, hoteCanvas, ic } from './lecteur.js';
import {
  METRE, points as metriquePoints, joueurLePlusProche, cibleBut, ballonAuxPieds, photographierEtape, transition,
} from './sequences.js';
import { FORMATIONS, appliquerFormation, titreSequenceParDefaut, exerciceDeSequence } from './logique.js';
import { resolvedFrames } from '../../model.js';

const ZOOMS = {
  full: { facteur: 1, titre: 'Terrain entier', icone: 'rectangle.portrait' },
  half: { facteur: 1.7, titre: 'Demi-terrain', icone: 'rectangle.portrait.tophalf.inset.filled' },
  zone: { facteur: 2.6, titre: 'Zone de jeu', icone: 'viewfinder' },
};

let courant = null;
const page = () => courant;

// MARK: - État

function initialiser(p) {
  if (p.e) return;
  p.roster = p.roster ?? [];
  p.jerseyColor = p.jerseyColor ?? 'Bleu';
  p.opponentJerseyColor = p.opponentJerseyColor ?? 'Rouge';
  p.trainingMode = Boolean(p.trainingMode);
  p.e = {
    positions: {}, formation: null, miroir: false, zoom: 'full', centre: { x: 0.5, y: 0.5 },
    extras: [], adversaires: [], prochainAdv: 1, outil: 'move', traces: [], trace: null,
    ballon: null, porteur: null, vue3D: false, did3D: false,
    etapes: [], acteursSeq: [], seqId: uuid(), edition: null, aerien: false, sale: false,
    titreSeq: '', toast: null, glisse: null, taille: null,
  };
  const e = p.e;
  if (p.trainingMode) {
    if (p.initialPlay) chargerSequence(p, p.initialPlay); else seanceVierge(p);
    choisirZoom(p, 'zone');
  } else {
    const titulaires = lesTitulaires(p);
    if (titulaires.some((j) => j.formationX != null && j.formationY != null)) {
      for (const j of titulaires) if (j.formationX != null && j.formationY != null) e.positions[j.id] = { x: j.formationX, y: j.formationY };
      e.formation = p.savedFormation ?? null;
    } else {
      formation(p, 'auto');
    }
  }
}

const lesTitulaires = (p) => [...p.roster.filter((j) => j.status === 'Titulaire'), ...(p.e?.extras ?? [])].sort((a, b) => a.shirtNumber - b.shirtNumber);
const lesRemplacants = (p) => p.roster.filter((j) => j.status === 'Remplaçant').sort((a, b) => a.shirtNumber - b.shirtNumber);
const palette3D = (p) => ({ equipe: p.jerseyColor, adversaire: p.opponentJerseyColor });

function rectangleVisible(e) {
  const taille = 1 / ZOOMS[e.zoom].facteur;
  return {
    x: Math.min(Math.max(e.centre.x - taille / 2, 0), 1 - taille),
    y: Math.min(Math.max(e.centre.y - taille / 2, 0), 1 - taille),
    l: taille, h: taille,
  };
}

function choisirZoom(p, niveau) {
  p.e.zoom = niveau;
  recentrer(p);
}

function recentrer(p) {
  const pts = Object.values(positionsCourantes(p));
  if (p.e.ballon) pts.push([p.e.ballon.x, p.e.ballon.y]);
  if (!pts.length) return;
  const xs = pts.map((q) => q[0]); const ys = pts.map((q) => q[1]);
  p.e.centre = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/** Positions de tous les joueurs sur le terrain : { id: [x, y] } (currentPositions) */
function positionsCourantes(p) {
  const res = {};
  for (const j of lesTitulaires(p)) { const q = p.e.positions[j.id]; if (q) res[j.id] = [q.x, q.y]; }
  for (const a of p.e.adversaires) res[`adv-${a.id}`] = [a.position.x, a.position.y];
  return res;
}

function framePlacement(p) {
  const pts = positionsCourantes(p);
  const porteur = p.e.porteur && pts[p.e.porteur] ? p.e.porteur : null;
  return { positions: pts, porteur, ballon: p.e.ballon ? [p.e.ballon.x, p.e.ballon.y] : [0.5, 0.5], autres: {} };
}

/** Acteurs du terrain (placementActors) */
function acteursPlacement(p) {
  return [
    ...lesTitulaires(p).map((j) => {
      const nom = !(j.firstName === '' && j.lastName === '');
      const a = { id: j.id, camp: 'equipe', numero: `${j.shirtNumber}`, poste: j.position };
      if (nom) a.nom = matchPlayerDisplayName(j);
      return a;
    }),
    ...p.e.adversaires.map((o) => ({ id: `adv-${o.id}`, camp: 'adversaire', numero: `${o.number}` })),
  ];
}

function tousLesActeurs(p) {
  const res = [...p.e.acteursSeq];
  for (const a of acteursPlacement(p)) if (!res.some((x) => x.id === a.id)) res.push(a);
  return res;
}

const etapeCourante = (p) => photographierEtape(positionsCourantes(p), p.e.porteur, p.e.ballon ? [p.e.ballon.x, p.e.ballon.y] : null, p.e.aerien);

function apercu(p) {
  const e = p.e;
  const base = e.edition != null ? (e.edition > 0 ? e.edition - 1 : null) : (e.etapes.length ? e.etapes.length - 1 : null);
  if (base == null || !e.etapes[base]) return null;
  return transition(e.etapes[base], etapeCourante(p), tousLesActeurs(p));
}

function pointDe(p, id) {
  if (id.startsWith('adv-')) return p.e.adversaires.find((a) => a.id === id.slice(4))?.position ?? null;
  return p.e.positions[id] ?? null;
}

const pieds = (id, q) => { const b = ballonAuxPieds([q.x, q.y], id.startsWith('adv-') ? 'adversaire' : 'equipe'); return { x: b[0], y: b[1] }; };

// MARK: - Déplacements (2D et 3D)

function deplacerActeur(p, id, point) {
  const q = { x: Math.min(Math.max(point.x, 0.05), 0.95), y: Math.min(Math.max(point.y, 0.04), 0.96) };
  if (id.startsWith('adv-')) {
    const a = p.e.adversaires.find((x) => x.id === id.slice(4));
    if (!a) return;
    a.position = q;
  } else p.e.positions[id] = q;
  if (p.e.porteur === id) p.e.ballon = pieds(id, q);
}

function lacherBallon(p, point, metrique) {
  const pts = positionsCourantes(p);
  const porteur = joueurLePlusProche(point, pts, metrique);
  if (porteur && pts[porteur]) {
    p.e.porteur = porteur;
    p.e.ballon = pieds(porteur, { x: pts[porteur][0], y: pts[porteur][1] });
  } else {
    const but = cibleBut(point);
    p.e.porteur = null;
    if (but) p.e.ballon = { x: but[0], y: but[1] };
  }
}

function basculerBallon(p) {
  const e = p.e;
  if (e.ballon) { e.ballon = null; e.porteur = null; return; }
  const pts = Object.entries(positionsCourantes(p));
  if (pts.length) {
    const [id, q] = pts.reduce((m, x) => (Math.hypot(x[1][0] - 0.5, x[1][1] - 0.5) < Math.hypot(m[1][0] - 0.5, m[1][1] - 0.5) ? x : m));
    e.porteur = id;
    e.ballon = pieds(id, { x: q[0], y: q[1] });
  } else e.ballon = { x: 0.5, y: 0.5 };
}

function ajouterCoequipier(p) {
  const pris = new Set(lesTitulaires(p).map((j) => j.shirtNumber));
  let n = 1;
  while (n < 99 && pris.has(n)) n += 1;
  const j = { id: uuid(), shirtNumber: n, firstName: '', lastName: '', position: 'Milieu', status: 'Titulaire', isCaptain: false };
  p.e.extras.push(j);
  p.e.positions[j.id] = { x: 0.5 + (Math.random() * 0.3 - 0.15), y: 0.62 + (Math.random() * 0.1 - 0.05) };
}

function retirerCoequipier(p, id) {
  if (!p.e.extras.some((j) => j.id === id)) return;
  if (p.e.porteur === id) p.e.porteur = null;
  p.e.extras = p.e.extras.filter((j) => j.id !== id);
  delete p.e.positions[id];
}

function ajouterAdversaire(p) {
  p.e.adversaires.push({
    id: uuid(),
    position: { x: 0.3 + (Math.random() * 0.3 - 0.15), y: 0.15 + (Math.random() * 0.15 - 0.05) },
    number: p.e.prochainAdv,
  });
  p.e.prochainAdv += 1;
}

function formation(p, id) {
  const r = appliquerFormation(id, lesTitulaires(p));
  if (!r) return;
  Object.assign(p.e.positions, r.positions);
  p.e.formation = r.nom;
}

// MARK: - Séquence : capture et correction

function libelleCapture(e) {
  if (e.edition != null) return `Mettre à jour l'étape ${e.edition + 1}`;
  return e.etapes.length ? `Étape ${e.etapes.length + 1}` : 'Mise en place';
}

function resumeAction(p) {
  const e = p.e;
  if (!e.etapes.length) return 'Placez joueurs et ballon, puis validez la mise en place.';
  if (e.edition === 0) return 'Correction de la mise en place';
  const a = apercu(p);
  if (!a) return '';
  if (e.edition != null) return `Étape ${e.edition + 1} : ${a.resume}`;
  return a.resume === 'Aucun mouvement'
    ? `Déplacez un joueur ou le ballon pour l'étape ${e.etapes.length + 1}`
    : `Étape ${e.etapes.length + 1} : ${a.resume}`;
}

function montrerToast(p, message) {
  p.e.toast = message;
  setTimeout(() => { if (p.e.toast === message) { p.e.toast = null; rafraichir(); } }, 3000);
}

function capturer(p) {
  const e = p.e;
  const etape = etapeCourante(p);
  for (const a of acteursPlacement(p)) {
    const i = e.acteursSeq.findIndex((x) => x.id === a.id);
    if (i >= 0) e.acteursSeq[i] = a; else e.acteursSeq.push(a);
  }
  const k = e.edition;
  if (k != null && e.etapes[k]) {
    const ancien = e.etapes[k];
    if (k > 0) {
      const avant = e.etapes[k - 1];
      const autoAncien = transition(avant, ancien, tousLesActeurs(p)).resume;
      const tr = transition(avant, etape, tousLesActeurs(p));
      etape.titre = ancien.titre === '' || ancien.titre === autoAncien ? tr.resume : ancien.titre;
      etape.duree = tr.duree;
    } else {
      etape.titre = ancien.titre === '' ? 'Mise en place' : ancien.titre;
      if (ancien.duree != null) etape.duree = ancien.duree; else delete etape.duree;
    }
    etape.texte = ancien.texte;
    e.etapes[k] = etape;
    e.sale = true;
    const der = e.etapes.length - 1;
    e.edition = null;
    e.aerien = false;
    if (k < der) {
      chargerEtape(p, der, false);
      montrerToast(p, `Étape ${k + 1} mise à jour · retour à l'étape ${der + 1}`);
    } else montrerToast(p, `Étape ${k + 1} mise à jour`);
    return;
  }
  const prec = e.etapes[e.etapes.length - 1];
  if (prec) {
    const tr = transition(prec, etape, tousLesActeurs(p));
    etape.titre = tr.resume;
    etape.duree = tr.duree;
  } else {
    etape.titre = 'Mise en place';
    etape.duree = 1.5;
  }
  e.etapes.push(etape);
  e.sale = true;
  e.aerien = false;
  montrerToast(p, e.etapes.length === 1
    ? 'Mise en place enregistrée · faites la 1re action puis « Étape 2 »'
    : `Étape ${e.etapes.length} enregistrée : ${etape.titre}`);
}

/** Remet le terrain dans l'état d'une étape (pour la revoir ou la corriger) */
function chargerEtape(p, index, edition = true) {
  const e = p.e;
  const t = exerciceSequence(p);
  const frames = resolvedFrames(t);
  const f = frames[index];
  if (!f) return;
  for (const [id, q] of Object.entries(f.positions)) {
    const point = { x: q[0], y: q[1] };
    if (id.startsWith('adv-')) {
      const advId = id.slice(4);
      const a = e.adversaires.find((x) => x.id === advId);
      if (a) a.position = point;
      else {
        const num = Number.parseInt(t.acteurs.find((x) => x.id === id)?.numero ?? '', 10) || e.prochainAdv;
        e.adversaires.push({ id: advId, position: point, number: num });
        e.prochainAdv = Math.max(e.prochainAdv, num + 1);
      }
    } else {
      const titulaire = lesTitulaires(p).some((j) => j.id === id);
      const acteur = t.acteurs.find((x) => x.id === id);
      if (!titulaire && p.trainingMode && acteur) {
        e.extras.push({ id, shirtNumber: Number.parseInt(acteur.numero, 10) || 0, firstName: acteur.nom ?? '', lastName: '', position: acteur.poste ?? 'Milieu', status: 'Titulaire', isCaptain: false });
      }
      if (titulaire || p.trainingMode) e.positions[id] = point;
    }
  }
  if (t.etapes.some((x) => x.porteur != null || x.ballon != null)) {
    e.porteur = f.porteur;
    e.ballon = { x: f.ballon[0], y: f.ballon[1] };
  }
  if (edition) {
    e.edition = index;
    e.aerien = t.etapes[index].aerien ?? false;
    montrerToast(p, `Étape ${index + 1} affichée : corrigez puis « Mettre à jour »`);
  }
}

function finirEdition(p) {
  p.e.edition = null;
  p.e.aerien = false;
  if (p.e.etapes.length) chargerEtape(p, p.e.etapes.length - 1, false);
}

function effacerSequence(p) {
  Object.assign(p.e, { etapes: [], acteursSeq: [], edition: null, aerien: false, seqId: uuid(), sale: false });
}

const titreParDefaut = (p) => titreSequenceParDefaut({ modeEntrainement: p.trainingMode, formation: p.e.formation });

function exerciceSequence(p, titre = null) {
  const propre = (titre ?? '').trim();
  const repli = p.e.titreSeq === '' ? titreParDefaut(p) : p.e.titreSeq;
  return exerciceDeSequence({
    id: p.e.seqId, titre: propre === '' ? repli : propre, acteurs: tousLesActeurs(p), etapes: p.e.etapes,
    modeEntrainement: p.trainingMode, formation: p.e.formation, initial: p.initialPlay,
  });
}

function demanderEnregistrement(p) {
  if (p.e.etapes.length < 2) { montrerToast(p, "Validez au moins la mise en place et une étape avant d'enregistrer"); return; }
  if (p.e.titreSeq === '') p.e.titreSeq = titreParDefaut(p);
  saisie({
    titre: 'Enregistrer la séquence',
    message: `${p.e.etapes.length} étapes · retrouvez-la dans la bibliothèque Tactiques 3D.`,
    champs: [{ nom: 'titre', valeur: p.e.titreSeq, placeholder: 'Titre' }],
    valider: 'Enregistrer',
    faire: ({ titre }) => {
      p.e.titreSeq = titre;
      store.enregistrerTactique(exerciceSequence(p, titre));
      p.e.sale = false;
      montrerToast(p, 'Séquence enregistrée dans Tactiques 3D › Mes séquences');
      synchro(p);
    },
  });
}

function lireSequence(p) {
  ouvrirFeuille('lecteur.3d', {
    tactique: exerciceSequence(p),
    palette: palette3D(p),
    surEnregistrer: (t) => { store.enregistrerTactique(t); p.e.sale = false; },
  }, { plein: true });
}

/** Séance vierge : un carré de 4 joueurs, 2 adversaires, le ballon au 6 */
function seanceVierge(p) {
  const e = p.e;
  for (const [n, poste, x, y] of [[6, 'Milieu', 0.5, 0.62], [4, 'Défenseur', 0.36, 0.53], [8, 'Milieu', 0.64, 0.53], [10, 'Milieu', 0.5, 0.44]]) {
    const j = { id: uuid(), shirtNumber: n, firstName: '', lastName: '', position: poste, status: 'Titulaire', isCaptain: false };
    e.extras.push(j);
    e.positions[j.id] = { x, y };
  }
  e.adversaires = [{ id: uuid(), position: { x: 0.46, y: 0.535 }, number: 1 }, { id: uuid(), position: { x: 0.55, y: 0.5 }, number: 2 }];
  e.prochainAdv = 3;
  const premier = e.extras[0];
  e.porteur = premier.id;
  e.ballon = pieds(premier.id, e.positions[premier.id]);
}

/** Reprend une séquence enregistrée (mode entraînement) */
function chargerSequence(p, t) {
  const e = p.e;
  e.seqId = t.id;
  e.titreSeq = t.titre;
  e.acteursSeq = structuredClone(t.acteurs);
  e.etapes = structuredClone(t.etapes);
  for (const a of t.acteurs) {
    if (a.camp === 'adversaire' || !/^[0-9A-F-]{36}$/i.test(a.id)) continue;
    e.extras.push({ id: a.id, shirtNumber: Number.parseInt(a.numero, 10) || 0, firstName: a.nom ?? '', lastName: '', position: a.poste ?? 'Milieu', status: 'Titulaire', isCaptain: false });
  }
  if (t.etapes.length) chargerEtape(p, t.etapes.length - 1, false);
  e.sale = false;
}

// MARK: - Vue 3D

function synchro(p) {
  const m = p.moteur;
  if (!m || !p.e.vue3D) return;
  const acteurs = acteursPlacement(p).map((a) => ({ id: a.id, team: a.camp, label: a.numero, name: a.nom ?? null, isGoalkeeper: a.poste === 'Gardien', bib: null }));
  m.configure(acteurs, [], palette3D(p));
  m.setBallVisible(p.e.ballon != null);
  m.setFrame(framePlacement(p));
  m.showDrawings(p.e.traces.map((l) => l.map((q) => [q.x, q.y])));
  m.showArrows(apercu(p)?.fleches ?? [], false);
}

function preparer3D(p) {
  const m = p.moteur;
  m.onActorMoved = (id, q) => { deplacerActeur(p, id, { x: q[0], y: q[1] }); synchro(p); rafraichir(); };
  m.onBallMoved = (q) => { p.e.porteur = null; p.e.ballon = { x: q[0], y: q[1] }; rafraichir(); };
  m.onBallDropped = (q) => { lacherBallon(p, q, METRE); synchro(p); rafraichir(); };
  m.onCamera = (preset) => { p.e.camera = preset; rafraichir(); };
  synchro(p);
  if (p.trainingMode) {
    const pts = Object.values(positionsCourantes(p));
    const xs = pts.map((q) => q[0]); const ys = pts.map((q) => q[1]);
    m.setFocus([(xs.length ? Math.min(...xs) : 0.4) - 0.03, (ys.length ? Math.min(...ys) : 0.4) - 0.03],
      [(xs.length ? Math.max(...xs) : 0.6) + 0.03, (ys.length ? Math.max(...ys) : 0.6) + 0.03]);
    m.applyCamera(p.e.did3D ? (p.e.camera ?? 'coach') : 'coach', false);
  } else {
    m.setFocus([0, 0], [1, 1]);
    m.applyCamera(p.e.camera ?? 'coach', false);
  }
  p.e.did3D = true;
}

definirMontage('placement.3d', (el) => {
  const p = courant;
  if (!p) return null;
  const canvas = hoteCanvas(el, 'Terrain 3D du placement');
  p.moteur = new Terrain3D(canvas, { editable: true });
  preparer3D(p);
  const m = p.moteur;
  return () => { m.detruire(); if (p.moteur === m) p.moteur = null; };
});

// MARK: - Terrain 2D : gestes (glisser, appui long, dessin)

definirMontage('placement.terrain', (el) => {
  const p = courant;
  if (!p) return null;
  const mesurer = () => {
    const r = el.getBoundingClientRect();
    const t = { pw: r.width, ph: r.height };
    if (!p.e.taille || Math.abs(p.e.taille.pw - t.pw) > 0.5 || Math.abs(p.e.taille.ph - t.ph) > 0.5) { p.e.taille = t; rafraichir(); }
  };
  const obs = new ResizeObserver(mesurer);
  obs.observe(el);
  mesurer();

  let geste = null;
  const local = (ev) => {
    const r = el.getBoundingClientRect();
    let x = (ev.clientX - r.left) / r.width; let y = (ev.clientY - r.top) / r.height;
    if (p.e.miroir) { x = 1 - x; y = 1 - y; }
    const v = rectangleVisible(p.e);
    return { x: v.x + x * v.l, y: v.y + y * v.h };
  };
  const bas = (ev) => {
    if (ev.button > 0) return;
    const cible = ev.target.closest('[data-glisser]');
    const debut = { x: ev.clientX, y: ev.clientY };
    if (p.e.outil === 'draw') {
      geste = { type: 'dessin', debut };
      try { el.setPointerCapture?.(ev.pointerId); } catch { /* pointeur simulé */ }
      ev.preventDefault();
      return;
    }
    if (!cible) return;
    const [type, id] = cible.dataset.glisser.split(':');
    geste = { type, id, debut, actif: false };
    try { el.setPointerCapture?.(ev.pointerId); } catch { /* pointeur simulé */ }
    ev.preventDefault();
    geste.minuterie = setTimeout(() => {
      if (!geste || geste.actif) return;
      appuiLong(p, type, id);
      geste = null;
      rafraichir();
    }, 550);
  };
  const deplace = (ev) => {
    if (!geste) return;
    const d = Math.hypot(ev.clientX - geste.debut.x, ev.clientY - geste.debut.y);
    if (geste.type === 'dessin') {
      if (d < 2 && !p.e.trace) return;
      const q = local(ev);
      const pt = { x: Math.min(Math.max(q.x, 0), 1), y: Math.min(Math.max(q.y, 0), 1) };
      if (!p.e.trace) p.e.trace = [pt]; else p.e.trace.push(pt);
      rafraichir();
      return;
    }
    if (!geste.actif && d < 10) return;
    geste.actif = true;
    clearTimeout(geste.minuterie);
    const q = local(ev);
    p.e.glisse = geste.type === 'ballon' ? 'ballon' : geste.id;
    if (geste.type === 'ballon') {
      p.e.porteur = null;
      p.e.ballon = { x: Math.min(Math.max(q.x, 0.01), 0.99), y: Math.min(Math.max(q.y, 0.005), 0.995) };
    } else {
      deplacerActeur(p, geste.type === 'adv' ? `adv-${geste.id}` : geste.id, q);
    }
    rafraichir();
  };
  const haut = () => {
    if (!geste) return;
    clearTimeout(geste.minuterie);
    if (geste.type === 'dessin') {
      if (p.e.trace && p.e.trace.length > 1) p.e.traces.push(p.e.trace);
      p.e.trace = null;
    } else if (geste.actif && geste.type === 'ballon' && p.e.ballon && p.e.taille) {
      const v = rectangleVisible(p.e);
      lacherBallon(p, [p.e.ballon.x, p.e.ballon.y], metriquePoints(p.e.taille.pw / v.l, p.e.taille.ph / v.h));
    }
    p.e.glisse = null;
    geste = null;
    rafraichir();
  };
  el.addEventListener('pointerdown', bas);
  el.addEventListener('pointermove', deplace);
  el.addEventListener('pointerup', haut);
  el.addEventListener('pointercancel', haut);
  const menu = (ev) => { if (ev.target.closest('[data-glisser]')) ev.preventDefault(); };
  el.addEventListener('contextmenu', menu);
  return () => {
    obs.disconnect();
    el.removeEventListener('pointerdown', bas);
    el.removeEventListener('pointermove', deplace);
    el.removeEventListener('pointerup', haut);
    el.removeEventListener('pointercancel', haut);
    el.removeEventListener('contextmenu', menu);
  };
});

/** Appui long : retire l'adversaire, le ballon, ou le joueur ajouté (mode entraînement) */
function appuiLong(p, type, id) {
  const e = p.e;
  if (type === 'adv') {
    if (e.porteur === `adv-${id}`) e.porteur = null;
    e.adversaires = e.adversaires.filter((a) => a.id !== id);
  } else if (type === 'ballon') {
    e.ballon = null;
    e.porteur = null;
  } else if (type === 'joueur' && p.trainingMode) {
    retirerCoequipier(p, id);
  }
}

// MARK: - Dessin du terrain 2D

/** Tracé du terrain (PitchMarkings) dans un cadre de l × h points */
function marquages(l, ht) {
  const t = 'stroke="rgba(255,255,255,0.7)" stroke-width="1.5" fill="none"';
  const mi = ht / 2;
  const rc = Math.min(l, ht) * 0.1;
  const pw = (l - 16) * 0.55; const ph = ht * 0.14; const px = (l - pw) / 2;
  const gw = (l - 16) * 0.25; const gh = ht * 0.05; const gx = (l - gw) / 2;
  const coin = 10;
  return `<rect x="0" y="0" width="${l}" height="${ht}" rx="8" fill="rgba(52,199,89,0.35)"/>
    <rect x="8" y="8" width="${l - 16}" height="${ht - 16}" ${t}/>
    <line x1="8" y1="${mi}" x2="${l - 8}" y2="${mi}" ${t}/>
    <circle cx="${l / 2}" cy="${mi}" r="${rc}" ${t}/>
    <circle cx="${l / 2}" cy="${mi}" r="3" fill="rgba(255,255,255,0.7)"/>
    <rect x="${px}" y="8" width="${pw}" height="${ph}" ${t}/>
    <rect x="${gx}" y="8" width="${gw}" height="${gh}" ${t}/>
    <rect x="${px}" y="${ht - 8 - ph}" width="${pw}" height="${ph}" ${t}/>
    <rect x="${gx}" y="${ht - 8 - gh}" width="${gw}" height="${gh}" ${t}/>
    <path d="M${8 + coin},8 A${coin},${coin} 0 0 1 8,${8 + coin}" ${t}/>
    <path d="M${l - 8},${8 + coin} A${coin},${coin} 0 0 1 ${l - 8 - coin},8" ${t}/>
    <path d="M8,${ht - 8 - coin} A${coin},${coin} 0 0 1 ${8 + coin},${ht - 8}" ${t}/>
    <path d="M${l - 8 - coin},${ht - 8} A${coin},${coin} 0 0 1 ${l - 8},${ht - 8 - coin}" ${t}/>`;
}

/** Tracé jaune avec flèche au bout (DrawingPath) */
function traceSVG(pts, l, ht) {
  if (pts.length < 2) return '';
  const d = pts.map((q, i) => `${i ? 'L' : 'M'}${(q.x * l).toFixed(1)},${(q.y * ht).toFixed(1)}`).join(' ');
  const a = pts[pts.length - 1]; const b = pts[pts.length - 2];
  const lx = a.x * l; const ly = a.y * ht;
  const ang = Math.atan2(ly - b.y * ht, lx - b.x * l);
  const pointe = [ang - Math.PI / 6, ang + Math.PI / 6].map((x) => `M${lx},${ly} L${lx - 12 * Math.cos(x)},${ly - 12 * Math.sin(x)}`).join(' ');
  return `<path d="${d}" fill="none" stroke="#FFCC00" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${pointe}" fill="none" stroke="#FFCC00" stroke-width="3" stroke-linecap="round"/>`;
}

const COULEURS_2D = {
  course: { equipe: '#ffffff', adversaire: 'rgb(255,140,140)', joker: 'rgb(140,217,255)' },
  passe: 'rgb(255,219,26)', conduite: 'rgb(255,140,26)', tir: 'rgb(255,56,56)',
};

/** Flèches de l'aperçu sur le terrain 2D (TacticArrowsOverlay) */
function flecheSVG(f, l, ht) {
  let a = { x: f.de[0] * l, y: f.de[1] * ht };
  let b = { x: f.a[0] * l, y: f.a[1] * ht };
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len <= 6) return '';
  const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  const course = f.type === 'course' || f.type === 'conduite';
  const d0 = course ? 22 : 10; const d1 = f.type === 'tir' ? 0 : (course ? 26 : 18);
  if (len > d0 + d1 + 10) { a = { x: a.x + dir.x * d0, y: a.y + dir.y * d0 }; b = { x: b.x - dir.x * d1, y: b.y - dir.y * d1 }; }
  const n = { x: -dir.y, y: dir.x };
  const coul = f.type === 'course' ? COULEURS_2D.course[f.camp] ?? '#ffffff' : COULEURS_2D[f.type];
  let chemin; let avant = a;
  if (f.type === 'conduite') {
    const total = Math.hypot(b.x - a.x, b.y - a.y);
    const k = Math.max(12, Math.trunc(total / 3));
    const pts = [`M${a.x},${a.y}`];
    for (let i = 1; i <= k; i++) {
      const d = total * (i / k);
      const fondu = Math.min(1, (total - d) / 14);
      const dec = Math.sin((d / 15) * 2 * Math.PI) * 4.5 * fondu;
      const q = { x: a.x + dir.x * d + n.x * dec, y: a.y + dir.y * d + n.y * dec };
      pts.push(`L${q.x.toFixed(1)},${q.y.toFixed(1)}`);
      if (i === k - 1) avant = q;
    }
    chemin = pts.join(' ');
  } else if (f.type === 'passe' && f.aerien) {
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const bombe = Math.hypot(b.x - a.x, b.y - a.y) * 0.18;
    const c = { x: m.x + n.x * bombe, y: m.y + n.y * bombe };
    chemin = `M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`;
    avant = { x: (c.x + b.x) / 2, y: (c.y + b.y) / 2 };
  } else chemin = `M${a.x},${a.y} L${b.x},${b.y}`;
  const ep = f.type === 'tir' ? 4 : 3;
  const tirets = f.type === 'course' ? 'stroke-dasharray="7 5"' : '';
  let hd = { x: b.x - avant.x, y: b.y - avant.y };
  const hl = Math.max(0.001, Math.hypot(hd.x, hd.y));
  hd = { x: hd.x / hl, y: hd.y / hl };
  const hn = { x: -hd.y, y: hd.x };
  const t1 = { x: b.x - hd.x * 11 + hn.x * 4.5, y: b.y - hd.y * 11 + hn.y * 4.5 };
  const t2 = { x: b.x - hd.x * 11 - hn.x * 4.5, y: b.y - hd.y * 11 - hn.y * 4.5 };
  return `<path d="${chemin}" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="${ep + 2}" stroke-linecap="round" ${tirets}/>
    <path d="${chemin}" fill="none" stroke="${coul}" stroke-width="${ep}" stroke-linecap="round" stroke-linejoin="round" ${tirets}/>
    <path d="M${b.x},${b.y} L${t1.x},${t1.y} L${t2.x},${t2.y} Z" fill="${coul}"/>`;
}

function jetonJoueur(p, j, { petit = false, glisse = false, ballon = false } = {}) {
  const m = maillot(p.jerseyColor);
  const taille = petit ? 40 : 48;
  const nom = !(j.firstName === '' && j.lastName === '');
  return `<span class="jeton${petit ? ' petit' : ''}${glisse ? ' glisse' : ''}" style="--taille:${taille}px">
    <span class="jeton-rond${ballon ? ' a-ballon' : ''}" style="background:${m.css};color:${m.texte}">
      <span class="jeton-numero">${j.shirtNumber}</span>
      ${j.isCaptain ? `<span class="jeton-capitaine">${icone('star.fill')}</span>` : ''}
      ${!petit && nom ? `<span class="jeton-poste">${h(POSTE_COURT[j.position] ?? '')}</span>` : ''}
    </span>
    <span class="jeton-nom">${nom ? h(matchPlayerDisplayName(j)) : '&nbsp;'}</span>
  </span>`;
}

function jetonAdversaire(p, o, { glisse = false, ballon = false } = {}) {
  const m = maillot(p.opponentJerseyColor);
  return `<span class="jeton adv${glisse ? ' glisse' : ''}" style="--taille:42px">
    <span class="jeton-rond${ballon ? ' a-ballon' : ' bord-blanc'}" style="background:${m.css};color:${m.texte}"><span class="jeton-numero">${o.number}</span></span>
    <span class="jeton-adv">ADV</span>
  </span>`;
}

function terrain2D(p) {
  const e = p.e;
  const v = rectangleVisible(e);
  const vers = (q) => ({ x: ((q.x - v.x) / v.l) * 100, y: ((q.y - v.y) / v.h) * 100 });
  let fond = '';
  if (e.taille) {
    const L = e.taille.pw / v.l; const H = e.taille.ph / v.h;
    const fleches = apercu(p)?.fleches ?? [];
    fond = `<svg class="terrain-fond" width="${L}" height="${H}" style="left:${-v.x * L}px;top:${-v.y * H}px" aria-hidden="true">
      ${marquages(L, H)}
      ${e.traces.map((t) => traceSVG(t, L, H)).join('')}
      ${e.trace ? traceSVG(e.trace, L, H) : ''}
      ${fleches.map((f) => flecheSVG(f, L, H)).join('')}
    </svg>`;
  }
  const jetons = [];
  for (const j of lesTitulaires(p)) {
    const q = e.positions[j.id];
    if (!q) continue;
    const c = vers(q);
    jetons.push(`<div class="pion${e.glisse === j.id ? ' devant' : ''}" style="left:${c.x}%;top:${c.y}%" data-glisser="joueur:${j.id}" data-key="pion-${j.id}"
      role="img" aria-label="Joueur ${j.shirtNumber}${e.porteur === j.id ? ', avec le ballon' : ''}">${jetonJoueur(p, j, { glisse: e.glisse === j.id, ballon: e.porteur === j.id })}</div>`);
  }
  for (const o of e.adversaires) {
    const c = vers(o.position);
    const id = `adv-${o.id}`;
    jetons.push(`<div class="pion${e.glisse === id ? ' devant' : ''}" style="left:${c.x}%;top:${c.y}%" data-glisser="adv:${o.id}" data-key="pion-${id}"
      role="img" aria-label="Adversaire ${o.number}${e.porteur === id ? ', avec le ballon' : ''}">${jetonAdversaire(p, o, { glisse: e.glisse === id, ballon: e.porteur === id })}</div>`);
  }
  let ballon = '';
  if (e.ballon) {
    let style;
    const q = e.porteur ? pointDe(p, e.porteur) : null;
    if (q) { const c = vers(q); style = `left:calc(${c.x}% + 22px);top:calc(${c.y}% + 12px)`; }
    else { const c = vers(e.ballon); style = `left:${c.x}%;top:${c.y}%`; }
    ballon = `<div class="pion ballon-2d${e.glisse === 'ballon' ? ' glisse devant' : ''}" style="${style}" data-glisser="ballon" data-key="pion-ballon" role="img" aria-label="Ballon">⚽️</div>`;
  }
  return `<div class="placement-terrain${e.outil === 'draw' ? ' dessin' : ''}" data-monter="placement.terrain" data-key="placement-2d">
    <div class="placement-tourne${e.miroir ? ' miroir' : ''}">${fond}${jetons.join('')}${ballon}</div>
  </div>`;
}

function bandeSequence(p) {
  const e = p.e;
  const chips = e.etapes.length
    ? `<div class="etapes-puces">${e.etapes.map((_, i) => `<button type="button" class="puce-etape${e.edition === i ? ' choisie' : ''}" data-action="placement.chargerEtape" data-index="${i}" aria-label="Revoir l'étape ${i + 1}">${i + 1}</button>`).join('')}</div>`
    : '<b class="petit">Séquence</b>';
  return `<div class="bande-sequence">
    <div class="ligne-flex">
      ${icone('film.stack')}${chips}
      <span class="espace"></span>
      <button type="button" class="bouton-violet" data-action="placement.aide" aria-label="Aide">${icone('questionmark.circle')}</button>
      ${e.etapes.length ? `<button type="button" class="bouton-violet" data-action="placement.etapes" aria-label="Étapes">${icone('list.bullet.rectangle')}</button>
        <button type="button" class="bouton-violet grand" data-action="placement.lire" aria-label="Lire la démonstration" ${e.etapes.length < 2 ? 'disabled' : ''}>${icone('play.circle.fill')}</button>` : ''}
    </div>
    <div class="ligne-flex">
      <span class="resume-sequence${e.toast ? ' toast-violet' : ''}">${h(e.toast ?? resumeAction(p))}</span>
      ${e.ballon && e.etapes.length && e.edition !== 0 ? `<button type="button" class="en-lair${e.aerien ? ' actif' : ''}" data-action="placement.aerien" aria-label="Ballon en l'air">${icone('arrow.up.forward')}En l'air</button>` : ''}
      ${e.edition != null ? '<button type="button" class="bouton texte petit" data-action="placement.finirEdition">Annuler</button>' : ''}
      <button type="button" class="bouton plein petit capture" style="--bouton:var(--violet)" data-action="placement.capturer">${icone(e.edition != null ? 'checkmark.circle.fill' : 'plus.circle.fill')}<span>${h(libelleCapture(e))}</span></button>
    </div>
  </div>`;
}

function barreOutils(p) {
  const e = p.e;
  const outil = (nom, libelle, actif, act, desactive = false) => `<button type="button" class="outil${actif ? ' actif' : ''}" data-action="${act}" aria-label="${h(libelle)}" title="${h(libelle)}" ${desactive ? 'disabled' : ''}>${icone(nom)}</button>`;
  const maillotAdv = maillot(p.opponentJerseyColor);
  const maillotEq = maillot(p.jerseyColor);
  return `<div class="barre-outils">
    ${outil('hand.point.up.left.fill', 'Déplacer', e.outil === 'move', 'placement.outilDeplacer')}
    ${outil('pencil.tip.crop.circle', 'Dessiner', e.outil === 'draw', 'placement.outilDessin', e.vue3D)}
    ${!p.trainingMode ? `<button type="button" class="outil violet" data-action="placement.capturer" aria-label="Capturer une étape" title="Capturer une étape">${icone('camera.viewfinder')}</button>` : ''}
    <span class="separateur-vertical"></span>
    ${p.trainingMode ? `<button type="button" class="outil" style="color:${maillotEq.id === 'Blanc' ? 'var(--bleu)' : maillotEq.css}" data-action="placement.ajouterJoueur" aria-label="Ajouter un joueur" title="Ajouter un joueur">${icone('person.crop.circle.badge.plus')}</button>` : ''}
    <button type="button" class="outil" style="color:${maillotAdv.id === 'Rouge' ? 'var(--rouge)' : maillotAdv.css}" data-action="placement.ajouterAdversaire" aria-label="Ajouter un adversaire" title="Ajouter un adversaire">${icone('plus.circle.fill')}</button>
    <button type="button" class="outil ballon-outil${e.ballon ? ' present' : ''}" data-action="placement.ballon" aria-label="${e.ballon ? 'Retirer le ballon' : 'Placer le ballon'}" title="${e.ballon ? 'Retirer le ballon' : 'Placer le ballon'}">⚽️</button>
    <span class="espace"></span>
    ${e.traces.length ? `<button type="button" class="outil" style="color:var(--orange)" data-action="placement.effacerTraces" aria-label="Effacer les tracés" title="Effacer les tracés">${icone('eraser.fill')}</button>` : ''}
    ${e.adversaires.length ? `<button type="button" class="outil" style="color:var(--rouge)" data-action="placement.retirerAdversaires" aria-label="Retirer les adversaires" title="Retirer les adversaires">${icone('trash.fill')}</button>` : ''}
  </div>`;
}

definirPage('placement', (p) => {
  initialiser(p);
  courant = p;
  const e = p.e;
  const tit = lesTitulaires(p);
  const remp = lesRemplacants(p);
  const entete = `<div class="placement-entete">
    <span class="petit gras secondaire">${!p.trainingMode && e.formation ? h(e.formation) : p.trainingMode ? `${tit.length} joueur${tit.length > 1 ? 's' : ''} · ${e.adversaires.length} adv.` : ''}</span>
    <span class="espace"></span>
    ${!e.vue3D ? `<button type="button" class="menu-zoom" data-action="placement.zoom" aria-label="Cadrage du terrain">${icone(ZOOMS[e.zoom].icone)}<span>${h(ZOOMS[e.zoom].titre)}</span></button>` : ''}
    ${segmente({ valeur: e.vue3D ? '3d' : '2d', options: [['2d', '2D'], ['3d', '3D']], action: 'placement.vue', classe: 'segmente-vue' })}
  </div>`;
  const terrain = e.vue3D
    ? `<div class="placement-3d-cadre">
        <div class="placement-3d" data-monter="placement.3d" data-key="placement-3d"></div>
        <div class="placement-cameras">${selecteurCamera(e.camera ?? 'coach', 'placement.camera')}</div>
        <span class="placement-astuce">Glissez un joueur ou le ballon · tournez la caméra ailleurs</span>
      </div>`
    : terrain2D(p);
  const banc = remp.length ? `<div class="banc">
      <span class="petit gras secondaire">Remplaçants</span>
      <div class="banc-jetons">${remp.map((j) => jetonJoueur(p, j, { petit: true })).join('')}</div>
    </div>` : '';
  const gauche = p.trainingMode
    ? boutonBarre({ libelle: 'Fermer', action: 'placement.fermer' })
    : [
      boutonBarre({ icone: 'xmark', titre: 'Fermer sans enregistrer', action: 'placement.fermer' }),
      boutonBarre({ icone: 'rectangle.3.group', titre: 'Formation', action: 'placement.formation' }),
      boutonBarre({ icone: e.miroir ? 'person.fill' : 'person.2.fill', titre: 'Miroir', action: 'placement.miroir', desactive: e.vue3D }),
    ].join('');
  return {
    titre: p.trainingMode ? (p.initialPlay?.titre ?? 'Nouvelle séquence') : 'Placement',
    gauche: `${gauche}${boutonBarre({ icone: 'film.stack', titre: 'Séquence et tactiques', action: 'placement.menuSequence' })}`,
    droite: boutonBarre({ libelle: 'Enregistrer', gras: true, action: 'placement.enregistrer' }),
    classe: 'sans-marge defile-placement',
    contenu: `<div class="placement">
      ${entete}
      ${terrain}
      ${p.trainingMode || e.etapes.length || e.toast ? bandeSequence(p) : ''}
      ${banc}
    </div>`,
    pied: barreOutils(p),
  };
});

// MARK: - Actions

const avec = (fn) => (el, ev) => { const p = page(); if (!p) return false; const r = fn(p, el, ev); synchro(p); return r; };

action('placement.fermer', avec((p) => {
  if (p.trainingMode && p.e.sale && p.e.etapes.length) {
    choix({
      titre: 'Quitter sans enregistrer la séquence ?',
      actions: [
        { libelle: "Enregistrer d'abord", faire: () => demanderEnregistrement(p) },
        { libelle: 'Quitter sans enregistrer', role: 'detruire', faire: () => fermerFeuille('placement') },
      ],
    });
    return false;
  }
  fermerFeuille('placement');
}));

action('placement.enregistrer', avec((p) => {
  if (p.trainingMode) { demanderEnregistrement(p); return; }
  const positions = Object.fromEntries(Object.entries(p.e.positions).map(([id, q]) => [id, { x: q.x, y: q.y }]));
  p.surEnregistrer?.(positions, p.e.formation);
  fermerFeuille('placement');
}));

action('placement.formation', avec((p) => {
  choix({
    titre: 'Formation',
    actions: [
      ...FORMATIONS.map((f) => ({ libelle: f.nom, faire: () => { formation(p, f.id); synchro(p); } })),
      { libelle: 'Auto (par poste)', icone: 'wand.and.stars', faire: () => { formation(p, 'auto'); synchro(p); } },
    ],
  });
  return false;
}));

action('placement.miroir', avec((p) => { p.e.miroir = !p.e.miroir; }));
action('placement.vue', avec((p, el) => {
  const vers3D = el.dataset.valeur === '3d';
  if (vers3D === p.e.vue3D) return;
  p.e.vue3D = vers3D;
  if (vers3D) p.e.outil = 'move';
}));
action('placement.camera', avec((p, el) => { p.moteur?.applyCamera(el.dataset.camera, true); }));
action('placement.zoom', avec((p) => {
  choix({
    titre: 'Cadrage du terrain',
    actions: [
      ...Object.entries(ZOOMS).map(([id, z]) => ({ libelle: z.titre, icone: p.e.zoom === id ? 'checkmark' : z.icone, faire: () => choisirZoom(p, id) })),
      { libelle: 'Recentrer sur les joueurs', icone: 'scope', faire: () => recentrer(p) },
    ],
  });
  return false;
}));
action('placement.outilDeplacer', avec((p) => { p.e.outil = 'move'; }));
action('placement.outilDessin', avec((p) => { p.e.outil = 'draw'; }));
action('placement.ajouterJoueur', avec((p) => ajouterCoequipier(p)));
action('placement.ajouterAdversaire', avec((p) => ajouterAdversaire(p)));
action('placement.ballon', avec((p) => basculerBallon(p)));
action('placement.effacerTraces', avec((p) => { p.e.traces = []; }));
action('placement.retirerAdversaires', avec((p) => {
  if (p.e.porteur?.startsWith('adv-')) p.e.porteur = null;
  p.e.adversaires = [];
  p.e.prochainAdv = 1;
}));
action('placement.capturer', avec((p) => capturer(p)));
action('placement.aerien', avec((p) => { p.e.aerien = !p.e.aerien; }));
action('placement.finirEdition', avec((p) => finirEdition(p)));
action('placement.chargerEtape', avec((p, el) => chargerEtape(p, Number(el.dataset.index))));
action('placement.lire', avec((p) => { lireSequence(p); }));
action('placement.aide', () => { ouvrirFeuille('sequence.aide', {}); });
action('placement.etapes', avec((p) => { ouvrirFeuille('sequence.etapes', { placement: p }); }));

action('placement.menuSequence', avec((p) => {
  const e = p.e;
  const liste = [{ libelle: libelleCapture(e), icone: 'camera.viewfinder', faire: () => { capturer(p); synchro(p); } }];
  if (e.etapes.length >= 2) liste.push({ libelle: 'Lire la démonstration', icone: 'play.circle', faire: () => lireSequence(p) });
  if (e.etapes.length) liste.push({ libelle: 'Étapes (titres, consignes…)', icone: 'list.bullet.rectangle', faire: () => ouvrirFeuille('sequence.etapes', { placement: p }) });
  if (e.etapes.length >= 2) liste.push({ libelle: 'Enregistrer dans mes tactiques', icone: 'square.and.arrow.down', faire: () => demanderEnregistrement(p) });
  if (e.etapes.length) liste.push({ libelle: 'Effacer la séquence', icone: 'trash', role: 'detruire', faire: () => { effacerSequence(p); synchro(p); } });
  liste.push({ libelle: 'Comment construire une séquence', icone: 'questionmark.circle', faire: () => ouvrirFeuille('sequence.aide', {}) });
  if (!p.trainingMode) {
    liste.push({ libelle: "Atelier d'exercices", icone: 'square.and.pencil', faire: () => ouvrirFeuille('atelier.accueil', { palette: palette3D(p), roster: p.roster }, { plein: true }) });
  }
  choix({ titre: 'Séquence pas à pas', actions: liste });
  return false;
}));

// MARK: - Liste des étapes (SequenceStepsSheet)

definirPage('sequence.etapes', (f) => {
  const p = f.placement;
  const etapes = p.e.etapes;
  return {
    titre: 'Étapes de la séquence',
    gauche: '',
    droite: `${boutonBarre({ icone: 'play.circle.fill', titre: 'Lire', action: 'etapes.lire', desactive: etapes.length < 2 })}${boutonBarre({ libelle: 'OK', gras: true, action: 'nav.fermer' })}`,
    contenu: `<div class="colonne">${etapes.map((e, i) => section({
      entete: `Étape ${i + 1}`,
      cle: `etape-${i}`,
      lignes: [
        champ({ valeur: e.titre, placeholder: i === 0 ? 'Mise en place' : "Titre de l'étape", input: 'etapes.titre', data: { index: i }, classe: 'champ-titre', cle: `titre-${i}` }),
        champ({ valeur: e.texte, placeholder: 'Consigne pour les joueurs (facultatif)…', input: 'etapes.texte', data: { index: i }, multiligne: true, lignes: 2, cle: `texte-${i}` }),
        i > 0 ? interrupteur({ titre: "Ballon en l'air (centre, transversale)", icone: 'arrow.up.forward.circle', actif: e.aerien === true, action: 'etapes.aerien', data: { index: i } }) : '',
        i > 0 ? `<div class="ligne ligne-stepper"><span class="ligne-icone">${icone('timer')}</span><span class="ligne-textes"><span class="ligne-titre">Durée de l'animation : ${decimal(e.duree ?? 2, 1)} s</span></span>
          <span class="stepper">
            <button type="button" data-action="etapes.duree" data-index="${i}" data-pas="-1" ${(e.duree ?? 2) <= 0.8 + 1e-9 ? 'disabled' : ''} aria-label="Moins">${icone('minus')}</button>
            <button type="button" data-action="etapes.duree" data-index="${i}" data-pas="1" ${(e.duree ?? 2) >= 4 - 1e-9 ? 'disabled' : ''} aria-label="Plus">${icone('plus')}</button>
          </span></div>` : '',
        ligne({ titre: 'Afficher sur le terrain pour la corriger', icone: 'hand.draw', action: 'etapes.afficher', data: { index: i }, teinte: true, classe: 'avec-icone' }),
        ligne({ titre: "Supprimer l'étape", icone: 'trash', couleurIcone: 'red', action: 'etapes.supprimer', data: { index: i }, detruire: true, classe: 'avec-icone' }),
      ],
    })).join('')}</div>`,
  };
});

const placementDesEtapes = () => etat.feuilles.find((f) => f.page === 'sequence.etapes')?.params.placement ?? null;
const modifierEtape = (fn) => (el) => {
  const p = placementDesEtapes();
  const e = p?.e.etapes[Number(el.dataset.index)];
  if (!e) return false;
  const r = fn(e, el, p);
  p.e.sale = true;
  synchro(p);
  return r;
};

action('etapes.titre', modifierEtape((e, el) => { e.titre = el.value; return false; }));
action('etapes.texte', modifierEtape((e, el) => { e.texte = el.value; return false; }));
action('etapes.aerien', modifierEtape((e, el) => { if (el.checked) e.aerien = true; else delete e.aerien; }));
action('etapes.duree', modifierEtape((e, el) => {
  const v = Math.round(((e.duree ?? 2) + Number(el.dataset.pas) * 0.2) * 10) / 10;
  e.duree = Math.min(4, Math.max(0.8, v));
}));
action('etapes.afficher', (el) => {
  const p = placementDesEtapes();
  if (!p) return;
  fermerFeuille('sequence.etapes');
  chargerEtape(p, Number(el.dataset.index));
  synchro(p);
});
action('etapes.supprimer', (el) => {
  const p = placementDesEtapes();
  const i = Number(el.dataset.index);
  if (!p) return false;
  choix({
    titre: `Supprimer l'étape ${i + 1} ?`,
    actions: [{
      libelle: 'Supprimer', role: 'detruire',
      faire: () => {
        p.e.etapes.splice(i, 1);
        p.e.sale = true;
        if (p.e.edition != null && !p.e.etapes[p.e.edition]) p.e.edition = null;
        synchro(p);
      },
    }],
  });
  return false;
});
action('etapes.lire', () => {
  const p = placementDesEtapes();
  if (!p) return;
  fermerFeuille('sequence.etapes');
  setTimeout(() => lireSequence(p), 400);
});

// MARK: - Aide (SequenceHelpSheet)

const GESTES = [
  ['figure.run', 'Course', "Déplacez un joueur qui n'a pas le ballon."],
  ['figure.soccer', 'Conduite de balle', 'Déplacez le joueur qui a le ballon : le ballon suit à ses pieds.'],
  ['arrow.right.circle', 'Passe', 'Faites glisser le ballon sur un partenaire : il se colle à ses pieds.'],
  ['arrow.up.forward.circle', 'Centre, transversale', "Activez « En l'air » avant de valider l'étape : la passe devient aérienne."],
  ['scope', 'Tir', 'Faites glisser le ballon dans le but.'],
  ['arrow.uturn.backward.circle', 'Récupération', 'Faites glisser le ballon sur un adversaire.'],
];

definirPage('sequence.aide', () => ({
  titre: 'Comment construire une séquence',
  gauche: '',
  droite: boutonBarre({ libelle: 'OK', gras: true, action: 'nav.fermer' }),
  contenu: `<div class="colonne aide-sequence">
    ${section({
      entete: 'Construire une séquence',
      lignes: [
        ['1.circle.fill', 'Placez joueurs, adversaires et ballon, puis touchez « Mise en place ».'],
        ['2.circle.fill', 'Pour chaque étape : une action de ballon et autant de courses que vous voulez, puis « Étape suivante ».'],
        ['3.circle.fill', 'Avant de valider, les flèches montrent ce qui sera enregistré.'],
        ['4.circle.fill', 'Touchez « Lire » pour voir la démonstration, puis « Enregistrer ».'],
      ].map(([i, t]) => ligne({ titre: t, icone: i, classe: 'avec-icone multiligne' })),
    })}
    ${section({
      entete: 'Les gestes',
      lignes: GESTES.map(([i, titre, texte]) => ligne({
        icone: i, couleurIcone: 'purple', classe: 'avec-icone',
        contenu: `<span class="ligne-titre gras petit-titre">${h(titre)}</span><span class="ligne-sous-titre">${h(texte)}</span>`,
      })),
    })}
    ${section({
      entete: 'Corriger',
      lignes: [
        ['number.circle', "Touchez un numéro d'étape pour la revoir sur le terrain, corrigez, puis « Mettre à jour »."],
        ['list.bullet.rectangle', "☰ Étapes : titre, consigne pour les joueurs, durée, ballon en l'air."],
        ['soccerball', 'Le ballon se retire par un appui long (en 2D) ou avec le bouton ⚽️.'],
      ].map(([i, t]) => ligne({ titre: t, icone: i, classe: 'avec-icone multiligne' })),
    })}
    ${section({ entete: 'Légende des flèches', lignes: [`<div class="ligne">${legendeFleches(false)}</div>`] })}
  </div>`,
}));

export { ic };
