// Onglet « Saisons » (SeasonManagementView.swift) : saison en cours et clôture, nouvelle saison,
// archives et leur détail (ArchiveDetailView). La suppression d'une archive (balayage sur iPhone)
// se fait par le bouton « ⋯ » de sa ligne.
import * as M from '../model.js';
import { store } from '../store.js';
import {
  definirPage, action, ouvrirFeuille, fermerFeuille, pageCourante, section, ligne, boutonBarre, choix, confirmer,
  alerte, valeurDate, dateDepuisChamp, h, icone,
} from '../ui.js';
import { resumeSaison, bilanArchive, resultat, COULEUR_RESULTAT, effectifParPoste, couleurPoste } from './effectif/logique.js';
import { badgesStats, champBrut, etiquette, boutonMenu } from './effectif/commun.js';

const c = (nom) => M.couleur(nom);

function sectionSaisonEnCours(s) {
  const r = resumeSaison(store.matchs(), store.seances());
  return section({
    entete: 'Saison en cours',
    lignes: [
      `<div class="ligne eff-saison">
        <span class="eff-saison-icone" style="color:${c('green')}">${icone('sportscourt.fill')}</span>
        <span class="ligne-textes">
          <b class="eff-saison-club">${h(s.clubName)}</b>
          ${s.category ? `<span style="color:${c('blue')}">${h(s.category)}</span>` : ''}
          <span class="secondaire">Saison ${h(M.libelleSaison(s))}</span>
          <span class="petit tertiaire">Depuis le ${h(M.formatDate(s.startDate, 'long'))}</span>
        </span>
      </div>`,
      `<div class="ligne">${badgesStats([
        { libelle: 'Matchs', valeur: r.matchs, couleur: 'blue' },
        { libelle: 'Entraînements', valeur: r.entrainements, couleur: 'orange' },
        { libelle: 'Cartons', valeur: r.cartons, couleur: 'red' },
      ])}</div>`,
      ligne({
        contenu: '<span class="ligne-titre gras eff-petit-titre">Clôturer la saison</span><span class="ligne-sous-titre">Archiver les stats et repartir à zéro</span>',
        icone: 'flag.checkered', couleurIcone: 'red', action: 'saisons.cloturer', classe: 'avec-icone', teinte: true,
      }),
    ],
  });
}

function sectionSansSaison() {
  return section({
    entete: 'Saison',
    lignes: `<div class="eff-sans-saison">
      <span class="eff-vide-icone" style="color:${c('green')}">${icone('calendar.badge.plus')}</span>
      <b>Aucune saison active</b>
      <span class="secondaire">Créez une saison pour organiser vos statistiques par année sportive.</span>
      <button type="button" class="bouton plein large" style="--bouton:${c('green')}" data-action="saisons.nouvelle">${icone('plus.circle.fill')}<span>Nouvelle saison</span></button>
    </div>`,
  });
}

function sectionArchives(archives) {
  return section({
    entete: `Archives (${archives.length})`,
    lignes: archives.length === 0
      ? `<div class="eff-vide-section petite">${icone('archivebox')}<span>Aucune saison archivée</span></div>`
      : archives.map((a) => {
        const matchs = a.matches.filter((m) => m.isFinished).length;
        return `<div class="ligne tactile eff-ligne" role="button" tabindex="0" data-action="saisons.archive" data-id="${h(a.id)}" data-key="a-${h(a.id)}">
          <span class="eff-archive-icone" style="color:${c('purple')}">${icone('archivebox.fill')}</span>
          <span class="ligne-textes">
            <span class="eff-archive-titre"><b>${h(a.season.clubName)} — ${h(M.libelleSaison(a.season))}</b>${a.season.category ? etiquette(a.season.category, 'blue') : ''}</span>
            <span class="ligne-sous-titre">${matchs} matchs · ${a.trainingSessions.length} entraînements</span>
          </span>
          ${boutonMenu('saisons.menuArchive', { id: a.id })}
          <span class="ligne-chevron">${icone('chevron.right')}</span>
        </div>`;
      }),
  });
}

definirPage('saisons.racine', () => {
  const saison = store.saison();
  return {
    titre: 'Saisons',
    grandTitre: true,
    contenu: `<div class="colonne">
      ${saison ? sectionSaisonEnCours(saison) : sectionSansSaison()}
      ${sectionArchives(store.archives())}
    </div>`,
  };
});

action('saisons.cloturer', () => {
  confirmer({
    titre: 'Clôturer la saison ?',
    message: "Les statistiques seront archivées. Les matchs, entraînements et cartons seront remis à zéro pour la prochaine saison. L'effectif est conservé.",
    libelle: 'Clôturer',
    faire: () => {
      if (store.cloturerSaison()) {
        alerte('Saison clôturée ✓', 'Les statistiques ont été archivées. Vous pouvez créer une nouvelle saison.');
      }
    },
  });
});

action('saisons.menuArchive', (el) => {
  const id = el.dataset.id;
  choix({
    actions: [{
      libelle: 'Supprimer', role: 'detruire', icone: 'trash',
      faire: () => confirmer({
        titre: 'Supprimer cette archive ?',
        message: 'Cette action est irréversible. Les statistiques de cette saison seront définitivement perdues.',
        faire: () => store.supprimerArchive(id),
      }),
    }],
  });
});

// MARK: - Nouvelle saison

action('saisons.nouvelle', () => {
  // Pré-remplir avec la dernière archive
  const derniere = store.archives()[0]?.season;
  ouvrirFeuille('saisons.nouvelle', {
    brouillon: { clubName: derniere?.clubName ?? '', category: derniere?.category ?? '', startDate: M.iso() },
  });
});

definirPage('saisons.nouvelle', (p) => {
  const b = p.brouillon;
  return {
    titre: 'Nouvelle saison',
    gauche: boutonBarre({ libelle: 'Annuler', action: 'nav.fermer' }),
    droite: boutonBarre({ libelle: 'Créer', action: 'saisons.creer', gras: true, desactive: b.clubName.trim() === '' }),
    contenu: `<div class="colonne">${section({
      entete: 'Nouvelle saison',
      lignes: [
        champBrut({ valeur: b.clubName, placeholder: 'Nom du club', input: 'saisons.champ', attrs: 'data-champ="clubName" autocomplete="off"', cle: 'sn-club' }),
        champBrut({ valeur: b.category, placeholder: 'Catégorie (ex: U13, Seniors…)', input: 'saisons.champ', attrs: 'data-champ="category" autocomplete="off"', cle: 'sn-cat' }),
        `<label class="ligne ligne-champ avec-libelle" data-key="sn-date"><span class="ligne-titre">Date de début</span>
          <input class="champ" type="date" value="${h(valeurDate(b.startDate))}" data-change="saisons.date" aria-label="Date de début"></label>`,
      ],
      pied: "L'effectif actuel est conservé. Les matchs, entraînements et cartons repartiront à zéro.",
    })}</div>`,
  };
});

action('saisons.champ', (el) => { pageCourante().params.brouillon[el.dataset.champ] = el.value; });
action('saisons.date', (el) => {
  const b = pageCourante().params.brouillon;
  b.startDate = dateDepuisChamp(el.value, b.startDate);
});
action('saisons.creer', () => {
  const b = pageCourante().params.brouillon;
  if (b.clubName.trim() === '') return false;
  fermerFeuille();
  store.creerSaison(b.clubName.trim(), b.category.trim(), M.dateDe(b.startDate));
});

// MARK: - Détail d'une archive (ArchiveDetailView)

action('saisons.archive', (el) => ouvrirFeuille('saisons.archive', { id: el.dataset.id }));

const info = (libelle, valeur) => ligne({ titre: libelle, valeur });

definirPage('saisons.archive', (p) => {
  const a = store.archives().find((x) => x.id === p.id);
  if (!a) return { titre: 'Archive', gauche: '', droite: boutonBarre({ libelle: 'Fermer', action: 'nav.fermer' }), contenu: '' };
  const b = bilanArchive(a);
  const s = a.season;
  return {
    titre: s.clubName,
    gauche: '',
    droite: boutonBarre({ libelle: 'Fermer', action: 'nav.fermer' }),
    contenu: `<div class="colonne">
      ${section({
        entete: `Saison ${h(M.libelleSaison(s))}`,
        lignes: [
          info('Club', s.clubName),
          s.category ? info('Catégorie', s.category) : '',
          info('Début', M.formatDate(s.startDate, 'long')),
          s.endDate ? info('Fin', M.formatDate(s.endDate, 'long')) : '',
        ],
      })}
      ${section({
        entete: 'Statistiques',
        lignes: [
          info('Matchs joués', `${b.termines.length}`),
          info('Entraînements', `${a.trainingSessions.length}`),
          info('Joueurs', `${a.players.length}`),
          b.jaunes + b.rouges > 0 ? info('Cartons', `${b.jaunes} jaunes · ${b.rouges} rouges`) : '',
        ],
      })}
      ${b.termines.length ? section({
        entete: 'Bilan',
        lignes: [
          `<div class="ligne">${badgesStats([
            { libelle: 'V', valeur: b.victoires, couleur: 'green' },
            { libelle: 'N', valeur: b.nuls, couleur: 'orange' },
            { libelle: 'D', valeur: b.defaites, couleur: 'red' },
          ])}</div>`,
          info('Buts marqués', `${b.butsPour}`),
          info('Buts encaissés', `${b.butsContre}`),
          info('Différence', b.difference),
        ],
      }) : ''}
      ${a.players.length ? section({
        entete: `Effectif (${a.players.length})`,
        lignes: effectifParPoste(a.players).map((j) => `<div class="ligne" data-key="ap-${h(j.id)}">
          <span class="eff-poste-plein" style="background:${c(couleurPoste(j.position))}">${h(M.POSTE_COURT[j.position])}</span>
          <span class="ligne-textes"><span class="ligne-titre eff-petit-titre">${h(`${j.firstName} ${j.lastName}`)}</span></span>
        </div>`),
      }) : ''}
      ${b.termines.length ? section({
        entete: 'Matchs',
        lignes: [...b.termines].sort((x, y) => M.dateDe(y.date) - M.dateDe(x.date)).map((m) => {
          const r = resultat(m);
          return `<div class="ligne" data-key="am-${h(m.id)}">
            <span class="ligne-textes">
              <span class="ligne-titre gras eff-petit-titre">${h(m.homeTeam || 'DOM')} ${m.homeScore}-${m.awayScore} ${h(m.awayTeam || 'EXT')}</span>
              <span class="ligne-sous-titre">${h(M.formatDate(m.date, 'long'))}</span>
            </span>
            ${etiquette(r, COULEUR_RESULTAT[r])}
          </div>`;
        }),
      }) : ''}
    </div>`,
  };
});
