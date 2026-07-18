// Modele de donnees du site.
// REGLES (spec v3) :
//  - on ne publie QUE des fiches utiles (seuil de releves)
//  - l'historique public est tronque AU NIVEAU DE LA DONNEE
//  - les variations ne sont calculees que si elles ont un sens statistique
//  - l'historique des prix est lu EN FLUX : la memoire ne depend pas de la
//    taille du fichier, qui grandit indefiniment avec le backfill.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getCatalogue, getBaselines, streamPrices } from '../data/warehouse.mjs';
import { manifest, SITE } from './manifest.mjs';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const DAY = 86400000;

// Les deux types publies, et la RACINE D'ADRESSE de chacun.
// Racines au PLURIEL (decision Preda 18/07) : /collectibles/ et /comics/.
export const TYPES = ['collectible', 'comic'];
export const RACINE = { collectible: 'collectibles', comic: 'comics' };
const RACINES_VALIDES = new Set(Object.values(RACINE));

export const slugify = (s) =>
  String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';

const num = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
// Comme num(), mais 0 et les valeurs negatives comptent pour « inconnu ».
const pos = (v) => { const n = num(v); return n && n > 0 ? n : null; };

function pctChange(hist, days, o) {
  if (hist.length < o.minPoints) return null;
  const last = hist[hist.length - 1];
  if (!last || !last.floor) return null;
  const cutoff = Date.now() - days * DAY;
  // Sans releve RECENT, la variation est inconnue - pas nulle. Afficher
  // « 0,0 % » ferait croire a une stabilite qui n'a jamais ete mesuree.
  if (new Date(last.ts).getTime() < cutoff) return null;
  let ref = null;
  for (const p of hist) { if (new Date(p.ts).getTime() <= cutoff) ref = p; }
  if (!ref || ref.ts === last.ts) return null;          // une seule et meme mesure
  if (!ref.floor || ref.floor < o.minRef) return null;
  const v = ((last.floor - ref.floor) / ref.floor) * 100;
  if (!Number.isFinite(v) || Math.abs(v) > o.maxAbs) return null;
  return v;
}

let _ds = null;

// Le vocabulaire du champ « kind » du catalogue n'est pas garanti. Mesure en
// production le 18/07 : {"Collectible":2690,"Comic":16271} -> MAJUSCULE
// initiale. Mon test initial `kind === 'comic'` n'aurait jamais rien matche.
// On accepte donc toute variante contenant « comic », sans casse.
function estComic(kind) {
  return /comic/i.test(String(kind || ''));
}
export const typeDe = (c) => (estComic(c.kind) ? 'comic' : 'collectible');

// Chez les comics, le nom recopie tres souvent la serie
// (« Return of the Jedi #1: Poster Series - Alex Ross Main Cover »). Comme la
// serie est DEJA un segment de l'adresse, la repeter donnerait
// /comics/return-of-the-jedi-1-poster-series/common-return-of-the-jedi-1-poster-series-alex-ross...
// On ne garde donc que ce qui distingue reellement la couverture. Meme regle
// que pour les titres et le fil d'Ariane, appliquee aux adresses.
function sansPrefixeSerie(nom, serie) {
  const n = String(nom || '').trim();
  const s = String(serie || '').trim();
  if (!s) return n;
  // Nom STRICTEMENT egal a la serie : rien de distinctif du tout.
  if (n.toLowerCase() === s.toLowerCase()) return '';
  if (n.length <= s.length) return n;
  if (n.slice(0, s.length).toLowerCase() !== s.toLowerCase()) return n;
  // Chaine VIDE si le nom ne fait que recopier la serie : il n'y a alors rien
  // de distinctif a mettre dans l'adresse, et repeter la serie
  // (/comics/alias-1-2001/common-alias-1-2001/) serait du bruit pur.
  // L'appelant enchaine alors sur l'identifiant court.
  return n.slice(s.length).replace(/^[\s\-–—:,.·|]+/, '').trim();
}

// SECRET_RARE -> Secret Rare
function jolieRarete(r) {
  return String(r).toLowerCase().split(/[_\s]+/).filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

// ═══ SCORE D'UTILITE ═══
// On NE classe PLUS par nombre de releves. Les prix sont enregistres AU
// CHANGEMENT : ce nombre mesure surtout (a) jusqu'ou le backfill est alle et
// (b) a quel point le prix flotte. Il fait donc remonter les pieces bavardes
// et bon marche -- et c'est lui qui a laisse les collectibles evincer 100 %
// des comics de la vitrine.
// Le score croise ce que le produit PROMET (un historique profond) avec ce
// que les gens CHERCHENT (des pieces qui valent quelque chose). Les
// logarithmes empechent l'un des deux facteurs d'ecraser l'autre : un item a
// 10 000 $ ne doit pas passer devant tout le reste au seul titre de son prix.
// ⚠️ LE PRIX UTILISE ICI EST LA MEDIANE, PAS LE DERNIER FLOOR.
// Constate en production le 18/07 : le marche VeVe contient de vraies annonces
// farceuses (« Faces of The ADDICTION » a 42 420 420 420 420, une seule offre).
// Un score bati sur le dernier floor les propulsait en tete du classement et
// donc en page d'accueil — la vitrine d'un tracker de prix s'ouvrait sur un
// prix de 42 000 milliards. Une mediane, elle, ne bouge pas pour une annonce
// isolee. Regle generale : classer sur une statistique ROBUSTE, jamais sur la
// derniere valeur observee.
function scoreUtilite(c) {
  const debut = Date.parse(c.since);
  const jours = Number.isFinite(debut) ? Math.max(1, (Date.now() - debut) / DAY) : 1;
  const valeur = Math.max(1, c.prixMedian || c.floor || 0);
  return Math.log1p(jours) * Math.log1p(valeur);
}

// ═══ ADRESSES GELEES : migration + hygiene ═══
// Reecrit une table slugs.json heritee et ecarte ce qui n'est plus servable.
// Exporte car freeze-slugs.mjs doit appliquer EXACTEMENT la meme regle avant
// de reecrire le fichier -- sinon la migration ne vivrait qu'en memoire et le
// disque garderait les anciennes adresses.
export function migrerRacines(map) {
  const out = {};
  let migres = 0;
  const abandonnes = [];
  for (const [uuid, p] of Object.entries(map || {})) {
    if (typeof p !== 'string' || !p.startsWith('/')) continue;
    const np = p
      .replace(/^\/collectible\//, '/collectibles/')
      .replace(/^\/comic\//, '/comics/');
    const racine = np.split('/')[1];
    if (!RACINES_VALIDES.has(racine)) {
      // Typiquement une table gelee du temps des adresses plates /item/<nom>/,
      // qui ne sont plus servies par aucune route (aucune redirection : une
      // /item/ a designe deux objets differents dans la meme journee). La
      // conserver epinglerait la fiche sur une adresse qui n'existe pas.
      abandonnes.push(p);
      continue;
    }
    if (np !== p) migres++;
    out[uuid] = np;
  }
  return { map: out, migres, abandonnes };
}

// ⚠️ MEMOISER LA PROMESSE, PAS LE RESULTAT.
// 18 fichiers de route appellent dataset() et Astro les evalue EN PARALLELE.
// Si l'on ne memorise qu'a la fin (apres le telechargement et la lecture en
// flux), chaque appel voit encore null et relance un flux complet du fichier
// de prix : 18 lectures simultanees de centaines de Mo = build a genoux.
// Invisible sur l'echantillon, fatal sur les vraies donnees.
let _promesse = null;
export function dataset() {
  if (!_promesse) _promesse = construireDataset();
  return _promesse;
}

// Quotas par type, lus au manifeste. Retrocompatible : un ancien manifeste
// qui ne connait que `max_items` continue de fonctionner (tout le budget va
// aux collectibles + report, donc comportement inchange).
function quotasDuManifeste(pub) {
  const q = pub.quotas;
  if (q && typeof q === 'object') {
    const out = {};
    for (const t of TYPES) out[t] = Math.max(0, Number(q[t]) || 0);
    return out;
  }
  const total = pub.max_items ?? 0;
  return { collectible: total, comic: 0 };
}

async function construireDataset() {
  if (_ds) return _ds;
  const m = manifest();
  const pub = m.publication || {};
  const MIN_POINTS = pub.min_price_points ?? 8;
  const MAX_POINTS = pub.public_points_max ?? 30;
  const WINDOW_DAYS = pub.public_history_days ?? 90;
  const MAX_SERIE = Math.max(0, Number(pub.max_new_per_series) || 0);   // 0 = pas de plafond
  const SPILL = pub.quota_spillover !== false;
  const FACTEUR_ABERRANT = Math.max(2, Number(pub.outlier_factor) || 10);
  const CHANGE = { minPoints: 5, minRef: 1, maxAbs: 300 };

  const [cat, baselines] = await Promise.all([getCatalogue(), getBaselines()]);

  // --- Agregation EN FLUX -------------------------------------------------
  // Par item on ne retient que : le nombre total de releves, la date du
  // premier, et une courte queue des derniers points. La memoire depend du
  // nombre d'items (~19 000), JAMAIS de la taille du fichier de prix.
  const known = new Set();
  for (const c of cat) { const u = c.uuid || c.veve_uuid; if (u) known.add(u); }
  const cutoffTs = Date.now() - WINDOW_DAYS * DAY;
  const BUCKET_MS = Math.max(1, Math.floor((WINDOW_DAYS / MAX_POINTS) * DAY));
  const agg = new Map();
  await streamPrices((cols, idx) => {
    const u = cols[idx.uuid];
    if (!u || !known.has(u)) return;   // on ignore ce qui n'est pas au catalogue
    const f = Number(cols[idx.floor]);
    if (!Number.isFinite(f)) return;
    const ts = cols[idx.ts];
    let a = agg.get(u);
    if (!a) { a = { n: 0, first: ts, buckets: new Map(), tail: [] }; agg.set(u, a); }
    a.n++;
    if (ts < a.first) a.first = ts;
    const pt = { ts, floor: f, listings: Number(cols[idx.listings]) || 0 };
    // repli : les tout derniers releves, quel que soit leur age (les prix sont
    // enregistres AU CHANGEMENT : un item stable n'a rien de recent).
    a.tail.push(pt);
    if (a.tail.length > 5) a.tail.shift();
    // courbe publique : un point par tranche, etale sur la fenetre.
    const t = new Date(ts).getTime();
    if (Number.isFinite(t) && t >= cutoffTs) {
      a.buckets.set(Math.floor(t / BUCKET_MS), pt);
      if (a.buckets.size > MAX_POINTS) a.buckets.delete(Math.min(...a.buckets.keys()));
    }
  });

  const bl = new Map();
  for (const b of baselines) bl.set(b.veve_uuid || b.uuid, b);
  // ⭐ Le schema de l'entrepot n'est pas fige : on le JOURNALISE au lieu de le
  // supposer. Un champ absent ne provoque aucune erreur, il rend juste une
  // valeur nulle — le defaut le plus difficile a voir. C'est exactement ce qui
  // a rendu le classement par mediane inoperant pendant un deploiement entier.
  if (baselines.length) {
    console.log(`[entrepot] colonnes de prices_baselines : ${Object.keys(baselines[0]).join(', ')}`);
  }

  const pinPath = join(ROOT, 'sites', SITE, 'slugs.json');
  let pinned = {};
  if (existsSync(pinPath)) {
    try {
      const brut = JSON.parse(readFileSync(pinPath, 'utf8'));
      const mig = migrerRacines(brut);
      pinned = mig.map;
      if (mig.migres) console.log(`[adresses] ${mig.migres} adresses gelees migrees vers les racines au pluriel`);
      if (mig.abandonnes.length) console.log(`[adresses] ATTENTION ${mig.abandonnes.length} adresses gelees ecartees (racine inconnue, ex. ${mig.abandonnes[0]})`);
    } catch (e) { console.log(`[adresses] slugs.json illisible (${e.message}) : on repart sans gel`); }
  }

  // --- Candidats ----------------------------------------------------------
  const candidates = [];
  let refusesSeuil = 0;
  for (const c of cat) {
    const uuid = c.uuid || c.veve_uuid;
    if (!uuid) continue;
    const a = agg.get(uuid);
    if (!a || a.n < MIN_POINTS) { refusesSeuil++; continue; }   // <<< SEUIL : pas de page creuse
    const byTs = (x, y) => String(x.ts).localeCompare(String(y.ts));
    const spread = [...a.buckets.values()].sort(byTs);
    const publicHist = spread.length >= 2 ? spread : [...a.tail].sort(byTs);
    if (publicHist.length < 2) { refusesSeuil++; continue; }    // courbe illisible = pas de page
    const b = bl.get(uuid) || {};
    const item = {
      uuid,
      name: c.name || 'Sans nom',
      kind: c.kind || 'collectible',
      rarity: c.rarity || '',
      series: c.series || '',
      brand: c.brand || '',
      licensor: c.licensor || '',
      releaseDate: c.release_date || '',
      tirage: num(c.tirage),
      storePrice: num(c.store_price),
      floor: num(c.floor) ?? publicHist[publicHist.length - 1].floor,
      listings: num(c.listings) ?? publicHist[publicHist.length - 1].listings,
      // Un catalogue qui renvoie 0 veut dire « je ne sais pas », pas « zero ».
      // `??` ne rattrape PAS un 0 : la fiche affichait « plus haut historique : 0 »
      // juste au-dessus d'un prix a 42 000 milliards.
      ath: pos(c.ath) ?? pos(b.floor_max),
      atl: pos(c.atl) ?? pos(b.floor_min),
      // ⚠️ NOMS REELS DES COLONNES (verifies dans scraper/price_baseline.py) :
      // floor_min, floor_p5, floor_p25, floor_p50, floor_p75, floor_p95,
      // floor_max, listings_p50... — les percentiles sont PREFIXES.
      // J'avais ecrit `p50`/`p95` d'apres mon echantillon : silencieusement
      // null en production, donc score et avertissement inoperants. Comme
      // floor_min/floor_max, eux, coincidaient, l'ATH s'est reparé et le reste
      // non — le defaut etait invisible. Les alias sont gardes par prudence.
      // PAS DE REPLI SUR UN AUTRE PERCENTILE : se rabattre sur floor_p25
      // reviendrait a classer sur une autre statistique sans le dire, et
      // masquerait un changement de schema — la faute meme qu'on repare ici.
      // Absence = null = le journal et le test le crient.
      prixMedian: pos(b.floor_p50) ?? pos(b.p50) ?? null,
      p95: pos(b.floor_p95) ?? pos(b.p95) ?? null,
      offresMedianes: pos(b.listings_p50) ?? null,
      history: publicHist,
      points: publicHist.length,
      totalPoints: a.n,
      since: a.first,
      change7d: pctChange(publicHist, 7, CHANGE),
      change30d: pctChange(publicHist, 30, CHANGE),
    };
    item.type = typeDe(item);
    item.racine = RACINE[item.type];
    // PRIX NON REPRESENTATIF. On ne censure pas la donnee — elle est vraie — mais
    // on refuse de la presenter comme un prix de marche. Le repere est le p95 de
    // l'objet LUI-MEME : chaque piece est comparee a sa propre histoire, jamais a
    // une echelle globale (un objet a 5 000 gems n'a rien d'anormal en soi).
    const repere = item.p95 || item.prixMedian;
    item.prixAberrant = !!(repere && item.floor && item.floor > repere * FACTEUR_ABERRANT);
    item.offreUnique = (item.listings ?? 0) <= 1;
    item.score = scoreUtilite(item);
    candidates.push(item);
  }
  agg.clear();                                           // on libere tout de suite

  // ⭐ NOM D'AFFICHAGE. Chez les comics, le nom recopie tres souvent la serie
  // en prefixe (« Return of the Jedi #1: Poster Series - Alex Ross Main Cover »).
  // Comme le titre ajoute deja la serie et que le fil d'Ariane la porte, la
  // garder donnait des titres de 111 a 128 caracteres, tronques par Google, et
  // la meme suite de mots deux fois dans la meme balise. On ne conserve donc
  // que ce qui distingue reellement l'objet. Chaine vide (= nom identique a la
  // serie) -> on garde le nom, c'est Item.astro qui evitera la repetition.
  for (const c of candidates) c.nomAffiche = sansPrefixeSerie(c.name, c.series) || c.name;

  // Desambiguisation des noms : on ajoute la rarete UNIQUEMENT aux items
  // dont le couple (nom, collection) est partage. Un titre doit etre unique.
  // ⚠️ Les passes ci-dessous travaillent sur le nom D'AFFICHAGE : c'est lui qui
  // finit dans la balise <title>, donc c'est SON unicite qu'il faut garantir.
  const cles = new Map();
  for (const c of candidates) {
    const k = `${c.nomAffiche}|${c.series}`;
    cles.set(k, (cles.get(k) || 0) + 1);
  }
  for (const c of candidates) {
    const k = `${c.nomAffiche}|${c.series}`;
    c.ambigu = cles.get(k) > 1;
    c.qualifie = c.ambigu && c.rarity ? `${c.nomAffiche} · ${jolieRarete(c.rarity)}` : c.nomAffiche;
  }
  // Deuxieme passe : si le nom qualifie reste ambigu (meme nom, meme collection,
  // meme rarete), on ajoute le tirage, puis en dernier recours un rang. On veut
  // une garantie d'unicite PAR CONSTRUCTION, pas une esperance.
  const cles2 = new Map();
  for (const c of candidates) {
    const k = `${c.qualifie}|${c.series}`;
    cles2.set(k, (cles2.get(k) || 0) + 1);
  }
  const rangs = new Map();
  for (const c of candidates) {
    const k = `${c.qualifie}|${c.series}`;
    if (cles2.get(k) <= 1) continue;
    const r = (rangs.get(k) || 0) + 1;
    rangs.set(k, r);
    c.qualifie = c.tirage ? `${c.qualifie} · ${c.tirage}` : `${c.qualifie} · ${r}`;
  }
  // Le tirage peut lui aussi etre identique : on tranche definitivement.
  const vus = new Set();
  for (const c of candidates) {
    let q = `${c.qualifie}|${c.series}`;
    if (!vus.has(q)) { vus.add(q); continue; }
    let i = 2;
    while (vus.has(`${c.qualifie} (${i})|${c.series}`)) i += 1;
    c.qualifie = `${c.qualifie} (${i})`;
    vus.add(`${c.qualifie}|${c.series}`);
  }

  // ═══ CLASSEMENT ═══
  // Departage entierement deterministe (score, puis releves, puis uuid) : deux
  // builds successifs sur les memes donnees produisent le meme classement.
  const parScore = (a, b) =>
    b.score - a.score ||
    b.totalPoints - a.totalPoints ||
    String(a.uuid).localeCompare(String(b.uuid));
  candidates.sort(parScore);

  // ═══ SELECTION : QUOTA PAR TYPE ═══
  // Un plafond global unique a produit un angle mort mesure en production :
  // les comics sont 86 % du catalogue et representaient 0 % du site, parce que
  // les collectibles (que le backfill densifie plus vite) raflaient les 400
  // places. Chaque type recoit desormais sa part garantie.
  // ⭐ Le quota est une TAILLE CIBLE, pas un debit : les fiches deja gelees le
  // consomment. Sinon le site grossirait de 1 200 pages a chaque passage, sans
  // que personne ne l'ait decide -- et c'est irreversible (ensemble collant).
  const quotas = quotasDuManifeste(pub);
  const dejaPublie = candidates.filter((c) => pinned[c.uuid]);
  const nouvelles = candidates.filter((c) => !pinned[c.uuid]);
  const compte = (l) => l.reduce((o, c) => (o[c.type]++, o), { collectible: 0, comic: 0 });
  const acquis = compte(dejaPublie);
  const places = {};
  for (const t of TYPES) places[t] = Math.max(0, quotas[t] - acquis[t]);

  // Plafond de diversite par serie, applique aux SEULS entrants.
  // Motif propre aux comics : avec /comics/<serie>/<rarete>/, une seule serie
  // peut produire des dizaines de pages qui ne different que par la rarete et
  // le prix. Sans plafond, une serie tres tradee mange le quota entier et la
  // vitrine devient un mur de quasi-doublons -- exactement le profil que
  // Google qualifie de contenu produit a grande echelle.
  const parSerie = new Map();
  const retenues = { collectible: [], comic: [] };
  let recalesSerie = 0;
  const cleSerie = (c) => `${c.type}|${slugify(c.series)}`;
  const prendre = (c) => {
    const k = cleSerie(c);
    parSerie.set(k, (parSerie.get(k) || 0) + 1);
    retenues[c.type].push(c);
  };
  for (const c of nouvelles) {
    if (retenues[c.type].length >= places[c.type]) continue;
    if (MAX_SERIE > 0 && (parSerie.get(cleSerie(c)) || 0) >= MAX_SERIE) { recalesSerie++; continue; }
    prendre(c);
  }

  // Report du quota inutilise. Si peu de comics passent le seuil de releves,
  // on ne retrecit pas le site pour rien : les places libres retournent au
  // classement general. L'inverse vaut aussi.
  let reporte = 0;
  if (SPILL) {
    let libre = TYPES.reduce((n, t) => n + Math.max(0, places[t] - retenues[t].length), 0);
    if (libre > 0) {
      const pris = new Set([...retenues.collectible, ...retenues.comic].map((c) => c.uuid));
      for (const c of nouvelles) {
        if (libre <= 0) break;
        if (pris.has(c.uuid)) continue;
        if (MAX_SERIE > 0 && (parSerie.get(cleSerie(c)) || 0) >= MAX_SERIE) continue;
        prendre(c);
        pris.add(c.uuid);
        libre--; reporte++;
      }
    }
  }

  const items = [...dejaPublie, ...retenues.collectible, ...retenues.comic].sort(parScore);

  // ═══ ADRESSES ═══
  // Hierarchie par type (decision Preda 18/07, racines au pluriel) :
  //   collectibles : /collectibles/<serie>/<nom>/
  //   comics       : /comics/<serie>/<rarete>/   <- chez les comics le nom
  //                  recopie souvent la serie ; la rarete est le vrai
  //                  discriminant (une serie = plusieurs couvertures).
  // L'attribution est DETERMINISTE et independante des donnees de prix : on
  // parcourt par uuid (immuable), jamais par classement. Sinon l'adresse
  // /item/batgirl/ change d'objet d'un jour a l'autre (constate en prod).
  const seen = new Set();
  const ordreStable = [...items].sort((a, b) => {
    const pa = pinned[a.uuid] ? 0 : 1;
    const pb = pinned[b.uuid] ? 0 : 1;
    return pa - pb || String(a.uuid).localeCompare(String(b.uuid));
  });
  const suffixeUuid = (u) => String(u).replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase();
  let comicsSansRarete = 0;
  let collisionsComics = 0;
  for (const i of ordreStable) {
    i.serieSlug = slugify(i.series) || 'sans-collection';
    i.legacySlug = slugify(i.name);
    if (pinned[i.uuid]) { i.path = pinned[i.uuid]; seen.add(i.path); continue; }
    const rareteSlug = i.rarity ? slugify(i.rarity) : '';
    // Ce qui distingue vraiment cette couverture, une fois retire le prefixe
    // qui recopie la serie (chaine vide si le nom EST la serie).
    const distinctif = sansPrefixeSerie(i.name, i.series);
    const nomCourt = distinctif ? slugify(distinctif) : '';
    // Feuille des comics : reglable au manifeste (publication.comic_leaf).
    //  'rarity' (defaut, choix Preda) -> /comics/alias-1-2001/secret-rare/
    //  'name'                         -> /comics/<serie>/<nom de la couverture>/
    // Sans rarete ET sans nom distinctif, l'identifiant court vaut mieux que
    // /comics/zombie-hunter-spider-man-1/zombie-hunter-spider-man-1/ : repeter
    // la serie n'apprend rien au lecteur et ressemble a du bourrage de mots-cles.
    const feuilleComic = (pub.comic_leaf || 'rarity') === 'name'
      ? (nomCourt || i.legacySlug)
      : rareteSlug;
    if (i.type === 'comic' && !rareteSlug) comicsSansRarete++;
    const principal = i.type === 'comic'
      ? (feuilleComic || nomCourt || suffixeUuid(i.uuid))
      : i.legacySlug;
    // Repli en cas de collision. Chez un comic, deux couvertures peuvent
    // partager la rarete dans la meme serie : on ajoute alors le NOM DE LA
    // COUVERTURE ("...-adi-granov-main-cover"), qu'un humain comprend, plutot
    // qu'un suffixe technique. L'identifiant court reste le dernier recours.
    const secours = i.type === 'comic'
      ? ((nomCourt && nomCourt !== principal) ? `${principal}-${nomCourt}` : `${principal}-${suffixeUuid(i.uuid)}`)
      : `${i.legacySlug}-${rareteSlug || 'edition'}`;
    let feuille = principal || 'sans-nom';
    const libre = (f) => !seen.has(`/${i.racine}/${i.serieSlug}/${f}/`);
    if (!libre(feuille)) { feuille = secours; if (i.type === 'comic') collisionsComics++; }
    if (!libre(feuille)) feuille = `${principal}-${suffixeUuid(i.uuid)}`;
    i.path = `/${i.racine}/${i.serieSlug}/${feuille}/`;
    seen.add(i.path);
  }

  const bySlug = new Map(items.map((i) => [i.path, i]));
  const collections = new Map();
  for (const i of items) {
    if (!i.series) continue;
    const s = slugify(i.series);
    if (!collections.has(s)) collections.set(s, { slug: s, name: i.series, brand: i.brand, items: [] });
    collections.get(s).items.push(i);
  }
  const rarities = new Map();
  for (const i of items) {
    if (!i.rarity) continue;
    const s = slugify(i.rarity);
    if (!rarities.has(s)) rarities.set(s, { slug: s, name: i.rarity, items: [] });
    rarities.get(s).items.push(i);
  }

  const withChange = items.filter((i) => i.change7d !== null);
  const movers = {
    up: [...withChange].filter((i) => i.change7d > 0).sort((a, b) => b.change7d - a.change7d).slice(0, 20),
    down: [...withChange].filter((i) => i.change7d < 0).sort((a, b) => a.change7d - b.change7d).slice(0, 20),
  };

  // ═══ DIAGNOSTIC EMBARQUE ═══
  // Un seul deploiement doit suffire a comprendre ce que la vitrine a fait et
  // pourquoi. C'est ce journal, pas une intuition, qui a revele que « kind »
  // valait « Comic » avec une majuscule et que 0 comic etait publie.
  const parTypeCat = {};
  for (const c of cat) { const k = String(c.kind || '(vide)'); parTypeCat[k] = (parTypeCat[k] || 0) + 1; }
  const eligibles = compte(candidates);
  const publies = compte(items);
  console.log(`[entrepot] valeurs du champ kind dans le catalogue : ${JSON.stringify(parTypeCat)}`);
  console.log(`[vitrine] catalogue ${cat.length} · sous le seuil de ${MIN_POINTS} releves : ${refusesSeuil} · eligibles ${JSON.stringify(eligibles)}`);
  console.log(`[vitrine] quotas ${JSON.stringify(quotas)} · deja geles ${JSON.stringify(acquis)} · places offertes ${JSON.stringify(places)}${SPILL ? ` · report ${reporte}` : ''}${MAX_SERIE ? ` · ecartes par le plafond de ${MAX_SERIE}/serie : ${recalesSerie}` : ''}`);
  console.log(`[vitrine] PUBLIE ${items.length} fiches ${JSON.stringify(publies)} (${dejaPublie.length} deja gelees + ${items.length - dejaPublie.length} nouvelles)`);
  const avecMediane = items.filter((i) => i.prixMedian).length;
  console.log(`[vitrine] prix median disponible pour ${avecMediane}/${items.length} fiches (c'est lui qui pilote le classement)`);
  if (items.length && !avecMediane) {
    console.log('[vitrine] ATTENTION AUCUNE mediane trouvee : le classement retombe sur le dernier prix, donc les annonces farceuses remontent. Verifier les colonnes de prices_baselines ci-dessus.');
  }
  const aberrants = items.filter((i) => i.prixAberrant).length;
  if (aberrants) console.log(`[vitrine] ${aberrants} fiches au prix non representatif (offre isolee au-dela de ${FACTEUR_ABERRANT}x leur p95) : signalees sur la fiche`);
  if (comicsSansRarete) console.log(`[adresses] ATTENTION ${comicsSansRarete} comics sans rarete : adresse basee sur le nom de couverture, ou l'identifiant court s'il n'y a rien de distinctif`);
  if (collisionsComics) console.log(`[adresses] ${collisionsComics} comics en collision de rarete : nom de couverture ajoute a l'adresse`);
  for (const t of TYPES) {
    if (quotas[t] > 0 && publies[t] === 0) {
      console.log(`[vitrine] ATTENTION AUCUN ${t} publie alors que le quota est de ${quotas[t]} — eligibles : ${eligibles[t]}`);
    }
  }

  _ds = {
    items, bySlug, collections, rarities, movers,
    catalogueSize: cat.length,
    windowDays: WINDOW_DAYS,
    maxPoints: MAX_POINTS,
    quotas, eligibles, publies,
    updatedAt: new Date().toISOString(),
  };
  return _ds;
}
