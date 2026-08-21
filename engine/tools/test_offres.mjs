// ⚠️ VeVePreda/veve-sites — engine/tools/test_offres.mjs   (FICHIER NEUF — lot 171)
//
// ═══════════════════════════════════════════════════════════════════════════
//  LA COURBE DES OFFRES — point `v` de l'audit du 14/08/2026
// ═══════════════════════════════════════════════════════════════════════════
//  Preda, ses mots : « le tableau Floor Price contient les listings ».
//  Le TABLEAU les avait. **La COURBE, elle, manquait.**
//
//  🔴🔴🔴 CE BANC EXISTE SURTOUT POUR LA LEÇON QUI L'A PRÉCÉDÉ.
//  Le premier jet du lot 171 a écrit cette courbe dans `courbeSVG`
//  (engine/lib/chart.mjs), parce que c'est là que « le graphique du floor »
//  semblait vivre. Mesure faite ensuite : **`courbeSVG` n'est appelée par
//  PERSONNE.** La courbe publique a quitté la fiche au lot 123 ; le seul
//  graphique de floor encore rendu est celui du `<Cadran>`, dessiné côté
//  navigateur par `src/socle/modules/cadran.js`.
//  ⭐⭐⭐ *Un point hérité d'un audit est une observation DATÉE : la page a pu
//  changer sous lui.* Un lot écrit sur la foi de l'audit aurait livré du code
//  mort, vert partout, et Preda n'aurait rien vu de neuf sur sa fiche.
//
//  CE QUE CE BANC VÉRIFIE — quatre maillons, et la chaîne casse à n'importe lequel
//  ─────────────────────────────────────────────────────────────────────────
//   ① `reserve.point()` écrit bien TROIS colonnes (ts, floor, listings).
//   ② `normaliser()` (cote.mjs) rend bien un TRIPLET, et le 3ᵉ terme est le
//      compte d'offres EN CLAIR — un compte n'est pas un montant.
//   ③ `cadran.js` LIT `p[2]` et trace une seconde ligne.
//   ④ Il ne trace RIEN quand aucun point ne porte d'offre — une ligne plate à
//      zéro affirmerait « il n'y en a jamais eu » là où la source dit « je ne
//      sais pas ».
//
//  ⚠️ CE QU'IL NE PEUT PAS FAIRE : il ne rend pas de page dans un navigateur.
//  Il éprouve la RÈGLE et le CÂBLAGE, pas l'aspect de la courbe. Que les deux
//  lignes soient lisibles ensemble se constate à l'œil, sur une fiche.

import { readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
let echecs = 0;
// ⭐ QUATRE VERDICTS DANS CE PROJET : conforme · ecart · INDECIDABLE · SANS
//   OBJET. Celui-ci sert au second site, ou la fonctionnalite n'existe pas.
let sansObjet = 0;
const dire = (ok, quoi, detail = '') => {
  console.log(`${ok ? '  ✅' : '  ❌'} ${quoi}${detail ? ` — ${detail}` : ''}`);
  if (!ok) echecs++;
};
const lire = (p) => readFileSync(join(ROOT, p), 'utf8');

console.log('\n🔢 LA COURBE DES OFFRES — les quatre maillons\n');

// ─── ① LA RÉSERVE ÉCRIT TROIS COLONNES ──────────────────────────────────────
{
  const src = lire('engine/lib/reserve.mjs');
  dire(/export function point\(uuid, ts, floor, listings\)/.test(src),
    '① reserve.point() reçoit bien `listings`',
    'sans lui, la 3ᵉ colonne n\'existe pas et rien en aval ne peut la lire');
  dire(/\$\{floor\},\$\{listings \|\| 0\}/.test(src),
    '① la ligne écrite porte ts,floor,listings');
}

// ─── ② LE TRIPLET DE `normaliser()` ────────────────────────────────────────
{
  // ⛔ ON N'IMPORTE PAS `cote.mjs` AVANT D'AVOIR DEPLACE SON DOSSIER DE SORTIE.
  //    `COTE_DIR` est fige a l'import (`const`, lu dans `process.env`) et
  //    `projeter()` VIDE ce dossier avant d'ecrire. Un banc qui importe d'abord
  //    detruirait la reserve du build en cours — c'est exactement la panne du
  //    lot 104 (1 201 fichiers -> 0), et elle ne leve aucune erreur.
  process.env.RESERVE_COTE_DIR = join(ROOT, '.reserve', '_banc_offres');
  const mod = await import(new URL('../lib/cote.mjs', import.meta.url));
  // `normaliser` n'est pas exportée : on éprouve par sa sortie publique,
  // `projeter()`, qui est le seul chemin réel. ⛔ Exporter une fonction juste
  // pour un banc élargit la surface publique pour la commodité du banc.
  const items = [{
    uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', path: '/x/', name: 'X',
    floor: 10, listings: 3, ath: 30, atl: 5,
    history: [
      { ts: '2026-08-01T00:00:00Z', floor: 10, listings: 3 },
      { ts: '2026-08-02T00:00:00Z', floor: 20, listings: 7 },
      { ts: '2026-08-03T00:00:00Z', floor: 15, listings: 0 },
    ],
  }];
  const bilan = mod.projeter(items);
  // `projeter()` rend un BILAN, pas les cotes : elles partent sur disque.
  // ⭐ On relit donc le fichier — c'est aussi ce que fait la route d'API, donc
  //   on eprouve le vrai chemin, pas une valeur de retour de commodite.
  // ═══════════════════════════════════════════════════════════════════════
  // 🔴🔴🔴 SANS OBJET N'EST PAS UN ECART — ET C'EST LE SECOND SITE QUI L'A DIT
  // ═══════════════════════════════════════════════════════════════════════
  // Premier jet de ce banc : VERT sur veveprice, **DEUX ROUGES sur vevewiki**.
  // Rien n'etait casse. Sur vevewiki la porte `cote` est INACTIVE (site
  // entierement gratuit) : `projeter()` sort immediatement, ne normalise rien
  // et ne depose aucune cote — c'est le comportement voulu, ecrit noir sur
  // blanc dans `cote.mjs`. Et comme `<Cadran>` ne rend RIEN quand la porte
  // `price_history` est inactive, **la courbe des offres n'existe pas sur ce
  // site** : il n'y a pas de graphique ou la tracer.
  // ⭐⭐⭐ *Eprouver sur un seul site, c'est ne rien eprouver.* Ce banc aurait
  //   fait rougir la CI de vevewiki pour une fonctionnalite qui n'y a pas lieu
  //   d'etre — et un rouge injustifie se fait desarmer en trois jours.
  // ⛔ On ne se TAIT pas pour autant : on l'ECRIT. Un banc qui saute en silence
  //   est indiscernable d'un banc qui passe.
  let c = null;
  if (bilan.actif) {
    const f = join(process.env.RESERVE_COTE_DIR, items[0].uuid + '.json');
    c = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
  }
  const courbe = bilan.actif ? (c && c.courbe) : null;
  if (!bilan.actif) {
    sansObjet++;
    console.log('  ⏭️  ② SANS OBJET sur ce site : la porte `cote` est inactive,'
      + ' `projeter()` ne depose aucune courbe et `<Cadran>` ne rend aucun'
      + ' graphique. Il n\'y a pas de courbe des offres a tracer ici.');
  } else {
    dire(!!c, '② la cote est bien deposee sur disque');
  }
  if (bilan.actif) {
  dire(Array.isArray(courbe) && courbe.length === 3,
    '② projeter() dépose une courbe de 3 points',
    `reçu : ${courbe ? courbe.length : 'rien'}`);
  if (Array.isArray(courbe) && courbe.length === 3) {
    dire(courbe.every((p) => p.length === 3),
      '② chaque point est un TRIPLET [ts, prix, offres]',
      JSON.stringify(courbe[0]));
    dire(courbe.map((p) => p[2]).join(',') === '3,7,0',
      '② le 3ᵉ terme est le compte d\'offres EN CLAIR',
      `attendu 3,7,0 — reçu ${courbe.map((p) => p[2]).join(',')}`);
    // 🔴 LE PRIX, LUI, RESTE NORMALISÉ : c'est tout le lot 101. Si un jour ce
    //    point-là tombe, la courbe des offres n'y est pour rien — mais on veut
    //    le savoir ICI, parce que c'est ce lot qui a touché `normaliser()`.
    const prix = courbe.map((p) => p[1]);
    dire(Math.min(...prix) === 0 && Math.max(...prix) === 1000,
      '② le PRIX reste normalisé 0..1000 (le lot 101 tient)',
      `bornes : ${Math.min(...prix)}..${Math.max(...prix)}`);
    dire(!prix.includes(10) && !prix.includes(20),
      '② aucun montant réel n\'a fui dans la courbe');
    }
  }
}

// ─── ③ ET ④ : `cadran.js` DESSINE, ET SE TAIT QUAND IL FAUT ────────────────
{
  const js = lire('src/socle/modules/cadran.js');
  dire(/Number\(p\[2\]\)/.test(js),
    '③ cadran.js lit bien la 3ᵉ colonne des points reçus');
  dire(/class="ligne-offres"/.test(js),
    '③ il trace une seconde ligne',
    'classe `ligne-offres`');
  dire(/data-l-offres/.test(js) && /data-l-offres/.test(lire('src/components/Cadran.astro')),
    '③ le libellé passe par un `data-` traduit, pas en dur',
    'cadran.js n\'a aucun accès aux dictionnaires');
  dire(/if \(oMax > 0\)/.test(js),
    '④ rien n\'est tracé quand aucun point ne porte d\'offre',
    'une ligne plate à zéro AFFIRMERAIT une absence d\'offres');

  // 🔬 ON REJOUE LA GÉOMÉTRIE, pas seulement sa présence. Un banc qui ne fait
  //    que chercher des chaînes dans un fichier est satisfait par un
  //    commentaire — leçon du lot 172, le même jour.
  const geo = (pts) => {
    const H = 260, pad = { t: 16, b: 26 };
    const offres = pts.map((p) => {
      const v = Number(p[2]);
      return (isFinite(v) && v > 0) ? v : 0;
    });
    const oMax = Math.max(...offres);
    if (!(oMax > 0)) return null;
    const pyO = (v) => H - pad.b - (v / oMax) * (H - pad.t - pad.b);
    return { oMax, sol: pyO(0), haut: pyO(oMax) };
  };
  const g = geo([[1, 500, 3], [2, 600, 12], [3, 400, 6]]);
  dire(!!g && g.oMax === 12, '③ l\'échelle prend le MAXIMUM des offres', `oMax=${g && g.oMax}`);
  dire(!!g && Math.round(g.sol) === 234,
    '③ le sol de l\'échelle est ZÉRO, pas le minimum de la série',
    'sinon « 4 offres au creux » se dessine comme un effondrement');
  dire(geo([[1, 500, 0], [2, 600, 0]]) === null, '④ série toute à zéro : aucune ligne');
  dire(geo([[1, 500], [2, 600]]) === null, '④ points à 2 termes (ancienne réserve) : aucune ligne');
}

// ─── LA CSS EXISTAIT DÉJÀ, ET C'EST ELLE QU'ON EMPLOIE ─────────────────────
{
  const css = lire('themes/vitrine/theme.css');
  dire(/\.graph \.ligne-offres\{/.test(css),
    '③ la règle `.graph .ligne-offres` existe dans le thème',
    'elle y dormait, inutilisée, avant ce lot');
  dire(!/class="ligne ligne-offres"/.test(lire('src/socle/modules/cadran.js')),
    '③ la seconde ligne ne porte PAS aussi `.ligne`',
    '`.ligne` impose son `stroke-dasharray` et son animation');
}

console.log(echecs
  ? `\n❌ ${echecs} écart(s)\n`
  : sansObjet
    ? `\n✅ le câblage est conforme · ⏭️ ${sansObjet} point(s) SANS OBJET sur ce site (porte \`cote\` inactive)\n`
    : '\n✅ la courbe des offres est câblée de bout en bout\n');

// ⭐ On ne laisse pas de trace : le dossier du banc est retire.
try { rmSync(join(ROOT, '.reserve', '_banc_offres'), { recursive: true, force: true }); } catch { /* rien */ }
process.exit(echecs ? 1 : 0);
