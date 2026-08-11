// ⚠️ DEPOT : VeVePreda/veve-sites  ·  CHEMIN : engine/tools/test_entrepot.mjs
//
// Banc du REPLI N-1 de l'entrepot (A3, 29/07/2026).
//
// ==========================================================================
// ⭐⭐ CE QUE CE BANC EXISTE POUR ATTRAPER
// ==========================================================================
// `warehouse.mjs` lit `[source fraiche, release N-1]`. Quand la fraiche
// tombait, la N-1 prenait le relais avec un simple `console.warn` : build
// VERT, site construit sur les donnees de la veille, et personne pour le
// dire. Au moment du gel des adresses, ce repli a failli graver A VIE
// l'identite d'AVANT l'uniformisation.
//
// ⭐ Le vrai piege du correctif, et c'est lui qu'on teste ici : dans les deux
//    boucles, le succes vivait DANS un `try/catch`. Un refus pose au mauvais
//    endroit se serait fait avaler par le `catch`, relire comme « la N-1 a
//    echoue elle aussi » -- et le garde-fou serait devenu un repli de plus,
//    muet comme celui qu'il remplace. Le cas 5 verifie exactement ca.
//
// ⛔ AUCUN ACCES RESEAU : `fetch` est remplace. Un banc qui depend de GitHub
//    ne prouve rien le jour ou GitHub est en panne — c'est-a-dire le seul
//    jour ou ce code sert.
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const FRAIS = 'https://exemple.invalide/frais/catalogue.csv.gz';
const FRAIS_PRIX = 'https://exemple.invalide/frais/prices.csv.gz';

const CSV_CATALOGUE = 'veve_uuid,name,series,brand\nu1,Item Un,Serie A,Marque\nu2,Item Deux,Serie B,Marque\n';
const CSV_PRIX = 'veve_uuid,ts_utc,floor,listings\nu1,2026-07-29T00:00:00Z,12.5,3\nu2,2026-07-29T00:00:00Z,40,1\n';

let echecs = 0;
let cas = 0;
const vu = [];

function ok(condition, libelle) {
  cas++;
  if (condition) { console.log(`  ✅ ${libelle}`); return; }
  echecs++;
  console.log(`  ❌ ${libelle}`);
}

// --- Le faux reseau --------------------------------------------------------
// `new Response(buf)` donne A LA FOIS `.arrayBuffer()` (chemin `load`) et
// `.body` en flux web (chemin `streamPrices`) : un seul stub couvre les deux.
function poserReseau({ fraicheOK }) {
  globalThis.fetch = async (url) => {
    const estFraiche = url === FRAIS || url === FRAIS_PRIX;
    if (estFraiche && !fraicheOK) return new Response('', { status: 503 });
    const gz = url.includes('prices') ? gzipSync(CSV_PRIX) : gzipSync(CSV_CATALOGUE);
    return new Response(gz, { status: 200 });
  };
}

// Chaque scenario a besoin d'un module NEUF : `WAREHOUSE_REFUSE_PREV` et les
// URL des sources sont lues au chargement, et `load()` garde un cache.
let compteur = 0;
async function chargerEntrepot(env) {
  for (const [k, v] of Object.entries(env)) {
    if (v === null) delete process.env[k]; else process.env[k] = v;
  }
  process.env.PROJECT_ROOT = RACINE;
  return import(`../data/warehouse.mjs?cas=${++compteur}`);
}

function capturerWarn() {
  const vrai = console.warn;
  const lignes = [];
  console.warn = (...a) => { lignes.push(a.join(' ')); };
  return { lignes, rendre: () => { console.warn = vrai; } };
}

const ENV_BASE = {
  CATALOGUE_URL: FRAIS,
  PRICES_URL: FRAIS_PRIX,
  WAREHOUSE_OFFLINE: null,
  ALLOW_SAMPLE: null,
  WAREHOUSE_REFUSE_PREV: null,
};

console.log('\n=== Banc de l\'entrepot : le repli N-1 ===\n');

// --------------------------------------------------------------------------
// 1. Source fraiche joignable : rien ne doit crier.
// --------------------------------------------------------------------------
console.log('1. Source fraiche joignable');
{
  poserReseau({ fraicheOK: true });
  const w = await chargerEntrepot(ENV_BASE);
  const c = capturerWarn();
  const rows = await w.load('catalogue');
  c.rendre();
  ok(rows.length === 2, 'le catalogue frais est lu (2 lignes)');
  ok(w.getReplis().length === 0, 'aucun repli enregistre');
  ok(!c.lignes.some((l) => l.includes(w.MARQUEUR_REPLI)), 'aucun marqueur de repli imprime');
  vu.push(...c.lignes);
}

// --------------------------------------------------------------------------
// 2. Fraiche morte, N-1 vivante : ca marche ET ca crie. C'etait le defaut.
// --------------------------------------------------------------------------
console.log('\n2. Repli sur la release N-1 (catalogue)');
{
  poserReseau({ fraicheOK: false });
  const w = await chargerEntrepot(ENV_BASE);
  const c = capturerWarn();
  const rows = await w.load('catalogue');
  c.rendre();
  ok(rows.length === 2, 'le build continue : la N-1 a bien servi');
  ok(w.getReplis().length === 1 && w.getReplis()[0].source === 'catalogue',
    'le repli est ENREGISTRE et interrogeable par l\'appelant');
  ok(c.lignes.some((l) => l.includes(w.MARQUEUR_REPLI)),
    'le marqueur litteral est imprime');
  ok(c.lignes.some((l) => l.startsWith('::warning')),
    'une annotation GitHub Actions sort (visible hors du log)');
}

// --------------------------------------------------------------------------
// 3. Le meme repli, avec le refus arme : il doit ETRE FATAL.
//    C'est ce que `freeze-slugs` demande, parce que le gel est irreversible.
// --------------------------------------------------------------------------
console.log('\n3. WAREHOUSE_REFUSE_PREV=1 : le repli devient fatal');
{
  poserReseau({ fraicheOK: false });
  const w = await chargerEntrepot({ ...ENV_BASE, WAREHOUSE_REFUSE_PREV: '1' });
  const c = capturerWarn();
  let jete = null;
  let rendu = null;
  try { rendu = await w.load('catalogue'); } catch (e) { jete = e; }
  c.rendre();
  ok(jete !== null, 'une erreur est levee');
  ok(jete && jete.message.includes(w.MARQUEUR_REPLI),
    'le message porte le marqueur (il est greppable dans le run)');
  // ⭐⭐ LE CAS 5 EN GERME : si le `throw` avait ete pose dans le `try`, on
  // serait ici avec `rendu` non nul — des lignes rendues malgre le refus.
  ok(rendu === null, 'AUCUNE ligne n\'est rendue : le refus n\'est pas un repli de plus');
}

// --------------------------------------------------------------------------
// 4. Le chemin des PRIX — celui qu'on avait failli oublier.
//    Meme boucle, meme defaut, autre fonction.
// --------------------------------------------------------------------------
console.log('\n4. Repli sur la release N-1 (prix, lecture en flux)');
{
  poserReseau({ fraicheOK: false });
  const w = await chargerEntrepot(ENV_BASE);
  const c = capturerWarn();
  let lignes = 0;
  const n = await w.streamPrices(() => { lignes++; });
  c.rendre();
  ok(n === 2 && lignes === 2, 'les prix N-1 sont lus en flux (2 lignes)');
  ok(w.getReplis().some((r) => r.source === 'prices'),
    'le repli des PRIX est enregistre lui aussi');
  ok(c.lignes.some((l) => l.includes(w.MARQUEUR_REPLI)), 'le marqueur sort aussi sur les prix');
}

// --------------------------------------------------------------------------
// 5. ⭐⭐ LE PIEGE. Refus arme sur les prix : le `return` vivait DANS le
//    `try`. Un refus mal place aurait ete avale, puis la fonction serait
//    tombee sur l'echantillon local — run vert, prix d'exemple en ligne.
// --------------------------------------------------------------------------
console.log('\n5. Le refus n\'est pas avale par le catch (prix)');
{
  poserReseau({ fraicheOK: false });
  const w = await chargerEntrepot({ ...ENV_BASE, WAREHOUSE_REFUSE_PREV: '1', ALLOW_SAMPLE: '1' });
  const c = capturerWarn();
  let jete = null;
  let lignes = 0;
  try { await w.streamPrices(() => { lignes++; }); } catch (e) { jete = e; }
  c.rendre();
  ok(jete !== null, 'le refus remonte jusqu\'a l\'appelant');
  ok(!c.lignes.concat(vu).some((l) => l.includes('ECHANTILLON')),
    'on n\'est PAS retombe sur l\'echantillon local malgre ALLOW_SAMPLE=1');
}

// --------------------------------------------------------------------------
// 🔴🔴🔴 6. L'ECHANTILLON HORS LIGNE PORTE-T-IL ENCORE LES CARACTERES DIFFICILES ?
// --------------------------------------------------------------------------
// ⭐⭐⭐ CE § EST LA REPONSE A L'INCIDENT DU 11/08/2026, ET IL NE PARLE PAS
//   D'ENCODAGE : il parle de ce que l'instrument PEUT VOIR.
//
// Le deploiement du lot 139 a ete arrete par 714 noms declares « trop longs »
// alors qu'ils etaient conformes. Le run CI etait VERT cinq minutes plus tot.
// Ce n'etait pas une contradiction :
//
//     CI (`tests.yml`, WAREHOUSE_OFFLINE=1) ... 147 pages
//     bac a sable (WAREHOUSE_OFFLINE=1) ....... 147 pages  ← LE MEME INSTRUMENT
//     Dockerfile de production ................ 3 098 pages
//
// ⇒ La CI et le bac a sable sont LE MEME INSTRUMENT AVEC LE MEME ANGLE MORT, et
//   l'echantillon ne contenait pas UNE SEULE apostrophe, pas UN SEUL `&`.
//   « Quatre conditions vertes » ne prouvait rien : les quatre etaient quatre
//   variantes du meme echantillon. Quatre mesures d'un instrument aveugle au
//   meme endroit ne font pas quatre mesures.
//
// ⭐⭐ ET C'EST POURQUOI CE § VIT ICI PLUTOT QUE DANS UN BANC D'AFFICHAGE.
//   `test:affichage` verifie ce que les pages RENDENT ; personne ne verifiait ce
//   que l'echantillon CONTIENT. Or un echantillon regenere par `gen-sample.mjs`,
//   ou reduit « pour aller plus vite », perdrait ces caracteres SANS RIEN
//   CASSER — et la prochaine faute d'encodage se redecouvrirait en arretant un
//   deploiement. Un contenu que personne ne RECLAME finit par disparaitre.
//
// ⛔ NE PAS « REPARER » UN ROUGE D'ICI EN RETIRANT UNE CLASSE DE CETTE LISTE.
//   Le rouge dit que l'echantillon a maigri, pas que la liste est trop exigeante.
//
// ⚠️ `nonLatin` EST ABSENT DE LA LISTE, ET C'EST UNE MESURE, PAS UN OUBLI :
//   le catalogue reel (3 782 noms, releve du 11/08/2026) n'en contient
//   ZERO. Exiger ici une classe qui n'existe nulle part en production ferait
//   fabriquer une condition au lieu de la reproduire. Le jour ou VeVe publiera
//   une marque en kana ou en hangul, cette ligne sera a ajouter — dans le meme
//   geste que la ligne d'echantillon qui la porte.
console.log('\n6. L\'echantillon hors ligne porte les caracteres difficiles');
{
  const csv = readFileSync(join(RACINE, 'engine', 'data', 'sample', 'catalogue.csv'), 'utf8');
  // On ne juge que les colonnes de LIBELLE : c'est la seule matiere ou un
  // caractere difficile change une longueur affichee.
  const lignes = csv.split('\n').filter(Boolean);
  const entete = lignes[0].split(',').map((c) => c.trim());
  const colonnes = ['name', 'series'].map((c) => entete.indexOf(c)).filter((i) => i >= 0);
  const libelles = lignes.slice(1)
    .flatMap((l) => colonnes.map((i) => (l.split(',')[i] || '')))
    .join('');

  // 🔴 Chaque classe est nommee par CE QU'ELLE CASSE, pas par son nom Unicode :
  //    un mainteneur qui lit un rouge doit savoir ce qu'il perd en le taisant.
  const CLASSES = [
    ["apostrophe droite (-> &#39; : 5 octets, 1 signe)", /'/],
    ['esperluette (-> &amp; : 5 octets, 1 signe)', /&/],
    ['guillemet double (-> &quot;)', /"/],
    ['apostrophe typographique U+2019', /’/],
    ['tiret long U+2013 / U+2014', /[–—]/],
    ['ellipse U+2026', /…/],
    ['accent latin (Altair, ROSE, Valfre)', /[À-ɏ]/],
    ['LARGEUR ZERO U+200B / U+200D (invisible, compte)', /[​‌‍⁠﻿]/],
  ];
  for (const [nom, re] of CLASSES) {
    ok(re.test(libelles),
      `l'echantillon porte au moins un libelle avec : ${nom}`);
  }

  // ⭐⭐ ET LE TEMOIN INVERSE — sans lui, un § qui ne teste plus RIEN serait vert.
  //   Le couple distingue « l'echantillon a maigri » de « le controle est mort ».
  //   Meme dispositif que les cas ⑦/⑧ de `test:affichage`.
  const CLASSE_ABSENTE = /[぀-ヿ一-鿿가-힯]/; // kana, han, hangul
  ok(!CLASSE_ABSENTE.test(libelles),
    'LE TEMOIN INVERSE — aucun non-latin : le controle sait encore repondre NON');

  // 🔬 Contre-epreuve EXECUTEE, pas promise : sur un echantillon vide de tout
  //    caractere difficile (l'etat d'avant le 11/08), les 8 classes doivent
  //    echouer. Un § qui ne peut etre satisfait que d'une seule facon ne
  //    distingue pas la conformite de la panne.
  const NU = 'Spider-ManModern Marvel S1Batman Gold';
  const rougissent = CLASSES.filter(([, re]) => !re.test(NU)).length;
  ok(rougissent === CLASSES.length,
    `sur l'echantillon d'AVANT (sans caractere difficile), les ${CLASSES.length} classes rougissent bien`);
}

// --------------------------------------------------------------------------
console.log(`\n${echecs === 0 ? '✅' : '❌'} entrepot : ${cas - echecs}/${cas} controles passes.\n`);
process.exit(echecs === 0 ? 0 : 1);
