// ⚠️ VeVePreda/veve-sites — engine/tools/test_membre.mjs  (NEUF — lot 126)
// ═══════════════════════════════════════════════════════════════════════════
// 🧭 LE BANC DU PARCOURS MEMBRE — quatre pannes, toutes déjà payées ailleurs
// ═══════════════════════════════════════════════════════════════════════════
//  §1  `retourSur()` n'accepte QUE la liste blanche — et refuse les tremplins.
//  §2  Tout `?suite=` écrit a un LECTEUR.        ← la panne du lot 126
//  §3  `/dashboard/` est dans les TROIS endroits. ← la panne du lot 119
//  §4  Aucun `<button>` dans un `<a>` dans dist/. ← le piège de `.carte`
//  §5  Le cœur est ÉMIS sur les cartes.           ← une règle CSS sans émetteur
//  §6  Les favoris suivent le COMPTE, pas le navigateur. ← la panne du lot 118
//  §7  Le raccourci porte sa destination JUSQU'A veveid.  ← la panne du lot 141
//  §8  « Ma collection » distingue VIDE de JE NE SAIS PAS.
//  §9  Le HTML servi ne porte aucun commentaire de code.
//  §10 Rien n'est servi AVANT `<html>`, et le `<head>` n'est pas creve.
//
// ⚠️ IL N'IMPORTE PAS `dataset.mjs` : il lit du texte et du `dist/`, rien de
// plus. Il peut donc se placer après le build sans vider la réserve
// (règle payée deux fois, et une troisième au lot 125).

import { readFileSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(ICI, '..', '..');

let ko = 0, indecidable = 0;
const verifie = (t, ok, d = '') => { console.log(`  ${ok ? '✅' : '❌'} ${t}${d ? `   — ${d}` : ''}`); if (!ok) ko++; };
const indecis = (t, p) => { console.log(`  ⚠️  INDÉCIDABLE — ${t}   — ${p}`); indecidable++; };

const lire = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
// ⛔ On retire les commentaires avant de chercher un APPEL : « un contrôle lit
//    aussi les commentaires » est une leçon payée trois fois sur ce dépôt.
const sansCommentaires = (t) => t.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n1. `retourSur()` n\'accepte-t-elle que ce qui est prévu ?');
// ═══════════════════════════════════════════════════════════════════════════
const { retourSur, RETOUR_DEFAUT, RETOURS } = await import('../lib/retour.mjs');

const ACCEPTES = ['/dashboard/', '/market/', '/favoris/', '/compte/', '/offre/', '/fr/market/', '/de/favoris/'];
for (const bon of ACCEPTES) {
  verifie(`accepte ${bon}`, retourSur(bon) === bon, retourSur(bon) === bon ? '' : `🔴 rend ${JSON.stringify(retourSur(bon))}`);
}

// ⭐⭐⭐ LES TÉMOINS HOSTILES, ET ILS SONT LE CŒUR DU §1.
// Une liste blanche qu'on n'a jamais vue REFUSER n'est pas une liste blanche,
// c'est une phrase. Chacune de ces entrées est une redirection ouverte connue,
// et chacune a déjà servi ailleurs dans la vraie vie.
const REFUSES = [
  ['https://ailleurs.example/', 'URL absolue — le tremplin d\'hameçonnage'],
  ['//ailleurs.example/', 'double barre — le navigateur y lit un HÔTE'],
  ['/\\ailleurs.example/', 'antislash — certains navigateurs le lisent comme //'],
  ['%2f%2failleurs.example%2f', 'la même, encodée'],
  ['/dashboard/../../etc/', 'remontée de chemin'],
  ['/market/?x=1', 'une requête greffée'],
  ['/admin/', 'un chemin interne qui n\'est pas dans la liste'],
  ['/marketing/', 'préfixe voisin — la regex est-elle ancrée à droite ?'],
  ['/xx/market/evil/', 'segment en trop à droite'],
  ['/market/\r\nSet-Cookie: a=b', 'injection d\'en-tête'],
  ['', 'la chaîne vide'],
  [null, 'null'],
  ['/' + 'a'.repeat(300) + '/', 'une entrée démesurée'],
];
let passesAuTravers = [];
for (const [mauvais, pourquoi] of REFUSES) {
  if (retourSur(mauvais) !== null) passesAuTravers.push(`${JSON.stringify(mauvais)} (${pourquoi}) → ${JSON.stringify(retourSur(mauvais))}`);
}
verifie('⛔ et elle REFUSE les 13 témoins hostiles',
  passesAuTravers.length === 0,
  passesAuTravers.length ? `\n      🔴 ${passesAuTravers.join('\n      🔴 ')}` : `${REFUSES.length} refus sur ${REFUSES.length}`);

verifie('le défaut mène au tableau de bord, pas aux réglages',
  RETOUR_DEFAUT === '/dashboard/', RETOUR_DEFAUT);

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n2. tout `?suite=` écrit a-t-il un LECTEUR ?');
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 LA PANNE DU LOT 126, ET ELLE EST DE LA FAMILLE DU LOT 122.
// Quatre pages écrivaient `?suite=…` depuis les lots 104 et 118 ; personne ne
// le lisait. Ni erreur, ni run rouge, ni banc qui tombe — juste un membre
// renvoyé ailleurs à chaque connexion. *Un paramètre posé et jamais lu est
// invisible pour tout grep qui cherche une faute.*
const fichiersSrc = [];
(function balaie(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) balaie(p);
    else if (/\.(astro|js|ts|mjs)$/.test(e.name)) fichiersSrc.push(p);
  }
})(join(ROOT, 'src'));

const ecrivains = fichiersSrc.filter((f) => /suite=/.test(sansCommentaires(lire(f))));
const lecteurs = [...fichiersSrc, join(ROOT, 'engine', 'lib', 'retour.mjs')]
  .filter((f) => /retourSur\s*\(/.test(sansCommentaires(lire(f))));

verifie('des pages écrivent bien `?suite=`', ecrivains.length > 0,
  `${ecrivains.length} : ${ecrivains.map((f) => relative(ROOT, f)).join(' · ')}`);
// ⭐ « au moins deux » : `retour.mjs` la définit, il faut donc au moins un
//   APPELANT en plus. Sans ce +1, une fonction définie et jamais appelée —
//   exactement le lot 122 — passerait ce contrôle.
verifie('⛔ et au moins un fichier APPELLE `retourSur()` (pas seulement la définit)',
  lecteurs.length >= 2,
  lecteurs.length >= 2 ? lecteurs.map((f) => relative(ROOT, f)).join(' · ')
    : '🔴 `suite=` est écrit et jamais lu : la destination de retour meurt en silence');

const entrer = sansCommentaires(lire(join(ROOT, 'src', 'pages', 'api', 'entrer.js')));
verifie('le retour de connexion ne renvoie plus `/compte/` en dur',
  !/redirect\(\s*['"]\/compte\/['"]/.test(entrer),
  /redirect\(\s*['"]\/compte\/['"]/.test(entrer) ? '🔴 `redirect(\'/compte/\')` est encore là' : 'il passe par retourSur()');
verifie('…et il EFFACE le cookie de retour après usage',
  /cookies\.delete\(\s*COOKIE_RETOUR/.test(entrer),
  /cookies\.delete\(\s*COOKIE_RETOUR/.test(entrer) ? '' : '🔴 sans effacement, on y retourne trois connexions plus tard');

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n3. `/dashboard/` est-elle dans les TROIS endroits ?');
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 LA PANNE DU LOT 119, MOT POUR MOT : `/favoris/` était dans ROUTES_COMPTE
// et pas dans nginx. Elle a quitté `dist/`, nginx ne l'a jamais demandée à
// Node, `try_files … =404` a conclu. **Build vert, déploiement vert, page
// morte.** Le contrôle ci-dessous vaut pour TOUTE route de compte, pas
// seulement pour celle du jour.
const nginxBrut = lire(join(ROOT, 'nginx.server.conf'));
const routesTxt = lire(join(ROOT, 'engine', 'lib', 'astro_routes_compte.mjs'));
const bloc = routesTxt.slice(routesTxt.indexOf('const ROUTES_COMPTE'), routesTxt.indexOf('];', routesTxt.indexOf('const ROUTES_COMPTE')));
const routes = [...bloc.matchAll(/'pages\/(?:\[locale\]\/)?([a-z-]+)\//g)].map((m) => m[1]);
// ⚠️ `api` EST EXCLU, ET IL EST VÉRIFIÉ AVANT DE L'ÊTRE. Les routes
// `pages/api/*.js` ne passent pas par la regex `location ~ ^/(…)/` : elles ont
// leur propre bloc `location ^~ /api/` (nginx.server.conf l. 119). Sans cette
// exclusion le banc rougissait sur `api` — c'était l'INSTRUMENT qui était faux,
// pas le code, et on corrige l'instrument, jamais le code pour lui plaire.
// ⛔ Mais on ne l'exclut pas sur parole : on exige que ce bloc EXISTE. S'il
//    disparaissait, l'exclusion deviendrait un angle mort silencieux.
const API_A_SON_BLOC = /location\s+\^~\s+\/api\//.test(nginxBrut);
const segments = [...new Set(routes)].filter((s) => s !== 'api');
const nginx = nginxBrut;
const mLoc = nginx.match(/location\s+~\s+\^\/\(\[a-z\]\[a-z-\]\*\/\)\?\(([^)]+)\)\//);
const servis = mLoc ? mLoc[1].split('|') : [];

if (!segments.length || !servis.length) {
  indecis('la comparaison ROUTES_COMPTE ↔ nginx', 'une des deux listes est illisible');
} else {
  const orphelines = segments.filter((s) => !servis.includes(s));
  verifie('⛔ chaque route de compte a sa règle nginx',
    orphelines.length === 0,
    orphelines.length ? `🔴 ${orphelines.join(' · ')} — nginx ne les demandera JAMAIS à Node (404 sur build vert)`
      : `${segments.length} segment(s) : ${segments.join(' · ')}`);
  verifie('…et l\'exclusion de `api` repose sur un bloc nginx qui EXISTE',
    API_A_SON_BLOC, API_A_SON_BLOC ? 'location ^~ /api/ présent'
      : '🔴 `api` est exclu du contrôle et n\'a plus de règle : angle mort total');
  verifie('…et `dashboard` en fait partie',
    segments.includes('dashboard') && servis.includes('dashboard'),
    `ROUTES_COMPTE=${segments.includes('dashboard')} · nginx=${servis.includes('dashboard')}`);
}
const pagesBanc = lire(join(ROOT, 'engine', 'tools', 'test_pages.mjs'));
verifie('…et un banc la RÉCLAME (test:pages)', /\/dashboard\//.test(pagesBanc),
  /\/dashboard\//.test(pagesBanc) ? '' : '🔴 aucune demande : elle ne serait vérifiée qu\'en production');

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n4. aucun contenu interactif imbriqué dans un lien ?');
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ `.carte` **EST** un `<a>`. Un `<button>` dedans est du HTML invalide : les
// navigateurs le réparent chacun à leur façon, et le clic suit le lien. Preda
// l'avait posé comme piège connu bien avant qu'on écrive le cœur.
// ⭐ On mesure sur `dist/`, pas sur les sources : c'est la seule preuve que
//   l'enveloppe a réellement produit un frère et non un enfant.
const DIST = join(ROOT, 'dist');
if (!existsSync(DIST)) {
  indecis('la validité du HTML', 'dist/ absent — jouer ce banc APRÈS npm run build');
} else {
  const html = [];
  (function balaie(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) balaie(p);
      else if (e.name.endsWith('.html')) html.push(p);
    }
  })(DIST);
  // Un `<a …>` qui contient un `<button` avant son `</a>`.
  const MOTIF = /<a\b[^>]*>(?:(?!<\/a>)[\s\S]){0,4000}?<button\b/i;
  const fautifs = html.filter((f) => MOTIF.test(readFileSync(f, 'utf8'))).slice(0, 8);
  verifie(`⛔ aucun <button> à l'intérieur d'un <a> (${html.length} pages balayées)`,
    fautifs.length === 0,
    fautifs.length ? `🔴 ${fautifs.map((f) => relative(DIST, f)).join(' · ')}` : 'HTML valide de ce côté');

  // ═════════════════════════════════════════════════════════════════════════
  console.log('\n5. le cœur est-il ÉMIS sur les cartes ?');
  // ═════════════════════════════════════════════════════════════════════════
  // ⭐⭐⭐ LA RÈGLE SANS ÉMETTEUR. `.socle__fav` est stylée depuis le lot 15
  // POUR une carte (`.carte:hover .socle__fav`, `position:absolute; top:8px`),
  // et pendant onze lots seule la fiche l'émettait, via la variante `--fiche`.
  // Du CSS qui attend un gabarit ne se voit pas dans une feuille de 2 300
  // lignes — et aucun banc ne regardait de ce côté.
  // ⛔ Le contrôle porte sur la SORTIE : une carte rendue doit porter son cœur.
  // ⛔⛔ ON COMPTE `carte-h`, PAS `carte`. La première version cherchait
  //    `class="carte` — un PRÉFIXE — et elle a rougi sur les cinq index de blog
  //    de vevewiki, qui portent `class="cartes"`. Au pluriel. Rien à voir.
  //    ⭐⭐ *Un sélecteur préfixe attrape un suffixe BEM* : la règle était écrite
  //    dans la mémoire du dépôt, et je l'ai repayée. On ancre à droite.
  // ⭐ ET ON COMPTE, on ne se contente pas de « au moins un » : une enveloppe
  //   sans son cœur est exactement la panne qu'on répare — un `hidden` de trop,
  //   une condition ajoutée, et la moitié des cartes perdrait son bouton sans
  //   qu'une page entière cesse d'en porter.
  const envDe = (t) => (t.match(/class="carte-h[ "]/g) || []).length;
  const cœurDe = (t) => (t.match(/class="socle__fav"/g) || []).length;
  const avecCarte = html.filter((f) => envDe(readFileSync(f, 'utf8')) > 0);
  if (!avecCarte.length) {
    // ⚠️ NORMAL SUR VEVEWIKI : ce site n'a pas de vitrine de pièces.
    indecis('le cœur sur les cartes', 'aucune page rendue ne porte d\'enveloppe `.carte-h` — normal sur vevewiki');
  } else {
    const sansCoeur = avecCarte.filter((f) => {
      const t = readFileSync(f, 'utf8');
      return cœurDe(t) !== envDe(t);
    }).slice(0, 6);
    const totalE = avecCarte.reduce((n, f) => n + envDe(readFileSync(f, 'utf8')), 0);
    verifie(`autant de cœurs que d'enveloppes, page par page (${avecCarte.length} pages, ${totalE} cartes)`,
      sansCoeur.length === 0,
      sansCoeur.length ? `🔴 ${sansCoeur.map((f) => `${relative(DIST, f)} (${envDe(readFileSync(f, 'utf8'))} cartes / ${cœurDe(readFileSync(f, 'utf8'))} cœurs)`).join(' · ')}` : '');
    // ⭐ Et la contre-épreuve du CSS : la règle de survol doit suivre
    //   l'enveloppe, sinon le cœur reste à `opacity:0` pour toujours.
    const css = lire(join(ROOT, 'themes', 'vitrine', 'theme.css'));
    verifie('…et `.carte-h:hover .socle__fav` existe (sinon opacity:0 à vie)',
      /\.carte-h:hover\s+\.socle__fav/.test(css),
      /\.carte-h:hover\s+\.socle__fav/.test(css) ? '' : '🔴 le cœur ne se relèvera jamais : il n\'est plus enfant de .carte');
    verifie('…et l\'enveloppe `.carte-h` est stylée', /\.carte-h\{/.test(css),
      /\.carte-h\{/.test(css) ? '' : '🔴 classe émise sans règle : la grille perdra sa mise en page');
  }
}


// ═══════════════════════════════════════════════════════════════════════════
console.log('\n6. les favoris suivent-ils le COMPTE, et pas le navigateur ?');
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LA PANNE DU LOT 118, ET ELLE EST PIRE QU'UNE PAGE MORTE : `/favoris/`
// est derrière le mur membre, mais ce qu'elle protège vit dans
// `localStorage` — donc dans LE NAVIGATEUR, pas dans le compte. Un membre qui
// se connecte depuis son téléphone voit une page vide, sans une erreur, sans
// un run rouge. *Le mur garde une pièce qui n'est pas la sienne.*
//
// ⭐⭐⭐ CE §6 EXIGE LES DEUX MOITIÉS, ET C'EST TOUT SON INTÉRÊT :
//   ① un favori posé avec la session A se relit depuis un AUTRE navigateur
//      porteur de la même session — la donnée est donc au serveur ;
//   ② sans session, la lecture ROUGIT — elle ne rend pas une liste vide.
//   Sans ②, un `/api/favoris` qui répondrait `200 []` à tout le monde
//   passerait ① sans difficulté : ce serait un circuit ouvert, et il aurait
//   l'air parfaitement vert.
//   ③ et la session B ne voit pas les favoris de A — sinon la « clé » n'en
//      est pas une.
//
// ⛔⛔ CE QUE LA SIMULATION SUPPOSE, ÉCRIT NOIR SUR BLANC — c'est exactement
// ce que le 140-2 a payé. Le faux `fetch` du banc des plages rendait TOUJOURS
// 200 : la branche que seul un refus emprunte n'était jamais exécutée, et le
// banc était vert pour une raison qui n'existait pas.
// Le faux ci-dessous répond COMME LA VRAIE PORTE de veveid
// (`GET {SESSION_API}/api/session?sid=`, en-tête `x-service`) :
//   · 200 { compte, palier } sur un sid CONNU et un secret JUSTE ;
//   · 401 sur un sid INCONNU              ← la moitié qui manquait ;
//   · 401 sur un secret ABSENT ou FAUX    ← la porte est vraiment gardée.
// ⭐ Et le banc VÉRIFIE que la branche de refus a bien été empruntée : une
//   simulation dont on ne mesure pas qu'elle a servi est une décoration.

const FAV_ROUTE = join(ROOT, 'src', 'pages', 'api', 'favoris.js');
const FAV_LIB = join(ROOT, 'engine', 'lib', 'favoris.mjs');
const FAV_COMPTE = join(ROOT, 'engine', 'lib', 'compte.mjs');
const favRouteTxt = lire(FAV_ROUTE);

// ─── 6.a · LE CIRCUIT SE FERME, ET IL SE FERME DANS LES DEUX SENS ──────────
verifie('la route `/api/favoris` existe', Boolean(favRouteTxt),
  favRouteTxt ? '' : '🔴 src/pages/api/favoris.js absent : rien à protéger, rien à lire');
verifie('…et les deux modules du moteur aussi',
  Boolean(lire(FAV_LIB)) && Boolean(lire(FAV_COMPTE)),
  Boolean(lire(FAV_LIB)) && Boolean(lire(FAV_COMPTE)) ? ''
    : `🔴 manquant : ${[!lire(FAV_LIB) && 'engine/lib/favoris.mjs', !lire(FAV_COMPTE) && 'engine/lib/compte.mjs'].filter(Boolean).join(' · ')}`);

// ⭐ LITTÉRAL, et le banc l'exige comme tel : une EXPRESSION n'est pas évaluée
//   par Astro et retombe silencieusement sur `true`. La route serait alors un
//   fichier figé — la panne du lot 24, la cinquième fois qu'on l'écrit.
verifie('…et son `prerender = true` est un LITTÉRAL',
  /export\s+const\s+prerender\s*=\s*true\s*;/.test(favRouteTxt),
  /export\s+const\s+prerender\s*=/.test(favRouteTxt)
    ? (/export\s+const\s+prerender\s*=\s*true\s*;/.test(favRouteTxt) ? ''
      : '🔴 ce n\'est pas un littéral : Astro ne l\'évalue pas et pré-génère la route')
    : '🔴 aucun `prerender` exporté');

// 🔴 `ROUTES_COMPTE` est une LISTE ÉCRITE À LA MAIN, pas une règle (§7.2 de la
//    mesure). Une route `/api/` oubliée ici est pré-générée EN SILENCE.
verifie('…et elle est INSCRITE dans ROUTES_COMPTE',
  /'pages\/api\/favoris\.js'/.test(bloc),
  /'pages\/api\/favoris\.js'/.test(bloc) ? ''
    : '🔴 absente : la route sera pré-générée en silence, figée, identique pour tout le monde');

// ⛔ ARBITRAGE PREDA ③ — ON PART PROPRE. `vp_fav` MEURT. Une clé morte ne se
//    laisse pas traîner « au cas où » : tant qu'elle est lue quelque part, il
//    y a DEUX sources de vérité pour la même question.
// ⛔⛔ ON CHERCHE `vp_fav`, PAS `localStorage`, ET L'INSTRUMENT A ÉTÉ CORRIGÉ
//    ICI AVANT LE CODE. La première version cherchait `localStorage` et
//    rougissait sur `Base.astro` (le thème nuit, `langChoice`), `50-i18n.js`
//    (le cache des libellés) et `Market.astro` (la mémoire des filtres) — six
//    fichiers, dont CINQ n'ont rien à voir avec les favoris. Son message
//    annonçait « deux sources de vérité pour une seule question » : une cause
//    qu'il ne départageait pas. ⭐⭐⭐ *Un message d'échec est une
//    INSTRUCTION ; s'il nomme une cause qu'il ne départage pas, on le suit et
//    on casse.* Le stockage local reste parfaitement légitime pour une
//    préférence d'affichage — ce qui meurt, c'est la clé `vp_fav`.
const porteursVpFav = fichiersSrc.filter((f) => /vp_fav/.test(sansCommentaires(lire(f))));
verifie('⛔ plus AUCUN fichier ne lit la clé locale `vp_fav`',
  porteursVpFav.length === 0,
  porteursVpFav.length ? `🔴 ${porteursVpFav.map((f) => relative(ROOT, f)).join(' · ')} — deux sources de vérité pour une seule question`
    : 'la clé locale est retirée, pas commentée');

// ⭐⭐⭐ UN ACCÈS, UN SEUL. C'est la forme qui a coûté le 140-1 : trois lectures
//   indépendantes et TOUTES JUSTES d'une même donnée, qui divergent le jour où
//   une seule apprend une règle de plus. Les trois lecteurs (le bouton ★, la
//   page /favoris/, la tuile du tableau de bord) passent par le MÊME appel.
// ⛔ On compte les fichiers qui PARLENT à la route, pas les fichiers qui
//   nomment les favoris : c'est l'appel réseau qui se duplique, pas le mot.
const appelants = fichiersSrc
  .filter((f) => resolve(f) !== resolve(FAV_ROUTE))
  .filter((f) => /['"`]\/api\/favoris/.test(sansCommentaires(lire(f))));
verifie('⭐ un accès unique : UN SEUL fichier appelle `/api/favoris`',
  appelants.length === 1,
  appelants.length === 1 ? relative(ROOT, appelants[0])
    : appelants.length === 0 ? '🔴 personne n\'appelle la route : elle est écrite et jamais lue'
      : `🔴 ${appelants.length} appelants : ${appelants.map((f) => relative(ROOT, f)).join(' · ')} — trois lectures qui divergeront`);

// ⭐⭐ ET LE PILOTE DES VUES N'EST PAS EN LIGNE. Un `<script>` en ligne
//   s'exécute quand l'analyseur l'atteint ; il vit donc dans
//   `src/socle/modules/` (glob en `.js`, pas `.mjs` — voir socle_js.mjs l. 66).
verifie('…et le pilote des deux vues vit dans `src/socle/modules/favoris.js`',
  existsSync(join(ROOT, 'src', 'socle', 'modules', 'favoris.js')),
  existsSync(join(ROOT, 'src', 'socle', 'modules', 'favoris.js')) ? ''
    : '🔴 absent : `moduleJs(\'favoris\')` lèverait au build');

// ⭐⭐ LA SENTINELLE DU VOLUME. Sans volume monté, TOUT marche — jusqu'au
//   déploiement suivant, où les favoris disparaissent sans un message. La
//   sonde doit donc dire non pas « la base s'ouvre » mais « son dossier est un
//   point de MONTAGE ». Sans ce §, l'oubli du geste Coolify est invisible.
const santeTxt = sansCommentaires(lire(join(ROOT, 'src', 'pages', 'api', 'sante.js')));
// ⭐⭐ ET LA CONDITION VOYAGE AVEC LE CODE. Sans porte, vevewiki — qui n'ouvre
//   aucun compte — annoncerait `favoris:{ouverte:false}` : une sonde qui crie
//   sur une installation correcte, donc une sonde qu'on apprend à ignorer.
//   ⛔ Le prédicat doit être IMPORTÉ (`acces()`), pas recopié : deux
//   définitions d'un même état finissent toujours par diverger.
verifie('…et cette sentinelle est conditionnée aux sites qui ouvrent des comptes',
  /acces\(\)\.tiers\.length\s*>\s*1/.test(santeTxt),
  /acces\(\)\.tiers\.length\s*>\s*1/.test(santeTxt) ? ''
    : '🔴 sans porte, la sonde de vevewiki annonce un stockage cassé qui n\'a jamais existé');
verifie('⭐ `/api/sante` porte la sentinelle du volume (`favoris.montee`)',
  /favoris\s*:/.test(santeTxt) && /montee/.test(santeTxt),
  /favoris\s*:/.test(santeTxt) && /montee/.test(santeTxt) ? ''
    : '🔴 sans ce §, un /data non monté est indétectable de l\'extérieur');

// ⛔ PAS DE `VOLUME` DANS LE DOCKERFILE — recette veveid, et elle est écrite
//   dans son Dockerfile l. 47-60. Un `VOLUME` déclaré crée un volume ANONYME
//   au démarrage si la plateforme n'en monte pas : la base survivrait au
//   redémarrage et mourrait au redéploiement, ce qui est le pire des deux.
const dockerTxt = lire(join(ROOT, 'Dockerfile'));
const runtime = dockerTxt.slice(dockerTxt.indexOf('AS runtime'));
verifie('le Dockerfile prépare `/data` au stage runtime',
  /mkdir\s+-p\s+\/data/.test(runtime) && /DB_PATH=/.test(runtime),
  /mkdir\s+-p\s+\/data/.test(runtime) && /DB_PATH=/.test(runtime) ? ''
    : `🔴 manquant : ${[!/mkdir\s+-p\s+\/data/.test(runtime) && 'mkdir -p /data', !/DB_PATH=/.test(runtime) && 'ENV DB_PATH'].filter(Boolean).join(' · ')}`);
verifie('…et il ne déclare AUCUN `VOLUME`', !/^\s*VOLUME\b/m.test(dockerTxt),
  !/^\s*VOLUME\b/m.test(dockerTxt) ? '' : '🔴 un VOLUME anonyme masquerait /data et la base mourrait au redéploiement');

// ⭐ LA 18ᵉ NOTE DÉMENTIE, ET ELLE EST DANS LE DÉPÔT. `Favoris.astro` affirme
//   en gros « ELLE N'EST PAS UNE ROUTE DE COMPTE » ; le lot 118 l'y a inscrite
//   deux jours plus tard. Le prochain qui lit ce fichier avant de coder est
//   activement induit en erreur — un commentaire faux est un banc à l'envers.
const favVue = lire(join(ROOT, 'src', 'components', 'pages', 'Favoris.astro'));
verifie('⚠️ `Favoris.astro` ne ment plus sur lui-même',
  Boolean(favVue) && !/N'EST PAS UNE ROUTE DE COMPTE/i.test(favVue),
  Boolean(favVue) && !/N'EST PAS UNE ROUTE DE COMPTE/i.test(favVue) ? ''
    : '🔴 l\'en-tête affirme encore le contraire de ce que fait ROUTES_COMPTE depuis le lot 118');

// ─── 6.b · LA CHAÎNE, EXERCÉE POUR DE VRAI ────────────────────────────────
const SID_A = 'sid-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SID_B = 'sid-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const SESSIONS = { [SID_A]: { compte: 41, palier: 'member' }, [SID_B]: { compte: 77, palier: 'member' } };
const SECRET = 'secret-de-service-du-banc';
const UUID = '11111111-2222-4333-8444-555555555555';

let refusServis = 0;      // ⭐ la preuve que la branche de REFUS a servi
let appelsServis = 0;
const vraiFetch = globalThis.fetch;
globalThis.fetch = async (cible, init = {}) => {
  const adresse = String(cible);
  if (!/\/api\/session\b/.test(adresse)) {
    throw new Error(`[banc §6] appel réseau inattendu vers ${adresse}`);
  }
  appelsServis++;
  const entetes = new Headers(init.headers || {});
  // ⛔ LA PORTE EST GARDÉE, ET LE FAUX LE REPRODUIT. Sans ce refus, un
  //    `/api/favoris` qui oublierait `x-service` passerait le banc.
  if (entetes.get('x-service') !== SECRET) {
    refusServis++;
    return new Response('{"erreur":"service"}', { status: 401, headers: { 'content-type': 'application/json' } });
  }
  const sid = new URL(adresse, 'https://id.exemple').searchParams.get('sid');
  const s = SESSIONS[sid];
  if (!s) {
    refusServis++;
    return new Response('{"erreur":"session"}', { status: 401, headers: { 'content-type': 'application/json' } });
  }
  return new Response(JSON.stringify({ compte: s.compte, palier: s.palier, email: 'x@y.z' }),
    { status: 200, headers: { 'content-type': 'application/json' } });
};

// ⚠️ UNE BASE JETABLE, JAMAIS `/data`. Le banc tourne dans le conteneur de
//    build : écrire dans le vrai dossier y mêlerait ses propres lignes.
const BASE_BANC = join(tmpdir(), `veve-favoris-banc-${process.pid}.db`);
process.env.DB_PATH = BASE_BANC;
process.env.SESSION_API = 'https://id.exemple';
process.env.VEVEID_SERVICE = SECRET;

// ⭐ UN CONTEXTE NEUF PAR APPEL = UN NAVIGATEUR NEUF. C'est là que se joue la
//   moitié ① : rien n'est partagé entre les deux appels sinon le `sid`.
const contexte = (sid, corps) => ({
  cookies: { get: (n) => (n === 'vp_session' && sid ? { value: sid } : undefined) },
  locals: { rendu: 'demande', session: sid ? 'reelle' : undefined, palier: sid ? 'member' : undefined },
  url: new URL('https://veveprice.com/api/favoris'),
  request: new Request('https://veveprice.com/api/favoris', corps
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps) }
    : { method: 'GET' }),
});
const lireJson = async (r) => { try { return JSON.parse(await r.text()); } catch { return null; } };

try {
  const route = await import(pathToFileURL(FAV_ROUTE).href);
  if (typeof route.POST !== 'function' || typeof route.GET !== 'function' || typeof route.DELETE !== 'function') {
    verifie('la route expose GET, POST et DELETE', false,
      `🔴 exports trouvés : ${Object.keys(route).join(', ') || '(aucun)'}`);
  } else {
    // ① NAVIGATEUR 1 — on pose.
    const pose = await route.POST(contexte(SID_A, { uuid: UUID, path: '/items/x/', nom: 'Pièce du banc' }));
    verifie('① la session A pose un favori', pose.status === 200 || pose.status === 201, `HTTP ${pose.status}`);

    // ① NAVIGATEUR 2 — contexte entièrement neuf, même session.
    const relu = await lireJson(await route.GET(contexte(SID_A)));
    const cles = relu ? Object.keys(relu.favoris || relu || {}) : [];
    verifie('① …et un AUTRE navigateur porteur de la même session le relit',
      cles.includes(UUID),
      cles.includes(UUID) ? '' : `🔴 relu ${JSON.stringify(cles)} — la donnée n'est pas au serveur`);

    // ② SANS SESSION — la moitié qui départage un vrai mur d'un 200 vide.
    const nu = await route.GET(contexte(null));
    verifie('② ⛔ sans session, la lecture ROUGIT (401), elle ne rend pas une liste vide',
      nu.status === 401,
      nu.status === 401 ? '' : `🔴 HTTP ${nu.status} — un 200 ici est un circuit ouvert, pas un mur`);

    // ②bis 🔴🔴 LE CAS QUI EXERCE VRAIMENT LE REFUS DE veveid, ET IL A ÉTÉ
    //   AJOUTÉ PARCE QUE LE COMPTEUR DE REFUS CI-DESSOUS EST RESTÉ À ZÉRO.
    //   Sans session du tout, la route rend 401 sans même appeler veveid —
    //   c'est correct, et c'est justement pourquoi ce chemin ne prouve rien
    //   sur la porte. Le cas réel est AUTRE : un cookie `vp_session` encore
    //   présent dans le navigateur alors que la session a été révoquée ou a
    //   expiré côté veveid. C'est la branche que seul un refus emprunte —
    //   exactement celle que le faux `fetch` du 140-2 ne servait jamais.
    const revoquee = await route.GET(contexte('sid-revoque-mais-encore-dans-le-navigateur'));
    verifie('②bis ⛔ un cookie survivant à une session RÉVOQUÉE rougit aussi (401)',
      revoquee.status === 401,
      revoquee.status === 401 ? '' : `🔴 HTTP ${revoquee.status} — veveid a dit non et la route a servi quand même`);

    // ③ UNE AUTRE SESSION — la clé en est une, ou elle n'en est pas une.
    const chezB = await lireJson(await route.GET(contexte(SID_B)));
    const clesB = chezB ? Object.keys(chezB.favoris || chezB || {}) : [];
    verifie('③ ⛔ la session B ne voit pas les favoris de A',
      !clesB.includes(UUID),
      !clesB.includes(UUID) ? '' : '🔴 les favoris ne sont pas rangés par COMPTE');

    // ④ ET ON RETIRE.
    const retrait = await route.DELETE(contexte(SID_A, { uuid: UUID }));
    const apres = await lireJson(await route.GET(contexte(SID_A)));
    const clesApres = apres ? Object.keys(apres.favoris || apres || {}) : [];
    verifie('④ le retrait retire', (retrait.status === 200 || retrait.status === 204) && !clesApres.includes(UUID),
      `HTTP ${retrait.status}, reste ${JSON.stringify(clesApres)}`);
  }
} catch (e) {
  // ⛔ UN MESSAGE D'ÉCHEC EST UNE INSTRUCTION. Celui-ci ne nomme AUCUNE cause :
  //    il rapporte l'erreur telle quelle. Nommer « module absent » ici serait
  //    nommer une cause que ce catch ne départage pas d'une faute de syntaxe.
  verifie('la chaîne favoris s\'exerce de bout en bout', false, `🔴 ${e && e.message ? e.message : e}`);
}

// ⭐ LA SIMULATION A-T-ELLE SERVI ? Un faux jamais appelé rend tous les
//   contrôles ci-dessus muets, et un muet ressemble à un succès.
verifie('⭐ le faux service a bien été interrogé, refus compris',
  appelsServis > 0 && refusServis > 0,
  appelsServis > 0 && refusServis > 0 ? `${appelsServis} appel(s), dont ${refusServis} refus`
    : `🔴 ${appelsServis} appel(s), ${refusServis} refus — la branche de refus n'a jamais été exécutée`);

globalThis.fetch = vraiFetch;
try { rmSync(BASE_BANC, { force: true }); } catch { /* la base jetable n'a pas été créée */ }


// ═══════════════════════════════════════════════════════════════════════════
console.log('\n7. le raccourci mène-t-il DROIT à la découverte du portefeuille ?');
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 LA PANNE DU LOT 141, ET ELLE EST SILENCIEUSE DES DEUX CÔTÉS.
// `/compte/` postait `vers=verifier` en dur. Chez veveid, `verifier` mène à
// `/choisir`, qui renvoie vers `/compte` quand aucun portefeuille n'est encore
// saisi : deux redirections et un second clic pour atteindre `/decouvrir`,
// c'est-à-dire la page que le site venait de promettre.
// ⭐⭐⭐ ET LA MAUVAISE MOITIÉ DU CORRECTIF EST MUETTE : `api/veveid.js` ne
// transmet QUE les destinations de sa propre liste, et retombe SANS RIEN DIRE
// sur `verifier` pour toutes les autres. Écrire `decouvrir` dans le gabarit en
// oubliant la liste produit donc exactement l'ancien comportement, sur un build
// vert. ⛔ Un contrôle qui se contenterait de lire « le mot decouvrir est dans
// le fichier » serait vert ce jour-là.
// ⇒ ON EXERCE LA PASSERELLE, on ne la lit pas.

const VEVEID_ROUTE = join(ROOT, 'src', 'pages', 'api', 'veveid.js');
const comptePage = lire(join(ROOT, 'src', 'pages', 'compte', 'index.astro'));
const comptePageCode = sansCommentaires(comptePage);

// ─── 7.a · LES DESTINATIONS QUE LA PAGE DEMANDE, LUES DANS LA PAGE ─────────
// ⭐⭐⭐ AUCUNE SECONDE LISTE ICI, ET C'EST TOUT LE POINT. Le banc n'écrit pas
//   « la page doit demander decouvrir » : il EXTRAIT les destinations que le
//   gabarit demande réellement, puis va vérifier que la passerelle sait les
//   porter. Le jour où quelqu'un en ajoute une quatrième sans toucher la
//   liste, ce contrôle la trouve tout seul — une liste écrite ici aurait
//   vieilli en silence, comme les trois autres listes de ce dépôt.
const champVers = comptePageCode.match(/name="vers"[^>]*value=\{([^}]*)\}/);
const versLitteralFige = /name="vers"[^>]*value="[a-z]+"/.test(comptePageCode);
verifie('la page ne fige plus la destination dans une valeur littérale',
  !versLitteralFige && Boolean(champVers),
  versLitteralFige ? '🔴 `value="…"` en dur : la destination ne dépend plus de l\'état du portefeuille'
    : champVers ? `expression trouvée : ${champVers[1].trim().slice(0, 80)}`
      : '🔴 aucun champ `vers` avec une expression : introuvable dans compte/index.astro');

const demandees = champVers ? [...new Set([...champVers[1].matchAll(/['"]([a-z]+)['"]/g)].map((x) => x[1]))] : [];
// ⭐ LES DEUX MOITIÉS, ET ELLES SE MESURENT SÉPARÉMENT. Une expression qui ne
//   citerait qu'UNE destination serait une constante déguisée : elle rendrait
//   le même parcours à tout le monde, et le contrôle ci-dessus resterait vert.
verifie('…et elle demande DEUX destinations selon l\'état du portefeuille',
  demandees.length >= 2 && demandees.includes('decouvrir') && demandees.includes('verifier'),
  demandees.length ? `demandées : ${demandees.join(' · ')}`
    : '🔴 aucune destination littérale extraite de l\'expression');

// ─── 7.b · LA PASSERELLE LES PORTE-T-ELLE VRAIMENT ? ──────────────────────
// ⛔ Le faux ci-dessous répond COMME veveid : il exige `x-service`, et rend une
//    adresse préfixée par la base — sans quoi `api/veveid.js` refuserait de
//    rediriger (contrôle de redirection ouverte, l. 77).
const BASE_ID = 'https://id.exemple';
const SECRET7 = 'secret-de-service-du-banc-7';
let versRecus = [];
let refus7 = 0;
const vraiFetch7 = globalThis.fetch;
globalThis.fetch = async (cible, init = {}) => {
  const adresse = String(cible);
  if (!/\/api\/passerelle\b/.test(adresse)) throw new Error(`[banc §7] appel inattendu vers ${adresse}`);
  const entetes = new Headers(init.headers || {});
  if (entetes.get('x-service') !== SECRET7) {
    refus7++;
    return new Response('{"erreur":"service"}', { status: 401, headers: { 'content-type': 'application/json' } });
  }
  const corps = JSON.parse(String(init.body || '{}'));
  versRecus.push(corps.vers);
  return new Response(JSON.stringify({ url: `${BASE_ID}/aller/${corps.vers}` }),
    { status: 200, headers: { 'content-type': 'application/json' } });
};
process.env.SESSION_API = BASE_ID;
process.env.VEVEID_SERVICE = SECRET7;

// Un contexte de route Astro réduit à ce que `POST()` lit vraiment.
const ctxVeveid = (versDemande, sid = 'sid-du-banc') => {
  const fd = new FormData();
  if (versDemande !== null) fd.set('vers', versDemande);
  return {
    request: new Request('https://veveprice.com/api/veveid', { method: 'POST', body: fd }),
    cookies: { get: (n) => (n === 'vp_session' && sid ? { value: sid } : undefined) },
    redirect: (url, code) => new Response(null, { status: code, headers: { location: url } }),
  };
};

try {
  const passerelle = await import(pathToFileURL(VEVEID_ROUTE).href);
  if (typeof passerelle.POST !== 'function') {
    verifie('la passerelle expose POST', false, `🔴 exports : ${Object.keys(passerelle).join(', ') || '(aucun)'}`);
  } else {
    // ① CHAQUE destination que la PAGE demande doit arriver telle quelle.
    for (const d of demandees) {
      versRecus = [];
      const rep = await passerelle.POST(ctxVeveid(d));
      const porte = versRecus[versRecus.length - 1];
      verifie(`① la passerelle porte « ${d} » sans le remplacer`,
        porte === d && rep.status === 303,
        porte === d ? `HTTP ${rep.status} → ${rep.headers.get('location')}`
          : `🔴 veveid a reçu « ${porte} » : la destination est retombée sur le défaut, EN SILENCE`);
    }
    // ② ⭐⭐⭐ ET LA BRANCHE DE REFUS DOIT SERVIR. C'est la leçon du ZIP 1,
    //    payée un aller-retour : une liste blanche qu'on n'a jamais vue
    //    REFUSER n'est pas une liste blanche, c'est une phrase. On lui donne
    //    donc une destination hostile ET une destination légitime, et on exige
    //    que les deux moitiés se comportent différemment.
    versRecus = [];
    await passerelle.POST(ctxVeveid('administrateur'));
    const surHostile = versRecus[versRecus.length - 1];
    // ⛔ LE MESSAGE DIT LA CAUSE QU'IL DÉPARTAGE, ET ELLE SEULE. Trois issues
    //   distinctes, trois phrases : la valeur hostile est passée · elle est
    //   bien filtrée · ou l'instrument lui-même n'a rien à comparer parce que
    //   le §7.a n'a extrait aucune destination.
    const filtree = surHostile !== 'administrateur' && Boolean(surHostile);
    verifie('② ⛔ une destination hostile ne traverse PAS la passerelle',
      filtree && demandees.includes(surHostile),
      surHostile === 'administrateur' ? '🔴 « administrateur » a été transmis à veveid : la liste ne filtre rien'
        : !filtree ? '🔴 aucune destination transmise : la passerelle n\'a pas répondu'
          : demandees.includes(surHostile) ? `retombée sur « ${surHostile} », que la page demande aussi`
            : `🔴 retombée sur « ${surHostile} », que la page ne demande PAS — le défaut et le gabarit ont divergé`);
    // ③ Et sans session, on ne fabrique rien du tout.
    versRecus = [];
    const nu = await passerelle.POST(ctxVeveid('decouvrir', null));
    verifie('③ ⛔ sans session, la passerelle n\'interroge même pas veveid',
      versRecus.length === 0 && nu.status === 303,
      versRecus.length === 0 ? `HTTP ${nu.status} → ${nu.headers.get('location')}`
        : '🔴 un anonyme a fait fabriquer un jeton de relais');
  }
} catch (e) {
  verifie('la passerelle s\'exerce de bout en bout', false, `🔴 ${e && e.message ? e.message : e}`);
}
globalThis.fetch = vraiFetch7;

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n8. « ma collection » distingue-t-elle VIDE de JE NE SAIS PAS ?');
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LA DONNÉE ÉTAIT DÉJÀ COLLECTÉE PUIS JETÉE — LA 13ᵉ FOIS. `veveid` expose
// `GET /api/avoirs`, derrière `x-service`, et le site ne l'appelait jamais : un
// portefeuille vérifié ne rapportait RIEN sur veveprice.
//
// ⭐⭐⭐ TROIS SORTIES, JAMAIS DEUX, ET C'EST TOUT L'OBJET DE CE §.
//   · une liste          → on l'affiche ;
//   · « il n'y a personne » / rien à montrer → on le dit ;
//   · ⛔ « JE NE SAIS PAS » (veveid muet, ou synchronisation incomplète)
//     → il ne doit JAMAIS emprunter la sortie du deuxième. Aplatir les deux
//     afficherait « aucun collectible » à quelqu'un qui en a trois cents, sur
//     une simple coupure réseau — et personne ne verrait jamais l'erreur.
// C'est mot pour mot la doctrine de `compteDeLaSession()` juste au-dessus dans
// le même fichier ; ce banc exige qu'elle soit tenue une seconde fois.

const { avoirsDeLaSession } = await import(pathToFileURL(join(ROOT, 'engine', 'lib', 'compte.mjs')).href)
  .catch(() => ({}));

if (typeof avoirsDeLaSession !== 'function') {
  verifie('`engine/lib/compte.mjs` expose `avoirsDeLaSession()`', false,
    '🔴 absente : la page devrait alors appeler veveid elle-même, et personne ne pourrait exercer ses trois sorties');
} else {
  const SECRET8 = 'secret-de-service-du-banc-8';
  const AVOIR = { mint_key: 'Piece du banc:42', nom: 'Pièce du banc', edition: 42, rarete: 'rare', image: 'https://x/y.png' };
  // ⭐ CHAQUE CAS EST UNE RÉPONSE RÉELLE DE `veveid`, mesurée le 12/08 :
  //    200 · 401 sans secret · 404 sid inconnu ou révoqué · 409 non prouvé.
  let urlsVues = [];
  let refus8 = 0;
  const vraiFetch8 = globalThis.fetch;
  const poserService = (rendu) => {
    globalThis.fetch = async (cible, init = {}) => {
      const adresse = String(cible);
      if (!/\/api\/avoirs\b/.test(adresse)) throw new Error(`[banc §8] appel inattendu vers ${adresse}`);
      urlsVues.push(adresse);
      const entetes = new Headers(init.headers || {});
      // ⛔ LA PORTE EST GARDÉE, ET LE FAUX LE REPRODUIT — sans ce refus, un
      //    appel qui oublierait `x-service` passerait le banc.
      if (entetes.get('x-service') !== SECRET8) {
        refus8++;
        return new Response('{"erreur":"service"}', { status: 401, headers: { 'content-type': 'application/json' } });
      }
      return rendu();
    };
  };
  const json = (o, status = 200) => () => new Response(JSON.stringify(o),
    { status, headers: { 'content-type': 'application/json' } });
  const etatDe = async () => {
    try { return await avoirsDeLaSession('sid-du-banc'); }
    catch (e) { return { etat: 'exception', message: e && e.message }; }
  };

  process.env.SESSION_API = BASE_ID;
  process.env.VEVEID_SERVICE = SECRET8;

  // ⓪ AUCUN `sid` DU TOUT — et ce n'est pas « vide », c'est « personne ».
  //   ⛔ Ce cas paraît théorique (la page n'appelle cette fonction qu'avec une
  //   session) et il ne l'est pas : c'est le SEUL endroit où l'on peut vérifier
  //   que le quatrième état ne s'aplatit pas non plus. Un mutant qui rendait
  //   `vide` sur un `sid` vide passait tous les autres contrôles.
  {
    const sansSid = await avoirsDeLaSession('');
    verifie('⓪ sans `sid`, c\'est PERSONNE — jamais une collection vide',
      sansSid?.etat === 'personne',
      sansSid?.etat === 'personne' ? '' : `🔴 état « ${sansSid?.etat} » : un état s'aplatit sur un autre`);
  }

  // ① UNE LISTE COMPLÈTE.
  poserService(json({ compte: 'c1', wallet: '0xabc', avoirs: [AVOIR], sync: { complet: 1 } }));
  let r = await etatDe();
  verifie('① une collection pleine rend une LISTE',
    r?.etat === 'liste' && r.avoirs?.length === 1 && r.partiel === false,
    r?.etat === 'liste' ? `${r.avoirs.length} avoir(s), partiel=${r.partiel}` : `🔴 état « ${r?.etat} »`);

  // ⭐⭐ ET L'ADRESSE APPELÉE PORTE `sid=`, JAMAIS `compte=`. Ce site ne DÉSIGNE
  //   pas un compte : il a un cookie, et c'est tout. L'enchaînement par
  //   l'identifiant MARCHERAIT — `/api/session` le rend — et c'est exactement
  //   pour ça qu'un banc doit le refuser : le principe protège contre CE
  //   site-là, compromis, qui parcourrait les comptes avec le secret de service.
  const derniere = urlsVues[urlsVues.length - 1] || '';
  verifie('⭐ …et elle est demandée par `?sid=`, jamais par `?compte=`',
    /[?&]sid=/.test(derniere) && !/[?&]compte=/.test(derniere),
    /[?&]compte=/.test(derniere) ? `🔴 ${derniere} — le site DÉSIGNE un compte`
      : derniere.replace(BASE_ID, ''));

  // ② UNE COLLECTION RÉELLEMENT VIDE, ET LA SYNCHRONISATION EST FINIE.
  poserService(json({ compte: 'c1', wallet: '0xabc', avoirs: [], sync: { complet: 1 } }));
  r = await etatDe();
  verifie('② une collection vide ET synchronisée rend VIDE',
    r?.etat === 'vide', `état « ${r?.etat} »`);

  // ③ 🔴🔴 LE CAS QUI COMPTE — vide PARCE QUE LA SYNCHRONISATION N'A PAS FINI.
  //   Sur le disque, ② et ③ se ressemblent exactement : `avoirs: []`. Ce sont
  //   deux verdicts opposés. Aplatir ③ sur ② est la seule vraie faute possible
  //   dans ce lot, et c'est le seul contrôle qui la voit.
  poserService(json({ compte: 'c1', wallet: '0xabc', avoirs: [], sync: { complet: 0 } }));
  r = await etatDe();
  verifie('③ ⛔ vide + synchronisation INCOMPLÈTE rend INCONNU, jamais VIDE',
    r?.etat === 'inconnu',
    r?.etat === 'inconnu' ? '' : `🔴 état « ${r?.etat} » — « aucun collectible » serait affiché à quelqu'un qui en a trois cents`);

  // ③bis Une liste NON VIDE mais incomplète reste une liste — signalée partielle.
  poserService(json({ compte: 'c1', wallet: '0xabc', avoirs: [AVOIR], sync: { complet: 0 } }));
  r = await etatDe();
  verifie('③bis une liste incomplète s\'affiche, mais se DIT partielle',
    r?.etat === 'liste' && r.partiel === true,
    r?.etat === 'liste' ? `partiel=${r.partiel}` : `🔴 état « ${r?.etat} »`);

  // ④ LE PORTEFEUILLE N'EST PAS PROUVÉ — veveid rend 409. Ce n'est ni une
  //   liste, ni une panne : c'est un état du parcours, et il a son propre mot.
  poserService(json({ erreur: 'wallet' }, 409));
  r = await etatDe();
  verifie('④ un portefeuille non prouvé rend NON VÉRIFIÉ', r?.etat === 'nonverifie', `état « ${r?.etat} »`);

  // ⑤ UN `sid` INCONNU OU RÉVOQUÉ — 404. veveid a RÉPONDU, et sa réponse est
  //   « non » : il n'y a personne. Ce n'est pas une panne.
  poserService(json({ erreur: 'session' }, 404));
  r = await etatDe();
  verifie('⑤ un sid inconnu ou révoqué rend PERSONNE', r?.etat === 'personne', `état « ${r?.etat} »`);

  // ⑤bis 🔴🔴 LE CAS QUI FAIT *SERVIR* LA BRANCHE DE REPLI, ET IL A ÉTÉ AJOUTÉ
  //   PARCE QU'UN MUTANT EST PASSÉ SANS LUI. Le contrôle ⑤ ci-dessus refuse le
  //   `sid` — mais avec un service qui refuse TOUT, un repli
  //   `parSid(sid) ?? parCompte(id)` ne se déclenche jamais : il reste vert en
  //   restant inerte. C'est mot pour mot le mutant du ZIP 1, le 12/08.
  // ⭐⭐⭐ IL FAUT DONC LES DEUX MOITIÉS DANS LE MÊME FAUX : la clé qui ÉCHOUE
  //   (`?sid=` → 404) ET l'autre qui, elle, RÉUSSIRAIT (`?compte=` → 200 avec
  //   une collection, et `/api/session` qui livre l'identifiant pour y arriver).
  //   Le code juste doit alors rendre `personne` ET n'avoir demandé aucun
  //   `compte=` : c'est le refus de DÉSIGNER un compte, exercé au lieu d'être
  //   affirmé. Un code qui se replierait rendrait `liste`, et se trahirait.
  urlsVues = [];
  globalThis.fetch = async (cible, init = {}) => {
    const adresse = String(cible);
    urlsVues.push(adresse);
    const entetes = new Headers(init.headers || {});
    if (entetes.get('x-service') !== SECRET8) {
      refus8++;
      return new Response('{"erreur":"service"}', { status: 401, headers: { 'content-type': 'application/json' } });
    }
    const u = new URL(adresse, BASE_ID);
    // La porte de session MARCHE : elle rend l'identifiant du compte, donc le
    // repli serait techniquement possible. C'est tout l'intérêt du cas.
    if (u.pathname === '/api/session') {
      return new Response(JSON.stringify({ compte: 'c1', supprime: false }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    }
    // La demande par `sid` ÉCHOUE…
    if (u.searchParams.has('sid')) {
      return new Response('{"erreur":"session"}', { status: 404, headers: { 'content-type': 'application/json' } });
    }
    // …et celle par `compte` RÉUSSIRAIT. Y arriver serait la faute.
    return new Response(JSON.stringify({ compte: 'c1', wallet: '0xabc', avoirs: [AVOIR], sync: { complet: 1 } }),
      { status: 200, headers: { 'content-type': 'application/json' } });
  };
  r = await etatDe();
  const aDesigne = urlsVues.filter((u) => /[?&]compte=/.test(u));
  verifie('⑤bis ⛔ le `sid` refusé ne se replie PAS sur `?compte=`, même si ce repli marcherait',
    r?.etat === 'personne' && aDesigne.length === 0,
    aDesigne.length ? `🔴 ${aDesigne.length} demande(s) par compte : ${aDesigne[0].replace(BASE_ID, '')} — le site a DÉSIGNÉ un compte`
      : r?.etat === 'personne' ? `état « personne », ${urlsVues.length} appel(s), aucun par compte`
        : `🔴 état « ${r?.etat} » : la collection est arrivée par un autre chemin que le sid`);

  // ⑥ veveid RÉPOND MAL — 500. On ne sait pas.
  poserService(json({ erreur: 'boum' }, 500));
  r = await etatDe();
  verifie('⑥ veveid en erreur rend INCONNU', r?.etat === 'inconnu', `état « ${r?.etat} »`);

  // ⑦ veveid NE RÉPOND PAS DU TOUT — réseau coupé, délai dépassé.
  globalThis.fetch = async () => { throw new Error('réseau coupé'); };
  r = await etatDe();
  verifie('⑦ ⛔ veveid injoignable rend INCONNU, et surtout PAS une liste vide',
    r?.etat === 'inconnu',
    r?.etat === 'inconnu' ? '' : `🔴 état « ${r?.etat} » — une coupure réseau effacerait la collection à l'écran`);

  // ⑧ LE SECRET MANQUE — indécidable, pas « personne ».
  const secretGarde = process.env.VEVEID_SERVICE;
  process.env.VEVEID_SERVICE = '';
  poserService(json({ compte: 'c1', avoirs: [AVOIR], sync: { complet: 1 } }));
  r = await etatDe();
  verifie('⑧ sans secret de service, c\'est INCONNU (le site est mal configuré, pas la personne absente)',
    r?.etat === 'inconnu', `état « ${r?.etat} »`);
  process.env.VEVEID_SERVICE = secretGarde;

  // ⑨ ⭐ ET LA SIMULATION A-T-ELLE SERVI SA BRANCHE DE REFUS ? Un faux jamais
  //   refusé rend tous les contrôles ci-dessus muets, et un muet ressemble à
  //   un succès. On force le cas : secret juste côté banc, absent côté appel.
  poserService(json({ compte: 'c1', avoirs: [], sync: { complet: 1 } }));
  process.env.VEVEID_SERVICE = 'un-autre-secret-que-celui-du-service';
  r = await etatDe();
  verifie('⑨ ⭐ un secret FAUX est refusé par le service, et le refus a servi',
    refus8 > 0 && r?.etat === 'personne',
    `${refus8} refus servi(s), état « ${r?.etat} »`);
  process.env.VEVEID_SERVICE = secretGarde;

  globalThis.fetch = vraiFetch8;

  // ─── 8.b · UN ACCÈS, UN SEUL ─────────────────────────────────────────────
  // ⭐⭐⭐ La forme qui a coûté le 140-1 : trois lectures indépendantes et
  //   TOUTES JUSTES d'une même donnée, qui divergent le jour où une seule
  //   apprend une règle de plus.
  const appelantsAvoirs = fichiersSrc.filter((f) => /['"`]\/api\/avoirs/.test(sansCommentaires(lire(f))));
  verifie('⭐ aucun fichier de `src/` n\'appelle `/api/avoirs` en direct',
    appelantsAvoirs.length === 0,
    appelantsAvoirs.length === 0 ? 'tout passe par engine/lib/compte.mjs'
      : `🔴 ${appelantsAvoirs.map((f) => relative(ROOT, f)).join(' · ')} — deux lectures qui divergeront`);

  // ─── 8.c · CHAQUE ÉTAT A UN ÉMETTEUR ─────────────────────────────────────
  // ⭐⭐ « Trois sorties » ne vaut que si TROIS phrases différentes existent et
  //   sont ÉMISES. Un état calculé puis rendu par le même libellé que le voisin
  //   est un état qui n'existe pas pour la personne qui lit l'écran.
  //   ⛔ On cherche les clés dans le gabarit ET dans les cinq dictionnaires :
  //   une clé émise sans traduction sort en clé brute à l'écran.
  const CLES_VAULT = ['account.vault', 'account.vault.none', 'account.vault.unknown', 'account.vault.partial'];
  const emises = CLES_VAULT.filter((c) => comptePageCode.includes(`'${c}'`));
  verifie('les quatre libellés de la collection sont ÉMIS par la page',
    emises.length === CLES_VAULT.length,
    emises.length === CLES_VAULT.length ? CLES_VAULT.join(' · ')
      : `🔴 manquant(s) : ${CLES_VAULT.filter((c) => !emises.includes(c)).join(' · ')}`);

  const LANGUES = ['de', 'en', 'es', 'fr', 'it'];
  const trous = [];
  for (const l of LANGUES) {
    let dico = {};
    try { dico = JSON.parse(lire(join(ROOT, 'engine', 'i18n', `${l}.json`)) || '{}'); } catch { dico = {}; }
    for (const c of CLES_VAULT) if (!dico[c]) trous.push(`${l}:${c}`);
  }
  verifie('…et traduits dans les CINQ dictionnaires', trous.length === 0,
    trous.length ? `🔴 ${trous.join(' · ')}` : `${CLES_VAULT.length} clé(s) × ${LANGUES.length} langues`);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n9. le HTML servi ne porte-t-il plus de commentaire de code ?');
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ UN `<!-- -->` EST *SERVI*, UN `{/* */}` EST RETIRÉ, ET LES DEUX SE
// RESSEMBLENT DANS UN ÉDITEUR. Le gabarit de base en portait un de 564 octets,
// servi sur ~3 097 pages × 2 sites — et les cliquets du dépôt ne pouvaient pas
// le voir : ils comptent le CSS et le JS en ligne, pas le HTML.
// ⛔ ON MESURE SUR `dist/`, pas sur les sources : c'est la seule preuve que le
//    commentaire a été RETIRÉ et non déplacé.
// ⚠️ On ne compte que les commentaires VENUS DU GABARIT : un `<!--[if` ou un
//    commentaire d'outil tiers n'est pas de notre ressort. Le motif vise les
//    nôtres — ceux qui portent nos pictogrammes de note.
{
  const DIST2 = existsSync(join(ROOT, 'dist', 'client')) ? join(ROOT, 'dist', 'client') : join(ROOT, 'dist');
  if (!existsSync(DIST2)) {
    indecis('les commentaires servis', 'dist/ absent — jouer ce banc APRÈS npm run build');
  } else {
    const pages = [];
    (function balaie(d) {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) balaie(p);
        else if (e.name.endsWith('.html')) pages.push(p);
      }
    })(DIST2);
    // 🔴🔴 L'INSTRUMENT A ÉTÉ CORRIGÉ ICI AVANT LE CODE, ET IL AVAIT MENTI.
    //    Première version : `/<!--[\s\S]{0,4000}?(?:⭐|⛔|…)/`. Elle ne
    //    s'arrêtait PAS au `-->` : elle partait d'un commentaire quelconque et
    //    allait chercher un pictogramme quatre mille caractères plus loin,
    //    dans le TEXTE de la page. Verdict : « 158 pages fautives, 0 octet
    //    servi » — un rouge qui ressemblait à une découverte, et deux chiffres
    //    qui se contredisaient dans la même phrase.
    // ⭐⭐ On isole donc CHAQUE commentaire complet, et on juge son INTÉRIEUR.
    //    Le comptage d'octets et le verdict lisent alors la même chose : deux
    //    mesures qui ne peuvent plus diverger.
    const notesDe = (t) => (t.match(/<!--[\s\S]*?-->/g) || [])
      .filter((c) => /⭐|⛔|🔴|⚠️|LOT\s+\d/.test(c));
    const bavardes = pages.filter((f) => notesDe(readFileSync(f, 'utf8')).length > 0);
    // ⭐ ON COMPTE LES OCTETS, pas seulement les pages : c'est le chiffre qui
    //   dit ce que ça coûte, et c'est lui qui rendra le prochain arbitrage
    //   possible. Une page fautive sur 3 097 est une page ; 564 octets × 3 097
    //   est une décision.
    let octets = 0;
    for (const f of bavardes) {
      for (const c of notesDe(readFileSync(f, 'utf8'))) octets += Buffer.byteLength(c, 'utf8');
    }
    verifie(`⛔ aucun commentaire de code dans le HTML servi (${pages.length} pages balayées)`,
      bavardes.length === 0,
      bavardes.length
        ? `🔴 ${bavardes.length} page(s), ${octets} octets servis — ex. ${bavardes.slice(0, 3).map((f) => relative(DIST2, f)).join(' · ')} · un \`{/* */}\` est retiré, un \`<!-- -->\` ne l'est pas`
        : 'les notes du dépôt restent dans le dépôt');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n10. rien n\'est-il servi AVANT `<html>`, et le `<head>` tient-il ?');
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴 LA PANNE DU 12/08, ET ELLE EST NÉE DE LA NOTE QUI RACONTAIT LA PANNE
//    PRÉCÉDENTE. Le commentaire du gabarit CITAIT la séquence qui ferme un
//    commentaire d'expression. Le compilateur a donc fermé le commentaire au
//    milieu de la phrase, et les 528 octets suivants sont partis en TEXTE NU,
//    posés avant `<html>`. 158/158 pages construites, les deux sites.
//
// ⭐⭐⭐ ET LA CONSÉQUENCE EST BIEN PIRE QUE LES OCTETS : du texte avant `<html>`
//    fait refermer le `<head>` au navigateur SUR-LE-CHAMP. Titre, description,
//    canonical et hreflang basculent dans le `<body>` — et un canonical hors
//    du `<head>` est **ignoré** par Google. Sur les 2 368 adresses des deux
//    sitemaps. Rien n'a planté, aucun run n'a rougi.
//
// ⛔⛔ POURQUOI CE §10 NE RESSEMBLE PAS AU §9, ET C'EST TOUT LE SUJET.
//    Le §9 a été écrit LA VEILLE, exactement pour « du dépôt qui part chez le
//    visiteur » — et il était VERT pendant que la fuite passait, parce qu'il
//    cherche un `<!--`. Ici il n'y a PAS de commentaire : du texte nu. *Un
//    garde-fou taillé sur la FORME du bug précédent ne voit pas le suivant.*
//    ⇒ Le §10 ne cherche donc AUCUNE forme : il tient un INVARIANT. Une page
//    servie commence par le doctype, puis `<html`. Point. Tout ce qui s'y
//    glisse est un écart, quelle que soit la forme qu'il prendra la prochaine
//    fois.
//
// 🔴🔴 ET IL NE PASSE PAS PAR UN DOM — MESURÉ, PAS SUPPOSÉ. `linkedom` a été
//    essayé sur la page fautive réelle : il rend un `<head>` de 33 enfants,
//    `<title>` compris, là où le navigateur en rend ZÉRO. Il ne construit pas
//    l'arbre comme la spec. Un §10 bâti dessus aurait été VERT sur la panne
//    qu'il est censé attraper. On lit donc le TEXTE SERVI, qui ne ment pas.
//
// ⚠️ CE QUE CE BANC NE MESURE PAS : il lit `dist/`, donc le HTML au moment du
//    build. Il ne voit pas ce qu'un intermédiaire (Cloudflare, nginx) pourrait
//    ajouter ensuite — c'est le domaine de `test:cache` et `test:entetes`.
{
  const DIST3 = existsSync(join(ROOT, 'dist', 'client')) ? join(ROOT, 'dist', 'client') : join(ROOT, 'dist');
  if (!existsSync(DIST3)) {
    indecis('le préambule des pages servies', 'dist/ absent — jouer ce banc APRÈS npm run build');
  } else {
    const pages = [];
    (function balaie(d) {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) balaie(p); else if (e.name.endsWith('.html')) pages.push(p);
      }
    })(DIST3);

    // ── A. l'invariant : avant `<html`, il n'y a QUE le doctype ────────────
    // ⭐ On mesure aussi les OCTETS. « 158 pages » est un constat ; « 158 pages
    //   × 528 o » est une décision — et deux chiffres qui viennent de la même
    //   lecture ne peuvent pas se contredire (le §9 a payé l'inverse).
    const preambule = (t) => {
      const i = t.search(/<html[\s>]/i);
      return i < 0 ? null : t.slice(0, i);
    };
    let fautives = [], octets = 0, sansHtml = [];
    for (const f of pages) {
      const t = readFileSync(f, 'utf8');
      const pre = preambule(t);
      if (pre === null) { sansHtml.push(f); continue; }
      if (!/^\s*<!doctype html>\s*$/i.test(pre)) {
        fautives.push(f);
        octets += Buffer.byteLength(pre, 'utf8') - '<!DOCTYPE html>'.length;
      }
    }
    verifie(`⛔ rien n'est servi avant \`<html>\` (${pages.length} pages balayées)`,
      fautives.length === 0,
      fautives.length
        ? `🔴 ${fautives.length} page(s), ${octets} octets servis en trop — ex. ${fautives.slice(0, 3).map((f) => relative(DIST3, f)).join(' · ')}`
          + `\n      🔴 le navigateur referme le <head> ici : titre, canonical et hreflang basculent dans le <body>`
          + `\n      ⭐ extrait : ${JSON.stringify(preambule(readFileSync(fautives[0], 'utf8')).replace(/^\s*<!doctype html>/i, '').trim().slice(0, 120))}`
        : 'le doctype, puis <html> — rien entre les deux');

    // Une page sans `<html>` du tout n'est pas « conforme », elle est HORS SUJET :
    // on la dit INDÉCIDABLE plutôt que de la compter verte par omission.
    if (sansHtml.length) indecis(`${sansHtml.length} page(s) sans balise <html>`, sansHtml.slice(0, 3).map((f) => relative(DIST3, f)).join(' · '));

    // ── B. le `<head>` ne porte pas de texte nu ────────────────────────────
    // 🔴 SECOND MÉCANISME, PAS UNE REDITE DU A. Une prose qui fuirait ENTRE
    //    `<head>` et `</head>` referme le head tout autant, et le A ne la
    //    verrait pas. On retire les balises et le contenu légitime (`title`,
    //    `script`, `style`, `noscript`) : ce qui reste doit être du vide.
    const nuDansHead = (t) => {
      const m = t.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
      if (!m) return null;
      return m[1]
        .replace(/<(title|script|style|noscript)\b[\s\S]*?<\/\1>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]*>/g, '')
        .trim();
    };
    let bavardes = [], sansHead = [];
    for (const f of pages) {
      const r = nuDansHead(readFileSync(f, 'utf8'));
      if (r === null) { sansHead.push(f); continue; }
      if (r) bavardes.push([f, r]);
    }
    verifie('⛔ et le `<head>` ne porte aucun texte nu',
      bavardes.length === 0,
      bavardes.length
        ? `🔴 ${bavardes.length} page(s) — ex. ${relative(DIST3, bavardes[0][0])} : ${JSON.stringify(bavardes[0][1].slice(0, 100))}`
        : `${pages.length} pages, que des balises`);
    if (sansHead.length) indecis(`${sansHead.length} page(s) sans <head>`, sansHead.slice(0, 3).map((f) => relative(DIST3, f)).join(' · '));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(
  ko === 0 && indecidable === 0 ? '\n✅ membre : tout est conforme'
  : ko === 0 ? `\n⚠️  membre : conforme, mais ${indecidable} point(s) INDÉCIDABLE(S)`
  : `\n❌ membre : ${ko} écart(s)`);
process.exit(ko === 0 ? 0 : 1);
