// Onglet « Cartons » (CardsManagementView.swift) : résumé, joueurs sanctionnés, filtre par type,
// historique des cartons en cours. « Purger » (balayage sur iPhone) devient un bouton sur la ligne :
// le carton quitte la liste mais reste dans les statistiques et les rapports.
import * as M from '../model.js';
import { store } from '../store.js';
import { definirPage, action, section, segmente, h, icone } from '../ui.js';
import {
  enrichirCartons, cartonsFiltres, joueursSanctionnes, FILTRES_CARTONS, COULEUR_CARTON, momentCarton,
} from './effectif/logique.js';
import { avatarJoueur, badgeCarton, statCarton, carteVisuelle, recherche, valeurRecherche } from './effectif/commun.js';

const etat = { recherche: '', filtre: 'tous' };

/** Ligne de l'historique (CardHistoryRow) */
function ligneCarton({ carte, adversaire }) {
  return `<div class="ligne eff-ligne" data-key="c-${h(carte.id)}">
    ${carteVisuelle(carte.type)}
    <span class="ligne-textes">
      <span class="ligne-titre gras eff-nom">${h(carte.playerName)}</span>
      <span class="eff-sous"><span style="color:${M.couleur(COULEUR_CARTON[carte.type])}">${h(carte.type)}</span><span class="secondaire">• ${h(momentCarton(carte))}</span></span>
    </span>
    <span class="eff-carton-droite">
      ${adversaire ? `<b>vs ${h(adversaire)}</b>` : carte.matchLabel ? `<span>${h(carte.matchLabel)}</span>` : ''}
      ${carte.matchDate ? `<span class="tertiaire">${h(M.formatDate(carte.matchDate, 'medium'))}</span>` : ''}
    </span>
    <button type="button" class="eff-purger" data-action="cartons.purger" data-id="${h(carte.id)}" data-match="${h(carte.matchId ?? '')}" title="Purger : retirer de la liste (le carton reste dans les statistiques)">${icone('checkmark.circle')}<span>Purger</span></button>
  </div>`;
}

definirPage('cartons.racine', () => {
  const joueurs = store.joueurs();
  const enrichis = enrichirCartons(store.matchs());
  const actifs = enrichis.filter((e) => !e.carte.isServed).map((e) => e.carte);
  const n = (type) => actifs.filter((c) => c.type === type).length;
  const sanctionnes = joueursSanctionnes(joueurs, enrichis);
  const liste = cartonsFiltres(enrichis, etat.filtre, etat.recherche);
  return {
    titre: 'Cartons',
    grandTitre: true,
    contenu: `<div class="colonne">
      ${recherche({ valeur: etat.recherche, action: 'cartons.recherche', placeholder: 'Rechercher un joueur ou match', cle: 'cartons-recherche' })}
      <div class="eff-badges">
        ${statCarton('Jaunes', n('Jaune'), 'cardYellow')}
        ${statCarton('2è Jaunes', n('2ème Jaune'), 'cardOrange')}
        ${statCarton('Rouges', n('Rouge'), 'cardRed')}
        ${statCarton('Blancs', n('Blanc'), 'cardWhite')}
      </div>
      ${sanctionnes.length ? section({
        entete: 'Joueurs sanctionnés',
        cle: 's-sanctionnes',
        lignes: sanctionnes.map((e) => `<div class="ligne eff-ligne eff-avec-avatar" data-key="js-${h(e.joueur.id)}">
          ${avatarJoueur(e.joueur, { taille: 40 })}
          <span class="ligne-textes"><span class="ligne-titre gras eff-nom">${h(M.fullName(e.joueur))}</span><span class="ligne-sous-titre">${h(e.joueur.position)}</span></span>
          <span class="eff-cartons large">
            ${e.jaune ? badgeCarton(e.jaune, 'cardYellow') : ''}${e.deuxiemeJaune ? badgeCarton(e.deuxiemeJaune, 'cardOrange') : ''}
            ${e.rouge ? badgeCarton(e.rouge, 'cardRed') : ''}${e.blanc ? badgeCarton(e.blanc, 'cardWhite') : ''}
          </span>
        </div>`),
      }) : ''}
      ${segmente({ valeur: etat.filtre, options: FILTRES_CARTONS, action: 'cartons.filtre' })}
      ${liste.length === 0
        ? `<div class="eff-vide-section">${icone('rectangle.on.rectangle.slash')}<span>Aucun carton</span></div>`
        : section({ entete: `En cours (${liste.length})`, cle: 's-encours', lignes: liste.map(ligneCarton) })}
    </div>`,
  };
});

action('cartons.recherche', (el) => { etat.recherche = valeurRecherche(el); });
action('cartons.filtre', (el) => { etat.filtre = el.dataset.valeur; });
action('cartons.purger', (el) => {
  if (!el.dataset.match) return false;
  store.purgerCarton(el.dataset.id, el.dataset.match);
});
