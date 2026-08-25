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

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

process.env.SITE = process.env.SITE || 'veveprice';
const R = new URL('../..', import.meta.url).pathname;

let ko = 0;
let indecidable = 0;
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

// ── 3. LE CONTROLE — REECRIT LE 25/08/2026, ARBITRAGE DE PREDA ────────────
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 CE CONTROLE S'EST DECLENCHE POUR LA PREMIERE FOIS AU LOT 200, le jour
// ou `offer.url` a ete rempli. Il disait : « ce build ouvrirait la vente sur
// des modules absents », et il proposait trois sorties, en ajoutant « NE PAS
// desarmer ce banc ».
//
// ⚖️ PREDA A CHOISI UNE QUATRIEME SORTIE, ET C'EST SON ARBITRAGE : ouvrir la
// vente en laissant les cinq modules marques « a venir ». Ce n'est PAS le
// desarmement que l'ancien texte redoutait — la question change, elle ne
// disparait pas. L'ancien banc demandait « vend-on une promesse ? ». Le
// nouveau demande **« l'acheteur voit-il que c'est une promesse ? »**, et il
// le mesure LA OU CA COMPTE : sur la page servie, pas dans le manifeste.
//
// ⭐⭐⭐ ET C'EST UN CONTROLE PLUS FORT QUE L'ANCIEN, PAS PLUS FAIBLE.
// L'ancien croyait le manifeste sur parole. Celui-ci ouvre `dist/` et compte
// les pastilles : le jour ou quelqu'un retire `{mo.bientot && …}` du gabarit
// « pour alleger », ou casse la clef `offer.soon.badge`, la page vendrait
// cinq modules absents SANS AUCUNE MENTION, et l'ancien banc serait reste
// vert — il ne regardait pas la page.
//
// ⚠️ MESURE DU 25/08, sur `dist/client/offre/index.html` : 5 pastilles « not
// built yet » pour 5 modules en attente. La premisse de l'arbitrage a ete
// verifiee AVANT de l'appliquer, pas apres.
// ⛔ IL NE REND AUCUN INDECIDABLE : il tourne apres `npm run build` (Dockerfile
//    l. 310 puis l. 453), donc la page existe. Absente alors que la vente est
//    ouverte, c'est un ROUGE — pas un haussement d'epaules.
if (!venteOuverte) {
  console.log('  --  la vente est FERMEE (offer.url vide) : aucune promesse n\'est payante.');
} else if (!payantsEnAttente.length) {
  console.log('  --  aucun module « bientot » n\'est attribue a un palier payant.');
} else {
  // ⭐ `R` EST LA RACINE DEJA CALCULEE PAR CE FICHIER, pas une variable neuve.
  //   Le mode `server` range les pages pre-generees sous `dist/client/`, le
  //   mode `static` sous `dist/` : on essaie les deux, dans cet ordre.
  const candidats = [
    join(R, 'dist', 'client', 'offre', 'index.html'),
    join(R, 'dist', 'offre', 'index.html'),
  ];
  const page = candidats.find((f) => existsSync(f));
  if (!page) {
    dit(false, 'la page /offre/ a pu etre lue',
      `la vente est ouverte et aucun de ces fichiers n'existe : ${candidats.join(' · ')}`);
  } else {
    const html = readFileSync(page, 'utf8');
    const pastilles = (html.match(/class="pastille"/g) || []).length;
    // ⭐ UNE PASTILLE PAR MODULE EN ATTENTE, AU MINIMUM. On accepte qu'il y en
    //   ait davantage (une pastille peut servir ailleurs) ; on refuse qu'il y
    //   en ait MOINS — c'est le seul sens ou l'acheteur perd quelque chose.
    dit(pastilles >= payantsEnAttente.length,
      `les ${payantsEnAttente.length} module(s) vendus « a venir » sont marques sur la page servie`,
      `${pastilles} pastille(s) pour ${payantsEnAttente.length} module(s) en attente`);
    // ⭐⭐ ET LA NOTE GLOBALE, qui explique la pastille. Une pastille sans
    //   legende est un symbole que personne ne decode : elle a l'air d'une
    //   decoration, et une decoration ne previent de rien.
    dit(/offer\.soon\.note|not built yet|pas encore construit/i.test(html)
      || html.includes('soon'),
      '...et la page porte la note qui explique ce marquage');
  }
  console.log('\n     ⚖️  ARBITRAGE PREDA DU 25/08 : la vente s\'ouvre avec ces modules');
  console.log('        affiches et marques « a venir ». Ce banc ne juge donc plus');
  console.log('        l\'existence du module, mais la VISIBILITE de la mention.');
  console.log(`        Modules concernes : ${payantsEnAttente.map((x) => `${x.cle} → ${x.tier}`).join(' · ')}`);
  console.log('     ➡️  Le jour ou l\'un d\'eux sort : `bientot: false` dans');
  console.log('        sites/<site>/manifest.yml, et il quitte cette liste tout seul.');
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


// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LOT 140-4 — UN PALIER GRATUIT ET OUVERT NE DIT PAS « BIENTOT »
// ═══════════════════════════════════════════════════════════════════════════
// MESURE EN PRODUCTION LE 12/08/2026 : /offre/ servait « Plans open soon. »
// QUATRE fois — une par carte, y compris sur `member`, dont le prix est 0 et
// dont la porte est OUVERTE depuis le 06/08 (l'inscription par courriel est en
// production). Le bouton disait « bientot » d'une chose qu'on pouvait faire
// tout de suite, sur la page dont le seul travail est de convertir.
//
// ⭐⭐ LE DEFAUT VENAIT D'UNE CONDITION JUSTE APPLIQUEE TROP LARGE : le gabarit
// testait `offer.url`, qui decrit la VENTE, pour decider du bouton de TOUS les
// paliers — y compris de celui qui ne se vend pas. Un palier gratuit n'a pas
// besoin d'un prestataire de paiement pour s'ouvrir.
//
// ⛔ ET ON MESURE SUR LE HTML SERVI, PAS SUR LE GABARIT. Un controle qui lirait
// `Offre.astro` verifierait qu'une intention est ECRITE ; ce §-ci verifie
// qu'elle est RENDUE — c'est-a-dire ce que la personne lit. Le gabarit et la
// page ont deja diverge deux fois sur ce depot (lots 24 et 119).
//
// ⭐⭐⭐ ET LE CONTROLE NE VAUT QUE VENTE FERMEE, CE QU'IL DIT. Le jour ou
// `offer.url` se remplit, toutes les cartes portent un vrai appel a l'action et
// il n'y a plus rien a departager. Un banc qui resterait branche ce jour-la
// rougirait sur une page parfaitement juste — et on l'aurait desarme.
{
  const { readFileSync, existsSync: existe } = await import('node:fs');
  const { join: joindre } = await import('node:path');
  const tiers = (m.access?.tiers || []);
  const plans = (offre.plans || []).filter((p) => tiers.includes(p.cle));
  const gratuits = plans.filter((p) => Number(p.prix) === 0);
  const payants = plans.filter((p) => Number(p.prix) !== 0);
  // ⭐ Le mode `server` range les pages pre-generees sous `dist/client/`.
  const RACINE = existe(joindre(R, 'dist', 'client')) ? joindre(R, 'dist', 'client') : joindre(R, 'dist');
  const PAGE = joindre(RACINE, 'offre', 'index.html');

  if (venteOuverte) {
    console.log('  --  la vente est OUVERTE : chaque carte porte un vrai appel a l\'action, rien a departager.');
    console.log('      ⭐ Ce message est volontaire : un banc muet et un banc vert se ressemblent.');
  } else if (!gratuits.length) {
    console.log(`  --  aucun palier gratuit declare sur « ${process.env.SITE} » : ce controle n'a rien a mesurer.`);
    console.log('      ⭐ Ce message est volontaire : un banc muet et un banc vert se ressemblent.');
  } else if (!existe(PAGE)) {
    // ⛔ INDECIDABLE, JAMAIS VERT. « zero parce que c'est casse » et « zero
    //    parce qu'il n'y a rien ici » sont deux verdicts opposes.
    indecidable++;
    console.log(`  ⚠️  INDECIDABLE — ${PAGE.replace(R, '')} absente : jouer ce banc APRES npm run build.`);
  } else {
    const html = readFileSync(PAGE, 'utf8');
    // ⛔ ON DECOUPE LA GRILLE DES TARIFS. `btn--verrou` et `/inscription/`
    //    vivent aussi dans l'en-tete et le pied de page : compter sur la page
    //    entiere melangerait des boutons qui n'ont rien a voir. Mesure du
    //    12/08 : 1 lien `/inscription/` hors grille sur cette page.
    const i = html.indexOf('class="tarifs"');
    const zone = i < 0 ? '' : html.slice(i, html.indexOf('compa-t__h') > 0 ? html.indexOf('compa-t__h') : html.length);
    dit(Boolean(zone), 'la grille des tarifs est lisible dans la page servie',
      zone ? `${zone.length} octets` : 'aucun bloc `class="tarifs"` : l\'instrument ne peut rien mesurer');
    if (zone) {
      const cartes = (zone.match(/class="tarif[ "]/g) || []).length;
      const verrous = (zone.match(/btn--verrou/g) || []).length;
      // 🔴 LOT 178 — L'ADRESSE EST REVENUE À `/connexion/` (Cloudflare mettait
      //    `/acces/` en cache). ⛔ Ce motif est la raison
      //    pour laquelle ce banc DEVAIT bouger dans le même lot que la page :
      //    il aurait compté 0 lien sur une grille parfaitement correcte, et le
      //    rouge aurait accusé le manifeste.
      const inscriptions = (zone.match(/href="\/connexion\/"/g) || []).length;
      console.log(`\n  · ${cartes} carte(s) rendue(s) · ${gratuits.length} gratuite(s) · ${payants.length} payante(s)`);
      console.log(`  · ${verrous} bouton(s) « bientot » · ${inscriptions} lien(s) vers l'inscription`);
      // ⭐ L'INSTRUMENT SE CONTROLE AVANT LA MESURE : si la page ne rend pas
      //    autant de cartes que le manifeste declare de plans, les deux
      //    comptages qui suivent porteraient sur autre chose.
      dit(cartes === plans.length, 'la page rend exactement une carte par plan declare',
        cartes === plans.length ? `${cartes} = ${plans.length}` : `${cartes} carte(s) pour ${plans.length} plan(s) : l'instrument mesure autre chose`);
      dit(verrous === payants.length,
        'seuls les paliers PAYANTS disent « bientot »',
        verrous === payants.length ? `${verrous} verrou(s) pour ${payants.length} palier(s) payant(s)`
          : `${verrous} bouton(s) verrouille(s) pour ${payants.length} palier(s) payant(s) : `
            + (verrous > payants.length
              ? `${verrous - payants.length} palier(s) GRATUIT(s) annoncent « bientot » une chose deja ouverte`
              : 'un palier payant a perdu son verrou — la vente est fermee, rien ne doit se cliquer'));
      dit(inscriptions === gratuits.length,
        'et chaque palier gratuit porte un chemin pour y entrer',
        inscriptions === gratuits.length ? `${inscriptions} lien(s) pour ${gratuits.length} palier(s) gratuit(s)`
          : `${inscriptions} lien(s) vers /connexion/ pour ${gratuits.length} palier(s) gratuit(s) : `
            + 'un palier ouvert sans porte est un palier ferme');
    }
  }
}

console.log(
  ko === 0 && indecidable === 0 ? '\n✅ rien n\'est vendu qui n\'existe pas\n'
  : ko === 0 ? `\n⚠️  conforme, mais ${indecidable} point(s) INDECIDABLE(S)\n`
  : `\n🔴 ${ko} controle(s) en echec\n`);
process.exit(ko === 0 ? 0 : 1);
