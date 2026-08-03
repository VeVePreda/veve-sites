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
  COMMON:       { cl: 'rar--common',   l: 'Common' },
  UNCOMMON:     { cl: 'rar--uncommon', l: 'Uncommon' },
  RARE:         { cl: 'rar--rare',     l: 'Rare' },
  ULTRA_RARE:   { cl: 'rar--ultra',    l: 'Ultra Rare' },
  SECRET_RARE:  { cl: 'rar--secret',   l: 'Secret Rare' },
  ARTIST_PROOF: { cl: 'rar--proof',    l: 'Artist Proof' },
};

// ═══════════════════════════════════════════════════════════════════════════
// LE BARÈME MCP — DEUX TABLES, PAS UNE
// ═══════════════════════════════════════════════════════════════════════════
// Source : https://www.veve.me/blog/veve/mcp/veve-master-collector-program-earning-mcp-points/
//
// 🔴 CORRIGÉ LE 03/08/2026. `RAR[r].mcp` portait UN SEUL barème — celui des
// COMICS — et il était servi à TOUTES les pièces. Un collectible Common
// affichait donc « 0,25 MCP » quand il en rapporte 1,00, et un Rare « 2,00 »
// quand il en rapporte 1,25. En production, sur un site de cotes.
//
// ⭐⭐⭐ DEUX POPULATIONS QUI PARTAGENT UN VOCABULAIRE NE PARTAGENT PAS SES
// VALEURS. « Rare » nomme la même rareté chez les comics et les collectibles,
// et ne vaut pas la même chose. Le mot commun avait fait croire à un barème
// commun — la table n'a jamais été fausse, elle était INCOMPLÈTE d'un axe.
//
// ⭐ Les collectibles ne suivent pas un barème mais UNE BASE PLUS UN BONUS :
// 1,00 par collectible détenu, plus +0,25 (Rare), +0,50 (Ultra Rare),
// +5,00 (Secret Rare). D'où Common ET Uncommon à 1,00 — ce n'est pas une
// coquille, ni l'un ni l'autre n'a de bonus.
//
// ⚠️ CE QUE CE CHIFFRE N'EST PAS : le rendement d'une PREMIÈRE copie, hors
// bonus. VeVe applique des doublons décroissants (2ᵉ comic à 50 %, 2ᵉ
// collectible à 0,75), un bonus de bas numéro (+50 % comics, +0,5 collectibles)
// et des points de Set. Toute étiquette publiée doit le dire.
//
// ⛔ ARTIST PROOF N'EST PAS DANS LA TABLE DE VEVE. Côté collectibles, les 111
// lignes du catalogue le donnent à 1,00 (la base, sans bonus) : c'est une
// MESURE. Côté comics, personne ne l'a publié et je n'ai rien mesuré : la
// valeur reste `undefined`, et l'affichage rendra un tiret NU — pas un tiret
// « en attente de collecte ». ⭐ La valeur 6,00 qui s'y trouvait avant était
// une invention : elle recopiait Secret Rare faute de mieux.
const MCP = {
  comic: {
    COMMON: 0.25, UNCOMMON: 0.50, RARE: 2.00, ULTRA_RARE: 3.00,
    SECRET_RARE: 6.00,
  },
  collectible: {
    COMMON: 1.00, UNCOMMON: 1.00, RARE: 1.25, ULTRA_RARE: 1.50,
    SECRET_RARE: 6.00, ARTIST_PROOF: 1.00,
  },
};

/** Points MCP quotidiens d'une PREMIÈRE copie, ou `undefined` si le barème ne
 *  connaît pas ce couple (rareté, type). ⛔ Jamais de repli sur l'autre
 *  catégorie : c'est exactement l'erreur que ce lot répare. */
export const mcpPoints = (rarete, type) =>
  MCP[type === 'comic' ? 'comic' : 'collectible'][rarete];

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


// ═══════════════════════════════════════════════════════════════════════════
// LES ICONES DE PALIER — demande de Preda (31/07/2026)
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ EN SVG, PAS EN EMOJI. 🦐🦞🐋 sont tentants et gratuits, mais :
//   · ils sortent en COULEUR imposee par le systeme — ils ignorent la palette
//     et cassent le mode nuit, sur lequel tout le theme est bati ;
//   · ils changent de DESSIN d'un systeme a l'autre (le meme point de code
//     est une crevette grise chez l'un, rose chez l'autre) ;
//   · ils sont HORS du sous-ensemble latin d'Archivo : repli glyphe par
//     glyphe, et carre vide sur une machine sans fonte a emoji — c'est le
//     defaut qu'on a deja paye deux fois aujourd'hui (le bouton jour/nuit,
//     le cadenas des modules).
// Un SVG herite de `currentColor`, pese ~200 octets, et se dessine pareil
// partout. ⭐ Les formes restent LISIBLES a 18 px : on ne dessine pas un
// crustace, on dessine sa silhouette.
// ⚠️ La cle est celle du plan (`offer.plans[].cle`), pas son nom : le nom est
// traduit, la cle non. Un palier inconnu ne rend RIEN plutot qu'une icone
// par defaut — une icone generique ferait croire que le palier est habille.
const _ICONES_PALIER = {
  member:    '<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>',
  crevette:  '<path d="M20 8c-4.2 0-7 2.2-8.6 4.6C10 15 8 16.4 5.4 16.4"/>'
             + '<path d="M5.4 16.4c-1.6 0-2.6-1-2.6-2.3 0-1.6 1.5-2.6 3.3-2.6 3.6 0 5.6 2.2 8.1 2.2"/>'
             + '<path d="M20 8c1 .7 1.6 1.7 1.6 2.7"/><circle cx="18.4" cy="9.6" r=".9" fill="currentColor" stroke="none"/>',
  langouste: '<path d="M12 4.2v5"/><path d="M9 3.2 12 6l3-2.8"/>'
             + '<path d="M12 9.2c-2.6 0-4.4 1.7-4.4 4.1 0 2.8 2 6.5 4.4 6.5s4.4-3.7 4.4-6.5c0-2.4-1.8-4.1-4.4-4.1Z"/>'
             + '<path d="M7.6 12.6 4 11m12.4 1.6L20 11M7.8 16 4.6 15.4m11.6.6 3.2-.6"/>',
  whale:     '<path d="M2.6 13.4c2.6 0 3.6-1.6 5.4-1.6 1.5 0 2.2 1 4 1 3.6 0 6-3.4 9.4-3.4"/>'
             + '<path d="M2.6 13.4c0 3.2 2.8 5.6 6.6 5.6 5 0 8.6-3.4 10-7.4"/>'
             + '<path d="M19.2 9.4c.8-1.6.6-3.2-.4-4.4"/>'
             + '<circle cx="7" cy="14.6" r=".9" fill="currentColor" stroke="none"/>',
};

/** Le pictogramme d'un palier, ou '' si le plan n'en a pas. */
export const iconePalier = (cle, t = 18) => {
  const d = _ICONES_PALIER[cle];
  return d ? `<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" `
    + `stroke="currentColor" stroke-width="1.7" stroke-linecap="round" `
    + `stroke-linejoin="round" aria-hidden="true">${d}</svg>` : '';
};


// ═══════════════════════════════════════════════════════════════════════════
// LA COURBE MINIATURE DES TABLEAUX (31/07/2026)
// ═══════════════════════════════════════════════════════════════════════════
// ⛔⛔ LA MAQUETTE FABRIQUE SA COURBE. Son `serieJours()` est un generateur
// PSEUDO-ALEATOIRE amorce sur le NOM de la piece : il produit une jolie ligne
// qui ne decrit rien. C'est legitime dans une maquette — c'est du remplissage
// visuel — et ce serait une FAUTE GRAVE ici : le site publie des releves, et
// une courbe inventee au milieu de chiffres observes est indiscernable des
// vrais. On porte donc la GEOMETRIE de la maquette, jamais sa donnee.
// ⭐ Regle generale en portant une maquette : distinguer ce qui est une
// DECISION DE DESSIN de ce qui n'est qu'un BOUCHON. Les deux se ressemblent
// dans le code source ; seul le second doit disparaitre a la traduction.
//
// ⚠️ MOINS DE 2 POINTS => RIEN. Pas une ligne plate : une ligne plate AFFIRME
// une stabilite qu'on n'a pas observee. L'absence de courbe dit « pas assez
// de releves », ce qui est vrai.
export function sparkline(history, change, { w = 100, h = 26, max = 26 } = {}) {
  if (!Array.isArray(history) || history.length < 2) return '';
  const pts = history.slice(-max).map((p) => Number(p.floor)).filter((v) => Number.isFinite(v) && v > 0);
  if (pts.length < 2) return '';
  const mn = Math.min(...pts), mx = Math.max(...pts), sp = (mx - mn) || 1;
  const d = pts.map((v, i) => {
    const a = (i / (pts.length - 1)) * w;
    const b = h - 2 - ((v - mn) / sp) * (h - 6);
    return (i ? 'L' : 'M') + a.toFixed(1) + ',' + b.toFixed(1);
  }).join('');
  const sens = change == null ? '' : (change > 0 ? ' up' : change < 0 ? ' down' : '');
  return `<svg class="spark${sens}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" `
    + `aria-hidden="true"><path class="a" d="${d}L${w},${h}L0,${h}Z"/><path class="l" d="${d}"/></svg>`;
}

// Les degrades que `.spark path.a{fill:url(#gU)}` reclame. ⛔ Ils n'etaient
// emis NULLE PART : la reference `url(#gU)` vers un id inexistant est ignoree
// EN SILENCE — l'aire sous la courbe n'aurait simplement pas ete peinte, sans
// une erreur. Meme famille que `var(--x)` non defini, sur les SVG cette fois.
// ⚠️ Les couleurs sont EN DUR et c'est assume : un `<stop>` ne lit pas les
// variables CSS de facon fiable selon les moteurs, et ces deux teintes sont
// celles de `--up`/`--down`, qui ne basculent pas entre jour et nuit.
export const degradesSpark = () =>
  '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
  + '<linearGradient id="gU" x1="0" y1="0" x2="0" y2="1">'
  + '<stop offset="0%" stop-color="#3EC875" stop-opacity=".3"/>'
  + '<stop offset="100%" stop-color="#3EC875" stop-opacity="0"/></linearGradient>'
  + '<linearGradient id="gD" x1="0" y1="0" x2="0" y2="1">'
  + '<stop offset="0%" stop-color="#ED9BA6" stop-opacity=".3"/>'
  + '<stop offset="100%" stop-color="#ED9BA6" stop-opacity="0"/></linearGradient>'
  + '<linearGradient id="gAire" x1="0" y1="0" x2="0" y2="1">'
  + '<stop offset="0%" stop-color="#10CEF2" stop-opacity=".28"/>'
  + '<stop offset="100%" stop-color="#10CEF2" stop-opacity="0"/></linearGradient>'
  + '</defs></svg>';
