// PDF de l'encadrement (ExportService.generateStaffPDF) : même mise en page que l'app iPhone.
// Les pictogrammes 📞 et ✉️ (absents des polices standard du PDF) deviennent « Tél. » et rien.
import * as M from '../model.js';
import { DocumentPDF, mesurer } from '../pdf.js';

const GRIS = [0.56, 0.56, 0.58];
const GRIS_FONCE = [1 / 3, 1 / 3, 1 / 3];
const GRIS_CLAIR = [2 / 3, 2 / 3, 2 / 3];
const VERT = [0.204, 0.78, 0.349];
const BLEU = [0, 0.478, 1];
const GRIS4 = [0.82, 0.82, 0.84];

/**
 * @param {object[]} encadrants  encadrants de la catégorie active
 * @param {object[]} roles       rôles (ordre de l'app)
 * @param {object|null} profilActif
 * @param {object[]} profils     toutes les catégories
 * @param {Date} maintenant
 * @returns {Uint8Array}
 */
export function genererPDFEncadrement(encadrants, roles, profilActif, profils, maintenant = new Date()) {
  const largeurPage = 595;
  const hauteurPage = 842;
  const marge = 40;
  const largeurUtile = largeurPage - 2 * marge;
  const parNom = (a, b) => M.comparer(a.lastName, b.lastName);

  // Grouper par rôle
  const connus = new Set(roles.map((r) => r.id));
  const groupes = [];
  for (const role of roles) {
    const membres = encadrants.filter((s) => s.roleId === role.id).sort(parNom);
    if (membres.length) groupes.push({ nomRole: role.name, membres });
  }
  const orphelins = encadrants.filter((s) => !connus.has(s.roleId)).sort(parNom);
  if (orphelins.length) groupes.push({ nomRole: 'Autre', membres: orphelins });

  const doc = new DocumentPDF({ titre: 'Encadrement' });
  let y = 0;
  const nouvellePage = () => { doc.nouvellePage(); y = marge; };
  const assurer = (hauteur) => { if (y + hauteur > hauteurPage - marge) nouvellePage(); };
  const trait = () => doc.ligne(marge, y, marge + largeurUtile, y, { couleur: 'lightGray', epaisseur: 0.5 });
  const dateLongue = M.formatDate(maintenant, 'long');

  nouvellePage();
  doc.texte('Encadrement - Temps De Jeu', marge, y, { taille: 24, gras: true, couleur: 'noir' });
  y += 40;
  if (profilActif?.name) {
    doc.texte(`Catégorie : ${profilActif.name}`, marge, y, { taille: 14, couleur: GRIS });
    y += 22;
  }
  doc.texte(`Exporté le ${dateLongue}`, marge, y, { taille: 12, couleur: GRIS });
  y += 30;
  const nbRoles = new Set(encadrants.map((s) => s.roleId)).size;
  doc.texte(`${encadrants.length} encadrant${M.pluriel(encadrants.length)} · ${nbRoles} rôle${M.pluriel(nbRoles)}`, marge, y, { taille: 14, couleur: GRIS_FONCE });
  y += 20;
  trait();
  y += 15;

  for (const groupe of groupes) {
    assurer(50);
    doc.texte(groupe.nomRole, marge, y, { taille: 14, gras: true, couleur: VERT });
    y += 22;
    for (const s of groupe.membres) {
      const hauteur = s.phone === '' && s.email === '' ? 30 : 48;
      assurer(hauteur);
      const taillePhoto = 36;
      if (s.photoData) {
        doc.image(s.photoData, marge + 4, y, taillePhoto, taillePhoto, { rond: true });
      } else {
        doc.cercle(marge + 4 + taillePhoto / 2, y + taillePhoto / 2, taillePhoto / 2, { remplissage: GRIS4 });
        const initiale = ([...s.firstName][0] ?? '').toUpperCase();
        const l = mesurer(initiale, 16, true);
        doc.texte(initiale, marge + 4 + taillePhoto / 2 - l / 2, y + taillePhoto / 2 - 16 * 0.6, { taille: 16, gras: true, couleur: 'blanc' });
      }
      const x = marge + 48;
      doc.texte(M.nomEncadrant(s), x, y + 2, { taille: 13, gras: true, couleur: 'noir' });
      const contact = [];
      if (s.phone !== '') contact.push(`Tél. ${s.phone}`);
      if (s.email !== '') contact.push(s.email);
      if (contact.length) doc.texte(contact.join('   '), x, y + 20, { taille: 11, couleur: BLEU });
      const noms = profils.filter((p) => s.profileIds.includes(p.id)).map((p) => p.name);
      if (noms.length > 1) {
        doc.texte(`Catégories : ${noms.join(', ')}`, x, contact.length ? y + 35 : y + 20, { taille: 11, couleur: GRIS_FONCE });
        y += contact.length ? 56 : 44;
      } else {
        y += hauteur;
      }
    }
    y += 5;
    trait();
    y += 10;
  }

  assurer(40);
  y += 30;
  trait();
  y += 10;
  doc.texte(`Temps De Jeu · ${dateLongue}`, marge, y, { taille: 9, couleur: GRIS_CLAIR });
  return doc.octets();
}
