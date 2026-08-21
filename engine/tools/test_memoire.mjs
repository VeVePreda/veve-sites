// ⚠️ VeVePreda/veve-sites — engine/tools/test_memoire.mjs   (FICHIER NEUF — lot 171)
//
// ═══════════════════════════════════════════════════════════════════════════
//  LA SONDE MÉMOIRE DU BUILD — un instrument, et rien qu'un instrument
// ═══════════════════════════════════════════════════════════════════════════
//  Trois déploiements sont morts en silence en quatre jours (18, 20 et 21/08),
//  en plein `prerendering static routes`, sur un VPS de 7,8 Go SANS SWAP. Ni
//  exception, ni `#39 ERROR`, ni code de sortie : la signature d'un conteneur
//  tué par le noyau. Preda a vérifié chez Coolify qu'il n'y a **qu'un seul
//  déploiement par push** ⇒ l'hypothèse « deux builds simultanés » est écartée,
//  et il ne reste que la consommation d'UN build.
//
//  ⭐⭐⭐ CE QUE CE BANC PROTÈGE N'EST PAS UN CALCUL, C'EST UNE MESURE.
//  La sonde ne répare rien. Sa seule valeur est d'être LÀ quand le prochain
//  build mourra, pour que son log dise où était le pic. Une sonde retirée « au
//  ménage » ne casse rien, ne rougit nulle part, et fait perdre la seule trace
//  qu'on aura de la prochaine mort. C'est exactement le profil du garde-fou
//  qui se désarme tout seul.
//
//  ⛔ ET IL VÉRIFIE AUSSI L'INVERSE : que la sonde n'influence RIEN. Un
//  instrument qui pilote n'est plus un instrument. `memoire.jalon()` ne doit
//  rien retourner d'exploitable, et aucun `if` du moteur ne doit la lire.
//
//  ⚠️ CE QU'IL NE PEUT PAS FAIRE — et c'est l'essentiel à dire :
//  **le bac à sable ne peut pas reproduire la mort du build.** Il prédit le
//  code, jamais la machine. Ce banc prouve que l'instrument est branché et
//  qu'il compte juste ; il ne prouve pas que le VPS tiendra.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
let echecs = 0;
const dire = (ok, quoi, detail = '') => {
  console.log(`${ok ? '  ✅' : '  ❌'} ${quoi}${detail ? ` — ${detail}` : ''}`);
  if (!ok) echecs++;
};

console.log('\n🖥️ LA SONDE MÉMOIRE DU BUILD\n');

const ds = readFileSync(join(ROOT, 'engine/lib/dataset.mjs'), 'utf8');
// ⭐ On retire les COMMENTAIRES avant toute recherche. Sans ça, le long bloc
//   qui EXPLIQUE la sonde suffirait à satisfaire chaque contrôle : le banc
//   lirait la documentation du sujet au lieu du sujet. (Faute réellement
//   commise le 21/08 sur `filet.yml`, dans scrapeur-veve, le même jour.)
const code = ds.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

// ─── ① LES QUATRE JALONS RÉCLAMÉS SONT POSÉS ───────────────────────────────
// Ce sont ceux de l'ordre de chantier : après le catalogue, après les prix,
// après `projeterCote()`, et juste avant le prerender.
const JALONS = [
  [/memoire\.jalon\('avant de lire les sources'\)/, 'avant de lire les sources'],
  [/memoire\.jalon\(`catalogue \(/, 'après le catalogue + baselines + relevés'],
  [/memoire\.jalon\(`prix agreges/, 'après l\'agrégation des prix'],
  [/memoire\.jalon\(`projeterCote fait/, 'après projeterCote()'],
  [/memoire\.jalon\('dataset pret — LE PRERENDER COMMENCE ICI'\)/, 'juste avant le prerender'],
];
for (const [re, quoi] of JALONS) {
  dire(re.test(code), `① jalon posé : ${quoi}`,
    re.test(code) ? '' : 'sans lui, le log de la prochaine mort ne dira pas où était le pic');
}

// ─── ② LE POINT DE BOUCLE EST DANS LA LECTURE DES PRIX ─────────────────────
// Un pic ENTRE deux jalons est un pic invisible, et c'est justement pendant la
// lecture des 2,4 M de relevés que la mémoire monte.
{
  const i = code.indexOf('await streamPrices(');
  const j = code.indexOf('const bl = new Map()');
  const bloc = (i >= 0 && j > i) ? code.slice(i, j) : '';
  dire(/memoire\.pointDeBoucle\(/.test(bloc),
    '② un point de mesure DANS la boucle des prix',
    bloc ? '' : 'bloc streamPrices introuvable — le banc ne peut pas juger');
}

// ─── ③ LE PLAFOND V8 EST DIT ───────────────────────────────────────────────
dire(/await memoire\.plafond\(\)/.test(code),
  '③ le plafond du tas V8 est journalisé',
  'un `rss` sans plafond ne se compare à rien : on ne saurait pas si la cible du remède est le tas ou le hors-tas');

// ─── ④ LA SONDE N'INFLUENCE RIEN ───────────────────────────────────────────
{
  const src = readFileSync(join(ROOT, 'engine/lib/memoire.mjs'), 'utf8');
  const c = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  // 🔴🔴 PREMIER JET DE CE CONTROLE : `/export function jalon[\s\S]{0,400}?\n  return /`.
  //   J'ai injecte `return pic;` dans `jalon()` — **et le banc est reste VERT**.
  //   Le corps de la fonction fait plus de 400 caracteres (le `console.log` a
  //   lui seul en fait 300) : le quantificateur paresseux s'arretait AVANT
  //   d'atteindre le `return`. ⭐⭐⭐ *Une borne posee au jugé sur une longueur
  //   qu'on n'a pas mesuree transforme un controle en decoration.*
  //   ⇒ On DECOUPE le corps au lieu de le survoler.
  const corps = (() => {
    const i = c.indexOf('export function jalon(');
    if (i < 0) return null;
    const j = c.indexOf('\n}', i);
    return j < 0 ? null : c.slice(i, j);
  })();
  dire(corps !== null, '④ le corps de `jalon()` a bien été isolé',
    corps === null ? 'sans ça, le contrôle suivant est vert par construction' : `${corps.length} o`);
  dire(corps !== null && !/\breturn\s+[^;\s]/.test(corps),
    '④ `jalon()` ne retourne rien d\'exploitable',
    'un instrument dont on peut lire la sortie finit par piloter une décision');
  // ⛔ Aucun `if` du moteur ne doit dépendre de la sonde.
  const lecteurs = ['engine/lib/dataset.mjs', 'engine/lib/cote.mjs', 'engine/lib/extremes.mjs'];
  let pilote = false;
  for (const f of lecteurs) {
    const s = readFileSync(join(ROOT, f), 'utf8')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    if (/(if|\?|&&|\|\|)[^\n]*memoire\.(picMo|jalon|pointDeBoucle)/.test(s)) pilote = true;
  }
  dire(!pilote, '④ aucune décision du moteur ne lit la sonde');
}

// ─── ⑤ ELLE COMPTE JUSTE — on la fait tourner pour de vrai ─────────────────
{
  const m = await import(new URL('../lib/memoire.mjs', import.meta.url));
  m._reinitialiser();
  const lignes = [];
  const vrai = console.log;
  console.log = (...a) => lignes.push(a.join(' '));
  m.jalon('a');
  const gros = Buffer.alloc(64 * 1024 * 1024);
  gros[0] = 1;
  m.jalon('b');
  for (let i = 0; i < 25; i++) m.pointDeBoucle('essai', 10);
  console.log = vrai;

  dire(lignes.length === 2 + 2, '⑤ 2 jalons + 2 points de boucle imprimés',
    `reçu ${lignes.length} ligne(s) (25 appels, un point tous les 10)`);
  dire(/^\[memoire\] a — rss \d+ Mo/.test(lignes[0]), '⑤ le premier jalon dit son `rss`', lignes[0]);
  dire(!/depuis le jalon precedent/.test(lignes[0]),
    '⑤ le PREMIER jalon n\'invente pas d\'écart',
    'il n\'a pas de précédent : afficher « +0 Mo » laisserait croire à une mesure');
  dire(/depuis le jalon precedent/.test(lignes[1]), '⑤ le second jalon dit l\'écart');
  dire(/hors-tas \d+ Mo/.test(lignes[1]),
    '⑤ le hors-tas est dit séparément du tas',
    'un Buffer de 64 Mo ne bouge PAS le tas V8 : sans cette colonne, la mémoire semblerait ne pas monter');
  dire(m.picMo() >= 1, '⑤ le pic est retenu', `${m.picMo()} Mo`);
  m._reinitialiser();
  dire(m.picMo() === 0, '⑤ la remise à zéro fonctionne (elle sert aux bancs)');
}

console.log(echecs ? `\n❌ ${echecs} écart(s)\n` : '\n✅ la sonde mémoire est branchée et n\'influence rien\n');
process.exit(echecs ? 1 : 0);
