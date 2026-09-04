// ⚠️ VeVePreda/veve-sites — engine/tools/test_classeur.mjs  (NEUF — lot 224)
// ═══════════════════════════════════════════════════════════════════════════
// LE BANC DU CLASSEUR — il fabrique son grand livre, il ne lit pas le vrai
// ═══════════════════════════════════════════════════════════════════════════
//
//     npm run test:classeur          (aucune dépendance au réseau réel)
//
// ⭐⭐ IL SERT SON PROPRE FICHIER SUR UN PORT LOCAL, et c'est ce qui le rend
// jouable dans le Dockerfile (`WAREHOUSE_OFFLINE` n'est PAS posé ici : on veut
// exercer le chemin `fetch` + gunzip, celui de la production, pas le repli).
// ⛔ NE PAS le brancher sur la vraie release : 264 Mo à chaque build, et un
// banc qui dépend d'un fichier qu'on ne maîtrise pas devient rouge le jour où
// l'amont bouge — pour une raison qui n'est pas la sienne.
//
// 🔬 CHAQUE § A ÉTÉ JUGÉ EN INJECTANT LE DÉFAUT QU'IL PRÉTEND VOIR. Le détail
// des quatre injections est en pied de fichier, avec ce que chacune a rendu.
// ⭐ Un banc dont le terme à zéro n'est pas atteignable ne mesure rien.

import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let echecs = 0;
const dit = (ok, quoi, detail = '') => {
  if (!ok) echecs++;
  console.log(`${ok ? '  ✅' : '  ❌'} ${quoi}${detail ? ' — ' + detail : ''}`);
};

// ═══════════════════════════════════════════════════════════════════════════
// LE JEU D'ESSAI — construit pour que chaque § ait de quoi échouer
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ LES ADRESSES SONT CHOISIES, PAS TIRÉES AU HASARD, et c'est tout l'intérêt :
//   · `A` et `B` diffèrent AUX CARACTÈRES 2-3 (donc fragments différents) ;
//   · `A` et `C` sont IDENTIQUES sur ces deux-là et diffèrent après (donc MÊME
//     fragment).
// ⇒ un découpage sur `h[0:2]` mettrait les TROIS dans un seul fragment, et un
// découpage sur les mauvais caractères séparerait `A` de `C`. Le § 1 distingue
// les deux fautes, là où un jeu d'essai quelconque n'en verrait aucune.
const A = '0xaa' + '1'.repeat(38);
const B = '0xbb' + '1'.repeat(38);
const C = '0xaa' + '2'.repeat(38);
const U1 = '00000000-0000-4000-8000-000000000001';
const U2 = '00000000-0000-4000-8000-000000000002';
const U3 = '00000000-0000-4000-8000-000000000003';   // au livre, JAMAIS publiée

// ⚠️ LE `""` EST ÉCRIT TEL QUEL, DEUX GUILLEMETS, PARCE QUE C'EST CE QUE
// PRODUIT L'AMONT et que `split(',')` ne dé-quote pas. ⛔ Ne pas « corriger »
// ce jeu d'essai en champ vide : le banc cesserait de mesurer le seul piège
// que ce fichier existe pour tenir.
const CSV = [
  'veve_uuid,edition,holder,listed',
  `${U1},1,${A},0`,
  `${U1},2,"",0`,          // non détenue — elle DOIT sortir côté pièce
  `${U1},3,${B},1`,
  `${U1},4,${C},0`,
  `${U2},1,${A},0`,
  `${U3},1,${B},0`,        // pièce non publiée
].join('\n') + '\n';

const gz = gzipSync(Buffer.from(CSV, 'utf8'));
const serveur = createServer((_q, r) => { r.writeHead(200); r.end(gz); });
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const port = serveur.address().port;

const DIR = mkdtempSync(join(tmpdir(), 'classeur-banc-'));
process.env.CLASSEUR_DIR = DIR;
process.env.LEDGER_URL = `http://127.0.0.1:${port}/ledger_full.csv.gz`;
// ⛔ `LEDGER_URL` NE FINIT PAS PAR `.gz` PAR HASARD : `streamLedger` décide de
// dégzipper SUR LE NOM. Le lui retirer ferait lire du binaire comme du texte,
// et le banc sortirait « 0 ligne » en accusant le réseau.

const { ecrire, NON_DETENUE, SANS_DETENTEUR, ORDRE_PIECE, ORDRE_WALLET } =
  await import('../lib/classeur.mjs');

const r = await ecrire(new Set([U1, U2]));
serveur.close();

console.log('\n📒 LE CLASSEUR\n');

// ── §1 — LE DÉCOUPAGE EST SUR `h[2:4]`, ET IL SÉPARE CE QU'IL DOIT ──────────
// 🔴 LE § LE PLUS IMPORTANT DU FICHIER : c'est la faute qui a été commise dans
// le design de ce lot, et elle ne casse RIEN — elle produit un seul fragment
// géant, sur un build parfaitement vert.
console.log('§1 — le découpage des portefeuilles');
const fragments = readdirSync(join(DIR, 'wallets')).filter((f) => f.endsWith('.json'));
dit(fragments.length === 2, 'deux adresses distinctes ⇒ deux fragments',
    `${fragments.length} fragment(s) : ${fragments.join(', ')}`);
dit(fragments.includes('aa.json') && fragments.includes('bb.json'),
    'les clés sont bien les caractères 2-3, pas 0-1 (`0x`)', fragments.join(', '));
const fragAA = existsSync(join(DIR, 'wallets', 'aa.json'))
  ? JSON.parse(readFileSync(join(DIR, 'wallets', 'aa.json'), 'utf8')) : {};
dit(Object.keys(fragAA).length === 2,
    'deux adresses de même préfixe partagent un fragment, sans se fondre',
    `${Object.keys(fragAA).length} adresse(s) dans aa.json`);
// ⛔ AUCUN BROUILLON NE SURVIT. Un `.ndjson` oublié serait recopié dans l'image
//    par le `COPY /app/.reserve` du Dockerfile — des dizaines de Mo de fichier
//    de travail, et personne ne le verrait.
dit(readdirSync(join(DIR, 'wallets')).every((f) => f.endsWith('.json')),
    'aucun brouillon `.ndjson` ne survit à la compaction');

// ── §2 — `""` EST LE VIDE, ET IL EST RECONNU ───────────────────────────────
console.log('\n§2 — la pièce que personne ne détient');
dit(NON_DETENUE === '""', 'le vide du grand livre est bien deux guillemets', JSON.stringify(NON_DETENUE));
dit(r.nonDetenues === 1, 'elle est COMPTÉE', `${r.nonDetenues} au lieu de 1`);
// ⚖️ ARBITRAGE PREDA DU 04/09 : affichée, INDISTINCTE. Ni omise — ce qui
// trouerait la séquence et démentirait « tous les numéros » —, ni étiquetée.
const p1 = JSON.parse(readFileSync(join(DIR, 'pieces', `${U1}.json`), 'utf8'));
dit(p1.length === 4, 'les 4 numéros de la pièce sortent, le non détenu compris',
    `${p1.length} numéro(s)`);
const ligne2 = p1.find((l) => l[0] === 2);
dit(ligne2 && ligne2[1] === SANS_DETENTEUR,
    'le numéro non détenu porte le marqueur, pas un identifiant réel',
    JSON.stringify(ligne2));
// ⭐ ET IL N'EST DANS L'INVENTAIRE DE PERSONNE. C'est ce qui ramène le
//   découpage à 256 fragments : sans cette sortie, les 14,64 % formaient un
//   257ᵉ fragment de 1,8 M de lignes, 46 fois la médiane.
const toutesLignes = fragments.reduce((n, f) =>
  n + Object.values(JSON.parse(readFileSync(join(DIR, 'wallets', f), 'utf8')))
        .reduce((m, v) => m + v.length, 0), 0);
dit(toutesLignes === 5, 'aucune non détenue n\'entre dans un inventaire',
    `${toutesLignes} ligne(s) indexée(s) au lieu de 5`);

// ── §3 — SEULES LES PIÈCES PUBLIÉES ONT UN FRAGMENT ────────────────────────
console.log('\n§3 — le périmètre des pièces');
const pieces = readdirSync(join(DIR, 'pieces'));
dit(pieces.length === 2, 'une pièce du livre sans page publiée n\'a pas de fragment',
    `${pieces.length} fichier(s) : ${pieces.join(', ')}`);
dit(!existsSync(join(DIR, 'pieces', `${U3}.json`)), 'la pièce non publiée est bien absente');
// ⚠️ MAIS ELLE RESTE DANS L'INVENTAIRE DE SON DÉTENTEUR — arbitrage
//   « inventaire COMPLET ». La retirer amputerait le classeur de quelqu'un
//   pour un défaut d'affichage ; c'est le gabarit qui dit « pas de fiche ».
const fragBB = JSON.parse(readFileSync(join(DIR, 'wallets', 'bb.json'), 'utf8'));
dit((fragBB[B] || []).length === 2,
    'la pièce non publiée reste dans l\'inventaire de son détenteur',
    `${(fragBB[B] || []).length} ligne(s) pour B au lieu de 2`);

// ── §4 — LE CONTRAT POSITIONNEL EST CELUI QUE LA ROUTE LIT ─────────────────
// ⭐ LE BANC LIT LA ROUTE, IL NE RECOPIE PAS L'ORDRE. Un banc qui réécrit la
// liste dans son propre fichier mesurerait sa copie, pas le module.
console.log('\n§4 — l\'ordre des champs servis');
dit(ORDRE_PIECE.join(',') === 'edition,wallet,listed', 'ORDRE_PIECE inchangé', ORDRE_PIECE.join(','));
dit(ORDRE_WALLET.join(',') === 'piece,edition,listed', 'ORDRE_WALLET inchangé', ORDRE_WALLET.join(','));
const route = readFileSync(new URL('../../src/pages/api/classeur/[vue].js', import.meta.url), 'utf8');
// 🔴 ON CHERCHE LA FORME EXÉCUTÉE, PAS UN NOM. Un banc branché sur un nom
// trouve le COMMENTAIRE qui l'explique et reste vert sur du code cassé — c'est
// la panne du banc du lot 223, et elle a coûté une injection muette.
const sansCommentaires = route.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
dit(/\[ed,\s*iw,\s*li\]/.test(sansCommentaires),
    'la route déstructure la pièce dans l\'ordre du module');
dit(/\[iu,\s*ed,\s*li\]/.test(sansCommentaires),
    'la route déstructure l\'inventaire dans l\'ordre du module');
dit(/connecte\s*\(\s*locals\s*\)/.test(sansCommentaires),
    'la porte de la route est `connecte()`, pas `franchit()`');
dit(!/franchit\s*\(/.test(sansCommentaires),
    'aucun `franchit()` ne s\'est glissé dans la route (arbitrage : porte unique)');

// ── §5 — RIEN DU CLASSEUR N'ATTEINT `dist/` ────────────────────────────────
// ⭐ CE § EST « SANS OBJET » TANT QU'AUCUN `dist/` N'EXISTE, ET IL LE DIT.
// ⛔ Ne pas le désarmer pour autant : un banc muet ressemble à un succès. On
//    imprime le quatrième verdict plutôt que de sauter la ligne.
console.log('\n§5 — la fuite');
const dist = new URL('../../dist/', import.meta.url).pathname;
if (!existsSync(dist)) {
  console.log('  ⚪ SANS OBJET — pas de `dist/` (bâtir d\'abord pour armer ce §).');
} else {
  const pile = [dist]; let vus = 0, fuites = [];
  while (pile.length) {
    for (const e of readdirSync(pile.pop(), { withFileTypes: true })) {
      const f = join(e.parentPath || dist, e.name);
      if (e.isDirectory()) { pile.push(f); continue; }
      // ⚠️ ON BORNE CE QU'ON OUVRE. Un compteur qui ne borne pas compte autre
      //    chose que ce qu'il croit : le lot 213 avait trouvé une chaîne dans
      //    un paquet JS de 235 Ko et conclu à une fuite.
      if (!/\.(html|json)$/.test(e.name)) continue;
      vus++;
      const t = readFileSync(f, 'utf8');
      if (t.includes(A) || t.includes(B) || t.includes(C)) fuites.push(f);
    }
  }
  dit(fuites.length === 0, `aucune adresse du classeur dans dist/ (${vus} fichier(s) lus)`,
      fuites.slice(0, 3).join(', '));
}

rmSync(DIR, { recursive: true, force: true });
console.log(`\n${echecs === 0 ? '✅ classeur : tout est vert' : `❌ classeur : ${echecs} echec(s)`}\n`);

// ═══════════════════════════════════════════════════════════════════════════
// 🔬 LES QUATRE INJECTIONS — ce que chaque § rend quand on casse ce qu'il vise
// ═══════════════════════════════════════════════════════════════════════════
// Jouées le 04/09/2026, une par une, sur le module réel :
//   ① `CLE = (a) => a.slice(0, 2)`   → §1 : 1 fragment nommé `0x` au lieu de 2.
//      ⇒ ROUGE sur les trois assertions du §1. C'est la faute du design, et
//        le banc la voit.
//   ② `NON_DETENUE = ''`             → §2 : `nonDetenues` tombe à 0, la ligne
//      « " " » part dans `RE_ADRESSE` puis dans `horsForme`. ⇒ ROUGE.
//   ③ `if (gardeCourant)` retiré sur la branche non détenue → §2 : la pièce
//      sort à 3 numéros au lieu de 4. ⇒ ROUGE, et c'est l'arbitrage de Preda
//      qui est tenu là, pas une propriété technique.
//   ④ `connecte` → `franchit('modules')` dans la route → §4 : les deux
//      dernières assertions rougissent. ⚠️ Celle-ci est la plus utile des
//      quatre : elle ne casse RIEN de visible — la page marche, pour moins de
//      gens.
// ⭐ Aucune des quatre n'a été muette. ⚠️ Le jour où l'une le devient, le
//    soupçon va d'abord au JEU D'ESSAI, ensuite à l'instrument, et seulement
//    après au code.
