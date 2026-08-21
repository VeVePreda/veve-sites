// ⚠️ VeVePreda/veve-sites — engine/tools/test_series.mjs   (FICHIER NEUF — lot 133)
// ═══════════════════════════════════════════════════════════════════════════
//  LES FILTRES DE SÉRIES — et la question qui décide de tout :
//  LE FILTRE CHERCHE-T-IL DANS TOUT, OU SEULEMENT DANS CE QUI EST AFFICHÉ ?
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 LA RÈGLE QUE CE BANC REND MESURABLE. Écrite dans ce dépôt depuis le lot
// 113, jamais vérifiée par autre chose qu'une relecture :
//     « FILTRES **OU** PAGINATION, JAMAIS LES DEUX côté client : un DOM à
//       20 lignes rend le filtre faux POUR TOUT LE MONDE, et il RÉPOND quand
//       même. »
// ⭐⭐⭐ C'est le pire profil de panne du projet : le contrôle ne casse pas, il
// MENT. Une grille filtrée sur les 60 premiers sets affiche des résultats
// plausibles, un compteur plausible, et une réponse fausse. Personne ne remonte
// un bug pour un filtre qui répond.
//
// ⭐⭐ CE BANC NE SE CONTENTE PAS DE CONSTATER QUE LA PAGE VA BIEN AUJOURD'HUI.
// Il FABRIQUE la condition hostile : il force la tranche d'affichage à 5 cartes
// avant d'exécuter le pilote, puis coche une licence qui en concerne beaucoup
// plus. Si le filtre ne regardait que les cartes visibles, le compteur ne
// pourrait pas dépasser 5.
// ⛔ SANS CETTE FABRICATION, LE BANC SERAIT VERT POUR RIEN. Le build hors ligne
// ne produit que ~37 sets, et `PAR_TRANCHE` vaut 60 : la tranche ne mord jamais.
// C'est « un banc joué dans toutes les configurations sauf une », et la seule
// qui compte est justement celle que l'échantillon ne contient pas — la même
// forme que l'oubli qui a coûté le lot 130.
//
// ⚠️ IL LIT LE HTML SERVI, PAS LA SOURCE. Un filtre peut être correct dans le
// `.astro` et absent du produit : c'est arrivé aux boutons de durée pendant
// trois jours (lot 132). *« Le sélecteur est dans le code » n'est pas une
// preuve.*

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const R = new URL('../..', import.meta.url).pathname;
let echecs = 0, lus = 0;
const verifie = (titre, ok, detail = '') => {
  if (!ok) echecs++;
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${titre}${detail ? `\n       ${detail}` : ''}`);
};
const indecis = (titre, pourquoi) => console.log(`  ⏸️   ${titre} — INDÉCIDABLE : ${pourquoi}`);
const fin = () => {
  console.log('\n7. auto-contrôle');
  if (lus < 5) { console.log(`  🔴 ce banc n'a inspecté que ${lus} élément(s) : il ne prouve rien.`); process.exit(2); }
  console.log(`  OK   ${lus} élément(s) inspecté(s)`);
  console.log(echecs ? `\n❌ ${echecs} echec(s)` : '\n✅ tout est vert');
  process.exit(echecs ? 1 : 0);
};

console.log(`\n═══ FILTRES DE SÉRIES — site « ${process.env.SITE || 'veveprice'} » ═══`);

const { priceEnabled } = await import('../lib/features.mjs');
if (!priceEnabled()) {
  // ⭐ TROIS VERDICTS. vevewiki n'a pas de page de sets : ce banc n'y a rien à
  //   dire, et il le DIT plutôt que de se déclarer vert.
  console.log('\n⏸️  sans objet — ce site ne publie pas de prix, il n\'a pas de page de séries.');
  process.exit(0);
}

const DIST = existsSync(join(R, 'dist/client')) ? join(R, 'dist/client') : join(R, 'dist');
const PAGE = join(DIST, 'sets/index.html');
if (!existsSync(PAGE)) { indecis('la page des séries', `${PAGE} absente — ce banc va APRÈS le build`); fin(); }
const html = readFileSync(PAGE, 'utf8');

// ═══════════════════════════════════════════════════════════════════════════
// 1. L'AXE EST DÉRIVÉ, PAS RECOPIÉ — et il l'est à UN seul endroit
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n1. la licence d\'un set est-elle dérivée de ses pièces, à un seul endroit ?');
const src = readFileSync(join(R, 'engine', 'lib', 'dataset.mjs'), 'utf8');
verifie('`dataset.mjs` pose `licensor` sur la collection',
  /c\.licensor\s*=/.test(src), 'un seul endroit calcule l\'axe');
verifie('…par MAJORITÉ, pas sur la première pièce rencontrée',
  /majoritaire\s*\(/.test(src) && /majoritaire\(c\.items,\s*'licensor'\)/.test(src),
  '⛔ `items[0].licensor` serait juste aujourd\'hui (0 set mixte) et faux en silence demain');
// ⛔ ET LE GABARIT NE LE REDÉRIVE PAS. Deux calculs pour un même axe divergent
//    au premier lot qui n'en touche qu'un — c'est la panne du lot 127.
const gab = readFileSync(join(R, 'src', 'components', 'pages', 'Collections.astro'), 'utf8');
const gabNu = gab.replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
verifie('le gabarit LIT `c.licensor`, il ne le recalcule pas',
  /c\.licensor/.test(gabNu) && !/licensor.*items\[0\]|items\[0\].*licensor/.test(gabNu),
  'un axe calculé à deux endroits diverge au premier lot qui n\'en touche qu\'un');
lus += 3;

// ═══════════════════════════════════════════════════════════════════════════
// 2. L'ÉMETTEUR — et le contrat dans LES DEUX SENS
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n2. le filtre et le tri sont-ils ÉMIS, et cohérents avec les cartes ?');
const sansScripts = html.replace(/<script[\s\S]*?<\/script>/g, '');
let proposees = [...sansScripts.matchAll(/name="s-lic" value="([^"]*)"/g)].map((m) => m[1]);
const portees = [...sansScripts.matchAll(/data-lic="([^"]*)"/g)].map((m) => m[1]);
lus += proposees.length + portees.length;

// 🔴🔴🔴 LOT 155-B — LA POPULATION DE RÉFÉRENCE A CHANGÉ, ET CE BANC L'A DIT.
// Il comparait « licences proposées » à « licences portées par les cartes du
// HTML SERVI ». Depuis ce lot, `/sets/` ne sert plus que 60 cartes sur 3 113 :
// il a donc annoncé **70 options mortes** qui n'en sont pas — la référence
// était devenue un échantillon, sans que la question change.
// ⭐⭐⭐ *Un invariant juste peut répondre à la mauvaise question.* Le contrat
// (« aucune option ne filtre vers le vide », « aucun set n'est inatteignable »)
// reste exactement le bon ; c'est le CORPUS contre lequel il se mesure qui doit
// être le rayon entier. Et le rayon entier, c'est l'index — le fichier que le
// build vient de déposer, pas une reconstruction.
// ⛔ On ne remplace pas `portees` : les cartes SERVIES doivent toujours porter
// `data-lic`, et ce contrôle-là garde sa valeur. On ajoute la seconde
// population, et chaque contrôle dit désormais sur laquelle il porte.
const fIndexSets = join(R, 'dist', 'client', 'rayon-index', 'sets.json');
const idxSets = existsSync(fIndexSets) ? JSON.parse(readFileSync(fIndexSets, 'utf8')) : null;
const porteesRayon = idxSets
  ? idxSets.lignes.map((l) => {
    const k = idxSets.cols.indexOf('l');
    const i = k < 0 ? 0 : l[k];
    return (i && idxSets.dic.l) ? idxSets.dic.l[i - 1] : '';
  })
  : portees;
if (idxSets) lus += porteesRayon.length;

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LOT 143 — CE § A ÉTÉ VERT SUR UN BUILD QU'IL N'AVAIT PAS MESURÉ
// ═══════════════════════════════════════════════════════════════════════════
// Le repli d'origine déduisait « moins de deux licences » de « aucune puce
// trouvée dans le HTML ». Les deux phrases n'ont jamais été la même. Mesuré le
// 12/08 : un build portant QUATRE licences distinctes sortait
// « INDÉCIDABLE — moins de deux licences », et le banc se déclarait vert.
// ⭐⭐⭐ La donnée qui départage était déjà là, deux lignes plus haut :
// `portees` compte les licences que les CARTES portent. Le banc l'avait
// collectée et ne s'en servait pas.
// ⭐⭐ Et un message d'échec est une instruction : celui-là nommait une cause
// qu'il ne pouvait pas départager, donc il envoyait chercher au mauvais
// endroit. Il nomme maintenant ce qu'il a compté, dans les deux cas.
//
// ⇒ DEPUIS LE LOT 143 LES PUCES NE SONT PLUS SERVIES : le pilote les construit
//   à la première ouverture du panneau, depuis les cartes. Un banc qui lit le
//   HTML statique ne peut donc PLUS voir le filtre — il faut l'ouvrir.
//   ⛔ On n'assouplit pas le contrat pour autant : il se vérifie sur le DOM
//   APRÈS ouverture, dans les deux sens, exactement comme avant.
const licPortees = new Set(portees.filter(Boolean)).size;
if (proposees.length === 0) {
  const conteneur = /id="s-lics"[^>]*data-puces="lic"/.test(sansScripts);
  if (!conteneur && licPortees > 1) {
    // Ni puces servies, ni conteneur à remplir, mais des cartes qui portent
    // plusieurs licences : le filtre a disparu, ce n'est pas un cas SANS OBJET.
    verifie('le filtre licence existe sous une forme ou une autre', false,
      `🔴 ${licPortees} licence(s) portées par les cartes, aucune puce et aucun conteneur \`data-puces="lic"\``);
    fin();
  }
  if (!conteneur) {
    indecis('le filtre licence',
      `${licPortees} licence(s) portée(s) par les cartes — sous deux, le panneau ne s'émet pas, et c'est voulu`);
    fin();
  }
  // Le conteneur est là : on exécute le pilote et on OUVRE le panneau.
  const { monterDOM: monterPourPuces } = await import('./_dom_banc.mjs');
  const srcPilote = join(R, 'src', 'socle', 'modules', 'series.js');
  const domP = existsSync(srcPilote) ? await monterPourPuces(html) : null;
  if (!domP) {
    indecis('le filtre licence construit',
      'linkedom ou le pilote absent — le panneau n\'a pas pu être ouvert, donc rien n\'a été mesuré');
    fin();
  }
  // 🔴🔴🔴 LOT 155-B — LE PILOTE NE SUFFIT PLUS, ET C'EST CE BANC QUI L'A DIT.
  // `/sets/` ne rend plus que 60 cartes : le pilote appelle `window.vpIndexRayon`
  // (module `index_rayon.js`, partagé avec la barre de rayon) pour bâtir les
  // 3 053 autres. Ce banc chargeait `series.js` seul — il a levé
  // « window.vpIndexRayon is not a function », c'est-à-dire exactement ce
  // qu'une page à qui il manquerait un `<script>` aurait fait.
  // ⭐⭐ ON MONTE DONC LES DEUX MODULES, DANS L'ORDRE DU DOCUMENT, et on
  // remplace le SEUL point de réseau par le fichier que le build vient de
  // déposer. ⛔ Pas par un faux : un index inventé mesurerait le banc, pas le
  // site. C'est `dist/client/rayon-index/sets.json`, au chiffre près.
  const srcChargeur = join(R, 'src', 'socle', 'modules', 'index_rayon.js');
  const fIdx = join(R, 'dist', 'client', 'rayon-index', 'sets.json');
  if (!existsSync(srcChargeur) || !existsSync(fIdx)) {
    indecis('le pilote de sets',
      `${existsSync(srcChargeur) ? '' : 'index_rayon.js absent · '}`
      + `${existsSync(fIdx) ? '' : 'dist/client/rayon-index/sets.json absent'} — rien n'a été mesuré`);
    fin();
  }
  const chargeIdx = JSON.parse(readFileSync(fIdx, 'utf8'));
  domP.window.fetch = () => Promise.resolve({
    ok: true, status: 200, json: () => Promise.resolve(chargeIdx),
  });
  const fnC = new Function('document', 'window', 'console', 'localStorage',
    readFileSync(srcChargeur, 'utf8'));
  const fnP = new Function('document', 'window', 'console', 'localStorage',
    readFileSync(srcPilote, 'utf8'));
  try {
    fnC(domP.document, domP.window, { log() {}, warn() {}, error() {} }, undefined);
    fnP(domP.document, domP.window, { log() {}, warn() {}, error() {} }, undefined);
  } catch (e) {
    verifie('le pilote s\'exécute avant d\'ouvrir le panneau', false, `🔴 ${e.message}`);
    fin();
  }
  // ⭐⭐⭐ §2 bis — LA CONTRE-ÉPREUVE DES DEUX FABRIQUES, ET ELLE EST LE CŒUR
  // DE CE LOT. Le serveur rend 60 cartes, le pilote en bâtit 3 053 : c'est
  // `regle-seconde-fabrique-ne-montre-que-sa-source`, cinquième occurrence. Un
  // champ que l'index ne porte pas est structurellement inaffichable, et
  // l'écart ne se voit PAS — la grille a l'air pleine.
  // ⇒ On compare la carte n° 60 (SERVEUR) à la carte n° 61 (PILOTE) : mêmes
  // attributs présents, même squelette. ⛔ Pas les mêmes VALEURS — ce sont deux
  // sets différents ; ce qu'on mesure est la FORME.
  const avantBatir = domP.document.querySelectorAll('#s-grille .col-carte').length;
  const bPlusB = domP.document.getElementById('s-plus');
  if (bPlusB) bPlusB.dispatchEvent(new domP.window.Event('click', { bubbles: true }));
  await new Promise((r) => setImmediate(r));
  const toutes = [...domP.document.querySelectorAll('#s-grille .col-carte')];
  // 🔴🔴🔴 LE CORPUS PEUT ÊTRE PLUS PETIT QU'UNE TRANCHE, ET CE BANC L'A APPRIS
  // EN ROUGISSANT SUR `main` (17/08, run 32023786925).
  // La CI construit avec **`WAREHOUSE_OFFLINE=1`** : le rayon y fait **48 sets**,
  // sous la tranche de 60. Le gabarit ne rend donc **aucun bouton « voir plus »**
  // (`axes.length > PAR_TRANCHE` est faux), les 48 partent au serveur, et il n'y
  // a **rien à bâtir**. Le site est CORRECT ; c'est ce contrôle qui exigeait un
  // bâtissage impossible.
  // ⭐⭐⭐ *Un banc doit distinguer « faux » de « sans objet ».* Les quatre
  // verdicts existent pour ça, et j'ai rendu un ÉCHEC là où la bonne réponse
  // était SANS OBJET. ⛔ Et ce n'est pas un assouplissement : la condition porte
  // sur le **CORPUS** (`total <= tranche servie`), pas sur ce que la page a
  // rendu. Le jour où la production servirait tout son rayon, `total` vaudrait
  // 3 113 et le contrôle mordrait — c'est exactement le cas qu'il doit attraper.
  // ⚠️ ET J'AURAIS DÛ LE VOIR : ma propre mémoire dit « ⛔ ne pas juger
  // l'échelle sur `WAREHOUSE_OFFLINE=1` ». Je l'avais lue comme « ne mesure pas
  // des tailles là-dedans » ; elle dit aussi **« la CI, elle, y vit »**.
  const corpusTient = chargeIdx.total <= avantBatir;
  if (corpusTient) {
    indecis('le bâtissage des cartes manquantes',
      `SANS OBJET — le rayon entier (${chargeIdx.total} set(s)) tient dans la tranche servie `
      + `(${avantBatir}) : le gabarit n'émet pas « voir plus », il n'y a rien à bâtir. `
      + 'C\'est le corpus hors réseau de la CI ; en production il fait 3 113.');
  } else {
    verifie('cliquer « voir plus » BÂTIT les cartes manquantes — sinon ce § ne prouve rien',
      avantBatir > 0 && toutes.length > avantBatir,
      `avant ${avantBatir}, après ${toutes.length} (index : ${chargeIdx.total})`);
    verifie('la grille bâtie porte EXACTEMENT le corpus de l\'index',
      toutes.length === chargeIdx.total, `${toutes.length} carte(s) contre ${chargeIdx.total}`);
  }
  // ⭐⭐⭐ CE QUI SUIT NE DÉPEND PAS DU BÂTISSAGE, ET C'EST VOULU : la
  // comparaison SERVEUR ↔ INDEX est le cœur du lot, et elle doit tourner AUSSI
  // dans la CI. Elle ne demande que les cartes servies et l'index — les deux
  // existent quel que soit le corpus. ⛔ La laisser sous le `if` l'aurait rendue
  // muette hors réseau, c'est-à-dire **muette là où elle garde `main`**.
  {
    // ⭐ La carte n° 60 vient du SERVEUR, la n° 61 du PILOTE. ⛔ SANS OBJET quand
    // il n'y a pas de n° 61 — voir le bloc du corpus court ci-dessus.
    if (!corpusTient && toutes.length > avantBatir) {
      const duServeur = toutes[avantBatir - 1];
      const duPilote = toutes[avantBatir];
      const ATTRS = ['data-n', 'data-brand', 'data-lic', 'data-an', 'data-ty', 'data-taille'];
      const manquants = ATTRS.filter((a) => duServeur.hasAttribute(a) && !duPilote.hasAttribute(a));
      verifie('la carte du PILOTE porte les mêmes `data-*` que celle du SERVEUR',
        manquants.length === 0,
        manquants.length ? `🔴 absent(s) du pilote : ${manquants.join(', ')} — le filtre les lit`
          : ATTRS.join(' · '));
      const squelette = (el) => ['.col-carte__pile', '.cartouche', '.cartouche__n']
        .filter((sel) => el.querySelector(sel));
      verifie('la carte du PILOTE a le même squelette que celle du SERVEUR',
        squelette(duPilote).join('|') === squelette(duServeur).join('|'),
        `serveur ${squelette(duServeur).length} · pilote ${squelette(duPilote).length}`);
    }
    // 🔴🔴🔴 CONTRE-ÉPREUVE — ET LA PREMIÈRE VERSION DE CE BLOC NE MESURAIT RIEN.
    // Elle comparait la carte bâtie à la valeur lue DANS L'INDEX. J'ai vidé la
    // colonne des vignettes, puis remplacé chaque nom coupé par le nom entier :
    // **le banc est resté vert les deux fois**. Évidemment — les deux côtés de
    // la comparaison venaient du même fichier. *Un contrôle qui interroge sa
    // propre source ne peut pas échouer.*
    // ⭐⭐⭐ L'ANCRE EXISTE, ET ELLE EST DANS LA PAGE : les 60 cartes que le
    // SERVEUR a rendues correspondent, une à une et dans l'ordre, aux 60
    // premières lignes de l'index. Ce sont les MÊMES sets rendus par les DEUX
    // fabriques — c'est le seul endroit du site où on peut les mettre côte à
    // côte, et c'est exactement ce que `regle-seconde-fabrique` demande de
    // vérifier. Vider `c` ou fausser `nv` casse désormais la comparaison.
    const kNv = chargeIdx.cols.indexOf('nv');
    const kC = chargeIdx.cols.indexOf('c');
    const kN = chargeIdx.cols.indexOf('n');
    const cdn = chargeIdx.cdn || '';
    let ecartNom = null, ecartVig = null, coupesVues = 0;
    for (let i = 0; i < avantBatir && i < chargeIdx.lignes.length; i++) {
      const l = chargeIdx.lignes[i];
      const carte = toutes[i];
      // ① LE NOM AFFICHÉ PAR LE SERVEUR EST-IL CELUI QUE L'INDEX DÉPOSE ?
      const attendu = l[kNv] === 0 ? l[kN] : l[kNv];
      const vu = carte.querySelector('.cartouche__n');
      if (l[kNv] !== 0) coupesVues++;
      if (!ecartNom && (!vu || vu.textContent.trim() !== String(attendu).trim())) {
        ecartNom = `ligne ${i} : serveur « ${vu ? vu.textContent.trim() : '—'} » · index « ${attendu} »`;
      }
      // ② LES VIGNETTES DU SERVEUR SONT-ELLES CELLES QUE L'INDEX DÉPOSE ?
      const srcs = [...carte.querySelectorAll('img')].map((im) => im.getAttribute('src'));
      const attSrcs = (l[kC] || []).filter((u) => u !== 0)
        .map((u) => (String(u).indexOf('http') === 0 ? '' : cdn) + u);
      const socles = carte.querySelectorAll('.socle').length;
      if (!ecartVig && (srcs.join('|') !== attSrcs.join('|') || socles !== (l[kC] || []).length)) {
        ecartVig = `ligne ${i} : serveur ${srcs.length} image(s)/${socles} socle(s) · `
          + `index ${attSrcs.length} image(s)/${(l[kC] || []).length} socle(s)`;
      }
    }
    verifie(`le nom que l'index dépose est celui que le SERVEUR affiche (${avantBatir} cartes témoins)`,
      !ecartNom && coupesVues > 0,
      ecartNom ? `🔴 ${ecartNom} — le pilote écrirait un autre texte que le serveur`
        : `${avantBatir} carte(s) comparées, dont ${coupesVues} au nom coupé`);
    verifie('…et les vignettes que l\'index dépose sont celles que le SERVEUR rend',
      !ecartVig,
      ecartVig ? `🔴 ${ecartVig} — les cartes bâties n'auraient pas les mêmes images`
        : `${avantBatir} pile(s) comparées, adresse par adresse`);
    // ⛔ ET LE TÉMOIN QUI REND CES DEUX CONTRÔLES ATTEIGNABLES : sans une seule
    // carte au nom coupé parmi les 60, le premier ne regarderait que des noms
    // entiers et resterait vert quoi qu'il arrive.
    if (!coupesVues) {
      indecis('la coupe des noms', 'aucune des 60 cartes témoins n\'a un nom coupé — rien à comparer');
    }
  }
  const bt = domP.document.querySelector('.f-b[data-g="licence"]');
  // ⭐ AVANT / APRÈS MESURÉS, jamais un seul état : si le panneau contenait
  //   déjà des puces avant le clic, le clic ne prouverait rien.
  const avant = domP.document.querySelectorAll('#s-lics .puce').length;
  if (bt) bt.dispatchEvent(new domP.window.Event('click', { bubbles: true }));
  // 🔴 LOT 155-B — ON REND LA MAIN AVANT DE COMPTER. Depuis ce lot, ouvrir un
  // panneau passe par `completer()` : le remplissage arrive une micro-tâche
  // plus tard, même quand l'index est déjà là. Compter tout de suite mesurait
  // la promesse, pas le panneau — et le banc rougissait « avant 0, après 0 »
  // pour une raison qui n'était pas le site.
  await new Promise((r) => setImmediate(r));
  const apres = [...domP.document.querySelectorAll('#s-lics input[name="s-lic"]')];
  verifie('ouvrir le panneau CONSTRUIT les puces — sinon ce § ne prouve rien',
    avant === 0 && apres.length > 0, `avant ${avant}, après ${apres.length}`);
  if (!apres.length) fin();
  proposees = apres.map((x) => x.getAttribute('value'));
  lus += proposees.length;
  // ⭐⭐ L'ORDRE EST UNE DÉCISION DU LOT 133, PAS UN HASARD : les licences se
  //   rangent par nombre de sets décroissant pour que Marvel arrive en tête.
  //   Un tri alphabétique passerait tous les contrôles de contenu ci-dessous
  //   et enterrerait quand même la licence majoritaire.
  const n = {};
  for (const v of porteesRayon.filter(Boolean)) n[v] = (n[v] || 0) + 1;
  const attendu = [...proposees].sort((a, b) => (n[b] - n[a]) || a.localeCompare(b));
  verifie('les puces construites gardent l\'ordre du serveur (par nombre de sets)',
    proposees.join('\u0000') === attendu.join('\u0000'),
    proposees.slice(0, 3).map((v) => `${v} ${n[v] || 0}`).join(' · '));
}
verifie('le panneau `sp-licence` est émis', /id="sp-licence"/.test(sansScripts),
  `${proposees.length} licence(s) proposée(s)`);
verifie('l\'option de tri par licence est émise',
  /<option value="licence">/.test(sansScripts), 'sinon le tri est un axe sans commande');
verifie('les cartes portent `data-lic`', portees.length > 0, `${portees.length} carte(s)`);

// ⭐⭐⭐ LE CONTRAT DANS LES DEUX SENS, et c'est ce qui rend ce §2 utile.
//   · une licence proposée que PORTE AUCUNE carte est une option morte : elle
//     filtre vers une grille vide, et l'utilisateur croit le catalogue vide ;
//   · une carte dont la licence n'est proposée NULLE PART est inatteignable :
//     elle existe et aucun filtre ne la trouve.
// Un banc qui ne tiendrait qu'un des deux sens laisserait passer l'autre —
// c'est la leçon des classes de thème émises sans règle (lot 131).
const setProp = new Set(proposees);
// ⭐ LE RAYON ENTIER, PAS LA TRANCHE SERVIE — voir le bloc du lot 155-B ci-dessus.
const setPort = new Set(porteesRayon.filter(Boolean));
const mortes = [...setProp].filter((v) => !setPort.has(v));
const orphelines = [...setPort].filter((v) => !setProp.has(v));
verifie('aucune licence proposée n\'est vide de sets (option morte)',
  mortes.length === 0, mortes.length ? `🔴 ${mortes.join(', ')}` : `${setProp.size} licence(s) toutes servies`);
verifie('aucune carte ne porte une licence absente du filtre (set inatteignable)',
  orphelines.length === 0, orphelines.length ? `🔴 ${orphelines.join(', ')}` : `${setPort.size} valeur(s) toutes proposées`);

// ═══════════════════════════════════════════════════════════════════════════
// 3. LE PILOTE — exécuté, dans une condition FABRIQUÉE hostile
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n3. le filtre cherche-t-il dans TOUT le DOM, ou dans la tranche affichée ?');
// ⭐ LE DOM VIENT DU MODULE PARTAGÉ : les correctifs d'instrument (dont
//   `<select>.value`, que linkedom n'implémente pas) sont écrits UNE fois.
//   Les recopier ici aurait été la 4ᵉ occurrence de « deux endroits qui font la
//   même chose divergent » — dont deux dans ce lot.
const { monterDOM, choisir, cocher } = await import('./_dom_banc.mjs');

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 139 — LE PILOTE N'EST PLUS DANS LA PAGE, ET C'EST UNE RÉPARATION
// ═══════════════════════════════════════════════════════════════════════════
// CE BANC A ÉTÉ VERT PENDANT TROIS JOURS SUR UNE PANNE RÉELLE, ET C'EST SA
// PROPRE MÉCANIQUE QUI L'A AVEUGLÉ. Il montait le HTML **entier** dans un DOM,
// **puis** exécutait le pilote. Le navigateur, lui, exécutait un `<script>` en
// ligne NON DIFFÉRÉ au moment où l'analyseur l'atteignait — c'est-à-dire
// 3 935 octets AVANT que `#s-plus` existe. `getElementById` rendait `null`,
// `pas` valait 0, `montre = pas || 1e9` valait un milliard, et la page servait
// **910 cartes** en annonçant 60.
// ⭐⭐⭐ *Un banc peut être vert pour une mauvaise raison* — et la bonne
// question n'était pas « le pilote marche-t-il ? » mais « sur quel ÉTAT DU DOM
// s'exécute-t-il ? ». Un banc qui monte le document entier ne peut pas,
// structurellement, voir un défaut d'ordre de parse.
//
// ⇒ DEUX CHOSES CHANGENT ICI, ET LES DEUX SONT NÉCESSAIRES :
//   ① la SOURCE du pilote — il vit maintenant dans `src/socle/modules/series.js`
//      et la page le référence en `<script defer src>` ; ce banc le lit donc au
//      fichier, plus dans le HTML ;
//   ② un § qui exécute le pilote sur le DOM **TRONQUÉ à l'endroit où le script
//      vivait** — le seul état qui reproduit la panne. Voir plus bas.
const MODULE_PILOTE = join(R, 'src', 'socle', 'modules', 'series.js');
if (!existsSync(MODULE_PILOTE)) {
  indecis('la source du pilote', `${MODULE_PILOTE} introuvable — le lot 139 est-il complet ?`);
  fin();
}
const scripts = [readFileSync(MODULE_PILOTE, 'utf8')];
verifie('le pilote vit dans le socle, pas dans la page', scripts[0].includes('s-grille'),
  `${(scripts[0].length / 1024).toFixed(1)} Ko dans src/socle/modules/series.js`);
lus++;

// ⛔ ET LE CIRCUIT SE FERME DANS L'AUTRE SENS : la page servie ne doit plus
//   porter UN SEUL script en ligne qui cherche `#s-plus`. Sans ce contrôle, on
//   pourrait remettre le pilote en ligne demain et ce banc resterait vert — il
//   lirait le fichier, pendant que le navigateur rejouerait la panne.
//   ⭐ *« Qui écrit, qui lit ? »* — ici : « qui SERT ? ».
const enLigne = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1]).filter((x) => x.includes('s-plus') || x.includes('s-grille'));
verifie('aucun pilote de tranche n\'est resté EN LIGNE dans la page servie',
  enLigne.length === 0,
  enLigne.length ? `🔴 ${enLigne.length} script(s) en ligne cherchent #s-plus — la panne d'ordre revient`
    : 'la page le demande en <script defer src>, qui attend la fin de l\'analyse');
lus++;
verifie('…et elle le DEMANDE bien', /<script defer src="[^"]*socle-[0-9a-f]+\.js"/.test(html),
  'un <script defer src> au moins — le module est référencé');
lus++;

// ⭐ LA TRANCHE EST FORCÉE À 5 AVANT L'EXÉCUTION. C'est le cœur du banc : on ne
//   demande pas à la page d'avoir 910 sets, on rend la tranche mordante.
const TRANCHE = 5;
// 🔴🔴🔴 ON FABRIQUE LA CONDITION DE PRODUCTION QUE L'ÉCHANTILLON NE CONTIENT
//    PAS, ET C'EST TOUT L'INTÉRÊT DU BANC.
//    Mesuré : le build HORS LIGNE rend ~37 sets, et `Collections.astro` n'émet
//    le bouton « voir plus » qu'au-delà de `PAR_TRANCHE` (60). La tranche ne
//    mord donc JAMAIS ici — alors qu'en production (910 sets) elle mord toujours.
//    Un banc qui se contenterait de l'échantillon serait vert sur la seule
//    configuration où la panne ne peut pas se produire : « un banc joué dans
//    toutes les configurations sauf une ne dit rien de celle-là ».
//    ⇒ On pose le bouton nous-mêmes, à l'identique de ce que le gabarit rend.
//    ⛔ MAIS ON VÉRIFIE D'ABORD QUE LE GABARIT LE REND VRAIMENT au-delà du
//      seuil : fabriquer une condition qui n'existe pas en production, ce serait
//      mesurer un écran que personne ne verra — exactement le reproche qu'on
//      fait aux bancs branchés ailleurs.
const gabPlus = /id="s-plus"[^>]*data-pas=\{PAR_TRANCHE\}/.test(gab)
  && /axes\.length > PAR_TRANCHE/.test(gab);
verifie('le gabarit rend bien une tranche au-delà du seuil (sinon rien à fabriquer)',
  gabPlus, gabPlus ? '`axes.length > PAR_TRANCHE` → bouton `s-plus` avec `data-pas`'
    : '🔴 introuvable dans Collections.astro — la condition fabriquée ci-dessous n\'existerait pas en production');
lus++;

const monter = async () => {
  const dom = await monterDOM(html);
  if (!dom) return { absent: true };
  const { document, window } = dom;
  let plus = document.getElementById('s-plus');
  if (!plus && gabPlus) {
    // Le bouton que le gabarit rendrait avec 910 sets, posé ici avec 37.
    plus = document.createElement('button');
    plus.id = 's-plus';
    plus.setAttribute('type', 'button');
    document.body.appendChild(plus);
    const cpt = document.createElement('span');
    cpt.id = 's-plus-cpt';
    document.body.appendChild(cpt);
  }
  if (plus) plus.setAttribute('data-pas', String(TRANCHE));
  // 🔴 LOT 155-B — LE PILOTE NE VIT PLUS SEUL : la page émet DEUX `<script
  // defer>`, `index_rayon.js` puis `series.js`. Un banc qui n'en monte qu'un
  // mesure une page qui n'existe pas — c'est la leçon de ce matin, celle des
  // 978 pages : *éprouver sans la condition de production, c'est éprouver dans
  // une condition qui n'existe pas.*
  if (!plus || !plus.getAttribute('data-total')) {
    if (plus) plus.setAttribute('data-total', String(idxSets ? idxSets.total : 0));
  }
  window.fetch = () => Promise.resolve({
    ok: true, status: 200, json: () => Promise.resolve(idxSets),
  });
  const fnCh = new Function('document', 'window', 'console', 'localStorage',
    readFileSync(join(R, 'src', 'socle', 'modules', 'index_rayon.js'), 'utf8'));
  const fn = new Function('document', 'window', 'console', 'localStorage', scripts[0]);
  try {
    fnCh(document, window, { log() {}, warn() {}, error() {} }, undefined);
    fn(document, window, { log() {}, warn() {}, error() {} }, undefined);
  } catch (e) {
    return { erreur: e.message, document, window };
  }
  return { document, window };
};

const r = await monter();
if (r.absent) { indecis('l\'exécution du pilote', 'linkedom absent — `npm i -D linkedom`'); fin(); }
verifie('le pilote s\'exécute sans lever', !r.erreur, r.erreur || 'aucune exception');
if (r.erreur) fin();
const { document, window } = r;

// 🔴🔴🔴 LOT 155-B — DEUX POPULATIONS, ET LES CONFONDRE OUVRAIT UN TROU.
// `cartesServies` est ce que le serveur a écrit (60 depuis ce lot) : c'est la
// bonne mesure pour « la tranche mord ». `grille()` INTERROGE le DOM à chaque
// appel : c'est la bonne mesure une fois que le pilote a bâti les 3 053 autres.
// ⛔ Garder une liste FIGÉE de 60 pour juger le filtre aurait été pire qu'un
// faux : les cartes retenues par « Marvel » ne sont pas dans les 60 premières,
// donc `visibles()` aurait rendu un tableau VIDE — et `.every()` sur un tableau
// vide est VRAI. Le contrôle « toutes les cartes visibles portent la licence »
// serait passé sans jamais regarder une seule carte.
// ⭐⭐⭐ *Un terme à zéro qui n'est pas atteignable ne mesure rien* — c'est la
// règle du 155-A, et elle vaut aussi pour le dénominateur d'un banc.
const cartesServies = [...document.querySelectorAll('#s-grille .col-carte')];
const grille = () => [...document.querySelectorAll('#s-grille .col-carte')];
const visibles = () => grille().filter((c) => !c.hasAttribute('hidden'));
const compteur = () => (document.getElementById('s-cpt') || {}).textContent || '';

verifie('la tranche forcée MORD — sinon ce banc ne prouve rien',
  cartesServies.length > TRANCHE && visibles().length === TRANCHE,
  `${cartesServies.length} carte(s) servie(s), ${visibles().length} visible(s) (tranche ${TRANCHE})`);
lus++;

// ═══════════════════════════════════════════════════════════════════════════
// 🔬 L'ORDRE DE PARSE — LA CONTRE-ÉPREUVE QUI MANQUAIT PENDANT TROIS JOURS
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ ON FABRIQUE LES DEUX ÉTATS DU DOM, ET ON EXIGE QU'ILS DIFFÈRENT.
// C'est la seule façon de prouver que le déplacement du pilote a réparé
// quelque chose : un APRÈS sans AVANT ne prouve rien.
//
//   ① DOM TRONQUÉ — la grille est là, `#s-plus` **pas encore analysé**. C'est
//      exactement ce que voyait un `<script>` en ligne écrit 3 935 octets avant
//      le bouton. Attendu : `pas = 0`, `montre = 1e9`, **AUCUNE carte cachée**.
//   ② DOM COMPLET — ce que voit un `<script defer src>`, qui attend la fin de
//      l'analyse **par construction**. Attendu : la tranche mord.
//
// ⛔ ET LE CAS ① DOIT ÊTRE ROUGE. S'il rendait la tranche lui aussi, ce banc ne
//    mesurerait plus l'ordre — il mesurerait le pilote, ce que les § d'au-dessus
//    font déjà. *Un banc qui ne peut plus produire l'écart qu'il surveille ne
//    prouve plus rien par son égalité.*
{
  // 🔴🔴🔴 MA PREMIÈRE VERSION DE CE § A PASSÉ POUR UNE MAUVAISE RAISON, ET
  // C'EST LA TREIZIÈME FOIS QUE CE PROJET SE FAIT PRENDRE PAR SON PROPRE
  // INSTRUMENT. Je fabriquais une grille nue — 12 `<a>` et un bouton. Le cas
  // ① sortait « aucune carte cachée » ✅ … parce que le pilote LEVAIT à la
  // ligne `document.getElementById('s-actifs').innerHTML`, absent de mon
  // faux DOM. Rien n'était caché parce que rien ne s'était exécuté.
  // ⭐⭐⭐ *Un cas fabriqué incomplet rend le BON résultat pour la MAUVAISE
  // raison, et c'est indiscernable d'un succès.* Le témoin ② l'a dit tout de
  // suite en refusant de mordre — sans lui, ce § serait entré au dépôt vert.
  // ⇒ ON PART DU DOM RÉEL, celui de la page servie, et on ne fabrique que LA
  //   SEULE différence qui compte : le bouton est là, ou il ne l'est pas
  //   encore. C'est précisément ce que change l'ordre de parse.
  const PAS = 5;
  const jouer = async (avecBouton) => {
    const dom = await monterDOM(html);
    if (!dom) return null;
    const { document: d, window: w } = dom;
    let plus = d.getElementById('s-plus');
    if (!plus) {
      plus = d.createElement('button'); plus.id = 's-plus';
      plus.setAttribute('type', 'button'); d.body.appendChild(plus);
      const c = d.createElement('span'); c.id = 's-plus-cpt'; d.body.appendChild(c);
    }
    plus.setAttribute('data-pas', String(PAS));
    // ⚠️ ① L'ANALYSEUR N'A PAS ENCORE VU LE BOUTON. On le retire du document
    //    plutôt que de le masquer : `getElementById` doit rendre `null`, ce
    //    qu'un `hidden` ne produirait pas. *« Est-ce là ? » n'est pas « est-ce
    //    visible ? »* — la distinction est la même que pour le CSS.
    if (!avecBouton) plus.remove();
    const fn = new Function('document', 'window', 'console', 'localStorage', scripts[0]);
    try { fn(d, w, { log() {}, warn() {}, error() {} }, undefined); }
    catch (e) { return { erreur: e.message }; }
    const cs = [...d.querySelectorAll('#s-grille .col-carte')];
    return { total: cs.length, visibles: cs.filter((c) => !c.hasAttribute('hidden')).length };
  };

  const tronque = await jouer(false);   // ① l'ancien monde : script en ligne, bouton pas encore analysé
  const complet = await jouer(true);    // ② ce que voit `<script defer src>` : analyse terminée

  if (!tronque || !complet) {
    indecis('la contre-épreuve d\'ordre', 'linkedom absent');
  } else if (tronque.erreur || complet.erreur) {
    // ⛔ LE PILOTE NE DOIT PAS LEVER, MÊME SANS LE BOUTON — en production il
    //   s'exécutait exactement dans cet état. Le vrai défaut est plus discret
    //   qu'une exception : il RÉUSSIT, et il montre tout.
    verifie('le pilote survit à un DOM sans `#s-plus`', false,
      `🔴 ${tronque.erreur || complet.erreur} — si ce § lève, ses deux verdicts ne valent rien`);
    lus++;
  } else {
    verifie('① sans `#s-plus` (l\'ancien monde) : la tranche NE MORD PAS',
      tronque.visibles === tronque.total && tronque.total > PAS,
      `${tronque.visibles}/${tronque.total} visibles — la panne du 11/08, reproduite`);
    lus++;
    verifie('② avec `#s-plus` (ce que voit `defer`) : la tranche MORD',
      complet.visibles === PAS,
      `${complet.visibles}/${complet.total} visibles (pas ${PAS})`);
    lus++;
    // ⭐ LE TÉMOIN QUI TRANCHE : si les deux états rendaient la même chose, le
    //   déplacement du pilote n'aurait rien réparé — et ce banc le dirait, au
    //   lieu d'être vert des deux côtés.
    verifie('⇒ les deux états DIFFÈRENT — le déplacement répare quelque chose',
      tronque.visibles !== complet.visibles,
      `sans bouton ${tronque.visibles} ≠ avec bouton ${complet.visibles}, sur ${complet.total}`);
    lus++;
  }
}

// La licence la plus portée : c'est celle qui donnera l'écart le plus net.
const compte = {};
for (const v of porteesRayon) if (v) compte[v] = (compte[v] || 0) + 1;
const [licence, attendus] = Object.entries(compte).sort((a, b) => b[1] - a[1])[0];

// 🆕 LOT 143 — LA CASE N'EXISTE QU'APRÈS OUVERTURE DU PANNEAU. Le pilote
// construit les puces au premier clic ; les chercher sans avoir cliqué revient
// à mesurer un état que l'utilisateur ne rencontre jamais. ⛔ Et on ne remplace
// pas ce contrôle par un `if (coche)` complaisant : sans case, la suite du § ne
// mesure plus rien, donc l'absence reste un ÉCHEC — c'est le clic qui manquait,
// pas l'exigence.
// 🔴 LOT 155-B — ON COMPLÈTE LA GRILLE AVANT DE JUGER LE FILTRE, et on rend la
// main entre chaque geste : depuis ce lot, ouvrir un panneau passe par une
// promesse (le chargement de l'index). Compter tout de suite mesurerait la
// promesse, pas le panneau.
const btPlus0 = document.getElementById('s-plus');
if (btPlus0) btPlus0.dispatchEvent(new window.Event('click', { bubbles: true }));
await new Promise((r2) => setImmediate(r2));
const btLic = document.querySelector('.f-b[data-g="licence"]');
if (btLic) btLic.dispatchEvent(new window.Event('click', { bubbles: true }));
await new Promise((r2) => setImmediate(r2));
const coche = document.querySelector(`input[name="s-lic"][value="${licence}"]`);
verifie(`la case de la licence « ${licence} » existe dans le DOM`, !!coche,
  coche ? 'panneau ouvert, puce construite' : '🔴 panneau ouvert et toujours aucune puce');
if (!coche) fin();
// 🔴 LOT 155-B — ON REND LA MAIN APRÈS CHAQUE GESTE. Les écouteurs du pilote
// passent désormais par `completer()` : ils s'exécutent une micro-tâche après
// l'événement, même quand l'index est déjà chargé. ⛔ Lire le compteur tout de
// suite mesurerait l'état d'AVANT le geste — et le banc rougissait « le
// compteur n'a pas bougé : ce filtre décore », en accusant le site d'un défaut
// qui était dans l'instrument. *Un rouge ne prouve que ce qu'il a regardé.*
const tick = () => new Promise((r2) => setImmediate(r2));
// ⭐ L'AVANT SE MESURE, IL NE SE SUPPOSE PAS — voir le commentaire de `cocher()`.
const [avant] = (compteur().match(/\d+/g) || ['0']).map(Number);
cocher(coche, window, document.getElementById('f-sets'));
await tick();

// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ LA MESURE QUI DÉCIDE DE TOUT
// ═══════════════════════════════════════════════════════════════════════════
// Le compteur dit « retenus / total ». Si le filtre ne regardait que les cartes
// AFFICHÉES, il ne pourrait pas retenir plus que la tranche. Qu'il annonce plus
// que `TRANCHE` prouve qu'il a traversé le DOM entier.
const [retenus] = (compteur().match(/\d+/g) || ['0']).map(Number);
verifie('⭐ le filtre traverse TOUT le DOM, pas la tranche affichée',
  retenus === attendus && attendus > TRANCHE,
  retenus === attendus
    ? `${retenus} set(s) retenus sur ${grille().length}, alors que ${TRANCHE} seulement sont à l'écran`
    : `🔴 ${retenus} retenu(s) au lieu de ${attendus} — le filtre n'a vu qu'une partie du DOM.\n`
      + '       ⇒ c\'est « filtres OU pagination » : la grille RÉPOND, et sa réponse est fausse.');
verifie('…et la tranche continue de s\'appliquer APRÈS le filtre',
  visibles().length === Math.min(TRANCHE, attendus),
  `${visibles().length} visible(s) sur ${retenus} retenu(s)`);
verifie('…et toutes les cartes visibles portent bien cette licence',
  visibles().length > 0 && visibles().every((c) => c.getAttribute('data-lic') === licence),
  visibles().length
    ? `${visibles().length} carte(s) à l'écran, toutes en « ${licence} »`
    : '🔴 AUCUNE carte visible — `.every()` sur un tableau vide est VRAI, ce contrôle ne mesurerait rien');
lus += 3;

// ⛔ LA CONTRE-ÉPREUVE. Sans elle, un pilote qui ne filtrerait JAMAIS rien
//    passerait la ligne du dessus dès que la licence majoritaire couvre tout.
cocher(coche, window, document.getElementById('f-sets'), false);
await tick();
const [retenusApres] = (compteur().match(/\d+/g) || ['0']).map(Number);
// ⛔ ON COMPARE TROIS NOMBRES MESURÉS — avant, pendant, après — et surtout PAS
//    au nombre attendu calculé depuis le HTML. C'est la faute qui a rendu ma
//    première version verte alors que RIEN n'était jamais coché.
verifie('⛔ cocher puis décocher fait bouger le compteur DANS LES DEUX SENS',
  avant === grille().length && retenus < avant && retenusApres === avant,
  `avant ${avant} → coché ${retenus} → décoché ${retenusApres} (sur ${grille().length})`
  + (retenus === avant ? '\n       🔴 le compteur n\'a pas bougé au cochage : ce filtre décore' : ''));
lus++;

// ═══════════════════════════════════════════════════════════════════════════
// 4. LE TRI PAR LICENCE — il trie, et il est STABLE
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n4. le tri par licence range-t-il vraiment, et de façon stable ?');
const tri = document.getElementById('s-tri');
if (!tri) { indecis('le tri', 'sélecteur `s-tri` absent'); fin(); }
// ⭐ `choisir()` pose la valeur ET prévient la page. Poser `.value` seul ne
//   déclencherait rien : le pilote écoute `change` sur le formulaire.
choisir(tri, 'licence', window, document.getElementById('f-sets'));
await tick();

const ordre = [...document.querySelectorAll('#s-grille .col-carte')]
  .map((c) => c.getAttribute('data-lic') || '');
const trie = [...ordre].sort((a, b) => a.localeCompare(b));
verifie('les licences sortent dans l\'ordre alphabétique',
  ordre.join('|') === trie.join('|'),
  ordre.length > 8 ? `${ordre.slice(0, 8).join(' · ')} …` : ordre.join(' · '));
// ⭐ LA STABILITÉ : à licence égale, la taille décroissante. Sans second
//   critère, la page changerait d'aspect selon le tri précédent — un tri
//   instable se lit comme un bug, et personne ne sait le décrire.
const noeuds = [...document.querySelectorAll('#s-grille .col-carte')];
let stable = true;
for (let i = 1; i < noeuds.length; i++) {
  if (noeuds[i - 1].getAttribute('data-lic') !== noeuds[i].getAttribute('data-lic')) continue;
  if (Number(noeuds[i - 1].getAttribute('data-taille')) < Number(noeuds[i].getAttribute('data-taille'))) stable = false;
}
verifie('à licence égale, les sets restent triés par taille décroissante',
  stable, stable ? 'le tri a un second critère, il ne dépend pas de l\'ordre d\'avant' : '🔴 tri instable');
lus += 2;

// ═══════════════════════════════════════════════════════════════════════════
// 5. 🆕 LOT 170 — POINT `e` : LA RECHERCHE DANS LE FILTRE LICENCE
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐ CE QUE CE § SURVEILLE VRAIMENT, ET CE N'EST PAS « le champ est là ».
// Le champ cherche `data-b` sur les puces. Les puces licence ne sont PAS
// servies : `remplirPuces()` les construit à la première ouverture du panneau.
// Le jour où ce constructeur change d'attribut, ou n'en pose plus que sur
// l'axe « marque », le champ licence existera toujours, s'ouvrira toujours,
// et ne trouvera PLUS JAMAIS RIEN — en répondant. C'est le profil de panne le
// plus cher du projet : le contrôle ne casse pas, il ment.
// ⇒ ON VÉRIFIE LA CHAÎNE ENTIÈRE : le champ servi, ses deux gardes, l'hôte
//   qu'il interroge, et l'attribut que le constructeur pose sur CET axe-là.
console.log('\n5. le filtre licence a-t-il une recherche, et cherche-t-elle où il faut ?');
{
  const conteneurLic = /id="s-lics"[^>]*data-puces="lic"/.test(sansScripts);
  if (!conteneurLic) {
    // ⛔ TROIS VERDICTS, ET CELUI-CI EST LE TROISIÈME. Sous deux licences le
    //    panneau ne s'émet pas — le banc n'a rien mesuré, il le DIT.
    indecis('la recherche du filtre licence',
      `panneau licence non émis (${licPortees} licence(s) portée(s) par les cartes) — rien n'a été mesuré`);
  } else {
    const champ = sansScripts.match(/<input[^>]*id="s-lq"[^>]*>/);
    verifie('le champ de recherche `#s-lq` est SERVI dans la page',
      Boolean(champ), champ ? champ[0].slice(0, 90) : '🔴 point `e` non livré');
    if (champ) {
      // ⛔ LES DEUX GARDES DU LOT 115b, reprises telles quelles : sans `name`
      //    le champ ne part pas avec le formulaire, et le bouton `reset` du
      //    groupe ne le vide pas. Un `name` ici enverrait une recherche
      //    d'affichage au filtre de la grille.
      verifie('…sans `name` : il ne part pas avec le formulaire',
        !/\sname=/.test(champ[0]), champ[0].slice(0, 90));
      verifie('…sans `form` : le `reset` des cases ne l\'efface pas',
        !/\sform=/.test(champ[0]), champ[0].slice(0, 90));
      verifie('…en `type="search"` : la croix d\'effacement est celle du navigateur',
        /type="search"/.test(champ[0]), champ[0].slice(0, 90));
      lus += 4;
    }
    // ⭐ IL DOIT ÊTRE DANS LE PANNEAU LICENCE, pas ailleurs dans la page. Un
    //   champ correct posé dans le mauvais panneau se lit comme un succès.
    const panneau = sansScripts.match(/<div class="f-panneau" id="sp-licence"[\s\S]*?<\/div>\s*<\/div>/);
    verifie('…et il est DANS `#sp-licence`, pas ailleurs dans la page',
      Boolean(panneau) && /id="s-lq"/.test(panneau[0]),
      panneau ? 'trouvé dans le panneau licence' : '🔴 panneau `#sp-licence` introuvable');
    verifie('le message « aucune licence » `#s-lq-vide` est servi',
      /id="s-lq-vide"/.test(sansScripts),
      'sans lui, une recherche sans résultat rend une liste vide sans explication');
    lus += 2;

    // 🔴🔴 LE MAILLON QUI CASSE EN SILENCE — voir l'en-tête de ce §.
    const pilote = readFileSync(join(R, 'src', 'socle', 'modules', 'series.js'), 'utf8');
    verifie('le pilote branche la recherche sur l\'hôte des puces LICENCE',
      /chercheDansPuces\(\s*'s-lq'\s*,\s*'s-lics'\s*,\s*'s-lq-vide'\s*\)/.test(pilote),
      '🔴 le champ serait servi et ne piloterait rien');
    verifie('…et la recherche du filtre MARQUE est toujours branchée',
      /chercheDansPuces\(\s*'s-bq'\s*,\s*'s-brands'\s*,\s*'s-bq-vide'\s*\)/.test(pilote),
      '⛔ le lot 170 partage le pilote du lot 115b : il ne doit pas l\'emporter');
    // ⭐⭐⭐ L'ATTRIBUT, SUR CET AXE-LÀ. `remplirPuces()` pose `data-b` avant
    //   de brancher l'axe : si un lot futur le pose sous condition
    //   `axe === 'brand'`, le champ licence devient muet. La ligne est
    //   inconditionnelle, et ce banc est ce qui l'y maintient.
    const poseDataB = pilote.match(/l\.setAttribute\('data-b',[^\n]*\n/);
    const avantAxe = poseDataB
      ? !/if\s*\(\s*axe\s*===\s*'brand'\s*\)[\s\S]{0,200}setAttribute\('data-b'/.test(pilote)
      : false;
    verifie('`remplirPuces()` pose `data-b` sur les DEUX axes, sans condition',
      Boolean(poseDataB) && avantAxe && /l\.setAttribute\('data-b', v\.toLowerCase\(\)\)/.test(pilote),
      poseDataB ? poseDataB[0].trim() : '🔴 `data-b` introuvable — le champ chercherait un attribut absent');
    lus += 3;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. 🆕 LOT 170 — POINT `b` : LA SÉRIE NUE, ET SEULEMENT CHEZ LES COMICS
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐ LES CAS SONT MESURÉS, PAS INVENTÉS : ils viennent du dictionnaire de
//   séries de `/rayon-index/comics.json` et `/rayon-index/collectibles.json`
//   servis en PRODUCTION le 21/08. Un jeu de cas inventé aurait raté les deux
//   qui comptent — le dièse SANS numéro (« DuckTales # (2024) ») et le dièse
//   au MILIEU (« Spidey And His Amazing Friends #1 Halloween… »).
console.log('\n6. la série des comics entre-t-elle NUE, sans emporter les collectibles ?');
{
  const { serieNue } = await import('../lib/dataset.mjs');
  const CAS = [
    ['Avengers Vs X-Men Vol. 1 #8 (2012)', 'Avengers Vs X-Men Vol. 1', 'le cas de Preda : le numéro tombe'],
    ['Daredevil Vol. 1 #176', 'Daredevil Vol. 1', 'sans millésime, il tombe aussi'],
    ['DuckTales # (2024)', 'DuckTales', 'dièse SANS numéro — mesuré au catalogue'],
    ['Gargoyles Vol. 1 # (2025)', 'Gargoyles Vol. 1', 'idem, second cas mesuré'],
    ['Alias', 'Alias', 'une série déjà nue ne bouge pas'],
    ['Spidey And His Amazing Friends #1 Halloween Trick-Or-Read 2025',
      'Spidey And His Amazing Friends #1 Halloween Trick-Or-Read 2025',
      '⛔ dièse au MILIEU : la coupe est ancrée en FIN'],
    ['#1', '#1', '⛔ filet : la coupe ne rend jamais une série sans nom'],
    ['', '', 'une série vide reste vide'],
  ];
  let ecart = null;
  for (const [entree, attendu, pourquoi] of CAS) {
    const rendu = serieNue(entree);
    if (rendu !== attendu && !ecart) ecart = `« ${entree} » → « ${rendu} » (attendu « ${attendu} », ${pourquoi})`;
  }
  verifie(`la série nue se dérive sur les ${CAS.length} cas mesurés au catalogue`,
    !ecart, ecart ? `🔴 ${ecart}` : CAS.map(([e]) => e.slice(0, 22)).join(' · '));
  lus += CAS.length;

  // 🔴🔴🔴 LE CONTRÔLE QUI COMPTE VRAIMENT, ET IL EST DANS L'AUTRE SENS.
  // Sur les collectibles, « Adam Kubert - Wolverine #107 » et « DJ Big Bot -
  // Record #1 » sont des noms de série LÉGITIMES : mesuré le 21/08, ZÉRO des
  // 94 séries de collectibles de cette forme ne fusionne avec une série nue
  // existante, contre 44 sur 104 chez les comics. Élargir le nettoyage aux
  // collectibles détruirait 94 séries pour n'en réparer aucune — et le build
  // resterait vert. ⇒ La garde `estComic()` est ce que ce contrôle tient.
  const src2 = readFileSync(join(R, 'engine', 'lib', 'dataset.mjs'), 'utf8');
  const ligne = src2.match(/^\s*series:\s*estComic\(c\.kind\)[^\n]*$/m);
  verifie('⛔ `rayonDe()` ne l\'applique QU\'aux comics',
    Boolean(ligne) && /serieNue\(c\.series\)/.test(ligne[0]) && /:\s*\(c\.series \|\| ''\)/.test(ligne[0]),
    ligne ? ligne[0].trim() : '🔴 la garde `estComic` a disparu — les collectibles y passeraient aussi');
  // ⭐ ET PAS SUR LES FICHES. `items` nourrit `sansPrefixeSerie()`, donc les
  //   ADRESSES des pages. Y appliquer la même coupe renommerait des URL en
  //   production pour réparer 0,91 % des lignes de rayon.
  const posesItems = [...src2.matchAll(/^\s*series:\s*serieNue\(/gm)].length;
  verifie('⛔ …et jamais sur `items`, qui fabrique les adresses des fiches',
    posesItems === 0,
    posesItems === 0 ? '`items.series` reste brut : aucune URL ne bouge'
      : `🔴 ${posesItems} pose(s) sur \`items\` — des adresses changeraient en production`);
  lus += 2;
}

fin();
