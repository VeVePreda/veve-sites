// Preuve que la vitrine reserve vraiment une place aux comics.
//
//     npm run test:quotas
//
// CE QU'ON TESTE, ET POURQUOI. Le 18/07/2026 la production a publie 400 fiches
// dont ZERO comic, alors que les comics sont 86 % du catalogue. Personne n'a
// rien casse : un plafond global unique + un classement par nombre de releves
// suffisaient. Comme le backfill densifie les collectibles plus vite, ceux-ci
// raflaient toutes les places, et rien dans le code ne s'en plaignait.
// Une regression de ce genre est INVISIBLE : le site reste valide, rapide et
// coherent. Il ne montre simplement plus une famille entiere du catalogue.
// D'ou ce test.
//
// Chaque scenario tourne dans un PROCESSUS SEPARE : le jeu de donnees est
// memoise (une seule construction par build, cf. test_concurrence), donc on ne
// peut pas evaluer deux manifestes differents dans le meme processus.
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const base = mkdtempSync(join(tmpdir(), 'quotas-'));
let echecs = 0;

const RUNNER = join(base, 'runner.mjs');
writeFileSync(RUNNER, `
import { dataset } from ${JSON.stringify(join(RACINE, 'engine', 'lib', 'dataset.mjs'))};
const ds = await dataset();
const parType = { collectible: 0, comic: 0 };
const parSerie = {};
for (const i of ds.items) {
  parType[i.type]++;
  const k = i.type + '|' + i.serieSlug;
  parSerie[k] = (parSerie[k] || 0) + 1;
}
const racines = {};
for (const i of ds.items) racines[i.path.split('/')[1]] = (racines[i.path.split('/')[1]] || 0) + 1;
process.stdout.write('###' + JSON.stringify({
  total: ds.items.length, parType, racines,
  eligibles: ds.eligibles,
  avecMediane: ds.items.filter((i) => i.prixMedian).length,
  maxParSerie: Math.max(0, ...Object.values(parSerie)),
  exemplesComics: ds.items.filter((i) => i.type === 'comic').slice(0, 3).map((i) => i.path),
}));
`);

function scenario(nom, publication) {
  const root = join(base, nom);
  mkdirSync(join(root, 'sites', 'test'), { recursive: true });
  mkdirSync(join(root, 'engine', 'data'), { recursive: true });
  cpSync(join(RACINE, 'engine', 'data', 'sample'), join(root, 'engine', 'data', 'sample'), { recursive: true });
  const man = [
    'site:', '  domain: test.local', '  brand: Test',
    'languages:', '  default: en', '  active: [en]',
    'publication:',
    ...Object.entries(publication).map(([k, v]) =>
      (v && typeof v === 'object')
        ? `  ${k}:\n` + Object.entries(v).map(([k2, v2]) => `    ${k2}: ${v2}`).join('\n')
        : `  ${k}: ${v}`),
  ].join('\n') + '\n';
  writeFileSync(join(root, 'sites', 'test', 'manifest.yml'), man);

  const r = spawnSync(process.execPath, [RUNNER], {
    cwd: RACINE,
    env: { ...process.env, PROJECT_ROOT: root, SITE: 'test', WAREHOUSE_OFFLINE: '1' },
    encoding: 'utf8',
  });
  const m = (r.stdout || '').split('###')[1];
  if (!m) {
    console.error(`  ! le scenario « ${nom} » n'a rien produit :\n${(r.stderr || '').slice(-1200)}`);
    process.exit(1);
  }
  return JSON.parse(m);
}

function verifie(titre, ok, detail) {
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${titre} — ${detail}`);
  if (!ok) echecs++;
}

const commun = { min_price_points: 8, public_points_max: 30, public_history_days: 90, comic_leaf: 'rarity' };

try {
  // --- 1. Un quota par type est reellement honore -------------------------
  console.log('\n1. quota par type (10 collectibles + 8 comics, sans report)');
  const a = scenario('quota', { ...commun, quotas: { collectible: 10, comic: 8 }, quota_spillover: false, max_new_per_series: 0 });
  console.log(`   eligibles ${JSON.stringify(a.eligibles)} · publies ${JSON.stringify(a.parType)}`);
  // Garde-fou anti-faux-negatif : un test qui conclut sur un echantillon
  // depourvu de comics ne prouve rien (erreur payee le 18/07 avec un audit
  // qui declarait « aucun lien casse » sur un dist vide).
  if (a.eligibles.comic < 8 || a.eligibles.collectible < 10) {
    console.error(`   ! echantillon insuffisant (${JSON.stringify(a.eligibles)}) : test invalide, regenerez-le`);
    process.exit(1);
  }
  verifie('les comics ne sont plus evinces', a.parType.comic === 8, `${a.parType.comic} comics publies (attendu 8)`);
  verifie('le quota collectibles est tenu', a.parType.collectible === 10, `${a.parType.collectible} collectibles (attendu 10)`);
  verifie('racines au pluriel', !a.racines.comic && !a.racines.collectible && a.racines.comics > 0 && a.racines.collectibles > 0,
    JSON.stringify(a.racines));
  verifie('les adresses de comics portent la rarete', a.exemplesComics.every((p) => /^\/comics\/[^/]+\/[^/]+\/$/.test(p)),
    a.exemplesComics.join(' '));
  // ⭐ CE CONTROLE EXISTE A CAUSE D'UN DEFAUT MUET REEL. Le classement s'appuie
  // sur le prix MEDIAN ; si la colonne change de nom dans l'entrepot, la lecture
  // ne leve aucune erreur — elle rend null, le score retombe sur le dernier prix
  // et les annonces farceuses remontent en page d'accueil. Rien ne le signale.
  verifie('le prix median est reellement lu (colonnes de l\'entrepot)', a.avecMediane === a.total,
    `${a.avecMediane}/${a.total} fiches ont une mediane`);

  // --- 2. Le quota inutilise revient a l'autre type ------------------------
  console.log('\n2. report du quota inutilise (comic: 500, introuvables en si grand nombre)');
  const b = scenario('report', { ...commun, quotas: { collectible: 5, comic: 500 }, quota_spillover: true, max_new_per_series: 0 });
  const c = scenario('sans-report', { ...commun, quotas: { collectible: 5, comic: 500 }, quota_spillover: false, max_new_per_series: 0 });
  console.log(`   avec report ${JSON.stringify(b.parType)} · sans report ${JSON.stringify(c.parType)}`);
  verifie('sans report, le quota bride strictement', c.parType.collectible === 5, `${c.parType.collectible} collectibles (attendu 5)`);
  verifie('avec report, les places libres profitent a l\'autre type', b.parType.collectible > c.parType.collectible,
    `${b.parType.collectible} > ${c.parType.collectible}`);

  // --- 3. Plafond de diversite par serie -----------------------------------
  console.log('\n3. plafond de diversite (3 nouvelles fiches max par serie)');
  const d = scenario('serie', { ...commun, quotas: { collectible: 500, comic: 500 }, quota_spillover: false, max_new_per_series: 3 });
  console.log(`   publies ${JSON.stringify(d.parType)} · plus grosse serie : ${d.maxParSerie}`);
  verifie('aucune serie ne depasse le plafond', d.maxParSerie <= 3, `${d.maxParSerie} fiches pour la plus grosse serie`);
  verifie('le plafond n\'a pas vide la vitrine', d.total > 10, `${d.total} fiches`);
} finally {
  rmSync(base, { recursive: true, force: true });
}

if (echecs) {
  console.error(`\nECHEC : ${echecs} verification(s) en defaut.`);
  process.exit(1);
}
console.log('\nOK : chaque type garde sa part de vitrine, le report et le plafond par serie fonctionnent.');
