// ⚠️ VeVePreda/veve-sites — engine/lib/vitrine.mjs
// ═══════════════════════════════════════════════════════════════════════════
// LES ATOMES DE LA MAQUETTE — portés, pas réécrits
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ CHAQUE FONCTION ICI REND LE BALISAGE EXACT DE `maquette-veveprice.html`.
// Ce n'est pas un détail de méthode, c'est LA cause des sept passes ratées :
// je réécrivais des composants « dans l'esprit » de la maquette, avec mes
// propres noms de classes. Le CSS porté visait `.carte`, mon HTML disait
// `.piece` — donc les règles ne s'appliquaient à RIEN, en silence.
// Un comparateur l'a chiffré : 18,3 % de fidélité structurelle.
// ⛔ NE JAMAIS RENOMMER UNE CLASSE ICI. Le nom EST le contrat avec le thème.

// ⚠️ Les CLÉS de classe sont abrégées (`rar--secret`, pas `rar--secret_rare`) :
// c'est le vocabulaire du thème. Émettre `rarity.toLowerCase()` produisait
// `rar--secret_rare`, qui n'existe dans aucune feuille — les six couleurs de
// rareté étaient donc absentes du site depuis le début.
export const RAR = {
  COMMON:       { cl: 'rar--common',   l: 'Common',       mcp: 0.25 },
  UNCOMMON:     { cl: 'rar--uncommon', l: 'Uncommon',     mcp: 0.50 },
  RARE:         { cl: 'rar--rare',     l: 'Rare',         mcp: 2.00 },
  ULTRA_RARE:   { cl: 'rar--ultra',    l: 'Ultra Rare',   mcp: 3.00 },
  SECRET_RARE:  { cl: 'rar--secret',   l: 'Secret Rare',  mcp: 6.00 },
  ARTIST_PROOF: { cl: 'rar--proof',    l: 'Artist Proof', mcp: 6.00 },
};

// Les six géométries, en 24×24, CREUSES.
// ⭐ Creuses et non pleines : une forme pleine devient une pastille de couleur
// et crie plus fort que le prix, qui est le sujet de la page.
const FORMES = {
  COMMON:       '<path d="M15.8 4.3a8.6 8.6 0 1 0 0 15.4 10 10 0 0 1 0-15.4Z"/>',
  UNCOMMON:     '<path d="M12 3.6 21 20H3Z"/>',
  RARE:         '<rect x="4.4" y="4.4" width="15.2" height="15.2"/>',
  ULTRA_RARE:   '<path d="M12 2.9 19.9 7.5v9L12 21.1 4.1 16.5v-9Z"/>',
  SECRET_RARE:  '<path d="m12 2.8 2.85 6.05 6.55.85-4.8 4.6 1.2 6.6L12 17.75 6.2 20.9l1.2-6.6-4.8-4.6 6.55-.85Z"/>',
  ARTIST_PROOF: '<circle cx="12" cy="12" r="8.4"/>',
};

export const forme = (r, t) =>
  `<span class="forme${t ? ' forme--' + t : ''}" aria-hidden="true">`
  + `<svg viewBox="0 0 24 24">${FORMES[r] || FORMES.COMMON}</svg></span>`;

// ⭐ LA COULEUR VIT SUR LA FORME, LE MOT RESTE NEUTRE. Ce n'est pas une
// élégance : AUCUNE couleur de rareté VeVe ne passe 4,5:1 en texte sur ces
// gris (le rouge secret plafonne à 1,96:1). La séparation est forcée par la
// mesure — et c'est d'ailleurs ce que VeVe fait lui-même.
export function rar(r, o) {
  o = o || {};
  const x = RAR[r] || RAR.COMMON;
  return `<span class="rar ${x.cl}${o.pilule ? ' rar--pilule' : ''}`
    + `${o.blanc ? ' rar--sur-blanc' : ''}">${forme(r, o.g ? 'g' : '')}${x.l}</span>`;
}
export const pli = (r, t) =>
  `<span class="${(RAR[r] || RAR.COMMON).cl}" style="display:inline-flex">${forme(r, t)}</span>`;

// ⚠️ LA FLÈCHE EST DANS LE SVG, PAS DANS LA COULEUR (WCAG 1.4.1) : un deutan
// ne distingue pas ce vert de ce rouge. Trois tracés — montant, descendant,
// plat — pour que la géométrie porte l'information à elle seule.
const dcls = (v) => (v === null || v === undefined ? 'flat' : v > 0 ? 'up' : v < 0 ? 'down' : 'flat');
const pct = (v) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)} %`);
export function delta(v, o) {
  o = o || {};
  const s = v > 0 ? 'M6 2 11 9H1z' : v < 0 ? 'M6 10 1 3h10z' : 'M2 6h8';
  return `<span class="delta delta--${dcls(v)}${o.plein ? ' delta--plein' : ''}`
    + `${o.blanc ? ' delta--sur-blanc' : ''}">`
    + `${o.k ? `<span class="delta__k">${o.k}</span>` : ''}`
    + `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="${s}"/></svg>${pct(v)}</span>`;
}

// ⭐ DEUX MONNAIES, DEUX SIGNES : diamant taillé PLEIN pour les gems, cercle
// CREUX pour l'OMI. Plein contre creux se distingue en noir et blanc, à 10 px,
// et pour un daltonien — là où deux couleurs échouent aux trois.
export const gemsM = (g) =>
  `<span class="gems-m${g ? ' gems-m--g' : ''}" aria-hidden="true"><svg viewBox="0 0 24 24">`
  + '<path fill="currentColor" d="M6.4 3.6h11.2l4.4 5.4L12 21.4 2 9Z"/>'
  + '<g stroke="var(--surface)" stroke-width="1.1" fill="none" stroke-linejoin="round" vector-effect="non-scaling-stroke">'
  + '<path d="M2 9h20"/><path d="M6.4 3.6 8.6 9 12 21.4 15.4 9l2.2-5.4"/></g></svg></span>';
export const omiM = (g) => `<span class="omi-m${g ? ' omi-m--g' : ''}" aria-hidden="true"></span>`;

export const esc = (t) => String(t ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
