// Gele les adresses : une fiche publiee garde son URL A VIE (chemin complet,
// ex. /collectibles/cover-girls-s1/batgirl/), meme si VeVe renomme l'item.
// La table ne fait que grandir, jamais changer.
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { dataset, migrerRacines } from '../lib/dataset.mjs';
import { SITE } from '../lib/manifest.mjs';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const out = join(ROOT, 'sites', SITE, 'slugs.json');
const ds = await dataset();

const brut = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : {};
// ⚠️ La MEME migration que celle appliquee au build, sinon elle ne vivrait
// qu'en memoire : le disque garderait les anciennes racines au singulier et
// les reimposerait au prochain demarrage.
const { map, migres, abandonnes } = migrerRacines(brut);
if (migres) console.log(`adresses migrees vers les racines au pluriel : ${migres}`);
if (abandonnes.length) console.log(`adresses ecartees (racine qui n'est plus servie) : ${abandonnes.length} — ex. ${abandonnes[0]}`);

let added = 0;
for (const i of ds.items) {
  if (!map[i.uuid]) { map[i.uuid] = i.path; added++; }
}

// Garde-fou : ne jamais ecrire une table vide par accident (un build rate ou
// un entrepot injoignable effacerait la garantie d'adresses stables).
if (!Object.keys(map).length) {
  console.error('aucune adresse a geler : on ne reecrit pas la table.');
  process.exit(1);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(map, null, 1) + '\n');
const parRacine = {};
for (const p of Object.values(map)) { const r = p.split('/')[1]; parRacine[r] = (parRacine[r] || 0) + 1; }
console.log(`slugs figes : ${Object.keys(map).length} au total ${JSON.stringify(parRacine)}, ${added} nouveaux`);
