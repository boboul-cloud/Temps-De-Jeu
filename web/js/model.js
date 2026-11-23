// Cœur de Temps De Jeu (version web) : port fidèle des modèles Swift (Models/*.swift),
// des calculs (temps de jeu, arrêts, présences, matériel, équipes) et du format d'échange
// (sauvegarde complète .tdjb, composition .tdj, matchs .tdjm, exercices .tdjt).
//
// Conventions :
// - Les objets en mémoire ont la forme exacte du JSON de l'app native (mêmes clés).
// - Dates : texte ISO 8601 sans fractions de seconde (« 2026-11-23T14:05:00Z »), comme
//   JSONEncoder.dateEncodingStrategy = .iso8601.
// - Identifiants : UUID en majuscules. Ensembles Swift (Set<UUID>) : tableaux.
// - Les valeurs absentes (nil) sont omises à l'écriture ; la lecture est tolérante.

// MARK: - Outils

export const uuid = () => (globalThis.crypto?.randomUUID
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  })).toUpperCase();

/** Date → texte ISO 8601 sans fractions (format de l'app native) */
export function iso(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return iso(new Date());
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Texte ISO (ou nombre, ou Date) → Date */
export function dateDe(valeur) {
  if (valeur instanceof Date) return valeur;
  if (typeof valeur === 'number') return new Date(valeur);
  const d = new Date(valeur ?? NaN);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** Lecture tolérante d'une date (accepte les fractions, les nombres) → ISO sans fractions, ou undefined */
export function lireDate(valeur) {
  if (valeur == null || valeur === '') return undefined;
  if (typeof valeur === 'number') {
    // Secondes depuis 2001 (stockage interne Swift) si la valeur est petite
    return iso(valeur < 1e11 ? new Date((valeur + 978307200) * 1000) : new Date(valeur));
  }
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? undefined : iso(d);
}

const texte = (v, defaut = '') => (typeof v === 'string' ? v : (v == null ? defaut : String(v)));
const nombre = (v, defaut = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : defaut));
const entier = (v, defaut = 0) => Math.trunc(nombre(v, defaut));
const booleen = (v, defaut = false) => (typeof v === 'boolean' ? v : defaut);
const tableau = (v) => (Array.isArray(v) ? v : []);
const idDe = (v) => (typeof v === 'string' && v !== '' ? v.toUpperCase() : uuid());
const idOpt = (v) => (typeof v === 'string' && v !== '' ? v.toUpperCase() : undefined);
const optTexte = (v) => (typeof v === 'string' ? v : undefined);
const optNombre = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const optBool = (v) => (typeof v === 'boolean' ? v : undefined);
const valeurDans = (v, liste, defaut) => (liste.includes(v) ? v : defaut);
const sansDoublons = (liste) => [...new Set(liste)];

/** Copie profonde sans les valeurs absentes (nil Swift → clé omise) */
export function propre(valeur) {
  if (Array.isArray(valeur)) return valeur.map(propre);
  if (valeur && typeof valeur === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(valeur)) {
      if (v === undefined || v === null) continue;
      res[k] = propre(v);
    }
    return res;
  }
  return valeur;
}

export const pluriel = (n, s = 's') => (n > 1 ? s : '');

/** Comparaison de textes à la française (localizedCompare) */
export const comparer = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'fr', { sensitivity: 'base' });

// MARK: - Dates et nombres en français

const fmt = (options) => new Intl.DateTimeFormat('fr-FR', options);
const FORMATS = {
  full: fmt({ dateStyle: 'full' }),      // lundi 23 novembre 2026
  long: fmt({ dateStyle: 'long' }),      // 23 novembre 2026
  medium: fmt({ dateStyle: 'medium' }),  // 23 nov. 2026
  short: fmt({ dateStyle: 'short' }),    // 23/11/2026
  heure: fmt({ hour: '2-digit', minute: '2-digit' }), // 14:05
};

/** Équivalent de DateFormatter (fr_FR) : style 'full' | 'long' | 'medium' | 'short' */
export function formatDate(valeur, style = 'medium') {
  if (valeur == null) return '';
  return (FORMATS[style] ?? FORMATS.medium).format(dateDe(valeur));
}

/** Heure « 14:05 » (timeStyle .short) */
export const formatHeure = (valeur) => (valeur == null ? '' : FORMATS.heure.format(dateDe(valeur)));

/** Date et heure : « 23 nov. 2026 à 14:05 » (dateStyle .medium, timeStyle .short) */
export const formatDateHeure = (valeur, style = 'medium') =>
  (valeur == null ? '' : `${formatDate(valeur, style)} à ${formatHeure(valeur)}`);

/** Date au format personnalisé de DateFormatter (dateFormat) : yyyy, MM, dd, HH, mm, EEEE, MMMM, MMM, d */
export function formatDateMotif(valeur, motif) {
  const d = dateDe(valeur);
  const deux = (n) => String(n).padStart(2, '0');
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const moisCourts = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const jetons = {
    yyyy: String(d.getFullYear()), yy: String(d.getFullYear()).slice(-2),
    MMMM: mois[d.getMonth()], MMM: moisCourts[d.getMonth()], MM: deux(d.getMonth() + 1),
    dd: deux(d.getDate()), d: String(d.getDate()),
    EEEE: jours[d.getDay()], EEE: jours[d.getDay()].slice(0, 3) + '.',
    HH: deux(d.getHours()), mm: deux(d.getMinutes()), ss: deux(d.getSeconds()),
  };
  return motif.replace(/yyyy|yy|MMMM|MMM|MM|dd|EEEE|EEE|HH|mm|ss|d|'[^']*'/g, (j) =>
    (j.startsWith("'") ? j.slice(1, -1) : jetons[j]));
}

/** Date locale à minuit (Calendar.startOfDay) */
export function debutDuJour(valeur) {
  const d = new Date(dateDe(valeur));
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Même jour civil */
export const memeJour = (a, b) => debutDuJour(a).getTime() === debutDuJour(b).getTime();

/** Nombre avec virgule décimale : decimal(12.5, 1) → « 12,5 » */
export function decimal(n, chiffres = 0) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: chiffres, maximumFractionDigits: chiffres, useGrouping: false }).format(n);
}

/** « 4,99 € » */
export const euros = (n) => `${decimal(n, 2)} €`;

/** Pourcentage arrondi : « 87 % » (String(format: "%.0f%%")) */
export const pourcent = (n, chiffres = 0) => `${decimal(n, chiffres)}%`;

// MARK: - TimeFormatters

const deuxChiffres = (n) => String(n).padStart(2, '0');

/** MM:SS */
export function formatTime(intervalle) {
  const total = Math.trunc(Math.max(0, intervalle));
  return `${deuxChiffres(Math.trunc(total / 60))}:${deuxChiffres(total % 60)}`;
}

/** MM:SS.d */
export function formatTimePrecise(intervalle) {
  const total = Math.max(0, intervalle);
  const minutes = Math.trunc(Math.trunc(total) / 60);
  const secondes = Math.trunc(total) % 60;
  const dixiemes = Math.trunc((total % 1) * 10);
  return `${deuxChiffres(minutes)}:${deuxChiffres(secondes)}.${dixiemes}`;
}

/** « 2'30 » ou « 45s » */
export function formatShort(intervalle) {
  const total = Math.trunc(Math.max(0, intervalle));
  const minutes = Math.trunc(total / 60);
  const secondes = total % 60;
  return minutes > 0 ? `${minutes}'${deuxChiffres(secondes)}` : `${secondes}s`;
}

/** « 45+3' » */
export function formatMatchMinute(intervalle, reglementaire) {
  const minutes = Math.trunc(intervalle / 60);
  if (intervalle > reglementaire) {
    const reg = Math.trunc(reglementaire / 60);
    return `${reg}+${minutes - reg}'`;
  }
  return `${minutes}'`;
}

// MARK: - Couleurs système (équivalents SwiftUI)

/** Couleurs nommées de SwiftUI → variables CSS (clair / sombre gérés par app.css) */
export const COULEURS = {
  green: 'var(--vert)', blue: 'var(--bleu)', orange: 'var(--orange)', red: 'var(--rouge)',
  purple: 'var(--violet)', pink: 'var(--rose)', yellow: 'var(--jaune)', cyan: 'var(--cyan)',
  indigo: 'var(--indigo)', teal: 'var(--teal)', mint: 'var(--menthe)', brown: 'var(--brun)',
  gray: 'var(--gris)', secondary: 'var(--texte-2)', primary: 'var(--texte)',
  cardYellow: '#FFCC00', cardRed: '#E61A1A', cardOrange: '#FF8C00', cardWhite: '#BFBFBF',
};
export const couleur = (nom) => COULEURS[nom] ?? nom;

// MARK: - Joueurs (PlayerModels.swift)

export const POSTES = ['Gardien', 'Défenseur', 'Milieu', 'Attaquant'];
export const POSTE_COURT = { Gardien: 'G', Défenseur: 'DEF', Milieu: 'MIL', Attaquant: 'ATT' };

export const DISPONIBILITES = ['Disponible', 'Blessé', 'Absent', 'Suspendu'];
export const DISPO_ICONE = {
  Disponible: 'checkmark.circle.fill', Blessé: 'cross.case.fill', Absent: 'person.slash.fill', Suspendu: 'exclamationmark.shield.fill',
};
export const DISPO_COULEUR = { Disponible: 'green', Blessé: 'red', Absent: 'orange', Suspendu: 'purple' };

export const STATUTS = ['Titulaire', 'Remplaçant', 'Expulsé', 'Expulsé temp.'];

export const CARTONS = { yellow: 'Jaune', red: 'Rouge', secondYellow: '2ème Jaune', white: 'Blanc' };
export const TYPES_CARTON = Object.values(CARTONS);

export function nouveauJoueur(champs = {}) {
  return lireJoueur({ id: uuid(), firstName: '', lastName: '', position: 'Milieu', availability: 'Disponible', ...champs });
}

export function lireJoueur(o = {}) {
  return {
    id: idDe(o.id),
    firstName: texte(o.firstName),
    lastName: texte(o.lastName),
    position: valeurDans(o.position, POSTES, 'Milieu'),
    availability: valeurDans(o.availability, DISPONIBILITES, 'Disponible'),
    photoData: optTexte(o.photoData),
    homeCategoryId: idOpt(o.homeCategoryId),
    phoneNumber: optTexte(o.phoneNumber),
  };
}

/** « J. Dupont », « Joueur » si vide (Player.displayName) */
export function displayName(p) {
  const prenom = p?.firstName ?? '';
  const nom = p?.lastName ?? '';
  if (prenom === '' && nom === '') return 'Joueur';
  return nom === '' ? prenom : `${[...prenom][0] ?? ''}. ${nom}`;
}

/** « Jean Dupont » (fullName) */
export const fullName = (p) => `${p?.firstName ?? ''} ${p?.lastName ?? ''}`.trim();

/** MatchPlayer.displayName : « Joueur #7 » si vide */
export function matchPlayerDisplayName(mp) {
  if ((mp.firstName ?? '') === '' && (mp.lastName ?? '') === '') return `Joueur #${mp.shirtNumber}`;
  return displayName(mp);
}

export function matchPlayerDe(player, status = 'Remplaçant', shirtNumber = 0, isCaptain = false) {
  return {
    id: player.id, shirtNumber, firstName: player.firstName, lastName: player.lastName,
    position: player.position, status, isCaptain,
  };
}

export function lireMatchPlayer(o = {}) {
  return {
    id: idDe(o.id),
    shirtNumber: entier(o.shirtNumber),
    firstName: texte(o.firstName),
    lastName: texte(o.lastName),
    position: valeurDans(o.position, POSTES, 'Milieu'),
    status: valeurDans(o.status, STATUTS, 'Remplaçant'),
    isCaptain: booleen(o.isCaptain),
    formationX: optNombre(o.formationX),
    formationY: optNombre(o.formationY),
  };
}

// MARK: - Périodes, arrêts, maillots (MatchModels.swift, StoppageType.swift)

export const PERIODES = ['1ère Mi-Temps', '2ème Mi-Temps', 'Prolongation 1', 'Prolongation 2'];
export const PERIODE_COURTE = { '1ère Mi-Temps': 'MT1', '2ème Mi-Temps': 'MT2', 'Prolongation 1': 'PR1', 'Prolongation 2': 'PR2' };
export const dureeReglementaire = (periode) => (periode === 'Prolongation 1' || periode === 'Prolongation 2' ? 15 * 60 : 45 * 60);
export function periodePrecedente(periode) {
  switch (periode) {
    case '2ème Mi-Temps': return '1ère Mi-Temps';
    case 'Prolongation 1': return '2ème Mi-Temps';
    case 'Prolongation 2': return 'Prolongation 1';
    default: return '1ère Mi-Temps';
  }
}
const rangPeriode = (p) => Math.max(0, PERIODES.indexOf(p));

/** Types d'arrêts (StoppageType), dans l'ordre de l'app */
export const ARRETS = [
  { id: 'Touche', icone: 'arrow.left.and.right', couleur: 'blue', compte: false, equipe: true, enchaine: [] },
  { id: '6 Mètres', icone: 'sportscourt', couleur: 'cyan', compte: false, equipe: true, enchaine: [] },
  { id: 'Corner', icone: 'flag.fill', couleur: 'orange', compte: false, equipe: true, enchaine: [] },
  { id: 'Coup Franc', icone: 'exclamationmark.triangle.fill', couleur: 'yellow', compte: false, equipe: true, enchaine: ['Touche', 'Penalty', 'But / Célébration', 'Blessure / Soins', 'Remplacement'] },
  { id: 'Penalty', icone: 'target', couleur: 'red', compte: false, equipe: true, enchaine: ['But / Célébration', 'Blessure / Soins', 'Remplacement'] },
  { id: 'Remplacement', icone: 'arrow.left.arrow.right', couleur: 'purple', compte: false, equipe: false, enchaine: [] },
  { id: 'Blessure / Soins', icone: 'cross.case.fill', couleur: 'pink', compte: true, equipe: false, enchaine: [] },
  { id: 'VAR', icone: 'tv.fill', couleur: 'indigo', compte: true, equipe: false, enchaine: [] },
  { id: 'But / Célébration', icone: 'soccerball', couleur: 'green', compte: false, equipe: true, enchaine: [] },
  { id: 'Hors-jeu', icone: 'hand.raised.fill', couleur: 'gray', compte: true, equipe: true, enchaine: [] },
  { id: 'Autre', icone: 'ellipsis.circle.fill', couleur: 'secondary', compte: false, equipe: false, enchaine: [] },
];
export const TYPES_ARRET = ARRETS.map((a) => a.id);
export const arret = (type) => ARRETS.find((a) => a.id === type) ?? ARRETS[ARRETS.length - 1];

/** Couleurs de maillot (JerseyColor) : valeur, couleur d'affichage, couleur du texte */
export const MAILLOTS = [
  { id: 'Blanc', css: '#FFFFFF', texte: '#000000' },
  { id: 'Noir', css: '#000000', texte: '#FFFFFF' },
  { id: 'Rouge', css: '#FF3B30', texte: '#FFFFFF' },
  { id: 'Bleu', css: '#007AFF', texte: '#FFFFFF' },
  { id: 'Marine', css: 'rgb(0,0,140)', texte: '#FFFFFF' },
  { id: 'Vert', css: '#34C759', texte: '#FFFFFF' },
  { id: 'Vert foncé', css: 'rgb(0,102,0)', texte: '#FFFFFF' },
  { id: 'Jaune', css: '#FFCC00', texte: '#000000' },
  { id: 'Orange', css: '#FF9500', texte: '#FFFFFF' },
  { id: 'Violet', css: '#AF52DE', texte: '#FFFFFF' },
  { id: 'Rose', css: '#FF2D55', texte: '#000000' },
  { id: 'Cyan', css: '#32ADE6', texte: '#000000' },
  { id: 'Gris', css: '#8E8E93', texte: '#FFFFFF' },
  { id: 'Bordeaux', css: 'rgb(128,0,0)', texte: '#FFFFFF' },
  { id: 'Bleu ciel', css: 'rgb(102,179,255)', texte: '#000000' },
];
export const COULEURS_MAILLOT = MAILLOTS.map((m) => m.id);
export const maillot = (id) => MAILLOTS.find((m) => m.id === id) ?? MAILLOTS[0];

// MARK: - Événements de match

const lirePeriode = (v) => valeurDans(v, PERIODES, '1ère Mi-Temps');

export function lireStoppage(o = {}) {
  return {
    id: idDe(o.id),
    type: valeurDans(o.type, TYPES_ARRET, 'Autre'),
    period: lirePeriode(o.period),
    startTime: nombre(o.startTime),
    endTime: optNombre(o.endTime),
    timestamp: lireDate(o.timestamp) ?? iso(),
    beneficiaryTeam: valeurDans(o.beneficiaryTeam, ['home', 'away'], undefined),
  };
}
export const dureeArret = (s) => (s.endTime == null ? 0 : s.endTime - s.startTime);

export function lireGoal(o = {}) {
  return {
    id: idDe(o.id), isHome: booleen(o.isHome, true), minute: nombre(o.minute), period: lirePeriode(o.period),
    playerName: texte(o.playerName), timestamp: lireDate(o.timestamp) ?? iso(),
  };
}

export function lireCarton(o = {}) {
  return {
    id: idDe(o.id),
    type: valeurDans(o.type, TYPES_CARTON, 'Jaune'),
    playerName: texte(o.playerName),
    playerId: idOpt(o.playerId),
    minute: nombre(o.minute),
    period: lirePeriode(o.period),
    timestamp: lireDate(o.timestamp) ?? iso(),
    matchId: idOpt(o.matchId),
    matchLabel: optTexte(o.matchLabel),
    matchDate: lireDate(o.matchDate),
    isServed: booleen(o.isServed),
  };
}

const lireEvenementJoueur = (o = {}) => ({
  id: idDe(o.id), playerName: texte(o.playerName), playerId: idOpt(o.playerId), minute: nombre(o.minute),
  period: lirePeriode(o.period), timestamp: lireDate(o.timestamp) ?? iso(),
});
export const lireFaute = lireEvenementJoueur;
export const lirePasse = lireEvenementJoueur;

export function lireRemplacement(o = {}) {
  return {
    id: idDe(o.id), playerOut: texte(o.playerOut), playerIn: texte(o.playerIn),
    playerOutId: idOpt(o.playerOutId), playerInId: idOpt(o.playerInId),
    minute: nombre(o.minute), period: lirePeriode(o.period), timestamp: lireDate(o.timestamp) ?? iso(),
  };
}

export function lireExclusionTemporaire(o = {}) {
  return {
    id: idDe(o.id), playerId: idOpt(o.playerId), playerName: texte(o.playerName), cardEventId: idDe(o.cardEventId),
    totalDuration: nombre(o.totalDuration, 600), elapsedAtPause: nombre(o.elapsedAtPause),
    isCompleted: booleen(o.isCompleted), startPeriod: lirePeriode(o.startPeriod), startMinute: nombre(o.startMinute),
  };
}

// MARK: - Match

export function nouveauMatch(champs = {}) {
  return lireMatch({ id: uuid(), date: iso(), ...champs });
}

export function lireMatch(o = {}) {
  const durees = {};
  if (o.periodDurations && typeof o.periodDurations === 'object') {
    for (const [k, v] of Object.entries(o.periodDurations)) if (Number.isFinite(Number(v))) durees[k] = Number(v);
  }
  return {
    id: idDe(o.id),
    homeTeam: texte(o.homeTeam),
    awayTeam: texte(o.awayTeam),
    competition: texte(o.competition),
    date: lireDate(o.date) ?? iso(),
    isMyTeamHome: booleen(o.isMyTeamHome, true),
    stoppages: tableau(o.stoppages).map(lireStoppage),
    periodDurations: durees,
    isFinished: booleen(o.isFinished),
    notes: texte(o.notes),
    homeScore: entier(o.homeScore),
    awayScore: entier(o.awayScore),
    goals: tableau(o.goals).map(lireGoal),
    cards: tableau(o.cards).map(lireCarton),
    substitutions: tableau(o.substitutions).map(lireRemplacement),
    fouls: tableau(o.fouls).map(lireFaute),
    assists: tableau(o.assists).map(lirePasse),
    matchRoster: tableau(o.matchRoster).map(lireMatchPlayer),
    tempExpulsions: tableau(o.tempExpulsions).map(lireExclusionTemporaire),
    homeJerseyColor: valeurDans(o.homeJerseyColor, COULEURS_MAILLOT, 'Blanc'),
    awayJerseyColor: valeurDans(o.awayJerseyColor, COULEURS_MAILLOT, 'Bleu'),
    homePossessionTime: nombre(o.homePossessionTime),
    awayPossessionTime: nombre(o.awayPossessionTime),
    homePasses: entier(o.homePasses),
    awayPasses: entier(o.awayPasses),
    refereeCentre: texte(o.refereeCentre),
    refereeAssistant1: texte(o.refereeAssistant1),
    refereeAssistant2: texte(o.refereeAssistant2),
    selectedFormation: optTexte(o.selectedFormation),
  };
}

export const myTeamName = (m) => (m.isMyTeamHome ? m.homeTeam : m.awayTeam);
export const opponentName = (m) => (m.isMyTeamHome ? m.awayTeam : m.homeTeam);
export const myScore = (m) => (m.isMyTeamHome ? m.homeScore : m.awayScore);
export const opponentScore = (m) => (m.isMyTeamHome ? m.awayScore : m.homeScore);

/** Temps total d'arrêts (d'une période, ou du match) */
export function totalStoppageTime(m, periode) {
  return m.stoppages.filter((s) => periode == null || s.period === periode).reduce((t, s) => t + dureeArret(s), 0);
}
export const totalMatchDuration = (m) => Object.values(m.periodDurations).reduce((a, b) => a + b, 0);
export const effectivePlayTime = (m, periode) => (m.periodDurations[periode] ?? 0) - totalStoppageTime(m, periode);
export const totalEffectivePlayTime = (m) => totalMatchDuration(m) - totalStoppageTime(m);
export function effectivePercentage(m) {
  const total = totalMatchDuration(m);
  return total > 0 ? (totalEffectivePlayTime(m) / total) * 100 : 0;
}
export const stoppageCount = (m, type, equipe) =>
  m.stoppages.filter((s) => s.type === type && (equipe == null || s.beneficiaryTeam === equipe)).length;
export const totalTimeFor = (m, type, equipe) =>
  m.stoppages.filter((s) => s.type === type && (equipe == null || s.beneficiaryTeam === equipe)).reduce((t, s) => t + dureeArret(s), 0);

/** Temps additionnel suggéré : blessures, VAR, hors-jeu + 30 s par remplacement */
export function suggestedAddedTime(m, periode) {
  const comptes = m.stoppages.filter((s) => s.period === periode && arret(s.type).compte).reduce((t, s) => t + dureeArret(s), 0);
  const remplacements = m.stoppages.filter((s) => s.period === periode && s.type === 'Remplacement').length;
  return comptes + remplacements * 30;
}

const trierRemplacements = (a, b) => (rangPeriode(a.period) - rangPeriode(b.period)) || (a.minute - b.minute);

/** Le joueur était-il sur le terrain au coup d'envoi ? (reconstitué depuis les remplacements) */
export function wasInitiallyOnField(m, playerId) {
  const mp = m.matchRoster.find((p) => p.id === playerId);
  if (!mp) return false;
  const subs = m.substitutions.filter((s) => s.playerOutId === playerId || s.playerInId === playerId).sort(trierRemplacements);
  if (subs.length === 0) return mp.status === 'Titulaire' || mp.status === 'Expulsé' || mp.status === 'Expulsé temp.';
  return subs[0].playerOutId === playerId;
}

function surTerrainEnFinDe(m, playerId, periode, jouees, auDepart) {
  let surTerrain = periode === jouees[0]
    ? (auDepart.get(playerId) ?? false)
    : surTerrainEnFinDe(m, playerId, periodePrecedente(periode), jouees, auDepart);
  for (const s of m.substitutions.filter((x) => x.period === periode).sort((a, b) => a.minute - b.minute)) {
    if (s.playerOutId === playerId) surTerrain = false;
    if (s.playerInId === playerId) surTerrain = true;
  }
  return surTerrain;
}

/**
 * Temps de jeu de chaque joueur (Match.playerPlayingTimes) :
 * [{ playerId, playerName, shirtNumber, position, totalTime, effectiveTime, isTitulaire }], du plus long au plus court
 */
export function playerPlayingTimes(m) {
  if (m.matchRoster.length === 0) return [];
  const jouees = PERIODES.filter((p) => m.periodDurations[p] != null);
  const auDepart = new Map(m.matchRoster.map((mp) => [mp.id, wasInitiallyOnField(m, mp.id)]));
  const duree = totalMatchDuration(m);
  const ratio = duree > 0 ? totalEffectivePlayTime(m) / duree : 1;
  const resultats = m.matchRoster.map((mp) => {
    let total = 0;
    for (const periode of jouees) {
      const dureePeriode = m.periodDurations[periode] ?? 0;
      let surTerrain = periode === jouees[0]
        ? (auDepart.get(mp.id) ?? false)
        : surTerrainEnFinDe(m, mp.id, periodePrecedente(periode), jouees, auDepart);
      const evenements = [
        ...m.substitutions.filter((s) => s.period === periode && s.playerOutId === mp.id).map((s) => ({ minute: s.minute, entre: false })),
        ...m.substitutions.filter((s) => s.period === periode && s.playerInId === mp.id).map((s) => ({ minute: s.minute, entre: true })),
      ].sort((a, b) => a.minute - b.minute);
      let dernier = 0;
      for (const e of evenements) {
        if (surTerrain) total += e.minute - dernier;
        surTerrain = e.entre;
        dernier = e.minute;
      }
      if (surTerrain) total += dureePeriode - dernier;
    }
    return {
      playerId: mp.id,
      playerName: fullName(mp) === '' ? `Joueur #${mp.shirtNumber}` : fullName(mp),
      shirtNumber: mp.shirtNumber,
      position: mp.position,
      totalTime: total,
      effectiveTime: total * ratio,
      isTitulaire: auDepart.get(mp.id) ?? false,
    };
  });
  return resultats.sort((a, b) => b.totalTime - a.totalTime);
}

// MARK: - Catégories (TeamProfile.swift, ProfileManager.swift)

export const COULEURS_PROFIL = [
  { nom: 'Vert', index: 0, couleur: 'green' }, { nom: 'Bleu', index: 1, couleur: 'blue' },
  { nom: 'Orange', index: 2, couleur: 'orange' }, { nom: 'Rouge', index: 3, couleur: 'red' },
  { nom: 'Violet', index: 4, couleur: 'purple' }, { nom: 'Rose', index: 5, couleur: 'pink' },
  { nom: 'Jaune', index: 6, couleur: 'yellow' }, { nom: 'Cyan', index: 7, couleur: 'cyan' },
];
/** Nom de couleur SwiftUI d'un profil (ProfileManager.color(for:)) */
export const couleurProfil = (index) => (COULEURS_PROFIL[index] ?? COULEURS_PROFIL[0]).couleur;

/** Code d'équipe de 6 caractères, sans I/O/0/1 */
export function genererCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function lireProfil(o = {}) {
  return {
    id: idDe(o.id),
    name: texte(o.name),
    colorIndex: entier(o.colorIndex),
    playerIds: sansDoublons(tableau(o.playerIds).map(idDe)),
    teamCode: texte(o.teamCode),
  };
}

// MARK: - Saisons (SeasonModels.swift)

export function lireSaison(o = {}) {
  return {
    id: idDe(o.id),
    clubName: texte(o.clubName),
    category: texte(o.category),
    startDate: lireDate(o.startDate) ?? iso(),
    endDate: lireDate(o.endDate),
    isClosed: booleen(o.isClosed),
  };
}

/** « 2025-2026 » (Season.label) */
export function libelleSaison(s) {
  const debut = dateDe(s.startDate);
  const an = debut.getFullYear();
  if (s.endDate) {
    const fin = dateDe(s.endDate).getFullYear();
    return an === fin ? `${an}` : `${an}-${fin}`;
  }
  return debut.getMonth() + 1 >= 7 ? `${an}-${an + 1}` : `${an - 1}-${an}`;
}

export function lireArchive(o = {}) {
  const saison = lireSaison(o.season);
  return {
    id: idOpt(o.id) ?? saison.id,
    season: saison,
    matches: tableau(o.matches).map(lireMatch),
    trainingSessions: tableau(o.trainingSessions).map(lireSeance),
    players: tableau(o.players).map(lireJoueur),
  };
}

// MARK: - Encadrement (StaffModels.swift)

export const ROLES_PAR_DEFAUT = ['Coach', 'Coach adjoint', 'Arbitre', 'Délégué', 'Préparateur physique',
  'Entraîneur des gardiens', 'Intendant', 'Responsable médical'];
export const rolesParDefaut = () => ROLES_PAR_DEFAUT.map((name) => ({ id: uuid(), name, isCustom: false }));

export const lireRole = (o = {}) => ({ id: idDe(o.id), name: texte(o.name), isCustom: booleen(o.isCustom) });

export function lireEncadrant(o = {}) {
  return {
    id: idDe(o.id),
    firstName: texte(o.firstName),
    lastName: texte(o.lastName),
    roleId: idDe(o.roleId),
    phone: texte(o.phone),
    email: texte(o.email),
    photoData: optTexte(o.photoData),
    profileIds: sansDoublons(tableau(o.profileIds).map(idDe)),
  };
}
export function nomEncadrant(s) {
  const nom = `${s.firstName} ${s.lastName}`.trim();
  return nom === '' ? 'Encadrant' : nom;
}

// MARK: - Entraînements (TrainingModels.swift, TrainingManager.swift)

export const REPONSES = [
  { id: 0, label: 'Absent', icone: 'xmark.circle.fill', couleur: 'red' },
  { id: 1, label: 'Présent', icone: 'checkmark.circle.fill', couleur: 'green' },
  { id: 2, label: 'Incertain', icone: 'questionmark.circle.fill', couleur: 'orange' },
];
export const reponse = (statut) => REPONSES.find((r) => r.id === statut) ?? REPONSES[0];

export function lireReponse(o = {}) {
  return {
    id: idDe(o.id), playerName: texte(o.playerName), status: valeurDans(entier(o.status, 0), [0, 1, 2], 0),
    comment: texte(o.comment), respondedAt: lireDate(o.respondedAt) ?? iso(),
  };
}

export const lirePresence = (o = {}) => ({
  id: idDe(o.id), firstName: texte(o.firstName), lastName: texte(o.lastName), isPresent: booleen(o.isPresent),
});
export const presenceDe = (player, isPresent = false) => ({
  id: player.id, firstName: player.firstName, lastName: player.lastName, isPresent,
});

export function nouvelleSeance(champs = {}) {
  return lireSeance({ id: uuid(), date: iso(), notes: '', location: '', attendances: [], availabilityResponses: [], ...champs });
}

export function lireSeance(o = {}) {
  return {
    id: idDe(o.id),
    date: lireDate(o.date) ?? iso(),
    notes: texte(o.notes),
    location: texte(o.location),
    attendances: tableau(o.attendances).map(lirePresence),
    availabilityResponses: tableau(o.availabilityResponses).map(lireReponse),
  };
}

export const presentCount = (s) => s.attendances.filter((a) => a.isPresent).length;

/** Statistiques de présence (TrainingManager.calculatePlayerStats), triées par nom */
export function calculatePlayerStats(seances) {
  const parJoueur = new Map();
  for (const s of seances) {
    for (const a of s.attendances) {
      const d = parJoueur.get(a.id);
      if (d) { d.totalSessions += 1; if (a.isPresent) d.presentSessions += 1; }
      else parJoueur.set(a.id, { playerId: a.id, firstName: a.firstName, lastName: a.lastName, totalSessions: 1, presentSessions: a.isPresent ? 1 : 0 });
    }
  }
  return [...parJoueur.values()].sort((a, b) => comparer(a.lastName, b.lastName));
}
export const tauxPresence = (st) => (st.totalSessions > 0 ? (st.presentSessions / st.totalSessions) * 100 : 0);

/** Séances comprises entre deux jours (inclus), de la plus récente à la plus ancienne */
export function filterSessions(seances, debut, fin) {
  const d = debutDuJour(debut).getTime();
  const f = debutDuJour(fin).getTime() + 86400000;
  return seances.filter((s) => { const t = dateDe(s.date).getTime(); return t >= d && t < f; })
    .sort((a, b) => dateDe(b.date) - dateDe(a.date));
}

/** Les réponses « Présent » deviennent des présences (applyResponsesToAttendance) */
export function applyResponsesToAttendance(seance, tousLesJoueurs) {
  for (const r of seance.availabilityResponses) {
    const a = seance.attendances.find((x) => x.id === r.id);
    if (a) { a.isPresent = r.status === 1; continue; }
    const joueur = tousLesJoueurs.find((p) => p.id === r.id);
    let firstName; let lastName;
    if (joueur) { firstName = joueur.firstName; lastName = joueur.lastName; }
    else {
      const i = r.playerName.indexOf(' ');
      firstName = i < 0 ? r.playerName : r.playerName.slice(0, i);
      lastName = i < 0 ? '' : r.playerName.slice(i + 1);
    }
    seance.attendances.push({ id: r.id, firstName, lastName, isPresent: r.status === 1 });
  }
  return seance;
}

// MARK: - Exercices (TacticModels.swift) — gardés au format fichier (.tdjt, clés françaises)

/** Arrondi au millième, comme TacticPoint.encode */
const milliemes = (v) => Math.sign(v) * Math.round(Math.abs(v) * 1000) / 1000;

function lirePoint(p) {
  if (Array.isArray(p) && p.length >= 2) return [nombre(p[0]), nombre(p[1])];
  if (p && typeof p === 'object' && 'x' in p) return [nombre(p.x), nombre(p.y)];
  return undefined;
}
const ecrirePoint = (p) => (p ? [milliemes(p[0]), milliemes(p[1])] : undefined);

export const CAMPS = { equipe: 'Mon équipe', adversaire: 'Adversaires', joker: 'Jokers' };

export const CATEGORIES_TACTIQUES = [
  { id: 'conservation', nom: 'Conservation & rondos', icone: 'circle.hexagongrid.fill' },
  { id: 'construction', nom: 'Construction du jeu', icone: 'arrow.up.forward.circle.fill' },
  { id: 'attaque', nom: 'Animation offensive', icone: 'bolt.circle.fill' },
  { id: 'finition', nom: 'Finition', icone: 'scope' },
  { id: 'pressing', nom: 'Pressing', icone: 'flame.fill' },
  { id: 'defense', nom: 'Organisation défensive', icone: 'shield.lefthalf.filled' },
  { id: 'transition', nom: 'Transitions', icone: 'arrow.triangle.2.circlepath' },
  { id: 'cpa', nom: 'Coups de pied arrêtés', icone: 'flag.fill' },
  { id: 'perso', nom: 'Mes séquences', icone: 'person.crop.square.filled.and.at.rectangle' },
  { id: 'autre', nom: 'Autres', icone: 'square.grid.2x2.fill' },
];
export const categorieTactique = (id) => CATEGORIES_TACTIQUES.find((c) => c.id === id) ?? CATEGORIES_TACTIQUES[9];

export const TYPES_MATERIEL = ['plot', 'mini-but', 'mannequin', 'zone', 'piquet', 'coupelle', 'but', 'cerceau', 'echelle', 'haie', 'ballon'];
export const TYPES_FLECHE = { course: 'Course', passe: 'Passe', conduite: 'Conduite', tir: 'Tir' };
const ACTIONS_BALLON = ['passe', 'conduite', 'tir', 'centre'];

function lireActeur(o = {}) {
  const a = {
    id: texte(o.id),
    camp: valeurDans(o.camp, ['equipe', 'adversaire', 'joker'], 'equipe'),
    numero: typeof o.numero === 'number' ? String(o.numero) : texte(o.numero),
  };
  if (typeof o.nom === 'string') a.nom = o.nom;
  if (POSTES.includes(o.poste)) a.poste = o.poste;
  if (typeof o.chasuble === 'string') a.chasuble = o.chasuble;
  return a;
}

function lireMateriel(o = {}) {
  const m = {
    type: valeurDans(String(o.type ?? '').toLowerCase(), TYPES_MATERIEL, 'plot'),
    pos: lirePoint(o.pos) ?? [0.5, 0.5],
  };
  const taille = lirePoint(o.taille);
  if (taille) m.taille = taille;
  if (typeof o.couleur === 'string') m.couleur = o.couleur;
  if (typeof o.rotation === 'number') m.rotation = o.rotation;
  return m;
}

function lireFleche(o = {}) {
  const f = { type: valeurDans(o.type, Object.keys(TYPES_FLECHE), 'course'), de: lirePoint(o.de) ?? [0, 0], a: lirePoint(o.a) ?? [0, 0] };
  if (typeof o.aerien === 'boolean') f.aerien = o.aerien;
  return f;
}

function lireEtatBallon(o = {}) {
  const b = {};
  if (typeof o.porteur === 'string') b.porteur = o.porteur;
  const p = lirePoint(o.position);
  if (p) b.position = p;
  if (ACTIONS_BALLON.includes(o.action)) b.action = o.action;
  if (typeof o.aerien === 'boolean') b.aerien = o.aerien;
  return b;
}

function lireEtape(o = {}) {
  const e = { titre: texte(o.titre), texte: texte(o.texte), positions: {} };
  if (typeof o.duree === 'number') e.duree = o.duree;
  if (o.positions && typeof o.positions === 'object') {
    for (const [k, v] of Object.entries(o.positions)) { const p = lirePoint(v); if (p) e.positions[k] = p; }
  }
  if (typeof o.porteur === 'string') e.porteur = o.porteur;
  const ballon = lirePoint(o.ballon);
  if (ballon) e.ballon = ballon;
  if (ACTIONS_BALLON.includes(o.action)) e.action = o.action;
  if (typeof o.aerien === 'boolean') e.aerien = o.aerien;
  if (Array.isArray(o.fleches)) e.fleches = o.fleches.map(lireFleche);
  if (Array.isArray(o.focus)) e.focus = o.focus.filter((x) => typeof x === 'string');
  if (o.autresBallons && typeof o.autresBallons === 'object') {
    e.autresBallons = {};
    for (const [k, v] of Object.entries(o.autresBallons)) e.autresBallons[k] = lireEtatBallon(v);
  }
  return e;
}

function lireEvolution(o = {}) {
  return {
    id: idDe(o.id), titre: texte(o.titre, 'Évolution') || 'Évolution', texte: texte(o.texte),
    acteurs: tableau(o.acteurs).map(lireActeur), materiel: tableau(o.materiel).map(lireMateriel), etapes: tableau(o.etapes).map(lireEtape),
  };
}

function lireCadrage(o) {
  if (!o || typeof o !== 'object') return undefined;
  return { x: nombre(o.x), y: nombre(o.y), largeur: nombre(o.largeur, 1), longueur: nombre(o.longueur, 1) };
}

/** Lit un exercice (TacticPlay). Un id texte non UUID devient un UUID stable, comme dans l'app. */
export function lireTactique(o = {}) {
  let id;
  if (typeof o.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(o.id)) id = o.id.toUpperCase();
  else if (typeof o.id === 'string') id = uuidStable(o.id);
  else id = uuid();
  const t = {
    id,
    titre: texte(o.titre, 'Tactique') || (typeof o.titre === 'string' ? '' : 'Tactique'),
    categorie: categorieTactique(String(o.categorie ?? '').toLowerCase()).id,
    objectif: texte(o.objectif),
    consignes: tableau(o.consignes).filter((c) => typeof c === 'string'),
    acteurs: tableau(o.acteurs).map(lireActeur),
    materiel: tableau(o.materiel).map(lireMateriel),
    etapes: tableau(o.etapes).map(lireEtape),
    perso: booleen(o.perso),
  };
  if (typeof o.niveau === 'string') t.niveau = o.niveau;
  if (typeof o.duree === 'string') t.duree = o.duree;
  if (typeof o.effectif === 'string') t.effectif = o.effectif;
  if (typeof o.source === 'string') t.source = o.source;
  if (Array.isArray(o.evolutions)) t.evolutions = o.evolutions.map(lireEvolution);
  const cadrage = lireCadrage(o.cadrage);
  if (cadrage) t.cadrage = cadrage;
  const cree = lireDate(o.creeLe);
  if (cree) t.creeLe = cree;
  return t;
}

/** Écrit un exercice au format de l'app (points arrondis au millième, valeurs absentes omises) */
export function ecrireTactique(t) {
  const etape = (e) => propre({
    ...e,
    positions: Object.fromEntries(Object.entries(e.positions ?? {}).map(([k, p]) => [k, ecrirePoint(p)])),
    ballon: ecrirePoint(e.ballon),
    fleches: e.fleches?.map((f) => propre({ ...f, de: ecrirePoint(f.de), a: ecrirePoint(f.a) })),
    autresBallons: e.autresBallons
      ? Object.fromEntries(Object.entries(e.autresBallons).map(([k, b]) => [k, propre({ ...b, position: ecrirePoint(b.position) })]))
      : undefined,
  });
  const materiel = (m) => propre({ ...m, pos: ecrirePoint(m.pos), taille: ecrirePoint(m.taille) });
  return propre({
    ...t,
    materiel: (t.materiel ?? []).map(materiel),
    etapes: (t.etapes ?? []).map(etape),
    evolutions: t.evolutions?.map((ev) => propre({ ...ev, materiel: ev.materiel.map(materiel), etapes: ev.etapes.map(etape) })),
  });
}

/** Fichier .tdjt : conteneur { tactiques }, tactique seule ou tableau */
export function lireFichierTactiques(texteOuObjet) {
  const o = typeof texteOuObjet === 'string' ? JSON.parse(texteOuObjet) : texteOuObjet;
  if (o && Array.isArray(o.tactiques)) return o.tactiques.map(lireTactique);
  if (Array.isArray(o)) return o.map(lireTactique);
  if (o && Array.isArray(o.acteurs) && Array.isArray(o.etapes)) return [lireTactique(o)];
  throw new Error('Fichier tactique illisible');
}

export function ecrireFichierTactiques(tactiques) {
  return JSON.stringify({ format: 'tempsdejeu.tactique', version: 1, tactiques: tactiques.map(ecrireTactique) }, null, 2);
}

/** « 4 c 2 · 3 étapes · 12 min » (TacticPlay.summary) */
export function resumeTactique(t) {
  const parts = [];
  if (t.effectif) parts.push(t.effectif);
  parts.push(`${t.etapes.length} étape${pluriel(t.etapes.length)}`);
  if (t.duree) parts.push(t.duree);
  return parts.join(' · ');
}

/** UUID déterministe dérivé d'un texte (UUID.stable(from:), FNV-1a 128 bits simplifié) */
export function uuidStable(texteSource) {
  const M64 = (1n << 64n) - 1n;
  let h1 = 0xcbf29ce484222325n;
  let h2 = 0x84222325cbf29ce4n;
  for (const octet of new TextEncoder().encode(texteSource)) {
    h1 = ((h1 ^ BigInt(octet)) * 0x100000001b3n) & M64;
    h2 = (((h2 ^ BigInt(octet)) * 0x100000001b3n) + 0x9e3779b97f4a7c15n) & M64;
  }
  const octets = [];
  for (let i = 0; i < 8; i++) octets.push(Number((h1 >> BigInt(i * 8)) & 0xffn));
  for (let i = 0; i < 8; i++) octets.push(Number((h2 >> BigInt(i * 8)) & 0xffn));
  octets[6] = (octets[6] & 0x0f) | 0x50;
  octets[8] = (octets[8] & 0x3f) | 0x80;
  const hex = octets.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// MARK: - Ballons et états résolus (TacticPlay.resolvedFrames / arrows)

export const BALLON_PRINCIPAL = 'ballon';
export const numeroBallon = (id) => (id === BALLON_PRINCIPAL ? 1 : (Number.parseInt(id.split('-').pop(), 10) || 99));

/** État d'un ballon dans une étape : { porteur?, position?, action?, aerien? } ou null */
export function etatBallon(etape, id) {
  if (id !== BALLON_PRINCIPAL) return etape.autresBallons?.[id] ?? null;
  if (etape.porteur == null && etape.ballon == null) return null;
  return propre({ porteur: etape.porteur, position: etape.ballon, action: etape.action, aerien: etape.aerien });
}

export function idsBallons(etapes) {
  const autres = new Set();
  for (const e of etapes) for (const k of Object.keys(e.autresBallons ?? {})) autres.add(k);
  const principal = etapes.some((e) => e.porteur != null || e.ballon != null);
  return [...(principal ? [BALLON_PRINCIPAL] : []), ...[...autres].sort((a, b) => numeroBallon(a) - numeroBallon(b))];
}

export function decalageBallon(camp) {
  if (camp === 'adversaire') return [-0.016, 0.006];
  if (camp === 'joker') return [0.016, 0];
  return [0.016, -0.006];
}

/** États complets de chaque étape : [{ positions, porteur, ballon:[x,y], autres: { id: { porteur, point } } }] */
export function resolvedFrames(t) {
  const positions = {};
  const principal = { porteur: null, point: [0.5, 0.5] };
  const autres = {};
  const camp = (id) => t.acteurs.find((a) => a.id === id)?.camp;
  const avancer = (ballon, etat) => {
    if (etat) {
      if (etat.porteur != null && positions[etat.porteur]) ballon.porteur = etat.porteur;
      else if (etat.position) {
        ballon.porteur = null;
        const b = [...etat.position];
        if (etat.action === 'tir' && Math.abs(b[0] - 0.5) < 0.05) {
          if (b[1] <= 0.012) b[1] = -0.011; else if (b[1] >= 0.988) b[1] = 1.011;
        }
        ballon.point = b;
      }
    }
    if (ballon.porteur != null && positions[ballon.porteur]) {
      const p = positions[ballon.porteur];
      const [dx, dy] = decalageBallon(camp(ballon.porteur));
      ballon.point = [p[0] + dx, p[1] + dy];
    }
  };
  return t.etapes.map((e) => {
    for (const [k, v] of Object.entries(e.positions)) positions[k] = v;
    avancer(principal, etatBallon(e, BALLON_PRINCIPAL));
    const ids = new Set([...Object.keys(autres), ...Object.keys(e.autresBallons ?? {})]);
    for (const id of ids) {
      const b = autres[id] ?? { porteur: null, point: [0.5, 0.5] };
      avancer(b, e.autresBallons?.[id]);
      autres[id] = b;
    }
    return {
      positions: { ...positions },
      porteur: principal.porteur,
      ballon: [...principal.point],
      autres: Object.fromEntries(Object.entries(autres).map(([k, b]) => [k, { porteur: b.porteur, point: [...b.point] }])),
    };
  });
}

const ballonDe = (frame, id) => (id === BALLON_PRINCIPAL ? { porteur: frame.porteur, point: frame.ballon } : frame.autres[id]);

export function estAerien(t, index, id = BALLON_PRINCIPAL) {
  const e = t.etapes[index];
  if (!e) return false;
  if (id === BALLON_PRINCIPAL) return e.aerien ?? (e.action === 'centre');
  const b = e.autresBallons?.[id];
  return b ? (b.aerien ?? (b.action === 'centre')) : false;
}

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Flèches du mouvement qui mène à l'étape `index` : [{ type, de, a, aerien?, camp? }] */
export function flechesEtape(t, index, frames = resolvedFrames(t)) {
  const extra = t.etapes[index]?.fleches ?? [];
  if (index <= 0 || !frames[index]) return [...extra];
  const avant = frames[index - 1];
  const apres = frames[index];
  const seuil = 0.012;
  const balles = idsBallons(t.etapes);
  const res = [];
  for (const a of t.acteurs) {
    const p0 = avant.positions[a.id]; const p1 = apres.positions[a.id];
    if (!p0 || !p1 || distance(p0, p1) <= seuil) continue;
    const conduite = balles.some((id) => ballonDe(avant, id)?.porteur === a.id && ballonDe(apres, id)?.porteur === a.id);
    res.push({ type: conduite ? 'conduite' : 'course', de: p0, a: p1, camp: a.camp });
  }
  for (const id of balles) {
    const b0 = ballonDe(avant, id); const b1 = ballonDe(apres, id);
    if (!b0 || !b1) continue;
    const porte = b0.porteur != null && b0.porteur === b1.porteur;
    if (porte || distance(b0.point, b1.point) <= seuil) continue;
    const action = id === BALLON_PRINCIPAL ? t.etapes[index].action : t.etapes[index].autresBallons?.[id]?.action;
    const type = action === 'tir' ? 'tir' : action === 'conduite' ? 'conduite' : 'passe';
    res.push({ type, de: b0.point, a: b1.point, aerien: estAerien(t, index, id) });
  }
  return [...res, ...extra];
}

/** Variante jouée pour une évolution (TacticPlay.variant) */
export function variante(t, index) {
  const ev = index == null ? null : t.evolutions?.[index];
  if (!ev) return t;
  const copie = { ...t, acteurs: ev.acteurs, materiel: ev.materiel, etapes: ev.etapes, titre: `${t.titre} · ${ev.titre}` };
  if (ev.texte !== '') copie.objectif = t.objectif === '' ? ev.texte : `${t.objectif}\n${ev.titre} : ${ev.texte}`;
  delete copie.evolutions;
  return copie;
}

// MARK: - Atelier : couleurs, matériel, cadrage (AtelierModels.swift)

export const COULEURS_ATELIER = [
  { id: 'rouge', css: 'rgb(230,38,38)', m: 'rouge', f: 'rouge' },
  { id: 'bleu', css: 'rgb(38,115,242)', m: 'bleu', f: 'bleue' },
  { id: 'jaune', css: 'rgb(255,217,26)', m: 'jaune', f: 'jaune' },
  { id: 'orange', css: 'rgb(255,128,13)', m: 'orange', f: 'orange' },
  { id: 'vert', css: 'rgb(51,204,77)', m: 'vert', f: 'verte' },
  { id: 'rose', css: 'rgb(255,89,178)', m: 'rose', f: 'rose' },
  { id: 'blanc', css: 'rgb(247,247,247)', m: 'blanc', f: 'blanche' },
  { id: 'violet', css: 'rgb(153,77,230)', m: 'violet', f: 'violette' },
];
export const IDS_COULEURS_ATELIER = COULEURS_ATELIER.map((c) => c.id);
export const couleurAtelier = (id) => COULEURS_ATELIER.find((c) => c.id === id) ?? null;
export const couleurAtelierClaire = (id) => ['jaune', 'blanc', 'rose'].includes(id);
export const nomCouleurAtelier = (id) => id.charAt(0).toUpperCase() + id.slice(1);
export function lireCouleurAtelier(nom) {
  const n = typeof nom === 'string' ? nom.trim().toLowerCase() : '';
  return IDS_COULEURS_ATELIER.includes(n) ? n : null;
}
/** Adjectif accordé : « jaunes », « blanches », « orange » (invariable) */
export function adjectifCouleur(id, feminin, plurielle) {
  const c = couleurAtelier(id);
  if (!c) return '';
  if (id === 'orange') return 'orange';
  const mot = feminin ? c.f : c.m;
  return plurielle ? `${mot}s` : mot;
}
export const couleurCampParDefaut = (camp) => (camp === 'adversaire' ? 'rouge' : camp === 'joker' ? 'jaune' : 'bleu');
/** Couleur de chasuble d'un acteur (TacticActor.bibColor) */
export const chasubleDe = (acteur) => lireCouleurAtelier(acteur.chasuble) ?? couleurCampParDefaut(acteur.camp);
export const estGardien = (acteur) => acteur.poste === 'Gardien';

export const MATERIEL = {
  plot: { nom: 'Plot', s: 'plot', p: 'plots', f: false, couleur: 'orange' },
  coupelle: { nom: 'Coupelle', s: 'coupelle', p: 'coupelles', f: true, couleur: 'jaune' },
  piquet: { nom: 'Piquet', s: 'piquet', p: 'piquets', f: false, couleur: 'jaune' },
  mannequin: { nom: 'Mannequin', s: 'mannequin', p: 'mannequins', f: false, couleur: 'jaune' },
  'mini-but': { nom: 'Mini-but', s: 'mini-but', p: 'mini-buts', f: false, couleur: 'blanc' },
  but: { nom: 'But', s: 'but', p: 'buts', f: false, couleur: 'blanc' },
  cerceau: { nom: 'Cerceau', s: 'cerceau', p: 'cerceaux', f: false, couleur: 'rouge' },
  echelle: { nom: 'Échelle', s: 'échelle de rythme', p: 'échelles de rythme', f: true, couleur: 'jaune' },
  haie: { nom: 'Haie', s: 'haie', p: 'haies', f: true, couleur: 'rouge' },
  ballon: { nom: 'Ballon', s: 'ballon', p: 'ballons', f: false, couleur: 'blanc' },
  zone: { nom: 'Zone', s: 'zone', p: 'zones', f: true, couleur: 'blanc' },
};
/** Ordre du tiroir et de la liste du matériel */
export const ORDRE_MATERIEL = ['plot', 'coupelle', 'piquet', 'mannequin', 'mini-but', 'but', 'cerceau', 'echelle', 'haie', 'ballon', 'zone'];
export const materielAvecCouleur = (type) => !['mini-but', 'but', 'ballon'].includes(type);
export const materielOrientable = (type) => ['mannequin', 'mini-but', 'but', 'echelle', 'haie'].includes(type);
export const couleurMateriel = (m) => lireCouleurAtelier(m.couleur) ?? MATERIEL[m.type].couleur;

/** « 3 plots », « 12 plots jaunes », « 2 échelles de rythme jaunes » */
export function compterMateriel(type, n, couleurId = null) {
  const d = MATERIEL[type];
  const nom = n > 1 ? d.p : d.s;
  if (!couleurId || !materielAvecCouleur(type)) return `${n} ${nom}`;
  const adj = adjectifCouleur(couleurId, d.f, n > 1);
  const i = nom.indexOf(' ');
  return i < 0 ? `${n} ${nom} ${adj}` : `${n} ${nom.slice(0, i)} ${adj} ${nom.slice(i + 1)}`;
}

/** Résumé « 8 plots · 2 mini-buts » (TacticPlay.equipmentSummary, ordre de TacticPropKind.allCases) */
export function resumeMateriel(t) {
  if (!t.materiel?.length) return null;
  return TYPES_MATERIEL.map((type) => {
    const n = t.materiel.filter((m) => m.type === type).length;
    return n > 0 ? compterMateriel(type, n) : null;
  }).filter(Boolean).join(' · ');
}

/** Ligne de matériel : { item: 'chasuble' | type, couleur: id | null, nombre, texte } */
function texteLigne(item, couleurId, n) {
  if (item !== 'chasuble') return compterMateriel(item, n, couleurId);
  const nom = n > 1 ? 'chasubles' : 'chasuble';
  return couleurId ? `${n} ${nom} ${adjectifCouleur(couleurId, true, n > 1)}` : `${n} ${nom}`;
}
const cleLigne = (item) => (item === 'chasuble' ? -1 : (ORDRE_MATERIEL.indexOf(item) >= 0 ? ORDRE_MATERIEL.indexOf(item) : 99));

function lignesTriees(compte) {
  const lignes = [];
  for (const [cle, n] of compte) {
    if (n <= 0) continue;
    const [item, c] = cle.split('|');
    const couleurId = c === '' ? null : c;
    lignes.push({ item, couleur: couleurId, nombre: n, texte: texteLigne(item, couleurId, n) });
  }
  const rang = (c) => IDS_COULEURS_ATELIER.indexOf(c ?? 'blanc');
  return lignes.sort((a, b) => (cleLigne(a.item) - cleLigne(b.item)) || (rang(a.couleur) - rang(b.couleur)));
}

/** Matériel nécessaire pour un contenu { acteurs, materiel, etapes } (TacticContent.equipment) */
export function materielContenu(contenu) {
  const compte = new Map();
  const ajouter = (item, c, n = 1) => { const k = `${item}|${c ?? ''}`; compte.set(k, (compte.get(k) ?? 0) + n); };
  for (const m of contenu.materiel ?? []) {
    if (m.type === 'zone') continue;
    ajouter(m.type, materielAvecCouleur(m.type) ? couleurMateriel(m) : null);
  }
  for (const a of contenu.acteurs ?? []) if (!estGardien(a)) ajouter('chasuble', chasubleDe(a));
  const enJeu = idsBallons(contenu.etapes ?? []).length;
  const poses = compte.get('ballon|') ?? 0;
  if (enJeu > poses) compte.set('ballon|', enJeu);
  return lignesTriees(compte);
}

/** Combine des listes : maximum (exercices à la suite) ou somme (ateliers simultanés) */
export function combinerMateriel(listes, simultane) {
  const compte = new Map();
  for (const liste of listes) {
    for (const l of liste) {
      const k = `${l.item}|${l.couleur ?? ''}`;
      const actuel = compte.get(k) ?? 0;
      compte.set(k, simultane ? actuel + l.nombre : Math.max(actuel, l.nombre));
    }
  }
  return lignesTriees(compte);
}

/** Matériel d'un exercice, évolutions comprises (TacticPlay.equipmentLines) */
export const materielExercice = (t) =>
  combinerMateriel([materielContenu(t), ...(t.evolutions ?? []).map(materielContenu)], false);

export const CADRAGES = {
  complet: { x: 0, y: 0, largeur: 1, longueur: 1 },
  moitieAttaque: { x: 0, y: 0, largeur: 1, longueur: 0.5 },
  moitieDefense: { x: 0, y: 0.5, largeur: 1, longueur: 0.5 },
  centre: { x: 0.5 - 20 / 68, y: 0.5 - 20 / 105, largeur: 40 / 68, longueur: 40 / 105 },
};

/** Cadrage ajusté autour de points [x, y] (TacticFraming.fitting) */
export function cadrageAutour(points, margeMetres = 6, minMetres = 24) {
  if (!points.length) return { ...CADRAGES.centre };
  let lo = [...points[0]]; let hi = [...points[0]];
  for (const p of points) { lo = [Math.min(lo[0], p[0]), Math.min(lo[1], p[1])]; hi = [Math.max(hi[0], p[0]), Math.max(hi[1], p[1])]; }
  const mx = margeMetres / 68; const my = margeMetres / 105;
  let w = Math.max(hi[0] - lo[0] + 2 * mx, minMetres / 68);
  let h = Math.max(hi[1] - lo[1] + 2 * my, minMetres / 105);
  w = Math.min(w, 1); h = Math.min(h, 1);
  const cx = (lo[0] + hi[0]) / 2; const cy = (lo[1] + hi[1]) / 2;
  return { x: Math.min(Math.max(0, cx - w / 2), 1 - w), y: Math.min(Math.max(0, cy - h / 2), 1 - h), largeur: w, longueur: h };
}

// MARK: - Séances de l'Atelier (TrainingPlanModels.swift)

function lirePlanItem(o = {}) {
  return { id: idDe(o.id), exercice: idDe(o.exercice), minutes: Number.isInteger(o.minutes) ? o.minutes : 15, note: texte(o.note) };
}

export function lirePlan(o = {}) {
  const p = {
    id: idDe(o.id),
    titre: typeof o.titre === 'string' ? o.titre : 'Séance',
    notes: texte(o.notes),
    exercices: tableau(o.exercices).filter((x) => typeof x?.exercice === 'string').map(lirePlanItem),
    simultane: booleen(o.simultane),
    equipes: tableau(o.equipes)
      .filter((e) => lireCouleurAtelier(e?.color))
      .map((e) => ({ color: lireCouleurAtelier(e.color), players: tableau(e.players).filter((n) => typeof n === 'string') })),
    creeLe: lireDate(o.creeLe) ?? iso(),
  };
  const date = lireDate(o.date);
  if (date) p.date = date;
  return p;
}

export const nouveauPlan = (titre, date) => lirePlan({ id: uuid(), titre, date: date ? iso(date) : undefined, creeLe: iso() });
export const nouvelItemPlan = (exercice, minutes, note = '') => ({ id: uuid(), exercice, minutes, note });
export const minutesPlan = (p) => p.exercices.reduce((t, i) => t + i.minutes, 0);
export const materielPlan = (p, tactiques) => combinerMateriel(tactiques.map(materielExercice), p.simultane);

/** Couleurs des équipes : portées par au moins 3 joueurs, sinon les 2 plus portées (TrainingPlan.bibColors) */
export function couleursEquipes(tactiques) {
  const meilleur = new Map();
  for (const t of tactiques) {
    const compte = new Map();
    for (const a of t.acteurs) if (!estGardien(a)) compte.set(chasubleDe(a), (compte.get(chasubleDe(a)) ?? 0) + 1);
    for (const [c, n] of compte) meilleur.set(c, Math.max(meilleur.get(c) ?? 0, n));
  }
  const classe = [...meilleur.entries()].sort((a, b) => (a[1] === b[1]
    ? IDS_COULEURS_ATELIER.indexOf(a[0]) - IDS_COULEURS_ATELIER.indexOf(b[0])
    : b[1] - a[1]));
  const equipes = classe.filter(([, n]) => n >= 3).map(([c]) => c);
  return equipes.length >= 2 ? equipes : classe.slice(0, 2).map(([c]) => c);
}

const melanger = (liste) => {
  const l = [...liste];
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  return l;
};

/** Équipes équilibrées (TeamBuilder.make) : candidats { name, position } */
export function composerEquipes(candidats, couleurs) {
  if (!couleurs.length) return [];
  let equipes = couleurs.map((c) => ({ color: c, players: [] }));
  for (const poste of ['Gardien', 'Défenseur', 'Milieu', 'Attaquant']) {
    for (const j of melanger(candidats.filter((c) => c.position === poste))) {
      let cible = 0;
      for (let i = 1; i < equipes.length; i++) {
        if (equipes[i].players.length < equipes[cible].players.length) cible = i;
      }
      equipes[cible].players.push(j.name);
    }
    if (equipes.length > 1) equipes = [...equipes.slice(1), equipes[0]];
  }
  return couleurs.map((c) => equipes.find((e) => e.color === c)).filter(Boolean);
}

/** Texte à partager (TeamBuilder.shareText) */
export function texteEquipes(equipes, titre) {
  const lignes = [`⚽️ ${titre} — les équipes`];
  for (const e of equipes) {
    lignes.push('', `Chasubles ${adjectifCouleur(e.color, true, true)} (${e.players.length}) :`, e.players.join(', '));
  }
  return lignes.join('\n');
}

// MARK: - Placement (FormationLayout.swift)

/** Lignes de formation adaptées au nombre de joueurs (méthode du plus fort reste) */
export function adapterFormation(lignes, nombreJoueurs) {
  const total = lignes.reduce((a, b) => a + b, 0);
  if (nombreJoueurs <= 0 || total <= 0) return [];
  if (nombreJoueurs >= total) return [...lignes];
  if (nombreJoueurs <= 1 || lignes.length <= 1) return [1];
  const champ = lignes.slice(1);
  const totalChamp = champ.reduce((a, b) => a + b, 0);
  const cible = nombreJoueurs - 1;
  if (totalChamp <= 0) return [1];
  const exact = champ.map((n) => (n * cible) / totalChamp);
  const compte = exact.map((v) => Math.floor(v));
  let reste = cible - compte.reduce((a, b) => a + b, 0);
  const ordre = exact.map((_, i) => i).sort((a, b) => {
    const ra = exact[a] - Math.floor(exact[a]); const rb = exact[b] - Math.floor(exact[b]);
    return ra !== rb ? rb - ra : a - b;
  });
  for (const i of ordre) { if (reste <= 0) break; compte[i] += 1; reste -= 1; }
  return [1, ...compte.filter((n) => n > 0)];
}
export const nomFormation = (lignes) => lignes.slice(1).join('-');

// MARK: - Échanges de fichiers (ExportService.swift)

/** Résultat d'un JSON.parse tolérant (null si illisible) */
export function lireJSON(texteSource) {
  try { return JSON.parse(texteSource); } catch { return null; }
}

const json = (objet) => JSON.stringify(propre(objet), null, 2);

/** Joueurs (.json) : { teamCode, teamName, players } */
export const ecrireJoueursJSON = (players, profil) =>
  json({ teamCode: profil?.teamCode, teamName: profil?.name, players });

/** Lit un export de joueurs (avec ou sans enveloppe) → { players, teamCode, teamName } | null */
export function lireJoueursJSON(o) {
  if (o && Array.isArray(o.players)) return { players: o.players.map(lireJoueur), teamCode: optTexte(o.teamCode), teamName: optTexte(o.teamName) };
  if (Array.isArray(o) && o.every((p) => p && typeof p === 'object' && 'firstName' in p && 'position' in p)) {
    return { players: o.map(lireJoueur), teamCode: undefined, teamName: undefined };
  }
  return null;
}

/** Matchs (.tdjm) : { teamCode, teamName, matches } */
export const ecrireMatchsJSON = (matches, profil) =>
  json({ teamCode: profil?.teamCode, teamName: profil?.name, matches });

const ressembleMatch = (m) => m && typeof m === 'object' && 'homeTeam' in m && 'stoppages' in m && 'periodDurations' in m;
export function lireMatchsJSON(o) {
  if (o && Array.isArray(o.matches) && o.matches.every(ressembleMatch)) {
    return { matches: o.matches.map(lireMatch), teamCode: optTexte(o.teamCode), teamName: optTexte(o.teamName) };
  }
  if (Array.isArray(o) && o.length && o.every(ressembleMatch)) return { matches: o.map(lireMatch), teamCode: undefined, teamName: undefined };
  return null;
}

/** Encadrement (.json) : { teamCode, teamName, staffMembers, staffRoles } */
export const ecrireEncadrementJSON = (staffMembers, staffRoles, profil) =>
  json({ teamCode: profil?.teamCode, teamName: profil?.name, staffMembers, staffRoles });

export function lireEncadrementJSON(o) {
  if (o && Array.isArray(o.staffMembers) && Array.isArray(o.staffRoles)) {
    return { staffMembers: o.staffMembers.map(lireEncadrant), staffRoles: o.staffRoles.map(lireRole), teamCode: optTexte(o.teamCode), teamName: optTexte(o.teamName) };
  }
  if (Array.isArray(o) && o.every((s) => s && 'roleId' in s)) return { staffMembers: o.map(lireEncadrant), staffRoles: [], teamCode: undefined, teamName: undefined };
  return null;
}

/** Présences (.json) : { startDate, endDate, sessions, playerStats, exportDate } */
export const ecrirePresencesJSON = (sessions, playerStats, debut, fin) =>
  json({ startDate: iso(debut), endDate: iso(fin), sessions, playerStats, exportDate: iso() });

export function lirePresencesJSON(o) {
  if (!o || !Array.isArray(o.sessions) || !Array.isArray(o.playerStats) || !o.startDate || !o.endDate) return null;
  return {
    startDate: lireDate(o.startDate), endDate: lireDate(o.endDate), exportDate: lireDate(o.exportDate) ?? iso(),
    sessions: o.sessions.map(lireSeance),
    playerStats: o.playerStats.map((s) => ({
      playerId: idDe(s.playerId), firstName: texte(s.firstName), lastName: texte(s.lastName),
      totalSessions: entier(s.totalSessions), presentSessions: entier(s.presentSessions),
    })),
  };
}

/**
 * Composition (.tdj, cascade A → B → C) — ExportService.exportRoster.
 * Renvoie l'objet RosterExport (à passer à ecrireComposition).
 */
export function composerExportComposition({
  allPlayers, selectedPlayerIds, teamName, competition, matchDate,
  previousUnavailableIds = [], previousChain = [], excludePhotos = false, targetTeamCode,
}) {
  const choisis = new Set(selectedPlayerIds);
  const anciens = new Set(previousUnavailableIds);
  const sansPhoto = (p) => (excludePhotos ? { ...p, photoData: undefined, homeCategoryId: undefined, phoneNumber: undefined } : p);
  const chaine = [...previousChain];
  if (teamName !== '') chaine.push(teamName);
  return {
    teamName,
    competition,
    matchDate: iso(matchDate),
    selectedPlayers: allPlayers.filter((p) => choisis.has(p.id)).map(sansPhoto),
    availablePlayers: allPlayers.filter((p) => !choisis.has(p.id) && !anciens.has(p.id)).map(sansPhoto),
    unavailablePlayerIds: [...previousUnavailableIds, ...choisis],
    selectionChain: chaine,
    targetTeamCode: targetTeamCode || undefined,
    formatVersion: 1,
  };
}
export const ecrireComposition = (roster) => json(roster);

export function lireComposition(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  if (!Array.isArray(o.availablePlayers) || !Array.isArray(o.selectedPlayers) || !Array.isArray(o.unavailablePlayerIds)
    || !Array.isArray(o.selectionChain) || typeof o.teamName !== 'string' || typeof o.competition !== 'string' || !o.matchDate) return null;
  return {
    teamName: o.teamName,
    competition: o.competition,
    matchDate: lireDate(o.matchDate) ?? iso(),
    selectedPlayers: o.selectedPlayers.map(lireJoueur),
    availablePlayers: o.availablePlayers.map(lireJoueur),
    unavailablePlayerIds: o.unavailablePlayerIds.map(idDe),
    unavailablePlayers: Array.isArray(o.unavailablePlayers) ? o.unavailablePlayers.map(lireJoueur) : undefined,
    selectionChain: o.selectionChain.map((s) => texte(s)),
    targetTeamCode: optTexte(o.targetTeamCode),
    formatVersion: entier(o.formatVersion, 1),
  };
}

/** Nom du fichier de composition : « Joueurs_dispo_Equipe_A_2026-11-23.tdj » */
export function nomFichierComposition(teamName, matchDate) {
  const equipe = teamName.replaceAll(' ', '_').replaceAll('/', '-');
  return `Joueurs_dispo_${equipe}_${formatDateMotif(matchDate, 'yyyy-MM-dd')}.tdj`;
}

// MARK: - Sauvegarde complète (.tdjb) — ExportService.FullBackup

/**
 * Données → sauvegarde complète, au format de l'app native.
 * donnees = { players, staffMembers, staffRoles, profiles: [{ profile, matches, trainingSessions, currentSeason, seasonArchives }], tactics, trainingPlans }
 */
export function ecrireSauvegarde(donnees, appVersion = `${VERSION_APP} (web)`) {
  return json({
    version: 1,
    exportDate: iso(),
    appVersion,
    players: donnees.players,
    staffMembers: donnees.staffMembers,
    staffRoles: donnees.staffRoles,
    profilesData: donnees.profiles.map((p) => ({
      profile: p.profile,
      matches: p.matches,
      trainingSessions: p.trainingSessions,
      currentSeason: p.currentSeason ?? undefined,
      seasonArchives: p.seasonArchives,
    })),
    tactics: (donnees.tactics ?? []).map(ecrireTactique),
    trainingPlans: donnees.trainingPlans ?? [],
  });
}

/** Lit une sauvegarde complète → { backup, profileCount, playerCount, totalMatches, totalTrainingSessions, staffCount, tacticCount } | null */
export function lireSauvegarde(o) {
  if (!o || typeof o !== 'object' || !Array.isArray(o.profilesData) || !Array.isArray(o.players)
    || !Array.isArray(o.staffMembers) || !Array.isArray(o.staffRoles) || o.version == null || !o.exportDate) return null;
  const backup = {
    version: entier(o.version, 1),
    exportDate: lireDate(o.exportDate) ?? iso(),
    appVersion: optTexte(o.appVersion),
    players: o.players.map(lireJoueur),
    staffMembers: o.staffMembers.map(lireEncadrant),
    staffRoles: o.staffRoles.map(lireRole),
    profilesData: o.profilesData.map((d) => ({
      profile: lireProfil(d.profile),
      matches: tableau(d.matches).map(lireMatch),
      trainingSessions: tableau(d.trainingSessions).map(lireSeance),
      currentSeason: d.currentSeason ? lireSaison(d.currentSeason) : undefined,
      seasonArchives: tableau(d.seasonArchives).map(lireArchive),
    })),
    tactics: Array.isArray(o.tactics) ? o.tactics.map(lireTactique) : undefined,
    trainingPlans: Array.isArray(o.trainingPlans) ? o.trainingPlans.map(lirePlan) : undefined,
  };
  return {
    backup,
    profileCount: backup.profilesData.length,
    playerCount: backup.players.length,
    totalMatches: backup.profilesData.reduce((t, d) => t + d.matches.length, 0),
    totalTrainingSessions: backup.profilesData.reduce((t, d) => t + d.trainingSessions.length, 0),
    staffCount: backup.staffMembers.length,
    tacticCount: backup.tactics?.length ?? 0,
  };
}

/** Résumé lisible (ExportService.summary) */
export function resumeSauvegarde(r) {
  const p = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
  const parts = [
    p(r.profileCount, 'catégorie', 'catégories'),
    p(r.playerCount, 'joueur', 'joueurs'),
    p(r.totalMatches, 'match', 'matchs'),
    p(r.totalTrainingSessions, 'entraînement', 'entraînements'),
    p(r.staffCount, 'encadrant', 'encadrants'),
  ];
  if (r.tacticCount > 0) parts.push(p(r.tacticCount, 'séquence tactique', 'séquences tactiques'));
  return parts.join(', ');
}

/** Nom de fichier daté : « TempsDeJeu_Sauvegarde_2026-11-23.tdjb » */
export const nomFichierDate = (prefixe, extension, date = new Date()) => `${prefixe}_${formatDateMotif(date, 'yyyy-MM-dd')}.${extension}`;

// MARK: - Liens de sondage et réponses (DeepLinkManager.swift)

export const SITE = 'https://boboul-cloud.github.io/Temps-De-Jeu';
export const ADRESSE_WEB = 'https://tempsdejeu.riskelo-salon.workers.dev';

function base64UrlDepuisOctets(octets) {
  let binaire = '';
  for (const b of octets) binaire += String.fromCharCode(b);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function octetsDepuisBase64Url(texteB64) {
  let b = texteB64.replace(/-/g, '+').replace(/_/g, '/');
  b += '='.repeat((4 - (b.length % 4)) % 4);
  const binaire = atob(b);
  return Uint8Array.from(binaire, (c) => c.charCodeAt(0));
}
async function fluxVersOctets(flux) {
  const morceaux = [];
  const lecteur = flux.getReader();
  for (;;) { const { done, value } = await lecteur.read(); if (done) break; morceaux.push(value); }
  const res = new Uint8Array(morceaux.reduce((t, m) => t + m.length, 0));
  let i = 0;
  for (const m of morceaux) { res.set(m, i); i += m.length; }
  return res;
}
/** Compression « deflate brut », comme NSData.compressed(using: .zlib) */
export async function compresser(octets) {
  const cs = new CompressionStream('deflate-raw');
  const w = cs.writable.getWriter(); w.write(octets); w.close();
  return fluxVersOctets(cs.readable);
}
export async function decompresser(octets) {
  const ds = new DecompressionStream('deflate-raw');
  const w = ds.writable.getWriter(); w.write(octets); w.close();
  return fluxVersOctets(ds.readable);
}

/** Lien du sondage de disponibilité (createAvailabilityPollURL / createIndividualPollURL) */
export async function lienSondage({ teamName, sessionId, sessionDate, players, coachPhone = '' }) {
  const donnees = {
    t: teamName,
    d: formatDateMotif(sessionDate, 'yyyy-MM-dd'),
    s: sessionId.slice(0, 8),
    p: players.map((p) => [p.id.slice(0, 8), fullName(p)]),
  };
  if (coachPhone.trim() !== '') donnees.c = coachPhone.trim();
  const z = base64UrlDepuisOctets(await compresser(new TextEncoder().encode(JSON.stringify(donnees))));
  return `${SITE}/dispo.html?z=${z}`;
}

/** Message du sondage collectif (createAvailabilityPollMessage) */
export function messageSondage({ teamName, sessionDate, location = '', playerCount, url }) {
  let m = `⚽ Sondage disponibilité — ${teamName}\n📅 ${formatDate(sessionDate, 'long')}`;
  if (location !== '') m += `\n📍 ${location}`;
  m += `\n👥 ${playerCount} joueurs convoqués\n\nTouche le lien pour répondre :\n${url}`;
  return m;
}

/** Message individuel (createIndividualPollMessage) */
export function messageSondageIndividuel({ teamName, sessionDate, location = '', playerFirstName, url }) {
  let m = `⚽ Bonjour ${playerFirstName} !\n📅 Entraînement ${teamName} — ${formatDate(sessionDate, 'long')}`;
  if (location !== '') m += `\n📍 ${location}`;
  m += `\n\n\nTouche le lien pour indiquer ta disponibilité :\n${url}`;
  return m;
}

/**
 * Lit une réponse au sondage : lien tempsdejeu://a/…, lien …/dispo.html?r=…, #r=… ou le message complet.
 * → { s, i, n, r, c } | null
 */
export function lireReponseSondage(source) {
  const t = String(source ?? '');
  const m = t.match(/tempsdejeu:\/\/a\/([A-Za-z0-9_-]+)/) || t.match(/[?&#]r=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const o = JSON.parse(new TextDecoder().decode(octetsDepuisBase64Url(m[1])));
    if (typeof o.s !== 'string' || typeof o.i !== 'string' || typeof o.n !== 'string' || ![0, 1, 2].includes(o.r)) return null;
    return { s: o.s, i: o.i, n: o.n, r: o.r, c: typeof o.c === 'string' ? o.c : '' };
  } catch {
    return null;
  }
}

/** Composition en lien web (#r= est pris par les réponses : #c=) */
export async function lienComposition(roster) {
  const z = base64UrlDepuisOctets(await compresser(new TextEncoder().encode(JSON.stringify(propre(roster)))));
  return `${ADRESSE_WEB}/#c=${z}`;
}
export async function lireLienComposition(source) {
  const m = String(source ?? '').match(/#c=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    return lireComposition(JSON.parse(new TextDecoder().decode(await decompresser(octetsDepuisBase64Url(m[1])))));
  } catch {
    return null;
  }
}

/** Empreinte d'un match (date au jour + équipes) pour fusionner un import */
export function empreinteMatch(m) {
  const jour = Math.trunc(debutDuJour(m.date).getTime() / 1000);
  return `${jour}_${m.homeTeam.trim().toLowerCase()}_${m.awayTeam.trim().toLowerCase()}`;
}
export const empreinteCarton = (c) => `${c.playerName.trim().toLowerCase()}_${Math.trunc(c.minute / 60)}_${c.type}`;

/** Fusionne cartons, buts et remplacements d'un match importé (ContentView.mergeCards) */
export function fusionnerEvenements(existant, importe) {
  const idsCartons = new Set(existant.cards.map((c) => c.id));
  const empreintes = new Set(existant.cards.map(empreinteCarton));
  for (const c of importe.cards) if (!idsCartons.has(c.id) && !empreintes.has(empreinteCarton(c))) existant.cards.push(c);
  const idsButs = new Set(existant.goals.map((g) => g.id));
  for (const g of importe.goals) if (!idsButs.has(g.id)) existant.goals.push(g);
  const idsRemp = new Set(existant.substitutions.map((s) => s.id));
  for (const s of importe.substitutions) if (!idsRemp.has(s.id)) existant.substitutions.push(s);
  return existant;
}

/** Version de l'app native dont cette version web reprend les fonctions */
export const VERSION_APP = '1.7.1';
