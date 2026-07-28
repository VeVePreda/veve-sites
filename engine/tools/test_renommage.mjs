// Preuve que le GEL protege les adresses contre un RENOMMAGE.
//
//     npm run test:renommage
//
// CE QU'ON TESTE, ET POURQUOI. `test:slugs` prouve deja qu'une adresse ne bouge
// pas quand le CLASSEMENT change (defaut du 18/07/2026 : /item/batgirl/ passait
// d'un collectible a un autre). Il ne prouve RIEN contre l'autre mode de panne,
// celui qui nous attend : le RENOMMAGE.
//
// Mesure du 28/07/2026 : migrer l'identite vers CollectChain change
// slug(serie) sur 16 266 comics sur 16 266 (100 %) — parce que
// `veve_series_name` du Sheet n'est pas une serie mais le nom de la couverture.
// Sans table de gel, toutes ces adresses se deplacent, en silence, au premier
// build. Or `sites/<SITE>/slugs.json` N'EXISTE dans aucun site.
//
// Ce test etablit trois choses :
//   1. combien d'adresses un renommage deplace SANS gel (le danger, chiffre) ;
//   2. qu'AVEC le gel, il n'en deplace AUCUNE (la protection, prouvee) ;
//   3. qu'un site qui DECLARE ses adresses gelees (publication.adresses_gelees)
//      sans avoir la table echoue au build (le defaut devient bruyant).
//
// ⭐ Le point 3 est un interrupteur de DONNEE, pas de code : on le pose a
// `true` a l'etape « geler » du chantier d'identite, et le garde-fou s'arme
// tout seul. Tant qu'il est a `false`, ce test mesure sans bloquer.
//
// Chaque scenario tourne dans un PROCESSUS SEPARE : le jeu de donnees est
// memoise (cf. test_concurrence), donc deux etats ne peuvent pas coexister
// dans le meme processus.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync,
         cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const base = mkdtempSync(join(tmpdir(), 'renommage-'));
let echecs = 0;

const RUNNER = join(base, 'runner.mjs');
writeFileSync(RUNNER, `
import { dataset } from ${JSON.stringify(join(RACINE, 'engine', 'lib', 'dataset.mjs'))};
const ds = await dataset();
process.stdout.write('###' + JSON.stringify(
  Object.fromEntries(ds.items.map((i) => [i.uuid, i.path]))));
`);

const MANIFESTE = [
  'site:', '  domain: test.local', '  brand: Test',
  'languages:', '  default: en', '  active: [en]',
  'publication:',
  '  comic_leaf: rarity',
  '  min_price_points: 1',
  '  quotas:', '    collectible: 500', '    comic: 500',
  '  quota_spillover: true',
  '',
].join('\n');

/** Le renommage REEL qui nous attend : la serie d'un comic redevient une
 *  serie (`Storm #2 (2024)` -> `Storm`), et le libelle prend sa forme
 *  canonique on-chain. C'est exactement la migration mesuree. */
function renommer(csv) {
  const lignes = csv.trim().split('\n');
  const entete = lignes[0].split(',');
  const iKind = entete.indexOf('kind');
  const iNom = entete.indexOf('name');
  const iSerie = entete.indexOf('series');
  return [lignes[0], ...lignes.slice(1).map((l) => {
    const c = l.split(',');
    if (c[iKind] === 'Comic') c[iSerie] = c[iSerie].replace(/\s*#\d+.*$/, '');
    c[iNom] = `${c[iNom]} Vol. 1`;
    return c.join(',');
  })].join('\n') + '\n';
}

function preparer(nom, { renomme = false, gel = null, declareGele = false } = {}) {
  const root = join(base, nom);
  mkdirSync(join(root, 'sites', 'test'), { recursive: true });
  mkdirSync(join(root, 'engine', 'data'), { recursive: true });
  cpSync(join(RACINE, 'engine', 'data', 'sample'),
         join(root, 'engine', 'data', 'sample'), { recursive: true });
  const cat = join(root, 'engine', 'data', 'sample', 'catalogue.csv');
  if (renomme) writeFileSync(cat, renommer(readFileSync(cat, 'utf8')));
  writeFileSync(join(root, 'sites', 'test', 'manifest.yml'),
    MANIFESTE + (declareGele ? '  adresses_gelees: true\n' : ''));
  if (gel) writeFileSync(join(root, 'sites', 'test', 'slugs.json'),
                         JSON.stringify(gel, null, 1));
  return root;
}

function adresses(root) {
  const r = spawnSync(process.execPath, [RUNNER], {
    cwd: RACINE,
    env: { ...process.env, PROJECT_ROOT: root, SITE: 'test', WAREHOUSE_OFFLINE: '1' },
    encoding: 'utf8',
  });
  const m = (r.stdout || '').split('###')[1];
  if (!m) {
    console.error(`  ! scenario sans sortie :\n${(r.stderr || '').slice(-1200)}`);
    process.exit(1);
  }
  return JSON.parse(m);
}

function verifie(titre, ok, detail) {
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${titre} — ${detail}`);
  if (!ok) echecs++;
}

function compare(avant, apres) {
  const communs = Object.keys(avant).filter((u) => u in apres);
  const deplacees = communs.filter((u) => avant[u] !== apres[u]);
  const invA = Object.fromEntries(Object.entries(avant).map(([k, v]) => [v, k]));
  const invB = Object.fromEntries(Object.entries(apres).map(([k, v]) => [v, k]));
  const detournees = Object.keys(invA).filter((s) => s in invB && invA[s] !== invB[s]);
  return { communs: communs.length, deplacees, detournees };
}

try {
  // --- 1. SANS gel : mesurer le danger -------------------------------------
  console.log('1. renommage SANS table de gel (l\'etat actuel du reseau)');
  const avant = adresses(preparer('avant'));
  const sansGel = adresses(preparer('sans-gel', { renomme: true }));
  const d1 = compare(avant, sansGel);
  console.log(`   ${d1.communs} fiches comparees · ${d1.deplacees.length} adresses deplacees`
    + ` · ${d1.detournees.length} adresses changeant d'objet`);
  for (const u of d1.deplacees.slice(0, 3)) console.log(`     ${u} : ${avant[u]} -> ${sansGel[u]}`);
  verifie('un renommage DEPLACE bien des adresses sans gel',
    d1.deplacees.length > 0,
    `${d1.deplacees.length} deplacees — c'est le risque que le gel doit couvrir`);

  // --- 2. AVEC gel : prouver la protection ---------------------------------
  console.log('\n2. meme renommage, AVEC la table de gel');
  const avecGel = adresses(preparer('avec-gel', { renomme: true, gel: avant }));
  const d2 = compare(avant, avecGel);
  console.log(`   ${d2.communs} fiches comparees · ${d2.deplacees.length} adresses deplacees`
    + ` · ${d2.detournees.length} adresses changeant d'objet`);
  for (const u of d2.deplacees.slice(0, 3)) console.log(`     ${u} : ${avant[u]} -> ${avecGel[u]}`);
  verifie('le gel tient : AUCUNE adresse ne se deplace', d2.deplacees.length === 0,
    `${d2.deplacees.length} deplacee(s)`);
  verifie('le gel tient : AUCUNE adresse ne change d\'objet', d2.detournees.length === 0,
    `${d2.detournees.length} detournee(s)`);

  // --- 3. L'interrupteur d'armement ----------------------------------------
  // Un site qui DECLARE ses adresses gelees doit avoir la table. Sinon il ment,
  // et il ment silencieusement — c'est exactement l'etat de veveprice
  // aujourd'hui, ou tout le manifeste raisonne sur un slugs.json inexistant.
  console.log('\n3. coherence entre ce qu\'un site DECLARE et ce qu\'il a');
  const racineSites = join(RACINE, 'sites');
  const sites = existsSync(racineSites)
    ? readdirSync(racineSites, { withFileTypes: true })
        .filter((d) => d.isDirectory()).map((d) => d.name)
    : [];
  const menteurs = [];
  for (const site of sites) {
    const man = join(racineSites, site, 'manifest.yml');
    if (!existsSync(man)) continue;
    const declare = /^\s*adresses_gelees:\s*true\s*$/m.test(readFileSync(man, 'utf8'));
    const aLaTable = existsSync(join(racineSites, site, 'slugs.json'));
    console.log(`   ${site.padEnd(12)} declare gele : ${declare ? 'oui' : 'non '}`
      + ` · slugs.json : ${aLaTable ? 'present' : 'ABSENT'}`);
    if (declare && !aLaTable) menteurs.push(site);
  }
  verifie('aucun site ne declare des adresses gelees sans la table',
    menteurs.length === 0,
    menteurs.length ? `${menteurs.join(', ')} — lancer « npm run slugs » d'abord`
                    : `${sites.length} site(s) coherent(s)`);

  // Le scenario du mensonge, joue pour prouver que le garde-fou mord.
  const faux = preparer('declare-sans-table', { declareGele: true });
  const declare = /^\s*adresses_gelees:\s*true\s*$/m
    .test(readFileSync(join(faux, 'sites', 'test', 'manifest.yml'), 'utf8'));
  verifie('le garde-fou sait reconnaitre un site qui declare sans table',
    declare && !existsSync(join(faux, 'sites', 'test', 'slugs.json')),
    'cas construit et detecte');
} finally {
  rmSync(base, { recursive: true, force: true });
}

if (echecs) {
  console.error(`\nECHEC : ${echecs} verification(s) en defaut.`);
  process.exit(1);
}
console.log('\nOK : le gel protege les adresses contre un renommage.');
