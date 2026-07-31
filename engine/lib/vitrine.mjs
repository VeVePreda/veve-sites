// ⚠️ VeVePreda/veve-sites — engine/lib/vitrine.mjs   (FICHIER NEUF)
// ═══════════════════════════════════════════════════════════════════════════
// LA GRAMMAIRE VISUELLE DE VEVE PRICE — formes, monnaies, variations.
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ POURQUOI CE FICHIER EXISTE.
// La maquette repose sur une idee que le CSS seul ne peut pas produire : la
// RARETE EST UNE FORME, pas un mot. Un theme habille des elements ; il n'en
// cree pas. Tant que le gabarit ecrivait « SECRET_RARE » en texte brut, aucune
// feuille de style au monde n'en aurait fait un losange rouge.
//
// ⭐ ET LA SEPARATION EST FORCEE PAR LA MESURE, PAS PAR LE GOUT.
// AUCUNE couleur de rarete VeVe ne passe 4,5:1 en TEXTE sur ces gris (le rouge
// secret plafonne a 1,96:1). La couleur ne peut donc vivre que sur un APLAT ou
// un TRACE. D'ou : la couleur va sur la FORME, le mot reste neutre. Ce n'est
// pas une elegance, c'est la seule solution physiquement lisible — et c'est
// d'ailleurs ce que VeVe fait lui-meme.
//
// ⛔ NE JAMAIS colorer le MOT de la rarete. Et ne jamais faire porter par la
// couleur SEULE une information (WCAG 1.4.1) : la forme differe autant que la
// teinte, un daltonien lit la geometrie.

// Les six raretes VeVe. `c` = la couleur du trace, `f` = la geometrie.
//   commun croissant · uncommon triangle · rare CARRE · ultra hexagone
//   secret etoile · artist proof cercle
export const RARETES = {
  COMMON:       { cle: 'common',   c: '#0EBA52', f: 'croissant' },
  UNCOMMON:     { cle: 'uncommon', c: '#D157FC', f: 'triangle'  },
  RARE:         { cle: 'rare',     c: '#1F91FB', f: 'carre'     },
  ULTRA_RARE:   { cle: 'ultra',    c: '#ED8E00', f: 'hexagone'  },
  SECRET_RARE:  { cle: 'secret',   c: '#E36777', f: 'etoile'    },
  ARTIST_PROOF: { cle: 'proof',    c: '#CACACA', f: 'cercle'    },
};

const TRACES = {
  croissant: '<path d="M15.5 3.6a8.4 8.4 0 1 0 0 16.8 9.6 9.6 0 0 1 0-16.8Z"/>',
  triangle:  '<path d="M12 3.4 21 20.2H3Z"/>',
  carre:     '<rect x="4" y="4" width="16" height="16" rx="1"/>',
  hexagone:  '<path d="M12 2.9 19.9 7.5v9L12 21.1 4.1 16.5v-9Z"/>',
  etoile:    '<path d="m12 2.8 2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.2-5.9 3.2 1.2-6.5L2.5 9.7l6.6-.9Z"/>',
  cercle:    '<circle cx="12" cy="12" r="8.6"/>',
};

// ⭐ FORME CREUSE, JAMAIS PLEINE. Une forme pleine devient une pastille de
// couleur : elle crie plus fort que le prix, qui est le sujet de la page.
// Le trace dit la rarete sans jamais prendre le pas sur le chiffre.
export function formeRarete(rarity, taille = 14) {
  const r = RARETES[rarity];
  if (!r) return '';
  return `<svg class="rar__f" viewBox="0 0 24 24" width="${taille}" height="${taille}" `
       + `aria-hidden="true" fill="none" stroke="${r.c}" stroke-width="1.7" `
       + `stroke-linejoin="round">${TRACES[r.f]}</svg>`;
}

// Le mot, en clair et LISIBLE. `ARTIST_PROOF` -> `Artist Proof`.
export function motRarete(rarity) {
  if (!rarity) return '';
  return String(rarity).toLowerCase().split('_')
    .map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(' ');
}

// ⭐ DEUX MONNAIES, DEUX SIGNES : diamant PLEIN pour les gems, cercle CREUX
// pour l'OMI. Plein contre creux se distingue meme en noir et blanc, meme a
// 10 px, meme pour un daltonien — la ou deux couleurs echouent aux trois.
export const GEMS = '<svg class="mon mon--gems" viewBox="0 0 24 24" width="11" height="11" '
  + 'aria-hidden="true"><path d="M12 2.6 21 9.4 12 21.4 3 9.4Z" fill="#10CEF2"/></svg>';
export const OMI = '<svg class="mon mon--omi" viewBox="0 0 24 24" width="11" height="11" '
  + 'aria-hidden="true" fill="none" stroke="#E36777" stroke-width="2.4">'
  + '<circle cx="12" cy="12" r="8.4"/></svg>';

// ⚠️ LA FLECHE EST OBLIGATOIRE, PAS DECORATIVE (WCAG 1.4.1).
// Un daltonien deutan ne distingue pas ce vert de ce rouge. La couleur
// RENFORCE l'information, elle ne la porte jamais seule.
export function variation(v, nf) {
  if (v === null || v === undefined) return { cl: 'muted', txt: '—', fleche: '' };
  const s = `${v > 0 ? '+' : ''}${v.toFixed(1)} %`;
  if (v > 0) return { cl: 'up',   txt: s, fleche: '▲' };
  if (v < 0) return { cl: 'down', txt: s, fleche: '▼' };
  return { cl: 'muted', txt: s, fleche: '' };
}
