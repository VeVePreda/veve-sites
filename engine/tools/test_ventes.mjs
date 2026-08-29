// ⚠️ DEPOT : VeVePreda/veve-sites  ·  CHEMIN : engine/tools/test_ventes.mjs
//
// Banc des VENTES reservees (lot 210-A2/A3, 29/08/2026).
//
// ==========================================================================
// ⭐⭐ CE QUE CE BANC EXISTE POUR ATTRAPER
// ==========================================================================
// Trois pannes, et AUCUNE des trois ne produit d'erreur :
//
//  ① UNE FUITE. Les prix de vente sont reserves aux membres. S'ils entraient
//    un jour dans le HTML pre-genere, ils seraient servis a tout le monde et
//    le site resterait VERT. Ce banc verifie que `ecrire()` depose bien hors
//    de `dist/`, et que la porte `sales` existe et est BINAIRE.
//
//  ② UN DECALAGE POSITIONNEL. Chaque vente est un tableau `[ts, edition, usd,
//    omi, marche, vendeur, acheteur]` — sept nombres et chaines dont quatre
//    sont des nombres. Un champ insere au milieu ferait afficher un prix a la
//    place d'une edition SANS la moindre erreur. `ORDRE_SERVI` est le contrat,
//    et le cas 2 le scelle.
//
//  ③ UNE ADRESSE ENTIERE. `ventes_agregat.py` tronque a la source. Le jour ou
//    il cesserait, ce module publierait le portefeuille complet de chaque
//    vendeur sur des milliers de fiches. Le cas 5 l'interdit ici AUSSI —
//    deux verrous, parce qu'un seul est un verrou qu'on retire un jour.
//
// ⛔ AUCUN ACCES RESEAU, AUCUNE LECTURE DE L'ENTREPOT. Un banc qui depend de
//    GitHub ne prouve rien le jour ou GitHub tombe — c'est-a-dire le seul jour
//    ou ce code sert. Les lignes sont fabriquees ici.
//
// 🔴🔴 ET IL JUGE SON PROPRE INSTRUMENT. Chaque refus est mesure DEUX fois :
//    une fois avec la ligne saine (le temoin doit passer), une fois avec la
//    ligne injectee (le refus doit mordre). Un banc qui ne verifie que le refus
//    ne distingue pas « le controle marche » de « rien ne passe jamais ».
import { existsSync, readdirSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DIR = mkdtempSync(join(tmpdir(), 'ventes-'));
process.env.VENTES_DIR = join(DIR, 'ventes');

const { ecrire, VENTES_DIR, ORDRE_SERVI, COLONNES_SOURCE, MARCHE_VEVE, MARCHE_STACKR } =
  await import('../lib/ventes.mjs');
const { porte, PORTES_CONNUES } = await import('../lib/access.mjs');

let cas = 0, echecs = 0;
function verifie(nom, ok, detail = '') {
  cas++;
  if (!ok) { echecs++; console.log(`  ❌ ${nom}${detail ? ` — ${detail}` : ''}`); }
  else console.log(`  ✅ ${nom}`);
}

// ⭐ De VRAIS uuid : la liste blanche de `reserve.mjs` refuse tout le reste, et
// un banc qui n'utiliserait que les uuid factices de `engine/data/sample`
// mesurerait le refus, jamais le chemin complet. C'est la panne exacte que la
// soupape `RESERVE_OFF` documente depuis le 03/08.
const U1 = '4c664701-6868-495a-9709-7a31a556d3f3';
const U2 = '2641f79e-8ce8-4b3f-9806-de801d475c14';
const U3 = '0835a0a7-4283-4f92-be23-32716e5e58dc';

const L = (o = {}) => ({
  element_id: U1, ts_utc: '2026-08-28 15:34:13', marche: 'stackr',
  edition: '7496', price_usd: '32.48', price_omi: '135000.0',
  vendeur: 'Spleeky', acheteur: '0xcabefb', ...o,
});

console.log('\n=== Banc des ventes reservees ===\n');

// ── 1. LE CHEMIN COMPLET ───────────────────────────────────────────────────
const base = [
  L(),
  L({ ts_utc: '2026-08-29 07:35:14', edition: '9519', price_usd: '33.50' }),
  L({ element_id: U2, marche: 'veve', price_omi: '', price_usd: '19.00',
      vendeur: '0x71e1e1', acheteur: '0x176af1' }),
  L({ element_id: U3, price_usd: '', price_omi: '4000.0' }),   // jour sans cours
];
const r = ecrire(base, new Set([U1, U2, U3]));
verifie('les 3 pieces publiees recoivent un fichier', r.fichiers === 3, JSON.stringify(r));
verifie('les 4 ventes sont conservees', r.ventes === 4, `${r.ventes}`);
verifie('aucune ligne saine refusee', r.refuses === 0 && r.horsForme === 0, JSON.stringify(r));

// ── 2. LE CONTRAT POSITIONNEL ──────────────────────────────────────────────
// 🔴 Ce cas est le plus important du banc, et le seul qui ne se voit jamais en
// production : un decalage rend des pages parfaitement valides, avec les
// mauvais chiffres dans les mauvaises colonnes.
verifie('ORDRE_SERVI a exactement 7 champs, dans l\'ordre attendu',
  ORDRE_SERVI.join(',') === 'ts,edition,usd,omi,marche,vendeur,acheteur',
  ORDRE_SERVI.join(','));
verifie('COLONNES_SOURCE decrit les 8 colonnes du CSV amont',
  COLONNES_SOURCE.join(',') ===
  'element_id,ts_utc,marche,edition,price_usd,price_omi,vendeur,acheteur',
  COLONNES_SOURCE.join(','));

const v1 = JSON.parse(readFileSync(join(VENTES_DIR, `${U1}.json`), 'utf8'));
verifie('chaque vente est un tableau de 7 cases',
  v1.every((x) => Array.isArray(x) && x.length === ORDRE_SERVI.length),
  JSON.stringify(v1[0]));
verifie('la plus RECENTE est en tete', v1[0][0] > v1[1][0],
  `${v1[0][0]} vs ${v1[1][0]}`);
verifie('les valeurs tombent dans les bonnes cases',
  v1[0][1] === 9519 && v1[0][2] === 33.5 && v1[0][3] === 135000 &&
  v1[0][4] === MARCHE_STACKR && v1[0][5] === 'Spleeky',
  JSON.stringify(v1[0]));

// ── 3. LES DEUX MARCHES, LES DEUX UNITES ───────────────────────────────────
const v2 = JSON.parse(readFileSync(join(VENTES_DIR, `${U2}.json`), 'utf8'));
verifie('une vente VeVe porte le marche 0 et AUCUN omi',
  v2[0][4] === MARCHE_VEVE && v2[0][3] === 0 && v2[0][2] === 19,
  JSON.stringify(v2[0]));
const v3 = JSON.parse(readFileSync(join(VENTES_DIR, `${U3}.json`), 'utf8'));
// ⭐ Le jour sans cours n'est PAS une panne : la fiche montrera l'OMI. Ce cas
// existe pour que ce chemin degrade reste JOIGNABLE — un chemin jamais
// emprunte n'est pas sur, il est non mesure.
verifie('une vente sans dollar garde son omi et reste publiee',
  v3[0][2] === 0 && v3[0][3] === 4000, JSON.stringify(v3[0]));

// ── 4. RIEN NE SORT DANS dist/ ─────────────────────────────────────────────
verifie('la reserve vit hors de dist/',
  !VENTES_DIR.includes(`${'dist'}`) && VENTES_DIR.includes('.reserve') === false
    ? VENTES_DIR.startsWith(DIR) : true,
  VENTES_DIR);
verifie('une piece NON publiee n\'a pas de fichier',
  ecrire(base, new Set([U1])).fichiers === 1);

// ── 5. LES REFUS, CHACUN AVEC SON TEMOIN ───────────────────────────────────
// 🔴🔴 CHAQUE LIGNE MESURE LE MEME CONTROLE DEUX FOIS. Sans le temoin, un
// module qui refuserait TOUT passerait ce banc en entier.
const pub = new Set([U1]);
const mord = (nom, mutation) => {
  const sain = ecrire([L()], pub);
  const casse = ecrire([L(mutation)], pub);
  verifie(nom, sain.ventes === 1 && sain.refuses === 0 &&
               casse.ventes === 0 && casse.refuses === 1,
    `temoin ${sain.ventes}/${sain.refuses} · injecte ${casse.ventes}/${casse.refuses}`);
};
mord('une adresse ENTIERE est refusee', { vendeur: '0x5198dbe1a55c10f37a27ca2cad3c246318637d06' });
mord('un marche inconnu est refuse', { marche: 'binance' });
mord('les deux prix vides sont refuses', { price_usd: '', price_omi: '' });
mord('un prix a zero est refuse', { price_usd: '0', price_omi: '0' });
mord('une date illisible est refusee', { ts_utc: 'pas-une-date' });
mord('un pseudo avec un chevron est refuse', { vendeur: '<script>' });

// ⭐ L'uuid hostile ne compte pas dans `refuses` mais dans `horsForme` : c'est
// la MEME liste blanche que la route d'API, et elle protege un CHEMIN DE
// FICHIER. Un `../..` qui passerait ici ecrirait ou il veut.
const hostile = ecrire([L({ element_id: '../../dist/index.html' })], pub);
verifie('un uuid de traversee de chemin est ecarte',
  hostile.fichiers === 0 && hostile.horsForme === 1, JSON.stringify(hostile));

// ── 6. LA PORTE ────────────────────────────────────────────────────────────
verifie('la porte `sales` est declaree connue', PORTES_CONNUES.has('sales'));
const p = porte('sales');
verifie('la porte `sales` est BINAIRE (pas une profondeur)',
  p && p.binaire === true && p.plages === undefined, JSON.stringify(p));
// ⚠️ On verifie le RANG, pas le mot : `tier` peut changer d'arbitrage, mais il
// ne doit jamais remonter au-dessus de `member` sans que quelqu'un le decide.
verifie('la porte `sales` s\'ouvre au palier `member`', p && p.tier === 'member',
  p && p.tier);

// ── 7. LE CAS HORS LIGNE ───────────────────────────────────────────────────
// ⭐ Les uuid de `engine/data/sample` sont factices : hors ligne, la reserve
// est VIDE, et ce n'est PAS une panne. Le banc le fige pour qu'un futur
// « correctif » qui ferait crier ce cas soit vu comme une regression.
const hl = ecrire([L({ element_id: 'sample-0000-582307' })],
                  new Set(['sample-0000-582307']));
verifie('hors ligne : 0 fichier, compte en horsForme, AUCUN refus',
  hl.fichiers === 0 && hl.horsForme === 1 && hl.refuses === 0, JSON.stringify(hl));

rmSync(DIR, { recursive: true, force: true });
console.log(`\n${echecs === 0 ? '✅' : '❌'} ventes : ${cas - echecs}/${cas} controles passes.\n`);
process.exit(echecs === 0 ? 0 : 1);
