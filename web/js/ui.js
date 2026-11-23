// Interface commune de Temps De Jeu (version web) : navigation (onglets, piles, feuilles),
// dialogues dessinés (jamais alert/confirm du navigateur), composants façon iOS,
// fichiers (partage, téléchargement, choix), aperçu PDF, SMS.
//
// Principe : l'écran entier est redessiné en texte HTML à chaque changement, puis comparé
// au DOM (dom.js) : seuls les nœuds qui diffèrent sont touchés, le champ en cours de saisie
// garde son focus. Les écrans s'enregistrent ici (definirOnglet, definirPage, action, definirMontage).
import { patch, h } from './dom.js';
import { icone } from './icones.js';
import { couleur } from './model.js';

export { h, icone };

// MARK: - État global de l'interface

export const etat = {
  onglet: 'match',
  /** Pile de navigation de chaque onglet : [{ page, params }] (la racine n'y figure pas) */
  piles: {},
  /** Feuilles ouvertes, de la plus basse à la plus haute : [{ page, params, pile, plein }] */
  feuilles: [],
  /** Alerte en cours : { titre, message, actions, champs } */
  dialogue: null,
  /** Feuille d'actions (confirmationDialog) : { titre, message, actions } */
  menu: null,
  toast: null,
};

export const onglets = [];        // [{ id, titre, icone, page }]
const pages = {};                 // nom → fn(params) → { titre, grandTitre, gauche, droite, contenu, classe, barre }
const actions = {};               // nom → fn(el, evenement)
const montages = {};              // nom → fn(el) → démonter
const avantRendu = new Set();     // fonctions appelées avant chaque rendu

export function definirOnglet(id, def) { onglets.push({ id, ...def }); }
export function definirPage(nom, fn) { pages[nom] = fn; }
export function action(nom, fn) { actions[nom] = fn; }
export function definirMontage(nom, fn) { montages[nom] = fn; }
export function surChaqueRendu(fn) { avantRendu.add(fn); return () => avantRendu.delete(fn); }
export const pageExiste = (nom) => Boolean(pages[nom]);

// MARK: - Navigation

const pileCourante = () => {
  const f = etat.feuilles[etat.feuilles.length - 1];
  if (f) return f.pile;
  etat.piles[etat.onglet] ??= [];
  return etat.piles[etat.onglet];
};

/** Pousse une page dans la pile courante (celle de la feuille ouverte, sinon de l'onglet) */
export function pousser(page, params = {}) {
  memoriserDefilement();
  pileCourante().push({ page, params });
  rafraichir({ hautDePage: true });
}

/** Revient à la page précédente de la pile courante */
export function retour() {
  const pile = pileCourante();
  if (pile.length) { pile.pop(); rafraichir({ restaurer: true }); }
}

/** Revient à la racine de la pile courante */
export function retourRacine() {
  const pile = pileCourante();
  pile.length = 0;
  rafraichir({ restaurer: true });
}

/** Ouvre une page en feuille (modale). plein: true → plein écran (fullScreenCover) */
export function ouvrirFeuille(page, params = {}, { plein = false } = {}) {
  memoriserDefilement();
  etat.feuilles.push({ page, params, pile: [], plein });
  rafraichir({ hautDePage: true });
}

/** Ferme la feuille du dessus (ou celle dont la page est `page`) */
export function fermerFeuille(page) {
  if (page) {
    const i = etat.feuilles.map((f) => f.page).lastIndexOf(page);
    if (i >= 0) etat.feuilles.splice(i, 1);
  } else {
    etat.feuilles.pop();
  }
  rafraichir({ restaurer: true });
}

export const feuilleOuverte = (page) => etat.feuilles.some((f) => f.page === page);
export const pageCourante = () => {
  const f = etat.feuilles[etat.feuilles.length - 1];
  if (f) return f.pile[f.pile.length - 1] ?? { page: f.page, params: f.params };
  const pile = etat.piles[etat.onglet] ?? [];
  return pile[pile.length - 1] ?? { page: onglets.find((o) => o.id === etat.onglet)?.page, params: {} };
};

export function changerOnglet(id) {
  if (!onglets.some((o) => o.id === id)) return;
  memoriserDefilement();
  if (etat.onglet === id) etat.piles[id] = [];   // retouche l'onglet : retour à sa racine
  etat.onglet = id;
  rafraichir({ restaurer: true });
}

/** Profondeur totale (pour le bouton « retour » du téléphone) */
const profondeur = () => (etat.dialogue ? 1 : 0) + (etat.menu ? 1 : 0)
  + etat.feuilles.reduce((t, f) => t + 1 + f.pile.length, 0) + (etat.piles[etat.onglet]?.length ?? 0);

function reculerUnNiveau() {
  if (etat.dialogue) { etat.dialogue = null; return; }
  if (etat.menu) { etat.menu = null; return; }
  const f = etat.feuilles[etat.feuilles.length - 1];
  if (f) { if (f.pile.length) f.pile.pop(); else if (!f.params?.bloquerRetour) etat.feuilles.pop(); return; }
  const pile = etat.piles[etat.onglet];
  if (pile?.length) pile.pop();
}

// Bouton « retour » du téléphone (Android) et du navigateur : une entrée d'historique sert de garde
let gardeActive = false;
function assurerGarde() {
  if (profondeur() > 0 && !gardeActive) {
    try { history.pushState({ garde: true }, ''); gardeActive = true; } catch { /* ignoré */ }
  }
}
addEventListener('popstate', () => {
  gardeActive = false;
  if (profondeur() > 0) { reculerUnNiveau(); rafraichir({ restaurer: true }); }
});

// MARK: - Défilement mémorisé par page

const defilements = new Map();
const cleDefilement = () => {
  const f = etat.feuilles.length;
  const p = pageCourante();
  return `${etat.onglet}|${f}|${p.page}|${(etat.feuilles[f - 1]?.pile ?? etat.piles[etat.onglet] ?? []).length}`;
};
function defileurCourant() {
  const couches = document.querySelectorAll('#app .couche');
  const haut = couches[couches.length - 1];
  return haut?.querySelector('.defile') ?? null;
}
function memoriserDefilement() {
  const d = defileurCourant();
  if (d) defilements.set(cleDefilement(), d.scrollTop);
}

// MARK: - Dialogues dessinés

/**
 * Alerte (.alert). actions : [{ libelle, role: 'annuler' | 'detruire' | undefined, faire }]
 * champs (facultatif) : [{ nom, valeur, placeholder, type }] — TextField dans l'alerte
 */
export function alerte(titre, message = '', actionsAlerte = [{ libelle: 'OK' }], champs = null) {
  etat.dialogue = { titre, message, actions: actionsAlerte, champs: champs?.map((c) => ({ ...c, valeur: c.valeur ?? '' })) };
  rafraichir();
}

/** Confirmation : « Supprimer » (rouge) + « Annuler » */
export function confirmer({ titre, message = '', libelle = 'Supprimer', role = 'detruire', faire, annuler = 'Annuler' }) {
  alerte(titre, message, [{ libelle: annuler, role: 'annuler' }, { libelle, role, faire }]);
}

/** Feuille d'actions (confirmationDialog) : actions [{ libelle, role, icone, faire }] + « Annuler » */
export function choix({ titre = '', message = '', actions: liste }) {
  etat.menu = { titre, message, actions: liste };
  rafraichir();
}

/** Saisie dans une alerte : champs [{ nom, valeur, placeholder, type }] ; faire(valeurs) */
export function saisie({ titre, message = '', champs, valider = 'OK', annuler = 'Annuler', faire }) {
  alerte(titre, message, [{ libelle: annuler, role: 'annuler' }, { libelle: valider, faire: (v) => faire(v) }], champs);
}

let minuterieToast = null;
/** Message bref en bas de l'écran */
export function toast(message, duree = 2200) {
  etat.toast = message;
  clearTimeout(minuterieToast);
  minuterieToast = setTimeout(() => { etat.toast = null; rafraichir(); }, duree);
  rafraichir();
}

// MARK: - Rendu

let racine = null;
let renduShell = null;
let demande = null;
let optionsRendu = {};

/** Demande un nouveau rendu (regroupé à la prochaine image) */
export function rafraichir(options = {}) {
  optionsRendu = { ...optionsRendu, ...options };
  if (demande || !racine) return;
  demande = requestAnimationFrame(rendre);
}

/** Rend tout de suite (après un changement qui doit être visible immédiatement) */
export function rendreMaintenant() {
  if (demande) cancelAnimationFrame(demande);
  rendre();
}

const montes = new Set();

function rendre() {
  demande = null;
  const options = optionsRendu;
  optionsRendu = {};
  for (const fn of avantRendu) fn();
  patch(racine, renduShell());
  // Montages : composants dessinés à la main (canvas, 3D, glisser-déposer)
  for (const el of racine.querySelectorAll('[data-monter]')) {
    if (el.__monte === el.dataset.monter) continue;
    if (el.__demonter) { try { el.__demonter(); } catch { /* ignoré */ } }
    const fn = montages[el.dataset.monter];
    el.__monte = el.dataset.monter;
    el.__demonter = fn ? fn(el) : null;
    montes.add(el);
  }
  for (const el of [...montes]) {
    if (!el.isConnected) {
      montes.delete(el);
      try { el.__demonter?.(); } catch { /* ignoré */ }
      el.__monte = null;
    }
  }
  const d = defileurCourant();
  if (d) {
    if (options.hautDePage) d.scrollTop = 0;
    else if (options.restaurer) d.scrollTop = defilements.get(cleDefilement()) ?? 0;
  }
  // Champ à activer (autofocus) une seule fois
  const auto = racine.querySelector('[data-autofocus]:not([data-focus-fait])');
  if (auto) { auto.setAttribute('data-focus-fait', ''); auto.focus({ preventScroll: true }); }
  assurerGarde();
}

/** Rend une page enregistrée (racine d'onglet, page poussée ou feuille) */
export function rendrePage(nom, params = {}) {
  const fn = pages[nom];
  if (!fn) return { titre: '', contenu: `<p class="vide-texte">Écran « ${h(nom)} » indisponible.</p>` };
  try {
    return fn(params) ?? { titre: '', contenu: '' };
  } catch (e) {
    console.error(e);
    return { titre: 'Erreur', contenu: `<p class="vide-texte">Cet écran n'a pas pu s'afficher.</p>` };
  }
}

/** Démarre l'interface : racine DOM et fonction qui produit le HTML complet */
export function demarrer(element, shell) {
  racine = element;
  renduShell = shell;
  // Clics : data-action="nom" (les données sont dans data-*)
  racine.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-action]');
    if (!el || !racine.contains(el) || el.hasAttribute('disabled')) return;
    const fn = actions[el.dataset.action];
    if (!fn) return;
    if (el.tagName === 'A' && !el.hasAttribute('href')) ev.preventDefault();
    const r = fn(el, ev);
    if (r !== false) rafraichir();
  });
  // Saisie : data-input="nom" (à chaque frappe), data-change="nom" (validation)
  racine.addEventListener('input', (ev) => {
    const el = ev.target.closest('[data-input]');
    if (!el) return;
    const fn = actions[el.dataset.input];
    if (fn && fn(el, ev) !== false) rafraichir();
  });
  racine.addEventListener('change', (ev) => {
    const el = ev.target.closest('[data-change]');
    if (!el) return;
    const fn = actions[el.dataset.change];
    if (fn && fn(el, ev) !== false) rafraichir();
  });
  // Entrée dans un champ : data-entree="nom"
  racine.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (etat.dialogue || etat.menu) { etat.dialogue = null; etat.menu = null; rafraichir(); ev.preventDefault(); }
      return;
    }
    if (ev.key !== 'Enter' || ev.isComposing) return;
    const el = ev.target.closest('[data-entree]');
    if (!el) return;
    const fn = actions[el.dataset.entree];
    if (fn) { ev.preventDefault(); if (fn(el, ev) !== false) rafraichir(); }
  });
  rendre();
}

// Actions de base de la navigation et des dialogues
action('nav.retour', () => retour());
action('nav.fermer', () => fermerFeuille());
action('nav.onglet', (el) => changerOnglet(el.dataset.onglet));
action('nav.pousser', (el) => pousser(el.dataset.page, { ...el.dataset }));
action('dialogue.choisir', (el) => {
  const d = etat.dialogue;
  if (!d) return;
  const a = d.actions[Number(el.dataset.index)];
  const valeurs = Object.fromEntries((d.champs ?? []).map((c) => [c.nom, c.valeur]));
  etat.dialogue = null;
  a?.faire?.(valeurs);
});
action('dialogue.champ', (el) => {
  const c = etat.dialogue?.champs?.find((x) => x.nom === el.dataset.nom);
  if (c) c.valeur = el.value;
  return false;
});
action('dialogue.entree', () => {
  const d = etat.dialogue;
  if (!d) return;
  const i = d.actions.findIndex((a) => a.role !== 'annuler');
  if (i >= 0) {
    const valeurs = Object.fromEntries((d.champs ?? []).map((c) => [c.nom, c.valeur]));
    etat.dialogue = null;
    d.actions[i].faire?.(valeurs);
  }
});
action('dialogue.fond', (el, ev) => { if (ev.target === el) { etat.menu = null; } });
action('menu.choisir', (el) => {
  const m = etat.menu;
  etat.menu = null;
  m?.actions[Number(el.dataset.index)]?.faire?.();
});
action('menu.annuler', () => { etat.menu = null; });

/** HTML des dialogues, feuille d'actions et toast (appelé par le shell) */
export function rendreSurcouches() {
  let html = '';
  if (etat.menu) {
    const m = etat.menu;
    html += `<div class="voile voile-menu" data-action="dialogue.fond" data-key="menu">
      <div class="menu-actions" role="dialog" aria-modal="true">
        <div class="menu-groupe">
          ${m.titre || m.message ? `<div class="menu-entete">${m.titre ? `<b>${h(m.titre)}</b>` : ''}${m.message ? `<span>${h(m.message)}</span>` : ''}</div>` : ''}
          ${m.actions.map((a, i) => `<button type="button" class="menu-bouton${a.role === 'detruire' ? ' detruire' : ''}" data-action="menu.choisir" data-index="${i}">${a.icone ? icone(a.icone) : ''}${h(a.libelle)}</button>`).join('')}
        </div>
        <button type="button" class="menu-bouton menu-annuler" data-action="menu.annuler">Annuler</button>
      </div>
    </div>`;
  }
  if (etat.dialogue) {
    const d = etat.dialogue;
    const empile = d.actions.length > 2;
    html += `<div class="voile" data-key="dialogue">
      <div class="alerte" role="alertdialog" aria-modal="true" aria-labelledby="alerte-titre">
        <div class="alerte-corps">
          <p class="alerte-titre" id="alerte-titre">${h(d.titre)}</p>
          ${d.message ? `<p class="alerte-message">${h(d.message)}</p>` : ''}
          ${(d.champs ?? []).map((c, i) => `<input class="alerte-champ" type="${c.type ?? 'text'}" value="${h(c.valeur)}" placeholder="${h(c.placeholder ?? '')}"
            data-input="dialogue.champ" data-entree="dialogue.entree" data-nom="${h(c.nom)}" ${i === 0 ? 'data-autofocus' : ''} autocomplete="off">`).join('')}
        </div>
        <div class="alerte-boutons${empile ? ' empiles' : ''}">
          ${d.actions.map((a, i) => `<button type="button" class="alerte-bouton${a.role === 'annuler' ? ' annuler' : ''}${a.role === 'detruire' ? ' detruire' : ''}"
            data-action="dialogue.choisir" data-index="${i}">${h(a.libelle)}</button>`).join('')}
        </div>
      </div>
    </div>`;
  }
  if (etat.toast) html += `<div class="toast" role="status" data-key="toast">${h(etat.toast)}</div>`;
  return html;
}

// MARK: - Barre de navigation et page

/** Bouton de barre de navigation : texte ou pictogramme */
export function boutonBarre({ libelle = '', icone: ic = '', action: a, data = {}, gras = false, desactive = false, titre = '', couleur: c = '' }) {
  const attrs = Object.entries(data).map(([k, v]) => ` data-${k}="${h(v)}"`).join('');
  return `<button type="button" class="bouton-barre${gras ? ' gras' : ''}${ic && !libelle ? ' icone-seule' : ''}" data-action="${h(a)}"${attrs}
    ${desactive ? 'disabled' : ''} ${titre || (!libelle && ic) ? `aria-label="${h(titre || libelle)}" title="${h(titre || libelle)}"` : ''}
    ${c ? `style="color:${couleur(c)}"` : ''}>${ic ? icone(ic) : ''}${libelle ? `<span>${h(libelle)}</span>` : ''}</button>`;
}

/** Bouton « < Retour » (pile) */
export const boutonRetour = (libelle = 'Retour') =>
  `<button type="button" class="bouton-barre retour" data-action="nav.retour">${icone('chevron.left')}<span>${h(libelle)}</span></button>`;

/** HTML d'une page : barre de navigation + contenu qui défile */
export function rendreCadre(def, { retourPossible = false, libelleRetour = 'Retour', feuille = false } = {}) {
  const gauche = def.gauche ?? (retourPossible ? boutonRetour(def.libelleRetour ?? libelleRetour) : (feuille && !def.sansFermer ? boutonBarre({ libelle: 'Fermer', action: 'nav.fermer' }) : ''));
  const barre = def.barre === false ? '' : `<header class="barre-nav${def.grandTitre ? ' avec-grand-titre' : ''}">
      <div class="barre-gauche">${gauche}</div>
      <div class="barre-titre">${h(def.titre ?? '')}</div>
      <div class="barre-droite">${def.droite ?? ''}</div>
    </header>`;
  return `${barre}<div class="defile${def.classe ? ` ${def.classe}` : ''}">
    ${def.grandTitre ? `<h1 class="grand-titre">${h(def.titre)}</h1>` : ''}
    ${def.contenu ?? ''}
  </div>${def.pied ? `<div class="pied-fixe">${def.pied}</div>` : ''}`;
}

// MARK: - Composants (équivalents SwiftUI)

const attributs = (data = {}) => Object.entries(data).filter(([, v]) => v != null)
  .map(([k, v]) => ` data-${k}="${h(v)}"`).join('');

/** Section de liste groupée (Section { } header: footer:) */
export function section({ entete = '', pied = '', lignes = [], classe = '', cle = '' } = {}) {
  const contenu = Array.isArray(lignes) ? lignes.filter(Boolean).join('') : lignes;
  return `<section class="section${classe ? ` ${classe}` : ''}"${cle ? ` data-key="${h(cle)}"` : ''}>
    ${entete ? `<h2 class="section-entete">${entete}</h2>` : ''}
    ${contenu ? `<div class="section-corps">${contenu}</div>` : ''}
    ${pied ? `<p class="section-pied">${pied}</p>` : ''}
  </section>`;
}

/**
 * Ligne de liste. Tous les textes sont échappés sauf `droite` et `contenu` (HTML).
 * action : nom d'action (la ligne devient un bouton) ; chevron : flèche de navigation.
 */
export function ligne({
  titre = '', sousTitre = '', icone: ic = '', couleurIcone = '', valeur = '', droite = '', contenu = '',
  action: a = '', data = {}, chevron = false, detruire = false, teinte = false, cle = '', classe = '', desactive = false, avatar = '',
}) {
  const tag = a ? 'button' : 'div';
  const pictogramme = avatar || (ic ? `<span class="ligne-icone"${couleurIcone ? ` style="color:${couleur(couleurIcone)}"` : ''}>${icone(ic)}</span>` : '');
  return `<${tag}${a ? ' type="button"' : ''} class="ligne${a ? ' tactile' : ''}${detruire ? ' detruire' : ''}${teinte ? ' teinte' : ''}${classe ? ` ${classe}` : ''}"
    ${a ? `data-action="${h(a)}"` : ''}${attributs(data)}${cle ? ` data-key="${h(cle)}"` : ''}${desactive ? ' disabled' : ''}>
    ${pictogramme}
    <span class="ligne-textes">${contenu || `<span class="ligne-titre">${h(titre)}</span>${sousTitre ? `<span class="ligne-sous-titre">${h(sousTitre)}</span>` : ''}`}</span>
    ${valeur !== '' && valeur != null ? `<span class="ligne-valeur">${h(valeur)}</span>` : ''}
    ${droite}
    ${chevron ? `<span class="ligne-chevron">${icone('chevron.right')}</span>` : ''}
  </${tag}>`;
}

/** Champ de texte dans une ligne (TextField). `input` : action appelée à chaque frappe */
export function champ({
  nom = '', valeur = '', placeholder = '', type = 'text', input = '', change = '', entree = '', libelle = '',
  data = {}, autofocus = false, mode = '', min, max, pas, multiligne = false, lignes = 3, cle = '', classe = '', desactive = false,
}) {
  const commun = `class="champ${classe ? ` ${classe}` : ''}" ${nom ? `name="${h(nom)}"` : ''} placeholder="${h(placeholder)}"
    ${input ? `data-input="${h(input)}"` : ''}${change ? ` data-change="${h(change)}"` : ''}${entree ? ` data-entree="${h(entree)}"` : ''}
    ${attributs(data)}${autofocus ? ' data-autofocus' : ''}${mode ? ` inputmode="${h(mode)}"` : ''}${cle ? ` data-key="${h(cle)}"` : ''}
    ${desactive ? ' disabled' : ''} aria-label="${h(libelle || placeholder || nom)}"`;
  const element = multiligne
    ? `<textarea ${commun} rows="${lignes}">${h(valeur)}</textarea>`
    : `<input type="${h(type)}" value="${h(valeur)}" ${commun}${min != null ? ` min="${h(min)}"` : ''}${max != null ? ` max="${h(max)}"` : ''}${pas != null ? ` step="${h(pas)}"` : ''}
      ${type === 'text' ? 'autocomplete="off"' : ''}>`;
  if (!libelle) return `<div class="ligne ligne-champ">${element}</div>`;
  return `<label class="ligne ligne-champ avec-libelle"><span class="ligne-titre">${h(libelle)}</span>${element}</label>`;
}

/** Interrupteur (Toggle) */
export function interrupteur({ titre = '', sousTitre = '', actif = false, action: a, data = {}, icone: ic = '', couleurIcone = '', desactive = false }) {
  return `<label class="ligne ligne-interrupteur">
    ${ic ? `<span class="ligne-icone"${couleurIcone ? ` style="color:${couleur(couleurIcone)}"` : ''}>${icone(ic)}</span>` : ''}
    <span class="ligne-textes"><span class="ligne-titre">${h(titre)}</span>${sousTitre ? `<span class="ligne-sous-titre">${h(sousTitre)}</span>` : ''}</span>
    <input type="checkbox" class="interrupteur" role="switch" ${actif ? 'checked' : ''} data-change="${h(a)}"${attributs(data)}${desactive ? ' disabled' : ''}>
  </label>`;
}

/** Menu déroulant (Picker) : options [[valeur, libellé]] */
export function selecteur({ titre = '', valeur, options, action: a, data = {}, icone: ic = '', desactive = false, seul = false }) {
  const select = `<select class="selecteur" data-change="${h(a)}"${attributs(data)}${desactive ? ' disabled' : ''} aria-label="${h(titre)}">
    ${options.map(([v, l]) => `<option value="${h(v)}"${String(v) === String(valeur) ? ' selected' : ''}>${h(l)}</option>`).join('')}
  </select>`;
  if (seul) return select;
  return `<label class="ligne ligne-selecteur">
    ${ic ? `<span class="ligne-icone">${icone(ic)}</span>` : ''}
    <span class="ligne-textes"><span class="ligne-titre">${h(titre)}</span></span>${select}
  </label>`;
}

/** Contrôle segmenté (Picker .segmented) */
export function segmente({ valeur, options, action: a, data = {}, classe = '' }) {
  return `<div class="segmente${classe ? ` ${classe}` : ''}" role="radiogroup">${options.map(([v, l]) => {
    const actif = String(v) === String(valeur);
    return `<button type="button" role="radio" aria-checked="${actif}" class="${actif ? 'actif' : ''}"
      data-action="${h(a)}" data-valeur="${h(v)}"${attributs(data)}>${l}</button>`;
  }).join('')}</div>`;
}

/** Stepper : − valeur + */
export function stepper({ titre = '', valeur, texte = null, min = -Infinity, max = Infinity, action: a, data = {} }) {
  return `<div class="ligne ligne-stepper">
    <span class="ligne-textes"><span class="ligne-titre">${h(titre)}</span></span>
    ${texte != null ? `<span class="ligne-valeur">${h(texte)}</span>` : ''}
    <span class="stepper">
      <button type="button" data-action="${h(a)}" data-pas="-1"${attributs(data)} ${valeur <= min ? 'disabled' : ''} aria-label="Moins">${icone('minus')}</button>
      <button type="button" data-action="${h(a)}" data-pas="1"${attributs(data)} ${valeur >= max ? 'disabled' : ''} aria-label="Plus">${icone('plus')}</button>
    </span>
  </div>`;
}

/**
 * Bouton. style : 'plein' (borderedProminent), 'teinte' (bordered), 'texte' (plain), 'detruire', 'detruire-plein', 'gris'
 */
export function bouton({ libelle = '', icone: ic = '', style = 'plein', action: a = '', data = {}, desactive = false, couleur: c = '', classe = '', titre = '', large = false, petit = false }) {
  const st = c ? (style === 'plein' ? `style="--bouton:${couleur(c)}"` : `style="--bouton:${couleur(c)};color:${couleur(c)}"`) : '';
  return `<button type="button" class="bouton ${h(style)}${large ? ' large' : ''}${petit ? ' petit' : ''}${classe ? ` ${classe}` : ''}" ${a ? `data-action="${h(a)}"` : ''}${attributs(data)}
    ${desactive ? 'disabled' : ''} ${st} ${titre ? `title="${h(titre)}" aria-label="${h(titre)}"` : ''}>${ic ? icone(ic) : ''}${libelle ? `<span>${h(libelle)}</span>` : ''}</button>`;
}

/** État vide (ContentUnavailableView) */
export function vide({ icone: ic = 'info.circle', titre, message = '', bouton: b = '' }) {
  return `<div class="vide">
    <span class="vide-icone">${icone(ic)}</span>
    <p class="vide-titre">${h(titre)}</p>
    ${message ? `<p class="vide-message">${h(message)}</p>` : ''}
    ${b}
  </div>`;
}

/** Pastille (Capsule colorée) */
export const pastille = (texte, c = 'secondary', { plein = false, icone: ic = '' } = {}) =>
  `<span class="pastille${plein ? ' pleine' : ''}" style="--c:${couleur(c)}">${ic ? icone(ic) : ''}${h(texte)}</span>`;

/** Avatar rond : photo (base64 JPEG) ou initiales */
export function avatar({ photo = '', initiales = '', couleur: c = 'blue', taille = 40, icone: ic = '' }) {
  const style = `width:${taille}px;height:${taille}px;font-size:${Math.round(taille * 0.38)}px;--c:${couleur(c)}`;
  if (photo) return `<span class="avatar" style="${style}"><img src="data:image/jpeg;base64,${photo}" alt=""></span>`;
  if (ic) return `<span class="avatar" style="${style}">${icone(ic)}</span>`;
  return `<span class="avatar" style="${style}">${h(initiales)}</span>`;
}

/** Initiales « JD » */
export const initiales = (prenom = '', nom = '') =>
  `${[...prenom.trim()][0] ?? ''}${[...nom.trim()][0] ?? ''}`.toUpperCase() || '?';

/** Carte (fond secondaire arrondi) */
export const carte = (contenu, classe = '') => `<div class="carte${classe ? ` ${classe}` : ''}">${contenu}</div>`;

/** Grille de tuiles statistiques (StatBox) */
export function tuile({ titre, valeur, icone: ic = '', couleur: c = 'blue', detail = '' }) {
  return `<div class="tuile" style="--c:${couleur(c)}">
    ${ic ? `<span class="tuile-icone">${icone(ic)}</span>` : ''}
    <span class="tuile-valeur">${h(valeur)}</span>
    <span class="tuile-titre">${h(titre)}</span>
    ${detail ? `<span class="tuile-detail">${h(detail)}</span>` : ''}
  </div>`;
}

/** Barre de progression (ProgressView(value:)) */
export const progression = (ratio, c = 'teinte') =>
  `<span class="progression"><span style="width:${(Math.min(1, Math.max(0, ratio || 0)) * 100).toFixed(2)}%;${c !== 'teinte' ? `background:${couleur(c)}` : ''}"></span></span>`;

// MARK: - Fichiers, partage, presse-papiers

const ecranTactile = () => matchMedia('(pointer: coarse)').matches;

function enBlob(contenu, type) {
  if (contenu instanceof Blob) return contenu;
  return new Blob([contenu], { type });
}

/** Télécharge un fichier (ordinateur) */
export function telecharger(nom, contenu, type = 'application/octet-stream') {
  const url = URL.createObjectURL(enBlob(contenu, type));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/**
 * Partage (feuille de partage iOS) : Web Share sur téléphone, téléchargement / copie sur ordinateur.
 * fichiers : [{ nom, contenu, type }] ; texte, titre, url facultatifs.
 */
export async function partager({ titre = '', texte = '', url = '', fichiers = [] } = {}) {
  const objets = fichiers.map((f) => new File([enBlob(f.contenu, f.type ?? 'application/octet-stream')], f.nom, { type: f.type ?? 'application/octet-stream' }));
  const donnees = {};
  if (titre) donnees.title = titre;
  if (texte) donnees.text = texte;
  if (url) donnees.url = url;
  if (objets.length) donnees.files = objets;
  if (ecranTactile() && navigator.share && (!objets.length || navigator.canShare?.(donnees))) {
    try { await navigator.share(donnees); return true; } catch (e) { if (e?.name === 'AbortError') return false; }
  }
  if (objets.length) {
    for (const f of fichiers) telecharger(f.nom, f.contenu, f.type);
    toast(objets.length > 1 ? 'Fichiers téléchargés' : 'Fichier téléchargé');
    return true;
  }
  const t = [texte, url].filter(Boolean).join('\n');
  if (t && await copier(t)) toast('Copié dans le presse-papiers');
  return true;
}

/** Copie un texte ; renvoie true si réussi */
export async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    const zone = document.createElement('textarea');
    zone.value = texte;
    zone.style.position = 'fixed';
    zone.style.opacity = '0';
    document.body.appendChild(zone);
    zone.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    zone.remove();
    return ok;
  }
}

/** Choix de fichiers (fileImporter) → Promise<File[]> */
export function choisirFichier({ accept = '', multiple = false } = {}) {
  return new Promise((resoudre) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    input.addEventListener('change', () => { resoudre([...input.files]); input.remove(); });
    input.addEventListener('cancel', () => { resoudre([]); input.remove(); });
    document.body.appendChild(input);
    input.click();
  });
}

/** Lit une photo et la réduit (JPEG, côté max `taille`) → base64 sans préfixe */
export async function lirePhoto(fichier, taille = 400, qualite = 0.8) {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const r = Math.min(1, taille / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * r);
    c.height = Math.round(img.height * r);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', qualite).split(',')[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Lien SMS (iPhone : &body=, Android : ?body=) */
export function lienSMS(numeros = [], corps = '') {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const liste = (Array.isArray(numeros) ? numeros : [numeros]).filter(Boolean).map((n) => n.replace(/[^\d+]/g, '')).join(',');
  const sep = ios ? '&' : '?';
  return `sms:${liste}${corps ? `${sep}body=${encodeURIComponent(corps)}` : ''}`;
}

/** Lien WhatsApp avec texte */
export const lienWhatsApp = (texte) => `https://wa.me/?text=${encodeURIComponent(texte)}`;

// MARK: - Aperçu PDF (PDFPreviewView)

definirPage('apercu.pdf', (p) => {
  if (!p.url) p.url = URL.createObjectURL(new Blob([p.octets], { type: 'application/pdf' }));
  return {
    titre: p.titre ?? 'Aperçu',
    // Comme PDFPreviewView : partager à gauche, « Fermer » à droite
    gauche: boutonBarre({ icone: 'square.and.arrow.up', titre: 'Partager', action: 'apercu.partager' }),
    droite: boutonBarre({ libelle: 'Fermer', action: 'nav.fermer' }),
    classe: 'defile-pdf',
    contenu: `<iframe class="apercu-pdf" src="${h(p.url)}#view=FitH" title="${h(p.nomFichier)}" data-key="pdf-${h(p.nomFichier)}"></iframe>
      <div class="apercu-pdf-pied">${bouton({ libelle: 'Partager ou enregistrer', icone: 'square.and.arrow.up', action: 'apercu.partager', large: true })}</div>`,
  };
});
action('apercu.partager', () => {
  const f = etat.feuilles[etat.feuilles.length - 1];
  const p = f?.pile[f.pile.length - 1]?.params ?? f?.params;
  if (p?.octets) partager({ titre: p.titre, fichiers: [{ nom: p.nomFichier, contenu: p.octets, type: 'application/pdf' }] });
  return false;
});

/** Ouvre l'aperçu d'un PDF (octets Uint8Array) avec un bouton de partage */
export function apercuPDF(octets, nomFichier, titre = 'Aperçu') {
  ouvrirFeuille('apercu.pdf', { octets, nomFichier, titre }, { plein: true });
}

// MARK: - Divers

/** Ouvre un lien externe (Safari) */
export function ouvrirLien(url) {
  const a = document.createElement('a');
  a.href = url;
  if (!url.startsWith('sms:') && !url.startsWith('tel:') && !url.startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener'; }
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Valeur d'un champ date (AAAA-MM-JJ) depuis une date ISO, en heure locale */
export function valeurDate(isoTexte) {
  const d = isoTexte ? new Date(isoTexte) : new Date();
  const deux = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}
/** Valeur d'un champ datetime-local depuis une date ISO */
export function valeurDateHeure(isoTexte) {
  const d = isoTexte ? new Date(isoTexte) : new Date();
  const deux = (n) => String(n).padStart(2, '0');
  return `${valeurDate(isoTexte)}T${deux(d.getHours())}:${deux(d.getMinutes())}`;
}
/** Date ISO depuis un champ date (garde l'heure de `base`) ou datetime-local */
export function dateDepuisChamp(valeur, base = null) {
  if (!valeur) return base ?? new Date().toISOString();
  if (valeur.includes('T')) return new Date(valeur).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const [a, m, j] = valeur.split('-').map(Number);
  const b = base ? new Date(base) : new Date();
  const d = new Date(a, m - 1, j, b.getHours(), b.getMinutes(), b.getSeconds());
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
