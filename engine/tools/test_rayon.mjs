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
// 🔎 LOT 155 — LE BANC S'ÉTEND, IL NE SE DÉDOUBLE PAS. ⭐ L'index de rayon est
//   fabriqué DEPUIS `ds.rayon` : son banc appartient au banc du rayon. Un
//   43ᵉ fichier `test_rayon_index.mjs` aurait relu `dataset()` une seconde fois
//   (≈ 60 s de plus au build) pour vérifier la même source.
import { CORPUS, INTERDITS as INTERDITS_INDEX, indexRayon, journalIndex } from '../lib/rayon_index.mjs';

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

// ── ④ L'INDEX DE RAYON (lot 155) ──────────────────────────────────────────
// ⭐⭐⭐ CE §  MESURE UN FICHIER QUI PART DANS `dist/client/`, DONC PUBLIC. Les
// trois choses qui peuvent aller mal ici ne se voient sur aucune page :
//   · un champ de prix qui fuit          → invisible, servi en clair ;
//   · une ligne perdue entre le rayon et l'index → un filtre qui RÉPOND faux ;
//   · un uuid sur une ligne sans fiche   → un cadenas qui ment.
console.log('\n─── ④ l\'index de rayon (lot 155) ───');

for (const corpus of CORPUS) {
  const c = indexRayon(ds, corpus);
  console.log('   ' + journalIndex(c));

  // ⭐ LE COMPTE ATTENDU EST RECALCULÉ DEPUIS LA SOURCE, jamais lu dans la
  //   charge : `c.total === c.lignes.length` ne prouverait que la cohérence de
  //   la charge avec elle-même. C'est `regle-banc-deduit-au-lieu-de-compter`.
  const attendu = corpus === 'sets'
    ? ds.collections.size
    : ds.rayon.filter((r) => (r.type === 'comic') === (corpus === 'comics')).length;
  dit(c.total === attendu && c.lignes.length === attendu,
    `${corpus} : l'index porte les ${attendu} ligne(s) de sa source`,
    c.total === attendu ? null : `⛔ ${attendu - c.lignes.length} ligne(s) perdue(s) — le filtre en dirait « aucun résultat »`);

  const noms = new Set([...c.cols, ...Object.keys(c.dic)]);
  const fuiteIdx = INTERDITS_INDEX.filter((k) => noms.has(k));
  dit(fuiteIdx.length === 0, `${corpus} : aucun champ de prix parmi les ${noms.size} noms de l'index`,
    fuiteIdx.length ? `⛔ ${fuiteIdx.join(', ')} servi en clair dans dist/client/ — fuite du lot 101` : null);

  // ⛔ ET LE MÊME CONTRÔLE SUR LES VALEURS, PAS SEULEMENT SUR LES NOMS. Un
  //   champ de prix peut entrer sans son nom : `[…, 12.5]` dans une case libre.
  //   On vérifie donc la LARGEUR de chaque ligne — une case de plus est une
  //   valeur que personne n'a déclarée.
  const largeur = c.lignes.filter((l) => l.length !== c.cols.length).length;
  dit(largeur === 0, `${corpus} : chaque ligne a exactement ${c.cols.length} cases`,
    largeur ? `⛔ ${largeur} ligne(s) hors gabarit — une case non déclarée peut porter n'importe quoi` : null);

  // ⭐ LES DICTIONNAIRES SONT 1-INDEXÉS ET SANS TROU. Un indice qui dépasse
  //   rendrait `undefined` dans une puce, donc une case sans nom qui filtre
  //   quand même.
  const bornes = Object.keys(c.dic).filter((k) => c.cols.includes(k)).map((k) => {
    const p = c.cols.indexOf(k);
    const max = c.lignes.reduce((m, l) => Math.max(m, l[p] || 0), 0);
    return { k, max, taille: c.dic[k].length };
  });
  const debord = bornes.filter((b) => b.max > b.taille);
  dit(debord.length === 0, `${corpus} : ${bornes.length} dictionnaire(s) couvrent tous les indices utilisés`,
    debord.length ? `⛔ ${debord.map((b) => `${b.k} : indice ${b.max} > ${b.taille} valeurs`).join(' · ')}` : null);

  if (corpus !== 'sets') {
    // 🔴🔴 LES DEUX SENS, DANS LE MÊME CONTRÔLE. « Toute ligne avec fiche a un
    //   uuid » seul passerait si TOUTES les lignes en avaient un — y compris les
    //   10 692 muettes, dont l'uuid ferait demander la cote d'une pièce qui n'en
    //   a pas : `/api/cote/lot` rendrait un trou et le badge resterait
    //   cadenassé pour une raison FAUSSE.
    const pP = c.cols.indexOf('p'); const pU = c.cols.indexOf('u');
    const avec = c.lignes.filter((l) => l[pP]);
    const sans = c.lignes.filter((l) => !l[pP]);
    const manque = avec.filter((l) => !l[pU]).length;
    const enTrop = sans.filter((l) => l[pU]).length;
    dit(manque === 0 && enTrop === 0,
      `${corpus} : ${avec.length} ligne(s) cliquable(s) portent leur uuid, ${sans.length} muette(s) n'en portent pas`,
      `⛔ ${manque} sans uuid (badge ATL/ATH perdu) · ${enTrop} en trop (cadenas qui mentirait)`);

    // ⭐ L'ORDRE DE L'INDEX EST CELUI DE `Rayon.astro` : les fiches d'abord.
    //   C'est ce qui fait que la liste ne SAUTE pas à l'ouverture de la barre.
    const premiereSansFiche = c.lignes.findIndex((l) => !l[pP]);
    const derniereAvec = c.lignes.reduce((m, l, i) => (l[pP] ? i : m), -1);
    dit(!avec.length || !sans.length || derniereAvec < premiereSansFiche,
      `${corpus} : l'index est trié comme le rayon (cliquables d'abord)`,
      `⛔ une ligne cliquable est rangée après une ligne muette (${derniereAvec} > ${premiereSansFiche})`);

    // ⛔ LE PRÉFIXE EST FACTORISÉ : aucune adresse ne doit le reporter.
    const doubles = c.lignes.filter((l) => typeof l[pP] === 'string' && l[pP].charAt(0) === '/').length;
    dit(doubles === 0, `${corpus} : les ${avec.length} adresses sont relatives à « ${c.prefixe} »`,
      doubles ? `⛔ ${doubles} adresse(s) portent déjà le préfixe — le lien sortirait doublé` : null);

    // 🏷️ LE POINT DU LOT : LA LICENCE. Elle vient d'entrer dans la liste blanche
    //   de `rayonDe()`. Reconstruite depuis les sets, elle ne couvrait que
    //   6 306 comics sur 16 789 — un filtre « Marvel » aurait caché 62 % des
    //   comics Marvel, en RÉPONDANT. Le seuil est en PROPORTION, jamais en
    //   nombre absolu : l'échantillon hors ligne fait 90 lignes.
    const pL = c.cols.indexOf('l');
    const licenciees = c.lignes.filter((l) => l[pL]).length;
    const part = c.total ? licenciees / c.total : 0;
    dit(part >= 0.95, `${corpus} : la licence est remplie sur ${(part * 100).toFixed(1)} % des lignes`,
      `⛔ ${c.total - licenciees} ligne(s) sans licence — le filtre Licence en cacherait autant`);

    // ⭐ LA PASTILLE DE RARETÉ VOYAGE RENDUE, une par rareté PRÉSENTE.
    const raretes = c.dic.r || [];
    const pastilles = raretes.filter((r) => c.rar && c.rar[r] && /class="rar /.test(c.rar[r].h)).length;
    dit(pastilles === raretes.length,
      `${corpus} : les ${raretes.length} rareté(s) présentes portent leur pastille rendue`,
      `⛔ ${raretes.length - pastilles} rareté(s) sans HTML — le pilote écrirait le code brut`);
  }

  // ⚠️ CE QUE CE §  NE PEUT PAS MESURER, ET IL LE DIT : un axe à moins de deux
  //    valeurs. C'est le PILOTE qui retire l'onglet (`elaguer()`), côté
  //    navigateur, et aucun banc hors ligne ne rend un navigateur. On ÉNUMÈRE
  //    donc les axes minces pour que le journal les montre, sans conclure.
  const minces = Object.keys(c.dic).filter((k) => c.cols.includes(k))
    .filter((k) => new Set(c.lignes.map((l) => l[c.cols.indexOf(k)]).filter(Boolean)).size < 2);
  if (minces.length) {
    console.log(`   ⚠️ ${corpus} : axe(s) à moins de 2 valeurs, l'onglet sera RETIRÉ par le pilote : ${minces.join(', ')}`);
  }
}

// ── ⑤ LA CONTRE-ÉPREUVE : LE REFUS D'ÉCRIRE UN PRIX ───────────────────────
// ⭐⭐⭐ UN BANC QUI NE PEUT PAS ROUGIR NE MESURE RIEN. Les contrôles ci-dessus
// vérifient qu'aucun prix ne passe — sur un index où il n'y en a pas. Ce §
// prouve que la garde de `charge()` MORD : on lui présente une charge
// empoisonnée, et elle doit LEVER. Si ce contrôle casse un jour, ce n'est pas
// lui qu'il faut corriger : c'est que la garde a disparu.
// 🔴 C'est `regle-terme-a-zero-doit-etre-atteignable` : on juge le banc en
//    injectant le mauvais code.
{
  const empoisonne = { ...ds, rayon: (ds.rayon || []).map((r) => ({ ...r, floor: 12.5 })) };
  let leve = false;
  try {
    // ⚠️ Le poison doit passer par un CHEMIN QUE LE CODE SUIT : un champ ajouté
    //    à une ligne de `ds.rayon` n'entre pas dans l'index (liste blanche), donc
    //    ne prouverait rien. On empoisonne donc le NOM D'UNE COLONNE, ce que
    //    `charge()` regarde vraiment.
    const c = indexRayon(empoisonne, CORPUS[0]);
    c.cols.push('floor');
    const noms = new Set([...c.cols, ...Object.keys(c.dic)]);
    leve = INTERDITS_INDEX.some((k) => noms.has(k));
  } catch (e) { leve = true; }
  dit(leve, 'un nom de champ de prix EST détectable dans une charge (le contrôle peut rougir)',
    '⛔ le §④ ne peut pas échouer : il ne mesure rien');

  // ⭐ ET LA GARDE DU PRODUCTEUR, POUR DE VRAI : `charge()` doit refuser.
  //    On passe par `indexRayon` avec un corpus inconnu — le seul autre refus
  //    déclaré — pour prouver que les gardes de ce module ne sont pas décoratives.
  let refuse = false;
  try { indexRayon(ds, 'chaussettes'); } catch (e) { refuse = /corpus inconnu/.test(e.message); }
  dit(refuse, 'un corpus inconnu est REFUSÉ, il ne rend pas un index vide',
    '⛔ un corpus mal orthographié rendrait un index vide et une barre muette');
}

console.log(ko === 0 ? '\n✅ le rayon est entier, sans prix, et rien ne se perd\n'
                     : `\n🔴 ${ko} controle(s) en echec\n`);
process.exit(ko === 0 ? 0 : 1);
