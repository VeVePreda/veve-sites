// ⚠️ VeVePreda/veve-sites — engine/lib/reserve.mjs   (FICHIER NEUF)
// ═══════════════════════════════════════════════════════════════════════════
// LA RÉSERVE — l'historique COMPLET, écrit au build, HORS du site publié.
// ═══════════════════════════════════════════════════════════════════════════
//
// LE PROBLÈME QU'ELLE RÉSOUT. `/api/historique/[uuid]` doit servir à un abonné
// l'historique entier d'une pièce. Or cet historique N'EXISTE NULLE PART au
// moment où on le demande :
//   · `dataset()` agrège `prices.csv.gz` EN FLUX et ne retient par item que
//     30 points échantillonnés sur 3 jours (`buckets`) + les 5 derniers
//     (`tail`) — c'est exactement ce que voit un VISITEUR ;
//   · `totalPoints` n'est qu'un COMPTEUR (`a.n`), pas une donnée ;
//   · et le fichier de prix n'est plus lu après le build.
// Une route qui « lit la session » mais n'a rien à servir ne vaut rien.
//
// ⭐⭐ POURQUOI ON ÉCRIT PENDANT LA PASSE EXISTANTE, ET PAS DANS UN SCRIPT À
// PART. `streamPrices` n'est PAS mis en cache (contrairement à `load()`) : un
// second script rappellerait le réseau et retéléchargerait le fichier entier.
// `test:donnees` (engine/tools/test_concurrence.mjs) existe précisément pour
// garantir que le jeu de données n'est construit QU'UNE fois — deux lectures
// du fichier de prix ont déjà provoqué une panne mémoire. On se greffe donc
// sur la passe qui a déjà lieu : UNE ligne dans la boucle de dataset.mjs.
//
// ⭐⭐ POURQUOI LA MÉMOIRE RESTE BORNÉE. dataset.mjs promet en toutes lettres
// que « la mémoire dépend du nombre d'items (~19 000), JAMAIS de la taille du
// fichier de prix ». Accumuler tout l'historique en mémoire romprait cette
// promesse — sur un fichier append-on-change qui grandit sans limite, c'est la
// panne de build garantie, à une date qu'on ne choisit pas.
// On bufferise donc PAR ITEM et on VIDE SUR DISQUE dès qu'un plafond global
// est franchi. Le pic mémoire est un réglage (32 Mo), pas une conséquence.
//
// ⛔⛔ CE DOSSIER NE DOIT JAMAIS ÊTRE SERVI. Il porte, en clair, exactement ce
// que l'abonnement fait payer. Trois barrières, indépendantes :
//   1. il est écrit HORS de `dist/` — Astro ne le copie donc pas ;
//   2. nginx sert `dist/` (ou `dist/client`) comme racine et rien d'autre ;
//   3. `test_reserve.mjs` FAIT ÉCHOUER LE BUILD si un fichier de réserve
//      apparaît sous `dist/`.
// Trois barrières parce qu'une seule est une intention, pas un verrou — et
// parce que la première qui saute doit être rattrapée sans que personne ne
// s'en aperçoive au mauvais moment.

import { mkdirSync, existsSync, appendFileSync, writeFileSync, readFileSync,
         readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.PROJECT_ROOT || process.cwd();

// ⭐ Le nom du dossier commence par un point ET vit à la racine du projet, pas
// sous `public/` ni sous `src/`. Les deux seraient recopiés dans `dist/`.
export const RESERVE_DIR = process.env.RESERVE_DIR || join(ROOT, '.reserve', 'historique');

// 🔴 L'UUID VIENT DU FICHIER DE PRIX, ET IL SERT DE NOM DE FICHIER.
// C'est une donnée d'entrée comme une autre : un `veve_uuid` valant
// `../../etc/passwd` ou `../../dist/index.html` écrirait où il veut. On ne
// nettoie pas, on n'échappe pas — ON REFUSE tout ce qui n'a pas exactement la
// forme d'un UUID. Une liste blanche ne se contourne pas ; une liste noire, si.
// ⚠️ La MÊME fonction garde la route d'API (elle l'importe d'ici) : une seule
// définition de « ce qui est un uuid », sinon les deux divergent un jour.
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuidValide = (u) => RE_UUID.test(String(u || ''));

// Plafond du tampon global avant vidage. 32 Mo : assez pour qu'un fichier
// trié par uuid n'écrive qu'une fois par item, assez peu pour qu'un fichier
// mal trié dégrade en I/O au lieu de tomber en panne mémoire.
const PLAFOND_OCTETS = Number(process.env.RESERVE_BUFFER || 32 * 1024 * 1024);

let actif = false;
let tampons = null;     // Map<uuid, string[]>
let poids = 0;
let vidages = 0;
let ignores = 0;        // relevés au ts illisible — comptés, jamais inventés
let refuses = 0;        // uuid de forme invalide

/** Démarre la collecte. Sans appel, `point()` ne fait rien : les sites qui
 *  ne vendent pas de profondeur (vevewiki) ne paient pas cette écriture. */
export function ouvrir() {
  if (actif) return;
  // 🔴 SOUPAPE D'URGENCE (03/08/2026). La reserve n'avait JAMAIS tourne sur de
  // vraies donnees quand elle a ete livree : hors reseau, `engine/data/sample`
  // n'a pas de vrais uuid, donc la liste blanche les refuse tous et le chemin
  // complet n'est jamais exerce. Le A-LIRE du lot 27 le disait — c'est
  // maintenant un risque materialise, pas une precaution.
  // ⭐ ELLE NE COUTE RIEN AUJOURD'HUI : `SESSION_API` n'est pas renseignee,
  // donc personne ne franchit `price_history`, donc personne ne demande la
  // reserve. La couper ne prive AUCUN abonne — il n'y en a pas encore.
  // ⛔ C'EST UN CONTOURNEMENT, PAS UN REGLAGE. Une variable qui desactive un
  // garde-fou et qu'on oublie est exactement le profil du secret jamais
  // renseigne : elle se perime en silence. Le Dockerfile la CRIE a chaque
  // build pour qu'elle ne devienne pas l'etat normal.
  if (process.env.RESERVE_OFF === '1') {
    console.log('[reserve] DESACTIVEE par RESERVE_OFF=1 — aucun historique complet ne sera ecrit, '
      + '/api/historique/[uuid] rendra 404 pour tout le monde. Contournement temporaire.');
    return;
  }
  // ⛔ On repart d'un dossier VIDE. Un artefact laissé par un build précédent
  // servirait l'historique d'hier à un abonné, sans qu'aucune erreur ne le
  // dise — et c'est le genre de reste qui survit à un rollback.
  if (existsSync(RESERVE_DIR)) rmSync(RESERVE_DIR, { recursive: true, force: true });
  mkdirSync(RESERVE_DIR, { recursive: true });
  actif = true; tampons = new Map(); poids = 0; vidages = 0; ignores = 0; refuses = 0;
}

/** Un relevé de plus. Appelé une fois par ligne du fichier de prix. */
export function point(uuid, ts, floor, listings) {
  if (!actif) return;
  if (!uuidValide(uuid)) { refuses++; return; }
  const t = Date.parse(ts);
  // ⚠️ Un ts illisible est SAUTÉ ET COMPTÉ. Le remplacer par « maintenant »
  // fabriquerait un relevé, et un relevé fabriqué sur un site de cotes est la
  // seule faute qu'on ne rattrape jamais.
  if (!Number.isFinite(t)) { ignores++; return; }
  // Epoch en SECONDES : trois fois plus léger qu'une chaîne ISO sur un
  // artefact qui pèse des dizaines de Mo, et reconstruit exactement.
  const ligne = `${Math.floor(t / 1000)},${floor},${listings || 0}\n`;
  let b = tampons.get(uuid);
  if (!b) { b = []; tampons.set(uuid, b); }
  b.push(ligne);
  poids += ligne.length;
  if (poids > PLAFOND_OCTETS) vider();
}

// Vide les plus gros tampons jusqu'à repasser sous la moitié du plafond.
// ⭐ Les PLUS GROS d'abord : ce sont eux qui rendent le plus d'octets par
// ouverture de fichier. Vider le premier venu multiplierait les I/O.
function vider() {
  const parTaille = [...tampons.entries()]
    .map(([u, b]) => [u, b, b.reduce((n, l) => n + l.length, 0)])
    .sort((a, c) => c[2] - a[2]);
  for (const [u, b, taille] of parTaille) {
    appendFileSync(join(RESERVE_DIR, `${u}.csv`), b.join(''));
    tampons.set(u, []);
    poids -= taille; vidages++;
    if (poids <= PLAFOND_OCTETS / 2) break;
  }
}

/**
 * Ferme la réserve : vide ce qui reste, puis NE GARDE QUE les uuid publiés,
 * triés par date, au format que la route sert tel quel.
 * @param {Set<string>|string[]} publies uuid ayant réellement une page.
 */
export function fermer(publies) {
  if (!actif) return { fichiers: 0, points: 0, octets: 0, ignores: 0, refuses: 0 };
  for (const [u, b] of tampons) if (b.length) appendFileSync(join(RESERVE_DIR, `${u}.csv`), b.join(''));
  tampons.clear(); poids = 0;

  const garder = publies instanceof Set ? publies : new Set(publies || []);
  let fichiers = 0, points = 0, octets = 0, jetes = 0;

  for (const f of readdirSync(RESERVE_DIR)) {
    if (!f.endsWith('.csv')) continue;
    const u = f.slice(0, -4);
    const chemin = join(RESERVE_DIR, f);
    // ⭐ Un item du catalogue SANS page publiée n'a pas de réserve : personne
    // ne peut la demander, et la garder gonflerait l'image pour rien.
    if (garder.size && !garder.has(u)) { rmSync(chemin, { force: true }); jetes++; continue; }

    const pts = readFileSync(chemin, 'utf8').split('\n')
      .filter(Boolean)
      .map((l) => { const [t, f2, n] = l.split(','); return [Number(t), Number(f2), Number(n)]; })
      // ⚠️ LE FICHIER DE PRIX N'EST PAS GARANTI TRIÉ, et les vidages
      // successifs peuvent de toute façon désordonner un même item. On trie
      // ICI, une fois. Une courbe non triée se replie sur elle-même : le
      // défaut est VISIBLE, mais seulement pour qui la regarde — donc
      // seulement pour un abonné, donc trop tard.
      .sort((a, b2) => a[0] - b2[0]);
    points += pts.length;
    // Format servi TEL QUEL par la route : elle ne recalcule rien, elle ne
    // parse rien, elle vérifie un droit et renvoie des octets.
    const json = JSON.stringify({ u, n: pts.length, p: pts });
    writeFileSync(join(RESERVE_DIR, `${u}.json`), json);
    rmSync(chemin, { force: true });
    octets += statSync(join(RESERVE_DIR, `${u}.json`)).size;
    fichiers++;
  }

  // ⭐ ON JOURNALISE, ON NE DEVINE PAS. Sans cette ligne, une réserve vide (un
  // filtre trop strict, un dossier non copié dans l'image) donnerait un build
  // parfaitement vert et des abonnés devant une page qui ne charge jamais.
  console.log(`[reserve] ${fichiers} fiche(s), ${points} relevé(s), `
    + `${(octets / 1048576).toFixed(1)} Mo — ${jetes} item(s) sans page écartés, `
    + `${vidages} vidage(s), ${ignores} relevé(s) au ts illisible, ${refuses} uuid refusé(s)`);

  // ⭐⭐ UN ZÉRO QUI S'EXPLIQUE N'EST PAS UN ZÉRO QUI ALERTE, ET L'INVERSE EST
  // VRAI AUSSI. `engine/data/sample/` identifie ses lignes par
  // `sample-0000-582307` : ce ne sont pas des uuid, la liste blanche les
  // refuse TOUS, et la réserve d'un build hors-ligne est donc vide — c'est
  // correct. Sans ce message, elle ressemble exactement à la panne qu'on
  // craint (réserve non écrite en production), et les deux se distinguent
  // seulement en relisant un fichier d'échantillon.
  // ⛔ NE PAS « corriger » ça en assouplissant `uuidValide` : cette liste
  // blanche est ce qui empêche un identifiant du fichier de prix d'écrire où
  // il veut. On préfère un échantillon qui n'exerce pas ce chemin à un
  // garde-fou qui laisse passer.
  if (!fichiers && refuses) {
    console.log('[reserve] AUCUNE fiche écrite alors que tous les identifiants lus ont été '
      + 'refusés : c\'est la signature d\'un build sur engine/data/sample/ '
      + '(WAREHOUSE_OFFLINE=1), dont les lignes ne portent pas de vrais uuid. '
      + 'En production, ce chiffre doit être NON NUL — le Dockerfile le vérifie.');
  } else if (!fichiers) {
    console.log('[reserve] ATTENTION AUCUNE fiche écrite et aucun identifiant refusé : '
      + 'la porte est active mais rien n\'a été collecté. Les abonnés n\'auront AUCUN '
      + 'historique, et rien d\'autre ne le dira.');
  }
  actif = false;
  return { fichiers, points, octets, ignores, refuses };
}

export const estActive = () => actif;

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LOT 140-1 — LA TRONCATURE, ET ELLE VIT ICI PARCE QUE LE FORMAT VIT ICI
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐ POURQUOI PAS DANS LA ROUTE. `fermer()`, dix lignes plus haut, ECRIT le
// format `{u, n, p:[[ts, floor, listings], …]}` trie par ts. Une fonction qui
// le RECOUPE doit vivre a cote de celle qui l'ECRIT, sinon le jour ou le format
// bouge, l'une des deux ne le sait pas. Un seul fichier connait la forme.
//
// ⛔⛔ ELLE NE S'APPELLE JAMAIS AU BUILD. `dataset()` cuit les points dans le
// HTML, et un build n'a QU'UN palier : tronquer la-bas graverait la profondeur
// d'un seul palier dans 3 097 pages statiques. La troncature se fait A LA
// LECTURE, dans la route, une fois qu'on sait QUI demande.
// ⛔ Et elle n'ecrit RIEN : pas cinq fichiers de reserve par piece, un par
//   palier. `test:reserve` fait echouer le build si la reserve entre dans dist/.
//
// ⭐⭐ L'ANCRAGE EST LE **DERNIER RELEVE**, PAS L'HEURE COURANTE (arbitrage Preda
// du 12/08). Deux raisons, et la seconde est la vraie :
//   · un scan en retard de deux jours servirait UN jour de courbe a un membre a
//     qui on en promet trois — sans que rien n'echoue ni ne le dise ;
//   · et `cadran.js` filtre DEJA comme ca cote client (`fin = dernier point ;
//     seuil = fin - jours*86400`, comparaison `>=`). Deux regles differentes ici
//     et la-bas se rattraperaient l'une l'autre et ne se verraient jamais.
//   ⇒ MEME ancrage, MEME comparaison. C'est un invariant, pas une coincidence.
//
// @param {{u:string,n:number,p:number[][]}} serie  la reserve, telle qu'ecrite
// @param {number} jours  -1 = sans borne · 0 = rien · N = les N derniers jours
export function tronquer(serie, jours) {
  const p = (serie && Array.isArray(serie.p)) ? serie.p : [];
  if (jours === -1) return { ...serie, p, n: p.length, tronque: false };
  if (!(jours > 0) || !p.length) return { ...serie, p: [], n: 0, tronque: true };
  const fin = p[p.length - 1][0];
  const seuil = fin - jours * 86400;
  const vus = p.filter((pt) => pt[0] >= seuil);
  return { ...serie, p: vus, n: vus.length, tronque: vus.length < p.length };
}
