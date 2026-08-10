// ⚠️ VeVePreda/veve-sites — engine/tools/test_promesses.mjs   (NEUF — lot 104)
// ═══════════════════════════════════════════════════════════════════════════
// LA VENTE NE S'OUVRE PAS SUR UN MODULE QUI N'EXISTE PAS
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 CE BANC EXISTE PARCE QU'UN ARBITRAGE A ETE PRIS CONTRE UN AVERTISSEMENT,
// ET C'EST TRES BIEN AINSI. Preda, 07/08/2026, a choisi d'annoncer TOUS les
// modules sur /offre/, y compris les sept qui n'existent pas, avec une pastille
// « pas encore construit ». Son propre brief dit pourtant : « un palier qui
// promet un module absent est une promesse rompue PAYANTE ».
//
// LES DEUX ENONCES NE SE CONTREDISENT PAS AUJOURD'HUI, ET C'EST LA TOUT LE
// SUJET : `offer.url` est VIDE. Rien n'est encaissable — pas de prestataire de
// paiement, decision reportee. Une feuille de route affichee n'est pas une
// promesse rompue tant que personne ne peut payer pour elle.
//
// ⭐⭐⭐ MAIS LA CONDITION QUI REND L'ARBITRAGE SUR N'EST PAS PERMANENTE.
// Le jour ou un prestataire est branche, quelqu'un remplira `offer.url` — une
// ligne, dans un autre lot, probablement dans plusieurs semaines. La MEME page
// deviendra alors exactement ce que le brief interdit, sans qu'un seul
// caractere ait change dans le catalogue des modules. Personne ne fera le lien.
//
// ⭐⭐⭐ ET UN COMMENTAIRE N'Y SURVIT PAS. Ce depot l'a mesure quatre fois :
// « un avertissement qui survit a sa cause devient un mensonge qui se cite, et
// s'il ne se MESURE pas il finit lu sans etre suivi ». La seule forme d'alerte
// qui traverse les semaines est celle qui casse un build.
//
// ⛔⛔ CE BANC NE JUGE PAS LA DECISION DE PREDA. Il ne dit pas « n'annonce pas
// les modules absents » — c'est arbitre, et l'affichage reste. Il dit une seule
// chose, et seulement au moment ou elle devient vraie : ⭐ ON N'OUVRE PAS LA
// VENTE TANT QU'UN PALIER PAYANT PROMET UN MODULE QUI N'EXISTE PAS.
//
// TROIS SORTIES, TOUTES HONNETES, AUCUNE SILENCIEUSE :
//   1. livrer le module et passer `bientot: false` ;
//   2. le descendre au palier `member` (gratuit) — annonce sans etre vendu ;
//   3. le retirer de `offer.modules`.
//
// ⭐ IL SORT SUR UNE DECLARATION — le manifeste — JAMAIS SUR L'ETAT D'UN
// DOSSIER. « zero parce que c'est casse » et « zero parce qu'il n'y a rien
// ici » se ressemblent sur le disque et sont deux verdicts opposes : ce banc
// refuse de mesurer si le manifeste ne declare pas de catalogue, ET IL LE DIT.

import { existsSync } from 'node:fs';
import { join } from 'node:path';

process.env.SITE = process.env.SITE || 'veveprice';
const R = new URL('../..', import.meta.url).pathname;

let ko = 0;
const dit = (bon, quoi, detail) => {
  if (!bon) ko++;
  console.log(`  ${bon ? 'ok ' : 'KO '} ${quoi}${detail ? ` — ${detail}` : ''}`);
};

console.log(`\n═══ LOT 104 — la vente n'ouvre pas sur un module absent (site : ${process.env.SITE}) ═══`);

const { manifest } = await import(join(R, 'engine/lib/manifest.mjs'));
const { catalogueModules, palierPayant } = await import(join(R, 'engine/lib/access.mjs'));

const m = manifest();
const offre = m.offer || {};

// ── 0. L'INSTRUMENT AVANT LA MESURE ───────────────────────────────────────
// ⭐⭐ « Un banc se juge sur ce qu'il LAISSE PASSER. » Sans catalogue declare,
// tout ce qui suit serait vert — et vert POUR LA SEULE RAISON QUI REND UN BANC
// INUTILE : il n'a rien a mesurer. On refuse de rendre un verdict, et on
// nomme le site, parce que ce message serait lui-meme la panne.
const modules = Array.isArray(offre.modules) ? offre.modules : null;
if (!modules) {
  // ⛔ CE N'EST PAS UN ECHEC POUR TOUS LES SITES. vevewiki declare
  // `tiers: [visitor]` et ne vend rien : il n'a aucune raison d'avoir un
  // catalogue. Un banc qui echouerait la ferait echouer un site parfaitement
  // sain — c'est la panne du 07/08 sur test:fuite, mot pour mot.
  const vend = (m.access?.tiers || []).some((t) => t !== 'visitor');
  if (vend) {
    dit(false, `« ${process.env.SITE} » vend des paliers mais ne declare aucun offer.modules`,
      'la page d\'offre n\'a alors rien a annoncer — declarer le catalogue, ou retirer les paliers');
  } else {
    console.log(`  --  « ${process.env.SITE} » ne vend aucun palier : rien a verifier, et c'est NORMAL.`);
    console.log('      ⭐ Ce message est volontaire : un banc muet et un banc vert se ressemblent.');
  }
  console.log(ko === 0 ? '\n✅ rien a promettre sur ce site\n' : `\n🔴 ${ko} controle(s) en echec\n`);
  process.exit(ko === 0 ? 0 : 1);
}

// `catalogueModules()` LEVE sur un catalogue incoherent (palier inconnu, porte
// inconnue, `porte:` ET `palier:` declares ensemble). On le laisse lever : son
// message est meilleur que celui qu'on ecrirait ici.
const cat = catalogueModules();
dit(cat.length > 0, `${cat.length} module(s) declare(s) dans offer.modules`,
  cat.length ? null : 'catalogue vide — ce banc ne prouverait rien');

// ── 1. LA VENTE EST-ELLE OUVERTE ? ────────────────────────────────────────
// ⭐ `offer.url` est LE drapeau : /offre/ et /compte/ testent tous deux cette
// valeur et remplacent le bouton d'achat par « les abonnements ouvrent
// bientot ». Vide = rien n'est encaissable. C'est une DONNEE du manifeste,
// pas une deduction sur l'etat du monde.
const venteOuverte = Boolean(String(offre.url || '').trim());
console.log(`\n  · vente ${venteOuverte ? 'OUVERTE' : 'FERMEE'} (offer.url ${venteOuverte ? `= « ${offre.url} »` : 'est vide'})`);

// ── 2. QUELS MODULES SONT ANNONCES SANS EXISTER, ET A QUEL PRIX ? ─────────
const enAttente = cat.filter((mo) => mo.bientot);
const payantsEnAttente = enAttente.filter((mo) => palierPayant(mo.tier));

console.log(`  · ${enAttente.length} module(s) annonce(s) mais pas construits`
  + (enAttente.length ? ` : ${enAttente.map((x) => x.cle).join(', ')}` : ''));
console.log(`  · dont ${payantsEnAttente.length} attribue(s) a un palier PAYANT`
  + (payantsEnAttente.length ? ` : ${payantsEnAttente.map((x) => `${x.cle} (${x.tier})`).join(', ')}` : ''));

// ── 3. LE CONTROLE, ET IL N'A QU'UNE PHRASE ───────────────────────────────
dit(!(venteOuverte && payantsEnAttente.length),
  'aucun palier payant ne promet un module qui n\'existe pas',
  venteOuverte && payantsEnAttente.length
    ? `offer.url est renseigne ET ${payantsEnAttente.length} module(s) « bientot » sont vendus : `
      + payantsEnAttente.map((x) => `${x.cle} → ${x.tier}`).join(' · ')
    : null);

if (venteOuverte && payantsEnAttente.length) {
  console.log('\n     🔴 CE BUILD OUVRIRAIT LA VENTE SUR DES MODULES ABSENTS.');
  console.log('     ⭐ Ce n\'est pas l\'affichage qui est en cause — Preda a arbitre le 07/08');
  console.log('        que les modules a venir SOIENT montres, et cet affichage reste. C\'est le');
  console.log('        fait de les VENDRE qui change tout : tant que `offer.url` etait vide,');
  console.log('        aucune promesse n\'etait payante.');
  console.log('     ➡️  Trois sorties, au choix, pour CHAQUE module cite ci-dessus :');
  console.log('        1. le livrer, puis passer `bientot: false` dans sites/<site>/manifest.yml ;');
  console.log('        2. le descendre au palier `member` (gratuit) : annonce, jamais vendu ;');
  console.log('        3. le retirer de `offer.modules`.');
  console.log('     ⛔ NE PAS desarmer ce banc. Il ne s\'est jamais declenche avant aujourd\'hui :');
  console.log('        s\'il parle, c\'est que la condition qui rendait l\'arbitrage sur vient de');
  console.log('        tomber — c\'est exactement le moment pour lequel il a ete ecrit.');
}

// ── 4. LES MODULES LIVRES LE SONT-ILS VRAIMENT ? ──────────────────────────
// ⭐⭐⭐ LE CONTROLE INVERSE, ET C'EST LUI QUI FERME LE CIRCUIT. Le controle 3
// ne regarde que les modules DECLARES absents : il croit le manifeste sur
// parole. Un module passe a `bientot: false` par optimisme — ou par un
// copier-coller — redeviendrait vendable sans que rien ne le voie.
// ⛔ « Un controle qui ne regarde que ce qui existe ne voit jamais ce qui
// manque. » On va donc chercher, sur le DISQUE, la page de chaque module qui
// se declare livre et qui en a une.
// ⚠️ CES CHEMINS SONT DES CHEMINS DE FICHIER, DONC ILS VIEILLISSENT. Le
// renommage de `market.astro` en `market/index.astro` (convention du depot,
// impose par test:nginx) a fait crier ce controle des le premier build qui a
// suivi — ce qui est exactement ce qu'on lui demande. ⭐ Un chemin qui n'existe
// plus rend ici un ECHEC BRUYANT, jamais un « rien a verifier » silencieux :
// c'est la difference entre « zero parce que c'est casse » et « zero parce
// qu'il n'y a rien ici », et elle se joue sur cette table.
const PAGES = {
  market:    'src/pages/market/index.astro',
  alerts:    'src/pages/alertes/index.astro',
  wallet_watch: 'src/pages/vault/index.astro',
};
const menteurs = [];
for (const mo of cat) {
  const page = PAGES[mo.cle];
  if (!page) continue;                       // pas de page attendue : rien a dire
  const existe = existsSync(join(R, page));
  // Deux fautes SYMETRIQUES, et il faut les deux : declarer livre ce qui n'a
  // pas de page, ET declarer absent ce qui en a une (le manifeste vieillirait
  // dans l'autre sens, et /offre/ sous-vendrait un module livre).
  if (!mo.bientot && !existe) menteurs.push(`${mo.cle} : declare LIVRE, mais ${page} n'existe pas`);
  if (mo.bientot && existe) menteurs.push(`${mo.cle} : declare EN ATTENTE, mais ${page} existe`);
}
// ⭐ `dashboard` N'A PAS DE PAGE, ET C'EST LA CONCEPTION : arbitrage Preda du
// 07/08 — « l'accueil DEVIENT le tableau de bord ». Il n'apparait donc pas dans
// cette table. Le module reste `bientot: true` tant qu'aucun widget n'existe,
// et le bloc membre de l'accueil dit lui-meme qu'il est vide.
dit(menteurs.length === 0, 'chaque module declare livre a bien sa page sur le disque',
  menteurs.length ? menteurs.join(' · ') : `${Object.keys(PAGES).length} module(s) a page verifie(s)`);

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 118 — LES PORTES « PROVISOIRES » NE SURVIVENT PAS À LA VENTE
// ═══════════════════════════════════════════════════════════════════════════
// LE 10/08, `cote` est passee de `crevette` a `member`. Pas par choix produit :
// `crevette` se gagne par `abonne_jusqu_a > maintenant`, et dans tout `veveid`
// PERSONNE n'appelle `ajouterAbonnement()` — un grep rend une seule ligne, sa
// propre definition. Aucun compte au monde ne pouvait devenir crevette, donc
// `/market/` etait ferme a 100 % des humains ET a 100 % des robots.
// ⭐⭐⭐ UNE PROTECTION QUI BLOQUE TOUT LE MONDE N'EST PAS STRICTE, ELLE EST
// CASSEE — de l'exterieur les deux se ressemblent exactement.
//
// ⛔ CE CONTROLE N'EXISTE PAS POUR L'OUVERTURE, IL EXISTE POUR LA FERMETURE.
// La demo « temporaire » du 01/08 est restee ouverte jusqu'a devenir une fuite
// mesuree en production : la reserve servie a qui connaissait l'adresse. Elle
// n'est pas restee par negligence — elle est restee parce que RIEN NE POUVAIT
// LA RAPPELER. ⭐ « On ne supprime pas une protection, on la RENSEIGNE » ne
// vaut que si le renseignement se MESURE : un champ dans le manifeste peut
// rougir, un commentaire non.
//
// ⭐⭐ LE DECLENCHEUR EST LA VENTE, ET C'EST LE SEUL HONNETE. On ne peut pas
// dater la fin d'une bequille — on ne sait pas quand le paiement arrive. Mais
// on sait ce qui doit etre vrai LE JOUR OU IL ARRIVE : on ne peut pas encaisser
// un abonnement pendant qu'on donne gratuitement ce qu'il achete. Le jour ou
// `offer.url` se remplit, ce controle CASSE LE BUILD tant qu'une porte
// provisoire subsiste. Meme dispositif, meme fichier, meme raison que
// `offer.legal` juste au-dessus.
const acces = m.access || {};
const provisoires = Object.entries(acces.gates || {})
  .filter(([, g]) => g && g.provisoire)
  .map(([nom, g]) => ({ nom, tier: g.tier, pourquoi: String(g.provisoire) }));

if (provisoires.length) {
  // ⚠️ ON L'ANNONCE A CHAQUE BUILD, MEME QUAND C'EST CONFORME. Une bequille
  // silencieuse redevient invisible en trois semaines — c'est exactement
  // comme ca que la demo a tenu. Ce n'est pas un echec : c'est un rappel qui
  // ne peut pas se perdre, puisqu'il est dans le journal de chaque
  // deploiement.
  for (const p of provisoires) {
    console.log(`  ⏳ porte PROVISOIRE : « ${p.nom} » ouverte a « ${p.tier} » — ${p.pourquoi}`);
  }
}
dit(!(provisoires.length && offre.url),
  'aucune porte provisoire ne survit au jour ou l\'abonnement se vend',
  provisoires.length && offre.url
    ? `offer.url est rempli (${offre.url}) alors que ${provisoires.length} porte(s) restent ouvertes : `
      + provisoires.map((p) => `${p.nom}→${p.tier}`).join(', ')
      + ' — refermer AVANT de vendre, ou retirer offer.url'
    : (provisoires.length ? `${provisoires.length} porte(s) provisoire(s), et rien n'est encore vendu`
                          : 'aucune porte provisoire'));

// ⛔ ET LA CONTRE-EPREUVE — ecrite deux fois, parce que la premiere ne pouvait
//    pas rougir. Elle comparait le palier de la porte a `palierPayant()`, qui
//    rend `false` tant que la vente est fermee : la comparaison etait donc
//    fausse pour TOUTE porte, et le controle vert par construction.
//    ⭐⭐⭐ *Un banc qui ne peut pas rougir ne mesure rien* — et celui-la
//    l'annoncait meme fierement, « palier payant : false », sans que la ligne
//    ait le moindre sens.
//
// ⭐ LA BONNE PROPRIETE EST « ATTEIGNABLE », et c'est tout le sujet du lot.
//    Le defaut repare aujourd'hui n'est pas « la porte etait trop haute » :
//    c'est que son palier ne pouvait etre ATTEINT PAR PERSONNE. Une porte
//    marquee provisoire doit donc etre a un palier qu'un humain peut obtenir
//    sans paiement : `visitor` (rien a faire) ou `member` (creer un compte).
//    Au-dessus, le marquage decrit une intention et ne change rien — et un
//    champ qui decore finit recopie sans effet.
const ATTEIGNABLES = ['visitor', 'member'];
const fausses = provisoires.filter((p) => !ATTEIGNABLES.includes(p.tier));
dit(fausses.length === 0, 'une porte marquee provisoire est ouverte a un palier ATTEIGNABLE',
  fausses.length
    ? fausses.map((p) => `${p.nom} → « ${p.tier} »`).join(', ')
      + ` : marquee(s) provisoire(s) mais hors de ${ATTEIGNABLES.join('/')} — personne ne peut y arriver sans payer, donc rien n'est ouvert`
    : (provisoires.length ? `${provisoires.map((p) => `${p.nom}→${p.tier}`).join(', ')}` : 'aucune porte provisoire'));

console.log(ko === 0 ? '\n✅ rien n\'est vendu qui n\'existe pas\n' : `\n🔴 ${ko} controle(s) en echec\n`);
process.exit(ko === 0 ? 0 : 1);
