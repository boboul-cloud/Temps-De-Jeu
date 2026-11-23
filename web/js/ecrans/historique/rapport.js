// Rapport de match détaillé (MatchReportView de MatchHistoryView.swift), ouvert en feuille
// depuis l'historique : résumé, arrêts par type et par période, buts, passes décisives,
// temps de jeu par joueur, remplacements. Aperçu et partage du rapport PDF.
import { store } from '../../store.js';
import * as M from '../../model.js';
import {
  definirPage, action, boutonBarre, vide, icone, h, apercuPDF, partager, etat as etatUI,
} from '../../ui.js';
import { genererPDFMatch, titreRapport, nomFichierRapport } from '../../rapports/match.js';

const couleurPoste = { Gardien: 'orange', Défenseur: 'blue', Milieu: 'green', Attaquant: 'red' };

/** En-tête de section (SectionHeader) : pictogramme vert + titre */
export const enteteSection = (titre, ic) =>
  `<div class="hist-entete-section"><span class="hist-entete-icone">${icone(ic)}</span><b>${h(titre)}</b></div>`;

/** StatBox : valeur colorée en chasse fixe, titre en dessous */
export const statBox = (titre, valeur, couleur) =>
  `<div class="hist-statbox" style="--c:${M.couleur(couleur)}"><b>${h(valeur)}</b><small>${h(titre)}</small></div>`;

/** Anneau du temps effectif (Circle().trim) */
function anneau(ratio, pourcentage) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const plein = Math.max(0, Math.min(1, ratio)) * c;
  return `<div class="hist-anneau">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="${r}" class="fond"/>
      <circle cx="60" cy="60" r="${r}" class="plein" stroke-dasharray="${plein.toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 60 60)"${plein <= 0 ? ' style="display:none"' : ''}/>
    </svg>
    <span><b>${pourcentage}%</b><small>Effectif</small></span>
  </div>`;
}

const nomDomicile = (m) => (m.homeTeam === '' ? 'Domicile' : m.homeTeam);
const nomExterieur = (m) => (m.awayTeam === '' ? 'Extérieur' : m.awayTeam);

/** Corps du rapport (reportContent) */
export function contenuRapport(m) {
  const marque = '<span class="hist-mon-equipe">Mon équipe</span>';
  const duree = M.totalMatchDuration(m);
  const ratio = duree > 0 ? M.totalEffectivePlayTime(m) / duree : 0;
  const pct = Math.trunc(M.effectivePercentage(m));

  // En-tête
  let html = `<div class="hist-rapport-entete">
    <div class="hist-equipes grand">
      <span class="hist-equipe"><b>${h(nomDomicile(m))}</b>${m.isMyTeamHome ? marque : ''}</span>
      <span class="hist-score">${m.homeScore} - ${m.awayScore}</span>
      <span class="hist-equipe droite"><b>${h(nomExterieur(m))}</b>${m.isMyTeamHome ? '' : marque}</span>
    </div>
    ${m.competition !== '' ? `<p class="hist-competition-titre">${h(m.competition)}</p>` : ''}
    <p class="hist-date">${h(M.formatDate(m.date, 'long'))}</p>
  </div>`;

  // Résumé
  html += `<section class="hist-carte">
    ${enteteSection('Résumé', 'chart.pie.fill')}
    ${anneau(ratio, pct)}
    <div class="hist-statboxes">
      ${statBox('Durée totale', M.formatTime(duree), 'blue')}
      ${statBox('Jeu effectif', M.formatTime(M.totalEffectivePlayTime(m)), 'green')}
      ${statBox('Arrêts', M.formatTime(M.totalStoppageTime(m)), 'red')}
    </div>
  </section>`;

  // Par type d'arrêt
  const libDom = m.homeTeam === '' ? 'DOM' : m.homeTeam;
  const libExt = m.awayTeam === '' ? 'EXT' : m.awayTeam;
  html += `<section class="hist-carte">${enteteSection("Par type d'arrêt", 'list.bullet.rectangle.fill')}
    ${M.ARRETS.filter((a) => M.stoppageCount(m, a.id) > 0).map((a) => {
      const nDom = M.stoppageCount(m, a.id, 'home');
      const nExt = M.stoppageCount(m, a.id, 'away');
      return `<div class="hist-type">
        <div class="hist-type-ligne">
          <span class="hist-type-icone" style="color:${M.couleur(a.couleur)}">${icone(a.icone)}</span>
          <span class="hist-type-nom">${h(a.id)}</span>
          <span class="hist-type-nombre">${M.stoppageCount(m, a.id)}x</span>
          <span class="hist-type-temps" style="color:${M.couleur(a.couleur)}">${h(M.formatShort(M.totalTimeFor(m, a.id)))}</span>
        </div>
        ${nDom > 0 || nExt > 0 ? `<div class="hist-type-equipes">
          ${nDom > 0 ? `<span class="hist-puce dom">${h(libDom)} <i>${nDom}</i></span>` : ''}
          ${nExt > 0 ? `<span class="hist-puce ext">${h(libExt)} <i>${nExt}</i></span>` : ''}
        </div>` : ''}
      </div>`;
    }).join('')}
  </section>`;

  // Par période
  html += `<section class="hist-carte">${enteteSection('Par période', 'clock.fill')}
    ${M.PERIODES.filter((p) => m.periodDurations[p] != null).map((p) => `<div class="hist-periode">
      <span class="hist-periode-nom">${h(M.PERIODE_COURTE[p])}</span>
      <span class="hist-periode-textes"><span>Effectif: ${h(M.formatTime(M.effectivePlayTime(m, p)))}</span>
        <small>Arrêts: ${h(M.formatTime(M.totalStoppageTime(m, p)))}</small></span>
      <span class="hist-periode-duree">${h(M.formatTime(m.periodDurations[p]))}</span>
    </div>`).join('')}
  </section>`;

  // Buts
  if (m.goals.length) {
    const mesButs = m.goals.filter((g) => g.isHome === m.isMyTeamHome && g.playerName !== '');
    const buteurs = grouper(mesButs, (g) => g.playerName);
    html += `<section class="hist-carte">${enteteSection(`Buts (${m.homeScore} - ${m.awayScore})`, 'soccerball')}
      ${m.goals.map((g) => {
        const moi = g.isHome === m.isMyTeamHome;
        return `<div class="hist-but">
          <span class="hist-minute">${Math.trunc(g.minute / 60)}'</span>
          <span class="hist-but-icone" style="color:${moi ? 'var(--vert)' : 'var(--rouge)'}">${icone('soccerball')}</span>
          <span class="hist-but-textes"><b class="${moi ? '' : 'secondaire'}">${h(g.isHome ? nomDomicile(m) : nomExterieur(m))}</b>
            ${g.playerName !== '' ? `<small>${h(g.playerName)}</small>` : ''}</span>
          <span class="hist-puce periode">${h(M.PERIODE_COURTE[g.period])}</span>
        </div>`;
      }).join('')}
      ${buteurs.length ? `<div class="hist-separateur"></div>
        <div class="hist-buteurs"><small>Buteurs mon équipe</small>
          ${buteurs.map((b) => `<div class="hist-buteur"><span>${h(b.nom)}</span><b>${b.liste.length} but${b.liste.length > 1 ? 's' : ''}</b></div>`).join('')}
        </div>` : ''}
    </section>`;
  }

  // Passes décisives
  if (m.assists.length) {
    html += `<section class="hist-carte">${enteteSection(`Passes décisives (${m.assists.length})`, 'hand.point.up.fill')}
      ${grouper(m.assists, (a) => a.playerName).map((p) => `<div class="hist-passeur">
        <span class="hist-passeur-icone">${icone('hand.point.up.fill')}</span>
        <b>${h(p.nom)}</b>
        <span class="hist-passeur-minutes">${p.liste.map((a) => `<span class="hist-puce minute">${Math.trunc(a.minute / 60)}'</span>`).join('')}</span>
        <span class="hist-passeur-nombre">${p.liste.length}</span>
      </div>`).join('')}
    </section>`;
  }

  // Temps de jeu
  const temps = M.playerPlayingTimes(m);
  if (temps.length) {
    html += `<section class="hist-carte">${enteteSection('Temps de jeu', 'person.crop.circle.badge.clock')}
      ${temps.map((pt) => `<div class="hist-joueur">
        <span class="hist-numero" style="background:${M.couleur(couleurPoste[pt.position])}">#${pt.shirtNumber}</span>
        <span class="hist-joueur-textes"><b>${h(pt.playerName)}</b>
          <small>${h(M.POSTE_COURT[pt.position])}${pt.isTitulaire ? ' <span class="hist-tit">TIT</span>' : ''}</small></span>
        <span class="hist-joueur-temps"><b>${h(M.formatTime(pt.totalTime))}</b><small>eff. ${h(M.formatTime(pt.effectiveTime))}</small></span>
      </div>`).join('')}
    </section>`;
  }

  // Remplacements
  if (m.substitutions.length) {
    html += `<section class="hist-carte">${enteteSection('Remplacements', 'arrow.left.arrow.right')}
      ${m.substitutions.map((s, i) => `${i > 0 ? '<div class="hist-separateur"></div>' : ''}<div class="hist-remplacement">
        <span class="hist-rempl-minute">${h(M.formatMatchMinute(s.minute, M.dureeReglementaire(s.period)))}</span>
        <span class="hist-rempl-textes">
          <span class="entre-joueur"><span style="color:var(--vert)">${icone('arrow.up.circle.fill')}</span><b>${h(s.playerIn)}</b></span>
          <span class="sort-joueur"><span style="color:var(--rouge)">${icone('arrow.down.circle.fill')}</span><small>${h(s.playerOut)}</small></span>
        </span>
        <span class="hist-puce gris">${h(M.PERIODE_COURTE[s.period])}</span>
      </div>`).join('')}
    </section>`;
  }
  return html;
}

/** Regroupe par nom, trié par nombre décroissant (ordre d'apparition à égalité) */
function grouper(liste, cle) {
  const g = new Map();
  for (const x of liste) { const k = cle(x); if (!g.has(k)) g.set(k, []); g.get(k).push(x); }
  return [...g.entries()].map(([nom, l], rang) => ({ nom, liste: l, rang }))
    .sort((a, b) => (b.liste.length - a.liste.length) || (a.rang - b.rang));
}

function matchOuvert() {
  const f = etatUI.feuilles.findLast((x) => x.page === 'historique.rapport');
  return f ? store.matchs().find((m) => m.id === f.params.matchId) ?? null : null;
}

definirPage('historique.rapport', (params) => {
  const m = store.matchs().find((x) => x.id === params.matchId);
  if (!m) return { titre: '', contenu: vide({ icone: 'clock.arrow.circlepath', titre: 'Match introuvable' }) };
  return {
    titre: '',
    gauche: `${boutonBarre({ icone: 'doc.richtext', titre: 'Aperçu du rapport PDF', action: 'historique.rapportPDF' })}
      ${boutonBarre({ icone: 'square.and.arrow.up', titre: 'Partager le rapport PDF', action: 'historique.rapportPartager' })}`,
    droite: boutonBarre({ libelle: 'Fermer', action: 'nav.fermer' }),
    classe: 'hist-rapport',
    contenu: `<div class="colonne">${contenuRapport(m)}</div>`,
  };
});

action('historique.rapportPDF', () => {
  const m = matchOuvert();
  if (!m) return false;
  const titre = `Rapport ${titreRapport(m)}`;
  apercuPDF(genererPDFMatch(m), `${titre.replaceAll(' ', '_')}.pdf`, titre);
  return false;
});

action('historique.rapportPartager', () => {
  const m = matchOuvert();
  if (!m) return false;
  partager({ fichiers: [{ nom: nomFichierRapport(m), contenu: genererPDFMatch(m), type: 'application/pdf' }] });
  return false;
});
