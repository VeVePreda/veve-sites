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
  console.log('\n5. auto-contrôle');
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
const proposees = [...sansScripts.matchAll(/name="s-lic" value="([^"]*)"/g)].map((m) => m[1]);
const portees = [...sansScripts.matchAll(/data-lic="([^"]*)"/g)].map((m) => m[1]);
lus += proposees.length + portees.length;

if (proposees.length === 0) {
  // ⭐ Le gabarit n'émet le panneau qu'à partir de DEUX licences : sur un
  //   catalogue mono-licence, son absence est CORRECTE. On ne peut pas juger.
  indecis('le filtre licence', 'moins de deux licences dans ce build — le panneau ne s\'émet pas, et c\'est voulu');
  fin();
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
const setPort = new Set(portees.filter(Boolean));
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
  const fn = new Function('document', 'window', 'console', 'localStorage', scripts[0]);
  try { fn(document, window, { log() {}, warn() {}, error() {} }, undefined); } catch (e) {
    return { erreur: e.message, document, window };
  }
  return { document, window };
};

const r = await monter();
if (r.absent) { indecis('l\'exécution du pilote', 'linkedom absent — `npm i -D linkedom`'); fin(); }
verifie('le pilote s\'exécute sans lever', !r.erreur, r.erreur || 'aucune exception');
if (r.erreur) fin();
const { document, window } = r;

const cartes = [...document.querySelectorAll('#s-grille .col-carte')];
const visibles = () => cartes.filter((c) => !c.hasAttribute('hidden'));
const compteur = () => (document.getElementById('s-cpt') || {}).textContent || '';

verifie('la tranche forcée MORD — sinon ce banc ne prouve rien',
  cartes.length > TRANCHE && visibles().length === TRANCHE,
  `${cartes.length} carte(s) dans le DOM, ${visibles().length} visible(s) (tranche ${TRANCHE})`);
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
for (const v of portees) if (v) compte[v] = (compte[v] || 0) + 1;
const [licence, attendus] = Object.entries(compte).sort((a, b) => b[1] - a[1])[0];

const coche = document.querySelector(`input[name="s-lic"][value="${licence}"]`);
verifie(`la case de la licence « ${licence} » existe dans le DOM`, !!coche);
if (!coche) fin();
// ⭐ L'AVANT SE MESURE, IL NE SE SUPPOSE PAS — voir le commentaire de `cocher()`.
const [avant] = (compteur().match(/\d+/g) || ['0']).map(Number);
cocher(coche, window, document.getElementById('f-sets'));

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
    ? `${retenus} set(s) retenus sur ${cartes.length}, alors que ${TRANCHE} seulement sont à l'écran`
    : `🔴 ${retenus} retenu(s) au lieu de ${attendus} — le filtre n'a vu qu'une partie du DOM.\n`
      + '       ⇒ c\'est « filtres OU pagination » : la grille RÉPOND, et sa réponse est fausse.');
verifie('…et la tranche continue de s\'appliquer APRÈS le filtre',
  visibles().length === Math.min(TRANCHE, attendus),
  `${visibles().length} visible(s) sur ${retenus} retenu(s)`);
verifie('…et toutes les cartes visibles portent bien cette licence',
  visibles().every((c) => c.getAttribute('data-lic') === licence),
  '⛔ sinon le filtre affiche autre chose que ce qu\'il compte');
lus += 3;

// ⛔ LA CONTRE-ÉPREUVE. Sans elle, un pilote qui ne filtrerait JAMAIS rien
//    passerait la ligne du dessus dès que la licence majoritaire couvre tout.
cocher(coche, window, document.getElementById('f-sets'), false);
const [retenusApres] = (compteur().match(/\d+/g) || ['0']).map(Number);
// ⛔ ON COMPARE TROIS NOMBRES MESURÉS — avant, pendant, après — et surtout PAS
//    au nombre attendu calculé depuis le HTML. C'est la faute qui a rendu ma
//    première version verte alors que RIEN n'était jamais coché.
verifie('⛔ cocher puis décocher fait bouger le compteur DANS LES DEUX SENS',
  avant === cartes.length && retenus < avant && retenusApres === avant,
  `avant ${avant} → coché ${retenus} → décoché ${retenusApres} (sur ${cartes.length})`
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

fin();
