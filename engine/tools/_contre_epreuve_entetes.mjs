// CONTRE-ÉPREUVE de test_entetes.mjs — outil de session, NE PART PAS DANS LE ZIP.
//
// ⭐⭐⭐ UN BANC SE JUGE SUR CE QU'IL LAISSE PASSER, pas sur sa couleur du jour.
// Ce harnais monte un vrai serveur HTTP local dont on pilote les en-têtes, puis
// FABRIQUE chaque panne une par une et lit le code de sortie rendu.
// Sans lui, « le banc est vert » ne voudrait rien dire : il est vert aujourd'hui
// AUSSI si sa logique de jugement ne s'exécute jamais.

import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';

// ⛔ PAS `execFileSync` : il gèle la boucle d'événements du parent, donc le
//   serveur local ci-dessous ne répond plus pendant que le banc l'interroge.
//   Le banc timeoutait sur MON harnais et j'aurais lu ça comme « réseau muet ».
//   *Un défaut d'instrument se déguise en résultat de mesure.*
const lance = (dir) => new Promise((res) => {
  const p = spawn('node', ['engine/tools/test_entetes.mjs'], { cwd: dir });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('close', (code) => res({ code, out }));
});

const SRC = new URL('../../', import.meta.url).pathname;
const BASE = '/tmp/ce';
let scenario = {};
let nPassage = 0;

// ── le serveur piloté ──────────────────────────────────────────────────────
const srv = createServer((req, res) => {
  nPassage++;
  const u = req.url.split('?')[0];
  const est404 = u.includes('banc-entetes-page-absente');
  const cle = est404 ? '404'
    : u === '/' ? 'accueil'
    : u.endsWith('.css') ? 'statique'
    : u === '/sitemap.xml' ? 'sitemap'
    : u === '/robots.txt' ? 'robots' : 'autre';

  const h = {
    'strict-transport-security': scenario.hstsValeur ?? 'max-age=86400',
    'permissions-policy': 'geolocation=(), camera=(), microphone=()',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
  };
  for (const nom of scenario.retire?.[cle] || []) delete h[nom];
  // instabilité : l'en-tête n'apparaît qu'à certains passages
  if (scenario.instable && cle === scenario.instable.cible && nPassage % 3 !== 1) {
    delete h[scenario.instable.entete];
  }
  h['content-type'] = cle === 'statique' ? 'text/css'
    : cle === 'sitemap' ? 'application/xml'
    : cle === 'robots' ? 'text/plain' : 'text/html';
  // Le robots.txt imite la production : bloc Cloudflare, PUIS le dépôt.
  const robots = '# BEGIN Cloudflare Managed Content\nUser-agent: GPTBot\nDisallow: /\n' +
    '# END Cloudflare Managed Content\n\nUser-agent: *\nAllow: /\n' +
    (scenario.robotsSansApi ? '' : 'Disallow: /api/\n') +
    (scenario.robotsSansSitemap ? '' : `\nSitemap: ${BASE_URL}/sitemap.xml\n`);
  res.writeHead(est404 ? 404 : 200, h);
  res.end(cle === 'accueil'
    ? '<html><head><link href="/theme-abc123.css" rel="stylesheet"></head><body>ok</body></html>'
    : cle === 'robots' ? robots : 'ok');
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const PORT = srv.address().port;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// ── la déclaration, réécrite par scénario ──────────────────────────────────
function pose(dir, { plancher = 86400, exceptions = '[]', zones }) {
  mkdirSync(`${dir}/engine/lib`, { recursive: true });
  mkdirSync(`${dir}/engine/tools`, { recursive: true });
  copyFileSync(`${SRC}engine/tools/test_entetes.mjs`, `${dir}/engine/tools/test_entetes.mjs`);
  writeFileSync(`${dir}/engine/lib/entetes_attendus.mjs`, `
export const ENTETES_ATTENDUS = {
  'strict-transport-security': { genre: 'plancher-max-age', plancher: ${plancher},
    interdits: ['includesubdomains', 'preload'] },
  'permissions-policy': { genre: 'present' },
  'referrer-policy': { genre: 'present' },
  'x-content-type-options': { genre: 'egal', valeur: 'nosniff' },
  'x-frame-options': { genre: 'present' },
};
export const CSP_VOLONTAIREMENT_ABSENTE = true;
export const ECHELLE_HSTS = [300, 86400, 604800, 15552000];
export const ZONES = ${zones};
export const CIBLES = [
  { cle: 'accueil', chemin: '/' },
  { cle: 'sitemap', chemin: '/sitemap.xml' },
  { cle: 'robots',  chemin: '/robots.txt' },
  { cle: '404', fabrique404: true },
  { cle: 'statique', decouvreCss: true },
];
export const EXCEPTIONS = ${exceptions};
export const PASSAGES = 3;
export const PAUSE_MS = 10;
export const ATTENTE_PROPAGATION_MS = 1000;
export const DELAI_MS = 4000;
export const METHODE = 'GET';
`);
}

// ⭐ DEUX zones, comme en production : le banc EXIGE d'en voir deux, et il a
//   raison — une déclaration à une seule zone laisserait l'autre sans lecteur.
//   Mon premier harnais n'en déclarait qu'une et le cas « tout conforme »
//   rougissait : c'était le harnais qui avait tort, pas le banc.
const ZONE_OK = `[{ nom: 'local-a', base: '${BASE_URL}' }, { nom: 'local-b', base: '${BASE_URL}' }]`;
const ZONE_MORTE = `[{ nom: 'muette-a', base: 'http://127.0.0.1:1' }, { nom: 'muette-b', base: 'http://127.0.0.1:1' }]`;
const EXC_ROBOTS = `[{ cible: 'robots', zones: ['local-a', 'local-b'], entetes: '*', pourquoi: 'test', revoirLe: '2026-11-11' }]`;

const cas = [
  { nom: 'A · tout conforme',                     attendu: 0, decl: { zones: ZONE_OK, exceptions: EXC_ROBOTS }, srv: { retire: { robots: ['strict-transport-security', 'permissions-policy', 'referrer-policy', 'x-content-type-options', 'x-frame-options'] } }, cherche: 'tout est vert' },
  { nom: 'B · x-frame-options retiré du 404',     attendu: 1, decl: { zones: ZONE_OK, exceptions: EXC_ROBOTS }, srv: { retire: { robots: ['strict-transport-security', 'permissions-policy', 'referrer-policy', 'x-content-type-options', 'x-frame-options'], 404: ['x-frame-options'] } }, cherche: '404 · x-frame-options' },
  { nom: 'C · max-age BAISSE sous le plancher',   attendu: 1, decl: { zones: ZONE_OK, exceptions: EXC_ROBOTS, plancher: 604800 }, srv: { hstsValeur: 'max-age=86400', retire: { robots: ['strict-transport-security', 'permissions-policy', 'referrer-policy', 'x-content-type-options', 'x-frame-options'] } }, cherche: 'LA VALEUR A BAISSÉ' },
  { nom: 'D · `preload` SERVI (irréversible)',    attendu: 1, decl: { zones: ZONE_OK, exceptions: EXC_ROBOTS }, srv: { hstsValeur: 'max-age=86400; includeSubDomains; preload', retire: { robots: ['strict-transport-security', 'permissions-policy', 'referrer-policy', 'x-content-type-options', 'x-frame-options'] } }, cherche: 'irréversible' },
  { nom: 'E · réseau MUET',                       attendu: 2, decl: { zones: ZONE_MORTE }, srv: {}, cherche: "je n'ai pas pu regarder" },
  { nom: 'F · exception PÉRIMÉE',                 attendu: 1, decl: { zones: ZONE_OK, exceptions: EXC_ROBOTS }, srv: {}, cherche: 'EXCEPTION PÉRIMÉE' },
  { nom: 'G · en-tête INSTABLE (1 passage sur 3)', attendu: 1, decl: { zones: ZONE_OK, exceptions: EXC_ROBOTS }, srv: { retire: { robots: ['strict-transport-security', 'permissions-policy', 'referrer-policy', 'x-content-type-options', 'x-frame-options'] }, instable: { cible: 'accueil', entete: 'x-frame-options' } }, cherche: 'propagation' },
  { nom: 'H · plancher hors échelle (déclaration)', attendu: 1, decl: { zones: ZONE_OK, exceptions: EXC_ROBOTS, plancher: 42 }, srv: { retire: { robots: ['strict-transport-security', 'permissions-policy', 'referrer-policy', 'x-content-type-options', 'x-frame-options'] } }, cherche: 'palier connu' },
  // ⭐ Les deux pannes que le § 3 existe pour attraper. Sans elles, ce § serait
  //   « une règle sans émetteur » : présent, vert, et ne prouvant rien.
  { nom: 'I · robots.txt sans son Sitemap',        attendu: 1, decl: { zones: ZONE_OK, exceptions: EXC_ROBOTS }, srv: { robotsSansSitemap: true, retire: { robots: ['strict-transport-security', 'permissions-policy', 'referrer-policy', 'x-content-type-options', 'x-frame-options'] } }, cherche: 'plan du site' },
  { nom: 'J · robots.txt sans ses interdictions',  attendu: 1, decl: { zones: ZONE_OK, exceptions: EXC_ROBOTS }, srv: { robotsSansApi: true, retire: { robots: ['strict-transport-security', 'permissions-policy', 'referrer-policy', 'x-content-type-options', 'x-frame-options'] } }, cherche: 'garde ses interdictions' },
];

rmSync(BASE, { recursive: true, force: true });
console.log('\n═══ CONTRE-ÉPREUVE — le banc rougit-il sur CHAQUE panne ? ═══\n');
let rates = 0;
for (const c of cas) {
  scenario = c.srv; nPassage = 0;
  const dir = `${BASE}/${c.nom.slice(0, 1)}`;
  pose(dir, c.decl);
  const { code, out: sortie } = await lance(dir);
  const bonCode = code === c.attendu;
  const bonTexte = sortie.includes(c.cherche);
  if (!bonCode || !bonTexte) rates++;
  console.log(`${bonCode && bonTexte ? '  OK  ' : ' ECHEC'} ${c.nom}`);
  console.log(`        code ${code} (attendu ${c.attendu})${bonCode ? '' : '  ⛔'}` +
    ` · texte « ${c.cherche} » ${bonTexte ? 'présent' : '⛔ ABSENT'}`);
}
srv.close();
console.log(rates
  ? `\n❌ ${rates} scénario(s) où le banc n'a pas réagi comme il devait.`
  : '\n✅ le banc rougit sur chaque panne, et il sait encore être vert (cas A).');
process.exit(rates ? 1 : 0);
