// Logique d'Export / Import (ExportImportView.swift) sans interface : import de joueurs
// (fusionner / remplacer, routage par code ou nom de catégorie), Multigroop, noms de fichiers.
// Testable sous Node : reçoit le magasin (`store`) en paramètre, n'importe pas ui.js.
import * as M from '../../model.js';

/** « 2026-11-23 » (formattedDateForFile) */
export const dateFichier = (maintenant = new Date()) => M.formatDateMotif(maintenant, 'yyyy-MM-dd');

/** Nom de catégorie pour un fichier : espaces → « _ », « / » → « - » */
export const categoriePourFichier = (nom) => (nom ?? 'tous').replaceAll(' ', '_').replaceAll('/', '-');

export const nomFichierJoueurs = (profil, maintenant) =>
  `joueurs_${categoriePourFichier(profil?.name ?? 'tous')}_${dateFichier(maintenant)}.json`;
export const nomFichierMatchs = (profil, maintenant) =>
  `matchs_${categoriePourFichier(profil?.name ?? 'tous')}_${dateFichier(maintenant)}.tdjm`;
export const nomFichierSauvegarde = (maintenant) => `sauvegarde_temps_de_jeu_${dateFichier(maintenant)}.tdjb`;
export const nomFichierMultigroop = (maintenant) => `joueurs_multigroop_${dateFichier(maintenant)}.txt`;
/** Fichier partagé depuis l'aperçu PDF : titre, espaces → « _ » (PDFPreviewView) */
export const nomFichierPDF = (titre) => `${titre.replaceAll(' ', '_')}.pdf`;

/** Matchs terminés de la saison en cours (seasonFinishedMatches) */
export function matchsTerminesDeLaSaison(matchs, saison) {
  return matchs.filter((m) => {
    if (!m.isFinished) return false;
    if (!saison) return true;
    const d = M.dateDe(m.date);
    if (d < M.dateDe(saison.startDate)) return false;
    if (saison.endDate && d > M.dateDe(saison.endDate)) return false;
    return true;
  });
}

/** Texte « Nom Prénom;téléphone;catégorie » par joueur (exportForMultigroop) ; '' si aucun */
export function texteMultigroop(joueurs, profils) {
  const lignes = [];
  for (const j of joueurs) {
    const nom = `${j.firstName} ${j.lastName}`.trim();
    if (nom === '') continue;
    const categorie = profils.find((p) => p.id === j.homeCategoryId)?.name ?? '';
    lignes.push(`${nom};${j.phoneNumber ?? ''};${categorie}`);
  }
  return lignes.join('\n');
}

const ressembleATelephone = (s) => [...s].filter((c) => /\p{Nd}/u.test(c)).length >= 4;

/** Lit un fichier texte Multigroop (handleMultigroopImportResult) → joueurs (sans catégorie) */
export function lireMultigroop(texte) {
  const joueurs = [];
  for (const ligne of texte.split(/\r\n|[\r\n\u2028\u2029]/)) {
    if (ligne.trim() === '') continue;
    const sep = ligne.includes(';') ? ';' : ',';
    const champs = ligne.split(sep).map((c) => c.trim());
    if (champs.length < 2) continue;
    let firstName; let lastName; let phone;
    if (champs.length >= 3 && !ressembleATelephone(champs[1])) {
      [firstName, lastName, phone] = champs;          // Prénom;Nom;Téléphone
    } else {
      const i = champs[0].indexOf(' ');               // Nom;Téléphone;Catégorie (Multigroop)
      firstName = i < 0 ? champs[0] : champs[0].slice(0, i);
      lastName = i < 0 ? '' : champs[0].slice(i + 1);
      phone = champs[1];
    }
    joueurs.push(M.nouveauJoueur({ firstName, lastName, phoneNumber: phone === '' ? undefined : phone }));
  }
  return joueurs;
}

const normaliser = (p) => `${p.firstName.trim().toLowerCase()}_${p.lastName.trim().toLowerCase()}`;
/** localizedCaseInsensitiveCompare == .orderedSame : sans tenir compte de la casse (accents comptés) */
const memeNom = (a, b) => a.toLocaleLowerCase('fr') === b.toLocaleLowerCase('fr');

/** Message de confirmation de l'import de joueurs (confirmationDialog) */
export function messageImportJoueurs(store, { teamCode, teamName }) {
  if (teamCode) {
    const cible = store.profils.find((p) => p.teamCode.toUpperCase() === teamCode.toUpperCase());
    if (cible) return `Ces joueurs seront importés dans la catégorie « ${cible.name} » (code ${teamCode}).`;
  }
  if (teamName) {
    const existant = store.profils.find((p) => memeNom(p.name, teamName));
    if (existant) return `Ces joueurs seront importés dans la catégorie « ${existant.name} ».`;
    return `La catégorie « ${teamName} » sera créée automatiquement pour accueillir ces joueurs.`;
  }
  return 'Comment souhaitez-vous importer les joueurs ?';
}

/**
 * Applique l'import de joueurs (performImport). mode : 'merge' | 'replace'.
 * Bascule sur la catégorie visée (code, puis nom, sinon création). → { titre, message }
 */
export function importerJoueurs(store, { players, teamCode, teamName }, mode) {
  let cibleId = store.profilActifId;
  let trouve = false;
  if (teamCode) {
    const p = store.profils.find((x) => x.teamCode.toUpperCase() === teamCode.toUpperCase());
    if (p) { cibleId = p.id; trouve = true; }
  }
  if (!trouve && teamName) {
    const p = store.profils.find((x) => memeNom(x.name, teamName));
    if (p) cibleId = p.id;
    else cibleId = store.creerProfil(teamName, 0, [], teamCode ?? '').id;
    trouve = true;
  }
  if (cibleId && cibleId !== store.profilActifId) store.basculerProfil(cibleId);
  let joueurs = store.joueurs();
  const profil = store.profils.find((p) => p.id === cibleId);
  if (!profil) return { titre: 'Erreur', message: 'Impossible de trouver la catégorie cible.' };

  const global = store.tousLesJoueurs();
  if (mode === 'replace') {
    const nouveaux = [];
    for (const importe of players) {
      const local = joueurs.find((j) => normaliser(j) === normaliser(importe));
      if (local) {
        const g = global.find((x) => x.id === local.id);
        if (g) {
          g.position = importe.position;
          g.availability = importe.availability;
          if (g.photoData == null && importe.photoData) g.photoData = importe.photoData;
        }
        nouveaux.push(local);
      } else {
        const frais = M.nouveauJoueur({
          firstName: importe.firstName, lastName: importe.lastName, position: importe.position,
          availability: importe.availability, photoData: importe.photoData, homeCategoryId: profil.id,
        });
        global.push(frais);
        nouveaux.push(frais);
      }
    }
    store.enregistrerJoueursGlobal(global);
    store.majProfil({ ...profil, playerIds: [...new Set(nouveaux.map((j) => j.id))] });
    joueurs = nouveaux;
  } else {
    const parNom = new Map(joueurs.map((j, i) => [normaliser(j), i]));
    for (const importe of players) {
      const i = parNom.get(normaliser(importe));
      if (i != null) {
        const j = joueurs[i];
        j.position = importe.position;
        j.availability = importe.availability;
        if (j.photoData == null && importe.photoData) j.photoData = importe.photoData;
        const gi = global.findIndex((x) => x.id === j.id);
        if (gi >= 0) global[gi] = j;
      } else {
        const frais = M.nouveauJoueur({
          firstName: importe.firstName, lastName: importe.lastName, position: importe.position,
          availability: importe.availability, photoData: importe.photoData, homeCategoryId: profil.id,
        });
        global.push(frais);
        joueurs.push(frais);
        parNom.set(normaliser(importe), joueurs.length - 1);
      }
    }
    store.enregistrerJoueursGlobal(global);
    store.majProfil({ ...profil, playerIds: [...new Set(joueurs.map((j) => j.id))] });
  }
  const info = ` dans ${profil.name}`;
  return {
    titre: 'Import réussi',
    message: mode === 'replace'
      ? `${players.length} joueurs importés (remplacement)${info}.`
      : `Effectif mis à jour${info}. ${joueurs.length} joueurs au total.`,
  };
}

/** Applique l'import Multigroop (performMultigroopImport) dans la catégorie active → { titre, message } */
export function importerMultigroop(store, importes, mode, nomCategorie = null) {
  let profil;
  if (nomCategorie) {
    const p = store.profils.find((x) => memeNom(x.name, nomCategorie));
    profil = p ?? store.creerProfil(nomCategorie, 0, [], '');
    if (profil.id !== store.profilActifId) store.basculerProfil(profil.id);
  } else {
    profil = store.profilActif();
    if (!profil) return { titre: 'Erreur', message: 'Aucune catégorie active.' };
  }
  let joueurs = store.joueurs();
  const global = store.tousLesJoueurs();
  if (mode === 'replace') {
    const nouveaux = [];
    for (const importe of importes) {
      const local = joueurs.find((j) => normaliser(j) === normaliser(importe));
      if (local) {
        const g = global.find((x) => x.id === local.id);
        if (g && importe.phoneNumber) g.phoneNumber = importe.phoneNumber;
        nouveaux.push(local);
      } else {
        const frais = M.nouveauJoueur({ firstName: importe.firstName, lastName: importe.lastName, homeCategoryId: profil.id, phoneNumber: importe.phoneNumber });
        global.push(frais);
        nouveaux.push(frais);
      }
    }
    store.enregistrerJoueursGlobal(global);
    store.majProfil({ ...store.profils.find((p) => p.id === profil.id), playerIds: [...new Set(nouveaux.map((j) => j.id))] });
    joueurs = nouveaux;
  } else {
    const parNom = new Map(joueurs.map((j, i) => [normaliser(j), i]));
    for (const importe of importes) {
      const i = parNom.get(normaliser(importe));
      if (i != null) {
        const j = joueurs[i];
        if (importe.phoneNumber) j.phoneNumber = importe.phoneNumber;
        const gi = global.findIndex((x) => x.id === j.id);
        if (gi >= 0) global[gi] = j;
      } else {
        const frais = M.nouveauJoueur({ firstName: importe.firstName, lastName: importe.lastName, homeCategoryId: profil.id, phoneNumber: importe.phoneNumber });
        global.push(frais);
        joueurs.push(frais);
        parNom.set(normaliser(importe), joueurs.length - 1);
      }
    }
    store.enregistrerJoueursGlobal(global);
    store.majProfil({ ...store.profils.find((p) => p.id === profil.id), playerIds: [...new Set(joueurs.map((j) => j.id))] });
  }
  const info = ` dans ${profil.name}`;
  return {
    titre: 'Import réussi',
    message: mode === 'replace'
      ? `${importes.length} joueurs importés depuis Multigroop (remplacement)${info}.`
      : `Effectif mis à jour depuis Multigroop${info}. ${joueurs.length} joueurs au total.`,
  };
}

/** Message de confirmation d'une restauration (sauvegarde complète) */
export function messageRestauration(resultat) {
  return `Sauvegarde du ${M.formatDateHeure(resultat.backup.exportDate, 'long')}\n${M.resumeSauvegarde(resultat)}.\n\n⚠️ Cette action remplacera toutes les données actuelles de l'application.`;
}
