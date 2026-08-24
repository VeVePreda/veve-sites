/* ═══════════════════════════════════════════════════════════════════════════
   TEXTES NON ÉCHANGEABLES — ce qui reste en anglais quand on change de langue
   ═══════════════════════════════════════════════════════════════════════════
   ⭐⭐ ÉCRIT LE 24/08/2026 pour le point `s` de Preda (« contenu non traduit
   dans les autres langues »), que l'audit du 14/08 classait INDÉCIDABLE : « la
   mesure est à programmer, pas à deviner ». La voici.

   CE QU'IL MESURE. Sur veveprice, la page est bâtie EN ANGLAIS et la langue
   s'échange dans le navigateur : `marquer_i18n.mjs` pose un `data-i18n` sur
   chaque libellé passé par `t()`, et le pilote remplace le contenu. Un texte
   visible SANS `data-i18n` au-dessus de lui est donc figé en anglais — pour
   toujours, dans toutes les langues, sans que rien ne le signale.

   ⛔ CE QU'IL ÉCARTE, ET POURQUOI : la marque (« VeVe », « Price »), les noms
   de langues (qui s'écrivent dans leur propre langue), et les nombres. Les
   compter aurait noyé le signal — et « traduire Français en anglais » n'a pas
   de sens. ⚠️ Il n'écarte PAS les noms de pièces et de séries : ce sont des
   données, elles ne se traduisent pas, mais c'est au lecteur d'en juger, pas à
   l'outil. Il les laisse voir plutôt que de décider en silence.

   ⚠️ IL LIT `dist/`, APRÈS `npm run marquer:i18n`. Avant, aucun `data-i18n`
   n'existe et il déclarerait TOUT non échangeable — un rouge total qui ne dit
   rien. Ordre : build → marquer:i18n → cet outil.

   Usage :  SITE=veveprice node outils/textes-non-echangeables.mjs
   ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseHTML } from 'linkedom';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const DIST = existsSync(join(ROOT, 'dist/client')) ? join(ROOT, 'dist/client') : join(ROOT, 'dist');
const IGNORE = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE']);
const NEUTRE = /^(VeVe|Price|VeVe Price|English|Français|Español|Deutsch|Italiano|VP|GEMS ?\/?)$/;

if (!existsSync(DIST)) { console.error(`${DIST} introuvable — lancer le build puis marquer:i18n.`); process.exit(2); }

const pages = [];
(function scan(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) scan(p);
    else if (e.endsWith('.html')) pages.push(p);
  }
})(DIST);

let marquesVues = 0;
const out = new Map();
for (const f of pages) {
  const html = readFileSync(f, 'utf8');
  marquesVues += (html.match(/data-i18n=/g) || []).length;
  const { document } = parseHTML(html);
  const rel = f.slice(DIST.length) || '/';
  (function parcours(n, marque) {
    for (const c of n.childNodes || []) {
      if (c.nodeType === 3) {
        const t = (c.textContent || '').replace(/\s+/g, ' ').trim();
        if (marque || t.length < 4 || NEUTRE.test(t)) continue;
        if (/^[\d\s.,%$€+\-—·:/|()#]+$/.test(t)) continue;
        const tag = c.parentElement?.tagName || '?';
        if (IGNORE.has(tag)) continue;
        const cle = t.slice(0, 120);
        if (!out.has(cle)) out.set(cle, { t, tag, pages: new Set() });
        out.get(cle).pages.add(rel);
      } else if (c.nodeType === 1 && !IGNORE.has(c.tagName)) {
        parcours(c, marque || c.hasAttribute('data-i18n'));
      }
    }
  })(document.body, false);
}

// 🔴 SANS CE GARDE-FOU, UN `dist/` NON MARQUÉ RENDRAIT « tout est cassé » et un
// `dist/` VIDE rendrait « tout va bien ». Les deux se ressemblent dans un
// compteur, et sont l'inverse l'un de l'autre.
if (pages.length < 20 || marquesVues < 100) {
  console.error(`\n❌ ${pages.length} page(s), ${marquesVues} marque(s) data-i18n — trop peu pour conclure.`);
  console.error('   `npm run marquer:i18n` a-t-il tourné après le build ?');
  process.exit(2);
}

const l = [...out.values()].sort((a, b) => b.pages.size - a.pages.size);
console.log(`\n${pages.length} pages lues · ${marquesVues} libellés échangeables · `
  + `${l.length} texte(s) visible(s) NON échangeable(s)\n`);
const seuil = Math.max(3, Math.floor(pages.length * 0.5));
const ossature = l.filter((e) => e.pages.size >= seuil);
console.log(`── L'OSSATURE — présents sur ${seuil} pages ou plus (${ossature.length}) :`);
for (const e of ossature) console.log(`   [${String(e.pages.size).padStart(4)} pages] <${e.tag}> ${JSON.stringify(e.t.slice(0, 90))}`);
console.log(`\n── LES AUTRES (${l.length - ossature.length}), les 25 plus répandus :`);
for (const e of l.filter((e) => e.pages.size < seuil).slice(0, 25))
  console.log(`   [${String(e.pages.size).padStart(4)} pages] <${e.tag}> ${JSON.stringify(e.t.slice(0, 80))}   ex. ${[...e.pages][0]}`);
console.log('');
