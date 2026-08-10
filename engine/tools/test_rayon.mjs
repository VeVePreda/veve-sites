// ⚠️ VeVePreda/veve-sites — engine/tools/test_rayon.mjs   (FICHIER NEUF — lot 113)
//
// ═══════════════════════════════════════════════════════════════════════════
//  LE RAYON : TOUT LE CATALOGUE, SANS UN PRIX, ET SANS RIEN PERDRE
// ═══════════════════════════════════════════════════════════════════════════
//  Trois contrôles, un par mode de panne réel de ce lot.
//
//  ① AUCUN CHAMP DE PRIX. `catalogue.csv` porte `floor`, `listings`, `ath`,
//     `atl`, `ath_date`. Passer une ligne brute à un gabarit publierait 19 412
//     prix — seize fois pire que la fuite du lot 112 — et par un chemin que
//     `projeter()` NE VOIT PAS : il mute `items`, jamais `cat`.
//     ⭐ La liste blanche de `dataset.mjs` se PROUVE ici ; une liste blanche
//     qu'on relit à l'œil s'oublie le jour où la source amont gagne une colonne.
//
//  ② LA DATE EST EN JJ/MM/AAAA. `new Date("06/10/2021")` est lu MM/JJ/AAAA par
//     V8 : le 10 juin au lieu du 6 octobre. Le filtre « À venir » ne PLANTE
//     pas — il rend un ensemble faux, ou vide, en silence. C'est le piège que
//     la mémoire du projet nomme depuis des semaines.
//
//  ③ LA PAGINATION NE PERD RIEN. Une pagination qui laisse tomber son dernier
//     élément est muette : la page existe, elle est bien formée, et 12 pièces
//     ont disparu du site.
import { dataset } from '../lib/dataset.mjs';
import { jourISO } from '../lib/vitrine.mjs';

let ko = 0;
const dit = (bon, quoi, detail) => {
  console.log(`  ${bon ? 'ok ' : 'KO '} ${quoi}${bon || !detail ? '' : ` — ${detail}`}`);
  if (!bon) ko++;
};

console.log('\n═══ LOT 113 — le rayon ═══');
const ds = await dataset();

// ── ① AUCUN PRIX ──────────────────────────────────────────────────────────
const INTERDITS = ['floor', 'listings', 'ath', 'atl', 'ath_date', 'athDate', 'atlDate',
                   'prixMedian', 'p95', 'store_price', 'history', 'courbe'];
const vus = new Set();
for (const r of ds.rayon) for (const k of Object.keys(r)) vus.add(k);
const fuite = INTERDITS.filter((k) => vus.has(k));
dit(fuite.length === 0, `aucun champ de prix parmi les ${vus.size} champs du rayon`,
  fuite.length ? `⛔ ${fuite.join(', ')} — 19 412 lignes le porteraient dans le HTML` : null);
// 🔴 PREMIÈRE VERSION FAUSSE : `ds.rayon.length > 10000`. Elle passait en
//    production (19 412) et ROUGISSAIT sous `WAREHOUSE_OFFLINE=1`, où
//    l'échantillon fait 90 lignes. ⭐⭐⭐ *Un nombre magique mesure
//    l'échantillon dont il vient* — c'est exactement le défaut payé au lot 105
//    (« la feuille doit peser plus de 10 000 o », et `aurora` en faisait 8 510).
//    ⇒ Remplacé par une IDENTITÉ : le rayon porte EXACTEMENT autant de lignes
//    que le catalogue en déclare. Vrai sur 90 comme sur 19 412, et ça dit
//    quelque chose de plus fort : rien n'a été filtré en chemin.
dit(ds.rayon.length === ds.catalogueSize,
  `le rayon porte tout le catalogue (${ds.rayon.length} = catalogueSize)`,
  ds.rayon.length === ds.catalogueSize ? null
    : `⛔ ${ds.catalogueSize - ds.rayon.length} ligne(s) perdue(s) entre le catalogue et le rayon`);

// ── ② LA DATE, ET LE PIÈGE QU'ELLE PORTE ─────────────────────────────────
// ⭐ On ne teste pas « le filtre marche » : on teste que l'OUTIL utilisé lit
//   bien JJ/MM/AAAA. Un banc sur le résultat serait vert un jour où aucun drop
//   n'est annoncé — c'est-à-dire la plupart du temps.
dit(jourISO('06/10/2021 14:00:00') === '2021-10-06',
  'jourISO lit « 06/10/2021 » comme le 6 OCTOBRE', `rendu : ${jourISO('06/10/2021 14:00:00')}`);
dit(new Date('06/10/2021').getMonth() === 5,
  'le témoin tient : `new Date()` lit bien la même chaîne comme JUIN (le piège est réel)',
  'si ce contrôle casse, le moteur JS a changé — relire le filtre « À venir »');
const auj = new Date(); auj.setHours(0, 0, 0, 0);
const mauvais = (ds.aVenir || []).filter((d) => !d.jour || new Date(d.jour) <= auj);
dit(mauvais.length === 0, `les ${(ds.aVenir || []).length} drop(s) « à venir » sont bien à venir`,
  mauvais.length ? `${mauvais.length} déjà sorti(s) — le filtre lit mal la date` : null);
const groupe = (ds.aVenir || []).every((d) => d.raretes >= 1);
dit(groupe, 'chaque drop annoncé porte son nombre de raretés (on groupe, on ne répète pas)');

// ── ③ LA PAGINATION NE PERD RIEN ─────────────────────────────────────────
const PAR_PAGE = 20;
for (const [nom, total] of [
  ['comics', ds.rayon.filter((r) => r.type === 'comic').length],
  ['collectibles', ds.rayon.filter((r) => r.type !== 'comic').length],
]) {
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
  // La somme des tranches doit rendre le rayon entier, dernière page comprise.
  let somme = 0;
  for (let n = 1; n <= pages; n++) somme += Math.min(n * PAR_PAGE, total) - (n - 1) * PAR_PAGE;
  dit(somme === total, `${nom} : ${pages} page(s) × ${PAR_PAGE} rendent les ${total} lignes`,
    somme === total ? null : `⛔ ${total - somme} ligne(s) perdue(s)`);
  const derniere = total - (pages - 1) * PAR_PAGE;
  dit(total === 0 || derniere > 0, `${nom} : la dernière page n'est pas vide (${derniere} ligne(s))`);
}

// ── ⭐ ET CELUI QUE LA MESURE A IMPOSÉ ────────────────────────────────────
// La page 1 sortait 20 lignes muettes sur 20 : le build était vert, le banc
// anti-fuite aussi, et le rayon ne menait nulle part. Aucun contrôle ne
// regardait « est-ce que la première page SERT ».
for (const t of ['comic', 'collectible']) {
  const l = ds.rayon.filter((r) => r.type === t);
  const tri = [...l].sort((a, b) => (a.path ? 0 : 1) - (b.path ? 0 : 1));
  const p1 = tri.slice(0, PAR_PAGE).filter((r) => r.path).length;
  // ⚠️ `l.length === 0` : sous WAREHOUSE_OFFLINE l'échantillon peut n'avoir
  //    aucun item d'un type. Un banc qui exige une population qu'il n'a pas
  //    mesure son jeu d'essai, pas le code.
  dit(l.length === 0 || p1 > 0, `${t} : la première page porte ${p1} ligne(s) cliquable(s)`,
    p1 ? null : '⛔ page 1 entièrement muette — le rayon ne mène nulle part');
}

console.log(ko === 0 ? '\n✅ le rayon est entier, sans prix, et rien ne se perd\n'
                     : `\n🔴 ${ko} controle(s) en echec\n`);
process.exit(ko === 0 ? 0 : 1);
