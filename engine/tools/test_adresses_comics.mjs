// ⚠️ DEPOT : VeVePreda/veve-sites
// CHEMIN : engine/tools/test_adresses_comics.mjs
//
// La feuille des comics a TROIS niveaux : /comics/<serie>/<numero>/<rarete>/.
//
//     npm run test:adresses
//
// POURQUOI CE TEST EXISTE. Une adresse fausse ne fait echouer AUCUN build :
// elle publie une page, simplement pas celle qu'on croit. Les deux modes a deux
// niveaux s'effondrent des que la serie devient une VRAIE serie, et ils
// s'effondrent en SILENCE — le code retombe sur un suffixe technique d'uuid et
// le build reste vert. Mesure du 28/07/2026 sur les 16 536 comics reels :
//
//   serie + rarete   (ancien defaut)    4 738 cles · 14 452 uuid en collision
//   nom seul         (comic_leaf: name) 4 253 cles · 16 142 en collision
//   serie + numero + rarete            16 119 cles ·    726 en collision
//
// Ce test etablit quatre choses :
//   1. en mode `issue-rarity`, une adresse de comic a bien TROIS niveaux ;
//   2. le niveau du milieu est le NUMERO, pas autre chose ;
//   3. un comic sans numero atterrit sur 'sans-numero' et NON sur 'item'
//      (le repli silencieux de `slugify`, qui rend 'item' pour une entree vide) ;
//   4. les collectibles et le mode historique ne bougent pas d'un octet.
//
// Chaque scenario tourne dans un PROCESSUS SEPARE : le jeu de donnees est
// memoise (cf. test_concurrence), deux etats ne peuvent pas coexister.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const base = mkdtempSync(join(tmpdir(), 'adresses-comics-'));
// ⭐⭐ NETTOYAGE DU TEMPORAIRE — audit d'hygiene du 03/08/2026.
// Ce banc creait un dossier par execution et n'en supprimait aucun. Mesure ce
// jour-la : 393 Mo dans /sessions/.../tmp, 26 dossiers `acces-*` et 21
// `adresses-comics-*`, et un `ENOSPC` en plein milieu d'un lot.
// ⚠️ INVISIBLE DANS DOCKER — conteneur neuf a chaque build. Visible sur une
// machine de dev, ou sur toute session un peu longue. C'est la meme famille que
// le `dist/` sali de `test_slugs`, deja corrige une fois : la lecon n'avait pas
// ete propagee aux voisins.
// ⛔ PAS UN `try/finally` : ce fichier appelle `process.exit()` a plusieurs
//    endroits, et un `finally` ne s'execute pas apres un exit explicite. Le
//    crochet `exit` de Node, si — c'est le SEUL point de sortie commun.
process.on('exit', () => { try { rmSync(base, { recursive: true, force: true }); } catch { /* rien a nettoyer */ } });
let echecs = 0;

const RUNNER = join(base, 'runner.mjs');
writeFileSync(RUNNER, `
import { dataset } from ${JSON.stringify(join(RACINE, 'engine', 'lib', 'dataset.mjs'))};
const ds = await dataset();
process.stdout.write('###' + JSON.stringify(ds.items.map(
  (i) => ({ uuid: i.uuid, type: i.type, path: i.path, ed: i.edition_type }))));
`);

const manifeste = (leaf) => [
  'site:', '  domain: test.local', '  brand: Test',
  'languages:', '  default: en', '  active: [en]',
  'publication:',
  `  comic_leaf: ${leaf}`,
  '  min_price_points: 1',
  '  quotas:', '    collectible: 500', '    comic: 500',
  '  quota_spillover: true',
  '',
].join('\n');

/** Le catalogue APRES la migration d'identite : la serie redevient une serie,
 *  et `edition_type` porte le NUMERO du fascicule (le `comicNumber` on-chain).
 *  C'est exactement la forme que produit `catalog_export` une fois
 *  CATALOG_IDENTITE_CHAINE allume — on ne teste pas une forme imaginaire.
 *  Le dernier comic est prive de numero : c'est le cas des 76 mesures. */
function migrer(csv) {
  const lignes = csv.trim().split('\n');
  const e = lignes[0].split(',');
  const [iKind, iNom, iSerie, iEd] =
    ['kind', 'name', 'series', 'edition_type'].map((c) => e.indexOf(c));
  const corps = lignes.slice(1).map((l) => {
    const c = l.split(',');
    if (c[iKind] !== 'Comic') return c.join(',');
    const m = /#(\d+)/.exec(c[iNom]);
    c[iEd] = m ? m[1] : '';
    c[iSerie] = c[iSerie].replace(/\s*#\d+.*$/, '');
    return c.join(',');
  });
  // Un comic explicitement SANS numero, pour le scenario 3.
  const dernier = corps.findLastIndex((l) => l.split(',')[iKind] === 'Comic');
  if (dernier >= 0) {
    const c = corps[dernier].split(',');
    c[iEd] = '';
    corps[dernier] = c.join(',');
  }
  return [lignes[0], ...corps].join('\n') + '\n';
}

function preparer(nom, leaf) {
  const root = join(base, nom);
  mkdirSync(join(root, 'sites', 'test'), { recursive: true });
  mkdirSync(join(root, 'engine', 'data'), { recursive: true });
  cpSync(join(RACINE, 'engine', 'data', 'sample'),
         join(root, 'engine', 'data', 'sample'), { recursive: true });
  const cat = join(root, 'engine', 'data', 'sample', 'catalogue.csv');
  writeFileSync(cat, migrer(readFileSync(cat, 'utf8')));
  writeFileSync(join(root, 'sites', 'test', 'manifest.yml'), manifeste(leaf));
  return root;
}

function items(root) {
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

const niveaux = (p) => p.split('/').filter(Boolean).length;

function verifie(titre, ok, detail) {
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${titre} — ${detail}`);
  if (!ok) echecs++;
}

console.log('Adresses des comics — serie -> numero -> rarete\n');

// --- 1. le mode HISTORIQUE ne bouge pas -------------------------------------
const avant = items(preparer('rarity', 'rarity'));
const comicsAvant = avant.filter((i) => i.type === 'comic');
verifie('mode `rarity` : toujours deux niveaux',
        comicsAvant.every((i) => niveaux(i.path) === 3),
        `${comicsAvant.length} comics, ex. ${comicsAvant[0]?.path}`);

// --- 2. le mode a TROIS niveaux ---------------------------------------------
const apres = items(preparer('issue', 'issue-rarity'));
const comics = apres.filter((i) => i.type === 'comic');
const collectibles = apres.filter((i) => i.type !== 'comic');

verifie('mode `issue-rarity` : trois niveaux pour les comics',
        comics.every((i) => i.path.startsWith('/comics/') && niveaux(i.path) === 4),
        `${comics.length} comics, ex. ${comics[0]?.path}`);

verifie('les collectibles ne sont PAS touches',
        collectibles.every((i) => niveaux(i.path) === 3),
        `${collectibles.length} collectibles, ex. ${collectibles[0]?.path}`);

// --- 3. le niveau du milieu est bien le NUMERO ------------------------------
const avecNumero = comics.filter((i) => String(i.ed || '').trim());
const bonNumero = avecNumero.filter((i) => i.path.split('/')[3] === String(i.ed));
verifie('le niveau du milieu est le numero du fascicule',
        avecNumero.length > 0 && bonNumero.length === avecNumero.length,
        `${bonNumero.length}/${avecNumero.length}`);

// --- 4. le repli silencieux de slugify ('item') est neutralise --------------
// ⭐ `slugify('')` rend 'item'. Ecrire `slugify(ed) || 'sans-numero'` n'aurait
// donc JAMAIS declenche le repli : tous les comics sans numero auraient
// atterri sur /<serie>/item/ — une adresse qui ne dit rien, sans erreur.
const sansNumero = comics.filter((i) => !String(i.ed || '').trim());
verifie("un comic sans numero atterrit sur 'sans-numero', pas sur 'item'",
        sansNumero.length > 0
          && sansNumero.every((i) => i.path.split('/')[3] === 'sans-numero'),
        sansNumero.length ? sansNumero[0].path : 'aucun cas dans l’echantillon');

// --- 5. aucune adresse en double --------------------------------------------
const vus = new Set(apres.map((i) => i.path));
verifie('aucune adresse en double',
        vus.size === apres.length,
        `${vus.size} adresses pour ${apres.length} items`);

// --- 6. le meme objet ne change pas d'adresse d'un run a l'autre -------------
const bis = items(preparer('issue-bis', 'issue-rarity'));
const carte = Object.fromEntries(apres.map((i) => [i.uuid, i.path]));
const bouge = bis.filter((i) => carte[i.uuid] && carte[i.uuid] !== i.path);
verifie('attribution deterministe (deux runs, memes adresses)',
        bouge.length === 0,
        bouge.length ? `${bouge.length} deplacees, ex. ${bouge[0].path}` : 'aucune');

console.log(echecs ? `\n${echecs} echec(s).` : '\nTout est vert.');
process.exit(echecs ? 1 : 0);
