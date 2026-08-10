// ⚠️ VeVePreda/veve-sites — engine/tools/test_reserve.mjs   (FICHIER NEUF)
// ═══════════════════════════════════════════════════════════════════════════
// LE BANC DE LA RÉSERVE ET DU MUR — ce qu'il LAISSE PASSER, pas ce qu'il coche.
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ Un banc se juge sur les mutations qu'il attrape. Celui-ci est écrit
// contre SIX façons précises de casser ce lot, et chacune a son équivalent
// déjà vu en production sur ce projet :
//   1. l'uuid vient de l'URL et sert de chemin de fichier   -> traversée ;
//   2. la route rend la donnée sans vérifier le palier      -> mur décoratif ;
//   3. le refus échoue OUVERT sur une session absente       -> abonnement offert ;
//   4. la réserve atterrit sous dist/                       -> nginx la sert en clair ;
//   5. la réserve n'est pas triée                           -> la courbe se replie ;
//   6. le Cadran émet des classes que le thème n'habille pas -> page nue, zéro erreur.
import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const R = new URL('../..', import.meta.url).pathname;
let ko = 0;
const cas = async (nom, fn) => {
  try { await fn(); console.log(`  ok  ${nom}`); }
  catch (e) { ko++; console.log(`  KO  ${nom}\n      ${e.message}`); }
};

process.env.RESERVE_DIR = mkdtempSync(join(tmpdir(), 'reserve-'));
process.env.SITE = process.env.SITE || 'veveprice';
const reserve = await import('../lib/reserve.mjs');

// ── 1. LA FORME DE L'UUID ─────────────────────────────────────────────────
// ⭐ La MÊME fonction garde l'écriture et la lecture. Si un jour elles
// divergent, ce bloc tombe des deux côtés à la fois.
console.log('\n— la forme de l\'uuid —');
await cas('un uuid valide passe', () => {
  assert.equal(reserve.uuidValide('80171d3d-38b6-44fa-a50b-2c60fd71b823'), true);
});
for (const mechant of ['../../etc/passwd', '../dist/index.html',
  '..%2f..%2fsites%2fveveprice%2fmanifest.yml',
  '80171d3d-38b6-44fa-a50b-2c60fd71b823/../../x',
  '80171d3d-38b6-44fa-a50b-2c60fd71b823.json',
  '', null, undefined, '80171d3d38b644fa8a50b2c60fd71b823']) {
  await cas(`refusé : ${JSON.stringify(mechant)}`, () => {
    assert.equal(reserve.uuidValide(mechant), false);
  });
}

// ── 2. LA RÉSERVE ÉCRIT, TRIE, ET NE GARDE QUE LES PUBLIÉS ────────────────
console.log('\n— la réserve —');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
reserve.ouvrir();
// ⚠️ VOLONTAIREMENT DANS LE DÉSORDRE et entrelacés : le fichier de prix n'est
// pas garanti trié, et les vidages successifs peuvent de toute façon
// désordonner un même item.
reserve.point(A, '2026-03-02T00:00:00Z', 12, 3);
reserve.point(B, '2026-01-01T00:00:00Z', 99, 1);
reserve.point(A, '2026-01-01T00:00:00Z', 10, 5);
reserve.point(A, '2026-02-01T00:00:00Z', 11, 4);
reserve.point(A, 'pas-une-date', 42, 0);                      // ts illisible -> sauté
reserve.point('../evasion', '2026-01-01T00:00:00Z', 1, 1);    // uuid refusé
const bilan = reserve.fermer(new Set([A]));

await cas('seuls les uuid PUBLIÉS restent', () => {
  const f = readdirSync(process.env.RESERVE_DIR).sort();
  assert.deepEqual(f, [`${A}.json`], `trouvé : ${f.join(', ')}`);
});
await cas('aucun fichier temporaire .csv ne survit', () => {
  assert.equal(readdirSync(process.env.RESERVE_DIR).filter((f) => f.endsWith('.csv')).length, 0);
});
const lu = JSON.parse(readFileSync(join(process.env.RESERVE_DIR, `${A}.json`), 'utf8'));
await cas('les points sont TRIÉS par date croissante', () => {
  const ts = lu.p.map((x) => x[0]);
  assert.deepEqual(ts, [...ts].sort((a, b) => a - b), `reçu : ${ts.join(' ')}`);
});
await cas('le relevé au ts illisible est SAUTÉ, pas inventé', () => {
  assert.equal(lu.n, 3, `n=${lu.n}`);
  assert.equal(lu.p.some((x) => x[1] === 42), false, 'le point au ts illisible a été gardé');
});
await cas('l\'uuid de forme invalide n\'a écrit AUCUN fichier', () => {
  assert.equal(bilan.refuses, 1);
  assert.equal(existsSync(join(process.env.RESERVE_DIR, '../evasion.csv')), false);
});
await cas('le format servi est bien celui que le client attend', () => {
  assert.equal(typeof lu.u, 'string');
  assert.equal(typeof lu.n, 'number');
  assert.ok(Array.isArray(lu.p) && lu.p.every((x) => x.length === 3 && x.every(Number.isFinite)));
});

// ── 3. LA ROUTE : ELLE ÉCHOUE FERMÉ ───────────────────────────────────────
// ⭐⭐ LE CŒUR DU LOT. Une porte qui s'ouvre quand elle ne sait pas est la
// faute de famille de ce projet : `getattr(…, ())` a mal étiqueté 216 838
// transferts en échouant OUVERT sur une valeur plausible. Transposée à un
// droit d'accès, c'est de l'abonnement distribué gratuitement.
console.log('\n— la route /api/historique/[uuid] —');
const route = await import('../../src/pages/api/historique/[uuid].js');
const appel = (uuid, locals) => route.GET({ params: { uuid }, locals });
const corps = async (r) => JSON.parse(await r.text());

// ⭐⭐ LE PALIER SUFFISANT SE LIT DANS LE MANIFESTE, IL NE S'ÉCRIT PAS ICI.
// Ma première version testait `member` — le manifeste exige `crevette` depuis
// l'arbitrage du 30/07, et le banc est tombé. Il avait raison, et c'est ce
// qu'on lui demande. Mais un banc qui code un palier en dur devient FAUX le
// jour où le manifeste change, sans que personne ne le voie : ce serait un
// réglage posé à un endroit et redit à un autre — la faute de famille de ce
// projet. On interroge donc la même source que le code testé.
//
// 🔴🔴 ET J'AI REFAIT LA MÊME FAUTE UN CRAN PLUS HAUT — DÉPLOIEMENT CASSÉ EN
// PRODUCTION LE 02/08/2026. J'avais lu le PALIER dans le manifeste, mais pas
// l'état ACTIF de la porte. Or ce banc tourne dans le Dockerfile, donc pour
// TOUS les sites, et vevewiki déclare `access.tiers: [visitor]` :
//     [acces] portes : price_history=public
// Porte inactive => `franchit()` rend `true` pour tout le monde, sans session.
// C'est le comportement CORRECT d'un site gratuit — `access.mjs` le dit en
// toutes lettres : « Porte inactive (site gratuit) => tout le monde franchit ».
// Mon banc exigeait 401, recevait 200, et faisait échouer le build de vevewiki
// sur un moteur parfaitement sain.
//
// ⭐⭐ « LE MANIFESTE DÉCIDE, LE CODE OBÉIT » VAUT AUSSI POUR LES BANCS. Un
// contrôle qui SUPPOSE le manifeste au lieu de le LIRE teste un site
// imaginaire — et il ne se trompe pas à moitié : il casse le déploiement de
// l'autre site, celui qu'il n'a jamais regardé.
// ⛔ La correction n'est PAS de se taire quand la porte est inactive : un
// contrôle qui n'a rien inspecté n'a rien prouvé, et c'est justement sur
// vevewiki qu'il vient de tomber. Les DEUX contrats sont vérifiés, chacun sur
// le site où il s'applique.
const { PALIERS, porte: porteAcces } = await import('../lib/access.mjs');
const PORTE = porteAcces('price_history');
const ACTIVE = PORTE.actif;
const EXIGE = PORTE.tier;
const DESSOUS = PALIERS[Math.max(0, PALIERS.indexOf(EXIGE) - 1)];
console.log(ACTIVE
  ? `  (site à paliers : la porte exige « ${EXIGE} » ; juste en dessous : « ${DESSOUS} »)`
  : `  (site GRATUIT : price_history est inactive — tout le monde franchit, et`
    + ` c'est le contrat. Les cas de refus ne s'appliquent pas ici.)`);

if (ACTIVE) {
await cas('AUCUNE session -> 401, et AUCUNE donnée', async () => {
  const r = await appel(A, {});
  assert.equal(r.status, 401);
  const c = await corps(r);
  assert.equal(c.ok, false);
  assert.equal(JSON.stringify(c).includes('"p"'), false, 'la réponse contient des points');
});
await cas('locals absent (middleware jamais exécuté) -> 401', async () => {
  assert.equal((await appel(A, undefined)).status, 401);
});
if (ACTIVE) await cas(`palier JUSTE EN DESSOUS (« ${DESSOUS} ») -> refus, et AUCUNE donnée`, async () => {
  // ⭐ Le palier immédiatement inférieur, pas `visitor` : c'est la frontière
  // qui se casse quand `auMoins()` passe d'un `>=` à un `>`, ou quand
  // quelqu'un insère un palier AU MILIEU de PALIERS (l'ordre est la seule
  // chose qui compte, et un insert décale tout en silence).
  const r = await appel(A, { palier: DESSOUS });
  assert.ok(r.status === 401 || r.status === 403, `status ${r.status}`);
  assert.equal(JSON.stringify(await corps(r)).includes('"p"'), false);
});
if (ACTIVE) await cas('palier INVENTÉ -> refus (jamais une ouverture par méconnaissance)', async () => {
  const r = await appel(A, { palier: 'empereur' });
  assert.ok(r.status === 401 || r.status === 403, `status ${r.status}`);
});
await cas('uuid de traversée -> 400, AVANT toute lecture de disque', async () => {
  assert.equal((await appel('../../sites/veveprice/manifest', { palier: 'whale' })).status, 400);
});
}
// ⭐ LE CONTRAT DU SITE GRATUIT, vérifié LÀ OÙ IL S'APPLIQUE.
if (!ACTIVE) {
await cas('site gratuit : sans session, la route SERT (porte inactive)', async () => {
  const r = await appel(A, {});
  assert.equal(r.status, 200, "une porte inactive ne refuse personne — c'est access.mjs qui le dit");
  assert.equal((await corps(r)).ok, true);
});
await cas("site gratuit : ce n'est PAS une fuite — rien n'est réservé", () => {
  assert.equal(PORTE.actif, false);
  assert.equal(Number.isFinite(PORTE.public_max), false,
    'porte inactive : le plafond doit être levé (Infinity), sinon le site tronque sans rien vendre');
});
}
await cas(`palier SUFFISANT (« ${EXIGE} ») -> 200 et les points`, async () => {
  const r = await appel(A, { palier: EXIGE });
  assert.equal(r.status, 200);
  const c = await corps(r);
  assert.equal(c.ok, true);
  assert.equal(c.h.n, 3);
});
await cas('la réponse n\'est JAMAIS mise en cache partagé', async () => {
  const r = await appel(A, { palier: EXIGE });
  assert.match(r.headers.get('cache-control') || '', /no-store/);
  assert.match(r.headers.get('vary') || '', /cookie/i);
});
await cas('uuid valide mais SANS réserve -> 404, pas 200 vide', async () => {
  assert.equal((await appel(B, { palier: EXIGE })).status, 404);
});
await cas('`prerender` est un LITTÉRAL true', () => {
  const src = readFileSync(join(R, 'src/pages/api/historique/[uuid].js'), 'utf8');
  assert.match(src, /export const prerender = true;/,
    'un `prerender` en EXPRESSION n\'est pas évalué par Astro : la route serait figée au build');
});
await cas('`getStaticPaths` existe et rend une liste VIDE', () => {
  // 🔴 Sans elle, le build de vevewiki CASSE (GetStaticPathsRequired) : une
  // route dynamique pré-générée doit dire quels chemins générer. Les quatre
  // routes de compte du lot 24 n'ont pas de `[param]`, celle-ci si.
  // ⛔ Et si quelqu'un la remplit « pour que ça marche aussi en static », il
  // écrit dans dist/ un JSON par pièce contenant l'historique complet, servi
  // en clair par nginx. D'où les deux moitiés de ce contrôle.
  assert.equal(typeof route.getStaticPaths, 'function');
  assert.deepEqual(route.getStaticPaths(), [],
    'une liste non vide publierait l\'historique réservé sous dist/');
});
await cas('la route est déclarée dans astro_routes_compte.mjs', () => {
  const src = readFileSync(join(R, 'engine/lib/astro_routes_compte.mjs'), 'utf8');
  assert.match(src, /pages\/api\/historique\/\[uuid\]\.js/,
    'sans cette ligne la route reste pré-générée en mode server : elle répondrait « pas de session » à un abonné connecté');
});

// ── 4. LA RÉSERVE N'EST JAMAIS PUBLIÉE ────────────────────────────────────
// ⭐ La 3ᵉ barrière. Les deux autres (hors de dist/, racine nginx) sont des
// propriétés de configuration ; celle-ci est un CONSTAT sur ce qui existe.
console.log('\n— la réserve n\'est jamais servie —');
await cas('aucun fichier de réserve sous dist/', () => {
  const dist = join(R, 'dist');
  if (!existsSync(dist)) return;                 // banc joué avant le build
  const trouves = [];
  const marcher = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (e.name === '.reserve') trouves.push(p); else marcher(p); }
      else if (/^[0-9a-f-]{36}\.json$/i.test(e.name)) trouves.push(p);
    }
  };
  marcher(dist);
  assert.equal(trouves.length, 0, `RÉSERVE PUBLIÉE : ${trouves.slice(0, 5).join(', ')}`);
});
await cas('le dossier de réserve est HORS de public/, src/ et dist/', () => {
  const d = reserve.RESERVE_DIR;
  assert.equal(/[\\/](public|src|dist)[\\/]/.test(d), false, `RESERVE_DIR = ${d}`);
});

// ── 5. LE CONTRAT GABARIT ↔ THÈME, POUR CE SITE SEULEMENT ─────────────────
// ⛔ CE CONTRÔLE NE VA PAS DANS `outils/css-mort.mjs`, ET C'EST DÉLIBÉRÉ. Son
// SOCLE est ce que les TROIS thèmes doivent rendre ; y mettre le vocabulaire
// de la vitrine redonnerait les 172 griefs du 31/07 sur `encyclopedie`, à qui
// on réclamerait un vocabulaire qu'il ne rendra jamais. Ici la question est
// posée à UN thème sur UN composant : elle a une réponse.
console.log('\n— les classes du Cadran existent dans le thème de veveprice —');
const theme = readFileSync(join(R, 'themes/vitrine/theme.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
// 🔴 LOT 123 — LES CLASSES DU VERROU ONT QUITTÉ CETTE LISTE AVEC LE PANNEAU.
// `verrou__fond`, `verrou__prof`, `verrou__voile`, `verrou__in`, `verrou__t`,
// `verrou__d`, `dissout`, `dissout__px` ne sont plus émises par `Cadran.astro`.
// ⭐⭐ LES EXIGER ENCORE AURAIT ÉTÉ LE DÉFAUT SYMÉTRIQUE DE CELUI QU'ELLES
// gardaient : ce banc vérifie qu'une classe ÉMISE est HABILLÉE ; exiger une
// règle pour une classe que plus personne n'émet, c'est demander au thème de
// garder du CSS mort — et le prochain qui le nettoie fera rougir un banc en
// ayant raison.
// ⛔ Les règles restent dans le thème (elles servent au verrou d'autres pages
//    et `outils/css-mort.mjs` dira si ce n'est plus vrai) : c'est le CONTRÔLE
//    qui change, pas la feuille.
for (const c of ['graph-hote', 'ref', 'ref--td',
                 'info-bulle', 'cadran', 'cadran-pt', 'axe', 'axe--d', 'pt-haut', 'pt-bas',
                 'graph', 'grille-l', 'aire', 'ligne']) {
  await cas(`.${c} a une règle`, () => {
    assert.ok(new RegExp(`\\.${c}[^\\w-]`).test(theme),
      'émise par Cadran.astro, jamais habillée : le composant sort NU, sans une erreur');
  });
}
// 🔴🔴🔴 LOT 123 — CE CONTRÔLE EST DEVENU PLUS FORT, PAS PLUS SOUPLE.
// IL DISAIT : « `.verrou__fond` ne reçoit que la courbe PUBLIQUE » — parce que
// `filter:blur` est de la présentation, et que tout ce qui passe là est en
// clair dans le HTML, lisible par « afficher la source ».
// La règle était juste. Son SUJET a disparu : le panneau flouté n'existe plus,
// et la courbe ne voyage plus dans la page — elle vit dans la réserve et
// n'arrive que par une API qui a lu une session.
// ⭐⭐⭐ UN CONTRÔLE DONT L'OBJET DISPARAÎT NE SE SUPPRIME PAS, IL SE
// GÉNÉRALISE. La question qu'il posait — « qu'est-ce que ce composant écrit
// dans le HTML ? » — a maintenant une réponse plus simple et plus sûre :
// RIEN. On l'exige.
// ⛔ Et c'est bien un durcissement : l'ancien autorisait une donnée (la courbe
//    publique) à condition qu'elle soit la bonne. Celui-ci n'en autorise
//    aucune. *Une règle qui perd son sujet et qu'on retire laisse un trou ;
//    une règle qu'on élargit ferme aussi ce qu'on n'avait pas prévu.*
await cas('le Cadran n\'écrit AUCUNE donnée dans le HTML', () => {
  const src = readFileSync(join(R, 'src/components/Cadran.astro'), 'utf8');
  const html = src.slice(0, src.indexOf('<script'));
  assert.equal(/set:html=/.test(html), false,
    'le Cadran ne doit rien injecter dans la page au build : la courbe vient de '
    + '`/api/cote/`, l\'historique de `/api/historique/`, et les deux ont lu une session.');
  // ⚠️ On cherche le mot HORS des commentaires : ce fichier explique
  //    précisément pourquoi `svgPublic` a été retiré, et un contrôle qui lit
  //    ses propres explications rougit sur elles. Défaut payé le 07/08.
  const nu = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  assert.equal(/svgPublic/.test(nu), false,
    '`svgPublic` a été retiré au lot 123 — le fond flouté portait la courbe dans le '
    + 'HTML de 3 000 fiches, servie à tout le monde sous une couche de présentation.');
});
await cas('le Cadran ne dépend d\'aucun cookie inventé', () => {
  const src = readFileSync(join(R, 'src/components/Cadran.astro'), 'utf8');
  assert.equal(/document\.cookie/.test(src), false,
    'un composant qui attend un signal que personne n\'émet ne se déclenche jamais — '
    + 'et il a l\'air correct, ce qui est pire qu\'une panne');
});

rmSync(process.env.RESERVE_DIR, { recursive: true, force: true });
console.log(ko ? `\n${ko} echec(s).\n` : '\nreserve, route et verrou : tout tient.\n');
process.exit(ko ? 1 : 0);
