// Atelier — une séance (port d'AtelierPlanView.swift) : des exercices minutés dans l'ordre, le
// matériel total à prévoir, les équipes (chasubles) composées avec les présents du jour, et la
// fiche PDF à imprimer. Enregistrée au fur et à mesure (store.enregistrerPlan).
//
// Pages : 'atelier.seance' { planId } (poussée dans la feuille de la bibliothèque, ou en feuille),
//         'atelier.seance.exercices' { planId } (AtelierExercisePicker),
//         'atelier.seance.equipes' { planId } (AtelierTeamsPage).
import { store } from '../../store.js';
import * as M from '../../model.js';
import {
  definirPage, action, pousser, retour, fermerFeuille, ouvrirFeuille, pageExiste, pageCourante, etat as etatUI,
  h, icone, section, ligne, champ, interrupteur, bouton, boutonBarre, vide, choix, alerte, partager, apercuPDF,
  valeurDateHeure, dateDepuisChamp,
} from '../../ui.js';
import { diagrammeHTML } from './diagramme.js';
import { minutesParDefaut } from './editeur-modele.js';
import { ficheSeancePDF, nomFichierFiche } from '../../rapports/atelier.js';
import { ligneMateriel } from './editeur.js';

const trouverPlan = (id) => store.plans().find((p) => p.id === id) ?? null;

/** Modifie la séance puis l'enregistre */
function modifierPlan(id, changement) {
  const plan = trouverPlan(id);
  if (!plan) return;
  changement(plan);
  store.enregistrerPlan(plan);
}

/** Exercices de la séance trouvés dans l'Atelier : [[item, tactique]] */
const exercicesDe = (plan) => plan.exercices.map((i) => [i, store.tactique(i.exercice)]).filter(([, t]) => t);

/** Quitte une page de la séance : retour dans la pile, ou fermeture si elle est seule dans sa feuille */
function quitter(page) {
  const f = etatUI.feuilles[etatUI.feuilles.length - 1];
  if (f && f.page === page && f.pile.length === 0) fermerFeuille(page);
  else retour();
}

function ouvrirCinema(t, palette) {
  if (!pageExiste('lecteur.3d')) { alerte('Mode cinéma', "Le lecteur 3D n'est pas disponible."); return; }
  ouvrirFeuille('lecteur.3d', { tactique: t, palette, cinema: true }, { plein: true });
}

// MARK: - Une équipe : pastille de chasuble et joueurs (TeamRow)

function ligneEquipe(e) {
  const css = M.couleurAtelier(e.color)?.css ?? '#fff';
  return `<div class="ligne seance-equipe">
    <span class="materiel-maillot" style="color:${css}">${icone('tshirt.fill')}</span>
    <span class="ligne-textes">
      <span class="ligne-titre gras petit-titre">Chasubles ${h(M.adjectifCouleur(e.color, true, true))} · ${e.players.length}</span>
      <span class="ligne-sous-titre">${h(e.players.length ? e.players.join(', ') : '—')}</span>
    </span>
  </div>`;
}

// MARK: - La séance

definirPage('atelier.seance', (p) => {
  const plan = trouverPlan(p.planId);
  if (!plan) {
    return { titre: 'Séance', contenu: vide({ icone: 'calendar', titre: 'Séance introuvable', message: 'Elle a peut-être été supprimée.' }) };
  }
  const exercices = exercicesDe(plan);
  const manquants = plan.exercices.length - exercices.length;
  const reordonner = Boolean(p.reordonner);

  // Programme
  let debut = 0;
  const lignesProgramme = plan.exercices.map((item, index) => {
    const t = store.tactique(item.exercice);
    const depart = debut;
    debut += item.minutes;
    const ordre = reordonner ? `<span class="seance-ordre">
        <button type="button" class="ed-bouton-rond" data-action="seance.deplacer" data-index="${index}" data-sens="-1" ${index === 0 ? 'disabled' : ''} aria-label="Monter">${icone('chevron.up')}</button>
        <button type="button" class="ed-bouton-rond" data-action="seance.deplacer" data-index="${index}" data-sens="1" ${index === plan.exercices.length - 1 ? 'disabled' : ''} aria-label="Descendre">${icone('chevron.down')}</button>
      </span>` : '';
    if (!t) {
      return `<div class="ligne seance-manquant" data-key="item-${h(item.id)}">
        <span class="ligne-icone" style="color:var(--texte-2)">${icone('exclamationmark.triangle')}</span>
        <span class="ligne-textes"><span class="ligne-titre secondaire">Exercice supprimé</span></span>
        ${ordre}${bouton({ libelle: 'Retirer', style: 'detruire', petit: true, action: 'seance.retirer', data: { id: item.id } })}
      </div>`;
    }
    return `<div class="ligne seance-exercice" data-key="item-${h(item.id)}">
      <button type="button" class="seance-vignette" data-action="seance.cinema" data-id="${h(t.id)}" aria-label="Cinéma : ${h(t.titre)}">
        ${diagrammeHTML(t, { rotation: false, classe: 'seance-schema', cle: `seance-${item.id}` })}
        <span class="seance-lecture">${icone('play.circle.fill')}</span>
      </button>
      <span class="ligne-textes seance-textes">
        <span class="ligne-titre gras">${index + 1}. ${h(t.titre)}</span>
        <span class="ligne-sous-titre chiffres">${depart}′ → ${depart + item.minutes}′</span>
        <span class="seance-minutes">
          <span class="chiffres">${item.minutes} min</span>
          <span class="stepper">
            <button type="button" data-action="seance.minutes" data-id="${h(item.id)}" data-pas="-1" ${item.minutes <= 5 ? 'disabled' : ''} aria-label="Moins">${icone('minus')}</button>
            <button type="button" data-action="seance.minutes" data-id="${h(item.id)}" data-pas="1" ${item.minutes >= 90 ? 'disabled' : ''} aria-label="Plus">${icone('plus')}</button>
          </span>
        </span>
        <input class="champ seance-note" type="text" value="${h(item.note)}" placeholder="Note (facultatif)" data-input="seance.note" data-id="${h(item.id)}" data-key="note-${h(item.id)}" autocomplete="off" aria-label="Note">
        <span class="seance-actions">
          ${bouton({ libelle: 'Cinéma', icone: 'film.stack', style: 'teinte', petit: true, couleur: 'purple', action: 'seance.cinema', data: { id: t.id } })}
          ${t.perso ? bouton({ libelle: "Modifier l'exercice", icone: 'pencil', style: 'teinte', petit: true, action: 'seance.modifierExercice', data: { id: t.id } }) : ''}
          ${bouton({ libelle: 'Retirer', icone: 'minus.circle', style: 'detruire', petit: true, action: 'seance.retirer', data: { id: item.id } })}
        </span>
      </span>
      ${ordre}
    </div>`;
  });
  lignesProgramme.push(ligne({ titre: 'Ajouter un exercice', icone: 'plus.circle.fill', action: 'seance.ajouter', teinte: true, classe: 'avec-icone gras' }));

  let piedProgramme = '';
  if (manquants > 0) piedProgramme = `${manquants} exercice(s) supprimé(s) de l'Atelier : touchez « Retirer » pour les enlever.`;
  else if (plan.exercices.length) piedProgramme = 'Touchez le schéma pour le mode cinéma. « Réordonner » change l\'ordre des exercices.';

  // Matériel
  const lignesMateriel = M.combinerMateriel(exercices.map(([, t]) => M.materielExercice(t)), plan.simultane);

  // Équipes
  const lignesEquipes = plan.equipes.length
    ? [
      ...plan.equipes.map(ligneEquipe),
      ligne({ titre: 'Modifier les équipes', icone: 'arrow.triangle.2.circlepath', action: 'seance.equipes', teinte: true, classe: 'avec-icone' }),
      ligne({ titre: 'Envoyer les équipes aux joueurs', icone: 'square.and.arrow.up', action: 'seance.envoyerEquipes', teinte: true, classe: 'avec-icone' }),
    ]
    : [ligne({ titre: 'Faire les équipes avec les présents', icone: 'person.3.sequence.fill', action: 'seance.equipes', teinte: true, classe: 'avec-icone' })];

  return {
    classe: 'atelier-page',
    titre: plan.titre === '' ? 'Séance' : plan.titre,
    droite: plan.exercices.length > 1 || reordonner
      ? boutonBarre({ libelle: reordonner ? 'OK' : 'Réordonner', action: 'seance.reordonner', gras: reordonner }) : '',
    contenu: `<div class="colonne seance">
      ${section({
        entete: 'Séance',
        lignes: [
          champ({ valeur: plan.titre, placeholder: 'Nom de la séance', input: 'seance.titre', cle: 'seance-titre' }),
          interrupteur({ titre: 'Date et heure', actif: plan.date != null, action: 'seance.avecDate' }),
          plan.date != null ? champ({ libelle: 'Le', type: 'datetime-local', valeur: valeurDateHeure(plan.date), change: 'seance.date', cle: 'seance-date' }) : '',
          champ({ valeur: plan.notes, placeholder: "Thème (ex. : jeu vers l'avant)", multiligne: true, lignes: 1, input: 'seance.notes', cle: 'seance-notes' }),
        ],
        pied: `<span class="seance-enregistree">${icone('checkmark.circle')} Enregistrée au fur et à mesure, dans « Séances ».</span>`,
      })}
      ${section({
        entete: `<span>Programme</span><span class="droite seance-total chiffres">${M.minutesPlan(plan)} min</span>`,
        lignes: lignesProgramme,
        pied: piedProgramme,
      })}
      ${section({
        entete: 'Matériel à prévoir',
        lignes: [
          interrupteur({
            titre: 'Ateliers montés en même temps', actif: plan.simultane, action: 'seance.simultane',
            sousTitre: plan.simultane ? "Le matériel de chaque exercice s'additionne." : "Le matériel sert d'un exercice à l'autre.",
          }),
          ...(lignesMateriel.length ? lignesMateriel.map(ligneMateriel)
            : [ligne({ contenu: '<span class="ligne-titre secondaire">Ajoutez des exercices : la liste se fera toute seule.</span>' })]),
        ],
      })}
      ${section({
        entete: 'Équipes',
        lignes: lignesEquipes,
        pied: 'Les joueurs pointés présents (onglet Présences) sont répartis par chasuble, un gardien et des postes équilibrés dans chaque équipe.',
      })}
      ${section({
        lignes: [ligne({ titre: 'Fiche de séance à imprimer (PDF)', icone: 'printer', action: 'seance.pdf', teinte: true, classe: 'avec-icone', desactive: !exercices.length })],
        pied: 'Une page de garde (programme, matériel, équipes) puis une page par exercice avec son schéma.',
      })}
      ${section({
        lignes: [ligne({ titre: 'Supprimer la séance', icone: 'trash', action: 'seance.supprimer', detruire: true, classe: 'avec-icone' })],
        pied: 'Les exercices restent dans « Mes exercices ».',
      })}
    </div>`,
  };
});

const planCourant = () => pageCourante().params?.planId;

action('seance.titre', (el) => { modifierPlan(planCourant(), (p) => { p.titre = el.value; }); return false; });
action('seance.notes', (el) => { modifierPlan(planCourant(), (p) => { p.notes = el.value; }); return false; });
action('seance.avecDate', (el) => {
  modifierPlan(planCourant(), (p) => { if (el.checked) p.date ??= M.iso(); else delete p.date; });
});
action('seance.date', (el) => {
  if (!el.value) return;
  modifierPlan(planCourant(), (p) => { p.date = dateDepuisChamp(el.value); });
});
action('seance.simultane', (el) => { modifierPlan(planCourant(), (p) => { p.simultane = el.checked; }); });
action('seance.minutes', (el) => {
  modifierPlan(planCourant(), (p) => {
    const item = p.exercices.find((i) => i.id === el.dataset.id);
    if (item) item.minutes = Math.min(90, Math.max(5, item.minutes + 5 * Number(el.dataset.pas)));
  });
});
action('seance.note', (el) => {
  modifierPlan(planCourant(), (p) => {
    const item = p.exercices.find((i) => i.id === el.dataset.id);
    if (item) item.note = el.value;
  });
  return false;
});
action('seance.retirer', (el) => {
  modifierPlan(planCourant(), (p) => { p.exercices = p.exercices.filter((i) => i.id !== el.dataset.id); });
});
action('seance.deplacer', (el) => {
  modifierPlan(planCourant(), (p) => {
    const i = Number(el.dataset.index);
    const j = i + Number(el.dataset.sens);
    if (j < 0 || j >= p.exercices.length) return;
    const [x] = p.exercices.splice(i, 1);
    p.exercices.splice(j, 0, x);
  });
});
action('seance.reordonner', () => {
  const params = pageCourante().params;
  params.reordonner = !params.reordonner;
});
action('seance.cinema', (el) => {
  const t = store.tactique(el.dataset.id);
  if (t) ouvrirCinema(t, pageCourante().params?.palette);
});
action('seance.modifierExercice', (el) => {
  const t = store.tactique(el.dataset.id);
  if (t) ouvrirFeuille('editeur.atelier', { tactique: t }, { plein: true });
});
action('seance.ajouter', () => pousser('atelier.seance.exercices', { planId: planCourant() }));
action('seance.equipes', () => pousser('atelier.seance.equipes', { planId: planCourant() }));
action('seance.envoyerEquipes', () => {
  const plan = trouverPlan(planCourant());
  if (plan) partager({ titre: plan.titre, texte: M.texteEquipes(plan.equipes, plan.titre) });
  return false;
});
action('seance.pdf', () => {
  const plan = trouverPlan(planCourant());
  if (!plan) return;
  const exercices = exercicesDe(plan);
  if (!exercices.length) return;
  try {
    apercuPDF(ficheSeancePDF(plan, exercices), nomFichierFiche(plan.titre), 'Fiche de séance');
  } catch (err) {
    console.error(err);
    alerte('Fiche PDF', "La fiche n'a pas pu être créée.");
  }
});
action('seance.supprimer', () => {
  const id = planCourant();
  const plan = trouverPlan(id);
  if (!plan) return;
  choix({
    titre: 'Supprimer cette séance ?',
    message: plan.titre,
    actions: [{ libelle: 'Supprimer', role: 'detruire', faire: () => { store.supprimerPlan(id); quitter('atelier.seance'); } }],
  });
});

// MARK: - Choisir un exercice (AtelierExercisePicker)

const normaliser = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

definirPage('atelier.seance.exercices', (p) => {
  const q = normaliser((p.recherche ?? '').trim());
  const filtrer = (liste) => (q === '' ? liste : liste.filter((t) => normaliser(`${t.titre} ${t.objectif}`).includes(q)));
  const rangee = (t) => `<button type="button" class="ligne tactile seance-choix" data-action="seance.choisir" data-id="${h(t.id)}" data-key="choix-${h(t.id)}">
    ${diagrammeHTML(t, { rotation: false, classe: 'seance-schema-petit', cle: `choix-${t.id}` })}
    <span class="ligne-textes"><span class="ligne-titre gras">${h(t.titre)}</span><span class="ligne-sous-titre">${h(M.resumeTactique(t))}</span></span>
    <span class="seance-plus">${icone('plus.circle.fill')}</span>
  </button>`;
  const mes = filtrer(store.tactiquesPerso());
  const biblio = filtrer(store.bibliotheque);
  return {
    classe: 'atelier-page',
    titre: 'Ajouter un exercice',
    contenu: `<div class="colonne">
      <label class="recherche">${icone('magnifyingglass')}<input type="search" placeholder="Rechercher" value="${h(p.recherche ?? '')}" data-input="seance.recherche" data-key="seance-recherche" aria-label="Rechercher"></label>
      ${mes.length ? section({ entete: 'Mes exercices', lignes: mes.map(rangee) }) : ''}
      ${biblio.length ? section({ entete: 'Bibliothèque', lignes: biblio.map(rangee) }) : ''}
      ${!mes.length && !biblio.length ? vide({ icone: 'magnifyingglass', titre: 'Aucun résultat' }) : ''}
    </div>`,
  };
});

action('seance.recherche', (el) => { pageCourante().params.recherche = el.value; });
action('seance.choisir', (el) => {
  const id = pageCourante().params.planId;
  const t = store.tactique(el.dataset.id);
  if (!t) return;
  modifierPlan(id, (p) => { p.exercices.push(M.nouvelItemPlan(t.id, minutesParDefaut(t))); });
  retour();
});

// MARK: - Faire les équipes (AtelierTeamsPage)

const dateCourte = (iso) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(M.dateDe(iso));

function candidats(source, seances, joueurs) {
  const parId = new Map(joueurs.map((j) => [j.id, j]));
  if (source !== 'effectif') {
    const s = seances.find((x) => x.id === source);
    if (!s) return [];
    return s.attendances.filter((a) => a.isPresent).map((a) => {
      const j = parId.get(a.id);
      return { name: M.displayName(j ?? a), position: j?.position ?? 'Milieu' };
    });
  }
  return joueurs.filter((j) => j.availability === 'Disponible').map((j) => ({ name: M.displayName(j), position: j.position }));
}

definirPage('atelier.seance.equipes', (p) => {
  const plan = trouverPlan(p.planId);
  if (!plan) return { titre: 'Équipes', contenu: '' };
  const joueurs = store.joueurs();
  const seances = store.seances().sort((a, b) => M.dateDe(b.date) - M.dateDe(a.date));
  if (!p.charge) {
    p.charge = true;
    const derniere = seances[0];
    p.source = derniere && M.presentCount(derniere) > 0 ? derniere.id : 'effectif';
    const utilisees = plan.equipes.map((e) => e.color);
    if (utilisees.length) p.couleurs = utilisees;
    else {
      const depuisExercices = M.couleursEquipes(exercicesDe(plan).map(([, t]) => t));
      p.couleurs = depuisExercices.length >= 2 ? depuisExercices : ['rouge', 'bleu'];
    }
  }
  const liste = candidats(p.source, seances, joueurs);
  const disponibles = joueurs.filter((j) => j.availability === 'Disponible').length;
  const option = (valeur, texte) => ligne({
    titre: texte, action: 'equipes.source', data: { source: valeur },
    droite: p.source === valeur ? `<span class="seance-coche">${icone('checkmark')}</span>` : '',
  });
  const n = p.couleurs.length;
  return {
    classe: 'atelier-page',
    titre: 'Équipes',
    contenu: `<div class="colonne">
      ${section({
        entete: 'Avec qui ?',
        lignes: [
          ...seances.slice(0, 10).map((s) => option(s.id, `Présents le ${dateCourte(s.date)} (${M.presentCount(s)})`)),
          option('effectif', `Tout l'effectif disponible (${disponibles})`),
        ],
        pied: seances.length ? '' : "Pointez les présents dans l'onglet Présences pour composer les équipes avec eux.",
      })}
      ${section({
        entete: 'Couleurs des chasubles',
        lignes: [
          `<div class="ligne equipes-couleurs">${M.COULEURS_ATELIER.map((c) => {
            const on = p.couleurs.includes(c.id);
            return `<button type="button" class="equipes-couleur${on ? ' choisie' : ''}" data-action="equipes.couleur" data-couleur="${c.id}" aria-pressed="${on}">
              <span class="materiel-maillot" style="color:${c.css}">${icone('tshirt.fill')}</span><span>${h(M.nomCouleurAtelier(c.id))}</span></button>`;
          }).join('')}</div>`,
          ligne({ contenu: `<span class="ligne-sous-titre">${n} équipe${n > 1 ? 's' : ''} · ${liste.length} joueur${liste.length > 1 ? 's' : ''}</span>` }),
        ],
      })}
      ${section({
        lignes: [ligne({
          titre: plan.equipes.length ? 'Refaire le tirage' : 'Composer les équipes', icone: 'shuffle', action: 'equipes.composer',
          teinte: true, classe: 'avec-icone gras', desactive: n < 2 || !liste.length,
        })],
      })}
      ${plan.equipes.length ? section({
        entete: 'Équipes',
        lignes: [
          ...plan.equipes.map(ligneEquipe),
          ligne({ titre: 'Envoyer aux joueurs', icone: 'square.and.arrow.up', action: 'seance.envoyerEquipesDepuisEquipes', teinte: true, classe: 'avec-icone' }),
          ligne({ titre: 'Effacer les équipes', icone: 'trash', action: 'equipes.effacer', detruire: true, classe: 'avec-icone' }),
        ],
      }) : ''}
    </div>`,
  };
});

action('equipes.source', (el) => { pageCourante().params.source = el.dataset.source; });
action('equipes.couleur', (el) => {
  const p = pageCourante().params;
  const c = el.dataset.couleur;
  p.couleurs = p.couleurs.includes(c) ? p.couleurs.filter((x) => x !== c) : [...p.couleurs, c];
});
action('equipes.composer', () => {
  const p = pageCourante().params;
  const liste = candidats(p.source, store.seances(), store.joueurs());
  if (p.couleurs.length < 2 || !liste.length) return;
  modifierPlan(p.planId, (plan) => { plan.equipes = M.composerEquipes(liste, p.couleurs); });
});
action('equipes.effacer', () => {
  modifierPlan(pageCourante().params.planId, (plan) => { plan.equipes = []; });
});
action('seance.envoyerEquipesDepuisEquipes', () => {
  const plan = trouverPlan(pageCourante().params.planId);
  if (plan) partager({ titre: plan.titre, texte: M.texteEquipes(plan.equipes, plan.titre) });
  return false;
});
