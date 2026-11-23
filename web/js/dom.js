// Mise à jour de l'écran par comparaison : on redessine tout à chaque changement, mais seuls les nœuds
// qui diffèrent sont touchés. Le champ en cours de saisie garde donc son focus, son curseur et son texte.

const cleDe = (n) => (n.nodeType === 1 ? n.getAttribute('data-key') : null);

function memeType(a, b) {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== 1) return true;
  if (a.tagName !== b.tagName) return false;
  if (a.tagName === 'INPUT' && a.type !== (b.getAttribute('type') || 'text').toLowerCase()) return false;
  return true;
}

function majElement(ancien, nouveau) {
  // Attributs (la taille d'un canvas, posée par son dessin, n'est jamais retirée : elle l'effacerait)
  const canvas = ancien.tagName === 'CANVAS';
  for (const { name } of [...ancien.attributes]) {
    if (canvas && (name === 'width' || name === 'height')) continue;
    if (!nouveau.hasAttribute(name)) ancien.removeAttribute(name);
  }
  if (canvas) {
    for (const { name, value } of [...nouveau.attributes]) {
      if (ancien.getAttribute(name) !== value) ancien.setAttribute(name, value);
    }
    return;   // le contenu d'un canvas est dessiné, pas décrit
  }
  for (const { name, value } of [...nouveau.attributes]) {
    if (ancien.getAttribute(name) !== value) ancien.setAttribute(name, value);
  }

  const tag = ancien.tagName;
  if (tag === 'SELECT') {
    patchEnfants(ancien, nouveau);
    const choisie = [...nouveau.options].findIndex((o) => o.hasAttribute('selected'));
    if (choisie >= 0 && ancien.selectedIndex !== choisie) ancien.selectedIndex = choisie;
    return;
  }
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    // Le champ où l'on tape n'est jamais réécrit : sa valeur est déjà la bonne.
    if (ancien === document.activeElement) return;
    const valeur = tag === 'TEXTAREA' ? nouveau.textContent : (nouveau.getAttribute('value') ?? '');
    if (ancien.value !== valeur) ancien.value = valeur;
    return;
  }
  patchEnfants(ancien, nouveau);
}

function maj(ancien, nouveau) {
  if (ancien.nodeType === 1) majElement(ancien, nouveau);
  else if (ancien.nodeValue !== nouveau.nodeValue) ancien.nodeValue = nouveau.nodeValue;
}

function patchEnfants(parent, modele) {
  const nouveaux = [...modele.childNodes];
  const parCle = new Map();
  for (const n of parent.childNodes) {
    const k = cleDe(n);
    if (k != null) parCle.set(k, n);
  }
  let curseur = parent.firstChild;
  for (const nn of nouveaux) {
    const k = cleDe(nn);
    let cible = null;
    if (k != null) {
      const candidat = parCle.get(k);
      if (candidat && memeType(candidat, nn)) cible = candidat;
      parCle.delete(k);
    } else if (curseur && cleDe(curseur) == null && memeType(curseur, nn)) {
      cible = curseur;
    }
    if (cible) {
      if (cible === curseur) curseur = curseur.nextSibling;
      else parent.insertBefore(cible, curseur);
      maj(cible, nn);
    } else {
      parent.insertBefore(nn, curseur);
    }
  }
  while (curseur) {
    const suivant = curseur.nextSibling;
    parent.removeChild(curseur);
    curseur = suivant;
  }
}

/** Remplace le contenu de `parent` par `html`, en ne modifiant que ce qui a changé. */
export function patch(parent, html) {
  const modele = document.createElement('template');
  modele.innerHTML = html;
  patchEnfants(parent, modele.content);
}

/** Échappe un texte pour l'insérer dans du HTML (contenu ou attribut). */
export const h = (valeur) => String(valeur ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
