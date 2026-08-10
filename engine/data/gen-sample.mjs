// Genere un echantillon realiste pour builder hors-ligne (bac a sable, CI).
//
// ⭐ REGLE PAYEE DEUX FOIS LE 18/07/2026 : un jeu de test qui reprend MES
// hypotheses ne teste rien. Ma premiere version ecrivait kind='comic' en
// minuscules ; le catalogue reel dit « Comic » avec une majuscule, si bien que
// mon test `kind === 'comic'` n'a jamais rien matche et que 100 % des comics
// seraient partis sous la mauvaise racine. L'echantillon reproduit donc
// desormais le vocabulaire REEL, mesure dans les journaux de production :
//   kind = {"Collectible": 2690, "Comic": 16271}   (86 % de comics)
// ainsi que les formes qui font mal :
//   - plusieurs couvertures de MEME rarete dans une meme serie (collision) ;
//   - des comics SANS rarete ;
//   - des noms de collectibles en doublon dans des series differentes.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'sample');

const series = [
  { name: 'Modern Marvel S1', brand: 'Marvel', licensor: 'Disney', kind: 'Collectible' },
  { name: 'DC Classics S2', brand: 'DC', licensor: 'Warner', kind: 'Collectible' },
  { name: 'Cosmic Heroes', brand: 'Marvel', licensor: 'Disney', kind: 'Collectible' },
  { name: 'Retro Arcade', brand: 'Capcom', licensor: 'Capcom', kind: 'Collectible' },
  // Comics : le nom recopie souvent la serie et la rarete est le vrai
  // discriminant -> c'est ce qui justifie /comics/<serie>/<rarete>/.
  { name: 'The Cimmerian #1 (2020)', brand: 'Ablaze', licensor: 'Ablaze', kind: 'Comic' },
  { name: 'Alias #1 (2001)', brand: 'Marvel', licensor: 'Disney', kind: 'Comic' },
  { name: 'Daredevil #168 (1964)', brand: 'Marvel', licensor: 'Disney', kind: 'Comic' },
  { name: 'Avengers vs X-Men #10 (2012)', brand: 'Marvel', licensor: 'Disney', kind: 'Comic' },
  // Serie a COUVERTURES : plusieurs couvertures partagent la meme rarete, donc
  // la rarete seule ne suffit pas a distinguer les adresses. C'est le cas reel
  // observe sur « Star Wars Return of the Jedi Comic #1: Poster Series ».
  { name: 'Return of the Jedi #1: Poster Series', brand: 'Marvel', licensor: 'Disney', kind: 'Comic', couvertures: true },
  // Comics SANS rarete renseignee : l'adresse doit retomber sur le nom.
  { name: 'Zombie Hunter Spider-Man #1', brand: 'Marvel', licensor: 'Disney', kind: 'Comic', sansRarete: true },
];
const rarities = ['Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Secret Rare'];
const couvertures = ['Alex Ross Main Cover', 'Adi Granov Main Cover', 'Bill Sienkiewicz Original Main Cover', 'Todd McFarlane Variant'];
const heroes = ['Spider-Man','Iron Man','Batman','Superman','Wolverine','Thor','Flash','Hulk','Venom','Mega Man','Ryu','Groot','Loki','Joker','Storm','Vision','Rocket','Gamora','Zangief','Doctor Strange'];

let seed = 42;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

const cat = [];
const prices = [];
const baselines = [];

// 90 items : assez pour exercer les quotas, les collisions et le plafond par
// serie sans allonger le build hors-ligne.
const N = 90;
for (let i = 0; i < N; i++) {
  const uuid = `sample-${String(i).padStart(4, '0')}-${Math.floor(rnd() * 1e6)}`;
  const s = series[i % series.length];
  const estComic = s.kind === 'Comic';
  let rarity;
  if (s.sansRarete) rarity = '';
  else if (s.couvertures) rarity = rarities[Math.floor(i / series.length) % 2];  // 2 raretes seulement -> collisions
  else if (estComic) rarity = rarities[Math.floor(i / series.length) % rarities.length];
  else rarity = pick(rarities);
  let name;
  if (s.couvertures) name = `${s.name} - ${couvertures[Math.floor(i / series.length) % couvertures.length]}`;
  else if (estComic) name = s.name;
  else name = `${heroes[i % heroes.length]} ${['','Variant','Gold','Prime'][i % 4]}`.trim();
  const tirage = [500, 1000, 2500, 5000, 10000][i % 5];
  const store = [10, 20, 30, 60, 100][i % 5];
  const start = new Date(Date.UTC(2021, 9 + (i % 3), 1 + (i % 20)));
  let floor = Math.round((store * (2 + rnd() * 8)) * 100) / 100;
  let listings = 5 + Math.floor(rnd() * 60);
  const hist = [];
  const months = Math.max(12, Math.round((Date.now() - start.getTime()) / (30.44 * 86400000)));
  for (let m = 0; m < months; m++) {
    const d = new Date(start); d.setUTCMonth(d.getUTCMonth() + m);
    if (d > new Date()) break;
    const recent = (Date.now() - d.getTime()) < 100 * 86400000;
    // ⭐ REPRODUIT LE MODE DE PANNE REEL : le backfill a densifie les
    // collectibles bien plus vite que les comics. C'est precisement ce
    // desequilibre qui a fait evincer 100 % des comics par un classement au
    // nombre de releves. Un echantillon equilibre ne l'aurait jamais montre.
    const densite = estComic ? 1 : 4;
    const pts = densite * (recent ? 8 + Math.floor(rnd() * 8) : 1 + Math.floor(rnd() * 3));
    for (let p = 0; p < pts; p++) {
      const day = new Date(d); day.setUTCDate(1 + Math.floor(rnd() * 27));
      const boom = m < 6 ? 1.25 : m < 14 ? 0.93 : 0.995;
      floor = Math.max(store * 0.6, Math.round(floor * boom * (0.9 + rnd() * 0.22) * 100) / 100);
      listings = Math.max(1, listings + Math.floor(rnd() * 9) - 4);
      hist.push({ ts: day.toISOString().replace('.000', ''), floor, listings });
    }
  }
  hist.sort((a, b) => a.ts.localeCompare(b.ts));
  for (const h of hist) prices.push(`${uuid},${h.ts},${h.floor},${h.listings}`);
  const fl = hist.map((h) => h.floor).sort((a, b) => a - b);
  const q = (p) => fl[Math.min(fl.length - 1, Math.floor(fl.length * p))];
  const last = hist[hist.length - 1];
  baselines.push(`${uuid},${hist.length},${fl[0]},${q(0.05)},${q(0.25)},${q(0.5)},${q(0.75)},${q(0.95)},${fl[fl.length-1]},${last.listings},${last.listings},${last.floor},${last.listings}`);
  // ═══════════════════════════════════════════════════════════════════════
  // 🔴🔴🔴 LOT 118 — L'ÉCHANTILLON AVAIT 15 COLONNES, LA PRODUCTION EN A 22
  // ═══════════════════════════════════════════════════════════════════════
  // Mesuré le 10/08 : `dataset.mjs` lit `c.image`, `c.veve_url`, `c.ath_date`,
  // `c.atl_date`, `c.description`, `c.season`, `c.start_year` — SEPT colonnes
  // qui n'existaient pas ici. Tout banc joué hors réseau les voyait donc
  // TOUJOURS vides, c'est-à-dire qu'il ne pouvait pas distinguer « ce champ
  // est absent du catalogue » de « ce champ n'est pas dans l'échantillon ».
  // ⭐⭐⭐ UN ÉCHANTILLON QUI N'A PAS LA FORME DE LA PRODUCTION NE MESURE PAS
  // LA PRODUCTION — c'est la QUATRIÈME fois sur ce fichier, après `kind`
  // ('comic' contre 'Comic'), l'en-tête de `prices_baselines`, et les uuid
  // `sample-…` qui font sortir la réserve vide. La règle est écrite dix lignes
  // plus bas depuis le 18/07 : *l'échantillon copie le schéma de la SOURCE.*
  // ⚠️ L'ORDRE DES COLONNES N'A AUCUN EFFET : `warehouse.mjs` construit un
  // objet PAR NOM d'en-tête (l. ~150). Ce qui compte est que les noms soient
  // exacts, pas leur rang.
  //
  // ⭐ `edition_type` NE VAUT PLUS « Standard » POUR TOUT LE MONDE, et c'est
  // le cœur du lot 118. Le vrai catalogue y met SOIT un numéro, SOIT une
  // mention. Répartition mesurée sur les 19 415 lignes de `elements_v3.csv` :
  //     numéros 1..N ≈ 60 %  ·  FE 978  ·  FA 784  ·  CE 301  ·  AP 107
  //     vides 639  ·  7 aberrations (« 1&2 », « 65.DEATHS »)
  // On reproduit LES CINQ FORMES, y compris celles qui font mal : sans elles,
  // `test:edition` serait vert sans avoir rien vu passer.
  // ⛔⛔ ON NE TIRE PAS DANS `rnd()` ICI, ET C'EST UNE LEÇON PAYÉE À L'INSTANT.
  //    `rnd()` est une suite pseudo-aléatoire SEMÉE : chaque appel décale tous
  //    les suivants. Ma première version tirait l'édition et l'image dedans —
  //    résultat, `prices.csv` changeait sur 54 525 lignes alors que je n'avais
  //    touché qu'au catalogue. Le fichier restait juste ; le DIFF, lui,
  //    devenait illisible, et un diff illisible est un diff qu'on ne relit pas.
  //    ⭐⭐⭐ *Consommer une suite déterministe au milieu d'un générateur
  //    déplace tout ce qui vient après, sans rien casser.* Même famille que le
  //    paramètre ajouté au milieu d'une signature : rien n'échoue, tout glisse.
  //    ⇒ On DÉRIVE de l'uuid, qui est déjà stable. Aucun tirage consommé, le
  //      reste de l'échantillon ne bouge pas d'un octet.
  const EDITIONS = ['1', '2', '3', 'FA', 'FE', 'AP', 'CE', '', '65.DEATHS'];
  let semence = 0;
  for (let k = 0; k < uuid.length; k++) semence = (semence * 31 + uuid.charCodeAt(k)) >>> 0;
  const edition = EDITIONS[semence % EDITIONS.length];
  // ⭐ Une image sur six MANQUE, délibérément : 6 609 comics du catalogue réel
  //   n'ont pas d'`image_url` (`ARCHIVE_HEADER` jette 14 des 25 champs). Un
  //   échantillon où toutes les images existent laisserait passer un gabarit
  //   qui plante ou qui réserve un cadre vide quand elle manque.
  const image = (semence % 6 === 0) ? '' : `https://exemple.invalid/i/${uuid}.jpg`;
  cat.push([uuid,s.kind,name,edition,rarity,start.toISOString().slice(0,10),s.name,s.brand,s.licensor,tirage,store,last.floor,last.listings,fl[fl.length-1],fl[0],
    // ath_date, atl_date : ISO court, comme la source.
    hist[hist.length-1].ts.slice(0,10), hist[0].ts.slice(0,10),
    image,
    // ⚠️ `veve_url` : le vrai catalogue porte `https://www.veve.me/...`. On
    //   garde un domaine `.invalid` (RFC 2606) — un échantillon ne doit pas
    //   pouvoir émettre une requête réelle si un banc suivait ses liens.
    `https://exemple.invalid/veve/${uuid}`,
    // description / season / start_year : lues par `dataset.mjs`, jamais
    // présentes ici jusqu'ici. Vides pour `season` : c'est le cas MAJORITAIRE
    // en production, et un échantillon qui remplit tout ne teste jamais le
    // repli « pas de saison ».
    'Description de demonstration.', '', String(start.getUTCFullYear()),
  ].join(','));
}

// 🔴 LOT 118 — 22 COLONNES, comme la production. Voir le bloc au-dessus.
// ⛔ Toute colonne ajoutée ici doit l'être AUSSI dans le `cat.push(...)`, dans
//    le même ordre : un en-tête plus long que ses lignes décale TOUT ce qui
//    suit, silencieusement, et `warehouse.mjs` associera des valeurs à des noms
//    voisins sans qu'aucune erreur ne soit levée.
writeFileSync(join(OUT, 'catalogue.csv'), 'uuid,kind,name,edition_type,rarity,release_date,series,brand,licensor,tirage,store_price,floor,listings,ath,atl,ath_date,atl_date,image,veve_url,description,season,start_year\n' + cat.join('\n') + '\n');
writeFileSync(join(OUT, 'prices.csv'), 'veve_uuid,ts_utc,floor,listings\n' + prices.join('\n') + '\n');
// ⚠️ EN-TETE REEL de prices_baselines, copie de scraper/price_baseline.py.
// Mon en-tete invente (p50, p95 sans prefixe) a produit un defaut MUET : le
// classement par mediane et l'avertissement « prix non representatif » etaient
// inoperants en production alors que tout passait au vert en local.
// C'est la 3e fois qu'un echantillon ecrit selon MES conventions masque la
// realite (apres kind='comic' au lieu de 'Comic'). Regle : l'echantillon copie
// le schema de la SOURCE, jamais l'inverse.
writeFileSync(join(OUT, 'prices_baselines.csv'), 'veve_uuid,n_points,floor_min,floor_p5,floor_p25,floor_p50,floor_p75,floor_p95,floor_max,listings_p50,listings_p90,last_floor,last_listings\n' + baselines.join('\n') + '\n');

const parKind = {};
for (const l of cat) { const k = l.split(',')[1]; parKind[k] = (parKind[k] || 0) + 1; }
console.log(`echantillon: ${cat.length} items ${JSON.stringify(parKind)}, ${prices.length} points de prix`);
