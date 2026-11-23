// Atelier — éditeur d'exercice en plein écran (port d'AtelierEditorView.swift et AtelierPages.swift).
// Le terrain occupe toute la place (il pivote à l'horizontale si c'est plus grand). En bas (ou sur
// le côté en paysage) : le réglage de l'objet choisi, les vignettes de l'animation et le tiroir de matériel.
//
// Gestes : toucher un outil puis toucher le terrain pour poser (l'outil reste actif) ; glisser un
// objet pour le déplacer ; glisser le ballon sur un joueur pour une passe. Tout le reste est un bouton.
//
// Page : ouvrirFeuille('editeur.atelier', { tactique, vignetteDepart, surEnregistrer }, { plein: true })
// (tactique absente : nouvel exercice). Enregistrement automatique (store.enregistrerTactique).
import { store } from '../../store.js';
import * as M from '../../model.js';
import {
  definirPage, definirMontage, action, pousser, retour, fermerFeuille, ouvrirFeuille, pageExiste, pageCourante,
  rafraichir, surChaqueRendu, etat as etatUI, h, icone, section, ligne, champ, selecteur, stepper, bouton,
  alerte, choix, saisie, partager, apercuPDF,
} from '../../ui.js';
import {
  ModeleEditeur, Vue, OUTILS, SORTES_BALLON, RACCOURCIS, tousLesRaccourcis, typeOutil, memeSelection, effectif,
  nouvelExercice, metresZone, poigneeZone, tailleMateriel, TAILLE_ZONE_DEFAUT, ballonDe, memeCadrage,
  positionLecture, adoucir, LARGEUR_TERRAIN as W, LONGUEUR_TERRAIN as L,
} from './editeur-modele.js';
import {
  dessinerTerrain, dessinerMateriel, dessinerJoueur, dessinerBallon, dessinerGlypheBallon, dessinerFleche,
  pointEcranBallon, glypheOutilHTML, majAccent, HERBE_FONCEE,
} from './diagramme.js';
import { ficheExercicePDF, nomFichierFiche } from '../../rapports/atelier.js';
import './seance.js';

export { nouvelExercice };

// Pictogrammes absents du socle (dessinés ici)
const svg = (corps, ep = 2) => `<svg viewBox="0 0 24 24" class="ic" fill="none" stroke="currentColor" stroke-width="${ep}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corps}</svg>`;
const ICONES_LOCALES = {
  'arrow.uturn.backward': svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>', 2.2),
  'arrow.uturn.forward': svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>', 2.2),
  film: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4"/>', 1.6),
  number: svg('<path d="M9.5 4 8 20M16 4l-1.5 16M4.5 9h15.5M4 15h15.5"/>', 2),
  'hand.raised.slash': svg('<path d="M8.5 11V5a1.3 1.3 0 0 1 2.6 0v6M11.1 10V3.8a1.3 1.3 0 0 1 2.6 0V10M13.7 10V5.2a1.3 1.3 0 0 1 2.6 0v8.5c0 3.6-2.3 6.8-6 6.8-2.3 0-3.8-1.1-5-3.1L3.8 14a1.2 1.2 0 0 1 2-1.3l1.8 2.4H8.5V11M3 3l18 18"/>', 1.6),
  'rotate.right': svg('<path d="M15.5 4.5A8 8 0 1 0 20 12"/><path d="M20 4v5h-5"/><rect x="9" y="9" width="6" height="6" rx="1"/>', 1.8),
  'rectangle.tophalf.filled': svg('<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M6 12h12V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2z" fill="currentColor"/>', 1.8),
  'rectangle.bottomhalf.filled': svg('<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M6 12h12v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill="currentColor"/>', 1.8),
  square: svg('<rect x="4" y="4" width="16" height="16" rx="2"/>', 1.8),
};
const ic = (nom) => ICONES_LOCALES[nom] ?? icone(nom);

const POLICE = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/** L'éditeur ouvert (un seul à la fois) */
let courant = null;

function nouvelEtat(p) {
  const tactique = p.tactique ? M.lireTactique(M.ecrireTactique(p.tactique)) : nouvelExercice();
  return {
    params: p,
    modele: new ModeleEditeur(tactique, p.vignetteDepart ?? 0),
    apercu: null,           // début de l'aperçu animé (performance.now), ou null
    glisse: null,           // { depart, actuel, cible, prise, bouge }
    dernier: null,          // empreinte du dernier enregistrement
    minuterie: null,
    menu: null,             // 'cadrage' | 'raccourcis'
    vue: null,
  };
}

// MARK: - Enregistrement automatique

function etatEnregistrement(e) {
  const m = e.modele;
  if (m.estVide) return 'auto';
  if (!m.modifie || m.empreinte() === e.dernier) return 'enregistre';
  return 'enCours';
}

/** Enregistre peu après la dernière modification : rien n'est perdu si la page est fermée */
function planifier(e) {
  clearTimeout(e.minuterie);
  e.minuterie = setTimeout(() => enregistrerMaintenant(e), 700);
}

function enregistrerMaintenant(e) {
  clearTimeout(e.minuterie);
  e.minuterie = null;
  const m = e.modele;
  if (!m.modifie || m.estVide) return;
  const marque = m.empreinte();
  if (marque === e.dernier) return;
  e.dernier = marque;
  const fin = m.finalise();
  store.enregistrerTactique(fin);
  try { e.params.surEnregistrer?.(fin); } catch (err) { console.error(err); }
  rafraichir();
}

/** Après une modification : enregistrement différé, nouveau dessin, nouveau rendu */
function apresModif(e) {
  planifier(e);
  demanderDessin();
  rafraichir();
}

// MARK: - Page principale

definirPage('editeur.atelier', (p) => {
  const e = (p.etat ??= nouvelEtat(p));
  courant = e;
  validerBrouillons(e);
  return { titre: e.modele.play.titre, barre: false, classe: 'ed-defile', contenu: rendreEditeur(e) };
});

function rendreEditeur(e) {
  const m = e.modele;
  return `<div class="editeur${e.apercu != null ? ' en-apercu' : ''}" data-key="editeur">
    ${rendreEntete(e)}
    <div class="ed-evolutions" role="tablist" aria-label="Évolutions">${rendreEvolutions(e)}</div>
    <div class="ed-terrain" style="background:${HERBE_FONCEE}">
      <canvas class="ed-canvas" data-monter="editeur.terrain" data-key="ed-canvas"${e.pixels ? ` width="${e.pixels[0]}" height="${e.pixels[1]}"` : ''} role="application" aria-label="Terrain de l'exercice"></canvas>
      <div class="ed-surcouche">
        <div class="ed-capsule">
          <button type="button" class="ed-bouton-rond" data-action="editeur.annuler" ${m.peutAnnuler ? '' : 'disabled'} aria-label="Annuler" title="Annuler (⌘Z)">${ic('arrow.uturn.backward')}</button>
          <button type="button" class="ed-bouton-rond" data-action="editeur.retablir" ${m.peutRetablir ? '' : 'disabled'} aria-label="Rétablir" title="Rétablir (⇧⌘Z)">${ic('arrow.uturn.forward')}</button>
        </div>
        <span class="ed-espace"></span>
        ${e.apercu != null ? `<button type="button" class="ed-capsule ed-arret" data-action="editeur.apercu">${icone('stop.fill')}<span>Arrêter l'aperçu</span></button>` : ''}
        <span class="ed-espace"></span>
        <button type="button" class="ed-capsule ed-bouton-cadrage" data-action="editeur.menu" data-menu="cadrage" aria-label="Cadrage du terrain" title="Cadrage du terrain">${icone('viewfinder')}</button>
      </div>
    </div>
    <div class="ed-contexte">${rendreContexte(e)}</div>
    <div class="ed-vignettes">${rendreVignettes(e)}</div>
    <div class="ed-outils">${rendreOutils(e)}</div>
    ${rendreMenu(e)}
  </div>`;
}

function rendreEntete(e) {
  const m = e.modele;
  const etat = etatEnregistrement(e);
  const statut = etat === 'auto'
    ? `${icone('arrow.triangle.2.circlepath')}Enregistrement automatique`
    : etat === 'enCours' ? `${icone('arrow.triangle.2.circlepath')}Enregistrement…` : `${icone('checkmark.circle')}Enregistré`;
  return `<div class="ed-entete">
    ${bouton({ libelle: 'Enregistrer', icone: 'checkmark.circle.fill', action: 'editeur.fermer', petit: true, classe: 'ed-enregistrer' })}
    <button type="button" class="ed-titre" data-action="editeur.renommer" aria-label="Renommer l'exercice">
      <span class="ed-nom"><span>${h(m.play.titre)}</span>${icone('pencil')}</span>
      <span class="ed-statut${etat === 'enregistre' ? ' ok' : ''}">${statut}</span>
    </button>
    ${bouton({ libelle: 'Fiche', icone: 'doc.text', style: 'teinte', action: 'editeur.fiche', petit: true, classe: 'ed-bouton-fiche' })}
  </div>`;
}

function rendreEvolutions(e) {
  const m = e.modele;
  const puce = (titre, index) => {
    const choisie = m.evolution === index;
    return `<button type="button" class="ed-puce${choisie ? ' choisie' : ''}" data-action="editeur.evolution" data-index="${index ?? ''}" role="tab" aria-selected="${choisie}">
      <span>${h(titre)}</span>${choisie && index != null ? icone('pencil') : ''}</button>`;
  };
  return `${puce('Exercice de base', null)}
    ${(m.play.evolutions ?? []).map((ev, i) => puce(ev.titre, i)).join('')}
    <button type="button" class="ed-puce ed-pointilles" data-action="editeur.ajouterEvolution">${icone('plus')}<span>Évolution</span></button>`;
}

// MARK: Réglages de l'objet choisi

function rendreContexte(e) {
  const m = e.modele;
  const s = m.selection;
  if (s?.type === 'actor') {
    const a = m.contenu.acteurs.find((x) => x.id === s.id);
    if (a) return contexteJoueur(m, a);
  } else if (s?.type === 'prop') {
    const prop = m.contenu.materiel[s.index];
    if (prop) return contexteMateriel(m, prop);
  } else if (s?.type === 'ball') {
    return contexteBallon(m, s.id);
  } else if (m.outil) {
    return contexteOutil(m);
  }
  return barreConseil(m);
}

function texteConseil(m) {
  if (m.vignette === 0) {
    return !m.contenu.acteurs.length && !m.contenu.materiel.length
      ? 'Choisissez un élément en bas (ou un raccourci ✨), puis touchez le terrain pour le poser.'
      : 'Mise en place : touchez un objet pour le régler, glissez-le pour le déplacer. « + » ajoute une étape.';
  }
  return `Étape ${m.vignette} : déplacez joueurs et ballons. Glissez un ballon sur un joueur pour une passe. Les flèches se tracent seules.`;
}

function barreConseil(m) {
  return `<div class="ed-conseil"><span class="ed-conseil-icone">${ic(m.vignette === 0 ? 'hand.point.up.left.fill' : 'film')}</span>
    <p>${h(texteConseil(m))}</p></div>`;
}

function texteOutil(outil) {
  switch (outil) {
    case 'joueur': return 'Touchez le terrain pour poser des joueurs';
    case 'gardien': return 'Touchez le terrain pour poser un gardien';
    case 'ballon': return 'Touchez un joueur (ou le terrain) pour poser un ballon ; touchez encore pour en ajouter';
    case 'ligne': return 'Glissez sur le terrain : un plot tous les 3 m';
    case 'prop:zone': return 'Glissez pour tracer une zone, ou touchez pour 20 × 15 m';
    case 'prop:ballon': return 'Ballons posés au sol, immobiles. Pour des passes : outil « Ballon »';
    default: return `Touchez le terrain pour poser : ${M.MATERIEL[typeOutil(outil)]?.nom.toLowerCase() ?? ''}`;
  }
}

const outilAvecCouleur = (outil) => outil === 'joueur' || outil === 'ligne'
  || (typeOutil(outil) && M.materielAvecCouleur(typeOutil(outil)) && typeOutil(outil) !== 'zone');

function rangeeCouleurs(choisie) {
  return `<div class="ed-couleurs" role="radiogroup" aria-label="Couleur">${M.COULEURS_ATELIER.map((c) => `
    <button type="button" class="ed-pastille-couleur${c.id === choisie ? ' choisie' : ''}" style="--c:${c.css}" data-action="editeur.couleur" data-couleur="${c.id}"
      role="radio" aria-checked="${c.id === choisie}" aria-label="${h(M.nomCouleurAtelier(c.id))}" title="${h(M.nomCouleurAtelier(c.id))}"></button>`).join('')}</div>`;
}

const boutonContexte = (icon, titre, actionNom, { detruire = false, data = {} } = {}) => `<button type="button" class="ed-bouton-contexte${detruire ? ' detruire' : ''}"
  data-action="${actionNom}"${Object.entries(data).map(([k, v]) => ` data-${k}="${h(v)}"`).join('')}>${ic(icon)}<span>${h(titre)}</span></button>`;

const separateur = '<span class="ed-separateur"></span>';

function contexteOutil(m) {
  const outil = m.outil;
  return `<div class="ed-rangee">
    <p class="ed-texte-outil">${h(texteOutil(outil))}</p>
    ${outilAvecCouleur(outil) ? rangeeCouleurs(outil === 'joueur' ? m.bibColor : m.propColor) : ''}
    <button type="button" class="ed-fermer-outil" data-action="editeur.rangerOutil" aria-label="Ranger l'outil">${icone('xmark.circle.fill')}</button>
  </div>`;
}

function contexteJoueur(m, a) {
  const gardien = M.estGardien(a);
  return `<div class="ed-rangee ed-defilant">
    ${rangeeCouleurs(M.chasubleDe(a))}
    ${separateur}
    ${boutonContexte('soccerball', 'Ballon', 'editeur.donnerBallon')}
    ${boutonContexte('number', `N° ${a.numero}`, 'editeur.numero')}
    ${boutonContexte(gardien ? 'hand.raised.slash' : 'hand.raised.fill', gardien ? 'Joueur' : 'Gardien', 'editeur.gardien')}
    ${m.joueurDeplace(a.id) ? boutonContexte('arrow.uturn.backward.circle', 'Ne bouge pas', 'editeur.neBougePas') : ''}
    ${boutonContexte('plus.square.on.square', 'Copier', 'editeur.copier')}
    ${boutonContexte('trash', 'Enlever', 'editeur.enlever', { detruire: true })}
  </div>`;
}

function contexteMateriel(m, prop) {
  const titre = prop.type === 'zone' ? `Zone ${metresZone(prop.taille ?? TAILLE_ZONE_DEFAUT)}` : M.MATERIEL[prop.type].nom;
  return `<div class="ed-rangee ed-defilant">
    <span class="ed-nom-objet">${h(titre)}</span>
    ${M.materielAvecCouleur(prop.type) ? rangeeCouleurs(M.couleurMateriel(prop)) : ''}
    ${separateur}
    ${M.materielOrientable(prop.type) ? boutonContexte('rotate.right', 'Tourner', 'editeur.tourner') : ''}
    ${boutonContexte('plus.square.on.square', 'Copier', 'editeur.copier')}
    ${boutonContexte('trash', 'Enlever', 'editeur.enlever', { detruire: true })}
  </div>`;
}

function contexteBallon(m, id) {
  const nom = m.idsBallons.length > 1 ? `Ballon ${M.numeroBallon(id)}` : 'Le ballon';
  let corps;
  if (m.ballonBougeDansVignette(id)) {
    const sorte = m.sorteBallon(id);
    corps = `<span class="ed-nom-objet">${h(nom)} :</span>${SORTES_BALLON.map((s) => `
      <button type="button" class="ed-puce${sorte === s.id ? ' choisie' : ''}" data-action="editeur.sorteBallon" data-sorte="${s.id}">${icone(s.icone)}<span>${h(s.titre)}</span></button>`).join('')}`;
  } else {
    corps = `<p class="ed-texte-outil secondaire">${m.vignette === 0 ? 'Glissez le ballon sur un joueur pour le lui donner.'
      : 'Glissez le ballon sur un partenaire (passe) ou vers le but (tir).'}</p>`;
  }
  return `<div class="ed-rangee ed-defilant">${corps}${separateur}${boutonContexte('trash', 'Enlever', 'editeur.enlever', { detruire: true })}</div>`;
}

// MARK: Vignettes

function rendreVignettes(e) {
  const m = e.modele;
  const n = m.nombreEtapes;
  const puces = Array.from({ length: n }, (_, i) => {
    const choisie = m.vignette === i && e.apercu == null;
    return `<button type="button" class="ed-vignette${choisie ? ' choisie' : ''}" data-action="editeur.vignette" data-index="${i}"
      aria-label="${i === 0 ? 'Mise en place' : `Étape ${i}`}">${i === 0 ? 'Départ' : i}${choisie ? icone('pencil') : ''}</button>`;
  }).join('');
  return `<button type="button" class="ed-lecture" data-action="editeur.apercu" ${n < 2 ? 'disabled' : ''} aria-label="Aperçu de l'animation" title="Aperçu (espace)">
      ${icone(e.apercu == null ? 'play.fill' : 'stop.fill')}</button>
    <div class="ed-bande">${puces}
      <button type="button" class="ed-vignette ed-pointilles" data-action="editeur.ajouterEtape">${icone('plus')}<span>Étape</span></button>
    </div>
    <button type="button" class="ed-cinema" data-action="editeur.cinema" ${m.contenu.acteurs.length ? '' : 'disabled'}>${icone('film.stack')}<span>Cinéma</span></button>`;
}

// MARK: Tiroir de matériel

function rendreOutils(e) {
  const m = e.modele;
  const tuile = (titre, choisi, glyphe, actionNom, data = '') => `<button type="button" class="ed-tuile${choisi ? ' choisie' : ''}" data-action="${actionNom}"${data}>
    <span class="ed-tuile-fond">${glyphe}</span><span class="ed-tuile-titre">${h(titre)}</span></button>`;
  return `${tuile('Raccourcis', false, `<span class="ed-etincelles">${icone('sparkles')}</span>`, 'editeur.menu', ' data-menu="raccourcis"')}
    ${OUTILS.map((o) => tuile(o.titre, m.outil === o.outil, glypheOutilHTML(o.outil, m.bibColor, m.propColor), 'editeur.outil', ` data-outil="${o.outil}"`)).join('')}`;
}

// MARK: Menus (cadrage, raccourcis)

const CADRAGES_MENU = [
  ['Terrain entier', 'complet', 'rectangle.portrait'],
  ['Demi-terrain (attaque)', 'moitieAttaque', 'rectangle.tophalf.filled'],
  ['Demi-terrain (défense)', 'moitieDefense', 'rectangle.bottomhalf.filled'],
  ['Zone de 40 × 40 m', 'centre', 'square'],
];

function rendreMenu(e) {
  if (!e.menu) return '';
  const m = e.modele;
  const entree = ({ libelle, icon, actionNom, data = {}, detruire = false, coche = false }) => `<button type="button" class="ed-menu-entree${detruire ? ' detruire' : ''}"
    data-action="${actionNom}"${Object.entries(data).map(([k, v]) => ` data-${k}="${h(v)}"`).join('')}>
    <span>${h(libelle)}</span>${ic(coche ? 'checkmark' : icon)}</button>`;
  let sections;
  if (e.menu === 'cadrage') {
    sections = [
      ['Partie du terrain', [
        ...CADRAGES_MENU.map(([libelle, cle, icon]) => entree({ libelle, icon, actionNom: 'editeur.cadrage', data: { cadrage: cle }, coche: memeCadrage(m.cadrage, M.CADRAGES[cle]) })),
        entree({ libelle: "Ajuster à l'exercice", icon: 'arrow.up.left.and.down.right.magnifyingglass', actionNom: 'editeur.ajuster' }),
      ]],
      ['', [
        entree({ libelle: 'Quadrillage tous les 5 m', icon: 'grid', actionNom: 'editeur.grille', coche: m.grille }),
        entree({ libelle: 'Vider le terrain', icon: 'trash', actionNom: 'editeur.vider', detruire: true }),
      ]],
    ];
  } else {
    const r = (x) => entree({ libelle: x.titre, icon: x.icone, actionNom: 'editeur.raccourci', data: { raccourci: x.id } });
    sections = [['Délimiter', RACCOURCIS.carres.map(r)], ['Jeux', RACCOURCIS.jeux.map(r)], ['Parcours', RACCOURCIS.parcours.map(r)]];
  }
  return `<div class="ed-menu-voile" data-action="editeur.fermerMenu" data-key="ed-menu-${e.menu}">
    <div class="ed-menu ed-menu-${e.menu}" role="menu">${sections.map(([titre, entrees]) => `<div class="ed-menu-section">
      ${titre ? `<p class="ed-menu-titre">${h(titre)}</p>` : ''}${entrees.join('')}</div>`).join('')}</div>
  </div>`;
}

// MARK: - Actions

const E = () => courant;
const M_ = () => courant?.modele;

function arreterApercu(e = courant) { if (e) e.apercu = null; }

action('editeur.fermer', () => {
  const e = E();
  if (!e) return;
  arreterApercu(e);
  enregistrerMaintenant(e);
  courant = null;
  fermerFeuille('editeur.atelier');
});
action('editeur.renommer', () => {
  const m = M_();
  saisie({
    titre: "Nom de l'exercice",
    champs: [{ nom: 'nom', valeur: m.play.titre, placeholder: 'Nom' }],
    faire: ({ nom }) => {
      const n = nom.trim();
      if (n !== '') { m.majInfos((p) => { p.titre = n; }); apresModif(E()); }
    },
  });
});
action('editeur.fiche', () => { arreterApercu(); pousser('editeur.fiche', { etat: E() }); });
action('editeur.annuler', () => { M_().annuler(); apresModif(E()); });
action('editeur.retablir', () => { M_().retablir(); apresModif(E()); });
action('editeur.evolution', (el) => {
  const e = E(); const m = e.modele;
  const index = el.dataset.index === '' ? null : Number(el.dataset.index);
  if (m.evolution === index && index != null) { pousser('editeur.evolution', { etat: e, index }); return; }
  arreterApercu(e);
  m.choisirEvolution(index);
  demanderDessin();
});
action('editeur.ajouterEvolution', () => { M_().ajouterEvolution(); apresModif(E()); });
action('editeur.couleur', (el) => { M_().setCouleur(el.dataset.couleur); apresModif(E()); });
action('editeur.donnerBallon', () => { const m = M_(); if (m.selection?.type === 'actor') m.donnerBallon(m.selection.id); apresModif(E()); });
action('editeur.numero', () => {
  const m = M_();
  const s = m.selection;
  if (s?.type !== 'actor') return;
  const a = m.contenu.acteurs.find((x) => x.id === s.id);
  saisie({
    titre: 'Numéro sur la chasuble',
    message: '3 caractères au plus (7, A, G1…)',
    champs: [{ nom: 'numero', valeur: a?.numero ?? '', placeholder: 'Numéro ou lettre' }],
    faire: ({ numero }) => { m.setNumero(s.id, numero); apresModif(E()); },
  });
});
action('editeur.gardien', () => { const m = M_(); if (m.selection?.type === 'actor') m.basculerGardien(m.selection.id); apresModif(E()); });
action('editeur.neBougePas', () => { const m = M_(); if (m.selection?.type === 'actor') m.annulerDeplacement(m.selection.id); apresModif(E()); });
action('editeur.copier', () => { M_().dupliquerSelection(); apresModif(E()); });
action('editeur.enlever', () => { M_().supprimerSelection(); apresModif(E()); });
action('editeur.tourner', () => { M_().tournerSelection(45); apresModif(E()); });
action('editeur.sorteBallon', (el) => { const m = M_(); if (m.selection?.type === 'ball') m.setSorteBallon(m.selection.id, el.dataset.sorte); apresModif(E()); });
action('editeur.rangerOutil', () => { M_().outil = null; });
action('editeur.apercu', () => {
  const e = E();
  if (e.apercu != null) { e.apercu = null; demanderDessin(); return; }
  if (e.modele.nombreEtapes < 2) return;
  e.modele.selection = null;
  e.modele.outil = null;
  e.apercu = performance.now();
  boucleApercu();
});
action('editeur.vignette', (el) => {
  const e = E(); const m = e.modele;
  const i = Number(el.dataset.index);
  const choisie = m.vignette === i && e.apercu == null;
  arreterApercu(e);
  if (choisie) { pousser('editeur.etape', { etat: e, index: i }); return; }
  m.vignette = i;
  m.selection = null;
  demanderDessin();
});
action('editeur.ajouterEtape', () => { arreterApercu(); M_().ajouterVignette(); apresModif(E()); });
action('editeur.cinema', () => {
  const e = E();
  arreterApercu(e);
  if (!pageExiste('lecteur.3d')) { alerte('Mode cinéma', "Le lecteur 3D n'est pas disponible."); return; }
  ouvrirFeuille('lecteur.3d', { tactique: e.modele.finalise(), cinema: true, evolutionInitiale: e.modele.evolution }, { plein: true });
});
action('editeur.outil', (el) => {
  const m = M_();
  arreterApercu();
  m.selection = null;
  m.outil = m.outil === el.dataset.outil ? null : el.dataset.outil;
});
action('editeur.menu', (el) => { arreterApercu(); E().menu = el.dataset.menu; });
action('editeur.fermerMenu', (el, ev) => { if (ev.target === el) E().menu = null; else return false; });
action('editeur.cadrage', (el) => {
  const e = E();
  e.menu = null;
  e.modele.setCadrage(M.CADRAGES[el.dataset.cadrage]);
  apresModif(e);
});
action('editeur.ajuster', () => { const e = E(); e.menu = null; e.modele.ajusterCadrage(); apresModif(e); });
action('editeur.grille', () => { const e = E(); e.menu = null; e.modele.grille = !e.modele.grille; demanderDessin(); });
action('editeur.vider', () => {
  const e = E();
  e.menu = null;
  choix({
    titre: 'Vider le terrain ?',
    message: 'Joueurs, matériel et étapes de cette version. Vous pourrez annuler.',
    actions: [{ libelle: 'Tout enlever', role: 'detruire', faire: () => { e.modele.toutEnlever(); apresModif(e); } }],
  });
});
action('editeur.raccourci', (el) => {
  const e = E();
  e.menu = null;
  arreterApercu(e);
  const r = tousLesRaccourcis().find((x) => x.id === el.dataset.raccourci);
  if (!r) return;
  e.modele.vignette = 0;
  e.modele.appliquer(r);
  apresModif(e);
});

// MARK: - Terrain : dessin et gestes

let demandeDessin = null;
let canvasTerrain = null;

function demanderDessin() {
  if (demandeDessin || !canvasTerrain) return;
  demandeDessin = requestAnimationFrame(() => { demandeDessin = null; dessinerTerrainEditeur(); });
}

function boucleApercu() {
  const e = courant;
  if (!e || e.apercu == null) return;
  dessinerTerrainEditeur();
  if (e.apercu != null) requestAnimationFrame(boucleApercu);
}

function finirApercu(e) {
  if (e.apercu == null) return;
  e.apercu = null;
  e.modele.vignette = Math.max(0, e.modele.nombreEtapes - 1);
  rafraichir();
  demanderDessin();
}

function dessinerTerrainEditeur() {
  const canvas = canvasTerrain;
  const e = courant;
  if (!canvas || !e || !canvas.isConnected) return;
  const largeur = canvas.clientWidth; const hauteur = canvas.clientHeight;
  if (!largeur || !hauteur) return;
  const echelle = Math.min(3, devicePixelRatio || 1);
  const pw = Math.round(largeur * echelle); const ph = Math.round(hauteur * echelle);
  if (canvas.width !== pw) canvas.width = pw;
  if (canvas.height !== ph) canvas.height = ph;
  e.pixels = [pw, ph];
  const ctx = canvas.getContext('2d');
  ctx.setTransform(echelle, 0, 0, echelle, 0, 0);
  const vue = new Vue(e.modele.cadrage, largeur, hauteur);
  e.vue = vue;
  majAccent(canvas);
  dessinerScene(ctx, vue, e, performance.now());
}

function dessinerScene(ctx, vue, e, maintenant) {
  const m = e.modele;
  dessinerTerrain(ctx, vue, { grille: m.grille });
  const contenu = m.contenu;
  const play = m.courant;
  const frames = m.frames;
  const sel = e.apercu == null ? m.selection : null;
  contenu.materiel.forEach((p, i) => { if (p.type === 'zone') dessinerMateriel(ctx, vue, p, { selectionne: sel?.type === 'prop' && sel.index === i }); });
  contenu.materiel.forEach((p, i) => { if (p.type !== 'zone') dessinerMateriel(ctx, vue, p, { selectionne: sel?.type === 'prop' && sel.index === i }); });
  if (!frames.length) return;
  const rogne = vue.diametre * 0.5;
  const balles = M.idsBallons(play.etapes);

  // Aperçu animé
  if (e.apercu != null) {
    const pos = positionLecture(play, (maintenant - e.apercu) / 1000);
    if (!pos) {
      setTimeout(() => finirApercu(e), 0);
      const fin = frames[frames.length - 1];
      for (const a of play.acteurs) if (fin.positions[a.id]) dessinerJoueur(ctx, vue, a, fin.positions[a.id]);
      for (const id of balles) dessinerBallon(ctx, pointEcranBallon(fin, vue, id));
      return;
    }
    const [etape, t] = pos;
    if (etape > 0) for (const f of M.flechesEtape(play, etape, frames)) dessinerFleche(ctx, vue, f, { rogneDebut: rogne, rogneFin: rogne, opacite: 0.55 });
    const avant = frames[Math.max(0, etape - 1)]; const apres = frames[etape];
    const k = adoucir(t);
    const positions = {};
    for (const a of play.acteurs) {
      const p1 = apres.positions[a.id];
      if (!p1) continue;
      const p0 = avant.positions[a.id] ?? p1;
      positions[a.id] = [p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k];
      dessinerJoueur(ctx, vue, a, positions[a.id], { enEvidence: play.etapes[etape].focus?.includes(a.id) ?? false });
    }
    const maintenantFrame = { ...apres, positions };
    for (const id of balles) {
      const avantB = ballonDe(avant, id); const apresB = ballonDe(apres, id);
      const porte = avantB?.porteur != null && avantB.porteur === apresB?.porteur;
      let point;
      if (porte || etape === 0 || !avantB) point = pointEcranBallon(maintenantFrame, vue, id);
      else {
        const a = pointEcranBallon(avant, vue, id); const b = pointEcranBallon(apres, vue, id);
        point = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      }
      const levee = M.estAerien(play, etape, id) ? 1 + 0.6 * Math.sin(Math.PI * k) : 1;
      dessinerGlypheBallon(ctx, point, 17 * levee);
    }
    return;
  }

  const k = Math.min(m.vignette, frames.length - 1);
  const frame = frames[k];

  // Vignette suivante : position d'avant en transparence + flèches calculées
  if (k > 0) {
    const avant = frames[k - 1];
    for (const a of contenu.acteurs) {
      const p0 = avant.positions[a.id]; const p1 = frame.positions[a.id];
      if (!p0 || !p1 || Math.hypot(p0[0] - p1[0], p0[1] - p1[1]) <= 0.008) continue;
      dessinerJoueur(ctx, vue, a, p0, { fantome: true });
    }
    for (const f of M.flechesEtape(play, k, frames)) dessinerFleche(ctx, vue, f, { rogneDebut: rogne, rogneFin: rogne });
  }

  // Ligne de plots ou zone en cours de tracé
  const g = e.glisse;
  if (g?.bouge && !g.cible) {
    if (m.outil === 'ligne') {
      const a = vue.terrain(g.depart); const b = vue.terrain(g.actuel);
      const { metres, nombre } = ModeleEditeur.plotsLigne(a, b);
      ctx.save();
      ctx.beginPath(); ctx.moveTo(...g.depart); ctx.lineTo(...g.actuel);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.stroke();
      ctx.restore();
      for (let i = 0; i < nombre; i++) {
        const t = i / (nombre - 1);
        dessinerMateriel(ctx, vue, { type: 'plot', pos: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], couleur: m.propColor });
      }
      ecrire(ctx, `${nombre} plots · ${Math.round(metres)} m`, g.actuel[0], g.actuel[1] - 24);
    } else if (m.outil === 'prop:zone') {
      const x = Math.min(g.depart[0], g.actuel[0]); const y = Math.min(g.depart[1], g.actuel[1]);
      const l = Math.abs(g.actuel[0] - g.depart[0]); const hh = Math.abs(g.actuel[1] - g.depart[1]);
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x, y, l, hh);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); ctx.strokeRect(x, y, l, hh);
      ctx.restore();
      const a = vue.terrain(g.depart); const b = vue.terrain(g.actuel);
      ecrire(ctx, metresZone([Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])]), x + l / 2, y + hh / 2);
    }
  }

  // Joueurs (le receveur d'une passe en cours s'allume)
  const ballonGlisse = g?.bouge && g.cible?.type === 'ball' ? g.cible.id : null;
  const receveur = ballonGlisse ? joueurProche(g.actuel, vue, e) : null;
  for (const a of contenu.acteurs) {
    const p = frame.positions[a.id];
    if (!p) continue;
    dessinerJoueur(ctx, vue, a, p, { selectionne: sel?.type === 'actor' && sel.id === a.id, enEvidence: receveur === a.id });
  }
  // Ballons (celui qu'on glisse suit le doigt)
  for (const id of balles) {
    const point = ballonGlisse === id ? g.actuel : pointEcranBallon(frame, vue, id);
    dessinerBallon(ctx, point, { selectionne: sel?.type === 'ball' && sel.id === id });
  }
}

function ecrire(ctx, texte, x, y) {
  ctx.save();
  ctx.font = `600 12px ${POLICE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 3;
  ctx.fillStyle = '#fff';
  ctx.fillText(texte, x, y);
  ctx.restore();
}

/** Objet sous le doigt : { type: 'actor'|'prop'|'zoneHandle'|'ball', id|index } */
function testerTouche(point, vue, e) {
  const m = e.modele;
  const contenu = m.contenu;
  const frame = m.frameCourante;
  if (!frame) return null;
  const dist = (a) => Math.hypot(a[0] - point[0], a[1] - point[1]);
  const s = m.selection;
  if (s?.type === 'prop') {
    const prop = contenu.materiel[s.index];
    if (prop?.type === 'zone' && dist(poigneeZone(prop, vue)) < 24) return { type: 'zoneHandle', index: s.index };
  }
  let meilleur = null;
  const envisager = (cible, d, rayon) => {
    if (d > rayon) return;
    if (!meilleur || d < meilleur.d) meilleur = { cible, d };
  };
  for (const id of m.idsBallons) envisager({ type: 'ball', id }, dist(pointEcranBallon(frame, vue, id)) - 5, 15);
  const r = vue.diametre / 2 + 6;
  for (const a of contenu.acteurs) {
    const p = frame.positions[a.id];
    if (p) envisager({ type: 'actor', id: a.id }, dist(vue.ecran(p)), r);
  }
  contenu.materiel.forEach((prop, i) => {
    if (prop.type === 'zone') return;
    const [w, hh] = tailleMateriel(prop.type, vue);
    envisager({ type: 'prop', index: i }, dist(vue.ecran(prop.pos)) + 2, Math.max(18, Math.max(w, hh) / 2 + 4));
  });
  if (meilleur) return meilleur.cible;
  let plusPetite = null;
  contenu.materiel.forEach((prop, i) => {
    if (prop.type !== 'zone') return;
    const taille = prop.taille ?? TAILLE_ZONE_DEFAUT;
    const rr = vue.rect(prop.pos, taille);
    if (point[0] < rr.x || point[0] > rr.x + rr.l || point[1] < rr.y || point[1] > rr.y + rr.h) return;
    const aire = taille[0] * taille[1];
    if (!plusPetite || aire < plusPetite.aire) plusPetite = { index: i, aire };
  });
  return plusPetite ? { type: 'prop', index: plusPetite.index } : null;
}

function centreEcran(cible, vue, e) {
  const m = e.modele;
  const frame = m.frameCourante;
  if (!frame) return null;
  if (cible.type === 'actor') return frame.positions[cible.id] ? vue.ecran(frame.positions[cible.id]) : null;
  if (cible.type === 'prop') return m.contenu.materiel[cible.index] ? vue.ecran(m.contenu.materiel[cible.index].pos) : null;
  return null;
}

/** Joueur sous le doigt (pour recevoir le ballon) */
function joueurProche(point, vue, e) {
  const frame = e.modele.frameCourante;
  if (!frame) return null;
  const rayon = vue.diametre * 0.8;
  let meilleur = null;
  for (const a of e.modele.contenu.acteurs) {
    const p = frame.positions[a.id];
    if (!p) continue;
    const s = vue.ecran(p);
    const d = Math.hypot(s[0] - point[0], s[1] - point[1]);
    if (d < rayon && (!meilleur || d < meilleur.d)) meilleur = { id: a.id, d };
  }
  return meilleur?.id ?? null;
}

function choisir(m, cible) {
  if (!cible) m.selection = null;
  else if (cible.type === 'actor') m.selection = { type: 'actor', id: cible.id };
  else if (cible.type === 'ball') m.selection = { type: 'ball', id: cible.id };
  else m.selection = { type: 'prop', index: cible.index };
}

function toucher(point, vue, e) {
  const m = e.modele;
  const cible = testerTouche(point, vue, e);
  const surVide = !cible || (cible.type === 'prop' && m.contenu.materiel[cible.index]?.type === 'zone');
  const lieu = vue.terrain(point);
  const outil = m.outil;
  if (outil === 'joueur' || outil === 'gardien') {
    if (surVide) {
      const id = m.ajouterJoueur(lieu, { gardien: outil === 'gardien' });
      m.selection = { type: 'actor', id };
    } else choisir(m, cible);
  } else if (typeOutil(outil)) {
    const type = typeOutil(outil);
    // Une zone ne se pose pas sur une autre zone : on la sélectionne
    if (surVide && (type !== 'zone' || !cible)) {
      const index = m.ajouterMateriel(type, lieu);
      m.selection = { type: 'prop', index };
    } else choisir(m, cible);
  } else if (outil === 'ballon') {
    // L'outil reste actif : chaque touche ajoute un ballon
    if (cible?.type === 'actor') m.ajouterBallon(lieu, cible.id);
    else if (cible?.type === 'ball') m.selection = { type: 'ball', id: cible.id };
    else m.ajouterBallon(lieu, null);
  } else if (outil === 'ligne') {
    if (surVide) {
      const demi = 6 / W;
      m.ajouterLigne([lieu[0] - demi, lieu[1]], [lieu[0] + demi, lieu[1]]);
    } else choisir(m, cible);
  } else {
    choisir(m, cible);
  }
}

const pointLocal = (canvas, ev) => {
  const r = canvas.getBoundingClientRect();
  return [ev.clientX - r.left, ev.clientY - r.top];
};

definirMontage('editeur.terrain', (canvas) => {
  canvasTerrain = canvas;
  const e = courant;
  let idPointeur = null;

  const debut = (ev) => {
    const ed = courant;
    if (!ed || ed.apercu != null || idPointeur != null) return;
    if (ev.button != null && ev.button > 0) return;
    idPointeur = ev.pointerId;
    try { canvas.setPointerCapture(ev.pointerId); } catch { /* ignoré */ }
    const vue = ed.vue ?? (ed.vue = new Vue(ed.modele.cadrage, canvas.clientWidth, canvas.clientHeight));
    const p = pointLocal(canvas, ev);
    const cible = testerTouche(p, vue, ed);
    let prise = [0, 0];
    const c = cible ? centreEcran(cible, vue, ed) : null;
    if (c) prise = [c[0] - p[0], c[1] - p[1]];
    ed.glisse = { depart: p, actuel: p, cible, prise, bouge: false };
    ev.preventDefault();
  };

  const deplacement = (ev) => {
    const ed = courant;
    if (!ed?.glisse || ev.pointerId !== idPointeur) return;
    const vue = ed.vue;
    const g = ed.glisse;
    g.actuel = pointLocal(canvas, ev);
    const d = Math.hypot(g.actuel[0] - g.depart[0], g.actuel[1] - g.depart[1]);
    const m = ed.modele;
    if (!g.bouge && d > 6) {
      g.bouge = true;
      if (g.cible) {
        m.checkpoint();
        choisir(m, g.cible.type === 'zoneHandle' ? { type: 'prop', index: g.cible.index } : g.cible);
        rafraichir();
      }
    }
    if (g.bouge && g.cible) {
      const point = [g.actuel[0] + g.prise[0], g.actuel[1] + g.prise[1]];
      if (g.cible.type === 'actor') m.deplacerJoueur(g.cible.id, vue.terrain(point));
      else if (g.cible.type === 'prop') m.deplacerMateriel(g.cible.index, vue.terrain(point));
      else if (g.cible.type === 'zoneHandle') m.redimensionnerZone(g.cible.index, vue.terrain(g.actuel));
    }
    demanderDessin();
  };

  const fin = (ev) => {
    const ed = courant;
    if (!ed?.glisse || ev.pointerId !== idPointeur) return;
    idPointeur = null;
    const g = ed.glisse;
    ed.glisse = null;
    const vue = ed.vue;
    const m = ed.modele;
    if (ev.type === 'pointercancel') { demanderDessin(); rafraichir(); return; }
    const lieu = pointLocal(canvas, ev);
    if (!g.bouge) {
      toucher(g.depart, vue, ed);
    } else if (g.cible?.type === 'ball') {
      m.lacherBallon(g.cible.id, vue.terrain(lieu), joueurProche(lieu, vue, ed));
    } else if (!g.cible) {
      if (m.outil === 'ligne') {
        m.ajouterLigne(vue.terrain(g.depart), vue.terrain(lieu));
      } else if (m.outil === 'prop:zone') {
        const a = vue.terrain(g.depart); const b = vue.terrain(lieu);
        const taille = [Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])];
        if (taille[0] * W >= 3 && taille[1] * L >= 3) {
          const index = m.ajouterMateriel('zone', [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], { taille });
          m.selection = { type: 'prop', index };
        }
      }
    }
    apresModif(ed);
  };

  canvas.addEventListener('pointerdown', debut);
  canvas.addEventListener('pointermove', deplacement);
  canvas.addEventListener('pointerup', fin);
  canvas.addEventListener('pointercancel', fin);

  // Clavier (Mac, iPad, ordinateur) : ⌘Z, ⇧⌘Z, Suppr, espace, ⌘S
  const clavier = (ev) => {
    const ed = courant;
    if (!ed || etatUI.dialogue || etatUI.menu || pageCourante().page !== 'editeur.atelier') return;
    if (ev.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const cmd = ev.metaKey || ev.ctrlKey;
    const m = ed.modele;
    if (cmd && ev.key.toLowerCase() === 'z') {
      ev.preventDefault();
      if (ev.shiftKey) m.retablir(); else m.annuler();
      apresModif(ed);
    } else if (cmd && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      enregistrerMaintenant(ed);
    } else if (!cmd && (ev.key === 'Delete' || ev.key === 'Backspace') && (m.selection?.type === 'actor' || m.selection?.type === 'prop')) {
      ev.preventDefault();
      m.supprimerSelection();
      apresModif(ed);
    } else if (!cmd && ev.key === ' ' && !ev.target.closest?.('button')) {
      ev.preventDefault();
      document.querySelector('[data-action="editeur.apercu"]')?.click();
    }
  };
  addEventListener('keydown', clavier);

  // Fenêtre cachée ou fermée : enregistre tout de suite
  const cache = () => { if (document.visibilityState === 'hidden' && courant) enregistrerMaintenant(courant); };
  document.addEventListener('visibilitychange', cache);
  const quitter = () => { if (courant) enregistrerMaintenant(courant); };
  addEventListener('pagehide', quitter);

  const ro = new ResizeObserver(() => dessinerTerrainEditeur());
  ro.observe(canvas);
  const desabonner = surChaqueRendu(() => demanderDessin());
  dessinerTerrainEditeur();

  return () => {
    canvas.removeEventListener('pointerdown', debut);
    canvas.removeEventListener('pointermove', deplacement);
    canvas.removeEventListener('pointerup', fin);
    canvas.removeEventListener('pointercancel', fin);
    removeEventListener('keydown', clavier);
    document.removeEventListener('visibilitychange', cache);
    removeEventListener('pagehide', quitter);
    ro.disconnect();
    desabonner();
    if (canvasTerrain === canvas) canvasTerrain = null;
    // Démonté (fermeture, bouton retour du téléphone, page poussée) : rien ne se perd
    if (e) { e.apercu = null; enregistrerMaintenant(e); }
  };
});

// MARK: - Pages poussées : fiche, étape, évolution (AtelierPages.swift)

/** Valide les saisies laissées en cours sur une page quittée (équivalent de onDisappear) */
function validerBrouillons(e) {
  if (e.brouillonFiche) { validerFiche(e); e.brouillonFiche = null; }
  if (e.brouillonEtape) { validerEtape(e); e.brouillonEtape = null; }
  if (e.brouillonEvolution) { validerEvolution(e); e.brouillonEvolution = null; }
}

// Fiche de l'exercice

function chargerFiche(e) {
  const p = e.modele.play;
  return {
    titre: p.titre,
    categorie: p.categorie === 'autre' ? 'perso' : p.categorie,
    niveau: p.niveau ?? '',
    duree: p.duree ?? '',
    objectif: p.objectif,
    consignes: p.consignes.join('\n'),
  };
}

function validerFiche(e) {
  const b = e.brouillonFiche;
  if (!b) return;
  const m = e.modele;
  const p = m.play;
  const consignes = b.consignes.split('\n').map((c) => c.trim()).filter(Boolean);
  const titre = b.titre.trim();
  const change = (titre === '' ? p.titre : titre) !== p.titre || b.categorie !== p.categorie || b.niveau !== (p.niveau ?? '')
    || b.duree !== (p.duree ?? '') || b.objectif !== p.objectif || JSON.stringify(consignes) !== JSON.stringify(p.consignes);
  if (!change) return;
  m.majInfos((x) => {
    if (titre !== '') x.titre = titre;
    x.categorie = b.categorie;
    if (b.niveau === '') delete x.niveau; else x.niveau = b.niveau;
    if (b.duree === '') delete x.duree; else x.duree = b.duree;
    x.objectif = b.objectif;
    x.consignes = consignes;
  });
  planifier(e);
}

/** Une ligne de matériel avec sa pastille de couleur (EquipmentRow) */
export function ligneMateriel(l) {
  const css = l.couleur ? M.couleurAtelier(l.couleur).css : null;
  const pastille = l.item === 'chasuble'
    ? `<span class="materiel-maillot" style="color:${css ?? 'var(--gris)'}">${icone('tshirt.fill')}</span>`
    : `<span class="materiel-rond" style="background:${css ?? '#fff'}"></span>`;
  return ligne({ contenu: `<span class="ligne-titre">${h(l.texte)}</span>`, avatar: `<span class="materiel-pastille">${pastille}</span>` });
}

definirPage('editeur.fiche', (p) => {
  const e = p.etat;
  const m = e.modele;
  const b = (e.brouillonFiche ??= chargerFiche(e));
  const fin = m.finalise();
  const lignes = M.materielExercice(fin);
  const nbEvo = m.play.evolutions?.length ?? 0;
  return {
    classe: 'atelier-page',
    titre: 'Fiche',
    contenu: `<div class="colonne">
      ${section({
        entete: 'Exercice',
        lignes: [
          champ({ valeur: b.titre, placeholder: "Nom de l'exercice", input: 'editeur.fiche.saisie', change: 'editeur.fiche.valider', data: { champ: 'titre' }, cle: 'fiche-titre' }),
          selecteur({
            titre: 'Thème', valeur: b.categorie, action: 'editeur.fiche.theme',
            options: M.CATEGORIES_TACTIQUES.filter((c) => c.id !== 'autre').map((c) => [c.id, c.nom]),
          }),
          champ({ valeur: b.niveau, placeholder: "Catégorie d'âge (U9, U13, Seniors…)", input: 'editeur.fiche.saisie', change: 'editeur.fiche.valider', data: { champ: 'niveau' }, cle: 'fiche-niveau' }),
          champ({ valeur: b.duree, placeholder: 'Durée (15 min…)', input: 'editeur.fiche.saisie', change: 'editeur.fiche.valider', data: { champ: 'duree' }, cle: 'fiche-duree' }),
        ],
      })}
      ${section({
        entete: 'Objectif',
        lignes: [champ({ valeur: b.objectif, placeholder: 'Ce que les joueurs vont travailler', multiligne: true, lignes: 2, input: 'editeur.fiche.saisie', change: 'editeur.fiche.valider', data: { champ: 'objectif' }, cle: 'fiche-objectif' })],
      })}
      ${section({
        entete: 'Consignes de coaching',
        lignes: [champ({ valeur: b.consignes, placeholder: 'Une consigne par ligne', multiligne: true, lignes: 3, input: 'editeur.fiche.saisie', change: 'editeur.fiche.valider', data: { champ: 'consignes' }, cle: 'fiche-consignes' })],
        pied: 'Exemple : « Orienter son contrôle », « Communiquer avant de recevoir ».',
      })}
      ${section({
        entete: 'Effectif',
        lignes: [
          ligne({ contenu: `<span class="ligne-titre${m.play.acteurs.length ? '' : ' secondaire'}">${h(effectif(m.play.acteurs) ?? "Aucun joueur pour l'instant")}</span>` }),
          nbEvo ? ligne({ contenu: `<span class="ligne-titre secondaire">${nbEvo} évolution${nbEvo > 1 ? 's' : ''}</span>` }) : '',
        ],
      })}
      ${section({
        entete: 'Matériel à prévoir',
        lignes: lignes.length ? lignes.map(ligneMateriel)
          : [ligne({ contenu: '<span class="ligne-titre secondaire">Rien pour l\'instant : posez du matériel sur le terrain.</span>' })],
        pied: 'Calculé à partir du terrain, évolutions comprises. Le gardien garde son maillot.',
      })}
      ${section({
        lignes: [
          ligne({ titre: 'Fiche à imprimer (PDF)', icone: 'printer', action: 'editeur.fiche.pdf', teinte: true, classe: 'avec-icone' }),
          ligne({ titre: "Envoyer l'exercice (fichier .tdjt)", icone: 'square.and.arrow.up', action: 'editeur.fiche.envoyer', teinte: true, classe: 'avec-icone' }),
        ],
        pied: "Le fichier .tdjt s'ouvre dans Temps de Jeu sur un autre iPhone, iPad ou Mac.",
      })}
    </div>`,
  };
});

const etatFiche = () => pageCourante().params?.etat ?? courant;

action('editeur.fiche.saisie', (el) => {
  const e = etatFiche();
  if (e?.brouillonFiche) e.brouillonFiche[el.dataset.champ] = el.value;
  return false;
});
action('editeur.fiche.valider', (el) => {
  const e = etatFiche();
  if (!e?.brouillonFiche) return;
  e.brouillonFiche[el.dataset.champ] = el.value;
  validerFiche(e);
});
action('editeur.fiche.theme', (el) => {
  const e = etatFiche();
  if (!e?.brouillonFiche) return;
  e.brouillonFiche.categorie = el.value;
  validerFiche(e);
});
action('editeur.fiche.pdf', () => {
  const e = etatFiche();
  validerFiche(e);
  const fin = e.modele.finalise();
  try {
    apercuPDF(ficheExercicePDF(fin), nomFichierFiche(fin.titre), 'Fiche');
  } catch (err) {
    console.error(err);
    alerte('Fiche PDF', "La fiche n'a pas pu être créée.");
  }
});
action('editeur.fiche.envoyer', () => {
  const e = etatFiche();
  validerFiche(e);
  enregistrerMaintenant(e);
  const fin = e.modele.finalise();
  partager({ titre: fin.titre, fichiers: [{ nom: nomFichierFiche(fin.titre, 'tdjt'), contenu: M.ecrireFichierTactiques([fin]), type: 'application/json' }] });
  return false;
});

// Étape

const dureeTexte = (d) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(d)} s`;

function validerEtape(e) {
  const b = e.brouillonEtape;
  if (!b || b.supprimee) return;
  const etape = e.modele.contenu.etapes[b.index];
  if (!etape) return;
  const dureeActuelle = etape.duree ?? 2.0;
  const nouvelleDuree = b.index > 0 && b.duree !== dureeActuelle ? b.duree : null;
  if (b.titre !== etape.titre || b.texte !== etape.texte || nouvelleDuree != null) {
    e.modele.majEtape(b.index, { titre: b.titre, texte: b.texte, duree: nouvelleDuree });
    planifier(e);
  }
}

definirPage('editeur.etape', (p) => {
  const e = p.etat;
  const i = p.index;
  const etape = e.modele.contenu.etapes[i];
  if (!etape) return { titre: 'Étape', contenu: '' };
  if (!e.brouillonEtape || e.brouillonEtape.index !== i) {
    e.brouillonEtape = { index: i, titre: etape.titre, texte: etape.texte, duree: etape.duree ?? 2.0 };
  }
  const b = e.brouillonEtape;
  const titre = i === 0 ? 'Mise en place' : `Étape ${i}`;
  return {
    classe: 'atelier-page',
    titre,
    contenu: `<div class="colonne">
      ${section({
        entete: titre,
        lignes: [
          champ({ valeur: b.titre, placeholder: i === 0 ? 'Mise en place' : 'Titre (ex. : « Passe en retrait »)', input: 'editeur.etape.saisie', change: 'editeur.etape.valider', data: { champ: 'titre' }, cle: `etape-titre-${i}` }),
          champ({ valeur: b.texte, placeholder: 'Ce que font les joueurs à ce moment', multiligne: true, lignes: 2, input: 'editeur.etape.saisie', change: 'editeur.etape.valider', data: { champ: 'texte' }, cle: `etape-texte-${i}` }),
        ],
        pied: "La consigne s'affiche en sous-titre dans le mode cinéma.",
      })}
      ${i > 0 ? section({
        entete: 'Animation',
        lignes: [stepper({ titre: 'Durée du mouvement', valeur: b.duree, texte: dureeTexte(b.duree), min: 0.5, max: 8, action: 'editeur.etape.duree' })],
      }) : ''}
      ${i > 0 ? section({ lignes: [ligne({ titre: 'Supprimer cette étape', icone: 'trash', detruire: true, action: 'editeur.etape.supprimer', classe: 'avec-icone' })] }) : ''}
    </div>`,
  };
});

action('editeur.etape.saisie', (el) => {
  const e = etatFiche();
  if (e?.brouillonEtape) e.brouillonEtape[el.dataset.champ] = el.value;
  return false;
});
action('editeur.etape.valider', (el) => {
  const e = etatFiche();
  if (!e?.brouillonEtape) return;
  e.brouillonEtape[el.dataset.champ] = el.value;
  validerEtape(e);
});
action('editeur.etape.duree', (el) => {
  const e = etatFiche();
  const b = e?.brouillonEtape;
  if (!b) return;
  b.duree = Math.min(8, Math.max(0.5, b.duree + 0.5 * Number(el.dataset.pas)));
  validerEtape(e);
});
action('editeur.etape.supprimer', () => {
  const e = etatFiche();
  const b = e?.brouillonEtape;
  if (!b) return;
  b.supprimee = true;
  e.brouillonEtape = null;
  e.modele.supprimerVignette(b.index);
  planifier(e);
  retour();
});

// Évolution

function validerEvolution(e) {
  const b = e.brouillonEvolution;
  if (!b || b.supprimee) return;
  const evo = e.modele.play.evolutions?.[b.index];
  if (!evo) return;
  if (b.titre !== evo.titre || b.texte !== evo.texte) {
    e.modele.renommerEvolution(b.index, b.titre, b.texte);
    planifier(e);
  }
}

definirPage('editeur.evolution', (p) => {
  const e = p.etat;
  const i = p.index;
  const evo = e.modele.play.evolutions?.[i];
  if (!evo) return { titre: 'Évolution', contenu: '' };
  if (!e.brouillonEvolution || e.brouillonEvolution.index !== i) {
    e.brouillonEvolution = { index: i, titre: evo.titre, texte: evo.texte };
  }
  const b = e.brouillonEvolution;
  return {
    classe: 'atelier-page',
    titre: b.titre === '' ? 'Évolution' : b.titre,
    contenu: `<div class="colonne">
      ${section({
        entete: 'Évolution',
        lignes: [
          champ({ valeur: b.titre, placeholder: 'Nom (ex. : « 2 touches maximum »)', input: 'editeur.evolution.saisie', change: 'editeur.evolution.valider', data: { champ: 'titre' }, cle: `evo-titre-${i}` }),
          champ({ valeur: b.texte, placeholder: "Ce qui change par rapport à l'exercice de base", multiligne: true, lignes: 2, input: 'editeur.evolution.saisie', change: 'editeur.evolution.valider', data: { champ: 'texte' }, cle: `evo-texte-${i}` }),
        ],
        pied: "Une évolution part du même terrain : ajoutez un défenseur, réduisez l'espace, changez la consigne…",
      })}
      ${section({ lignes: [ligne({ titre: 'Supprimer cette évolution', icone: 'trash', detruire: true, action: 'editeur.evolution.supprimer', classe: 'avec-icone' })] })}
    </div>`,
  };
});

action('editeur.evolution.saisie', (el) => {
  const e = etatFiche();
  if (e?.brouillonEvolution) e.brouillonEvolution[el.dataset.champ] = el.value;
});
action('editeur.evolution.valider', (el) => {
  const e = etatFiche();
  if (!e?.brouillonEvolution) return;
  e.brouillonEvolution[el.dataset.champ] = el.value;
  validerEvolution(e);
});
action('editeur.evolution.supprimer', () => {
  const e = etatFiche();
  const b = e?.brouillonEvolution;
  if (!b) return;
  b.supprimee = true;
  e.brouillonEvolution = null;
  e.modele.supprimerEvolution(b.index);
  planifier(e);
  retour();
});

// Pour les tests et les autres écrans
export { memeSelection, ModeleEditeur };

/** L'éditeur ouvert (banc d'essai) : { modele, vue } */
export const editeurCourant = () => courant;
