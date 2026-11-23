// Écriture de PDF à la main (sans bibliothèque), avec une interface proche du dessin UIKit
// utilisé par l'app native (UIGraphicsPDFRenderer) : origine en haut à gauche, y vers le bas,
// pages A4 de 595 × 842 points. Polices standard du PDF (Helvetica), codage WinAnsi :
// les accents français passent, les pictogrammes (emoji) sont retirés ou remplacés.

// Chasses Helvetica / Helvetica-Bold (métriques Adobe, millièmes de cadratin) pour l'ASCII 32–126.
const CHASSE_F1 = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500,
  667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556,
  556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500,
  500, 500, 334, 260, 334, 584];
const CHASSE_F2 = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556,
  722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556,
  611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556,
  556, 500, 389, 280, 389, 584];
const CHASSES_SPECIALES = {
  '€': 556, '—': 1000, '–': 556, '…': 1000, '•': 350, '«': 556, '»': 556, '’': 278, '‘': 278, '“': 500, '”': 500,
  '\u00A0': 278, '\u202F': 278, '°': 400, 'Œ': 1000, 'œ': 944, 'Æ': 1000, 'æ': 889, 'ß': 611, '×': 584, '·': 278, '²': 333,
};
const WINANSI = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a,
  '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f, '\u00A0': 0xa0, '\u202F': 0xa0,
};

/** Remplace ce que les polices standard ne savent pas écrire */
export function preparerTexte(texte) {
  return String(texte ?? '')
    .replace(/⚠️?\s*/gu, '! ')
    .replace(/✅/gu, '✓ ').replace(/❌/gu, '✗ ')
    .replace(/[▸►▶]/g, '•')
    .replace(/[→]/g, '->').replace(/[←]/g, '<-')
    .replace(/[⏱⚽🟨🟥⬜🔄📋📅📍👥⚽️🏆⭐️]/gu, '')
    .replace(/\p{Extended_Pictographic}️?/gu, '')
    .replace(/️/g, '')
    .replace(/[ \t]+$/g, '');
}

const nomPolice = (gras, italique) => (gras ? (italique ? 'F4' : 'F2') : (italique ? 'F3' : 'F1'));

function chasse(car, gras) {
  if (car === '✓' || car === '✗') return 755;
  const code = car.codePointAt(0);
  const table = gras ? CHASSE_F2 : CHASSE_F1;
  if (code >= 32 && code <= 126) return table[code - 32];
  if (CHASSES_SPECIALES[car]) return CHASSES_SPECIALES[car];
  const base = car.normalize('NFD')[0];
  const cb = base.codePointAt(0);
  if (cb >= 32 && cb <= 126) return table[cb - 32];
  return 556;
}

/** Largeur d'un texte en points */
export const mesurer = (texte, taille = 12, gras = false) =>
  [...preparerTexte(texte)].reduce((s, c) => s + chasse(c, gras), 0) * taille / 1000;

function coder(car) {
  if (WINANSI[car]) return WINANSI[car];
  const code = car.codePointAt(0);
  return code < 256 ? code : 0x3f;
}

function chainePDF(texte) {
  let s = '(';
  for (const car of texte) {
    const code = coder(car);
    if (code === 0x28 || code === 0x29 || code === 0x5c) s += `\\${String.fromCharCode(code)}`;
    else if (code < 32 || code > 126) s += `\\${code.toString(8).padStart(3, '0')}`;
    else s += String.fromCharCode(code);
  }
  return `${s})`;
}

/** Couleur : [r, g, b] (0…1), '#RRGGBB', 'rgb(…)' ou nom simple */
const NOMMEES = {
  noir: [0, 0, 0], black: [0, 0, 0], blanc: [1, 1, 1], white: [1, 1, 1],
  gris: [0.56, 0.56, 0.58], gray: [0.56, 0.56, 0.58], grisClair: [0.83, 0.83, 0.83], lightGray: [2 / 3, 2 / 3, 2 / 3],
  darkGray: [1 / 3, 1 / 3, 1 / 3], secondaire: [0.24, 0.24, 0.26],
  rouge: [1, 0.231, 0.188], red: [1, 0.231, 0.188], vert: [0.204, 0.78, 0.349], green: [0.204, 0.78, 0.349],
  bleu: [0, 0.478, 1], blue: [0, 0.478, 1], orange: [1, 0.584, 0], jaune: [1, 0.8, 0], yellow: [1, 0.8, 0],
  violet: [0.686, 0.322, 0.871], purple: [0.686, 0.322, 0.871], rose: [1, 0.176, 0.333], pink: [1, 0.176, 0.333],
  cyan: [0.196, 0.678, 0.902], indigo: [0.345, 0.337, 0.839], systemGray6: [0.949, 0.949, 0.969],
};
export function rgb(c) {
  if (Array.isArray(c)) return c;
  if (c == null) return [0, 0, 0];
  if (NOMMEES[c]) return NOMMEES[c];
  const s = String(c).trim();
  let m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) return [0, 1, 2].map((i) => parseInt(m[1][i] + m[1][i], 16) / 255);
  m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) return m[1].split(',').slice(0, 3).map((v) => Number(v.trim()) / 255);
  return [0, 0, 0];
}
const fmtN = (n) => (Math.round(n * 1000) / 1000).toString();
const fmtC = (c) => rgb(c).map((v) => fmtN(Math.min(1, Math.max(0, v)))).join(' ');

function base64EnOctets(b64) {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Dimensions d'un JPEG (marqueur SOF) */
function tailleJPEG(o) {
  let i = 2;
  while (i < o.length) {
    if (o[i] !== 0xff) { i += 1; continue; }
    const m = o[i + 1];
    const longueur = (o[i + 2] << 8) | o[i + 3];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { hauteur: (o[i + 5] << 8) | o[i + 6], largeur: (o[i + 7] << 8) | o[i + 8], composantes: o[i + 9] };
    }
    i += 2 + longueur;
  }
  return null;
}

export const A4 = { largeur: 595, hauteur: 842 };

export class DocumentPDF {
  constructor({ largeur = 595, hauteur = 842, titre = '' } = {}) {
    this.largeur = largeur;
    this.hauteur = hauteur;
    this.titre = titre;
    this.pages = [];
    this.images = [];
    this.flux = null;
  }

  /** Commence une page (beginPage) */
  nouvellePage() {
    this.flux = [];
    this.pages.push({ flux: this.flux, images: new Set() });
    return this;
  }

  get page() { return this.pages.length; }

  /** Y en points depuis le haut → repère PDF */
  y(v) { return this.hauteur - v; }

  /**
   * Texte sur une ligne, coin haut-gauche en (x, y) comme NSString.draw(at:).
   * options : taille, gras, italique, couleur, align ('left' | 'center' | 'right' — x est alors le bord concerné)
   * Renvoie la largeur écrite.
   */
  texte(texte, x, y, { taille = 12, gras = false, italique = false, couleur = 'noir', align = 'left', largeurMax = null } = {}) {
    let t = preparerTexte(texte).replace(/\n/g, ' ');
    if (largeurMax != null && mesurer(t, taille, gras) > largeurMax) {
      while (t.length > 1 && mesurer(`${t}…`, taille, gras) > largeurMax) t = t.slice(0, -1);
      t = `${t.trimEnd()}…`;
    }
    const l = mesurer(t, taille, gras);
    let x0 = x;
    if (align === 'center') x0 = x - l / 2;
    else if (align === 'right') x0 = x - l;
    const base = y + taille * 0.93;
    this.flux.push(`BT /${nomPolice(gras, italique)} ${fmtN(taille)} Tf ${fmtC(couleur)} rg ${fmtN(x0)} ${fmtN(this.y(base))} Td ${chainePDF(t)} Tj ET`);
    return l;
  }

  /** Coupe un texte en lignes tenant dans `largeur` */
  couper(texte, largeur, taille = 12, gras = false) {
    const lignes = [];
    for (const paragraphe of preparerTexte(texte).split('\n')) {
      let courante = '';
      for (const mot of paragraphe.split(/(?<= )/)) {
        const essai = courante + mot;
        if (mesurer(essai.trimEnd(), taille, gras) <= largeur || courante === '') courante = essai;
        else { lignes.push(courante.trimEnd()); courante = mot; }
      }
      lignes.push(courante.trimEnd());
    }
    return lignes;
  }

  /** Hauteur d'une ligne de texte (lineHeight d'UIFont ≈ 1,2 × taille) */
  hauteurLigne(taille = 12) { return taille * 1.2; }

  /** Hauteur qu'occuperait un texte coupé dans `largeur` (boundingRect) */
  hauteurBloc(texte, largeur, { taille = 12, gras = false, interligne = 0 } = {}) {
    return this.couper(texte, largeur, taille, gras).length * (this.hauteurLigne(taille) + interligne);
  }

  /** Texte sur plusieurs lignes dans un cadre (NSString.draw(in:)) ; renvoie la hauteur utilisée */
  texteBloc(texte, x, y, largeur, { taille = 12, gras = false, italique = false, couleur = 'noir', align = 'left', interligne = 0 } = {}) {
    const lignes = this.couper(texte, largeur, taille, gras);
    const h = this.hauteurLigne(taille) + interligne;
    lignes.forEach((l, i) => {
      const xa = align === 'center' ? x + largeur / 2 : align === 'right' ? x + largeur : x;
      this.texte(l, xa, y + i * h, { taille, gras, italique, couleur, align });
    });
    return lignes.length * h;
  }

  /** Trait (CGContext.move/addLine/strokePath) */
  ligne(x1, y1, x2, y2, { couleur = 'grisClair', epaisseur = 0.5, pointilles = null } = {}) {
    this.flux.push(`q ${fmtC(couleur)} RG ${fmtN(epaisseur)} w ${pointilles ? `[${pointilles.join(' ')}] 0 d ` : ''}${fmtN(x1)} ${fmtN(this.y(y1))} m ${fmtN(x2)} ${fmtN(this.y(y2))} l S Q`);
  }

  /** Rectangle (arrondi si rayon) : remplissage et/ou trait */
  rect(x, y, l, h, { remplissage = null, trait = null, epaisseur = 1, rayon = 0, opacite = 1 } = {}) {
    const chemin = rayon > 0 ? this.cheminArrondi(x, y, l, h, Math.min(rayon, l / 2, h / 2)) : `${fmtN(x)} ${fmtN(this.y(y + h))} ${fmtN(l)} ${fmtN(h)} re`;
    this.peindre(chemin, { remplissage, trait, epaisseur, opacite });
  }

  cheminArrondi(x, y, l, h, r) {
    const k = r * 0.5523;
    const X = (v) => fmtN(v);
    const Y = (v) => fmtN(this.y(v));
    return [
      `${X(x + r)} ${Y(y)} m`,
      `${X(x + l - r)} ${Y(y)} l`, `${X(x + l - r + k)} ${Y(y)} ${X(x + l)} ${Y(y + r - k)} ${X(x + l)} ${Y(y + r)} c`,
      `${X(x + l)} ${Y(y + h - r)} l`, `${X(x + l)} ${Y(y + h - r + k)} ${X(x + l - r + k)} ${Y(y + h)} ${X(x + l - r)} ${Y(y + h)} c`,
      `${X(x + r)} ${Y(y + h)} l`, `${X(x + r - k)} ${Y(y + h)} ${X(x)} ${Y(y + h - r + k)} ${X(x)} ${Y(y + h - r)} c`,
      `${X(x)} ${Y(y + r)} l`, `${X(x)} ${Y(y + r - k)} ${X(x + r - k)} ${Y(y)} ${X(x + r)} ${Y(y)} c h`,
    ].join(' ');
  }

  /** Cercle (ellipse dans un carré) */
  cercle(cx, cy, r, { remplissage = null, trait = null, epaisseur = 1, opacite = 1 } = {}) {
    this.peindre(this.cheminArrondi(cx - r, cy - r, 2 * r, 2 * r, r), { remplissage, trait, epaisseur, opacite });
  }

  /** Chemin libre : points [[x, y], …] (polyligne), fermé ou non */
  polygone(points, { remplissage = null, trait = null, epaisseur = 1, ferme = true, pointilles = null, opacite = 1 } = {}) {
    if (points.length < 2) return;
    const c = points.map(([x, y], i) => `${fmtN(x)} ${fmtN(this.y(y))} ${i === 0 ? 'm' : 'l'}`).join(' ') + (ferme ? ' h' : '');
    this.peindre(c, { remplissage, trait, epaisseur, pointilles, opacite });
  }

  /** Courbe de Bézier quadratique de a à b par le point de contrôle c */
  courbe(a, c, b, { trait = 'noir', epaisseur = 1, pointilles = null } = {}) {
    const c1 = [a[0] + (2 / 3) * (c[0] - a[0]), a[1] + (2 / 3) * (c[1] - a[1])];
    const c2 = [b[0] + (2 / 3) * (c[0] - b[0]), b[1] + (2 / 3) * (c[1] - b[1])];
    const chemin = `${fmtN(a[0])} ${fmtN(this.y(a[1]))} m ${fmtN(c1[0])} ${fmtN(this.y(c1[1]))} ${fmtN(c2[0])} ${fmtN(this.y(c2[1]))} ${fmtN(b[0])} ${fmtN(this.y(b[1]))} c`;
    this.peindre(chemin, { trait, epaisseur, pointilles });
  }

  peindre(chemin, { remplissage = null, trait = null, epaisseur = 1, pointilles = null, opacite = 1 }) {
    if (!remplissage && !trait) return;
    let gs = '';
    if (opacite < 1) {
      const nom = `GS${Math.round(opacite * 100)}`;
      this.opacites ??= new Set();
      this.opacites.add(Math.round(opacite * 100));
      gs = `/${nom} gs `;
    }
    const op = remplissage && trait ? 'B' : remplissage ? 'f' : 'S';
    this.flux.push(`q ${gs}${remplissage ? `${fmtC(remplissage)} rg ` : ''}${trait ? `${fmtC(trait)} RG ${fmtN(epaisseur)} w ` : ''}${pointilles ? `[${pointilles.join(' ')}] 0 d ` : ''}1 j 1 J ${chemin} ${op} Q`);
  }

  /**
   * Image JPEG (base64 sans préfixe, data URL ou octets) dans le cadre (x, y, l, h).
   * Une photo carrée peut être découpée en rond avec `rond: true`.
   */
  image(source, x, y, l, h, { rond = false } = {}) {
    let octets = source;
    if (typeof source === 'string') octets = base64EnOctets(source.includes(',') ? source.split(',')[1] : source);
    const t = tailleJPEG(octets);
    if (!t) return;
    const nom = `Im${this.images.length + 1}`;
    this.images.push({ nom, octets, ...t });
    this.pages[this.pages.length - 1].images.add(nom);
    const clip = rond ? `${this.cheminArrondi(x, y, l, h, Math.min(l, h) / 2)} W n ` : '';
    this.flux.push(`q ${clip}${fmtN(l)} 0 0 ${fmtN(h)} ${fmtN(x)} ${fmtN(this.y(y + h))} cm /${nom} Do Q`);
  }

  /** Image d'un canvas (diagramme) */
  imageCanvas(canvas, x, y, l, h, qualite = 0.92) {
    this.image(canvas.toDataURL('image/jpeg', qualite), x, y, l, h);
  }

  /** Fichier PDF complet (Uint8Array) */
  octets() {
    if (!this.pages.length) this.nouvellePage();
    const enc = new TextEncoder();
    const morceaux = [];
    let position = 0;
    const decalages = [];
    const ecrire = (texte) => { const o = typeof texte === 'string' ? latin1(texte) : texte; morceaux.push(o); position += o.length; };
    const latin1 = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
    let n = 0;
    const objet = (corps) => { n += 1; decalages[n] = position; ecrire(`${n} 0 obj\n`); if (typeof corps === 'string') ecrire(corps); else corps(); ecrire('\nendobj\n'); return n; };

    ecrire('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
    // 1 catalogue, 2 pages, 3-6 polices
    const idCatalogue = 1; const idPages = 2;
    n = 2; // réservés
    const idsPolices = ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique']
      .map((base) => objet(`<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>`));
    const idsImages = {};
    for (const im of this.images) {
      idsImages[im.nom] = objet(() => {
        ecrire(`<< /Type /XObject /Subtype /Image /Width ${im.largeur} /Height ${im.hauteur} /ColorSpace /${im.composantes === 1 ? 'DeviceGray' : im.composantes === 4 ? 'DeviceCMYK' : 'DeviceRGB'} /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.octets.length} >>\nstream\n`);
        ecrire(im.octets);
        ecrire('\nendstream');
      });
    }
    const opacites = [...(this.opacites ?? [])];
    const idsPage = [];
    for (const page of this.pages) {
      const contenu = enc.encode(page.flux.join('\n'));
      const contenuLatin = latin1(page.flux.join('\n'));
      void contenu;
      const idFlux = objet(() => { ecrire(`<< /Length ${contenuLatin.length} >>\nstream\n`); ecrire(contenuLatin); ecrire('\nendstream'); });
      const xobjets = [...page.images].map((nom) => `/${nom} ${idsImages[nom]} 0 R`).join(' ');
      const gs = opacites.map((o) => `/GS${o} << /Type /ExtGState /ca ${fmtN(o / 100)} /CA ${fmtN(o / 100)} >>`).join(' ');
      idsPage.push(objet(`<< /Type /Page /Parent ${idPages} 0 R /MediaBox [0 0 ${fmtN(this.largeur)} ${fmtN(this.hauteur)}] /Contents ${idFlux} 0 R /Resources << /Font << /F1 ${idsPolices[0]} 0 R /F2 ${idsPolices[1]} 0 R /F3 ${idsPolices[2]} 0 R /F4 ${idsPolices[3]} 0 R >>${xobjets ? ` /XObject << ${xobjets} >>` : ''}${gs ? ` /ExtGState << ${gs} >>` : ''} >> >>`));
    }
    // Objets réservés
    const fin = n;
    decalages[idCatalogue] = position;
    ecrire(`${idCatalogue} 0 obj\n<< /Type /Catalog /Pages ${idPages} 0 R >>\nendobj\n`);
    decalages[idPages] = position;
    ecrire(`${idPages} 0 obj\n<< /Type /Pages /Kids [${idsPage.map((i) => `${i} 0 R`).join(' ')}] /Count ${idsPage.length} >>\nendobj\n`);
    const infos = fin + 1;
    decalages[infos] = position;
    ecrire(`${infos} 0 obj\n<< /Producer (Temps De Jeu web) /Title ${chainePDF(preparerTexte(this.titre))} >>\nendobj\n`);
    const xref = position;
    ecrire(`xref\n0 ${infos + 1}\n0000000000 65535 f \n`);
    for (let i = 1; i <= infos; i++) ecrire(`${String(decalages[i]).padStart(10, '0')} 00000 n \n`);
    ecrire(`trailer\n<< /Size ${infos + 1} /Root ${idCatalogue} 0 R /Info ${infos} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    const total = new Uint8Array(position);
    let i = 0;
    for (const m of morceaux) { total.set(m, i); i += m.length; }
    return total;
  }
}

/**
 * Aide à la mise en page verticale, comme les fonctions ensureSpace / beginNewPage du code natif.
 * const m = new MiseEnPage(doc, { marge: 40 }); m.assurer(30); doc.texte('…', m.marge, m.y); m.y += 18;
 */
export class MiseEnPage {
  constructor(doc, { marge = 40, surNouvellePage = null } = {}) {
    this.doc = doc;
    this.marge = marge;
    this.surNouvellePage = surNouvellePage;
    this.y = marge;
    doc.nouvellePage();
  }

  get largeurUtile() { return this.doc.largeur - 2 * this.marge; }

  nouvellePage() {
    this.doc.nouvellePage();
    this.y = this.marge;
    this.surNouvellePage?.(this);
  }

  /** Passe à la page suivante s'il ne reste pas `hauteur` points */
  assurer(hauteur) {
    if (this.y + hauteur > this.doc.hauteur - this.marge) this.nouvellePage();
  }
}
