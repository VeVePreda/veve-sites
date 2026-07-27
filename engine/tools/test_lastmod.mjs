// test_lastmod.mjs — le `lastmod` du sitemap dit-il la vérité ?
//
//   node engine/tools/test_lastmod.mjs
//
// ⭐ POURQUOI CE TEST EXISTE
// `sitemap.xml.js` se replie sur la date du build quand `lastmod.json` manque
// ou qu'une clé est absente. Ce repli est VOULU — un sitemap doit sortir même
// dégradé. Mais un repli silencieux qui devient la norme, c'est exactement le
// défaut qu'on vient de corriger, revenu par la porte de derrière. Ce test est
// là pour que le repli reste une exception qui se voit.
import process from 'node:process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const F = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const dit = (b, quoi, detail = '') => {
  if (b) { ok++; console.log(`  ✅ ${quoi}`); }
  else { ko++; console.log(`  ❌ ${quoi}${detail ? ` — ${detail}` : ''}`); }
};

const { activeSections } = await import('../lib/editorial_pages.mjs');
const { ficheSections } = await import('../lib/editorial_entries.mjs');

console.log('\n1. Le fichier d\'état existe et se lit');
const chemin = F('../data/lastmod.json');
dit(existsSync(chemin), 'engine/data/lastmod.json est présent',
  'lance engine/tools/lastmod.py — sinon TOUTES les URL retombent sur la date du build');
if (!existsSync(chemin)) { console.log('\n❌ arrêt : rien à vérifier\n'); process.exit(1); }

const etat = JSON.parse(readFileSync(chemin, 'utf8'));
const S = etat.sections || {};
dit(Object.keys(S).length > 0, `il porte ${Object.keys(S).length} section(s)`);

console.log('\n2. Chaque section publiée est couverte');
// ⚠️ Une section publiée SANS entrée ici retomberait en repli sans bruit : ses
// pages se déclareraient modifiées chaque jour, et personne ne le verrait.
for (const s of activeSections()) {
  dit(!!S[s], `« ${s} » a une date`, 'sinon repli silencieux sur la date du build');
}
for (const s of ficheSections()) {
  dit(!!S[s], `les fiches « ${s} » ont une date de section`);
}
for (const cle of ['donnees', 'legal']) {
  dit(!!S[cle], `« ${cle} » a une date`);
}

console.log('\n3. Les dates sont plausibles');
const jour = new Date().toISOString().slice(0, 10);
for (const [k, v] of Object.entries(S)) {
  dit(/^\d{4}-\d{2}-\d{2}$/.test(v.d || ''), `« ${k} » : date au format ISO`, v.d);
  // Une date dans le futur ne peut venir que d'une horloge fausse ou d'une
  // saisie à la main. Dans les deux cas le sitemap mentirait.
  dit((v.d || '') <= jour, `« ${k} » : pas dans le futur`, v.d);
  dit(typeof v.h === 'string' && v.h.length >= 16, `« ${k} » : porte son empreinte`,
    'sans empreinte, la date ne peut plus être conservée d\'un passage à l\'autre');
}

console.log('\n4. Le fichier n\'est pas une date unique déguisée');
// ⚠️ Si toutes les sections partagent la même date, c'est soit un tout premier
// passage (légitime), soit le signe que l'empreinte ne discrimine rien.
const dates = new Set(Object.values(S).map((v) => v.d));
if (dates.size === 1) {
  console.log(`  ⚠️  une seule date (${[...dates][0]}) — normal au premier passage, ` +
              'suspect ensuite : vérifier que lastmod.py tourne bien dans le workflow.');
} else {
  dit(true, `${dates.size} dates distinctes — les sections vivent leur propre vie`);
}

console.log(`\n${ko === 0 ? '✅ lastmod : tout est vert' : `❌ ${ko} contrôle(s) en échec`} (${ok + ko} contrôles)\n`);
process.exit(ko === 0 ? 0 : 1);
