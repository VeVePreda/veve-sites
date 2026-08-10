// ⚠️ VeVePreda/veve-sites — engine/tools/test_pages.mjs   (FICHIER NEUF — lot 124)
// ═══════════════════════════════════════════════════════════════════════════
//  LE BANC QUI DEMANDE LES PAGES — celui qui manquait le 10/08 à 11 h
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 CE QU'IL AURAIT ÉVITÉ, ET CE QUE ÇA A COÛTÉ.
// Le lot 123 a laissé un `ReferenceError: dispo is not defined` dans
// `/connexion/` et `/inscription/`. Résultat, dans l'ordre :
//   · les deux pages rendent **500** ;
//   · `docker-entrypoint.sh` les teste au démarrage — `wget` échoue ;
//   · le conteneur refuse de démarrer, Coolify réessaie **12 fois**, s'arrête ;
//   · **le site entier répond 503 pendant une heure.**
//
// ⭐⭐⭐ ET RIEN NE POUVAIT LE VOIR AVANT. Le build passait. Les 31 bancs
// passaient. `test:routes`, `test:acces`, `test:session`, `test:fuite` : tous
// verts. Parce qu'AUCUN NE REND CES PAGES — elles sont rendues à la demande,
// donc absentes de `dist/`, donc invisibles à tout contrôle qui lit des
// fichiers. *Une page qu'aucun banc ne demande n'est vérifiée qu'en
// production, par le premier visiteur.*
//
// ⭐⭐ LE GARDE-FOU QUI A SAUVÉ LE RESTE : `docker-entrypoint.sh` a REFUSÉ de
// servir un site cassé plutôt que de publier deux pages en 500. Il a eu
// raison — mais il mesure au dernier moment possible, sur le VPS, après un
// build de quatre minutes. Ce banc-ci pose la même question dans le bac à
// sable, en quinze secondes.
//
// ⛔ IL LANCE UN VRAI SERVEUR. C'est le seul moyen : un rendu à la demande
//    n'existe pas ailleurs. On construit, on démarre, on DEMANDE, on arrête.
//    ⚠️ Il vient donc APRÈS `npm run build` — et il ne recalcule rien
//    (`dataset()` est déjà en mémoire du serveur), donc il ne peut pas vider
//    la réserve comme l'ont fait `test:fuite` (lot 101) et `test:rayon` (113).

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const ENTREE = join(ROOT, 'dist', 'server', 'entry.mjs');
const PORT = Number(process.env.PORT_BANC || 43219);

let ko = 0;
const verifie = (titre, ok, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${titre}${detail ? `   — ${detail}` : ''}`);
  if (!ok) ko++;
};

// ═══════════════════════════════════════════════════════════════════════════
// CE QU'ON DEMANDE, ET CE QU'ON ACCEPTE COMME RÉPONSE
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ ON REFUSE LE 5xx, ON N'EXIGE PAS LE 200 — exactement comme le contrôle de
// démarrage. `/compte/`, `/market/` et `/favoris/` REDIRIGENT un visiteur sans
// session : c'est leur comportement correct, et exiger 200 ferait échouer un
// site parfaitement sain. ⭐ Ce qu'on refuse, c'est la page qui EXPLOSE.
// ⛔ Et on refuse aussi le 404 : une route de compte introuvable signifie
//    qu'elle n'a pas été basculée à la demande — la panne du lot 24.
const ROUTES = [
  { p: '/', quoi: 'l\'accueil' },
  { p: '/compte/', quoi: 'l\'espace compte' },
  { p: '/connexion/', quoi: 'la connexion' },
  { p: '/inscription/', quoi: 'l\'inscription' },
  { p: '/market/', quoi: 'le marché' },
  { p: '/favoris/', quoi: 'les favoris' },
  // 🧭 LOT 126 — LA TROISIÈME PLACE DE `/dashboard/`. Les deux autres :
  //   `astro_routes_compte.mjs` (Node la REND) et `nginx.server.conf` (nginx la
  //   DEMANDE). ⛔ Une route qui n'est demandée par aucun banc n'est vérifiée
  //   qu'en production, par le premier visiteur — c'est le 503 du lot 123.
  { p: '/dashboard/', quoi: 'le tableau de bord' },
  // ⭐ Avec un paramètre de langue : c'est le chemin qui a explosé le 10/08,
  //   et il ne s'emprunte que si quelqu'un le demande.
  { p: '/connexion/?lang=fr', quoi: 'la connexion en français' },
  { p: '/inscription/?lang=de', quoi: 'l\'inscription en allemand' },
  { p: '/api/sante', quoi: 'la sonde de santé', exige200: true },
];

if (process.env.RENDERING !== 'server') {
  // ⭐⭐⭐ TROIS VERDICTS. En mode statique il n'y a pas de serveur : ces pages
  //   n'existent pas, et le dire est plus utile que de passer au vert.
  console.log('\n⏸️  sans objet — ce site est en mode STATIQUE, il n\'a aucune page rendue à la demande.');
  process.exit(0);
}
if (!existsSync(ENTREE)) {
  console.log(`\n⏸️  INDÉCIDABLE — ${ENTREE} est absent : ce banc doit être joué APRÈS \`npm run build\`.`);
  process.exit(0);
}

console.log('\nles pages rendues à la demande répondent-elles ?');

// ⚠️ `HOST` ET `PORT` FORCÉS : `@astrojs/node` écoute 4321 par défaut, et un
//    autre processus du build pourrait l'occuper. Un port dédié évite de
//    mesurer le voisin — *un banc branché sur autre chose mesure autre chose.*
const serveur = spawn(process.execPath, [ENTREE], {
  env: { ...process.env, HOST: '127.0.0.1', PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let journal = '';
serveur.stdout.on('data', (d) => { journal += d; });
serveur.stderr.on('data', (d) => { journal += d; });

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// On attend que le serveur écoute — au plus 30 s, par petits pas.
let pret = false;
for (let i = 0; i < 60 && !pret; i++) {
  await dormir(500);
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/api/sante`);
    if (r.status) pret = true;
  } catch { /* pas encore là */ }
}
verifie('le serveur démarre et écoute', pret,
  pret ? `port ${PORT}` : `aucune réponse en 30 s — journal :\n${journal.slice(-600)}`);

if (pret) {
  for (const r of ROUTES) {
    let code = 0;
    try {
      const rep = await fetch(`http://127.0.0.1:${PORT}${r.p}`, { redirect: 'manual' });
      code = rep.status;
    } catch (e) {
      verifie(`${r.quoi} (${r.p})`, false, `la requête a échoué : ${e.message}`);
      continue;
    }
    const bon = r.exige200 ? code === 200 : (code < 400);
    verifie(`${r.quoi} (${r.p})`, bon,
      bon ? `HTTP ${code}`
          : `HTTP ${code} — ${code >= 500 ? 'LA PAGE EXPLOSE : le conteneur refusera de démarrer'
                            : code === 404 ? 'INTROUVABLE : la route n\'a pas été basculée à la demande'
                            : 'réponse refusée'}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 🔴🔴🔴 LOT 128 — ET MAINTENANT ON SUIT LES LIENS DU MENU, LANGUE PAR LANGUE
  // ═════════════════════════════════════════════════════════════════════════
  // CE QU'IL AURAIT ÉVITÉ, MESURÉ LE 10/08/2026 SUR LE SITE EN LIGNE :
  // depuis `/favoris/` avec le cookie `vp_langue=fr`, le header et le pied de
  // page émettaient 19 liens dont **8 rendaient 404** — Analytics, Collections,
  // Offre, les quatre pages légales, et **le logo lui-même** (`/fr/`).
  // Preda l'a signalé comme deux bugs séparés (« la langue saute d'une page à
  // l'autre » et « favoris → analytics me renvoie à l'accueil ») ; c'était une
  // seule cause : `localize()` fabriquait des adresses avec la langue de
  // l'INTERFACE alors que seule la liste `active` a des adresses.
  //
  // ⭐⭐⭐ ET LES TRENTE-QUATRE BANCS ÉTAIENT VERTS. Aucun ne pouvait le voir :
  // `test:pages` ci-dessus demande les pages qu'on lui NOMME, jamais celles que
  // le site PROPOSE. *Une page qu'aucun banc ne demande n'est vérifiée qu'en
  // production* — et un LIEN que personne ne suit est exactement la même chose,
  // un cran plus loin. La liste ne se maintient pas à la main : **on la lit
  // dans la page**, ce qui la rend impossible à oublier de mettre à jour.
  //
  // ⛔ ET ON LE FAIT DANS CHAQUE LANGUE D'INTERFACE. Le défaut était INVISIBLE
  //    en anglais : `prefixOf('en')` rend `''`, donc tous les liens étaient
  //    justes. Un banc qui n'aurait essayé que la langue par défaut aurait été
  //    vert pendant que huit liens sur dix-neuf mouraient pour tous les autres.
  //    *Trois cas sur quatre ne disent rien du quatrième.*
  console.log('\n2. les liens que la page PROPOSE mènent-ils quelque part ?');

  // Un faux service de session : sans lui, les pages membre redirigent et on
  // n'atteint jamais le menu qu'on veut inspecter. ⛔ Il ne dit rien de plus
  // que « cette session existe » — le mur, lui, reste jugé au §1.
  const faux = createServer((req, res) => {
    if (req.url.startsWith('/session/')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ palier: 'member' })); return;
    }
    res.writeHead(404); res.end('{}');
  });
  await new Promise((ok) => faux.listen(PORT + 1, '127.0.0.1', ok));
  const serveurLangues = spawn(process.execPath, [ENTREE], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(PORT + 2), SESSION_API: `http://127.0.0.1:${PORT + 1}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let pret2 = false;
  for (let i = 0; i < 60 && !pret2; i++) {
    await dormir(500);
    try { pret2 = (await fetch(`http://127.0.0.1:${PORT + 2}/api/sante`)).ok; } catch { /* pas encore */ }
  }

  if (!pret2) {
    console.log('  ⚠️  INDÉCIDABLE — second serveur non démarré : les liens du menu ne sont pas jugés.');
  } else {
    // ⭐ Les langues viennent du MANIFESTE, pas d'une liste écrite ici. Une
    //   langue ajoutée demain est testée demain, sans que personne y pense.
    const { languesInterface } = await import('../lib/i18n.mjs');
    let langues = ['en'];
    try { langues = languesInterface(); } catch { /* repli sur la seule sûre */ }

    const PORTES = ['/favoris/', '/dashboard/', '/compte/'];
    let morts = [];
    let suivis = 0;
    const vu = new Set();

    for (const lang of langues) {
      for (const page of PORTES) {
        let html = '';
        try {
          const r = await fetch(`http://127.0.0.1:${PORT + 2}${page}`, {
            headers: { cookie: `vp_session=banc-menu; vp_langue=${lang}` },
          });
          if (r.status !== 200) continue;
          html = await r.text();
        } catch { continue; }

        // ⛔ On ne prend QUE les adresses internes de pages. Les polices, les
        //    images et le CSS sont servis par nginx en production et par Node
        //    ici : les demander mesurerait le serveur, pas le menu.
        const liens = [...new Set([...html.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1]))]
          .filter((u) => !/\.(css|js|woff2?|svg|png|jpg|webp|ico|xml|txt|json)$/.test(u));

        for (const u of liens) {
          const cle = `${lang} ${u}`;
          if (vu.has(cle)) continue;
          vu.add(cle); suivis++;
          let code = 0;
          try {
            code = (await fetch(`http://127.0.0.1:${PORT + 2}${u}`, {
              headers: { cookie: `vp_session=banc-menu; vp_langue=${lang}` }, redirect: 'manual',
            })).status;
          } catch { code = 0; }
          if (code >= 400 || code === 0) morts.push(`${u}  (cookie vp_langue=${lang}, HTTP ${code || 'échec'}, vu depuis ${page})`);
        }
      }
    }

    verifie('⛔ AUCUN lien proposé par une page membre ne mène à un 404',
      morts.length === 0,
      morts.length === 0
        ? `${suivis} lien(s) suivis sur ${langues.length} langue(s) d'interface : ${langues.join(', ')}`
        : `🔴 ${morts.length} lien(s) mort(s) sur ${suivis} suivis :\n      ${morts.slice(0, 10).join('\n      ')}`
          + `\n      ⇒ une langue d'INTERFACE s'est échappée dans une ADRESSE (cf. prefixOf, lot 128).`);

    // ⭐⭐ ET LA CONTRE-ÉPREUVE : le menu doit VRAIMENT changer de langue.
    // Sans elle, on rendrait ce banc vert en supprimant la traduction — moins
    // de liens morts, moins de site. *Un banc qui ne mesure qu'un seul côté
    // récompense la mauvaise correction.*
    if (langues.length > 1) {
      const autre = langues.find((l) => l !== 'en') || 'fr';
      const lire = async (l) => (await (await fetch(`http://127.0.0.1:${PORT + 2}/favoris/`, {
        headers: { cookie: `vp_session=banc-menu; vp_langue=${l}` },
      })).text());
      const [a, b] = [await lire('en'), await lire(autre)];
      const langA = (a.match(/<html[^>]*lang="([^"]+)"/) || [])[1];
      const langB = (b.match(/<html[^>]*lang="([^"]+)"/) || [])[1];
      verifie(`…et les libellés changent bien de langue (en ↔ ${autre})`,
        langA === 'en' && langB === autre && a !== b,
        langA === 'en' && langB === autre && a !== b
          ? `<html lang> suit le cookie, et le contenu diffère`
          : `🔴 lang="${langA}" contre lang="${langB}" — l'interface ne suit plus le cookie`);
    }
  }
  serveurLangues.kill('SIGTERM');
  try { faux.close(); } catch { /* déjà fermé */ }

  // ⭐⭐⭐ LE CONTRÔLE QUI VAUT LES AUTRES : le journal du serveur. Une page peut
  //   rendre 200 en ayant avalé une erreur — un `catch` de composant, un repli
  //   silencieux. *Le code HTTP dit ce que le visiteur reçoit, le journal dit
  //   ce qui s'est passé pour le lui donner.*
  const erreurs = (journal.match(/\[ERROR\]/g) || []).length;
  verifie('aucune erreur dans le journal du serveur', erreurs === 0,
    erreurs === 0 ? 'journal propre'
      : `${erreurs} erreur(s) :\n      ${journal.split('\n').filter((l) => l.includes('[ERROR]')).slice(0, 4).join('\n      ')}`);
}

serveur.kill('SIGTERM');
await dormir(300);
if (!serveur.killed) serveur.kill('SIGKILL');

console.log(`\n${ko === 0 ? '✅ pages : toutes répondent' : `❌ pages : ${ko} écart(s)`}`);
process.exit(ko === 0 ? 0 : 1);
