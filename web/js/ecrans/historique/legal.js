// Conditions d'utilisation et politique de confidentialité (LegalView.swift).
// Mêmes textes que l'app iPhone, sauf ce qui ne vaut pas pour la version web :
// achats intégrés (la version web est gratuite), partage par iOS, sécurité du stockage iOS,
// suppression par désinstallation. Ces passages sont réécrits pour le navigateur.
import { definirPage, action, icone, h, ouvrirLien } from '../../ui.js';

const URL_CONDITIONS = 'https://boboul-cloud.github.io/Temps-De-Jeu/terms.html';
const URL_CONFIDENTIALITE = 'https://boboul-cloud.github.io/Temps-De-Jeu/privacy.html';
const MISE_A_JOUR = 'Dernière mise à jour : 23 novembre 2026 (version web)';

const bloc = (titre, texte) => `<h3 class="legal-titre">${h(titre)}</h3><p class="legal-texte">${h(texte)}</p>`;

const piedLegal = (url) => `<button type="button" class="legal-web" data-action="legal.web" data-url="${h(url)}">${icone('safari')}<span>Voir sur le web</span></button>
  <p class="legal-maj">${h(MISE_A_JOUR)}</p>`;

definirPage('legal.conditions', () => ({
  titre: "Conditions d'utilisation",
  libelleRetour: 'Retour',
  contenu: `<div class="lecture legal">
    ${bloc('1. Acceptation des conditions', "En téléchargeant et en utilisant l'application Temps De Jeu, vous acceptez les présentes conditions générales d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser l'application.")}
    ${bloc('2. Description du service', "Temps De Jeu est une application de gestion du temps de jeu effectif pour les matchs de football. Elle permet de chronométrer les arrêts de jeu, de gérer les compositions d'équipe, les remplacements, les cartons et de générer des statistiques et rapports.")}
    ${bloc('3. Gratuité de la version web', "La version web de Temps De Jeu est entièrement gratuite : aucun achat, aucun abonnement, aucun compte. Toutes les fonctions sont incluses, sans limite de matchs.\n\nL'application pour iPhone et iPad, distribuée sur l'App Store, propose de son côté une version gratuite limitée à 5 matchs et une version Premium par achat unique, traité par Apple.")}
    ${bloc('4. Données personnelles', "Les données saisies dans l'application (noms de joueurs, matchs, scores) sont stockées localement sur votre appareil, dans votre navigateur. Aucune donnée personnelle n'est collectée, transmise ou stockée sur des serveurs externes.")}
    ${bloc('5. Propriété intellectuelle', "L'application Temps De Jeu, son design, son code source et son contenu sont protégés par le droit d'auteur. Toute reproduction ou distribution non autorisée est interdite.")}
    ${bloc('6. Limitation de responsabilité', "L'application est fournie « en l'état ». L'éditeur ne garantit pas l'absence de bugs ou d'interruptions. L'utilisation de l'application se fait sous votre propre responsabilité.")}
    ${bloc('7. Modifications', "L'éditeur se réserve le droit de modifier les présentes conditions à tout moment. Les utilisateurs seront informés des modifications importantes via une mise à jour de l'application.")}
    ${bloc('8. Contact', "Pour toute question concernant ces conditions, vous pouvez nous contacter à l'adresse : bob.oulhen@gmail.com")}
    ${bloc('9. Droit applicable', 'Les présentes conditions sont régies par le droit français. Tout litige sera soumis aux tribunaux compétents de Paris, France.')}
    ${piedLegal(URL_CONDITIONS)}
  </div>`,
}));

definirPage('legal.confidentialite', () => ({
  titre: 'Politique de confidentialité',
  libelleRetour: 'Retour',
  contenu: `<div class="lecture legal">
    <div class="legal-resume">
      <span class="legal-resume-icone">${icone('hand.raised.fill')}</span>
      <span><b>Vos données restent privées</b><small>Aucune donnée n'est collectée ni transmise à des serveurs externes.</small></span>
    </div>
    ${bloc('1. Introduction', "La présente politique de confidentialité décrit comment l'application Temps De Jeu traite vos données. Nous accordons une grande importance à la protection de votre vie privée.")}
    ${bloc('2. Données collectées', "L'application ne collecte aucune donnée personnelle. Les informations que vous saisissez dans l'application (noms de joueurs, compositions d'équipe, scores, statistiques) sont :\n\n• Stockées uniquement sur votre appareil (stockage local du navigateur)\n• Jamais transmises à des serveurs externes\n• Jamais partagées avec des tiers\n• Sous votre contrôle total (vous pouvez les supprimer à tout moment)")}
    ${bloc('3. Achats', "La version web ne propose aucun achat : aucune information bancaire ou de paiement n'est demandée ni traitée.")}
    ${bloc('4. Analyse et suivi', "L'application n'utilise aucun outil d'analyse, de suivi ou de publicité. Aucun cookie, identifiant publicitaire ou technologie de tracking n'est utilisé.")}
    ${bloc('5. Partage de données', "Lorsque vous exportez un rapport PDF ou un fichier JSON depuis l'application, ces fichiers sont partagés via le partage de votre appareil, ou téléchargés sur ordinateur. L'application ne conserve aucune copie de ces exports.")}
    ${bloc('6. Sécurité', "Vos données restent dans l'espace réservé à l'application par votre navigateur, protégé par les mécanismes de sécurité de votre appareil et de votre navigateur.")}
    ${bloc('7. Droits de l\'utilisateur', "Conformément au RGPD, vous disposez des droits suivants :\n\n• Droit d'accès : vos données sont accessibles directement dans l'application\n• Droit de rectification : vous pouvez modifier vos données à tout moment\n• Droit de suppression : vous pouvez supprimer vos données depuis l'application ou en effaçant les données du site dans votre navigateur\n• Droit à la portabilité : vous pouvez exporter vos données au format JSON")}
    ${bloc('8. Contact', 'Pour toute question relative à la protection de vos données personnelles : bob.oulhen@gmail.com')}
    ${piedLegal(URL_CONFIDENTIALITE)}
  </div>`,
}));

action('legal.web', (el) => { ouvrirLien(el.dataset.url); return false; });
