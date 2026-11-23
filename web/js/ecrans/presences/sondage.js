// Sondage de disponibilité (AvailabilityPollView) : lien collectif et liens individuels,
// envoi par SMS, WhatsApp ou partage, réponses reçues, joueurs sans réponse, application
// des réponses aux présences. En plus sur le web : « Coller une réponse reçue ».
import * as M from '../../model.js';
import { store } from '../../store.js';
import {
  definirPage, action, section, ligne, boutonBarre, icone, h, pastille, alerte, saisie, toast,
  partager, copier, ouvrirLien, lienWhatsApp, fermerFeuille, rafraichir,
} from '../../ui.js';
import { recevoirReponse } from '../../entrees.js';
import {
  telephoneCoach, joueursAvecTelephone, resumeSondage, reponsesTriees, dateRelative, lienSMSGroupe, triParNom,
} from './logique.js';
import { presencesMisesAJour } from './seance.js';

const estIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const COULEUR_STATUT = { 0: 'red', 1: 'green', 2: 'orange' };

let courant = null;

const nomEquipe = () => store.profilActif()?.name ?? 'Mon équipe';
const seanceDe = (p) => store.seances().find((s) => s.id === p.seanceId) ?? null;

/** Prépare le lien du sondage et un lien personnel par joueur (calcul asynchrone : compression) */
async function genererLiens(p) {
  const seance = seanceDe(p);
  const joueurs = store.joueurs();
  if (!seance || !joueurs.length) { p.genere = true; return; }
  const commun = { teamName: nomEquipe(), sessionId: seance.id, sessionDate: seance.date, coachPhone: telephoneCoach(store.roles(), store.encadrants()) };
  try {
    p.url = await M.lienSondage({ ...commun, players: joueurs });
    p.message = M.messageSondage({ teamName: commun.teamName, sessionDate: seance.date, location: seance.location, playerCount: joueurs.length, url: p.url });
    p.liens = {};
    for (const j of joueurs) {
      const url = await M.lienSondage({ ...commun, players: [j] });
      p.liens[j.id] = {
        url,
        message: M.messageSondageIndividuel({ teamName: commun.teamName, sessionDate: seance.date, location: seance.location, playerFirstName: j.firstName, url }),
      };
    }
  } catch {
    p.url = null;
  }
  p.genere = true;
  rafraichir();
}

function badge(nombre, libelle, couleur, ic) {
  return `<div class="badge-sondage"><span style="color:${M.couleur(couleur)}">${icone(ic)}</span><b>${nombre}</b><small>${h(libelle)}</small></div>`;
}

definirPage('presences.sondage', (p) => {
  courant = p;
  const seance = seanceDe(p);
  if (!seance) return { titre: 'Sondage disponibilité', contenu: '' };
  if (!p.init) {
    Object.assign(p, { init: true, genere: false, url: null, message: '', liens: {}, individuelsOuverts: false, envoyes: 0, total: 0, file: [] });
    genererLiens(p);
  }
  const joueurs = store.joueurs();
  const avecTel = joueursAvecTelephone(joueurs);
  const r = resumeSondage(seance, joueurs);
  const reponses = reponsesTriees(seance);

  // Résumé
  const resume = section({
    lignes: [`<div class="resume-sondage">
      <p class="resume-date">${h(M.formatDate(seance.date, 'full'))}</p>
      ${seance.location ? `<p class="resume-lieu">${icone('mappin.circle.fill')}${h(seance.location)}</p>` : ''}
      <div class="badges-sondage">
        ${badge(r.presents, 'Présents', 'green', 'checkmark.circle.fill')}
        ${badge(r.incertains, 'Incertains', 'orange', 'questionmark.circle.fill')}
        ${badge(r.absents, 'Absents', 'red', 'xmark.circle.fill')}
        ${badge(r.enAttente, 'En attente', 'gray', 'clock.fill')}
      </div>
    </div>`],
  });

  // Partager aux joueurs
  let lignesPartage;
  if (!joueurs.length) {
    lignesPartage = [ligne({
      icone: 'exclamationmark.triangle.fill', couleurIcone: 'orange', classe: 'avec-icone',
      contenu: '<span class="ligne-titre secondaire">Aucun joueur disponible</span><span class="ligne-sous-titre">Ajoutez des joueurs à cette catégorie pour créer un sondage.</span>',
    })];
  } else if (p.url) {
    lignesPartage = [
      ligne({
        icone: 'square.and.arrow.up.fill', couleurIcone: 'orange', action: 'sondage.partager', classe: 'avec-icone',
        contenu: '<span class="ligne-titre">Partager le sondage</span><span class="ligne-sous-titre">WhatsApp, SMS, Messages...</span>',
      }),
      avecTel.length ? ligne({
        icone: 'message.fill', couleurIcone: 'green', action: 'sondage.sms', classe: 'avec-icone',
        contenu: `<span class="ligne-titre">Envoyer par SMS</span><span class="ligne-sous-titre">${avecTel.length} joueur${M.pluriel(avecTel.length)} avec n° de téléphone</span>`,
      }) : '',
      ligne({
        icone: 'paperplane.fill', couleurIcone: 'green', action: 'sondage.whatsapp', classe: 'avec-icone',
        contenu: '<span class="ligne-titre">Envoyer par WhatsApp</span><span class="ligne-sous-titre">Groupe ou contact WhatsApp</span>',
      }),
      ligne({
        icone: 'doc.on.doc.fill', couleurIcone: 'blue', action: 'sondage.copier', classe: 'avec-icone',
        contenu: `<span class="ligne-titre">Copier le lien</span><span class="ligne-sous-titre une-ligne">${h(p.url)}</span>`,
      }),
    ];
  } else if (!p.genere) {
    lignesPartage = [`<div class="ligne"><span class="rouage"></span><span class="secondaire">Génération du lien...</span></div>`];
  } else {
    lignesPartage = [ligne({ titre: 'Impossible de créer le lien du sondage', classe: 'secondaire' })];
  }
  const sansTel = joueurs.length - avecTel.length;
  const piedPartage = avecTel.length
    ? (sansTel > 0 ? `${sansTel} joueur${M.pluriel(sansTel)} sans n° de téléphone — utilisez le partage classique pour les contacter.` : 'Tous les joueurs ont un n° de téléphone renseigné.')
    : "Partagez ce lien à vos joueurs. Ils pourront répondre depuis n'importe quel téléphone (iPhone ou Android).";
  const partage = section({ entete: 'Partager aux joueurs', lignes: lignesPartage, pied: h(piedPartage) });

  // Liens individuels
  let individuels = '';
  if (p.url) {
    const tries = triParNom(joueurs);
    const pied = p.envoyes > 0 && !p.file.length
      ? `✅ ${p.envoyes} SMS individuel${M.pluriel(p.envoyes)} envoyé${M.pluriel(p.envoyes)}`
      : p.file.length ? `📤 Envoi en cours : ${p.envoyes}/${p.total}…` : 'Chaque joueur reçoit un lien personnel et ne peut répondre que pour lui-même.';
    individuels = section({
      entete: 'Liens individuels',
      lignes: [
        avecTel.length ? ligne({
          icone: 'message.badge.filled.fill', couleurIcone: 'green', action: 'sondage.smsTous', classe: 'avec-icone',
          contenu: `<span class="ligne-titre">Envoyer à tous par SMS</span><span class="ligne-sous-titre">${avecTel.length} joueur${M.pluriel(avecTel.length)} — un SMS individuel par joueur</span>`,
        }) : '',
        `<button type="button" class="ligne tactile disclosure${p.individuelsOuverts ? ' ouvert' : ''}" data-action="sondage.individuels" data-key="disclosure-individuels">
          <span class="ligne-icone" style="color:var(--orange)">${icone('person.crop.circle.badge.checkmark')}</span>
          <span class="ligne-textes"><span class="ligne-titre">Envoi individuel</span><span class="ligne-sous-titre">Un lien unique par joueur (anti-usurpation)</span></span>
          <span class="chevron-disclosure">${icone('chevron.right')}</span>
        </button>`,
        p.individuelsOuverts ? tries.map((j) => `<div class="ligne lien-individuel" data-key="ind-${h(j.id)}">
          <span class="ligne-titre">${h(M.fullName(j))}</span>
          ${(j.phoneNumber ?? '').trim() ? `<button type="button" class="bouton-icone" style="color:var(--vert)" data-action="sondage.smsJoueur" data-id="${h(j.id)}" aria-label="SMS à ${h(M.fullName(j))}">${icone('message.fill')}</button>` : ''}
          <button type="button" class="bouton-icone" style="color:var(--orange)" data-action="sondage.partagerJoueur" data-id="${h(j.id)}" aria-label="Partager le lien de ${h(M.fullName(j))}">${icone('square.and.arrow.up')}</button>
        </div>`).join('') : '',
      ],
      pied: h(pied),
    });
  }

  // Réponse reçue (web)
  const coller = section({
    entete: 'Réponse reçue',
    lignes: [ligne({
      icone: 'arrow.up.doc.on.clipboard', couleurIcone: 'blue', action: 'presences.collerReponse', classe: 'avec-icone',
      contenu: '<span class="ligne-titre">Coller une réponse reçue</span><span class="ligne-sous-titre">Le message envoyé par le joueur</span>',
    })],
    pied: 'Le joueur vous renvoie sa réponse par SMS ou WhatsApp : copiez son message et collez-le ici pour l\'enregistrer.',
  });

  // Réponses reçues
  const sectionReponses = reponses.length ? section({
    entete: `Réponses (${reponses.length}/${joueurs.length})`,
    lignes: reponses.map((rep) => {
      const statut = M.reponse(rep.status);
      return `<div class="ligne ligne-reponse" data-key="rep-${h(rep.id)}">
        <span class="icone-statut" style="color:${M.couleur(COULEUR_STATUT[rep.status])}">${icone(statut.icone)}</span>
        <span class="ligne-textes">
          <span class="ligne-titre">${h(rep.playerName)}</span>
          ${rep.comment ? `<span class="ligne-sous-titre">${h(rep.comment)}</span>` : ''}
          <span class="date-relative">${h(dateRelative(rep.respondedAt))}</span>
        </span>
        ${pastille(statut.label, COULEUR_STATUT[rep.status])}
      </div>`;
    }),
  }) : '';

  // Sans réponse (le rappel par notification n'existe pas sur le web)
  const repondus = new Set(reponses.map((x) => x.id));
  const sans = triParNom(joueurs.filter((j) => !repondus.has(j.id)));
  const sectionSans = r.enAttente > 0 ? section({
    entete: `Sans réponse (${r.enAttente})`,
    lignes: sans.map((j) => `<div class="ligne ligne-reponse" data-key="sans-${h(j.id)}">
      <span class="icone-statut" style="color:var(--gris)">${icone('clock.fill')}</span>
      <span class="ligne-textes"><span class="ligne-titre secondaire">${h(M.fullName(j))}</span></span>
      <span class="en-attente">En attente</span>
    </div>`),
  }) : '';

  const appliquer = reponses.length ? section({
    lignes: [ligne({
      icone: 'checkmark.rectangle.stack.fill', couleurIcone: 'green', action: 'sondage.appliquer', classe: 'avec-icone',
      contenu: '<span class="ligne-titre gras">Appliquer aux présences</span><span class="ligne-sous-titre">Les joueurs « Présent » seront pointés présents</span>',
    })],
    pied: 'Ceci modifiera les présences de cet entraînement en fonction des réponses reçues. Vous pourrez toujours ajuster manuellement ensuite.',
  }) : '';

  return {
    titre: 'Sondage disponibilité',
    gauche: boutonBarre({ libelle: 'Fermer', action: 'nav.fermer' }),
    contenu: `<div class="colonne">${resume}${partage}${individuels}${coller}${sectionReponses}${sectionSans}${appliquer}</div>`,
  };
});

// MARK: - Envois

action('sondage.partager', () => {
  if (courant?.message) partager({ texte: courant.message });
  return false;
});

action('sondage.sms', () => {
  if (!courant?.message) return false;
  const numeros = joueursAvecTelephone(store.joueurs()).map((j) => j.phoneNumber);
  ouvrirLien(lienSMSGroupe(numeros, courant.message, estIOS()));
  return false;
});

action('sondage.whatsapp', () => {
  if (courant?.message) ouvrirLien(lienWhatsApp(courant.message));
  return false;
});

action('sondage.copier', async () => {
  if (!courant?.url) return;
  if (await copier(courant.url)) toast('📋 Lien copié !');
});

action('sondage.individuels', () => { if (courant) courant.individuelsOuverts = !courant.individuelsOuverts; });

action('sondage.partagerJoueur', (el) => {
  const l = courant?.liens?.[el.dataset.id];
  if (l) partager({ texte: l.message });
  return false;
});

action('sondage.smsJoueur', (el) => {
  const j = store.joueurs().find((x) => x.id === el.dataset.id);
  const l = courant?.liens?.[el.dataset.id];
  if (j && l) ouvrirLien(lienSMSGroupe([j.phoneNumber], l.message, estIOS()));
  return false;
});

/** Envoi groupé : un SMS individuel par joueur, l'un après l'autre (chaque envoi est confirmé) */
function smsSuivant() {
  const p = courant;
  if (!p || !p.file.length) { rafraichir(); return; }
  const j = p.file[0];
  alerte(`SMS ${p.envoyes + 1}/${p.total}`, `${M.fullName(j)} — ${j.phoneNumber}`, [
    { libelle: 'Arrêter', role: 'annuler', faire: () => { p.file = []; rafraichir(); } },
    {
      libelle: 'Ouvrir le SMS',
      faire: () => {
        p.file.shift();
        p.envoyes += 1;
        const l = p.liens[j.id];
        if (l) ouvrirLien(lienSMSGroupe([j.phoneNumber], l.message, estIOS()));
        setTimeout(smsSuivant, 600);
      },
    },
  ]);
}

action('sondage.smsTous', () => {
  const p = courant;
  if (!p) return;
  p.file = triParNom(joueursAvecTelephone(store.joueurs()));
  p.envoyes = 0;
  p.total = p.file.length;
  smsSuivant();
});

// MARK: - Réponses

action('sondage.appliquer', () => {
  const p = courant;
  const seance = p && seanceDe(p);
  if (!seance) return;
  const maj = M.applyResponsesToAttendance(structuredClone(seance), store.tousLesJoueurs());
  presencesMisesAJour(maj);
  store.majSeance(maj);
  fermerFeuille('presences.sondage');
});

/** Colle une réponse reçue (presse-papiers, sinon champ de saisie) */
export async function collerReponse() {
  let texte = '';
  try { texte = await navigator.clipboard.readText(); } catch { texte = ''; }
  if (texte && M.lireReponseSondage(texte)) { recevoirReponse(texte); return; }
  saisie({
    titre: 'Coller une réponse reçue',
    message: 'Collez ici le message envoyé par le joueur.',
    champs: [{ nom: 'texte', placeholder: 'Message ou lien de réponse' }],
    valider: 'Importer',
    faire: (v) => recevoirReponse(v.texte ?? ''),
  });
}

action('presences.collerReponse', () => { collerReponse(); return false; });
