// Logique pure de la bibliothèque, du lecteur et du placement (sans interface) :
// formations (FormationView), joueurs du match dans le lecteur (rosterOverrides),
// textes (étapes, vitesses, résumés), recherche, noms de fichiers.
import {
  adapterFormation, nomFormation, decimal, pluriel, categorieTactique, iso, uuid, matchPlayerDisplayName,
  formatDateHeure,
} from '../../model.js';

// MARK: - Formations (FormationView.Formation)

export const FORMATIONS = [
  { id: 'f442', nom: '4-4-2', lignes: [1, 4, 4, 2] },
  { id: 'f433', nom: '4-3-3', lignes: [1, 4, 3, 3] },
  { id: 'f343', nom: '3-4-3', lignes: [1, 3, 4, 3] },
  { id: 'f352', nom: '3-5-2', lignes: [1, 3, 5, 2] },
  { id: 'f532', nom: '5-3-2', lignes: [1, 5, 3, 2] },
  { id: 'f4231', nom: '4-2-3-1', lignes: [1, 4, 2, 3, 1] },
  { id: 'f4141', nom: '4-1-4-1', lignes: [1, 4, 1, 4, 1] },
];

/** N joueurs répartis sur une ligne horizontale à la hauteur y */
export function repartirSurLigne(n, y) {
  if (n <= 0) return [];
  if (n === 1) return [{ x: 0.5, y }];
  const marge = 0.12;
  const ecart = (1 - 2 * marge) / (n - 1);
  return Array.from({ length: n }, (_, i) => ({ x: marge + ecart * i, y }));
}

/** Emplacements d'une formation définie (lignes gardien compris) */
export function emplacementsFormation(lignes) {
  const n = lignes.length;
  return lignes.map((k, i) => repartirSurLigne(k, n > 1 ? 0.9 - (i / (n - 1)) * 0.75 : 0.9));
}

/**
 * Applique une formation aux titulaires (applyFormation).
 * formationId : 'auto' ou un id de FORMATIONS. Renvoie { positions: { id: {x,y} }, nom } ou null.
 */
export function appliquerFormation(formationId, titulaires) {
  if (!titulaires.length) return null;
  const parPoste = (p) => titulaires.filter((j) => j.position === p);
  const gk = parPoste('Gardien'); const def = parPoste('Défenseur'); const mil = parPoste('Milieu'); const att = parPoste('Attaquant');
  const positions = {};
  if (formationId === 'auto') {
    const lignes = [
      repartirSurLigne(Math.max(gk.length, 1), 0.9), repartirSurLigne(def.length, 0.72),
      repartirSurLigne(mil.length, 0.45), repartirSurLigne(att.length, 0.18),
    ];
    [gk, def, mil, att].forEach((groupe, g) => groupe.forEach((j, i) => { if (i < lignes[g].length) positions[j.id] = lignes[g][i]; }));
    return { positions, nom: 'Auto' };
  }
  const f = FORMATIONS.find((x) => x.id === formationId);
  if (!f) return null;
  const lignes = adapterFormation(f.lignes, titulaires.length);
  const nom = lignes.join() === f.lignes.join() ? f.nom : nomFormation(lignes);
  const tous = emplacementsFormation(lignes).flat();
  [...gk, ...def, ...mil, ...att].forEach((j, i) => { positions[j.id] = tous[i] ?? { x: 0.5, y: 0.5 }; });
  return { positions, nom };
}

// MARK: - Lecteur

/** « 1× », « 0,5× », « 0,75× » */
export const libelleVitesse = (v) => (Number.isInteger(v) ? `${v}×` : `${decimal(v, String(v).split('.')[1]?.length ?? 1)}×`);
export const VITESSES = [0.5, 0.75, 1, 1.5, 2];

export function titreEtape(t, i) {
  const e = t.etapes[i];
  if (!e) return t.titre;
  if (e.titre !== '') return e.titre;
  return i === 0 ? 'Mise en place' : `Étape ${i + 1}`;
}

export function texteEtape(t, i) {
  const e = t.etapes[i];
  if (!e) return '';
  if (e.texte !== '') return e.texte;
  if (i === 0 && t.objectif !== '') return t.objectif;
  return i === 0 ? 'Appuyez sur lecture pour démarrer la démonstration.' : '';
}

/** Temps d'arrêt sur une étape avant la suivante (scheduleNext) */
export const tempsArret = (texte, vitesse) => (1 + Math.min(3.5, [...texte].length / 45)) / vitesse;

/** Associe les joueurs de « mon équipe » aux titulaires du match, par poste (rosterOverrides) */
export function joueursDuMatch(t, roster) {
  const titulaires = roster.filter((p) => p.status === 'Titulaire');
  const dispo = [...(titulaires.length ? titulaires : roster)].sort((a, b) => a.shirtNumber - b.shirtNumber);
  const res = {};
  const equipe = t.acteurs.filter((a) => a.camp === 'equipe');
  for (const a of equipe) {
    if (!a.poste) continue;
    const i = dispo.findIndex((p) => p.position === a.poste);
    if (i < 0) continue;
    const [p] = dispo.splice(i, 1);
    res[a.id] = { label: `${p.shirtNumber}`, name: matchPlayerDisplayName(p) };
  }
  for (const a of equipe) {
    if (res[a.id]) continue;
    if (!dispo.length) break;
    let i = dispo.findIndex((p) => (p.position === 'Gardien') === (a.poste === 'Gardien'));
    if (i < 0) i = 0;
    const [p] = dispo.splice(i, 1);
    res[a.id] = { label: `${p.shirtNumber}`, name: matchPlayerDisplayName(p) };
  }
  return res;
}

/** Joueurs affichés en 3D (configureActors) */
export function acteurs3D(t, { remplacements = {}, nomsVisibles = false } = {}) {
  return t.acteurs.map((a) => {
    const r = remplacements[a.id];
    return {
      id: a.id,
      team: a.camp,
      label: r?.label ?? a.numero,
      name: nomsVisibles ? (r?.name ?? a.nom ?? null) : null,
      isGoalkeeper: a.poste === 'Gardien',
      bib: a.chasuble ?? null,
    };
  });
}

/** Zone utile (positions + matériel) pour cadrer la caméra (focusBounds) */
export function zoneUtile(t) {
  const pts = [];
  for (const e of t.etapes) {
    pts.push(...Object.values(e.positions ?? {}));
    if (e.ballon) pts.push(e.ballon);
    for (const b of Object.values(e.autresBallons ?? {})) if (b.position) pts.push(b.position);
  }
  for (const m of t.materiel ?? []) {
    const w = (m.taille?.[0] ?? 0) / 2; const h = (m.taille?.[1] ?? 0) / 2;
    pts.push([m.pos[0] - w, m.pos[1] - h], [m.pos[0] + w, m.pos[1] + h]);
  }
  if (!pts.length) return { min: [0, 0], max: [1, 1] };
  let lo = [...pts[0]]; let hi = [...pts[0]];
  for (const p of pts) { lo = [Math.min(lo[0], p[0]), Math.min(lo[1], p[1])]; hi = [Math.max(hi[0], p[0]), Math.max(hi[1], p[1])]; }
  return { min: lo, max: hi };
}

export const aUnBallon = (t) => t.etapes.some((e) => e.porteur != null || e.ballon != null);

// MARK: - Bibliothèque

/** Comparaison sans casse ni accents (localizedStandardContains) */
export const sansAccents = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function correspond(t, recherche) {
  const q = sansAccents(recherche.trim());
  if (!q) return true;
  const botte = [t.titre, t.objectif, categorieTactique(t.categorie).nom, t.effectif ?? '', t.niveau ?? ''].join(' ');
  return sansAccents(botte).includes(q);
}

/** « 8 joueurs · 3 étapes · 2 évol. » (cardSummary) */
export function resumeCarte(t) {
  const parts = [];
  const n = t.acteurs.length;
  if (n > 0) parts.push(`${n} joueur${pluriel(n)}`);
  parts.push(`${t.etapes.length} étape${pluriel(t.etapes.length)}`);
  const ev = t.evolutions?.length ?? 0;
  if (ev > 0) parts.push(`${ev} évol.`);
  return parts.join(' · ');
}

const FORMAT_JOUR_SEANCE = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const FORMAT_TITRE_SEANCE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

/** « lun. 23 nov. · 3 exercices · 45 min » (planSummary) */
export function resumeSeance(plan) {
  const parts = [];
  if (plan.date) parts.push(FORMAT_JOUR_SEANCE.format(new Date(plan.date)));
  parts.push(`${plan.exercices.length} exercice${pluriel(plan.exercices.length)}`);
  parts.push(`${plan.exercices.reduce((s, i) => s + i.minutes, 0)} min`);
  return parts.join(' · ');
}

/** « Séance du 23 novembre » */
export const titreNouvelleSeance = (date = new Date()) => `Séance du ${FORMAT_TITRE_SEANCE.format(date)}`;

/** Nouvel exercice vierge de l'Atelier (AtelierEditorModel.newExercise) */
export function nouvelExercice(date = new Date()) {
  const jour = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
  return {
    id: uuid(), titre: `Exercice du ${jour}`, categorie: 'perso', objectif: '', consignes: [],
    acteurs: [], materiel: [], etapes: [{ titre: 'Mise en place', texte: '', positions: {} }],
    cadrage: { x: 0.5 - 20 / 68, y: 0.5 - 20 / 105, largeur: 40 / 68, longueur: 40 / 105 },
    perso: true, creeLe: iso(date),
  };
}

/** Nom du fichier partagé (TacticStore.exportURL) */
export function nomFichierTactiques(tactiques) {
  const nom = tactiques.length === 1 ? tactiques[0].titre : 'Tactiques Temps De Jeu';
  const sur = nom.split(/[/\\:?%*|"<>]/).join('-').trim();
  return `${sur === '' ? 'Tactique' : sur}.tdjt`;
}

/** Couleur d'une catégorie (TacticCategory.tint) */
export const TEINTE_CATEGORIE = {
  conservation: 'teal', construction: 'blue', attaque: 'orange', finition: 'red', pressing: 'pink',
  defense: 'indigo', transition: 'purple', cpa: 'green', perso: 'brown', autre: 'gray',
};

// MARK: - Placement : séquence enregistrée

/** Titre par défaut d'une séquence (defaultSequenceTitle) */
export function titreSequenceParDefaut({ modeEntrainement = false, formation = null, date = new Date() } = {}) {
  const d = formatDateHeure(iso(date), 'medium');
  if (modeEntrainement) return `Séance du ${d}`;
  if (formation) return `Séquence ${formation} – ${d}`;
  return `Séquence – ${d}`;
}

/** Exercice construit à partir de la séquence (makeSequencePlay) */
export function exerciceDeSequence({ id, titre, acteurs, etapes, modeEntrainement, formation, initial }) {
  const utiles = acteurs.filter((a) => etapes.some((e) => e.positions[a.id] != null));
  const nEquipe = utiles.filter((a) => a.camp === 'equipe').length;
  const nAdv = utiles.filter((a) => a.camp === 'adversaire').length;
  return {
    id,
    titre,
    categorie: 'perso',
    effectif: nAdv > 0 ? `${nEquipe} c ${nAdv}` : `${nEquipe} joueurs`,
    objectif: initial?.objectif ?? (modeEntrainement ? '' : `Séquence créée depuis le placement${formation ? ` (${formation})` : ''}.`),
    consignes: initial?.consignes ?? [],
    source: modeEntrainement ? 'Séance Temps De Jeu' : 'Placement Temps De Jeu',
    acteurs: utiles,
    materiel: [],
    etapes: structuredClone(etapes),
    perso: true,
    creeLe: initial?.creeLe ?? iso(),
  };
}
