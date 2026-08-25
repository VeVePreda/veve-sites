// ⚠️ DEPOT : VeVePreda/veve-sites  ·  CHEMIN : engine/data/warehouse.mjs
//
// Accès à l'entrepôt de données jetonveve.
// Lit les releases publiques (CSV.gz par URL). Repli automatique sur la
// release N-1 (`-prev`), puis sur un échantillon local (build hors-ligne).
import { gunzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const SAMPLE_DIR = join(ROOT, 'engine', 'data', 'sample');
const REPO = process.env.WAREHOUSE_REPO || 'fanablefrance/jetonveve';
const OFFLINE = process.env.WAREHOUSE_OFFLINE === '1';
const base = (tag, file) => `https://github.com/${REPO}/releases/download/${tag}/${file}`;

const SOURCES = {
  catalogue: {
    url: process.env.CATALOGUE_URL || base('catalogue', 'catalogue.csv.gz'),
    prev: base('catalogue-prev', 'catalogue.csv.gz'),
    sample: 'catalogue.csv',
  },
  prices: {
    url: process.env.PRICES_URL || base('prices-full', 'prices.csv.gz'),
    prev: base('prices-full-prev', 'prices.csv.gz'),
    sample: 'prices.csv',
  },
  baselines: {
    url: process.env.BASELINES_URL || base('prices-full', 'prices_baselines.csv.gz'),
    prev: base('prices-full-prev', 'prices_baselines.csv.gz'),
    sample: 'prices_baselines.csv',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LES RELEVES HORODATES — lot 144, 13/08/2026
  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐ « QUAND CE PRIX A-T-IL ETE OBSERVE ? » — la seule question a laquelle
  // aucun autre fichier de l'entrepot ne repond. `prices.csv.gz` est
  // append-on-change : sa derniere ligne date le CHANGEMENT, jamais
  // l'OBSERVATION. Une piece stable depuis six mois y a un `last_ts` de six
  // mois, et elle a pourtant ete relevee ce matin. Les deux horloges ne sont
  // pas la meme, et les confondre est ce qui a produit ce lot.
  //
  // Schema, releve dans `floor-watch.yml` (144-A, en prod depuis 09:15 UTC) :
  //     veve_uuid, ts_releve, source, floor, unite
  // · `ts_releve` : EPOCH EN SECONDES, entier (`"%.0f" % v[4]`).
  // · `source`    : `stackr` (floor OMI) ou `veve` (floor USD).
  // · `floor`     : ⚠️ `repr` de flottant Python — `900000.0`. Le `"%.0f"` du
  //   workflow s'applique au TS, pas au floor. ⇒ `Number()` cote lecteur,
  //   ⛔ jamais `parseInt`, ⛔ jamais la chaine brute a l'ecran.
  // · `unite`     : OMI ou USD. ⛔⛔ DEUX MARCHES, PAS DEUX UNITES — rapport
  //   non constant (mediane 4 423, p10 2 273, p90 8 520 sur 1 306 items
  //   communs). AUCUNE conversion, ici ni ailleurs.
  //
  // 🔴 PLUSIEURS LIGNES PAR PIECE, ET LA PREMIERE EST LA PLUS ANCIENNE.
  // Mesure du 13/08 sur le fichier PUBLIE : 3 470 uuid sur 7 416 (47 %) portent
  // deux lignes, et le writer trie sur `(uuid, ts)` — donc la premiere ligne
  // d'un uuid est sa plus VIEILLE, 3 470 fois sur 3 470, sans exception. Un
  // lecteur qui garde la premiere publierait une date perimee de 2,9 j en
  // mediane, 23,8 j au maximum, EN SORTANT VERT. ⇒ le lecteur retient `MAX(ts)`.
  //
  // ⛔ PAS DE `prev` — ET C'EST MESURE, PAS OMIS. La release
  // `etat-floor-watch-prev` N'EXISTE PAS (404 sur l'API le 13/08). Une entree
  // `prev` fantome ferait deux choses, toutes deux mauvaises : une requete
  // perdue a chaque build, et surtout un `noterRepli()` joignable — donc, sous
  // `WAREHOUSE_REFUSE_PREV=1`, un `throw` que `chargerFacultatif()` avalerait.
  // Un secours qui n'existe pas ne se declare pas.
  releves: {
    url: process.env.RELEVES_URL || base('etat-floor-watch', 'releves.csv'),
    sample: 'releves.csv',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 💱 LE COURS OMI → USD — lot 181, 24/08/2026
  // ═══════════════════════════════════════════════════════════════════════════
  // Deux lignes, ~40 octets : `omi_usd, ts_utc`. Écrit par `floor-watch.yml`
  // (fanablefrance/jetonveve) dans la MÊME étape que `releves.csv`, depuis la
  // MÊME source — le cours que `floor_watch.py` relève déjà à chaque tour pour
  // ses alertes, et qu'il jetait.
  //
  // ⛔ IL N'AUTORISE PAS LA CONVERSION QUE LE BLOC CI-DESSUS INTERDIT. Le
  // commentaire de `releves` dit ⛔ ne jamais convertir `sfloors` (OMI) en
  // `vfloors` (USD) : deux MARCHÉS, rapport non constant. Cela reste vrai et
  // ce fichier n'y change rien. Ce cours-ci convertit un montant DANS SA
  // PROPRE DEVISE — le prix du jeton, coté sur uniswap. La règle complète et
  // le seuil de péremption vivent dans `engine/lib/taux_omi.mjs`.
  //
  // ⛔ PAS DE `prev`, POUR LA RAISON DE `releves` : `etat-floor-watch-prev`
  // n'existe pas. Un secours qui n'existe pas ne se déclare pas.
  // ⚠️ `sample` EST DÉCLARÉ ET LE FICHIER N'EXISTE PAS — C'EST DÉLIBÉRÉ, ET
  // CE N'EST PAS LA MÊME CHOSE QUE DE L'OMETTRE. `readSample()` (l. 211) fait
  // `join(SAMPLE_DIR, file)` : avec `undefined`, Node lève un TypeError
  // « Path must be a string », que `chargerFacultatif()` attraperait — la
  // bonne conséquence (pas de cours) obtenue par une exception, donc un
  // journal qui accuse le chargeur d'un défaut qui n'existe pas. Déclaré, le
  // chemin est valide, `existsSync` rend faux, et la fonction rend `[]`
  // proprement. ⭐ Le résultat est le même ; ce qui change, c'est ce que lira
  // la personne qui débogue.
  // ⛔ NE PAS CRÉER `engine/data/sample/omi_usd.csv`. Hors-ligne, il n'y a pas
  // de cours à inventer : le build CI (`WAREHOUSE_OFFLINE=1`) doit rendre une
  // fiche SANS équivalent dollar. Un échantillon ferait juger aux 46 bancs une
  // condition qui n'existe pas en production.
  omiUsd: {
    url: process.env.OMI_USD_URL || base('etat-floor-watch', 'omi_usd.csv'),
    sample: 'omi_usd.csv',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 🛰️ LES FICHES StackR — lot 190, 25/08/2026
  // ═══════════════════════════════════════════════════════════════════════════
  // Écrit par `scraper/stackr_fiches.py` (fanablefrance/jetonveve), publié dans
  // la release `etat-fiches-stackr`. Schéma relevé sur le fichier PUBLIÉ le
  // 25/08 (2 000 lignes, en-tête compris) :
  //     veve_uuid, famille, ts_releve, floor_veve_usd, floor_stackr_omi,
  //     in_circulation, editions_burnt, issued, offres_en_cours, market_fee,
  //     floor_maj
  //
  // ⭐⭐ CE QU'IL APPORTE ET QUE PERSONNE N'AVAIT : les éditions BRÛLÉES et la
  // circulation réelle. `issued` dit combien de pièces ont été frappées ;
  // `in_circulation` combien en restent. L'écart est le nombre de pièces
  // détruites — un chiffre qu'aucune autre source du projet ne porte.
  //
  // 🔴🔴 ROTATION, PAS BALAYAGE : LA COUVERTURE EST PARTIELLE ET LE RESTERA
  // DIX JOURS. Le collecteur prend 2 000 items par run sur 19 774 ; au
  // 25/08 le curseur était à 2 000, soit ~10 % du catalogue. ⛔ UNE COLONNE
  // VIDE DOIT SE DIRE, JAMAIS S'INVENTER : un item non encore visité n'a pas
  // « zéro brûlée », il n'a RIEN. Les gabarits affichent « — », et c'est la
  // seule chose vraie qu'ils puissent afficher.
  //
  // ⛔ PAS DE `prev` : `etat-fiches-stackr-prev` n'existe pas. Un secours qui
  // n'existe pas ne se déclare pas (même raison que `releves` et `omiUsd`).
  //
  // ⚠️⚠️ ET L'ÉCHANTILLON EST **PARTIEL**, DÉLIBÉRÉMENT — ⛔ NE PAS LE COMPLÉTER.
  // C'est l'inverse du choix fait pour `omi_usd.csv` (pas d'échantillon du
  // tout), et la raison est la même règle prise dans l'autre sens : *un chemin
  // de code jamais emprunté n'est pas sûr, il est non mesuré.* Ici DEUX chemins
  // doivent vivre en même temps — « la fiche a ses chiffres StackR » et « elle
  // ne les a pas encore » — parce que c'est exactement l'état de la production
  // pendant toute la rotation. Un échantillon complet rendrait la branche
  // « — » invisible aux 46 bancs ; un échantillon vide rendrait l'autre
  // invisible. Il couvre donc une PARTIE des uuid de `catalogue.csv`.
  fichesStackr: {
    url: process.env.FICHES_STACKR_URL || base('etat-fiches-stackr', 'fiches_stackr.csv'),
    sample: 'fiches_stackr.csv',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LES DÉRIVÉS DU GRAND LIVRE — lot 44, 03/08/2026
  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐⭐ RIEN À CALCULER, RIEN À PUBLIER : CES FICHIERS EXISTENT DÉJÀ.
  // `scraper/ledger_derived.py` (jetonveve) les produit dans `derived/`, et
  // `analytics.yml` fait `gh release upload analytics-derived derived/*` — un
  // GLOB, donc tout y passe. La release `analytics-derived-prev` porte le N-1,
  // exactement comme `prices-full-prev`.
  //
  // ⚠️ J'AVAIS CONCLU L'INVERSE. Cherchant `pulse.csv` dans les workflows, je
  // n'avais rien trouvé et j'en avais déduit que le fichier n'était pas publié.
  // ⭐⭐⭐ **Une recherche par NOM DE FICHIER ne trouve jamais un glob.**
  // L'absence de mention n'est pas l'absence de publication : il faut lire ce
  // que la commande ENVOIE, pas chercher le nom qu'on attend.
  //
  // ⛔ CES DONNÉES SONT INTÉGRALEMENT RÉSERVÉES (arbitrage Preda du 03/08 :
  // « tout derrière le mur »). Elles ne doivent JAMAIS entrer dans `dist/` —
  // elles s'écrivent dans `.reserve/` et ne sortent que par `/api/analytics/`.
  // C'est l'architecture qui protège, pas le contrôle d'accès : la panne du
  // lot 34 n'a rien laissé fuiter POUR CETTE RAISON, pas grâce à `franchit()`.
  pulse: {
    url: base('analytics-derived', 'pulse.csv'),
    prev: base('analytics-derived-prev', 'pulse.csv'),
    sample: 'pulse.csv',
  },
  walletSize: {
    url: base('analytics-derived', 'wallet_size.csv'),
    prev: base('analytics-derived-prev', 'wallet_size.csv'),
    sample: 'wallet_size.csv',
  },
  whales: {
    url: base('analytics-derived', 'whales.csv'),
    prev: base('analytics-derived-prev', 'whales.csv'),
    sample: 'whales.csv',
  },
  corner: {
    url: base('analytics-derived', 'corner_full.csv.gz'),
    prev: base('analytics-derived-prev', 'corner_full.csv.gz'),
    sample: 'corner_full.csv',
  },
  // ⭐ LOT 166 — LES AGRÉGATS DE PROFIL, COMPTÉS EN AMONT ET NON ICI.
  // 708 492 wallets se comptent dans `ledger_derived.py` (jetonveve) en 0,1 s,
  // et arrivent ici en 249 lignes. 🔴 C'est un CHIFFRE qui a décidé ça, pas un
  // goût : agréger la table complète côté site coûtait **480 Mo de RSS** sur un
  // VPS de 7,8 Go dont le build meurt déjà en silence à l'étape 31/55.
  // ⛔ Ne jamais « simplifier » en relisant `profiles_full.csv.gz` (24 Mo gzip).
  profilsAgregats: {
    url: base('analytics-derived', 'profils_agregats.csv'),
    prev: base('analytics-derived-prev', 'profils_agregats.csv'),
    sample: 'profils_agregats.csv',
  },
  metaLedger: {
    url: base('analytics-derived', 'meta_ledger.csv'),
    prev: base('analytics-derived-prev', 'meta_ledger.csv'),
    sample: 'meta_ledger.csv',
  },
};

// ===========================================================================
// ⭐⭐ LE REPLI N-1 NE PASSE PLUS EN SILENCE  (A3, 29/07/2026)
// ===========================================================================
// Il y avait DEUX replis muets dans ce fichier, pas un : `load()` (catalogue,
// baselines) et `streamPrices` (prix). Tous deux parcourent `[url, prev]` et
// se contentaient d'un `console.warn` sur l'echec de la fraiche : la lecture
// sur la release N-1 reussissait, le build restait VERT, et rien ne disait
// que le site venait d'etre construit sur l'identite de la veille.
//
// ⭐ La nuance qui fait tout : ce repli n'est PAS un defaut partout.
//    · `rebuild-daily`  -> reconstruire sur des donnees d'hier est un
//      comportement degrade ACCEPTABLE : demain rattrape.
//    · `freeze-slugs`   -> le gel est IRREVERSIBLE. Geler les adresses sur
//      `catalogue-prev` grave A VIE l'identite d'AVANT l'uniformisation.
//      Ce n'est pas degrade, c'est definitif.
//
// D'ou la forme : le repli CRIE toujours, et il n'est FATAL que la ou
// l'appelant le demande (`WAREHOUSE_REFUSE_PREV=1`). Un garde-fou qui casse
// tout casse aussi ce qu'il fallait laisser passer, et on finit par le
// desarmer -- voir D3 du plan.
const REFUSE_PREV = process.env.WAREHOUSE_REFUSE_PREV === '1';

// ⭐ Un marqueur LITTERAL et unique. `freeze-slugs.yml` greppait
// `catalogue-prev`, c'est-a-dire un fragment d'URL : ca ne couvrait ni les
// prix ni les baselines, et ca cassait au premier renommage de release.
export const MARQUEUR_REPLI = '[entrepot][REPLI-N-1]';

const REPLIS = [];
/** Les replis N-1 subis depuis le demarrage du process. */
export const getReplis = () => REPLIS.slice();
/** Remise a zero — pour les bancs de test uniquement. */
export const _resetReplis = () => { REPLIS.length = 0; };

function noterRepli(name, url) {
  if (!REPLIS.some((r) => r.source === name)) REPLIS.push({ source: name, url });
  console.warn(`${MARQUEUR_REPLI} ${name} : source fraiche injoignable, LU SUR LA RELEASE N-1 ${url}`);
  // Annotation GitHub Actions : visible dans le resume du run, pas seulement
  // noyee dans 3 000 lignes de log.
  console.warn(`::warning title=Entrepot en repli N-1::${name} a ete lu sur la release N-1 (${url}). Les donnees ont un jour de retard.`);
  if (REFUSE_PREV) {
    throw new Error(
      `${MARQUEUR_REPLI} ${name} : repli sur la release N-1 REFUSE (WAREHOUSE_REFUSE_PREV=1). ` +
      `Cette etape ecrit quelque chose d'irreversible : elle exige la source fraiche. ` +
      `Relancer quand ${SOURCES[name] ? SOURCES[name].url : name} sera de nouveau joignable.`);
  }
}

export function parseCSV(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows.shift().map((h) => h.trim());
  return rows
    .filter((r) => r.some((v) => v !== ''))
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, r[idx] ?? ''])));
}

async function fetchTable(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const text = url.endsWith('.gz') ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
  return parseCSV(text);
}

function readSample(file) {
  const p = join(SAMPLE_DIR, file);
  if (!existsSync(p)) return [];
  return parseCSV(readFileSync(p, 'utf8'));
}

const cache = new Map();

export async function load(name) {
  if (cache.has(name)) return cache.get(name);
  const src = SOURCES[name];
  if (!src) throw new Error(`source inconnue: ${name}`);
  let rows = null;
  // ⭐ On retient le RANG lu, pas l'URL : `CATALOGUE_URL` peut surcharger la
  // fraiche, et comparer deux chaines aurait rate le cas ou la surcharge
  // pointe deja la release N-1.
  let rangLu = -1;
  if (!OFFLINE) {
    // ⭐ `.filter(Boolean)` — une source PEUT n'avoir aucun secours N-1, et
    // `fetch(undefined)` leverait une erreur qu'on relirait comme « la release
    // N-1 est injoignable ». Un rang qui n'existe pas ne doit pas produire un
    // echec qui ressemble a un rang qui a echoue.
    const urls = [src.url, src.prev].filter(Boolean);
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        rows = await fetchTable(url);
        if (rows.length) {
          rangLu = i;
          console.log(`[entrepot] ${name}: ${rows.length} lignes depuis ${url}`);
          break;
        }
      } catch (e) {
        console.warn(`[entrepot] ${name}: echec ${url} (${e.message})`);
        rows = null;
      }
    }
    // ⛔⛔ HORS du try/catch, et c'est le cœur du correctif. Appele a
    // l'interieur, le `throw` de `noterRepli()` serait avale par le `catch`
    // ci-dessus, relu comme « echec de la release N-1 » — et le refus se
    // serait transforme en un repli de plus, silencieux lui aussi.
    if (rangLu > 0) noterRepli(name, urls[rangLu]);
  }
  if (!rows || !rows.length) {
    // Le repli sur l'echantillon n'est autorise QUE si on l'a demande
    // explicitement. Sinon on echoue : publier de fausses donnees serait
    // pire que de laisser en ligne la version precedente.
    if (!OFFLINE && process.env.ALLOW_SAMPLE !== '1') {
      throw new Error(
        `[entrepot] ${name} : source ET secours N-1 injoignables. ` +
        `Build interrompu volontairement pour ne pas publier de donnees d'exemple.`);
    }
    rows = readSample(src.sample);
    console.log(`[entrepot] ${name}: ECHANTILLON local (${rows.length} lignes)`);
  }
  cache.set(name, rows);
  return rows;
}


// ═══════════════════════════════════════════════════════════════════════════
// UNE SOURCE FACULTATIVE — lot 144
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 CE LOT A FAILLI ETRE ECRIT SUR UNE ANALOGIE FAUSSE, ET ELLE AURAIT
// PRODUIT UN DEPLOIEMENT ROUGE, PAS UNE DATE ABSENTE.
// Le plan disait : « ajouter `releves` dans SOURCES, lue sans etre exigee,
// comme `nomComic` au 01/08 ». Or `nomComic` est une COLONNE d'une source deja
// chargee : absente, elle vaut `null` et rien ne s'affiche. `releves` est une
// SOURCE : `load()` **`throw`** quand la fraiche ET le secours N-1 echouent
// (l. ~205, correctif A3 du 29/07), et le build du `Dockerfile` tourne RESEAU
// OUVERT, sans `WAREHOUSE_OFFLINE=1`.
// ⭐⭐⭐ L'ANALOGIE CHANGEAIT DE COUCHE. Une colonne facultative n'est pas une
// source facultative. La verification n'etait pas dans le plan, elle etait dans
// les `throw` du chargeur. → [[regle-analogie-qui-change-de-couche]]
//
// ⛔ POURQUOI PAS ASSOUPLIR `load()` : ses deux `throw` sont precisement ce
// qu'un lot a ferme expres, pour que le repli N-1 CRIE. Y ajouter une porte
// muette rouvre en une ligne ce qui a coute un correctif entier.
// ⛔ POURQUOI PAS UN `try/catch` CHEZ L'APPELANT : `load()` met en CACHE. Un
// echec attrape apres mise en cache se relirait comme « 0 ligne » pour les six
// gabarits, sans que rien ne le dise.
//
// ⭐ Cette porte-ci CRIE (`console.warn` + annotation GitHub), rend `[]`, et
// **ne met pas le vide en cache** : un 404 passager ne doit pas geler la date
// pour tout le reste du build.
// 🔴🔴 ET ELLE RE-LEVE LE REFUS DE REPLI. `WAREHOUSE_REFUSE_PREV=1` (pose par
// `freeze-slugs`, dont le gel est IRREVERSIBLE) fait `throw` a `noterRepli()`.
// Avaler celui-la transformerait un refus deliberement fatal en un repli
// silencieux de plus — exactement la panne que le correctif A3 a fermee.
// ⭐⭐ « Un garde-fou qui casse tout casse aussi ce qu'il fallait laisser
// passer » : on laisse passer l'absence, on ne laisse pas passer le refus.
export async function chargerFacultatif(name) {
  try {
    return await load(name);
  } catch (e) {
    if (String(e && e.message).includes(MARQUEUR_REPLI)) throw e;
    console.warn(`[entrepot] ${name} : source FACULTATIVE absente (${e.message}) — on continue sans.`);
    console.warn(`::warning title=Source facultative absente::${name} n'a pas ete lue. Les fiches diront qu'elles ne connaissent pas leur date de relevement.`);
    cache.delete(name);
    return [];
  }
}


// --- Lecture EN FLUX de l'historique des prix -------------------------------
// Ce fichier grandit sans limite (append-on-change sur 18 900 items) : le
// charger en entier fait exploser la memoire du build. On le traite donc
// ligne par ligne, et l'appelant ne garde que ce dont il a besoin.
import { createGunzip } from 'node:zlib';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';

async function consumeStream(stream, onRow) {
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let idx = null;
  let n = 0;
  for await (const line of rl) {
    if (!line) continue;
    const cols = line.split(',');
    if (idx === null) {
      const h = cols.map((c) => c.trim());
      idx = {
        uuid: h.indexOf('veve_uuid') >= 0 ? h.indexOf('veve_uuid') : h.indexOf('uuid'),
        ts: h.indexOf('ts_utc') >= 0 ? h.indexOf('ts_utc') : h.indexOf('ts'),
        floor: h.indexOf('floor'),
        listings: h.indexOf('listings'),
      };
      continue;
    }
    onRow(cols, idx);
    n++;
  }
  return n;
}

export async function streamPrices(onRow) {
  const src = SOURCES.prices;
  if (!OFFLINE) {
    const urls = [src.url, src.prev];
    let rangLu = -1;
    let lues = 0;
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const res = await fetch(url, { redirect: 'follow' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let stream = Readable.fromWeb(res.body);
        if (url.endsWith('.gz')) stream = stream.pipe(createGunzip());
        lues = await consumeStream(stream, onRow);
        rangLu = i;
        console.log(`[entrepot] prix : ${lues} lignes lues EN FLUX depuis ${url}`);
        break;
      } catch (e) {
        console.warn(`[entrepot] prix : echec ${url} (${e.message})`);
      }
    }
    // ⛔ Meme piege qu'au-dessus : le `return` etait DANS le `try`, donc toute
    // annonce posee la aurait ete avalee par le `catch`. On sort d'abord.
    if (rangLu >= 0) {
      if (rangLu > 0) noterRepli('prices', urls[rangLu]);
      return lues;
    }
  }
  if (!OFFLINE && process.env.ALLOW_SAMPLE !== '1') {
    throw new Error('[entrepot] prix : source ET secours N-1 injoignables. Build interrompu volontairement.');
  }
  const p = join(SAMPLE_DIR, src.sample);
  if (existsSync(p)) {
    const n = await consumeStream(createReadStream(p), onRow);
    console.log(`[entrepot] prix : ECHANTILLON local (${n} lignes, en flux)`);
    return n;
  }
  console.warn('[entrepot] prix : aucune source disponible');
  return 0;
}

export const getCatalogue = () => load('catalogue');
export const getBaselines = () => load('baselines');

// ⭐ FACULTATIF, ET LE NOM DE LA FONCTION LE DIT. Le jour ou quelqu'un le
// remplacera par `load('releves')` « pour faire comme les autres », il aura
// devant les yeux la seule ligne qui explique pourquoi ce n'en est pas un.
export const getReleves = () => chargerFacultatif('releves');
// 🛰️ FACULTATIF, ET C'EST LA BONNE FORME. Si la release `etat-fiches-stackr`
//   disparaît ou tarde, la fiche perd ses chiffres StackR et rien d'autre —
//   ⛔ le build ne doit pas mourir pour un enrichissement. Voir le bloc de
//   `SOURCES.fichesStackr` : la couverture est de toute façon partielle, donc
//   « absent » est un état NORMAL que les gabarits savent déjà rendre.
export const getFichesStackr = () => chargerFacultatif('fichesStackr');

// 💱 FACULTATIF POUR LA MÊME RAISON, ET D'UN CRAN PLUS : `releves` manquant
// prive les fiches de leur DATE de relèvement ; `omiUsd` manquant ne prive que
// d'un équivalent en dollars, sous un montant qui reste affiché. Le jour où la
// chaîne jetonveve s'arrête, la fiche perd la ligne « ≈ $… » et rien d'autre.
// ⛔ Ne jamais le passer à `load()` : le premier build après ce lot tourne
//    AVANT le premier run de `floor-watch.yml` qui pose le fichier — la
//    release ne le porte pas encore, et `load()` interromprait le déploiement.
export const getOmiUsd = () => chargerFacultatif('omiUsd');

// Les dérivés du grand livre. ⚠️ Réservés : ne jamais les passer à un composant
// rendu au build — ils vont dans `.reserve/`, servis par `/api/analytics/`.
export const getPulse = () => load('pulse');
export const getWalletSize = () => load('walletSize');
export const getWhales = () => load('whales');
export const getCorner = () => load('corner');
export const getProfilsAgregats = () => load('profilsAgregats');
export const getMetaLedger = () => load('metaLedger');
