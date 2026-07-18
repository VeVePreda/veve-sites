// Gele les adresses : une fiche publiee garde son URL A VIE (chemin complet,
// ex. /collectible/cover-girls-s1/batgirl/), meme si VeVe
// renomme l'item. La table ne fait que grandir, jamais changer.
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { dataset } from '../lib/dataset.mjs';
import { SITE } from '../lib/manifest.mjs';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const out = join(ROOT, 'sites', SITE, 'slugs.json');
const ds = await dataset();
const map = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : {};
let added = 0;
for (const i of ds.items) {
  if (!map[i.uuid]) { map[i.uuid] = i.path; added++; }
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(map, null, 1) + '\n');
console.log(`slugs figes : ${Object.keys(map).length} au total, ${added} nouveaux`);
