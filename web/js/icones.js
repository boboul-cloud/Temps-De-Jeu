// Pictogrammes : équivalents dessinés des SF Symbols de l'app native, appelés par leur nom Swift
// (icone('trash'), icone('person.3.fill')…). Un nom inconnu donne un petit disque neutre.
const t = (corps, ep = 2) =>
  `<svg viewBox="0 0 24 24" class="ic" fill="none" stroke="currentColor" stroke-width="${ep}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corps}</svg>`;
const p = (corps) => `<svg viewBox="0 0 24 24" class="ic" fill="currentColor" aria-hidden="true">${corps}</svg>`;

// Formes de base réutilisées
const ROND = '<circle cx="12" cy="12" r="10"/>';
const rondPlein = (dedans) => p(`<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20z${dedans}"/>`);
const rondTrait = (dedans, ep = 1.8) => t(`${ROND}${dedans}`, ep);
const coche = 'M7.5 12.3l3 3 6-6.3';
const croix = 'M8.5 8.5l7 7M15.5 8.5l-7 7';

const PERSONNE = '<circle cx="12" cy="7.5" r="4"/><path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5z"/>';
const PERSONNE_T = '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.6-3.8 3.7-6.5 7.5-6.5s6.9 2.7 7.5 6.5"/>';
const PERSONNES2 = '<circle cx="9" cy="8" r="3.6"/><path d="M2 20c0-3.8 3.1-6.5 7-6.5s7 2.7 7 6.5z"/><circle cx="17" cy="9" r="2.8"/><path d="M17.5 13.6c2.7.3 4.5 2.5 4.5 5.4h-4.3"/>';
const PERSONNES3 = '<circle cx="12" cy="7.5" r="3.4"/><path d="M5.6 19.5c0-3.6 2.9-6.2 6.4-6.2s6.4 2.6 6.4 6.2z"/><circle cx="5" cy="9" r="2.4"/><path d="M.8 18.5c0-2.6 1.7-4.4 4-4.6-.8 1.3-1.2 2.8-1.2 4.6z"/><circle cx="19" cy="9" r="2.4"/><path d="M23.2 18.5c0-2.6-1.7-4.4-4-4.6.8 1.3 1.2 2.8 1.2 4.6z"/>';
const DOC = '<path d="M6 2.5h8l4.5 4.5v13a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V4A1.5 1.5 0 0 1 6 2.5z"/><path d="M14 2.5V7h4.5"/>';
const PARTAGE = '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M8 10.5H6.5A1.5 1.5 0 0 0 5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12a1.5 1.5 0 0 0-1.5-1.5H16"/>';
const RECEPTION = '<path d="M12 3v12M7.5 10.5 12 15l4.5-4.5"/><path d="M8 7.5H6.5A1.5 1.5 0 0 0 5 9v10.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V9a1.5 1.5 0 0 0-1.5-1.5H16"/>';
const BALLON = '<circle cx="12" cy="12" r="9.5"/><path d="M12 7.2l3.3 2.4-1.3 3.9h-4l-1.3-3.9z" fill="currentColor"/><path d="M12 2.5v4.7M15.3 9.6l4.5-1.5M14 13.5l2.8 3.8M10 13.5l-2.8 3.8M8.7 9.6 4.2 8.1"/>';
const TERRAIN = '<rect x="2.5" y="5" width="19" height="14" rx="1.5"/><path d="M12 5v14"/><circle cx="12" cy="12" r="2.6"/><path d="M2.5 9h3v6h-3M21.5 9h-3v6h3"/>';
const MAILLOT = '<path d="M8.5 3 3 5.8l1.6 4.6 2.4-.8V21h10V9.6l2.4.8L21 5.8 15.5 3c-.6 1.6-1.9 2.5-3.5 2.5S9.1 4.6 8.5 3z"/>';
const HORLOGE = '<circle cx="12" cy="12" r="9.5"/><path d="M12 6.5V12l3.8 2.3"/>';
const CALENDRIER = '<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4"/>';
const CRAYON = '<path d="M4 20l1-4.5L16.3 4.2a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L8.5 19z"/><path d="M14.5 6l3.5 3.5"/>';
const CORBEILLE = '<path d="M4 6.5h16M9.5 3h5M6 6.5l1 13.5h10l1-13.5M10 10.5v6M14 10.5v6"/>';
const DRAPEAU = '<path d="M5 21V3.5"/><path d="M5 4h12.5l-2.5 4 2.5 4H5" fill="currentColor"/>';
const CHRONO = '<circle cx="12" cy="13.5" r="8"/><path d="M12 13.5V9M9.5 2.5h5M18.5 6.5l1.5-1.5"/>';
const COUPE = '<path d="M7 3.5h10v5a5 5 0 0 1-10 0z"/><path d="M7 5H3.5c0 3 1.5 4.5 3.8 4.8M17 5h3.5c0 3-1.5 4.5-3.8 4.8M12 13.5V18M8 21h8M9.5 18h5"/>';
const LIVRES = '<rect x="3" y="4" width="4.5" height="16.5" rx="1"/><rect x="8.5" y="4" width="4.5" height="16.5" rx="1"/><path d="m14.6 5.2 4.2-1.3 3.4 15.6-4.3 1.2z"/>';
const CUBE = '<path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z"/><path d="M3.5 7 12 11.5 20.5 7M12 11.5v10"/>';
const ENGRENAGE = '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1 5.3 5.3"/><circle cx="12" cy="12" r="6.6"/>';
const MESSAGE = '<path d="M12 3.5c5 0 9 3.2 9 7.3s-4 7.2-9 7.2c-1 0-2-.1-2.9-.4L4.5 20l1-3.7C4 15 3 13 3 10.8c0-4.1 4-7.3 9-7.3z"/>';
const AVION = '<path d="M21.5 2.5 2.5 10l7 3 3 7z"/><path d="M21.5 2.5 9.5 13"/>';

const ICONES = {
  // Navigation et actions générales
  'chevron.right': t('<path d="m9 5 7 7-7 7"/>', 2.6),
  'chevron.left': t('<path d="m15 5-7 7 7 7"/>', 2.6),
  'chevron.down': t('<path d="m5 9 7 7 7-7"/>', 2.6),
  'chevron.up': t('<path d="m5 15 7-7 7 7"/>', 2.6),
  plus: t('<path d="M12 5v14M5 12h14"/>', 2.4),
  minus: t('<path d="M5 12h14"/>', 2.4),
  xmark: t('<path d="M6 6l12 12M18 6 6 18"/>', 2.4),
  checkmark: t('<path d="m4.5 12.5 4.8 4.8L19.5 7"/>', 2.6),
  trash: t(CORBEILLE, 1.8),
  'trash.fill': p('<path d="M9 2.5h6v2H9zM3.5 5.5h17v2h-17zM5.5 8.5h13l-1 12.5h-11z"/>'),
  pencil: t(CRAYON, 1.8),
  'pencil.circle': rondTrait('<path d="m8 16 .6-2.6 5.8-5.8 2 2-5.8 5.8z"/>', 1.6),
  'pencil.tip.crop.circle': rondTrait('<path d="M12 6.5 9 15h6zM10.5 15v2.5h3V15"/>', 1.6),
  'square.and.pencil': t('<path d="M11 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V13"/><path d="M10 14l.6-3L18 3.6l2.4 2.4-7.4 7.4z"/>', 1.8),
  'square.and.arrow.up': t(PARTAGE, 1.8),
  'square.and.arrow.up.fill': t(PARTAGE, 2.2),
  'square.and.arrow.down': t(RECEPTION, 1.8),
  'square.and.arrow.up.on.square': t(`${PARTAGE}<path d="M3 13v7.5"/>`, 1.8),
  'arrow.down.doc.fill': p('<path d="M6 2h8l5 5v13.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20.5v-17A1.5 1.5 0 0 1 6 2zm5 8v5.6l-2.3-2.3-1.4 1.4 4.7 4.7 4.7-4.7-1.4-1.4-2.3 2.3V10z"/>'),
  'arrow.up.doc.on.clipboard': t('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.5h6V4M12 17v-7M9 13l3-3 3 3"/>', 1.7),
  link: t('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>', 1.9),
  'doc.on.doc': t('<rect x="8" y="7" width="12" height="14.5" rx="2"/><path d="M5.5 16.5H5A1.5 1.5 0 0 1 3.5 15V4A1.5 1.5 0 0 1 5 2.5h9A1.5 1.5 0 0 1 15.5 4v.5"/>', 1.8),
  'doc.on.doc.fill': p('<rect x="8" y="7" width="12.5" height="15" rx="2"/><path d="M5 2h9.5A1.5 1.5 0 0 1 16 3.5V5H8a2 2 0 0 0-2 2v10H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>'),
  'plus.square.on.square': t('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M14.5 11.5v6M11.5 14.5h6M5 16H4.5A1.5 1.5 0 0 1 3 14.5v-10A1.5 1.5 0 0 1 4.5 3h10A1.5 1.5 0 0 1 16 4.5V5"/>', 1.8),
  'arrow.clockwise': t('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 3.5v5h-5"/>', 2),
  'arrow.triangle.2.circlepath': t('<path d="M4.5 10a7.7 7.7 0 0 1 13.4-3l1.6 1.8M19.5 14a7.7 7.7 0 0 1-13.4 3l-1.6-1.8"/><path d="M19.5 4v4.8h-4.8M4.5 20v-4.8h4.8"/>', 1.9),
  'arrow.uturn.backward.circle': rondTrait('<path d="M9 9.5h5a3 3 0 0 1 0 6h-3M11 7l-2.5 2.5L11 12"/>', 1.6),
  'arrow.left.arrow.right': t('<path d="M3.5 8h16M16 4.5 19.5 8 16 11.5M20.5 16h-16M8 12.5 4.5 16 8 19.5"/>', 2),
  'arrow.left.and.right': t('<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>', 2),
  'arrow.right': t('<path d="M4 12h16M14 6l6 6-6 6"/>', 2.2),
  'arrow.right.circle': rondTrait('<path d="M7.5 12h9M13 8.5l3.5 3.5-3.5 3.5"/>', 1.7),
  'arrow.up.forward': t('<path d="M7 17 17 7M8.5 7H17v8.5"/>', 2.2),
  'arrow.up.forward.circle': rondTrait('<path d="m8.5 15.5 7-7M10 8.5h5.5V14"/>', 1.7),
  'arrow.up.forward.circle.fill': rondPlein('M8.1 14.5l1.4 1.4 5-5V14h2V7.5H10v2h3.1z'),
  'arrow.up.circle.fill': rondPlein('M11 17h2V9.8l3 3 1.4-1.4L12 6l-5.4 5.4L8 12.8l3-3z'),
  'arrow.down.circle.fill': rondPlein('M11 7h2v7.2l3-3 1.4 1.4L12 18l-5.4-5.4L8 11.2l3 3z'),
  'arrow.triangle.branch': t('<path d="M6 21V10.5a4 4 0 0 1 4-4h8M15 3.5l3 3-3 3M6 3v4"/>', 2),
  'arrow.up.left.and.arrow.down.right': t('<path d="M4 10V4h6M4 4l6.5 6.5M20 14v6h-6M20 20l-6.5-6.5"/>', 2),
  'arrow.up.left.and.down.right.magnifyingglass': t('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20.5 20.5M8 13l5-5M9.5 8H13v3.5"/>', 1.8),
  'point.topleft.down.to.point.bottomright.curvepath': t('<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M6.5 6.5c4 3 1 7 5 8.5s4 1.5 6 2.5" stroke-dasharray="2 2.6"/>', 1.8),
  shuffle: t('<path d="M3 7h3.5c4.5 0 6.5 10 11 10H21M3 17h3.5c1.6 0 2.8-1.2 3.8-2.8M13.7 9.8C14.7 8.2 15.9 7 17.5 7H21M18 4l3 3-3 3M18 14l3 3-3 3"/>', 1.9),
  infinity: t('<path d="M12 12c-2-2.5-3.5-4-5.5-4a4 4 0 0 0 0 8c2 0 3.5-1.5 5.5-4s3.5-4 5.5-4a4 4 0 0 1 0 8c-2 0-3.5-1.5-5.5-4z"/>', 2),
  sparkles: p('<path d="M10 2.5 11.6 8 17 9.6l-5.4 1.6L10 16.7l-1.6-5.5L3 9.6 8.4 8zM18 13.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z"/>'),
  'wand.and.stars': t('<path d="m4 20 11-11 2 2-11 11z"/><path d="M15 3v3M13.5 4.5h3M20 8v2M19 9h2M18.5 2.5l.3.9.9.3-.9.3-.3.9-.3-.9-.9-.3.9-.3z"/>', 1.6),
  'lightbulb.fill': p('<path d="M12 2a7 7 0 0 0-4 12.8V17h8v-2.2A7 7 0 0 0 12 2zM9 18.5h6v1.2a2.3 2.3 0 0 1-2.3 2.3h-1.4A2.3 2.3 0 0 1 9 19.7z"/>'),
  'questionmark.circle': rondTrait('<path d="M9.5 9.5a2.6 2.6 0 1 1 3.6 2.4c-.8.4-1.1.9-1.1 1.7v.4"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>', 1.7),
  'questionmark.circle.fill': rondPlein('M11 16.2h2v2h-2zM12 5.8c-2.2 0-3.7 1.4-3.8 3.4h2c.1-.9.8-1.6 1.8-1.6s1.7.6 1.7 1.5c0 .7-.3 1.1-1.2 1.6-1.1.6-1.6 1.4-1.5 2.7v.5h2v-.4c0-.8.3-1.2 1.2-1.7 1-.6 1.6-1.4 1.6-2.7 0-1.9-1.6-3.3-3.8-3.3z'),
  'info.circle': rondTrait('<path d="M12 11v6"/><circle cx="12" cy="7.6" r=".7" fill="currentColor"/>', 1.7),
  'info.circle.fill': rondPlein('M11 10.5h2V17h-2zM12 6.4a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z'),
  'exclamationmark.triangle': t('<path d="M12 3.5 2.5 20h19z"/><path d="M12 9.5v5"/><circle cx="12" cy="17.2" r=".5" fill="currentColor"/>', 1.8),
  'exclamationmark.triangle.fill': p('<path fill-rule="evenodd" d="M12 2.5 1.5 21h21zM11 9.5h2v5.5h-2zm1 7a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z"/>'),
  'exclamationmark.shield.fill': p('<path fill-rule="evenodd" d="M12 2 4 5v6c0 5 3.4 9.2 8 11 4.6-1.8 8-6 8-11V5zm-1 5h2v6.5h-2zm1 8.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z"/>'),
  'checkmark.circle': rondTrait(`<path d="${coche}"/>`, 1.8),
  'checkmark.circle.fill': rondPlein('M10.4 16.6 6.6 12.8l1.4-1.4 2.4 2.4 5.6-5.9 1.4 1.4z'),
  'xmark.circle.fill': rondPlein('M8.1 9.5 9.5 8.1 12 10.6l2.5-2.5 1.4 1.4-2.5 2.5 2.5 2.5-1.4 1.4-2.5-2.5-2.5 2.5-1.4-1.4 2.5-2.5z'),
  'plus.circle.fill': rondPlein('M11 7h2v4h4v2h-4v4h-2v-4H7v-2h4z'),
  'minus.circle.fill': rondPlein('M7 11h10v2H7z'),
  'minus.circle': rondTrait('<path d="M7.5 12h9"/>', 1.8),
  'checkmark.seal.fill': p('<path fill-rule="evenodd" d="m12 1.5 2.5 1.9 3.1-.2.9 3 2.6 1.7-1 2.9 1 2.9-2.6 1.7-.9 3-3.1-.2L12 20.1l-2.5-1.9-3.1.2-.9-3-2.6-1.7 1-2.9-1-2.9 2.6-1.7.9-3 3.1.2zm-1.3 12.9-2.4-2.4-1.4 1.4 3.8 3.8 6.9-7-1.4-1.4z"/>'),
  'checkmark.rectangle.stack.fill': p('<path d="M6 2.5h12v1.5H6zM4 5.5h16V7H4z"/><path fill-rule="evenodd" d="M3 8.5h18A1.5 1.5 0 0 1 22.5 10v10a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 20V10A1.5 1.5 0 0 1 3 8.5zm7.4 10.3 6.4-6.4-1.4-1.4-5 5-2.2-2.2-1.4 1.4z"/>'),
  'ellipsis.circle': rondTrait('<circle cx="7.6" cy="12" r=".8" fill="currentColor"/><circle cx="12" cy="12" r=".8" fill="currentColor"/><circle cx="16.4" cy="12" r=".8" fill="currentColor"/>', 1.7),
  'ellipsis.circle.fill': rondPlein('M7.6 10.6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zm4.4 0a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zm4.4 0a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8z'),
  'number.circle': rondTrait('<path d="M10 7.5 9 16.5M15 7.5l-1 9M7.5 10.5h9.5M7 13.5h9.5"/>', 1.5),
  '1.circle.fill': rondPlein('M12.6 6.5h-1.8L8.6 8v2l2.2-1.4v8.9h1.8z'),
  '2.circle.fill': rondPlein('M8.8 17.5h6.6v-1.6h-4.1l2.2-2.3c1.3-1.3 1.8-2.2 1.8-3.3 0-1.9-1.4-3.2-3.4-3.2-2 0-3.4 1.3-3.5 3.2h1.7c0-.9.7-1.6 1.7-1.6s1.6.6 1.6 1.5c0 .7-.3 1.3-1.4 2.4l-3.2 3.4z'),
  '3.circle.fill': rondPlein('M12 17.7c2.2 0 3.6-1.2 3.6-2.9 0-1.3-.8-2.2-2.1-2.4 1.1-.3 1.8-1.1 1.8-2.2 0-1.6-1.4-2.7-3.3-2.7-2 0-3.3 1.1-3.4 2.8h1.7c0-.8.7-1.3 1.6-1.3 1 0 1.6.5 1.6 1.3s-.7 1.4-1.7 1.4h-.9v1.4h1c1.1 0 1.8.6 1.8 1.5s-.7 1.5-1.7 1.5-1.7-.5-1.8-1.3H8.4c.1 1.7 1.5 2.9 3.6 2.9z'),
  '4.circle.fill': rondPlein('M13.4 17.5h1.7v-2h1.3V14h-1.3V6.5H13l-4.8 7.6v1.4h5.2zm-3.4-3.5 3.4-5.4V14z'),

  // Personnes
  'person.fill': p(PERSONNE),
  'person.circle.fill': rondPlein('M12 5.5a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6zm0 13.5a7.4 7.4 0 0 1-5.6-2.6c1-1.9 3.1-3.1 5.6-3.1s4.6 1.2 5.6 3.1A7.4 7.4 0 0 1 12 19z'),
  'person.2.badge.gearshape': t('<circle cx="8" cy="8" r="3.3"/><path d="M2 19.5c0-3.4 2.7-5.8 6-5.8 1.7 0 3.2.6 4.3 1.6"/><circle cx="15.5" cy="7.5" r="2.6"/><circle cx="18" cy="17" r="2"/><path d="M18 13.5v1.4M18 19.1v1.4M21.5 17h-1.4M15.9 17h-1.4"/>', 1.7),
  'person.2.badge.plus': t('<circle cx="8" cy="8" r="3.3"/><path d="M2 19.5c0-3.4 2.7-5.8 6-5.8s6 2.4 6 5.8"/><circle cx="15.5" cy="7.5" r="2.6"/><path d="M19.5 13v6M16.5 16h6"/>', 1.7),
  'person.2.slash.fill': p(`${PERSONNES2}<path d="M2.7 2.7 21.3 21.3" stroke="currentColor" stroke-width="2"/>`),
  'person.3.fill': p(PERSONNES3),
  'person.3.sequence.fill': p('<circle cx="5" cy="9" r="2.6"/><circle cx="12" cy="9" r="2.6"/><circle cx="19" cy="9" r="2.6"/><path d="M.8 18c0-2.6 1.9-4.6 4.2-4.6s4.2 2 4.2 4.6zM7.8 18c0-2.6 1.9-4.6 4.2-4.6s4.2 2 4.2 4.6zM14.8 18c0-2.6 1.9-4.6 4.2-4.6s4.2 2 4.2 4.6z"/>'),
  'person.3.sequence': t('<circle cx="5" cy="9" r="2.4"/><circle cx="12" cy="9" r="2.4"/><circle cx="19" cy="9" r="2.4"/><path d="M1.5 17.5c0-2.2 1.6-3.8 3.5-3.8s3.5 1.6 3.5 3.8M8.5 17.5c0-2.2 1.6-3.8 3.5-3.8s3.5 1.6 3.5 3.8M15.5 17.5c0-2.2 1.6-3.8 3.5-3.8s3.5 1.6 3.5 3.8"/>', 1.5),
  'person.badge.plus': t(`${PERSONNE_T}<path d="M19 3v5M16.5 5.5h5"/>`, 1.8),
  'person.badge.key.fill': p(`${PERSONNE}<circle cx="18.5" cy="15" r="2.3" fill="var(--fond-icone, #fff)"/><path d="M18 16.8h1v4.5h-1z" fill="var(--fond-icone, #fff)"/>`),
  'person.badge.shield.checkmark.fill': p('<circle cx="10" cy="7.5" r="4"/><path d="M2 21c0-4.4 3.6-7.5 8-7.5 1 0 1.9.1 2.8.4V21z"/><path fill-rule="evenodd" d="M18.5 12 14 13.7v3.1c0 2.6 1.9 4.6 4.5 5.2 2.6-.6 4.5-2.6 4.5-5.2v-3.1zm-.6 7.2-1.9-1.9 1-1 .9.9 2.2-2.2 1 1z"/>'),
  'person.crop.circle.badge.plus': t(`${ROND}<circle cx="12" cy="10" r="3.2"/><path d="M6 18.5c1.2-2 3.4-3.2 6-3.2s4.8 1.2 6 3.2"/>`, 1.6),
  'person.crop.circle.badge.checkmark': t(`<circle cx="10" cy="12" r="8"/><circle cx="10" cy="10" r="2.8"/><path d="M5.3 17.3c1-1.6 2.8-2.6 4.7-2.6"/><path d="m15 17 2 2 4.5-4.5"/>`, 1.6),
  'person.crop.circle.badge.exclamationmark.fill': p('<path fill-rule="evenodd" d="M10 3a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 4a2.8 2.8 0 1 0 0 5.6A2.8 2.8 0 0 0 10 7zm0 7c-2 0-3.7 1-4.5 2.5a6.4 6.4 0 0 0 9 0C13.7 15 12 14 10 14z"/><path d="M19 7h2v8h-2zM19 17h2v2h-2z"/>'),
  'person.crop.circle.badge.clock': t('<circle cx="10" cy="12" r="8"/><circle cx="10" cy="10" r="2.8"/><path d="M5.3 17.3c1-1.6 2.8-2.6 4.7-2.6"/><circle cx="18" cy="17" r="4"/><path d="M18 15v2l1.3 1"/>', 1.5),
  'person.crop.square.filled.and.at.rectangle': p('<path fill-rule="evenodd" d="M4 3h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm5.5 3a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4zm0 5.2c-2 0-3.5 1-3.9 2.6h7.8c-.4-1.6-1.9-2.6-3.9-2.6z"/><rect x="11" y="17" width="11" height="5" rx="1.2"/>'),
  'person.fill.checkmark': p(`${PERSONNE}<path d="m16 12 2 2 4-4" stroke="currentColor" stroke-width="2" fill="none"/>`),
  'person.fill.viewfinder': t('<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/><circle cx="12" cy="10" r="2.8" fill="currentColor"/><path d="M7 17.5c.6-2.3 2.6-3.6 5-3.6s4.4 1.3 5 3.6z" fill="currentColor"/>', 1.8),
  'person.slash.fill': p(`${PERSONNE}<path d="M3 3l18 18" stroke="var(--fond-icone, #fff)" stroke-width="3.2"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="1.8"/>`),
  'person.text.rectangle': t('<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><circle cx="8" cy="10.5" r="2.2"/><path d="M4.8 16c.5-1.6 1.7-2.5 3.2-2.5s2.7.9 3.2 2.5M14 9.5h5M14 13h5"/>', 1.6),
  'figure.run': p('<circle cx="14.5" cy="4" r="2"/><path d="M12.4 7.2 8 9.3l-.9 3.6 1.7.4.7-2.6 1.6-.7-1.7 5.5-3.7 2.4.9 1.5 4.4-2.8.7-2.2 2.3 2.4V22h1.8v-6l-2.5-2.7.9-3 .9 1.6 3.4 1.2.6-1.6-2.8-1-1.5-2.7a1.8 1.8 0 0 0-2-.6z"/>'),
  'figure.run.circle.fill': rondPlein('M13.4 6.3a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm-1.2 3-3 1.4-.6 2.3 1.1.3.5-1.7 1-.4-1.1 3.6-2.4 1.6.6 1 2.9-1.8.5-1.5 1.5 1.6v2.6h1.2v-3.9l-1.6-1.8.6-2 .6 1 2.2.8.4-1-1.8-.7-1-1.8a1.2 1.2 0 0 0-1.3-.4z'),
  'figure.soccer': p('<circle cx="11" cy="4" r="2"/><path d="M9.4 7.3 6 9.5l.3 4 1.7-.2-.2-2.9 1.4-.8-.5 4.7-3.2 3.6 1.3 1.2 3.5-3.8.6-2.4 2 2.2.5 4.6 1.8-.2-.6-5.3-2.3-2.6.5-2.6 1.5 1.7 3.1.4.2-1.7-2.4-.3-2.5-3a1.8 1.8 0 0 0-2.3-.3z"/><circle cx="19" cy="19.5" r="2.5"/>'),

  // Sport
  soccerball: t(BALLON, 1.5),
  sportscourt: t(TERRAIN, 1.7),
  'sportscourt.fill': p('<path fill-rule="evenodd" d="M3.5 4.5h17A1.5 1.5 0 0 1 22 6v12a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 18V6a1.5 1.5 0 0 1 1.5-1.5zM11.3 6v4.1a2 2 0 0 0 0 3.8V18h1.4v-4.1a2 2 0 0 0 0-3.8V6zM3.4 9.3v5.4h2.4V9.3zm17.2 0h-2.4v5.4h2.4z"/>'),
  'tshirt.fill': p(MAILLOT),
  'flag.fill': p('<path d="M5 2.5h1.6V22H5z"/><path d="M6.6 3.5h12.6l-2.8 4.3 2.8 4.3H6.6z"/>'),
  'flag.checkered': t('<path d="M5 21V3.5"/><path d="M5 4h14v8H5"/><path d="M5 4h3.5v4H5zM12 4h3.5v4H12zM8.5 8H12v4H8.5zM15.5 8H19v4h-3.5z" fill="currentColor" stroke="none"/>', 1.6),
  'trophy.fill': p('<path d="M6.5 2.5h11v6.5a5.5 5.5 0 0 1-4.5 5.4V17h3v2H8v-2h3v-2.6A5.5 5.5 0 0 1 6.5 9zM4.5 4h1.5v4.8C3.9 8.4 3 7 3 5.5V4zm15 0H21v1.5c0 1.5-.9 2.9-3 3.3V4zM6 20.5h12V22H6z"/>'),
  target: t('<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>', 1.6),
  scope: t('<circle cx="12" cy="12" r="7.5"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>', 1.7),
  'rectangle.fill': p('<rect x="6" y="3" width="12" height="18" rx="2"/>'),
  'rectangle.portrait': t('<rect x="6" y="3" width="12" height="18" rx="2"/>', 1.8),
  'rectangle.portrait.fill': p('<rect x="6" y="3" width="12" height="18" rx="2"/>'),
  'rectangle.portrait.tophalf.inset.filled': t('<rect x="6" y="3" width="12" height="18" rx="2"/><rect x="8" y="5" width="8" height="6.5" rx=".8" fill="currentColor" stroke="none"/>', 1.8),
  'rectangle.on.rectangle.slash': t('<rect x="3" y="7" width="13" height="13" rx="2"/><path d="M8 4h11a2 2 0 0 1 2 2v11M3 3l18 18"/>', 1.7),
  'rectangle.stack.fill': p('<path d="M5 3h14v1.6H5zM3.5 6h17v1.6h-17z"/><rect x="2" y="9" width="20" height="12" rx="2"/>'),
  'rectangle.3.group': t('<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="18" height="8" rx="1.5"/>', 1.7),
  'square.grid.2x2.fill': p('<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>'),
  'square.grid.3x3': t('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>', 1.5),
  grid: t('<path d="M3 8h18M3 16h18M8 3v18M16 3v18"/>', 1.5),
  'square.dashed': t('<rect x="3.5" y="3.5" width="17" height="17" rx="2.5" stroke-dasharray="3 2.6"/>', 1.8),
  'circle.dashed': t('<circle cx="12" cy="12" r="9" stroke-dasharray="3 2.6"/>', 1.8),
  circle: t('<circle cx="12" cy="12" r="9"/>', 1.8),
  'circle.circle': t('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/>', 1.8),
  'circle.hexagongrid': t('<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="1.3"/><circle cx="8" cy="9.6" r="1.3"/><circle cx="16" cy="9.6" r="1.3"/><circle cx="8" cy="14.4" r="1.3"/><circle cx="16" cy="14.4" r="1.3"/>', 1.5),
  'circle.hexagongrid.fill': rondPlein('M12 10.6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zm-4-2.4a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zm8 0a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zm-8 4.8a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zm8 0a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8z'),
  'bolt.circle.fill': rondPlein('M13.2 5.5 7.5 13h4l-.9 5.5 5.9-7.6h-4.1z'),
  'flame.fill': p('<path d="M12 2c.5 3-1.8 4.6-3.6 6.6C6.6 10.6 5.5 12.6 5.5 15a6.5 6.5 0 0 0 13 0c0-3-1.6-4.9-2.8-6.2-.3 1.6-1 2.6-2.1 3.2.5-3.6-.3-7.3-1.6-10z"/>'),
  'shield.fill': p('<path d="M12 2 4 5v6c0 5 3.4 9.2 8 11 4.6-1.8 8-6 8-11V5z"/>'),
  'shield.lefthalf.filled': t('<path d="M12 2.5 4.5 5.3v5.8c0 4.7 3.1 8.6 7.5 10.4 4.4-1.8 7.5-5.7 7.5-10.4V5.3z"/><path d="M12 2.5 4.5 5.3v5.8c0 4.7 3.1 8.6 7.5 10.4z" fill="currentColor"/>', 1.7),
  'hand.raised.fill': p('<path d="M8.5 4a1.3 1.3 0 0 1 2.6 0v7h.8V2.8a1.3 1.3 0 0 1 2.6 0V11h.8V4.4a1.3 1.3 0 0 1 2.6 0v9.8c0 4.3-2.8 7.8-6.8 7.8-2.6 0-4.4-1.3-5.8-3.6L3.6 14a1.3 1.3 0 0 1 2.2-1.4l1.9 2.6H8.5z"/>'),
  'hand.point.up.fill': p('<path d="M9.5 3.3a1.5 1.5 0 0 1 3 0V11l.8-.1V9.8a1.4 1.4 0 0 1 2.8 0v1.4l.7-.1a1.4 1.4 0 0 1 2.7.5V16c0 3.5-2.6 6-6.2 6H12c-2.2 0-3.7-1-4.8-2.9l-2.4-4.3a1.4 1.4 0 0 1 2.3-1.6L9.5 15z"/>'),
  'hand.point.up.left.fill': p('<path d="M4.6 5.6a1.5 1.5 0 0 1 2.1-.3l6.1 4.7.5-.6-.9-.7a1.4 1.4 0 0 1 1.7-2.2l1.1.9.4-.5a1.4 1.4 0 0 1 2.2 1.7l-.4.5.5.4a1.4 1.4 0 0 1 .2 2l-2.9 3.6c-2.2 2.8-5.8 3.3-8.6 1.1l-.4-.3c-1.7-1.4-2.3-3.1-2-5.2l.7-4.9a1.4 1.4 0 0 1 2.8.4l-.3 2.9z"/>'),
  'hand.draw': t('<path d="M3 17c2-2 3.5-5 6-5s1 4 3.5 4 3-3 5-3 2.5 2 3.5 2"/>', 1.9),
  'cross.case.fill': p('<path fill-rule="evenodd" d="M9 3h6a1.5 1.5 0 0 1 1.5 1.5V6H20a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5V4.5A1.5 1.5 0 0 1 9 3zm.5 1.8V6h5V4.8zm1.3 4.7v2.8H8v2.4h2.8v2.8h2.4v-2.8H16v-2.4h-2.8V9.5z"/>'),
  'tv.fill': p('<path d="M3.5 4h17A1.5 1.5 0 0 1 22 5.5v11a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 16.5v-11A1.5 1.5 0 0 1 3.5 4zM7 19.5h10V21H7z"/>'),
  timer: t(CHRONO, 1.8),
  'clock.fill': rondPlein('M11 6h2v5.4l3.8 2.3-1 1.7L11 12.6z'),
  'clock.arrow.circlepath': t('<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 3.5v4.5h4.5M12 7.5V12l3 2"/>', 1.8),
  'clock.badge.checkmark.fill': p('<path fill-rule="evenodd" d="M11 2a9 9 0 0 1 8.9 7.6A6 6 0 0 0 11.3 20H11A9 9 0 0 1 11 2zm-1 4v6l4.4 2.6 1-1.7-3.4-2V6z"/><path fill-rule="evenodd" d="M17.5 11.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm-.9 7 3.2-3.2-1-1-2.2 2.2-1-1-1 1z"/>'),
  calendar: t(CALENDRIER, 1.8),
  'calendar.circle.fill': rondPlein('M7 7.5h10A1 1 0 0 1 18 8.5v8a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zm.5 3v5.5h9v-5.5zM8.5 5.5h1.2v2.5H8.5zm5.8 0h1.2v2.5h-1.2z'),
  'calendar.badge.plus': t(`${CALENDRIER}<path d="M12 12v6M9 15h6"/>`, 1.8),
  'stop.fill': p('<rect x="5" y="5" width="14" height="14" rx="2.5"/>'),
  'play.fill': p('<path d="M7 4.2v15.6a1 1 0 0 0 1.5.9l12.3-7.8a1 1 0 0 0 0-1.8L8.5 3.3A1 1 0 0 0 7 4.2z"/>'),
  'pause.fill': p('<rect x="6" y="4" width="4" height="16" rx="1.2"/><rect x="14" y="4" width="4" height="16" rx="1.2"/>'),
  'play.circle': rondTrait('<path d="M10 8.2v7.6l6-3.8z" fill="currentColor"/>', 1.7),
  'play.circle.fill': rondPlein('M10 7.6v8.8l6.9-4.4z'),
  'pause.circle.fill': rondPlein('M9 7.5h2v9H9zm4 0h2v9h-2z'),
  'backward.end.fill': p('<rect x="4" y="5" width="2.5" height="14" rx="1"/><path d="M19.5 5.6v12.8a.9.9 0 0 1-1.4.7L8.7 12.8a1 1 0 0 1 0-1.6l9.4-6.3a.9.9 0 0 1 1.4.7z"/>'),
  'forward.end.fill': p('<rect x="17.5" y="5" width="2.5" height="14" rx="1"/><path d="M4.5 5.6v12.8a.9.9 0 0 0 1.4.7l9.4-6.3a1 1 0 0 0 0-1.6L5.9 4.9a.9.9 0 0 0-1.4.7z"/>'),
  'film.stack': t('<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M6 3h12M3 10h3M18 10h3M3 16h3M18 16h3M6 6v14M18 6v14"/>', 1.6),
  'camera.viewfinder': t('<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/><rect x="6.5" y="8.5" width="11" height="8" rx="1.5"/><circle cx="12" cy="12.5" r="2"/>', 1.6),
  viewfinder: t('<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/>', 1.8),
  'cube.transparent': t(`${CUBE}<path d="M3.5 17 12 12.5 20.5 17M12 2.5v10" stroke-dasharray="2 2"/>`, 1.5),
  'cube.transparent.fill': p('<path d="M12 2 21 6.8v10.4L12 22l-9-4.8V6.8z" opacity=".35"/><path d="M12 2 21 6.8 12 11.6 3 6.8z"/>'),
  'square.stack.3d.up': t('<path d="M12 3 21 7.5 12 12 3 7.5z"/><path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5"/>', 1.6),
  'timeline.selection': t('<path d="M5 3v18M19 3v18M5 12h14"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>', 1.6),
  photo: t('<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m2.5 17 5-5 4 4 3-3 7 6"/>', 1.6),
  'eraser.fill': p('<path d="M14.3 3.6a2 2 0 0 1 2.8 0l3.3 3.3a2 2 0 0 1 0 2.8L11 19h9v2H8.2l-4.6-4.6a2 2 0 0 1 0-2.8z"/>'),

  // Documents, données
  'doc.text': t(`${DOC}<path d="M8 12h8M8 15.5h8M8 8.5h3"/>`, 1.6),
  'doc.fill': p('<path d="M6 2h8l5.5 5.5v13A1.5 1.5 0 0 1 18 22H6a1.5 1.5 0 0 1-1.5-1.5v-17A1.5 1.5 0 0 1 6 2zm7.5.8v5.2h5.2z"/>'),
  'doc.richtext': t(`${DOC}<path d="M8 17l2.5-3 2 2 3-4"/><circle cx="9.5" cy="9.5" r="1.2"/>`, 1.6),
  'chart.bar.fill': p('<rect x="3" y="12" width="4.5" height="9" rx="1.2"/><rect x="9.75" y="7" width="4.5" height="14" rx="1.2"/><rect x="16.5" y="3" width="4.5" height="18" rx="1.2"/>'),
  'chart.pie.fill': p('<path d="M11 3a9 9 0 1 0 9.9 10H11z"/><path d="M13 1.2V11h9.8A10 10 0 0 0 13 1.2z"/>'),
  'chart.bar.doc.horizontal': t(`${DOC}<path d="M8 10h5M8 13.5h8M8 17h3.5"/>`, 1.8),
  'list.bullet': t('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>', 1.9),
  'list.bullet.rectangle': t('<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M9.5 9h8M9.5 12h8M9.5 15h8"/><circle cx="6.5" cy="9" r=".7" fill="currentColor"/><circle cx="6.5" cy="12" r=".7" fill="currentColor"/><circle cx="6.5" cy="15" r=".7" fill="currentColor"/>', 1.6),
  'list.bullet.rectangle.fill': p('<path fill-rule="evenodd" d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm2.5 4.2a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8zM9.5 8.4v1.4h8V8.4zm-3 2.7a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8zm3 .2v1.4h8v-1.4zm-3 2.7a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8zm3 .2v1.4h8v-1.4z"/>'),
  printer: t('<path d="M6.5 8V3h11v5M6.5 17H4a1.5 1.5 0 0 1-1.5-1.5v-6A1.5 1.5 0 0 1 4 8h16a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 20 17h-2.5"/><rect x="6.5" y="13" width="11" height="8" rx="1"/>', 1.6),
  'archivebox': t('<rect x="2.5" y="3.5" width="19" height="5" rx="1"/><path d="M4 8.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19V8.5M10 12h4"/>', 1.7),
  'archivebox.fill': p('<rect x="2" y="3" width="20" height="5.5" rx="1.2"/><path fill-rule="evenodd" d="M3.5 10h17v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2zM9.5 12v1.8h5V12z"/>'),
  'shippingbox.fill': p('<path d="M12 1.8 3 6.3l9 4.5 9-4.5zM2.3 7.6v9.8l8.9 4.6v-9.9zM12.8 12.1V22l8.9-4.6V7.6z"/>'),
  'books.vertical': t(LIVRES, 1.6),
  'books.vertical.fill': p('<rect x="2.5" y="3.5" width="5" height="17.5" rx="1"/><rect x="8.5" y="3.5" width="5" height="17.5" rx="1"/><path d="m14.4 4.9 4.6-1.4 3.6 16.6-4.6 1.3z"/>'),
  'book.fill': p('<path d="M5.5 2.5H19v16H6.3a1.3 1.3 0 0 0 0 2.6H19v1.4H6.3A2.8 2.8 0 0 1 3.5 19.7V4.5a2 2 0 0 1 2-2z"/>'),
  'tag': t('<path d="M11.5 3H4.5A1.5 1.5 0 0 0 3 4.5v7c0 .4.2.8.4 1.1l8.8 8.8a1.5 1.5 0 0 0 2.1 0l7.1-7.1a1.5 1.5 0 0 0 0-2.1L12.6 3.4c-.3-.3-.7-.4-1.1-.4z"/><circle cx="7.6" cy="7.6" r="1.4"/>', 1.7),
  'tag.fill': p('<path fill-rule="evenodd" d="M11.5 2.5H4.5a2 2 0 0 0-2 2v7c0 .5.2 1 .6 1.4l8.8 8.8a2 2 0 0 0 2.8 0l7.1-7.1a2 2 0 0 0 0-2.8L13 3.1c-.4-.4-.9-.6-1.5-.6zM7.6 5.8a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z"/>'),
  'gift.fill': p('<path d="M3 8h18v4H3zM4.5 13.5h6.7V22H6a1.5 1.5 0 0 1-1.5-1.5zM12.8 13.5h6.7v7A1.5 1.5 0 0 1 18 22h-5.2zM11.2 8V6.5c-.6-2-2-3.5-3.6-3.5a2.3 2.3 0 0 0 0 4.6V8zm1.6 0h3.6a2.3 2.3 0 1 0 0-4.6c-1.6 0-3 1.5-3.6 3.5z"/>'),
  'crown.fill': p('<path d="M3 7.5 7.5 11 12 4l4.5 7L21 7.5 19.3 18H4.7zM5 19.5h14V21H5z"/>'),
  crown: t('<path d="M3 7.5 7.5 11 12 4l4.5 7L21 7.5 19.3 18H4.7zM5 20.5h14"/>', 1.7),
  'star.fill': p('<path d="m12 2.5 2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.2l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/>'),
  'gearshape.fill': p('<path fill-rule="evenodd" d="m10.3 2 3.4 0 .5 2.6 1.6.7 2.2-1.5 2.4 2.4-1.5 2.2.7 1.6 2.6.5v3.4l-2.6.5-.7 1.6 1.5 2.2-2.4 2.4-2.2-1.5-1.6.7-.5 2.6h-3.4l-.5-2.6-1.6-.7-2.2 1.5-2.4-2.4 1.5-2.2-.7-1.6L2 13.7v-3.4l2.6-.5.7-1.6-1.5-2.2 2.4-2.4 2.2 1.5 1.6-.7zM12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z"/>'),
  'house.fill': p('<path d="M12 2.5 1.8 11.4l1.3 1.5 1.4-1.2V21h5.8v-6h3.4v6h5.8v-9.3l1.4 1.2 1.3-1.5z"/>'),
  'icloud.fill': p('<path d="M18.5 19.5H7a5 5 0 0 1-.6-10A6.5 6.5 0 0 1 18.8 9a5.3 5.3 0 0 1-.3 10.5z"/>'),
  safari: rondTrait('<path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z" fill="currentColor"/>', 1.6),
  qrcode: t('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM17 17h4v4M14 20h1"/>', 1.6),

  // Communication
  'message.fill': p(MESSAGE),
  'message.badge.filled.fill': p(`${MESSAGE}<circle cx="19.5" cy="4.5" r="3.5" fill="var(--rouge)"/>`),
  'text.bubble': t(`${MESSAGE}<path d="M8 9h8M8 12.5h5"/>`, 1.6),
  'phone.fill': p('<path d="M6.2 2.6 8.8 2.2l1.6 4.8-2 1.6a12.3 12.3 0 0 0 7 7l1.6-2 4.8 1.6-.4 2.6a2.3 2.3 0 0 1-2.3 1.9C10.3 19.7 4.3 13.7 4.3 4.9a2.3 2.3 0 0 1 1.9-2.3z"/>'),
  'phone.circle.fill': rondPlein('M8.6 6.6l1.5-.2.9 2.7-1.1.9a7 7 0 0 0 4 4l.9-1.1 2.7.9-.2 1.5a1.3 1.3 0 0 1-1.3 1.1c-4.9 0-8.6-3.7-8.6-8.6a1.3 1.3 0 0 1 1.2-1.2z'),
  'envelope.fill': p('<path d="M3.5 5h17a1.5 1.5 0 0 1 1.4 1L12 12.6 2.1 6a1.5 1.5 0 0 1 1.4-1z"/><path d="M2 8.1V17.5A1.5 1.5 0 0 0 3.5 19h17a1.5 1.5 0 0 0 1.5-1.5V8.1l-10 6.7z"/>'),
  'paperplane.fill': p('<path d="M22 2 2.5 9.8l7 3.2L17 6.5 10.6 14l3.2 7z"/>'),
  airplane: p('<path d="M10.2 2.8a1.8 1.8 0 0 1 3.6 0v6.1l8.2 4.8v2.1l-8.2-2.4v4.9l2.4 1.7V22L12 21l-4.2 1v-1.9l2.4-1.7v-4.9L2 15.8v-2.1l8.2-4.8z"/>'),
  'bell.badge.fill': p('<path d="M12 2.5a6 6 0 0 1 6 6v4.5l2 3v1.5H4V16l2-3V8.5a6 6 0 0 1 6-6zM9.5 19h5a2.5 2.5 0 0 1-5 0z"/><circle cx="19" cy="5" r="3.2" fill="var(--rouge)"/>'),
  'mappin.circle.fill': rondPlein('M12 5.5a4 4 0 0 1 4 4c0 3-4 8-4 8s-4-5-4-8a4 4 0 0 1 4-4zm0 2.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z'),
}

// Synonymes (même dessin)
Object.assign(ICONES, {
  'square.and.arrow.down.fill': ICONES['square.and.arrow.down'],
  'checkmark.square.fill': ICONES['checkmark.circle.fill'],
  'person': t(PERSONNE_T, 1.8),
  'person.2.fill': p(PERSONNES2),
  'arrow.counterclockwise': ICONES['arrow.clockwise'].replace('<svg', '<svg style="transform:scaleX(-1)"'),
  'gearshape': ICONES['gearshape.fill'],
  'magnifyingglass': t('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/>', 2.2),
  'chevron.left.forwardslash.chevron.right': t('<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>', 1.8),
  'ellipsis': t('<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>', 1),
  'xmark.circle': rondTrait(`<path d="${croix}"/>`, 1.8),
  'square.and.arrow.down.on.square': ICONES['square.and.arrow.down'],
  'speaker.wave.2.fill': p('<path d="M3 9h4l5-4.5v15L7 15H3z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
});

const INCONNU = p('<circle cx="12" cy="12" r="4"/>');

/** Pictogramme SVG d'après le nom SF Symbol */
export function icone(nom) {
  return ICONES[nom] ?? INCONNU;
}

export const iconeExiste = (nom) => Boolean(ICONES[nom]);
