// ⚠️ VeVePreda/veve-sites — engine/tools/test_demo.mjs  (BANC NEUF — lot 42)
// ═══════════════════════════════════════════════════════════════════════════
//     SITE=veveprice npm run test:demo     ·     SITE=vevewiki npm run test:demo
// ═══════════════════════════════════════════════════════════════════════════
// CE QU'IL GARDE : la session de démonstration nominative ne doit jamais
// devenir un moyen d'obtenir un abonnement sans le payer.
//
// ⭐ CE BANC SE JUGE SUR CE QU'IL LAISSE PASSER, pas sur ce qu'il refuse.
// Ses lignes les plus importantes sont donc les FALSIFICATIONS : un jeton dont
// on remplace la charge, un cookie tapé à la main, un jeton d'une autre clé, un
// jeton périmé. S'il devenait vert en laissant passer l'un des quatre, il
// vaudrait moins que rien — il rassurerait.
//
// ⭐ ET IL DIT SA COUVERTURE. Il vérifie la CRYPTOGRAPHIE du jeton et les
// conditions d'existence de la porte. Il ne vérifie PAS le service HTTP servi
// par `/api/demo` : ça demande un serveur en marche, et c'est la vérification
// manuelle du lot. La fraction non couverte s'écrit, elle ne se tait pas.

import { PALIERS } from '../lib/access.mjs';
import {
  COOKIE_DEMO, DUREE_S, demoDisponible, raisonIndisponible, emettre, lire, optionsCookie,
} from '../lib/demo_session.mjs';

let vert = 0; let rouge = 0; let inspecte = 0;
const dit = (c, quoi, detail = '') => {
  inspecte++;
  console.log(`  ${c ? 'OK  ' : '🔴 KO'} ${quoi}${detail ? ` — ${detail}` : ''}`);
  c ? vert++ : rouge++;
};

const CLE = 'une-cle-de-demonstration-assez-longue';
const env = { DEMO_CLE: CLE, SESSION_API: '' };

console.log('\nLa session de demonstration — jeton signe, porte conditionnelle\n');

console.log('1. Les conditions d\'EXISTENCE de la porte');
dit(demoDisponible(env) === true, 'avec une cle de 16 caracteres ou plus, la demo existe');
dit(demoDisponible({ DEMO_CLE: '', SESSION_API: '' }) === false,
    '⛔ sans DEMO_CLE la fonction est ABSENTE', 'pas de valeur par defaut, jamais');
dit(demoDisponible({ DEMO_CLE: 'trop-court', SESSION_API: '' }) === false,
    'une cle de 10 caracteres est refusee', 'une cle courte est une cle absente qui se croit presente');
dit(demoDisponible({ DEMO_CLE: CLE, SESSION_API: 'https://id.example/api' }) === false,
    '🔴 avec SESSION_API la demo s\'EFFACE', 'sinon une panne reseau distribuerait l\'abonnement');
dit(typeof raisonIndisponible({ DEMO_CLE: '', SESSION_API: '' }) === 'string',
    'le refus DIT sa raison', 'un refus muet se debogue a l\'aveugle');
dit(raisonIndisponible(env) === null, 'et se tait quand tout va bien');

console.log('\n2. Le jeton, quand il est honnete');
const jeton = emettre('crevette', env);
dit(typeof jeton === 'string' && jeton.split('.').length === 2, 'un jeton est emis en deux parties');
dit(lire(jeton, env) === 'crevette', 'et il se relit', 'crevette');
for (const p of PALIERS) {
  const j = emettre(p, env);
  if (lire(j, env) !== p) { dit(false, `aller-retour du palier « ${p} »`); break; }
}
dit(PALIERS.every((p) => lire(emettre(p, env), env) === p),
    `aller-retour sur les ${PALIERS.length} paliers declares`, PALIERS.join(' '));
dit(emettre('empereur', env) === null, 'un palier hors PALIERS n\'est JAMAIS emis');

console.log('\n3. ⭐ LES FALSIFICATIONS — les lignes qui comptent vraiment');
const [charge, sig] = jeton.split('.');
const chargeWhale = Buffer.from(`whale.${Math.floor(Date.now() / 1000) + 99999}`, 'utf8').toString('base64url');
dit(lire(`${chargeWhale}.${sig}`, env) === null,
    '🔴 charge remplacee par « whale », signature d\'origine : REFUSE');
dit(lire(`${charge}.zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz`, env) === null,
    'signature inventee : refusee');
dit(lire('whale', env) === null, 'cookie « whale » tape a la main dans la console : refuse');
dit(lire(`${chargeWhale}.`, env) === null, 'jeton sans signature : refuse');
dit(lire(jeton, { DEMO_CLE: 'une-AUTRE-cle-tout-aussi-longue', SESSION_API: '' }) === null,
    'jeton signe avec une autre cle : refuse');
dit(lire(null, env) === null && lire('', env) === null && lire({}, env) === null,
    'null, chaine vide et objet : refuses sans lever d\'exception');

console.log('\n4. L\'expiration — une porte sans fin est une porte qu\'on oubliera');
const perime = emettre('whale', env, Date.now() - (DUREE_S + 60) * 1000);
dit(lire(perime, env) === null, `🔴 jeton emis il y a plus de ${DUREE_S / 86400} jours : refuse`);
const presque = emettre('whale', env, Date.now() - (DUREE_S - 300) * 1000);
dit(lire(presque, env) === 'whale', 'jeton encore dans sa fenetre : accepte');

console.log('\n5. Le cookie lui-meme');
const o = optionsCookie(true);
dit(o.httpOnly === true, 'HttpOnly', 'ce qu\'un script ne peut pas lire, une injection ne peut pas voler');
dit(o.sameSite === 'lax', 'SameSite=Lax', 'un site tiers ne declenche pas la demo');
dit(o.secure === true && optionsCookie(false).secure === false, 'Secure suit le protocole');
dit(COOKIE_DEMO !== 'vp_session',
    'le cookie de demo ne porte PAS le nom du cookie de session', `${COOKIE_DEMO} ≠ vp_session`);

console.log('\n6. Auto-controle — ce banc sait-il echouer, et sait-il se taire ?');
// ⭐ Sans ces deux lignes, toutes celles du dessus pourraient etre vraies pour
// de mauvaises raisons : un `lire()` qui rendrait TOUJOURS null passerait
// triomphalement la section 3 en entier.
dit(lire(emettre('whale', env), env) !== null,
    'le detecteur sait dire OUI', 'sinon la section 3 serait verte a vide');
dit(lire('n.importe.quoi', env) === null, 'le detecteur sait dire NON');

// ⭐ rc=2 S'IL N'A RIEN INSPECTE. Un banc qui n'a rien vu n'a rien prouve, et
// son vert est le plus cher de tous.
if (inspecte === 0) {
  console.error('\n🔴 ce banc n\'a inspecte AUCUN cas : resultat invalide.');
  process.exit(2);
}

console.log(`\n  couverture : la cryptographie du jeton et les conditions de la porte.`);
console.log(`  ⚠️ NON couvert : le service HTTP de /api/demo (demande un serveur en marche),`);
console.log(`     et l'effet du palier sur les pages — il n'y en a AUCUN sur les pages`);
console.log(`     pre-generees, par construction. Verification manuelle du lot 42.`);
console.log(rouge === 0
  ? `\n✅ session de demonstration : ${vert}/${inspecte} controles passes.\n`
  : `\n🔴 ${rouge} controle(s) en echec sur ${inspecte}.\n`);
process.exit(rouge === 0 ? 0 : 1);
