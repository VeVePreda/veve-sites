/* ═══════════════════════════════════════════════════════════════════════════
   PORTER — transpile un gabarit de la maquette vers du JSX Astro
   ═══════════════════════════════════════════════════════════════════════════
   ⭐⭐⭐ L'OUTIL QUI MANQUAIT DEPUIS LE DÉBUT.
   `maquette-veveprice.html` contient DÉJÀ le balisage exact de chaque écran,
   sous forme de littéraux de gabarit JavaScript. Je le recopiais à la main —
   huit fois — et à chaque passe je perdais des classes, j'en renommais
   d'autres, et le CSS porté finissait par ne viser plus rien.
   ⭐ Ce script fait la traduction mécaniquement, et surtout il REFUSE de
   deviner : tout champ de la maquette sans équivalent dans le moteur est
   signalé, jamais inventé.

   ⛔ SUR UN SITE DE COTES, UNE VALEUR FABRIQUÉE EST LA SEULE FAUTE QU'ON NE
   RATTRAPE JAMAIS. D'où le mode strict par défaut : un champ inconnu arrête
   la traduction au lieu de produire du HTML plausible.

   Usage :  node outils/porter.mjs <maquette.html> <nomDeFonction>
*/
import fs from 'node:fs';

// ── La table de correspondance : champ de la maquette -> champ du moteur ───
// ⚠️ ELLE EST LA PIÈCE CRITIQUE. La maquette a été dessinée contre des données
// INVENTÉES ; le moteur en fournit d'autres. Onze champs de la maquette n'ont
// aucun équivalent — les recenser une fois vaut mieux que les redécouvrir à
// chaque écran.
export const CHAMPS = {
  n: 'item.name',        s: 'item.series',      r: 'item.rarity',
  p: 'item.floor',       d7: 'item.change7d',   d30: 'item.change30d',
  sup: 'item.tirage',    list: 'item.listings', img: 'item.image',
  ath: 'item.ath',       atl: 'item.atl',       ed: 'item.edition_type',
  athd: 'item.athDate',  atld: 'item.atlDate',  sortie: 'item.releaseDate',
  t: 'item.type',        pts: 'item.totalPoints',
};
// ⛔ CEUX-LÀ N'EXISTENT PAS, ET NE DOIVENT PAS ÊTRE FABRIQUÉS.
//    omi/od1/od7 = plancher StackR (aucun collecteur) · usd = $/MCP (aucun
//    taux) · d1 = variation 24 h (le moteur ne garde que 7 j et 30 j) ·
//    dem = fiche de démonstration (notion propre à la maquette) ·
//    fav = favori (demande un compte).
export const ABSENTS = new Set(['omi', 'od1', 'od7', 'usd', 'd1', 'dem', 'fav']);

export function porter(src, nom, { strict = true } = {}) {
  const i = src.indexOf(nom);
  if (i < 0) throw new Error(`fonction « ${nom} » introuvable`);
  // on prend le premier littéral de gabarit qui suit
  const a = src.indexOf('`', i);
  let p = a + 1, prof = 0;
  while (p < src.length) {
    if (src[p] === '\\') { p += 2; continue; }
    if (src[p] === '$' && src[p + 1] === '{') { prof++; p += 2; continue; }
    if (src[p] === '}' && prof) { prof--; p++; continue; }
    if (src[p] === '`' && !prof) break;
    p++;
  }
  let tpl = src.slice(a + 1, p);

  const vus = new Set(), inconnus = new Set();
  // ${it.x} / ${i.x}  ->  {item.x}
  tpl = tpl.replace(/\$\{\s*(?:it|i)\.([a-zA-Z0-9_]+)\s*\}/g, (_, c) => {
    if (ABSENTS.has(c)) { inconnus.add(c); return `{/* ⛔ ${c} : absent du moteur */}`; }
    if (!CHAMPS[c]) { inconnus.add(c); return `{/* ⛔ ${c} : non mappé */}`; }
    vus.add(c); return `{${CHAMPS[c]}}`;
  });
  // ${money(it.x)} / ${esc(it.x)} / ${fn(it.x)}
  tpl = tpl.replace(/\$\{\s*([a-zA-Z]+)\(\s*(?:it|i)\.([a-zA-Z0-9_]+)([^)]*)\)\s*\}/g, (m, fn, c, reste) => {
    if (ABSENTS.has(c)) { inconnus.add(c); return `{/* ⛔ ${c} */}`; }
    if (!CHAMPS[c]) { inconnus.add(c); return `{/* ⛔ ${c} */}`; }
    vus.add(c);
    const arg = CHAMPS[c] + (reste || '');
    // esc() est inutile en JSX : Astro échappe déjà toute interpolation.
    // ⭐ Le garder produirait un double échappement — « L&#39;Amazing » à
    //    l'écran, ce qui est un défaut visible et difficile à relier à sa cause.
    return fn === 'esc' ? `{${CHAMPS[c]}}` : `{${fn}(${arg})}`;
  });
  // attributs JSX
  tpl = tpl.replace(/\bclass="/g, 'class="').replace(/\bfor="/g, 'htmlFor="');

  if (strict && inconnus.size) {
    throw new Error(`champs sans équivalent : ${[...inconnus].join(', ')}\n`
      + `⛔ Le portage s'arrête. Retirer ces éléments du gabarit, ou déclarer\n`
      + `   leur correspondance dans CHAMPS — jamais inventer la valeur.`);
  }
  return { jsx: tpl.trim(), champs: [...vus], inconnus: [...inconnus] };
}

if (process.argv[2]) {
  const src = fs.readFileSync(process.argv[2], 'utf8');
  try {
    const r = porter(src, process.argv[3], { strict: false });
    console.log(r.jsx);
    console.error(`\n── champs utilisés : ${r.champs.join(' ')}`);
    if (r.inconnus.length) console.error(`── ⛔ SANS ÉQUIVALENT : ${r.inconnus.join(' ')}`);
  } catch (e) { console.error('⛔ ' + e.message); process.exit(1); }
}
