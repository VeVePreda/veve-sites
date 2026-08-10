// ⚠️ VeVePreda/veve-sites — engine/tools/test_membre.mjs  (NEUF — lot 126)
// ═══════════════════════════════════════════════════════════════════════════
// 🧭 LE BANC DU PARCOURS MEMBRE — quatre pannes, toutes déjà payées ailleurs
// ═══════════════════════════════════════════════════════════════════════════
//  §1  `retourSur()` n'accepte QUE la liste blanche — et refuse les tremplins.
//  §2  Tout `?suite=` écrit a un LECTEUR.        ← la panne du lot 126
//  §3  `/dashboard/` est dans les TROIS endroits. ← la panne du lot 119
//  §4  Aucun `<button>` dans un `<a>` dans dist/. ← le piège de `.carte`
//  §5  Le cœur est ÉMIS sur les cartes.           ← une règle CSS sans émetteur
//
// ⚠️ IL N'IMPORTE PAS `dataset.mjs` : il lit du texte et du `dist/`, rien de
// plus. Il peut donc se placer après le build sans vider la réserve
// (règle payée deux fois, et une troisième au lot 125).

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

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
console.log(
  ko === 0 && indecidable === 0 ? '\n✅ membre : tout est conforme'
  : ko === 0 ? `\n⚠️  membre : conforme, mais ${indecidable} point(s) INDÉCIDABLE(S)`
  : `\n❌ membre : ${ko} écart(s)`);
process.exit(ko === 0 ? 0 : 1);
