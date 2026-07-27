// =============================================================================
//  test_fiches.mjs — le garde-fou des FICHES (une page par entité)
//  ⚠️ VeVePreda/veve-sites — engine/tools/test_fiches.mjs
//      SITE=vevewiki npm run test:fiches
//
//  Ce qui se casse ici ne fait échouer AUCUN build : un lien de voisine vers une
//  page non publiée, un maillage qui ne se pose pas, un seuil qui laisse passer
//  des pages creuses. Trois pannes muettes, trois contrôles.
// =============================================================================
import process from 'node:process';
process.env.SITE = process.env.SITE || 'vevewiki';

const E = await import('../lib/editorial_entries.mjs');
let ok = 0, ko = 0;
const dit = (b, quoi, detail = '') => {
  if (b) { ok += 1; console.log(`  ✅ ${quoi}`); }
  else { ko += 1; console.log(`  ❌ ${quoi}${detail ? ` — ${detail}` : ''}`); }
};

const sections = E.ficheSections();
// ⚠️ Un site SANS section à fiches (veveprice n'a pas de bloc `editorial`) n'est
// pas un site en échec : il n'y a simplement rien à contrôler. On le DIT et on
// sort proprement — un test rouge par inapplicabilité finit par être ignoré,
// et le jour où il devient vraiment rouge, plus personne ne le regarde.
if (!sections.length) {
  console.log(`\nSITE=${process.env.SITE} ne déclare aucune section à fiches — rien à contrôler.\n`);
  process.exit(0);
}

console.log('\n1. La section produit bien des fiches');
dit(sections.includes('brands'), 'brands est outillée pour les fiches');
const fr = await E.fichesDe('brands', 'fr');
const en = await E.fichesDe('brands', 'en');
dit(fr.length > 0, `${fr.length} fiches publiables`);
dit(fr.length === en.length, 'autant de fiches dans chaque langue (mêmes seuils)');
dit(new Set(fr.map((f) => f.slug)).size === fr.length, 'aucun slug en double');
dit(fr.every((f) => f.slug === f.slug.toLowerCase() && !/[^a-z0-9-]/.test(f.slug)), 'les slugs sont propres');

console.log('\n2. Le SEUIL — mieux vaut 29 bonnes fiches que 44 tièdes');
const { collection } = await import('../lib/editorial.mjs');
const toutes = (await collection('brands', 'fr')).items;
dit(fr.length < toutes.length, `${toutes.length - fr.length} entrées restent sans page (sous le seuil)`);
dit(fr.every((f) => (f.agg?.n_items || 0) >= 5 || f.jalons.length > 0),
  'aucune fiche publiée ne passe sous le seuil');

console.log('\n3. ⭐ Les VOISINES ne pointent jamais vers une page inexistante');
const slugs = new Set(fr.map((f) => f.slug));
const morts = fr.flatMap((f) => [f.precedente, f.suivante].filter(Boolean))
  .filter((v) => !slugs.has(v.slugFiche));
dit(morts.length === 0, 'chaque voisine a bien sa fiche', morts.map((m) => m.slugFiche).join(', '));
dit(fr.some((f) => f.precedente) && fr.some((f) => f.suivante), 'le chaînage par arrivée existe');
const premiere = fr.find((f) => f.rangArrivee === 1);
dit(premiere && !premiere.precedente, 'la plus ancienne n\'a pas de « juste avant »');

console.log('\n4. Les chiffres calculés se tiennent');
const rangs = fr.map((f) => f.rangPoids).sort((a, b) => a - b);
dit(rangs[0] === 1 && rangs[rangs.length - 1] === fr.length, 'les rangs de poids couvrent 1..n sans trou');
dit(new Set(fr.map((f) => f.rangArrivee)).size === fr.length, 'les rangs d\'arrivée sont uniques');
const somme = fr.reduce((n, f) => n + (f.part || 0), 0);
dit(somme > 0 && somme <= 100.5, `la part se rapporte au catalogue ENTIER (${somme.toFixed(1)} % pour les fiches publiées)`);
dit(fr.every((f) => f.total === fr.length), 'le « sur n » annoncé est le nombre de FICHES, pas d\'entrées');

console.log('\n5. La figure de chaque fiche');
dit(fr.every((f) => f.voisinesPoids.length === Math.min(5, fr.length)), 'une fenêtre de 5 licences par figure');
dit(fr.every((f) => f.voisinesPoids.some((v) => v.titre === f.titre)), 'la licence est TOUJOURS dans sa propre figure');
dit(fr.every((f) => f.voisinesPoids.every((v) => Number.isFinite(v.items))), 'aucune valeur non numérique');

console.log('\n6. Les ancres de jalons suivent la règle de la chronologie');
const avecJalons = fr.filter((f) => f.jalons.length);
dit(avecJalons.length > 0, `${avecJalons.length} fiches citées par la chronologie`);
dit(avecJalons.every((f) => f.jalons.every((j) => /^j-[a-z0-9-]+$/.test(j.ancre))),
  'toutes les ancres ont la forme attendue');

console.log('\n7. Les adresses');
dit(E.cheminFiche('brands', 'marvel') === '/brands/marvel/', 'une seule définition du chemin');
const params = await E.ficheParamsDefault();
dit(params.length === fr.length, 'getStaticPaths produit exactement les fiches publiables');

console.log(`\n${ko === 0 ? '✅ fiches : tout est vert' : `❌ ${ko} contrôle(s) en échec`} (${ok + ko} contrôles)\n`);
process.exit(ko === 0 ? 0 : 1);
