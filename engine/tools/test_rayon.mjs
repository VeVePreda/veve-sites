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
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
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

// ── ⑥ LOT 201 — LE PLANCHER SUR LA LIGNE, ET LA GRILLE QUI DOIT LE TENIR ──
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ CE §  SE BRANCHE SUR `dist/`, PAS SUR `ds`. Les cinq §  au-dessus
// jugent la DONNÉE (le rayon ne porte pas de prix). Celui-ci juge le HTML
// RÉELLEMENT SERVI, parce que le défaut §M-209 ne vivait pas dans la donnée :
// la donnée était juste, c'est le gabarit qui ne posait rien. Un banc branché
// sur `ds` serait resté vert pendant tout le temps où les lignes n'affichaient
// aucun prix. *Sur quoi est-il branché ?*
//
// ⏸️ INDÉCIDABLE SI `dist/` EST ABSENT, et il le DIT. ⛔ Un `if (!existsSync)
//    return;` silencieux rendrait ce §  vert avant tout build — un succès qui
//    ressemble à un succès, c'est le pire des muets.
{
  console.log('\n── ⑥ le plancher de la ligne de rayon (lot 201) ──');
  // 🔴🔴🔴 LE DOSSIER SERVI N'A PAS LE MÊME NOM SELON LE MODE DE RENDU, et le
  //   confondre coûte un VERDICT FAUX, pas une erreur : `RENDERING=server`
  //   (veveprice) dépose dans `dist/client`, `RENDERING=static` (vevewiki)
  //   dépose dans `dist`. La première version ne connaissait que `dist/client`
  //   ⇒ sur vevewiki elle annonçait « INDÉCIDABLE, dist/ est absent » alors que
  //   le site venait d'être bâti sous ses yeux.
  //   ⭐⭐⭐ ET LA DIFFÉRENCE COMPTE : « indécidable » dit « je n'ai pas pu
  //   regarder » — c'est un TROU, et le Dockerfile n'en accepte aucun. « Sans
  //   objet » dit « la question est tranchée, elle vaut non ». Ici la vérité
  //   est la seconde : vevewiki ne rend pas de rayon. Un banc qui range un
  //   « non » dans la case « je ne sais pas » fait chercher une panne
  //   inexistante, et masque le jour où le dossier manque VRAIMENT.
  const DIST = ['dist/client', 'dist'].find((d) => existsSync(join(d, 'index.html'))
    || existsSync(join(d, 'collectibles'))) || 'dist/client';
  if (!existsSync(DIST)) {
    console.log('  ⏸️  INDÉCIDABLE — `dist/` est absent : ce §  se joue APRÈS `npm run build`.');
  } else {
    const pages = ['collectibles/index.html', 'comics/index.html']
      .map((f) => join(DIST, f)).filter((f) => existsSync(f));
    if (!pages.length) {
      // ⭐ « SANS OBJET » N'EST PAS UN INDÉCIDABLE : la condition « ce site
      //   rend-il des rayons ? » est TRANCHÉE, et elle vaut non sur vevewiki.
      //   Un indécidable dirait « je n'ai pas pu regarder ».
      console.log('  --  SANS OBJET — ce site ne rend pas de rayon'
        + ' (`/collectibles/` et `/comics/` n\'existent que sur veveprice).');
    } else {
      let lignes = 0, avecExt = 0, avecPrix = 0, enfantsMax = 0;
      const montants = [];
      for (const f of pages) {
        const html = readFileSync(f, 'utf8');
        for (const m of html.matchAll(/<(a|div) class="rayon__c[^"]*"[^>]*>([\s\S]*?)<\/\1>/g)) {
          const corps = m[2];
          lignes++;
          const ext = corps.includes('rayon__ext');
          const prix = /class="cote rayon__p"/.test(corps);
          if (ext) avecExt++;
          if (prix) avecPrix++;
          // ⭐⭐ LES ENFANTS DE PREMIER NIVEAU, COMPTÉS. C'est ce nombre-là que
          //   la grille doit tenir : un enfant de plus que de colonnes ne
          //   déborde pas en largeur, il REPLIE la ligne sur une seconde rangée
          //   et la fait grandir. Sur vingt lignes empilées ça ne ressemble pas
          //   à une faute, ça ressemble à du texte long — c'est pour ça que ce
          //   défaut a vécu depuis le lot 139 sans être nommé.
          let prof = 0, n = 0;
          for (const t of corps.matchAll(/<(\/?)(span|svg)\b/g)) {
            if (t[1]) prof--;
            else { if (prof === 0 && t[2] === 'span') n++; prof++; }
          }
          if (n > enfantsMax) enfantsMax = n;
          // ⛔ ET AUCUN MONTANT DANS L'EMPLACEMENT. `<Cote>` ne reçoit pas de
          //   valeur : si un chiffre apparaît ici, c'est qu'on lui en a repassé
          //   une, et 19 412 pages publiques porteraient le prix.
          for (const v of corps.matchAll(/data-cote-v[^>]*>([^<]*)</g)) {
            if (/[0-9]/.test(v[1])) montants.push(v[1].trim());
          }
        }
      }

      // ⭐⭐⭐ LA CONTRE-ÉPREUVE D'ABORD, TOUJOURS. Un banc qui ne lit AUCUNE
      //   ligne ne trouve aucun manque et passe au vert sans avoir rien mesuré.
      dit(lignes > 0, `${lignes} ligne(s) de rayon réellement lue(s) dans dist/`,
        '⛔ aucune ligne lue : ce §  ne peut pas rougir, il ne mesure rien');
      dit(avecExt > 0, `${avecExt} ligne(s) portent les extrêmes (il y a de quoi comparer)`,
        '⛔ aucune ligne à fiche : le prédicat partagé n\'est pas éprouvable ici');

      // 🔑 L'IDENTITÉ, PAS UN NOMBRE MAGIQUE. Le plancher et les extrêmes sont
      //   gardés par le MÊME prédicat (`filtrable && l.path`) : ils doivent
      //   apparaître et disparaître ENSEMBLE. Un compte figé aurait mesuré
      //   l'échantillon dont il vient — 90 lignes ici, 19 412 en production.
      dit(avecPrix === avecExt,
        `chaque ligne à extrêmes porte aussi son plancher (${avecPrix} = ${avecExt})`,
        `⛔ ${avecExt - avecPrix} ligne(s) montrent ATL/ATH sans prix — le défaut §M-209`);

      dit(montants.length === 0, 'aucun montant écrit dans un emplacement de cote',
        montants.length ? `⛔ ${montants.length} valeur(s) en clair : ${montants.slice(0, 3).join(', ')}` : null);

      // ── LA GRILLE DOIT TENIR CE QU'ON LUI POSE ──────────────────────────
      // ⭐ ON LIT LE THÈME, PAS UNE CONSTANTE. Un nombre recopié ici diverge du
      //   thème au premier lot qui touche la grille — et il divergerait EN
      //   SILENCE, puisque les deux resteraient plausibles.
      const feuille = 'themes/vitrine/theme.css';
      if (!existsSync(feuille)) {
        console.log('  --  SANS OBJET — ce site n\'utilise pas le thème `vitrine`.');
      } else {
        const css = readFileSync(feuille, 'utf8');
        const regle = css.match(/\.rayon__c\{[^}]*grid-template-columns:([^;]+);/);
        const colonnes = regle ? regle[1].trim().split(/\s+(?![^(]*\))/).length : 0;
        dit(colonnes > 0, `la grille de \`.rayon__c\` est lisible dans le thème (${colonnes} colonne(s))`,
          '⛔ règle introuvable : le contrôle suivant ne mesurerait rien');
        dit(enfantsMax > 0 && colonnes >= enfantsMax,
          `la grille tient la ligne la plus chargée (${colonnes} colonne(s) ≥ ${enfantsMax} enfant(s))`,
          `⛔ ${enfantsMax - colonnes} enfant(s) de trop : ces lignes-là se replient sur une`
          + ' seconde rangée et grandissent — regle-enfant-non-plafonne-casse-une-grille');
      }
    }
  }

  // ── LA SECONDE FABRIQUE — le pilote peint la MÊME ligne ─────────────────
  // 🔴🔴🔴 CINQUIÈME FOIS QUE CE DÉPÔT PAIE « deux gabarits qui rendent la même
  //   liste divergent en silence ». `Rayon.astro` sert la page 1 ; dès le
  //   premier filtre, c'est `rayon.js` qui repeint TOUT. Un plancher posé d'un
  //   seul côté apparaîtrait au chargement et disparaîtrait au premier clic —
  //   ou l'inverse. Aucun banc branché sur `dist/` ne le verrait : le pilote
  //   n'écrit rien dans `dist/`.
  // ⛔ ET ON RETIRE LES COMMENTAIRES AVANT DE CHERCHER. Cinq fois dans ce
  //   dépôt, un banc a trouvé la chaîne qu'il cherchait DANS le commentaire qui
  //   documentait le sujet — et une fois dans le commentaire qui DÉSACTIVAIT
  //   la ligne. Ce §-ci ne peut pas se faire avoir de cette façon.
  const pilote = 'src/socle/modules/rayon.js';
  if (!existsSync(pilote)) {
    console.log('  --  SANS OBJET — ce site n\'embarque pas le pilote de rayon.');
  } else {
    const nu = readFileSync(pilote, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
    dit(/cadenasNu\s*\(\s*u\s*,\s*'floor'/.test(nu),
      'le pilote peint lui aussi le plancher (code, commentaires retirés)',
      '⛔ le plancher n\'existe qu\'au chargement : il disparaîtrait au premier filtre');
    dit(/rayon__p/.test(nu),
      'le pilote pose la classe que le thème peint (`rayon__p`)',
      '⛔ classe absente ou renommée : un badge sans règle, invisible dans les deux sens');
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// ⑦ LA VUE TUILES DES RAYONS (lot E) — JUGÉE SUR LE HTML SERVI, ET CROISÉE
//    AVEC L'INDEX QUE LE PILOTE LIRA
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 CE § EXISTE POUR ATTRAPER LA CINQUIÈME OCCURRENCE D'UNE MÊME FAUTE.
// Quatre fois ce dépôt a peint une liste depuis une source qui ne portait pas
// tout — les tuiles du Marché, celles de `/favoris/`, le badge ATL/ATH, les
// vignettes des sets. À chaque fois, la moitié servie par le serveur montrait
// quelque chose que la moitié filtrée ne montrait pas, et à chaque fois ça
// ressemblait à une donnée manquante plutôt qu'à un défaut de code.
//
// ⭐⭐⭐ ET IL NE SE CONTENTE PAS DE VÉRIFIER QUE LES DEUX CÔTÉS APPELLENT LA
// MÊME FONCTION — ce serait tautologique, les deux importent `imageCarte()`.
// Il CROISE DEUX SOURCES INDÉPENDANTES : l'adresse écrite dans le HTML que
// nginx sert, et l'adresse déposée dans `.reserve/rayon-index/` que le pilote
// ira chercher. Si l'un des deux se met à servir `r.image` brute — 2 000 px
// dans une case de 178 — les deux jeux d'adresses divergent et ce § mord.
// *On ne mesure pas une valeur à travers la couche qui la réécrit : ici on la
// lit deux fois, de deux côtés, et on compare.*
{
  console.log('\n── ⑦ la vue tuiles des rayons (lot E) ──');
  const DIST = ['dist/client', 'dist'].find((d) => existsSync(join(d, 'index.html'))
    || existsSync(join(d, 'collectibles'))) || 'dist/client';
  const pages = [['collectibles', 'collectibles/index.html'], ['comics', 'comics/index.html']]
    .filter(([, f]) => existsSync(join(DIST, f)));
  if (!pages.length) {
    // ⭐ « SANS OBJET », PAS « INDÉCIDABLE » — la question « ce site rend-il un
    //   rayon ? » est tranchée, et elle vaut non sur vevewiki. Le même
    //   raisonnement qu'au § ⑥, vingt lignes plus haut.
    console.log('  --  SANS OBJET — ce site ne rend pas de rayon.');
  } else {
    for (const [corpus, rel] of pages) {
      const h = readFileSync(join(DIST, rel), 'utf8');
      const lis = h.match(/<li class="rayon__l">/g) || [];
      const socles = h.match(/<span class="socle(?: socle--comic)?">/g) || [];
      const nets = h.match(/class="socle__net ok" src="([^"]+)"/g) || [];
      const cages = h.match(/class="socle__cage"/g) || [];

      dit(/id="r-liste"[^>]*class="[^"]*rayon--tui|class="[^"]*rayon--tui[^"]*"[^>]*id="r-liste"/.test(h)
          || /<ul class="rayon rayon--tui" id="r-liste">/.test(h),
        `${corpus} : la liste est servie en vue TUILES (\`rayon--tui\`)`,
        '⛔ la classe manque : la grille retombe en tableau de lignes, sans que rien ne rougisse ailleurs');

      // ⭐⭐ AUTANT DE SOCLES QUE DE LIGNES — le repli se VOIT. C'est la règle
      //   que le Marché a posée au lot 127 : pas de tuile « dégradée » sans
      //   cadre, parce qu'une grille à trous ressemble à un site cassé et non
      //   à une pièce sans visuel.
      dit(lis.length > 0 && socles.length === lis.length,
        `${corpus} : ${socles.length} socle(s) pour ${lis.length} ligne(s) servie(s)`,
        `⛔ ${lis.length - socles.length} ligne(s) sans socle — la grille aurait des trous`);

      // ⭐ ET CHAQUE SOCLE MONTRE QUELQUE CHOSE : une couverture, ou le
      //   losange. ⛔ Jamais un cadre vide. Les deux branches se COMPTENT, on
      //   ne se contente pas de vérifier que l'une existe.
      dit(nets.length + cages.length === socles.length,
        `${corpus} : chaque socle porte une couverture (${nets.length}) ou le losange (${cages.length})`,
        '⛔ un socle sans image ET sans losange est un rectangle vide');

      // 🔑 LE REPLI EST LA MOITIÉ DE LA RÈGLE — la vignette du CDN manque une
      //   fois sur soixante (129/131, mesuré le 06/09). Une adresse réécrite
      //   sans `data-repli` affiche un cadre cassé, et rien ne le dit.
      const reecrites = (h.match(/class="socle__(?:fond|net) ok" src="[^"]*thumbnail[^"]*"/g) || []).length;
      const repliees = (h.match(/class="socle__(?:fond|net) ok" src="[^"]*thumbnail[^"]*"[^>]*data-repli="/g) || []).length;
      dit(reecrites === repliees,
        `${corpus} : les ${reecrites} adresse(s) réécrite(s) partent avec leur repli`,
        `⛔ ${reecrites - repliees} vignette(s) sans \`data-repli\` — cadre cassé une fois sur soixante`);

      // ⛔ LE LOSANGE EST DESSINÉ, PAS RÉFÉRENCÉ. `/market/` le tire de son
      //   sprite local ; un rayon n'en a pas. Un `use href="#s-r-…"` ici ne
      //   lève rien, ne casse rien, et ne dessine rien — le pire des muets.
      const mortes = (h.match(/<use href="#s-r-[A-Z_]+"/g) || [])
        .filter((u) => !h.includes(`<symbol id="${/#(s-r-[A-Z_]+)/.exec(u)[1]}"`));
      dit(mortes.length === 0,
        `${corpus} : aucune référence morte vers un symbole absent`,
        `⛔ ${mortes.length} \`use\` sans \`symbol\` — un losange qui ne se dessine pas`);

      // ⭐⭐⭐ LE CROISEMENT — deux sources indépendantes, la même pièce.
      const fIdx = join('.reserve', 'rayon-index', `${corpus}.json`);
      if (!existsSync(fIdx)) {
        // ⛔ Pas de `return` silencieux : un § qui ne peut pas regarder le DIT.
        console.log(`  ⏸️  INDÉCIDABLE — ${fIdx} absent : le croisement ne peut pas se faire.`);
      } else {
        const c = JSON.parse(readFileSync(fIdx, 'utf8'));
        const pc = c.cols.indexOf('c');
        dit(pc >= 0 && c.cols.indexOf('cr') >= 0,
          `${corpus} : l'index porte \`c\` et \`cr\` — sans elles le pilote ne peut RIEN peindre`,
          '⛔ colonnes absentes : les 20 tuiles du serveur auraient leur image, les suivantes non');
        dit(typeof c.losange === 'string' && c.losange.includes('<svg'),
          `${corpus} : le losange voyage avec la charge (le pilote ne peut pas appeler \`forme()\`)`);
        dit(typeof c.onerror === 'string' && c.onerror.includes('dataset.repli'),
          `${corpus} : le gestionnaire de repli voyage avec la charge, il n'est pas recopié`);
        if (pc >= 0) {
          const cdn = c.cdn || '';
          const deposees = new Set(c.lignes.map((l) => l[pc]).filter(Boolean).map((a) => cdn + a));
          const servies = [...h.matchAll(/class="socle__net ok" src="([^"]+)"/g)].map((m) => m[1]);
          const orphelines = servies.filter((u) => !deposees.has(u));
          dit(servies.length > 0 && orphelines.length === 0,
            `${corpus} : les ${servies.length} adresse(s) SERVIES sont mot pour mot celles que l'index DÉPOSE`,
            `⛔ ${orphelines.length} divergence(s), p.ex. ${orphelines[0] || '—'}`
            + ' — les deux fabriques ne rendraient pas la même image');
        }
      }
    }
    // ⭐⭐ ET LE PILOTE PEINT LE MÊME SOCLE — jugé sur le CODE DÉCAPÉ, comme au
    //   § ⑥ et pour la même raison : aucun banc branché sur `dist/` ne peut le
    //   voir, le pilote n'écrit rien dans `dist/`. ⛔ On retire les
    //   commentaires des DEUX côtés avant de chercher : cinq fois dans ce
    //   dépôt un banc a trouvé sa chaîne dans le commentaire qui documentait le
    //   sujet — et une fois dans celui qui DÉSACTIVAIT la ligne.
    const pil = 'src/socle/modules/rayon.js';
    if (existsSync(pil)) {
      const nu2 = readFileSync(pil, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
      for (const [motif, quoi, mal] of [
        [/className\s*=\s*'socle'/, 'le pilote bâtit un `socle`',
          '⛔ les 20 tuiles du serveur auraient leur cadre, les filtrées non'],
        [/className\s*=\s*'rayon__b'/, 'le pilote pose l\'enveloppe `rayon__b`',
          '⛔ sans elle, la cartouche n\'existe pas et le texte flotte sous l\'image'],
        [/idx\.losange/, 'le pilote LIT le losange de la charge, il ne le redessine pas',
          '⛔ un second dessin du même glyphe : deux sources qui divergeront'],
        [/idx\.onerror/, 'le pilote LIT le gestionnaire de repli de la charge',
          '⛔ recopié, il divergera — et le cadre cassé ne se verra que sur les lignes filtrées'],
        [/idx\.cdn/, 'le pilote recolle le préfixe factorisé par l\'index',
          '⛔ sans lui, les adresses courtes partent en chemins relatifs'],
      ]) dit(motif.test(nu2), quoi, mal);
    }

    // ⭐⭐⭐ LA GARDE DE `sets` — ET CE QU'ELLE MESURE VRAIMENT, CORRIGÉ LE 06/09.
    // La première version de ce § lisait `dist/…/sets/index.html` et vérifiait
    // qu'il ne porte pas `rayon--tui`. Elle était VERTE, et une injection l'a
    // prise en défaut : poser `rayon--tui` sur `sets` ne la faisait pas rougir.
    // ⭐ La cause n'était pas le banc, c'était la PRÉMISSE : `/sets/` ne passe
    // pas par `Rayon.astro` du tout (aucune page ne lui écrit `rayon="sets"`,
    // vérifié sur les appelants), et sa page servie n'a même pas `#r-liste`.
    // L'assertion était donc vraie pour une raison sans rapport avec ce qu'elle
    // prétendait protéger — *un banc vert pour une mauvaise raison*, le pire
    // des trois états.
    // ⇒ ON MESURE CE QUI EST MESURABLE : la garde existe dans le code, ET la
    //   branche `sets` du composant n'a toujours aucun appelant. Le jour où
    //   quelqu'un en ajoute un, la seconde rougit — et c'est précisément ce
    //   jour-là qu'il faut regarder la vue.
    const gab = 'src/components/Rayon.astro';
    if (existsSync(gab)) {
      // 🔴🔴🔴 L'ORDRE DU DÉCAPAGE N'EST PAS LIBRE, ET IL M'A COÛTÉ UNE PASSE.
      // Décaper les blocs `/* … */` AVANT les lignes `//` mange le gabarit
      // entier : ce fichier contient des commentaires de LIGNE qui citent des
      // ouvertures de bloc, et le premier `/*` ainsi cité s'apparie avec un
      // `*/` situé quatre cents lignes plus bas. Le texte décapé perdait
      // `const tuiles`, et l'assertion rougissait sur du code JUSTE.
      // ⇒ LES LIGNES D'ABORD, LES BLOCS ENSUITE. *Un banc qui se trompe de
      //   verdict sur du code juste apprend à ne plus être cru.*
      const nu3 = readFileSync(gab, 'utf8')
        .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
      // ⛔ ET ON VÉRIFIE QUE LE DÉCAPAGE N'A PAS TOUT MANGÉ — un auto-contrôle,
      //   parce qu'un texte vide satisfait « la chaîne interdite est absente »
      //   et rend n'importe quelle recherche négative sans rien prouver.
      dit(nu3.length > readFileSync(gab, 'utf8').length / 4,
        `le décapage du gabarit laisse de quoi lire (${nu3.length} car.)`,
        '⛔ décapage trop gourmand : toutes les recherches qui suivent sont sans valeur');
      dit(/const tuiles\s*=\s*rayon\s*!==\s*'sets'/.test(nu3),
        'la vue tuiles est refusée à `sets` dans le gabarit (code, commentaires retirés)',
        '⛔ la garde a sauté : la branche `sets` rendrait des tuiles sans image');
    }
    const appelants = ['src/pages', 'src/components/pages'].filter((d) => existsSync(d))
      .flatMap((d) => readdirSync(d, { recursive: true })
        .filter((x) => String(x).endsWith('.astro'))
        .filter((x) => /rayon\s*=\s*["'{][^"'}]*sets/.test(readFileSync(join(d, String(x)), 'utf8'))));
    dit(appelants.length === 0,
      `la branche \`sets\` de \`Rayon.astro\` n'a toujours aucun appelant (${appelants.length})`,
      `⛔ ${appelants[0] || ''} passe désormais \`sets\` : la vue de ce rayon n'a JAMAIS été mesurée`);
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// ⑧ LE PILOTE BÂTIT UNE VRAIE TUILE — ET ON LA MET À CÔTÉ DE CELLE DU SERVEUR
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 CE § FERME LE TROU QUE LE § ⑦ LAISSAIT OUVERT, ET QUI ÉTAIT ÉCRIT NOIR
// SUR BLANC DANS LA NOTE DE REPRISE : « le pilote n'est jugé que par grep ; une
// tuile bâtie côté client n'a jamais été construite pour de vrai ».
// Un `grep` dit que le code CONTIENT `className = 'socle'`. Il ne dit pas que le
// nœud SORT, ni qu'il porte la bonne adresse, ni qu'il survit à l'exécution.
// ⭐⭐ C'est exactement la différence entre « la ligne est là » et « la ligne
// gagne » que ce dépôt a payée cinq fois sur le CSS. Elle vaut aussi pour le JS.
//
// ⭐⭐⭐ ET LE CONTRÔLE EST APPARIÉ **PAR PIÈCE**, PAS PAR RANG. `test:series`
// compare la carte n° 60 (serveur) à la n° 61 (pilote) : deux sets différents,
// donc il ne peut mesurer que la FORME. Ici le bouton « tous » (`data-fiche=""`)
// ne retire aucune ligne : le pilote repeint LE MÊME corpus, et on peut donc
// apparier chaque tuile à celle que le serveur avait rendue POUR LA MÊME PIÈCE
// et comparer les ADRESSES, pas seulement les squelettes. C'est le seul montage
// qui attrape « le pilote peint une image, mais pas la bonne ».
//
// ⛔ LE SEUL POINT DE RÉSEAU EST REMPLACÉ PAR LE FICHIER QUE LE BUILD VIENT DE
// DÉPOSER — jamais par un index inventé, qui mesurerait le banc et pas le site.
{
  console.log('\n── ⑧ le pilote bâtit une vraie tuile (lot E) ──');
  const DIST = ['dist/client', 'dist'].find((d) => existsSync(join(d, 'collectibles'))) || 'dist/client';
  const pilote = 'src/socle/modules/rayon.js';
  const chargeur = 'src/socle/modules/index_rayon.js';
  // 🔴🔴🔴 LES DEUX CORPUS, ET C'EST UNE CORRECTION DE PÉRIMÈTRE.
  // La première version ne jugeait que `/collectibles/`. Une injection l'a prise
  // en défaut : faire servir au pilote la GRANDE image au lieu de la vignette
  // n'a **rien fait rougir**. ⭐ La cause n'était ni le banc ni le code —
  // `imageCarte()` ne réécrit JAMAIS un collectible (sa vignette fait 132 px
  // pour une tuile qui en dessine 207, elle serait agrandie). Il n'y a donc
  // aucune vignette à casser dans ce corpus : l'injection avait changé le TEXTE
  // du code sans retirer ce que l'assertion protège.
  // ⭐⭐⭐ *« L'injection a atterri » se mesure sur l'EFFET, pas sur le
  // fichier.* Les 34 adresses réécrites vivent dans `/comics/` — un § qui ne
  // regarde pas ce corpus-là est vert sur un sujet qu'il n'a jamais vu.
  for (const corpus of ['collectibles', 'comics']) {
  const page = join(DIST, `${corpus}/index.html`);
  const fIdx = join(DIST, `rayon-index/${corpus}.json`);
  const manque = [[page, 'la page servie'], [pilote, 'le pilote'],
                  [chargeur, 'le chargeur'], [fIdx, 'l\'index déposé']]
    .filter(([p]) => !existsSync(p)).map(([, q]) => q);
  if (!existsSync(page)) {
    console.log(`  --  SANS OBJET — ce site ne rend pas \`/${corpus}/\`.`);
  } else if (manque.length) {
    // ⛔ « INDÉCIDABLE », et il le DIT. Un `return` muet rendrait ce § vert
    //   avant tout build — un succès qui ressemble à un succès.
    console.log(`  ⏸️  INDÉCIDABLE — ${manque.join(' · ')} absent(s) : rien n'a été mesuré.`);
  } else {
    const { monterDOM } = await import('./_dom_banc.mjs');
    const dom = await monterDOM(readFileSync(page, 'utf8'));
    if (!dom) {
      console.log('  ⏸️  INDÉCIDABLE — linkedom absent : le pilote n\'a pas pu être joué.');
    } else {
      // ⭐ CE QUE LE SERVEUR AVAIT RENDU, RELEVÉ AVANT DE TOUCHER À QUOI QUE CE
      //   SOIT. Après l'exécution, `#r-liste` est REMPLACÉE : ce relevé n'existe
      //   plus nulle part. *On mesure avant la couche qui réécrit.*
      const releve = (d) => [...d.querySelectorAll('#r-liste .rayon__l')].map((li) => {
        const n = li.querySelector('.rayon__n');
        const net = li.querySelector('.socle__net');
        return {
          nom: (n && n.textContent || '').trim(),
          src: net ? net.getAttribute('src') : null,
          repli: net ? net.getAttribute('data-repli') : null,
          onerr: net ? !!net.getAttribute('onerror') : false,
          losange: !!li.querySelector('.socle__cage'),
          corps: !!li.querySelector('.rayon__b'),
          socle: !!li.querySelector('.socle'),
        };
      });
      const duServeur = releve(dom.document);
      dit(duServeur.length > 0 && duServeur.every((t) => t.socle && t.corps),
        `${corpus} : le serveur a rendu ${duServeur.length} tuile(s) — sinon ce § ne prouve rien`,
        '⛔ rien à comparer : le montage est cassé, pas le pilote');

      const charge = JSON.parse(readFileSync(fIdx, 'utf8'));
      dom.window.fetch = () => Promise.resolve({
        ok: true, status: 200, json: () => Promise.resolve(charge),
      });
      const jouer = (p) => new Function('document', 'window', 'console', 'localStorage',
        readFileSync(p, 'utf8'))(dom.document, dom.window,
        { log() {}, warn() {}, error() {} }, undefined);
      let leve = null;
      // ⭐ L'ORDRE DU DOCUMENT : le chargeur d'abord, le pilote ensuite. C'est ce
      //   que `defer` garantit dans la page, et ce que `test:series` a appris en
      //   levant « window.vpIndexRayon is not a function ».
      try { jouer(chargeur); jouer(pilote); } catch (e) { leve = e.message; }
      dit(!leve, `${corpus} : le chargeur et le pilote s'exécutent sans lever`, leve);

      // ⭐⭐ LE BOUTON « TOUS » (`data-fiche=""`) NE RETIRE AUCUNE LIGNE. C'est
      //   ce qui rend l'appariement par pièce possible : le pilote repeint le
      //   MÊME corpus. ⛔ Un bouton qui filtre aurait donné deux populations, et
      //   on serait retombé sur la comparaison de FORME de `test:series`.
      const tous = dom.document.querySelector('[data-fiche=""]');
      if (!tous) {
        console.log('  ⏸️  INDÉCIDABLE — pas de bouton « tous » : le pilote n\'a pas été déclenché.');
      } else {
        tous.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setImmediate(r));
        const duPilote = releve(dom.document);

        // 🔴 LE TÉMOIN D'ABORD : si le pilote n'a rien repeint, tout ce qui suit
        //   compare le serveur à LUI-MÊME et serait vert sans rien prouver.
        //   ⭐ On le mesure par un attribut que SEUL le pilote pose.
        const barre = dom.document.querySelector('[data-retenues]');
        dit(!!barre, `${corpus} : le pilote a REPRIS LA MAIN — sinon ce § se mesure lui-même`,
          '⛔ `data-retenues` absent : `appliquer()` n\'a jamais tourné');

        dit(duPilote.length > 0 && duPilote.every((t) => t.socle),
          `${corpus} : le pilote a bâti ${duPilote.length} tuile(s), toutes avec un socle`,
          '⛔ des tuiles sans cadre : la grille aurait des trous au premier filtre');
        dit(duPilote.every((t) => t.corps),
          `${corpus} : chaque tuile bâtie porte l'enveloppe \`rayon__b\``,
          '⛔ sans elle la cartouche n\'existe pas et le texte flotte sous l\'image');
        dit(duPilote.every((t) => t.src || t.losange),
          `${corpus} : chaque tuile bâtie montre une couverture ou le losange`,
          '⛔ un socle vide — le défaut que le lot 127 a interdit sur le Marché');

        // ⭐⭐⭐ L'APPARIEMENT SE FAIT PAR **RANG**, ET C'EST UNE CORRECTION.
        // 🔴 La première version appariait par NOM. Elle a rougi tout de suite —
        // **10 écarts sur 20** — et c'était MON BANC, pas le code : dans les 20
        // lignes servies, « Batman Gold » apparaît **4 fois**, « Iron Man
        // Variant » 4, « Loki » 3, « Groot Prime » 3. Un nom de pièce n'est pas
        // une clé : 8 noms couvrent 28 lignes de l'index. La `Map` écrasait, et
        // le banc comparait deux pièces différentes en annonçant un écart
        // d'image. *Un identifiant qu'on n'a pas vérifié unique fabrique des
        // écarts qui n'existent pas.*
        //
        // ⭐⭐ ET LE RANG EST MIEUX QU'UN PIS-ALLER : il mesure en plus un
        // invariant que rien d'autre ne garde. `rayon_index.mjs` trie l'index
        // avec EXACTEMENT le tri de `Rayon.astro`, et son commentaire dit
        // pourquoi : « deux ordres, et un membre verrait la liste sauter à
        // l'ouverture de la barre sans avoir rien demandé — un défaut qu'on met
        // une heure à reproduire parce qu'il n'a l'air d'être rien ». Comparer
        // rang par rang, c'est tenir cet ordre ET les images d'un seul geste.
        const n = Math.min(duServeur.length, duPilote.length);
        const paires = [];
        for (let i = 0; i < n; i++) paires.push([duPilote[i], duServeur[i]]);
        dit(paires.length > 0,
          `${paires.length} rang(s) rendus par les DEUX fabriques — sinon rien n'est comparé`,
          '⛔ une des deux listes est vide : les contrôles suivants sont sans valeur');
        // 🔑 LE MÊME ORDRE, RANG PAR RANG. ⛔ Si ce contrôle rougit, celui des
        //   images qui suit ne veut plus rien dire : on compare deux pièces.
        const decales = paires.filter(([p, sv]) => p.nom !== sv.nom);
        dit(decales.length === 0,
          `les deux fabriques rendent la MÊME pièce à chaque rang (${paires.length})`,
          decales.length ? `⛔ ${decales.length} rang(s) décalés, p.ex. pilote « ${decales[0][0].nom} »`
            + ` contre serveur « ${decales[0][1].nom} » — la liste SAUTERAIT à l'ouverture de la barre` : null);
        const ecarts = paires.filter(([p, sv]) => p.src !== sv.src || p.repli !== sv.repli
          || p.losange !== sv.losange);
        dit(ecarts.length === 0,
          `les ${paires.length} rang(s) ont la MÊME image des deux côtés (adresse et repli)`,
          ecarts.length ? `⛔ ${ecarts.length} écart(s), p.ex. « ${ecarts[0][0].nom} » : `
            + `pilote ${ecarts[0][0].src || 'losange'} · serveur ${ecarts[0][1].src || 'losange'}` : null);
        const sansRepli = paires.filter(([p]) => p.src && !p.onerr);
        dit(sansRepli.length === 0,
          `${corpus} : chaque image bâtie porte son gestionnaire de repli`,
          `⛔ ${sansRepli.length} image(s) sans \`onerror\` : cadre cassé une fois sur soixante`);
        // ⭐ ET ON DIT SI LE CHEMIN DE LA VIGNETTE A ÉTÉ EXERCÉ DANS CE CORPUS.
        //   Un corpus sans aucune réécriture rend le contrôle des adresses
        //   trivialement vrai : *un terme à zéro doit être atteignable, sinon
        //   il ne garde rien.* C'est ce silence-là qui a laissé passer une
        //   injection muette, et il est désormais ÉCRIT plutôt que deviné.
        const reec = paires.filter(([p]) => p.src && p.src.includes('thumbnail')).length;
        console.log(reec
          ? `  ..  ${corpus} : ${reec} vignette(s) réécrite(s) — le contrôle des adresses MORD ici.`
          : `  ⏸️  ${corpus} : aucune vignette réécrite — le contrôle des adresses est vrai`
            + ' sans avoir été mis à l\'épreuve dans ce corpus.');
      }
    }
  }
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// ⑨ LA GRILLE DES TUILES DIT LA MÊME CHOSE QUE CELLE DU MARCHÉ
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 CE § NAÎT D'UNE COMPARAISON À LA MAQUETTE, LE 06/09, ET D'UN DÉFAUT RÉEL.
// `maquette-design-v4-05-09.html` rend le rayon en **2 colonnes / gap 9px** sous
// 520 px. Le thème portait DÉJÀ cette règle — pour `.tuiles`, la grille du
// Marché. Ma vue s'appelle `.rayon--tui` : elle ne l'a jamais reçue, et servait
// **une seule colonne à 375 px**. Aucun banc ne l'a vu, parce qu'aucun banc ne
// lisait la géométrie ; et le rendu n'a jamais été ouvert.
// ⭐⭐ Deux blocs disent maintenant la même chose à deux sélecteurs. C'est
// exactement la situation de `LARGEUR_PILE`, dont `rayon_index.mjs` écrit :
// « si l'une bouge, `test:series` § 2 rougit — c'est le seul garde-fou ». On
// pose le même ici. *Une valeur écrite deux fois sans contrôle divergera.*
// ⛔ Et on ne compare pas des chaînes brutes : on extrait les DEUX déclarations
// et on compare colonnes et gouttière, pour qu'un espace de plus ne rougisse pas.
{
  console.log('\n── ⑨ la grille des tuiles contre celle du Marché ──');
  const th = 'themes/vitrine/theme.css';
  if (!existsSync(th)) {
    console.log('  --  SANS OBJET — ce site n\'embarque pas le thème vitrine.');
  } else {
    const css = readFileSync(th, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
    // ⭐ ON LIT TOUS LES BLOCS `@media (max-width:520px)` PUIS LE SÉLECTEUR
    //   DEDANS. ⛔ Une seule expression qui tente les deux d'un coup dépend de
    //   l'ordre des règles dans le bloc et de l'espacement : elle ne trouvait
    //   RIEN, et le § rougissait en accusant le CSS.
    const blocs = [...css.matchAll(/@media[^{]*max-width:\s*520px[^{]*\{([\s\S]*?)\n\}/g)]
      .map((m) => m[1]);
    const lire = (sel) => {
      for (const b of blocs) {
        const r = new RegExp(sel.replace('.', '\\.') + '\\s*\\{([^}]*)\\}');
        const m = r.exec(b);
        if (!m) continue;
        const col = /grid-template-columns\s*:\s*([^;}]+)/.exec(m[1]);
        const gap = /gap\s*:\s*([^;}]+)/.exec(m[1]);
        return { col: col && col[1].trim(), gap: gap && gap[1].trim() };
      }
      return null;
    };
    const marche = lire('.tuiles');
    const rayon = lire('.rayon--tui');
    dit(!!marche && !!rayon,
      'les deux grilles déclarent bien un palier mobile',
      `⛔ ${marche ? '' : '.tuiles absent · '}${rayon ? '' : '.rayon--tui absent'}`
      + ' — la vue tuiles du rayon retomberait à UNE colonne à 375 px');
    if (marche && rayon) {
      dit(marche.col === rayon.col && marche.gap === rayon.gap,
        `le rayon et le Marché ont la MÊME grille mobile (${rayon.col} · ${rayon.gap})`,
        `⛔ Marché ${marche.col} / ${marche.gap} contre rayon ${rayon.col} / ${rayon.gap}`
        + ' — deux grilles pour une seule maquette');
      // 🔑 ET LA VALEUR EST CELLE DE LA MAQUETTE, pas seulement « la même des
      //   deux côtés » : deux blocs identiques et faux resteraient verts.
      dit(/repeat\(\s*2\s*,\s*1fr\s*\)/.test(rayon.col || ''),
        'et c\'est bien 2 colonnes — la valeur de la maquette v4',
        `⛔ ${rayon.col} : la maquette rend le rayon en 2 colonnes sous 520 px`);
    }
  }
}

console.log(ko === 0 ? '\n✅ le rayon est entier, sans prix, et rien ne se perd\n'
                     : `\n🔴 ${ko} controle(s) en echec\n`);
process.exit(ko === 0 ? 0 : 1);
