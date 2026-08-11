// ⚠️ VeVePreda/veve-sites — engine/tools/_contre_epreuve_cache.mjs  (FICHIER NEUF)
// ═══════════════════════════════════════════════════════════════════════════
//  LA CONTRE-ÉPREUVE DU BANC DU CACHE — onze pannes fabriquées
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 UN BANC SE JUGE SUR CE QU'IL LAISSE PASSER, PAS SUR CE QU'IL AFFICHE.
// `test:cache` garde la fuite la plus chère du réseau. Le déclarer « écrit »
// parce qu'il rend un ✅ sur une production saine ne prouve RIEN : il rendrait
// exactement le même ✅ s'il ne regardait rien du tout. La seule preuve est de
// FABRIQUER chaque panne et de le voir rougir dessus — et rougir pour LA BONNE
// RAISON, ce que ce fichier vérifie en lisant le texte de sa sortie.
//
// ⛔⛔ ON NE FABRIQUE PAS LA PANNE SUR LA PRODUCTION. Prouver que le banc voit
// une page de compte mise en cache exigerait de vraiment mettre une page de
// compte en cache — c'est-à-dire de commettre la fuite pour vérifier qu'on sait
// la détecter. ⇒ Un serveur local joue les deux zones ; le banc y est détourné
// par `BANC_CACHE_BASE`.
//
// ⭐⭐⭐ LE CAS « TOUT CONFORME » EST LE PLUS IMPORTANT DES ONZE. Un banc qui
// rougit sur tout est aussi inutile qu'un banc qui verdit sur tout. Au lot 135B,
// c'est précisément ce cas-là qui a échoué en premier — et le fautif était le
// HARNAIS, pas le banc. *Un défaut d'instrument se déguise en résultat de mesure.*
//
// ⛔⛔ ET ON N'UTILISE PAS `execFileSync`. Au lot 135B, il a gelé la boucle
// d'événements : le serveur de test ne répondait plus pendant que le banc
// l'interrogeait, et le banc concluait « réseau muet ». Deux heures pour trouver
// que l'instrument mesurait son propre blocage. ⇒ `spawn`, et on attend une
// promesse.
//
// Usage :  node engine/tools/_contre_epreuve_cache.mjs

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const BANC = join(ICI, 'test_cache.mjs');
const PORT = 8788;

// Le scénario courant — lu par le serveur à chaque requête.
let SCENARIO = 'sain';

const maintenant = () => new Date().toISOString();

// 🔴🔴 CE FIGEAGE EST UN DÉFAUT D'INSTRUMENT CORRIGÉ, ET IL VAUT D'ÊTRE ÉCRIT.
// Première version : la page portait `new Date().toISOString()` calculé À CHAQUE
// REQUÊTE. Deux frappes successives rendaient donc deux HTML différents, et le
// banc déclarait — à raison ! — « cette page PERSONNALISE son contenu ».
// ⭐⭐ LE BANC AVAIT RAISON, MON SERVEUR AVAIT TORT. C'est la quatrième fois dans
//   ce projet qu'un défaut d'instrument se déguise en résultat de mesure, et la
//   deuxième fois de suite que le fautif est le HARNAIS censé prouver le banc.
// ⭐ Ce qui l'a désigné en un regard : « 155 vs 155 caractère(s) ». Même
//   longueur, contenu différent — un contenu vraiment personnalisé n'a presque
//   jamais exactement la même taille. *L'indice était dans le message du banc.*
// ⇒ Une page pré-générée est un FICHIER : son horodatage est figé au build. Le
//   serveur de test doit se comporter comme la production, pas comme une page
//   calculée à la demande — sinon il fabrique une condition qui n'existe pas.
const BUILD_FIGE = maintenant();

// ═══════════════════════════════════════════════════════════════════════════
// LE SERVEUR QUI JOUE LES DEUX ZONES
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐ Il répond sur `/<zone>/<chemin>` — le banc préfixe ses adresses par le nom
//   de la zone quand il est détourné. Un seul processus, deux zones : c'est
//   exactement la faute qu'avait faite le harnais des en-têtes, qui n'en
//   déclarait qu'une quand le banc en exigeait deux.

const PRIVEES_SERVEUR = new Set([
  '/compte/', '/market/', '/favoris/', '/dashboard/', '/connexion/', '/inscription/',
]);
const PUBLIQUES_SERVEUR = new Set(['/', '/sets/', '/collections/', '/brands/']);

function page(build, personnalise = false) {
  return '<!doctype html><html><head>' +
    `<meta name="build-time" content="${build}" />` +
    `<title>banc</title></head><body><h1>page de banc</h1>${
      personnalise ? '<p>Bonjour Preda</p>' : ''}</body></html>`;
}

const serveur = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const bouts = u.pathname.split('/').filter(Boolean);
  const zone = bouts.shift() || '';
  // ⭐ Le serveur retire un éventuel préfixe de langue avant de classer la route,
  //   exactement comme le fait le routeur d'Astro pour `pages/[locale]/…`.
  //   ⛔ Sans ça, `/fr/market/` tomberait dans le 404 final et le banc
  //   déclarerait INDÉCIDABLE une route qui existe : on aurait fabriqué une
  //   condition que la production ne contient pas.
  const langues = ['fr', 'es', 'de', 'en'];
  if (langues.includes(bouts[0])) bouts.shift();
  const chemin = '/' + bouts.join('/') + (bouts.length ? '/' : '');
  const cheminApi = '/' + bouts.join('/'); // les routes d'API n'ont pas de / final
  const aSession = /vp_session=/.test(req.headers.cookie || '');
  const build = BUILD_FIGE;

  const rendre = (code, entetes, corps = '') => {
    res.writeHead(code, { 'cf-cache-status': 'DYNAMIC', ...entetes });
    res.end(corps);
  };

  // ── la sonde ────────────────────────────────────────────────────────────
  if (cheminApi === '/api/sante') {
    if (SCENARIO === 'sonde-sans-build') {
      return rendre(200, { 'content-type': 'application/json', 'cache-control': 'no-store' },
        JSON.stringify({ ok: true, mode: 'server', site: zone }));
    }
    // ⭐ « build périmé » : la sonde annonce MAINTENANT pendant que la page
    //   servie porte un horodatage d'il y a deux heures — le profil exact d'un
    //   bord qui sert une version que l'origine a remplacée.
    return rendre(200, { 'content-type': 'application/json', 'cache-control': 'no-store' },
      JSON.stringify({ ok: true, mode: 'server', site: zone, build, commit: 'abc12345' }));
  }
  if (cheminApi === '/api/deconnexion') {
    // ⚠️ Reproduit le trou réel mesuré le 11/08 : 405, AUCUN `cache-control`.
    return rendre(405, {
      'content-type': 'text/plain',
      ...(SCENARIO === 'deconnexion-en-hit' ? { 'cf-cache-status': 'HIT' } : {}),
    }, 'Method Not Allowed');
  }

  // ── les routes privées ──────────────────────────────────────────────────
  if (PRIVEES_SERVEUR.has(chemin)) {
    // Sur la zone sans espace membre, elles n'existent pas…
    if (zone !== 'veveprice.com') {
      if (SCENARIO === 'wiki-a-un-compte') {
        return rendre(200, { 'content-type': 'text/html', 'cache-control': 'private, no-store' },
          page(build));
      }
      return rendre(404, { 'content-type': 'text/html' }, 'introuvable');
    }
    if (SCENARIO === 'compte-en-hit' && chemin === '/compte/') {
      return rendre(302, {
        location: '/connexion/', 'cache-control': 'private, no-store', 'cf-cache-status': 'HIT',
      });
    }
    if (SCENARIO === 'market-sans-nostore' && chemin === '/market/') {
      return rendre(302, {
        location: '/connexion/', 'cache-control': 'public, max-age=0, must-revalidate',
      });
    }
    const rend200 = chemin === '/connexion/' || chemin === '/inscription/';
    return rend200
      ? rendre(200, { 'content-type': 'text/html', 'cache-control': 'private, no-store' }, page(build))
      : rendre(302, { location: '/connexion/', 'cache-control': 'private, no-store' });
  }

  // ── les pages publiques ─────────────────────────────────────────────────
  if (PUBLIQUES_SERVEUR.has(chemin)) {
    const entetes = {
      'content-type': 'text/html',
      'cache-control': 'public, max-age=0, must-revalidate',
      vary: SCENARIO === 'publique-vary-cookie' ? 'Accept-Encoding, Cookie' : 'Accept-Encoding',
    };
    if (SCENARIO === 'publique-set-cookie') entetes['set-cookie'] = 'ab=1; Path=/';
    // ⭐ « build périmé » : la page porte un horodatage de deux heures d'âge.
    const horodatage = SCENARIO === 'build-perime'
      ? new Date(Date.now() - 2 * 3600 * 1000).toISOString()
      : build;
    const perso = SCENARIO === 'publique-personnalisee' && aSession;
    return rendre(200, entetes, page(horodatage, perso));
  }

  return rendre(404, { 'content-type': 'text/html' }, 'introuvable');
});

// ═══════════════════════════════════════════════════════════════════════════
// LE LANCEUR — `spawn`, jamais `execFileSync`
// ═══════════════════════════════════════════════════════════════════════════
function joueLeBanc(base) {
  return new Promise((resoudre) => {
    const enfant = spawn(process.execPath, [BANC], {
      env: { ...process.env, BANC_CACHE_BASE: base },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let sortie = '';
    enfant.stdout.on('data', (d) => { sortie += d; });
    enfant.stderr.on('data', (d) => { sortie += d; });
    enfant.on('close', (code) => resoudre({ code, sortie }));
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// LES ONZE CAS
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐ `motif` est ce qui distingue « il a rougi » de « il a rougi POUR LA BONNE
//   RAISON ». Sans lui, un banc cassé qui échoue toujours passerait dix cas sur
//   onze — et on aurait mesuré sa panne au lieu de sa vigilance.
const CAS = [
  {
    nom: 'tout conforme',
    scenario: 'sain', code: 0, motif: 'tout est vert',
    pourquoi: '⭐⭐⭐ LE PLUS IMPORTANT DES ONZE — un banc qui rougit sur tout ne ' +
      'garde rien. C\'est ce cas qui a échoué en premier au lot 135B, et le fautif ' +
      'était le harnais.',
  },
  {
    nom: 'une page de COMPTE servie depuis le bord',
    scenario: 'compte-en-hit', code: 1, motif: 'servis DEPUIS LE BORD',
    pourquoi: '🔴🔴 LA FUITE QUE CE BANC EXISTE POUR RENDRE IMPOSSIBLE.',
  },
  {
    nom: 'une route privée qui ne refuse plus le stockage',
    scenario: 'market-sans-nostore', code: 1, motif: 'refuse elle-même le stockage',
    pourquoi: 'Elle délègue sa confidentialité à un réglage qui vit ailleurs.',
  },
  {
    nom: 'la déconnexion servie depuis le bord',
    scenario: 'deconnexion-en-hit', code: 1, motif: 'servis DEPUIS LE BORD',
    pourquoi: '⭐ Le trou connu (405 sans `cache-control`) reste gardé par le ' +
      '« jamais HIT » — c\'est tout l\'intérêt d\'écrire le trou plutôt que de l\'arrondir.',
  },
  {
    nom: 'une page publique qui PERSONNALISE son contenu',
    scenario: 'publique-personnalisee', code: 1, motif: 'identique avec et sans session',
    pourquoi: '⭐⭐ La vraie fuite de demain : pas le cache, mais le lot qui ajoutera ' +
      'un « Bonjour Preda » dans un en-tête public six mois après la Cache Rule.',
  },
  {
    nom: 'un `Set-Cookie` sur une page publique',
    scenario: 'publique-set-cookie', code: 1, motif: 'aucun `Set-Cookie`',
    pourquoi: 'Il serait servi au visiteur suivant.',
  },
  {
    nom: 'un `vary: Cookie` sur une page publique',
    scenario: 'publique-vary-cookie', code: 1, motif: '`vary` sans surprise',
    pourquoi: 'Il fait exploser le nombre de variantes, ou fait servir la mauvaise.',
  },
  {
    nom: 'un espace membre apparaît sur vevewiki',
    scenario: 'wiki-a-un-compte', code: 1, motif: "n'existe pas",
    pourquoi: '⭐⭐ Le contrôle INVERSE : un banc qui ne regarde que ce qui existe ' +
      'ne voit jamais ce qui APPARAÎT.',
  },
  {
    nom: 'la sonde ne porte pas encore `build`',
    scenario: 'sonde-sans-build', code: 0, motif: 'ne porte pas encore `build`',
    pourquoi: '⛔ INCONNU ≠ ZÉRO. Ce n\'est pas un écart — le lot peut ne pas être ' +
      'déployé. Le banc doit le DIRE sans rougir, et ne surtout pas conclure « frais ».',
  },
  {
    nom: 'le bord sert une version périmée de deux heures',
    scenario: 'build-perime', code: 1, motif: 'parlent du même build',
    pourquoi: '🔴 P35 sous sa forme neuve : le déploiement réussit et n\'atteint ' +
      'personne.',
  },
  {
    nom: 'réseau muet',
    scenario: 'sain', muet: true, code: 2, motif: 'INDÉCIDABLE',
    pourquoi: '⛔ Un banc qui se déclare vert sans avoir rien mesuré transforme une ' +
      'absence de mesure en preuve de conformité.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// LA BOUCLE
// ═══════════════════════════════════════════════════════════════════════════
await new Promise((r) => serveur.listen(PORT, '127.0.0.1', r));
console.log(`\n═══ CONTRE-ÉPREUVE DU BANC DU CACHE — ${CAS.length} pannes fabriquées ═══`);
console.log(`    serveur de test sur http://127.0.0.1:${PORT}\n`);

let rates = 0;

for (const cas of CAS) {
  SCENARIO = cas.scenario;
  // ⭐ Le cas « muet » pointe vers un port où PERSONNE n'écoute. C'est la seule
  //   façon honnête de fabriquer un réseau absent sans couper le vrai.
  const base = cas.muet ? 'http://127.0.0.1:9' : `http://127.0.0.1:${PORT}`;
  const { code, sortie } = await joueLeBanc(base);

  const bonCode = code === cas.code;
  const bonMotif = sortie.includes(cas.motif);
  const ok = bonCode && bonMotif;
  if (!ok) rates++;

  console.log(`${ok ? '  OK  ' : '  ECHEC'} ${cas.nom}`);
  console.log(`        attendu : sortie ${cas.code} + « ${cas.motif} »`);
  console.log(`        obtenu  : sortie ${code}${bonMotif ? ' + motif présent' : ' + ⛔ MOTIF ABSENT'}`);
  console.log(`        ${cas.pourquoi}`);
  if (!ok) {
    console.log('        ─── sortie du banc ───');
    console.log(sortie.split('\n').map((l) => '        │ ' + l).join('\n'));
  }
  console.log('');
}

serveur.close();

console.log('═══════════════════════════════════════════════════════════════');
if (rates) {
  console.log(`❌ ${rates}/${CAS.length} cas ratés.`);
  console.log('   ⛔ Un cas raté n\'autorise PAS à poser la Cache Rule. Et avant de');
  console.log('      corriger le banc : vérifier que ce n\'est pas CE FICHIER qui a tort.');
  console.log('      Au lot 135B, les deux défauts trouvés étaient dans le harnais.');
  process.exit(1);
}
console.log(`✅ ${CAS.length}/${CAS.length} — le banc rougit sur chaque panne, pour la`);
console.log('   bonne raison, et il verdit sur le cas sain.');
console.log('   ⇒ La Cache Rule peut être posée. ⛔ Dans cet ordre, jamais l\'inverse.');
process.exit(0);
