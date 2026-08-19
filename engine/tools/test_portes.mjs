// ⚠️ VeVePreda/veve-sites — engine/tools/test_portes.mjs  (FICHIER NEUF, lot 164)
//
//     npm run test:portes
//
// ═══════════════════════════════════════════════════════════════════════════
// CE QU'IL GARDE — et ce n'est PAS « le réglage marche »
// ═══════════════════════════════════════════════════════════════════════════
// Ce lot ajoute au site un mécanisme qu'`access.mjs` interdit par écrit :
// ouvrir une porte SANS redéployer, donc sans laisser au dépôt la moindre
// trace qui rappellera de refermer. Son commentaire sur `access.demo` dit,
// mot pour mot : « le risque énoncé n'est pas “la démo est dangereuse”, c'est
// RIEN NE ME RAPPELLERA DE L'ÉTEINDRE ».
//
// ⇒ LE CONTRÔLE CENTRAL DE CE FICHIER EST LE § 1.2 : une surcharge DISPARAÎT
//   toute seule passé sa date. Un banc qui ne vérifierait que l'ouverture
//   validerait exactement le défaut que le lot existe pour éviter.
//
// ⭐⭐ IL EXÉCUTE PLUTÔT QUE DE LIRE, là où c'est possible. Le risque n'est pas
//   qu'une ligne manque : c'est qu'un objet MÉMOÏSÉ soit muté (§ 2.4), qu'une
//   base absente fasse tomber le build (§ 1.6), ou qu'un magasin voisin soit
//   abîmé (§ 1.7). Aucune lecture de source ne voit ça.
//
// ⚠️ CE QUI RESTE LU, ET POURQUOI : `/api/portes` a besoin d'une session
//   veveid réelle pour s'exécuter. Un banc qui l'exigerait ne tournerait pas
//   en CI — donc ne tournerait pas. Le § 3 lit donc ses SOURCES, et il le dit.

import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let echecs = 0;
const dit = (ok, titre, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${titre}${detail ? ` — ${detail}` : ''}`);
  if (!ok) echecs++;
};
/**
 * 🔴🔴 SANS OBJET — LE QUATRIÈME VERDICT, ET IL A ÉTÉ AJOUTÉ APRÈS UNE MESURE.
 *
 * Ce banc a d'abord ROUGI sur vevewiki, et le code était juste. Mesuré :
 * **les sept portes y sont `actif: false`** — c'est un site sans comptes, et
 * `franchit()` répond `true` à tout le monde par construction (« porte
 * inactive ⇒ tout le monde franchit »). Le contrôle « un `member` ne franchit
 * pas » n'y a donc aucun sens : il ne mesure rien, il constate un site
 * gratuit.
 * ⭐⭐⭐ *Éprouver sur un seul site, c'est ne rien éprouver* — et cette fois
 *   c'est le BANC qui n'était pas portable, pas le lot. Un banc écrit sur les
 *   suppositions d'un seul manifeste rougira sur l'autre, et on cherchera le
 *   défaut dans le code.
 * ⛔ CE N'EST PAS UN REPLI QUI MASQUE : il DIT ce qu'il n'a pas mesuré, et il
 *   ne se déclenche que sur une porte réellement inactive. Sur veveprice, où
 *   elles le sont toutes, aucun de ces contrôles ne se tait.
 */
const ditSiActive = (nomPorte, ok, titre, detail = '') => {
  if (!A.porte(nomPorte).actif) {
    console.log(`  ⏸️  SANS OBJET — ${titre} (porte « ${nomPorte} » inactive sur ce site)`);
    return;
  }
  dit(ok, titre, detail);
};
const lire = (p) => readFileSync(join(RACINE, p), 'utf8');
// ⭐ MÊME DÉPOUILLEMENT QUE `test_prefs.mjs` : sans lui, un contrôle mord sur
//   une phrase explicative et rend vert un code absent. Payé au lot 155-C③.
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const dossier = mkdtempSync(join(tmpdir(), 'veve-portes-'));
process.env.DB_PATH = join(dossier, 'essai.db');

const S = await import('../lib/portes_surcharge.mjs');
const A = await import('../lib/access.mjs');
// ⭐ Ce que le manifeste DE CE SITE dit des portes. Sur vevewiki elles sont
//   toutes inactives (site sans comptes) : plusieurs contrôles y sont SANS
//   OBJET, et ils le disent au lieu de rougir.
const SITE_A_DES_PORTES = A.porte('modules').actif;

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n1. Le magasin — sur une vraie base SQLite');
// ═══════════════════════════════════════════════════════════════════════════
S.poserSurcharge('modules', 'member', 7);
dit(S.lireSurcharges().modules === 'member', '1.1 une surcharge posée se relit');

// 🔴🔴🔴 LE CONTRÔLE CENTRAL DU LOT.
S._reinitialiser();
const dans8j = Date.now() + 8 * 86_400_000;
dit(Object.keys(S.lireSurcharges(dans8j)).length === 0,
  '🔴 1.2 ELLE SE REFERME SEULE passé sa date',
  'c’est la SEULE chose qui rend acceptable un réglage qu’aucune trace ne rappelle d’éteindre');

S._reinitialiser();
S.poserSurcharge('modules', 'member', 0);
dit(S.lireSurcharges().modules === undefined, '1.3 `jours = 0` retire la surcharge');

let leve = false;
try { S.poserSurcharge('modules', 'member', S.JOURS_MAX + 1); } catch { leve = true; }
dit(leve, '1.4 au-delà de JOURS_MAX, l’écriture LÈVE',
  `plafond ${S.JOURS_MAX} j — un abonnement va à 400, mais il n’ouvre qu’à UNE personne`);
dit(S.JOURS_MAX <= 30, '1.4b et le plafond est court',
  'une surcharge ouvre à TOUT LE MONDE sur un site public : pas la même borne qu’un abonnement');

leve = false;
try { S.poserSurcharge('modules', 'member', 1.5); } catch { leve = true; }
dit(leve, '1.5 une durée non entière est refusée');

// ⭐ LE CAS DU BUILD, ET IL EST STRUCTUREL : `/data` n'existe pas dans le
//   conteneur de build. Si cette fonction levait, elle ferait tomber les
//   ~3 000 pages pré-générées — pour un réglage d'exploitation.
S._reinitialiser();
const vraiChemin = process.env.DB_PATH;
process.env.DB_PATH = '/ce/chemin/nexiste/pas/x.db';
let sansBase = null;
try { sansBase = S.lireSurcharges(); } catch { sansBase = 'A LEVÉ'; }
dit(JSON.stringify(sansBase) === '{}',
  '🔴 1.6 base absente ⇒ `{}`, et SURTOUT pas d’exception',
  'c’est le cas du build ; une exception ici ferait tomber tout le site');
process.env.DB_PATH = vraiChemin;
S._reinitialiser();

// ⭐ TROIS MAGASINS PARTAGENT UN FICHIER. `favoris.mjs` sert en production :
//   ce lot ne doit pas pouvoir l'abîmer. Aucune lecture de source ne le voit.
const P = await import('../lib/prefs.mjs');
P.poserPref('compte-de-banc', 'langue', 'fr');
S.poserSurcharge('cote', 'whale', 3);
dit(P.lirePref('compte-de-banc', 'langue') === 'fr',
  '1.7 le magasin des préférences survit au voisinage',
  'les deux ouvrent le MÊME fichier ; c’est le risque que la lecture de source ne voit pas');
S.poserSurcharge('cote', 'whale', 0);

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n2. `porte()` applique — et c’est le point unique');
// ═══════════════════════════════════════════════════════════════════════════
S._reinitialiser();
const tierDOrigine = A.porte('modules').tier;
// ⛔ ON NE CODE PAS « crevette » EN DUR : les deux sites n'ont pas le même
//   manifeste, et un banc qui suppose l'un rougit sur l'autre. On vérifie la
//   RELATION (le palier vient du manifeste), pas la valeur.
dit(typeof tierDOrigine === 'string' && tierDOrigine.length > 0,
  '2.1 sans surcharge, `porte()` rend le palier du manifeste',
  `modules = ${tierDOrigine}`);
ditSiActive('modules', A.franchit('modules', { palier: 'member' }) === false,
  '2.1b et un `member` ne franchit pas');

S.poserSurcharge('modules', 'member', 7); S._reinitialiser();
dit(A.porte('modules').tier === 'member' && A.porte('modules').surcharge === true,
  '2.2 avec surcharge, `porte()` rend le nouveau palier');
ditSiActive('modules', A.franchit('modules', { palier: 'member' }) === true,
  '🔴 2.2b et `franchit()` suit — la décision ET l’affichage descendent du même point');

// ⭐⭐ ET LE CONTRÔLE QUE SEUL vevewiki REND VISIBLE : une surcharge ne doit
//   pas RÉVEILLER une porte que le manifeste a éteinte. `franchit()` court-
//   circuite sur `!actif` — mais si un jour quelqu'un déplace ce test, un site
//   gratuit se retrouverait avec des portes fermées que personne n'a demandées.
// 🔴🔴 CE CONTRÔLE A DÛ ÊTRE RÉÉCRIT : ma première version portait un
//   `|| true` qui le rendait VRAI quoi qu'il arrive. Un terme à zéro
//   inatteignable est un contrôle qui ne garde rien — et il se lit « vert »
//   comme les autres. ⭐ *On mesure ce qui pourrait être faux, sinon on ne
//   mesure rien.* Ici : `actif` est identique AVANT et APRÈS la surcharge.
dit(A.porte('modules').actif === SITE_A_DES_PORTES,
  '🔴 2.2c la surcharge ne change JAMAIS `actif`',
  `actif = ${A.porte('modules').actif} avant comme après — elle ne touche que le palier`);

S.poserSurcharge('cote', 'kraken-inconnu', 7); S._reinitialiser();
dit(A.porte('cote').tier !== 'kraken-inconnu',
  '2.3 un palier INCONNU est ignoré — la surcharge ne peut pas inventer un grade');
S.poserSurcharge('cote', 'kraken-inconnu', 0);

// 🔴🔴🔴 `acces()` MÉMOÏSE POUR TOUT LE PROCESSUS. Muter son objet rendrait la
//   surcharge PERMANENTE jusqu'au redémarrage — le contraire exact de la date
//   de fin. C'est le défaut le plus discret du lot : il ne se voit qu'APRÈS
//   le retrait, et seulement sur un processus qui a vécu.
S.poserSurcharge('modules', 'member', 0); S._reinitialiser();
dit(A.porte('modules').tier === tierDOrigine,
  '🔴 2.4 le retrait rend son palier d’origine — l’objet mémoïsé n’a PAS été muté',
  'une mutation rendrait la surcharge permanente : plus aucune date ne la refermerait');

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n3. Le circuit — ce que les sources doivent porter');
// ═══════════════════════════════════════════════════════════════════════════
const routes = sansCommentaires(lire('engine/lib/astro_routes_compte.mjs'));
dit(/'pages\/api\/portes\.js'/.test(routes),
  '3.1 la route est déclarée dans ROUTES_COMPTE',
  'pré-générée, elle ne pourrait ni lire la session ni écrire dans /data');

const api = sansCommentaires(lire('src/pages/api/portes.js'));
dit(/export async function POST/.test(api) && !/export async function GET/.test(api),
  '3.2 le geste est un POST',
  'un GET qui écrit s’exécute depuis n’importe quel site par une balise <img>');
// 🔴 LE PIÈGE MESURÉ : `Number('')` vaut 0, et 0 signifie « retirer ».
dit(/test\(brut\)/.test(api) && /:\s*-1/.test(api),
  '🔴 3.3 la FORME du champ `jours` est validée AVANT la conversion',
  'sinon un champ vide retire la surcharge en rendant un succès — `Number("")` vaut 0');
dit(/ADMIN_COMPTES/.test(api) && /length === 0/.test(api),
  '3.4 une liste d’administrateurs VIDE ferme la porte',
  'la liste blanche vide qui ouvre à tous est silencieuse');
dit(/x-service/.test(api) && /sid/.test(api),
  '3.5 l’identité est demandée à veveid avec le `sid`, jamais avec une adresse');
dit(/PORTES_CONNUES/.test(api) && /PALIERS/.test(api),
  '3.6 la porte et le palier sont validés côté serveur',
  'le magasin ne les connaît pas — il n’importe pas access.mjs, ce serait un cycle');

const page = sansCommentaires(lire('src/pages/compte/index.astro'));
// 🔴🔴🔴 CE CONTRÔLE A ÉTÉ RENFORCÉ APRÈS UNE INJECTION MUETTE. Sa première
//   version cherchait `estAdmin` ET `ADMIN_COMPTES` dans le fichier — deux
//   chaînes qui survivent très bien à un `estAdmin = … && true`. Elle
//   vérifiait que la variable est CITÉE, pas qu'elle DÉCIDE.
//   ⭐⭐ *Un contrôle branché sur la présence d'un nom ne voit pas le jour où
//   ce nom cesse de servir.* ⇒ on exige les deux usages qui font la décision :
//   la liste doit être non vide, ET l'adresse doit y être.
dit(/_admins\.length > 0/.test(page) && /_admins\.includes\(/.test(page),
  '🔴 3.7 le bloc n’est rendu qu’à un administrateur déclaré',
  'liste vide ⇒ personne, et l’adresse doit y figurer');
dit(/action="\/api\/portes"/.test(page),
  '3.8 le formulaire poste vers la route, il n’écrit pas lui-même',
  'aucune page .astro de ce dépôt ne traite de POST — on copie le patron d’/api/supprimer');
dit(/wallet_watch/.test(page) && /adresses/.test(page),
  '🔴 3.9 l’avertissement sur `wallet_watch` est ÉCRIT sur la page',
  'dans six mois personne ne se souviendra que cette porte porte des adresses de portefeuille');

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n4. Auto-contrôle — ce banc avait-il quelque chose à inspecter ?');
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ Un verdict rendu sur du vide est vert. On nomme des ancres INDÉPENDANTES
//   de ce que ce lot a écrit : si elles manquent, c'est le CHEMIN qui est faux.
dit(api.length > 800 && page.length > 5000, '4.1 les deux sources ont bien été lues',
  `${api.length} et ${page.length} o après dépouillement`);
dit(/vp_session/.test(page), '4.2 l’ancre `vp_session` est bien dans /compte/',
  'elle précède ce lot');
dit(page.length < lire('src/pages/compte/index.astro').length * 0.85,
  '🔑 4.3 le dépouillement des commentaires fonctionne',
  'sinon le § 3 jugerait des phrases explicatives au lieu du code');
dit([...A.PORTES_CONNUES].length === 7, '4.4 les sept portes sont bien exportées',
  `${[...A.PORTES_CONNUES].length} portes`);

rmSync(dossier, { recursive: true, force: true });
console.log(echecs === 0
  ? '\n✅ portes : tout est vert (la surcharge s’applique, et elle se referme seule)\n'
  : `\n❌ portes : ${echecs} contrôle(s) en échec\n`);
process.exit(echecs === 0 ? 0 : 1);
