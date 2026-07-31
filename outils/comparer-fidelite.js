/* ═══════════════════════════════════════════════════════════════════════════
   COMPARATEUR DE FIDÉLITÉ — maquette contre gabarits
   ═══════════════════════════════════════════════════════════════════════════
   ⭐⭐ L'INSTRUMENT QUI MANQUAIT DEPUIS SIX LOTS. Je corrigeais ce que je
   savais mesurer — jetons, équilibre des balises, clés i18n — et la FIDÉLITÉ
   n'en faisait pas partie. Résultat : sept passes, et à chaque fois « ça y
   ressemble mais ce n'est pas ça », sans que je puisse dire où.
   ⭐ Un défaut qui revient n'est pas une étourderie, c'est un contrôle absent.
   Celui-ci liste les classes de chaque écran de la maquette, les compare à
   celles que le gabarit émet, et rend la différence — dans les deux sens. */
const fs = require('fs');

// ── 1 · Les classes de la maquette, écran par écran ────────────────────────
let js = fs.readFileSync('/tmp/v4.js', 'utf8');
const i = js.indexOf('let ECRAN=');
globalThis.document = { documentElement:{style:{setProperty(){}}}, addEventListener(){},
  getElementById(){return{innerHTML:'',querySelectorAll(){return[]},textContent:''}},
  querySelectorAll(){return[]} };
globalThis.matchMedia = () => ({ matches:false });
eval(js.slice(0, i) + 'globalThis.ECRANS=ECRANS;globalThis.setP=v=>PALIER=v;');
setP('visiteur');

const classesDe = (html) => {
  const vus = new Map();
  for (const m of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/class="([^"{}]+)"/g))
    for (const c of m[1].split(/\s+/)) if (c) vus.set(c, (vus.get(c) || 0) + 1);
  return vus;
};

// ── 2 · Les classes des gabarits Astro ─────────────────────────────────────
const D = process.argv[2];
const litAstro = (f) => {
  let s = fs.readFileSync(D + f, 'utf8');
  const p = s.split('---');
  s = p.length > 2 ? p.slice(2).join('---') : s;
  s = s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  const vus = new Map();
  // class="…" ET class={`…`} ET class={x ? 'a' : 'b'}
  for (const m of s.matchAll(/class=(?:"([^"]*)"|\{`([^`]*)`\}|\{[^}]*?'([^']*)'[^}]*?\})/g)) {
    const brut = (m[1] || m[2] || m[3] || '').replace(/\$\{[^}]*\}/g, ' ');
    for (const c of brut.split(/\s+/)) if (c && !c.includes('=')) vus.set(c, (vus.get(c) || 0) + 1);
  }
  // ⭐ `class:list={['a', 'b', cond ? 'c' : '']}` — la syntaxe Astro de
  // composition. Toutes les chaînes littérales qu'elle contient sont des
  // classes réellement émises.
  for (const m of s.matchAll(/class:list=\{\[([\s\S]*?)\]\}/g))
    for (const q of m[1].matchAll(/'([^']*)'/g))
      for (const c of q[1].split(/\s+/)) if (c) vus.set(c, (vus.get(c) || 0) + 1);
  return vus;
};

const PAIRES = [
  ['accueil',    'src/components/pages/Home.astro'],
  ['fiche',      'src/components/pages/Item.astro'],
  ['movers',     'src/components/pages/Movers.astro'],
  ['collections','src/components/pages/Collections.astro'],
  ['collection', 'src/components/pages/CollectionPage.astro'],
  ['offre',      'src/components/pages/Offre.astro'],
  ['compte',     'src/pages/compte/index.astro'],
  ['connexion',  'src/pages/connexion/index.astro'],
];
// ⭐ TOUJOURS présents : `Base.astro` habille chaque page, `Carte.astro` est
// utilisée par toutes les grilles, `vitrine.mjs` rend les atomes (rareté,
// monnaies, deltas). Les oublier revenait à compter comme absent ce qui est
// rendu sur chaque écran.
const TOUJOURS = ['src/layouts/Base.astro', 'src/components/Carte.astro',
                  'src/components/BarreAcces.astro'];
// ⛔ Le châssis de la maquette (cadre, légende, sélecteur de palier) n'existe
// pas en production : le compter comme « manquant » noierait le vrai signal.
const CHASSIS = /^(mk-|vp$|ico|sr$|deplie|bascule|legal|entete)/;

/* ═══ LE PLAFOND HONNÊTE ═══════════════════════════════════════════════════
   ⭐⭐ « 100 % » n'a de sens que si le dénominateur est atteignable. Certaines
   classes de la maquette exigent une donnée qu'aucun collecteur ne remonte, ou
   une fonctionnalité qui n'existe pas. Les compter comme un retard, c'est
   courir après un chiffre inatteignable ; les retirer du dénominateur en
   silence, c'est se mentir.
   ⛔ On les NOMME, avec leur cause. Le score utile devient « X / atteignable »,
   et le plafond est visible au lieu d'être subi. */
const BLOQUE = {
  'donnée absente — plancher StackR / OMI': /^(omi-m|omi)/,
  'donnée absente — $ par MCP':             /^(usd)/,
  'donnée absente — série de prix par ligne':/^(spark|sparkline)/,
  'donnée absente — variation 24 h':        /^(d1)$/,
  'compte requis — session, favoris, Vault':/^(verrou|cadenas|icone-b|f-onglets__c|tiroir)/,
  'compte requis — inscription':            /^(flottantes|dissout|centre|champ__aide)/,
  'écran non construit — Vault / alertes':  /^(col-carte__pile|rail|damier|deux-col)/,
};
const pourquoiBloque = (c) => {
  for (const [r, re] of Object.entries(BLOQUE)) if (re.test(c)) return r;
  return null;
};

let total = 0, couvert = 0, bloqueTotal = 0;
for (const [ecran, gab] of PAIRES) {
  if (!ECRANS[ecran]) continue;
  const maq = classesDe(ECRANS[ecran].f());
  const ast = new Map();
    for (const f of [gab, ...TOUJOURS]) {
    try { for (const [k, v] of litAstro(f)) ast.set(k, (ast.get(k) || 0) + v); }
    catch { /* ⚠️ un fichier absent ne doit pas gonfler le score : on ignore. */ }
  }
  // Les classes rendues par les atomes de vitrine.mjs (rareté, delta, monnaies).
  for (const c of ['rar','rar--common','rar--uncommon','rar--rare','rar--ultra','rar--secret',
    'rar--proof','rar--sur-blanc','rar--pilule','forme','forme--g','forme--xl','delta',
    'delta--up','delta--down','delta--flat','delta--plein','delta--sur-blanc','delta__k',
    'gems-m','omi-m','num']) ast.set(c, 1);
  const absents = [...maq.keys()].filter((c) => !ast.has(c) && !CHASSIS.test(c));
  const bloques = absents.filter((c) => pourquoiBloque(c));
  const manque  = absents.filter((c) => !pourquoiBloque(c));
  const enPlus = [...ast.keys()].filter((c) => !maq.has(c) && !CHASSIS.test(c));
  const n = maq.size - [...maq.keys()].filter((c) => CHASSIS.test(c)).length;
  const att = n - bloques.length;                    // le dénominateur ATTEIGNABLE
  total += att; couvert += att - manque.length; bloqueTotal += bloques.length;
  const pc = att ? (100 * (att - manque.length) / att).toFixed(0) : '100';
  console.log(`\n═══ ${ecran.toUpperCase()}  —  ${att - manque.length}/${att} atteignables (${pc} %)`
    + (bloques.length ? `  · ${bloques.length} bloquées` : ''));
  if (manque.length) console.log('  ⛔ À PORTER : ' + manque.sort().join(' · '));
  if (bloques.length) {
    const par = {};
    for (const c of bloques) (par[pourquoiBloque(c)] ||= []).push(c);
    for (const [r, l] of Object.entries(par)) console.log(`  🔒 ${r} : ${l.sort().join(' · ')}`);
  }
}
console.log(`\n────────────────────────────────────────────────────`);
console.log(`FIDÉLITÉ SUR L'ATTEIGNABLE : ${couvert}/${total} = ${(100*couvert/total).toFixed(1)} %`);
console.log(`Bloquées par une donnée ou une fonctionnalité absente : ${bloqueTotal}`);
console.log(`⭐ L'objectif est 100 % de l'ATTEIGNABLE. Les ${bloqueTotal} autres`);
console.log(`   se débloquent en collectant la donnée, pas en écrivant du HTML.`);
