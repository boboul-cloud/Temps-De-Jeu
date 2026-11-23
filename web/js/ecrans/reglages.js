// Onglet « Réglages et Exports » (SettingsView de ContentView.swift).
// Différence voulue avec l'iPhone : la version web est entièrement gratuite (pas d'achat Premium) ;
// la section « Abonnement » devient « Version web ».
import { store } from '../store.js';
import * as M from '../model.js';
import {
  definirPage, action, pousser, section, ligne, etat, h, icone, choisirFichier, ouvrirLien, alerte,
} from '../ui.js';
import { ouvrirFichier } from '../entrees.js';

const APP_STORE = 'https://apps.apple.com/fr/app/temps-de-jeu/id6758916303';
const estIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const estInstallee = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

definirPage('reglages.racine', () => {
  const profil = store.profilActif();
  return {
    titre: 'Réglages et Exports',
    grandTitre: true,
    contenu: `<div class="colonne">
      ${section({
        entete: 'Données',
        lignes: [
          ligne({
            contenu: `<span class="ligne-titre">Export / Import</span><span class="ligne-sous-titre">PDF, JSON joueurs &amp; stats</span>`,
            icone: 'square.and.arrow.up.on.square', couleurIcone: 'blue', chevron: true, action: 'reglages.export',
            data: { titre: profil ? `Export — ${profil.name}` : 'Export / Import' }, classe: 'avec-icone',
          }),
          ligne({
            contenu: '<span class="ligne-titre">Ouvrir un fichier Temps De Jeu</span><span class="ligne-sous-titre">Sauvegarde, composition, matchs, exercices</span>',
            icone: 'arrow.down.doc.fill', couleurIcone: 'blue', action: 'reglages.ouvrirFichier', classe: 'avec-icone',
          }),
        ],
        pied: "Les données restent dans ce navigateur, sur cet appareil. Le fichier de sauvegarde complète (.tdjb) est le même que celui de l'app iPhone : il passe de l'une à l'autre.",
      })}
      ${section({
        entete: 'Aide',
        lignes: [ligne({
          contenu: `<span class="ligne-titre">Mode d'emploi</span><span class="ligne-sous-titre">Apprenez à utiliser l'app</span>`,
          icone: 'book.fill', couleurIcone: 'green', chevron: true, action: 'nav.pousser', data: { page: 'guide' }, classe: 'avec-icone',
        })],
      })}
      ${section({
        entete: 'Version web',
        lignes: [
          ligne({
            contenu: '<span class="ligne-titre">Gratuite, tout est inclus</span><span class="ligne-sous-titre">Matchs illimités, sans achat ni compte</span>',
            icone: 'gift.fill', couleurIcone: 'green', chevron: true, action: 'nav.pousser', data: { page: 'reglages.gratuit' }, classe: 'avec-icone',
          }),
          estInstallee() ? '' : ligne({
            contenu: `<span class="ligne-titre">Installer l'application</span><span class="ligne-sous-titre">${estIOS ? "Sur l'écran d'accueil, utilisable hors ligne" : 'Icône sur cet appareil, utilisable hors ligne'}</span>`,
            icone: 'square.and.arrow.down', couleurIcone: 'blue', action: 'reglages.installer', classe: 'avec-icone',
          }),
          ligne({
            contenu: '<span class="ligne-titre">Application iPhone et iPad</span><span class="ligne-sous-titre">Temps De Jeu sur l\'App Store</span>',
            icone: 'arrow.up.forward.circle', couleurIcone: 'blue', action: 'reglages.appstore', classe: 'avec-icone',
          }),
        ],
      })}
      ${section({
        entete: 'À propos',
        lignes: [
          ligne({ titre: 'Version', valeur: `${M.VERSION_APP} (web)` }),
          ligne({ titre: 'Développeur', valeur: 'Robert Oulhen' }),
        ],
      })}
      ${section({
        entete: 'Légal',
        lignes: [
          ligne({ titre: "Conditions d'utilisation", icone: 'doc.text', action: 'nav.pousser', data: { page: 'legal.conditions' }, teinte: true, classe: 'avec-icone' }),
          ligne({ titre: 'Politique de confidentialité', icone: 'hand.raised.fill', action: 'nav.pousser', data: { page: 'legal.confidentialite' }, teinte: true, classe: 'avec-icone' }),
        ],
      })}
    </div>`,
  };
});

action('reglages.export', (el) => pousser('export.import', { titre: el.dataset.titre }));
action('reglages.ouvrirFichier', async () => {
  const [f] = await choisirFichier({ accept: '.tdjb,.tdj,.tdjm,.tdjt,.json,application/json' });
  if (f) ouvrirFichier(f);
  return false;
});
action('reglages.appstore', () => { ouvrirLien(APP_STORE); return false; });
action('reglages.installer', () => {
  if (etat.installation) {
    etat.installation.prompt();
    etat.installation.userChoice.finally(() => { etat.installation = null; });
    return false;
  }
  if (estIOS) {
    alerte("Sur l'écran d'accueil", "Dans Safari, touchez Partager ▸ « Sur l'écran d'accueil ». L'app s'ouvrira alors en plein écran, avec son icône, et fonctionnera sans réseau.");
  } else {
    alerte("Installer l'application", "Dans le menu du navigateur (⋮ ou ⋯), choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil ».");
  }
});

// « Vos avantages » (PremiumStatusView) : ici, tout est offert
const AVANTAGES = [
  ['infinity', 'Matchs illimités', 'Créez autant de matchs que vous le souhaitez'],
  ['chart.bar.fill', 'Statistiques avancées', 'Analyse détaillée de chaque match'],
  ['square.and.arrow.up', 'Export des rapports', 'Partagez vos rapports PDF'],
  ['clock.arrow.circlepath', 'Historique complet', 'Accès à tous vos matchs passés'],
  ['person.3.fill', "Gestion d'équipe", 'Effectif illimité et composition'],
  ['star.fill', 'Mises à jour futures', 'Toutes les nouveautés incluses'],
];

definirPage('reglages.gratuit', () => ({
  titre: 'Version web',
  contenu: `<div class="colonne">
    <div class="carte texte-centre" style="background:color-mix(in srgb, var(--vert) 12%, var(--fond-carte))">
      <div style="font-size:48px;color:var(--vert)">${icone('gift.fill')}</div>
      <p style="font-size:22px;font-weight:700;margin:8px 0 4px">Tout est inclus</p>
      <p class="secondaire" style="margin:0">La version web de Temps De Jeu est gratuite : pas de limite de matchs, pas d'achat, pas de compte.</p>
    </div>
    ${section({
      entete: 'Vos avantages',
      lignes: AVANTAGES.map(([ic, titre, detail]) => ligne({
        icone: ic, couleurIcone: 'green', classe: 'avec-icone',
        contenu: `<span class="ligne-titre">${h(titre)}</span><span class="ligne-sous-titre">${h(detail)}</span>`,
        droite: `<span style="color:var(--vert)">${icone('checkmark.circle.fill')}</span>`,
      })),
    })}
    <p class="secondaire texte-centre petit">Merci pour votre soutien ! 💚</p>
  </div>`,
}));
