// Modele de donnees du site.
// REGLES (spec v3) :
//  - on ne publie QUE des fiches utiles (seuil de releves)
//  - l'historique public est tronque AU NIVEAU DE LA DONNEE
//  - les variations ne sont calculees que si elles ont un sens statistique
//  - l'historique des prix est lu EN FLUX : la memoire ne depend pas de la
//    taille du fichier, qui grandit indefiniment avec le backfill.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { projeter as projeterCote, CHAMPS_COTE } from './cote.mjs';
import { getCatalogue, getBaselines, streamPrices } from '../data/warehouse.mjs';
import { manifest, SITE } from './manifest.mjs';
import { porte } from './access.mjs';
import { jourISO } from './vitrine.mjs';   // 🔴 LOT 113 — JJ/MM/AAAA, jamais `new Date(chaine)`
// ⭐ LA RÉSERVE — l'historique COMPLET, écrit HORS de dist/, pour la route
// `/api/historique/[uuid]`. Elle se greffe sur LA passe de prix qui a DÉJÀ
// lieu ici : `streamPrices` n'est pas mis en cache (contrairement à `load()`),
// un second script retéléchargerait le fichier entier — et `test:donnees`
// interdit une seconde construction du jeu de données, précisément pour ça.
import * as reserve from './reserve.mjs';

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
  // ⭐ Les plafonds de l'historique public sont un REGLAGE D'ACCES, pas un
  // reglage de publication : un quota de vitrine decide QUELLES fiches
  // existent, un palier decide CE QU'ON MONTRE d'une fiche qui existe. Les
  // confondre a deja produit l'angle mort des comics. Ils sont donc lus par
  // la matrice — et par elle seule.
  // Porte inactive (site entierement gratuit) => Infinity, c'est-a-dire
  // « aucune troncature ». Les deux branches sont couvertes par test_access.
  const PORTE_PRIX = porte('price_history');
  const MAX_POINTS = PORTE_PRIX.public_max;
  const WINDOW_DAYS = PORTE_PRIX.public_days;
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
  // ⭐⭐ LA RÉSERVE NE S'OUVRE QUE SI LE SITE VEND DE LA PROFONDEUR.
  // Porte inactive = tout l'historique est déjà public (vevewiki, ou un site
  // entièrement gratuit) : écrire une réserve coûterait des dizaines de Mo
  // dans l'image pour protéger ce que la page donne déjà. Le manifeste décide,
  // le code obéit — comme pour le thème, la palette et le mode de rendu.
  if (PORTE_PRIX.actif) reserve.ouvrir();
  // Porte inactive : pas de fenetre (on remonte a l'origine) et une tranche
  // d'1 ms, donc un seau par releve — la courbe garde tout. Le calcul du seau
  // ne doit JAMAIS voir un Infinity : (Inf/Inf) donne NaN, et un NaN en cle de
  // seau ne provoque aucune erreur — il ecrase tout dans une seule tranche.
  const BORNE = Number.isFinite(WINDOW_DAYS) && Number.isFinite(MAX_POINTS);
  const cutoffTs = Number.isFinite(WINDOW_DAYS) ? Date.now() - WINDOW_DAYS * DAY : -Infinity;
  const BUCKET_MS = BORNE ? Math.max(1, Math.floor((WINDOW_DAYS / MAX_POINTS) * DAY)) : 1;
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
    // ⛔ UNE SEULE LIGNE, ET ELLE EST À SA PLACE. C'est le seul endroit du
    // moteur où chaque relèvé passe une fois et une seule. La réserve
    // bufferise et vide sur disque : la promesse de l'en-tête de cette
    // fonction (« la mémoire dépend du nombre d'items, JAMAIS de la taille du
    // fichier de prix ») reste tenue.
    reserve.point(u, ts, f, pt.listings);
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
      // Le NUMERO du fascicule. Chez un comic, `edition_type` porte le
      // `comicNumber` on-chain — c'est le niveau intermediaire de la hierarchie
      // serie -> numero -> rarete (cf. ADRESSES plus bas). Present dans
      // catalogue.csv.gz depuis toujours ; il n'etait simplement pas remonte.
      edition_type: c.edition_type || '',
      series: c.series || '',
      brand: c.brand || '',
      licensor: c.licensor || '',
      releaseDate: c.release_date || '',
      tirage: num(c.tirage),
      storePrice: num(c.store_price),
      // 🖼️ LE VISUEL. ⚠️ On ASSAINIT au lieu de faire confiance : une URL qui
      // vient d'un Sheet est une donnee d'entree comme une autre. Sans ce
      // filtre, une cellule contenant `javascript:` ou `data:text/html`
      // atterrirait telle quelle dans un `src` — c'est une injection, servie
      // par notre propre domaine.
      // ⭐ On n'accepte QUE du https, et rien d'autre. Une liste blanche de
      // protocoles ne se contourne pas ; une liste noire, si.
      image: (() => {
        const u = String(c.image || '').trim();
        return u.startsWith('https://') ? u : '';
      })(),
      // 🔴🔴 LOT 73 — `veve_url` ÉTAIT DANS LE CATALOGUE ET LE MOTEUR LE JETAIT.
      // ═══════════════════════════════════════════════════════════════════════
      // Preda demande un bouton « voir sur VeVe » sur la fiche. Le Marché porte
      // depuis des semaines le commentaire « ⛔ AUCUNE URL DANS LA DONNÉE, ni
      // pour VeVe ni pour StackR, ET JE N'EN FABRIQUE PAS ».
      // C'était FAUX pour VeVe : `catalogue.csv.gz` a 22 colonnes, la 12ᵉ
      // s'appelle `veve_url` et vaut
      // `https://www.veve.me/collectibles/en/collectibles/<uuid>`.
      // ⭐⭐⭐ DIXIÈME FOIS : LA DONNÉE MANQUANTE ÉTAIT DÉJÀ COLLECTÉE PUIS JETÉE.
      // Et cette fois le refus s'était CRISTALLISÉ EN RÈGLE — « on ne fabrique
      // pas d'URL » est juste, mais il servait à ne pas aller regarder si on en
      // avait une. Un principe correct devient un angle mort quand il dispense
      // de vérifier. → [[regle-donnee-collectee-puis-jetee]]
      // ⚠️ Même assainissement que `image` : https et rien d'autre. Une URL qui
      // vient d'un Sheet est une donnée d'entrée comme une autre, et un
      // `javascript:` dans un `href` est une injection servie par notre domaine.
      // ⛔ StackR n'a toujours PAS d'URL — celle-là n'existe nulle part, et on
      //    ne l'invente pas. Le bouton reste, désactivé et dit comme tel.
      veveUrl: (() => {
        const u = String(c.veve_url || '').trim();
        return u.startsWith('https://') ? u : '';
      })(),
      // ═══════════════════════════════════════════════════════════════════════
      // LOT 77 — L'ADRESSE DU MARCHÉ VEVE, ET POURQUOI ELLE NE VIOLE PAS LA RÈGLE
      // ═══════════════════════════════════════════════════════════════════════
      // `veve_url` mène à la fiche BOUTIQUE. Preda veut le MARCHÉ, et il a
      // fourni lui-même les trois motifs, relevés dans son compte :
      //   collectible          .../collectibles/en/market/collectibles/<id>
      //   comic (une rareté)   .../collectibles/en/market/comics/<id>
      //   variantes de couv.   .../collectibles/en/market/comic-covers/<id>
      //
      // ⛔ « ON NE FABRIQUE PAS D'URL » RESTE VRAI, et ceci n'en est pas une
      // fabrication : le MOTIF vient de la source (trois exemples réels), et
      // l'IDENTIFIANT vient de `veve_url`, qui prouve déjà que VeVe adresse
      // cette pièce par cet uuid-là (`/collectibles/en/collectibles/<uuid>`
      // résout et rend la bonne fiche — vérifié le 05/08).
      // ⭐⭐ LA DIFFÉRENCE EST ENTIÈRE : deviner un motif produit un lien qui a
      // l'air bon et rend 404 ; dériver un motif OBSERVÉ avec un identifiant
      // PROUVÉ produit un lien qu'un seul clic suffit à valider. On ne prend
      // pas moins de précautions, on en prend d'un autre genre.
      // ⚠️ CE QUI RESTE NON VÉRIFIÉ, ET IL FAUT LE SAVOIR : les pages Marché de
      // VeVe sont rendues en JavaScript, donc invérifiables depuis le bac à
      // sable — un mauvais uuid rendrait une page vide, pas une erreur. C'est
      // Preda qui tranche, en un clic.
      // ⛔ `comic-covers` n'est PAS produit : il désigne une SÉRIE de variantes
      //    de couverture, entité que le moteur ne porte pas. On ne devine pas
      //    un identifiant qu'on n'a pas.
      veveMarketUrl: (() => {
        const u = String(c.veve_url || '').trim();
        if (!u.startsWith('https://')) return '';
        const id = u.split('/').filter(Boolean).pop();
        if (!/^[0-9a-f-]{36}$/i.test(id)) return '';
        const rayon = String(c.kind || '').toLowerCase() === 'comic' ? 'comics' : 'collectibles';
        // 🔴🔴 REVENU À CETTE FORME LE 06/08/2026 — LE LOT 87 L'AVAIT CASSÉE.
        // J'avais retiré le segment `/collectibles` en me fondant sur le
        // paramètre `state` d'une redirection OAuth de VeVe, qui porte
        // `/en/market/collectibles/<uuid>`. Preda a fourni deux adresses réelles,
        // prises dans son propre marché : la forme ci-dessous est la BONNE, et
        // c'est elle qui s'ouvre SANS demander de se connecter.
        //   collectibles : /collectibles/en/market/collectibles/<uuid>
        //   comics       : /collectibles/en/market/comics/<uuid>
        // ⭐⭐⭐ CE QUE J'AI LU COMME UNE PANNE ÉTAIT LA PREUVE DU CONTRAIRE :
        // `/en/market/…` REDIRIGE vers la connexion, `/collectibles/en/market/…`
        // rend 200 sans rien demander. J'ai pris le 200 pour une coquille et la
        // redirection pour la vraie page — l'inverse, exactement.
        // ⭐⭐ UNE ADRESSE DÉDUITE D'UN PARAMÈTRE INTERNE N'EST PAS UNE ADRESSE
        // OBSERVÉE. Une seule question à Preda valait mieux que ce raisonnement.
        return `https://www.veve.me/collectibles/en/market/${rayon}/${id}`;
      })(),
      floor: num(c.floor) ?? publicHist[publicHist.length - 1].floor,
      listings: num(c.listings) ?? publicHist[publicHist.length - 1].listings,
      // Un catalogue qui renvoie 0 veut dire « je ne sais pas », pas « zero ».
      // `??` ne rattrape PAS un 0 : la fiche affichait « plus haut historique : 0 »
      // juste au-dessus d'un prix a 42 000 milliards.
      ath: pos(c.ath) ?? pos(b.floor_max),
      atl: pos(c.atl) ?? pos(b.floor_min),
      // 📅 Les dates des extrêmes. ⭐ Sans elles, « plus haut : 1 750 » ne dit
      // pas QUAND — et c'est la date qui transforme un nombre en information.
      // ⚠️ Repli sur les bornes de la baseline si le catalogue ne les a pas :
      // `first_ts`/`last_ts` ne sont PAS les dates des extrêmes, donc on ne s'y
      // rabat pas. Mieux vaut pas de date qu'une date fausse.
      // 📝 LA DESCRIPTION et 📕 LE VRAI TITRE DU COMIC — colonnes ajoutees a
      // `catalogue.csv.gz` le 01/08/2026 (lot scrapeur-veve du meme jour).
      // ⭐ LUES SANS ETRE EXIGEES, et c'est ce qui rend ce lot deposable AVANT
      // que la chaine de collecte ait tourne : un catalogue qui ne les porte
      // pas encore rend `null`, et les gabarits n'affichent rien. Aucune page
      // ne casse, aucune erreur, et le jour ou la colonne arrive elle
      // s'affiche sans redeploiement du site.
      // ⛔ `nomAffiche` NE REMPLACE PAS `name` : `name` nourrit le slug, et
      // les adresses sont gelees. On ajoute un champ d'AFFICHAGE a cote, on
      // ne renomme pas l'identite.
      description: String(c.description || '').trim() || null,
      nomComic: String(c.veve_comic_name || '').trim() || null,
      athDate: String(c.ath_date || '').trim() || null,
      atlDate: String(c.atl_date || '').trim() || null,
      // ═══════════════════════════════════════════════════════════════════════
      // LES SIX COLONNES QUE LE CATALOGUE PORTAIT ET QUE CE FICHIER JETAIT
      // ═══════════════════════════════════════════════════════════════════════
      // 🔴🔴 CE QU'IL FAUT AVOIR COMPRIS AVANT DE RELIRE CE BLOC.
      // Le lot 78 (cote `scrapeur-veve`) a sorti `season` de `DROP_COLUMNS` et
      // elargi `catalog_export.py`. Le message de passation en concluait que
      // « la fiche se remplit SANS lot cote site ». C'etait faux, et le
      // commentaire d'`Item.astro` l'affirmait aussi : « la fiche se remplira
      // toute seule le jour ou l'export s'elargit — aucun gabarit a retoucher ».
      // ⛔ CE FICHIER NE FAIT PAS PASSE-PLAT : il PROJETTE, champ par champ.
      // Une colonne qui n'est pas nommee ici n'existe pas pour le moteur, quoi
      // qu'en dise le CSV. Mesure du 05/08 sur le catalogue publie a 16h13 :
      // 28 colonnes, `season` remplie sur 2 720 / 2 720 collectibles — et zero
      // ligne du site l'affichait.
      // ⭐⭐⭐ ONZIEME OCCURRENCE DE « COLLECTEE PUIS JETEE », et la premiere ou
      // c'est un COMMENTAIRE RASSURANT qui a tenu lieu de verification. Les dix
      // precedentes se lisaient dans le code ; celle-ci se lisait dans une
      // phrase qui promettait que le code n'avait pas besoin d'etre lu.
      //
      // ⚠️ NOMS ET FORMATS RELEVES DANS LE CSV PUBLIE, PAS DEDUITS DU CODE
      // AMONT — et l'ecart compte :
      //   market_fee   '8.5%' (chaine, deja convertie) et NON 85 dixiemes de %.
      //                Le commentaire de `catalog_export.py` decrit son ENTREE ;
      //                appliquer /10 ici aurait divise une valeur deja divisee
      //                et affiche « 0,85 % » partout, sans qu'aucun test crie.
      //   drop_method  RESERVATION | WAITLIST | CRAFT | AUCTION (4 valeurs)
      //   is_blindbox  'TRUE' / 'FALSE' — chaines, pas des booleens JSON
      //   season       1..12, COLLECTIBLES SEULEMENT (`COMIC_QUERY` ne demande
      //                pas `series`, donc la colonne restera vide sur 🟢C-COMICS
      //                — ce n'est pas un trou a combler, c'est une frontiere)
      //   start_year   COMICS seulement, 16 560 / 16 597
      // ⭐ LUES SANS ETRE EXIGEES, comme `description` avant elles : un
      // catalogue anterieur rend `null` et la fiche est exactement celle
      // d'avant. Le lot est donc deposable meme si un export echoue.
      saison: pos(c.season),
      premiereEdition: pos(c.first_available_edition),
      anneeDebut: pos(c.start_year),
      // ⚠️ `%` RETIRE AVANT `num()` : `Number('8.5%')` rend NaN, donc `num()`
      // aurait rendu `null` sur les 19 280 lignes — un echec TOTAL et MUET,
      // impossible a distinguer d'une colonne absente.
      fraisMarche: pos(String(c.market_fee || '').replace('%', '')),
      // ⛔ BRUT, PAS TRADUIT ICI. Le moteur transporte la valeur de la source ;
      // c'est le gabarit qui decide comment la dire, et dans quelle langue.
      methodeDrop: String(c.drop_method || '').trim().toUpperCase() || null,
      // ⚠️ TRANSPORTE MAIS PAS ENCORE AFFICHE : aucune cle i18n `item.blindbox`
      // n'existe dans les 5 dictionnaires, et on n'invente pas un libelle dans
      // cinq langues sans arbitrage. Il coute zero ligne et il est le vrai
      // discriminant collectible/comic du catalogue (2 720 non vides).
      blindbox: c.is_blindbox === 'TRUE' ? true : (c.is_blindbox === 'FALSE' ? false : null),
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
    // ⭐⭐ LOT 101 — L'AMPLITUDE EST CALCULEE ICI, ET C'EST DELIBERE.
    // `ath / atl` est un RAPPORT : il ne porte aucune unite et ne permet pas
    // de reconstituer un montant (« ce jouet a fait ×12 » ne dit pas s'il vaut
    // 3 gems ou 3 000). Il reste donc public, et c'est ce qui permet a l'outil
    // d'amplitude d'`/analytics/` de continuer a faire ce pour quoi il existe :
    // montrer un VRAI outil sur de la VRAIE donnee a qui ne paie pas encore.
    // ⛔ Il DOIT etre calcule avant `projeter()` — apres, `ath` et `atl` ont
    // disparu et le rapport vaudrait `NaN`, sur toutes les lignes, en silence.
    // ⚠️ On garde le filtre historique `atl <= ath` : une paire incoherente
    // rend `null`, jamais un nombre qu'il faudrait ensuite ecarter a l'ecran.
    item.amplitude = (item.atl > 0 && item.ath > 0 && item.atl <= item.ath)
      ? item.ath / item.atl : null;
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
  //
  // ⭐⭐ TROISIEME NIVEAU (28/07/2026, decision Preda) — `comic_leaf:
  // issue-rarity` : /comics/<serie>/<numero>/<rarete>/. C'est la hierarchie de
  // VeVe lui-meme, celle que CollectScan et StackR affichent : une SERIE
  // contient des NUMEROS, un numero existe en plusieurs RARETES.
  //
  // Pourquoi il a fallu un 3e niveau, mesure sur les 16 536 comics reels une
  // fois la vraie serie on-chain adoptee :
  //
  //   serie + rarete   (l'ancien defaut)   4 738 cles · 14 452 uuid en collision
  //   nom seul         (comic_leaf: name)  4 253 cles · 16 142 en collision
  //   serie + numero + rarete             16 119 cles ·    726 en collision
  //
  // Les deux modes a DEUX niveaux s'effondrent pour la meme raison : avec une
  // vraie serie, une serie porte des dizaines de couvertures, et les 4 raretes
  // d'une meme couverture portent le MEME nom (16 536 comics pour 4 253 noms
  // distincts). Aucun des deux ne peut donc etre la feuille a lui seul.
  // Les 726 restants sont les couvertures VARIANTES d'un meme numero : le
  // repli `nomCourt` ci-dessous les nomme ("...-adi-granov-main-cover").
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
    //  'rarity' (defaut historique) -> /comics/alias-1-2001/secret-rare/
    //  'name'                       -> /comics/<serie>/<nom de la couverture>/
    //  'issue-rarity'               -> /comics/<serie>/<numero>/<rarete>/
    // Sans rarete ET sans nom distinctif, l'identifiant court vaut mieux que
    // /comics/zombie-hunter-spider-man-1/zombie-hunter-spider-man-1/ : repeter
    // la serie n'apprend rien au lecteur et ressemble a du bourrage de mots-cles.
    const mode = pub.comic_leaf || 'rarity';
    const troisNiveaux = i.type === 'comic' && mode === 'issue-rarity';
    const feuilleComic = mode === 'name' ? (nomCourt || i.legacySlug) : rareteSlug;
    if (i.type === 'comic' && !rareteSlug) comicsSansRarete++;
    const principal = i.type === 'comic'
      ? (feuilleComic || nomCourt || suffixeUuid(i.uuid))
      : i.legacySlug;
    // Le NUMERO, niveau intermediaire. ⛔ Pas `slugify(x) || 'sans-numero'` :
    // `slugify` rend deja 'item' pour une entree vide, donc le repli ne se
    // declencherait JAMAIS et 76 comics sans numero atterriraient tous sur
    // /<serie>/item/. Le defaut par repli, encore.
    const numeroSlug = troisNiveaux
      ? (String(i.edition_type || '').trim() ? slugify(i.edition_type) : 'sans-numero')
      : '';
    const prefixe = troisNiveaux
      ? `/${i.racine}/${i.serieSlug}/${numeroSlug}`
      : `/${i.racine}/${i.serieSlug}`;
    // Repli en cas de collision. Chez un comic, deux couvertures peuvent
    // partager la rarete dans la meme serie : on ajoute alors le NOM DE LA
    // COUVERTURE ("...-adi-granov-main-cover"), qu'un humain comprend, plutot
    // qu'un suffixe technique. L'identifiant court reste le dernier recours.
    const secours = i.type === 'comic'
      ? ((nomCourt && nomCourt !== principal) ? `${principal}-${nomCourt}` : `${principal}-${suffixeUuid(i.uuid)}`)
      : `${i.legacySlug}-${rareteSlug || 'edition'}`;
    let feuille = principal || 'sans-nom';
    const libre = (f) => !seen.has(`${prefixe}/${f}/`);
    if (!libre(feuille)) { feuille = secours; if (i.type === 'comic') collisionsComics++; }
    if (!libre(feuille)) feuille = `${principal}-${suffixeUuid(i.uuid)}`;
    i.path = `${prefixe}/${feuille}/`;
    seen.add(i.path);
  }

  const bySlug = new Map(items.map((i) => [i.path, i]));
  // ═════════════════════════════════════════════════════════════════════════
  // LES SETS — 🔴 LOT 71 : UN SET DE COMICS EST UN NUMÉRO, PAS UNE SÉRIE
  // ═════════════════════════════════════════════════════════════════════════
  // Preda, 05/08/2026 : « il y a un problème avec les sets, ça doit être basé
  // sur la série ; pour les comics ça ne devrait comporter que les 5 raretés
  // tout au plus, là je vois des comics d'autres séries. »
  //
  // Ce qu'il voyait, mesuré : le set « The Amazing Spider-Man Vol. 1 » réunissait
  // #1, #13, #252… — 12 fiches, 8 titres différents. Ce n'était pas un bug de
  // rendu : le regroupement se faisait sur `series`, et chez un comic `series`
  // désigne la COLLECTION ÉDITORIALE ENTIÈRE (des décennies de numéros), pas ce
  // qu'un collectionneur appelle un set.
  //
  // ⭐⭐ LE MOT « SÉRIE » NE DÉSIGNE PAS LA MÊME CHOSE DES DEUX CÔTÉS, ET C'EST
  // TOUTE LA CAUSE. Chez un collectible, `series` EST le set (« Bond 60th
  // Anniversary »). Chez un comic, le set est le NUMÉRO et ses raretés — la
  // série n'en est que le rayon. Un champ qui porte le même nom pour deux
  // granularités différentes produit un regroupement qui a l'air correct sur la
  // moitié du catalogue. → [[chantier-uniformisation-identite]]
  //
  // ⭐ `edition_type` porte le `comicNumber` on-chain (voir plus haut, l. 283) :
  // c'est déjà la clé qui sert à la hiérarchie d'adresses série → numéro →
  // rareté. On réemploie la découpe qui existe, on n'en invente pas une seconde.
  //
  // ⚠️ MESURÉ AVANT/APRÈS, pas supposé : 758 → 913 sets, plus AUCUN set de
  // comics au-dessus de 5 fiches. Les deux seuls sets à plus de 5 restants sont
  // des COLLECTIBLES (« Bond 60th Anniversary - Poster Series 2 » 7,
  // « BLACKPINK Concert Finale » 10) — et c'est correct, un set de collectibles
  // n'a pas de raison de tenir en cinq.
  //
  // ⛔ LES ADRESSES `/collection/<slug>/` CHANGENT POUR LES COMICS, et c'est
  // assumé : elles ne sont PAS dans `slugs.json` (vérifié — le gel ne couvre
  // que les 1 200 fiches). Rien ne casse ; Google devra ré-explorer.
  // ⛔ Un comic SANS numéro retombe sur sa série seule plutôt que de fabriquer
  //    un « #undefined » : on ne crée pas d'adresse à partir d'un trou.
  const cleSet = (i) => {
    if (i.type !== 'comic') return { cle: i.series, nom: i.series };
    const n = String(i.edition_type || '').trim();
    return n ? { cle: `${i.series} #${n}`, nom: `${i.series} #${n}` }
             : { cle: i.series, nom: i.series };
  };
  const collections = new Map();
  for (const i of items) {
    if (!i.series) continue;
    const { cle, nom } = cleSet(i);
    const s = slugify(cle);
    if (!collections.has(s)) collections.set(s, { slug: s, name: nom, brand: i.brand, items: [] });
    collections.get(s).items.push(i);
    // ═══════════════════════════════════════════════════════════════════════
    // 🔴 LOT 102 — L'ADRESSE DU SET, POSÉE PAR CELUI QUI LA FABRIQUE
    // ═══════════════════════════════════════════════════════════════════════
    // `Item.astro` renvoyait vers `/collection/${item.serieSlug}/`, c'est-à-dire
    // le slug de la SÉRIE. Or depuis le lot 68 (05/08) le set d'un comic n'est
    // plus la série : c'est `<série> #<numéro>` (`cleSet` ci-dessus). Les deux
    // ont divergé le jour même, en silence — mesuré le 07/08 par l'audit SEO :
    // **81 liens internes en cul-de-sac**, 27 par set, sur trois sets de comics.
    //
    // ⭐⭐⭐ ET LE FICHIER PORTAIT DÉJÀ LA LEÇON, ÉCRITE LE 29/07 : « ON LIT
    // `serieSlug`, ON NE LE RECALCULE PAS » — après 52 liens cassés par une
    // re-slugification à la main. La règle était juste et elle a été suivie.
    // Elle ne protégeait simplement pas de LIRE LE BON CHAMP : `serieSlug`
    // était devenu le mauvais, sans cesser d'être valide.
    // ⭐⭐ UN CHAMP QUI CHANGE DE SENS NE CASSE RIEN — il continue de rendre une
    // chaîne plausible. C'est la même famille que le tri sur `i.floor` du lot
    // 101 : le calcul tourne, il ne veut simplement plus dire ce qu'on croit.
    //
    // ⛔ NE PAS le recalculer dans le gabarit « puisque `cleSet` est simple » :
    // ce serait rouvrir exactement le défaut du 29/07, un cran plus loin.
    // Le slug est posé ICI, par la boucle qui crée la page de destination —
    // donc les deux ne peuvent plus diverger sans qu'aucune page n'existe.
    i.colSlug = s;
  }
  const rarities = new Map();
  for (const i of items) {
    if (!i.rarity) continue;
    const s = slugify(i.rarity);
    if (!rarities.has(s)) rarities.set(s, { slug: s, name: i.rarity, items: [] });
    rarities.get(s).items.push(i);
  }

  // ⭐⭐ LOT 101 — LES TRIS DESCENDENT ICI, ET C'EST OBLIGATOIRE.
  // `Collections.astro` et `CollectionPage.astro` triaient eux-mêmes sur
  // `i.floor`. Après `projeterCote()` ce champ n'existe plus côté public :
  // le comparateur aurait rendu `0` pour toutes les paires et le tri serait
  // devenu l'ordre d'insertion — SANS erreur, sans avertissement, et sur les
  // 8 500 pages à la fois. ⛔ C'est la signature exacte des pannes que ce dépôt
  // paie le plus cher : un calcul qui continue de tourner sur du vide.
  // ⭐ On trie donc TANT QUE LE PRIX EXISTE, et l'ORDRE DU TABLEAU devient le
  // porteur de l'information. Les gabarits ne trient plus, ils rendent.
  const parFloorDesc = (a, b) => (b.floor ?? 0) - (a.floor ?? 0);
  for (const c of collections.values()) c.items.sort(parFloorDesc);
  for (const r of rarities.values()) r.items.sort(parFloorDesc);

  const withChange = items.filter((i) => i.change7d !== null);
  const movers = {
    up: [...withChange].filter((i) => i.change7d > 0).sort((a, b) => b.change7d - a.change7d).slice(0, 20),
    down: [...withChange].filter((i) => i.change7d < 0).sort((a, b) => a.change7d - b.change7d).slice(0, 20),
  };

  // ═════════════════════════════════════════════════════════════════════════
  // 🔴 LOT 104 — LA LISTE DU MARCHE, CALCULEE ICI ET PAS DANS LE GABARIT
  // ═════════════════════════════════════════════════════════════════════════
  // ⭐⭐⭐ C'EST EXACTEMENT LE PIEGE ANNONCE VINGT LIGNES PLUS BAS, ET IL
  // ATTENDAIT. `Market.astro` (supprime au lot 101, restaure ici) faisait :
  //     .filter((i) => i.floor !== null && i.floor !== undefined)
  //     .sort((a, b) => (b.change7d ?? -Infinity) - (a.change7d ?? -Infinity))
  // Apres `projeterCote()`, `i.floor` vaut `undefined` pour TOUT LE MONDE :
  // le filtre aurait rendu une liste VIDE — une page de marche sans une seule
  // ligne, sans erreur, sans avertissement, sur un build vert. Le tri, lui,
  // aurait survecu (il porte sur `change7d`, qui reste public) : la panne
  // n'aurait donc pas eu l'air d'une panne de prix.
  // ⭐ On calcule TANT QUE LE PRIX EXISTE, et l'ORDRE DU TABLEAU porte
  // l'information. Meme regle que `collections` et `rarities` au-dessus.
  //
  // ⚠️ LE PLAFOND EST ICI AUSSI, ET C'EST VOULU. Preda : « on ne doit pas
  // charger les 1 200 lignes ». Le laisser au gabarit ferait voyager 1 200
  // objets pour en rendre 200.
  const MARCHE_MAX = 200;
  const marche = items
    .filter((i) => i.floor !== null && i.floor !== undefined)
    .sort((a, b) => (b.change7d ?? -Infinity) - (a.change7d ?? -Infinity))
    .slice(0, MARCHE_MAX);
  // ⭐ Le TOTAL avant plafond : la page annonce « 200 sur N », et N ne peut pas
  // se recalculer apres coup — `items` aura perdu `floor`.
  const marcheTotal = items.filter((i) => i.floor !== null && i.floor !== undefined).length;
  console.log(`[marche] ${marcheTotal} fiche(s) avec un plancher · ${marche.length} rendue(s) (plafond ${MARCHE_MAX})`);
  if (marcheTotal === 0) {
    console.log('[marche] ATTENTION AUCUNE fiche avec plancher : la page /market/ sortira vide. '
      + 'Verifier que ce calcul est bien AVANT projeterCote().');
  }

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

  // ⭐ LA RÉSERVE SE FERME SUR LES UUID RÉELLEMENT PUBLIÉS, ET PAS AVANT.
  // Un item du catalogue sans page ne peut être demandé par personne : garder
  // sa réserve gonflerait l'image de ~15 fois (19 242 items du catalogue
  // contre 1 200 fiches publiées) pour zéro requête servie.
  // ⚠️ Cet appel doit rester APRÈS le calcul de `items` : plus haut, la liste
  // des publiés n'existe pas encore, et un `fermer()` sans filtre garderait
  // tout — sans qu'aucune erreur ne le dise.
  reserve.fermer(new Set(items.map((i) => i.uuid)));

  // ═════════════════════════════════════════════════════════════════════════
  //  🔴 LA PROJECTION PUBLIQUE — DERNIÈRE ÉTAPE, ET ELLE DOIT LE RESTER
  // ═════════════════════════════════════════════════════════════════════════
  // Tout ce qui dépend du prix est calculé au-dessus : le score de vitrine, le
  // repère d'aberration, le tri des sets et des raretés, les mouvements. À
  // partir d'ici le prix courant n'a plus aucun lecteur légitime côté public —
  // il part dans `.reserve/cote/`, et les champs quittent les objets.
  // ⛔ NE JAMAIS remonter cet appel : au-dessus, il casserait le classement de
  // la vitrine en silence. ⛔ NE JAMAIS ajouter un calcul sur `i.floor`
  // en dessous : il lirait `undefined`.
  // ═══════════════════════════════════════════════════════════════════════
  //  🔴🔴🔴 LOT 117 — L'EMPREINTE DES PRIX, PRISE PENDANT QU'ILS EXISTENT
  // ═══════════════════════════════════════════════════════════════════════
  //  LA PANNE QU'ELLE REPARE, ET QUI DURAIT DEPUIS LE LOT 101.
  //  `engine/tools/lastmod-prix.mjs` compose, pour chaque fiche, une
  //  « substance » de 18 champs dont elle prend l'empreinte : quand
  //  l'empreinte bouge, la fiche gagne une nouvelle date au sitemap et
  //  IndexNow la repropose. Or elle tourne APRES `dataset()`, donc APRES
  //  `projeterCote()` : `floor`, `ath`, `atl`, `prixMedian` et `p95` y
  //  valaient `undefined`. Mesure du 10/08 : 5 des 18 champs morts.
  //  ⇒ UNE FICHE DONT SEUL LE PRIX BOUGEAIT NE CHANGEAIT PLUS DE DATE.
  //  Aucune erreur, aucun banc rouge, un sitemap parfaitement valide qui
  //  affirmait « rien n'a change » — c'est la signature de ce depot :
  //  ⭐⭐⭐ UN CALCUL QUI CONTINUE DE TOURNER SUR DU VIDE.
  //
  //  ⛔ POURQUOI UNE EMPREINTE ET PAS LES VALEURS. Rendre les prix a
  //  `lastmod-prix` par un canal detourne recreerait exactement le chemin que
  //  `projeter()` ferme. Une empreinte ne dit AUCUN montant ; elle dit
  //  seulement « ce n'est plus le meme ». C'est tout ce dont une date de
  //  derniere modification a besoin.
  //  ⛔ ELLE DOIT RESTER ICI, AU-DESSUS DE `projeterCote()`. Un cran plus bas
  //  elle prendrait l'empreinte de cinq `undefined` : constante, donc muette,
  //  donc pire que son absence — elle aurait l'air de marcher.
  //  ⚠️ Elle n'est PAS posee sur les items : un champ sur un item finit un
  //  jour dans un gabarit. Elle voyage a cote, dans une Map indexee par uuid.
  //  🔴🔴🔴 ELLE NE SCELLE QUE LES CHAMPS **PROJETÉS**, ET C'EST CE DÉTAIL QUI
  //  REND LE BANC CAPABLE DE ROUGIR. Première version : elle scellait aussi
  //  `listings` et `offresMedianes`. Ces deux-là SURVIVENT à la projection —
  //  donc, l'empreinte descendue par erreur sous `projeterCote()` restait
  //  DIFFÉRENTE d'une fiche à l'autre, et le contrôle « des prix différents
  //  donnent des empreintes différentes » restait VERT sur une empreinte qui
  //  ne portait plus un seul prix. Mesuré en réinjectant la panne le 10/08.
  //  ⭐⭐⭐ *Un instrument dont le signal a une seconde source de variation
  //  mesure la seconde.* Un champ survivant suffisait à maquiller neuf champs
  //  morts. Les deux publics restent dans la substance de `lastmod-prix`, où
  //  ils sont lisibles pour ce qu'ils sont.
  //  ⭐ `CHAMPS_COTE` est LU, jamais recopié : le jour où un champ y entre, il
  //  entre ici aussi, sans que personne ait à y penser.
  const sceller = (v) => createHash('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 16);
  const empreinteCote = new Map(items.map((i) => [i.uuid, sceller(CHAMPS_COTE.map((c) => i[c]))]));
  // ⭐ `/market/` est un CLASSEMENT de variations : il change des que l'ordre
  //   ou les valeurs changent. Meme raison, meme place — `change7d` part avec
  //   la cote a la ligne suivante.
  const empreinteMarche = sceller([...movers.up, ...movers.down].map((i) => [i.path, i.change7d]));

  const cote = projeterCote(items);

  // ═══════════════════════════════════════════════════════════════════════
  //  🔴🔴🔴 LOT 113 — LE RAYON : TOUT LE CATALOGUE, SANS UN SEUL PRIX
  // ═══════════════════════════════════════════════════════════════════════
  //  Arbitrage Preda du 10/08 : « lister tout le catalogue, cliquable seulement
  //  quand il y a une fiche ». Le site PUBLIE 1 200 fiches sur 19 412 (6 %) —
  //  deux filtres se cumulent, le seuil de MIN_POINTS relevés de prix puis le
  //  quota gelé. Une LIGNE DE LISTE, elle, n'a pas besoin d'une page.
  //
  //  🔴🔴 ET C'EST ICI QUE SE JOUE LA FUITE LA PLUS GROSSE QU'ON PUISSE FAIRE.
  //  `catalogue.csv` porte `floor`, `listings`, `ath`, `atl`, `ath_date`. Passer
  //  une ligne de catalogue à un gabarit, c'est publier 19 412 prix en clair —
  //  seize fois pire que la fuite que le lot 112 vient de fermer, et par un
  //  chemin que `projeter()` NE VOIT PAS : `projeter()` mute `items`, pas `cat`.
  //  ⭐⭐⭐ ON NE RETIRE DONC RIEN : ON N'AJOUTE QUE CE QU'ON NOMME. Une liste
  //  blanche se relit ; une liste noire s'oublie le jour où la source gagne une
  //  colonne. Le fichier amont a déjà gagné des colonnes sans prévenir.
  //  ⛔ `store_price` (le prix de drop) est PUBLIC et reste sur la fiche — il
  //  n'entre pas ici : une liste n'en a pas besoin, et chaque champ en plus est
  //  un champ à surveiller.
  const publiesParUuid = new Map(items.map((i) => [i.uuid, i.path]));
  const rayonDe = (c) => ({
    uuid: c.uuid || c.veve_uuid || '',
    type: estComic(c.kind) ? 'comic' : 'collectible',
    name: c.name || '',
    rarity: c.rarity || '',
    edition_type: c.edition_type || '',
    series: c.series || '',
    brand: c.brand || '',
    tirage: Number(c.tirage) || null,
    releaseDate: c.release_date || '',
    // 🖼️ LOT 118 — L'IMAGE ENTRE DANS LA LISTE BLANCHE DU RAYON.
    // Preda, 10/08 : « pas de visuel pour les sets, ni pour Coming up ». La
    // cause n'était pas le gabarit : `rayonDe()` ne nommait pas `image`, donc
    // les drops à venir n'en avaient aucune à rendre. ⭐ C'est la liste
    // blanche qui fonctionne comme prévu — on n'ajoute que ce qu'on nomme, et
    // il fallait le nommer.
    // ⚠️ MÊME ASSAINISSEMENT QUE PARTOUT : https et rien d'autre. La colonne
    // vient d'un Sheet ; un `javascript:` ou un `data:text/html` dans un `src`
    // est une injection servie par notre propre domaine. Une liste blanche de
    // protocoles ne se contourne pas, une liste noire si.
    // ⛔ CE N'EST PAS UN PRIX et ça ne le devient pas : `test:rayon` tient la
    // liste des champs INTERDITS ici (floor, listings, ath, atl…) et `image`
    // n'en fait pas partie. Le vérifier avant d'ajouter est le geste, pas le
    // fait de se le rappeler.
    image: (() => {
      const u = String(c.image || '').trim();
      return u.startsWith('https://') ? u : '';
    })(),
    // ⭐ LE LIEN N'EXISTE QUE SI LA FICHE EXISTE. `bySlug` ne contient que les
    //   1 200 publiées : `path` vaut null pour les 18 212 autres, et le gabarit
    //   rend alors un <div>, pas un <a>. ⛔ Fabriquer l'adresse à la main
    //   produirait 18 212 liens vers des 404 — invisibles au build, puisque ce
    //   sont des liens et pas des routes. Ce dépôt l'a déjà payé trois fois.
    path: (publiesParUuid.get(c.uuid || c.veve_uuid) || null),
  });
  const rayon = cat.map(rayonDe);

  // ⏳ LES DROPS À VENIR — « ceux qui ont une date de drop supérieure au jour
  //    actuel » (Preda, 10/08).
  //    🔴🔴 `release_date` vaut « 06/10/2021 14:00:00 » ou « 30/12/2021 » :
  //    JJ/MM/AAAA, heure optionnelle. `new Date("06/10/2021")` est interprété
  //    en MM/JJ/AAAA par V8 — soit le 10 juin au lieu du 6 octobre. Le filtre
  //    ne PLANTE pas : il rend un ensemble faux, ou vide, en silence.
  //    ⇒ `jourISO()` et rien d'autre. Un banc le tient.
  //    ⭐ MESURÉ le 10/08 sur les 19 412 lignes : 10 lignes à venir, qui sont
  //    2 comics × 5 raretés. Lister les lignes montrerait cinq fois la même
  //    couverture. ⇒ ON GROUPE, et on garde la rareté la plus basse comme
  //    représentante (celle que tout le monde peut avoir).
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const aVenirParDrop = new Map();
  for (const r of rayon) {
    const j = jourISO(r.releaseDate);
    if (!j || new Date(j) <= auj) continue;
    const cle = `${j}|${r.name}`;
    if (!aVenirParDrop.has(cle)) aVenirParDrop.set(cle, { ...r, jour: j, raretes: 0 });
    // ⭐ LE REPRÉSENTANT N'A PAS FORCÉMENT L'IMAGE. On groupe 5 raretés d'un
    //   même comic ; la première rencontrée peut être celle dont la couverture
    //   manque (6 609 comics sont sans `image_url` — `ARCHIVE_HEADER` en jette
    //   14 champs sur 25). On garde donc LA PREMIÈRE IMAGE NON VIDE du groupe
    //   plutôt que celle du premier élément. ⛔ Sans ça, un drop dont une seule
    //   rareté est illustrée sortirait sans visuel, au hasard de l'ordre.
    if (!aVenirParDrop.get(cle).image && r.image) aVenirParDrop.get(cle).image = r.image;
    aVenirParDrop.get(cle).raretes++;
  }
  const aVenir = [...aVenirParDrop.values()].sort((a, b) => a.jour.localeCompare(b.jour));
  console.log(`[rayon] ${rayon.length} ligne(s) de catalogue · ${rayon.filter((r) => r.path).length} cliquable(s) · ${aVenir.length} drop(s) a venir`);

  _ds = {
    items, bySlug, collections, rarities, movers, cote,
    // ⭐ LOT 117 — voir le bloc « L'EMPREINTE DES PRIX » ci-dessus. Seul
    //   `engine/tools/lastmod-prix.mjs` les lit ; aucun gabarit n'y touche.
    empreinteCote, empreinteMarche,
    rayon, aVenir,
    marche, marcheTotal,
    catalogueSize: cat.length,
    windowDays: WINDOW_DAYS,
    maxPoints: MAX_POINTS,
    quotas, eligibles, publies,
    updatedAt: new Date().toISOString(),
  };
  return _ds;
}
