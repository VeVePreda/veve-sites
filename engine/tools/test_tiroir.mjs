// ⚠️ VeVePreda/veve-sites — engine/tools/test_tiroir.mjs   (FICHIER NEUF — lot 139)
//
// ═══════════════════════════════════════════════════════════════════════════
//  LOT 139 — UN `position:fixed` QUI N'EST PAS FIXE À L'ÉCRAN
// ═══════════════════════════════════════════════════════════════════════════
//  Le 11/08/2026, Preda signale : « sur petit écran le menu latéral ne
//  fonctionne pas, il est si compacté qu'on ne peut pas l'utiliser ».
//
//  Il fonctionnait. Le bouton bascule `aria-expanded`, le panneau perd son
//  `hidden`, il passe en `transform:none`, il est opaque depuis le lot 111, il
//  répond au clavier et à Échap. Il était **HAUT DE 64 PIXELS** :
//
//      .site-h      { backdrop-filter: blur(var(--foc-verre)) }   ← l'en-tête
//      @media (max-width:1040px){
//        .deplie__m { position:fixed; inset:0 auto 0 0 }          ← le tiroir
//      }
//
//  ...et le tiroir est un DESCENDANT de l'en-tête dans le DOM :
//
//      <header class="site site-h"><div class="wrap site-h__in">
//        <div class="deplie nav__deplie"><div class="deplie__m" id="menu-m">
//
//  ⭐⭐⭐ UN ANCÊTRE QUI PORTE `backdrop-filter` (ou `transform`, `filter`,
//  `perspective`, `contain`) DEVIENT LE BLOC CONTENEUR DE SES DESCENDANTS EN
//  `position:fixed`. `inset:0 auto 0 0` ne vise donc plus la fenêtre mais
//  **l'en-tête**, qui fait 64 px (56 px sous 640 px). Le tiroir occupe la
//  hauteur d'une barre de titre. C'est exactement « si compacté qu'on ne peut
//  pas l'utiliser », et c'est écrit à 78 000 octets de distance dans la feuille.
//
//  ⭐⭐ LE MOTIF QUI TRANCHE, ET IL EST LE MÊME QU'AU 11/08 SUR LES CACHE RULES :
//  *le défaut suit une dimension absente de la déclaration qui semble fautive.*
//  Rien dans `.deplie__m` n'est faux. On peut relire ce sélecteur cent fois : la
//  cause n'y est pas, elle est chez un ANCÊTRE, et elle n'a pas l'air d'être une
//  règle de position — c'est un effet de flou.
//
//  ⭐ ET LA FEUILLE PORTAIT DÉJÀ LA PREUVE : `[data-leger] .site-h{
//  backdrop-filter:none!important }`. En mode allégé le tiroir marche, en mode
//  normal non. *Un défaut qui n'apparaît que dans une des deux configurations
//  ressemble à un caprice de navigateur, et c'est une règle CSS.*
//
// ═══════════════════════════════════════════════════════════════════════════
//  LA RÈGLE QUE CE BANC ÉMET, EN UNE PHRASE
// ═══════════════════════════════════════════════════════════════════════════
//  **Aucun ancêtre d'un élément en `position:fixed` ne crée de bloc conteneur**
//  aux largeurs où ce `fixed` s'applique.
//
//  ⛔ CE BANC N'EST PAS UN MOTEUR DE RENDU, et c'est assumé — comme
//  `test:opacite`. Il ne calcule aucune boîte. Il fait la seule chose qu'un
//  moteur ne ferait pas mieux ici : il croise **la feuille servie** et **le DOM
//  réellement produit**, c'est-à-dire *qui écrit* et *qui lit*.
//
//  ⭐⭐ IL LIT `dist/`, PAS LES GABARITS. Un `.deplie__m` peut naître dans
//  `Base.astro`, dans un composant ou nulle part ; ce qui compte est l'ancêtre
//  qu'il a **dans la page servie**. Un banc qui lirait `Base.astro` conclurait
//  sur une structure que personne ne reçoit — c'est « l'échantillon ne contient
//  pas ».
//
//  ⚠️ TROIS VERDICTS, JAMAIS DEUX : conforme · écart · **INDÉCIDABLE**. Pas de
//  `dist/`, pas de linkedom, pas de thème ⇒ **exit 2**, jamais 0. *Un banc muet
//  ressemble à un succès.*
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { monterDOM } from './_dom_banc.mjs';

const R = new URL('../..', import.meta.url).pathname;
const DOSSIER = join(R, 'themes');

let echecs = 0, indecidables = 0;
const dire = (ok, msg) => { if (!ok) echecs++; console.log(`  ${ok ? '✅' : '❌'} ${msg}`); };
const indecis = (quoi, pourquoi) => {
  indecidables++;
  console.log(`  ⚠️  INDÉCIDABLE — ${quoi} : ${pourquoi}`);
};

// ═══════════════════════════════════════════════════════════════════════════
//  LA FEUILLE SERVIE — thème + socle, dans l'ordre de `feuille_theme.mjs`
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ Recopié de `test_opacite.mjs` **par nécessité, pas par paresse** :
// `feuille_theme.mjs` assemble avec `import.meta.glob('?raw')`, une primitive de
// Vite qui n'existe pas sous Node nu, et il DOIT le rester (le Dockerfile ne
// copie pas `themes/` dans l'image de runtime).
// ⭐ Le socle est EXTRAIT du module et non recopié : un socle recopié ici
// divergerait du socle servi, et un banc qui juge une feuille qui n'est pas la
// vraie ne juge rien.
const SRC_FEUILLE = join(R, 'engine/lib/feuille_theme.mjs');
if (!existsSync(SRC_FEUILLE)) {
  indecis('la feuille servie', 'engine/lib/feuille_theme.mjs introuvable');
  console.log('\n⚠️  rien n\'a été mesuré\n'); process.exit(2);
}
const mSocle = readFileSync(SRC_FEUILLE, 'utf8').match(/const SOCLE = `([\s\S]*?)`;/);
if (!mSocle) {
  indecis('la feuille servie', 'le socle est introuvable dans feuille_theme.mjs');
  console.log('\n⚠️  rien n\'a été mesuré\n'); process.exit(2);
}
const SOCLE = mSocle[1];
const THEMES = readdirSync(DOSSIER).sort();

// ═══════════════════════════════════════════════════════════════════════════
//  LE DÉCOUPAGE EN RÈGLES — même moteur que `test:opacite`
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 La première version de ce découpeur, au lot 111, repérait l'ouverture
// d'une `@media` sans jamais consommer sa FERMETURE : les règles écrites après
// le bloc héritaient de sa condition. Le banc rougissait sur du code juste.
// ⛔ On garde donc la pile, et on empile aussi `@keyframes` & consorts — non
// pour leur condition (ils n'en portent pas) mais pour que leur `}` se referme.
function regles(css) {
  const propre = css.replace(/\/\*[\s\S]*?\*\//g, '');   // ⛔ jamais les commentaires
  const out = [], pile = [];
  let i = 0, debut = 0;
  while (i < propre.length) {
    const c = propre[i];
    if (c === '{') {
      const tete = propre.slice(debut, i).trim();
      if (tete.startsWith('@')) {
        pile.push(/^@(media|supports)\b/.test(tete) ? tete : null);
        i++; debut = i; continue;
      }
      const ferme = propre.indexOf('}', i);
      if (ferme < 0) break;
      if (tete) out.push({ sel: tete, corps: propre.slice(i + 1, ferme),
                           cond: pile.filter(Boolean).join(' and ') });
      i = ferme + 1; debut = i; continue;
    }
    if (c === '}') { pile.pop(); i++; debut = i; continue; }
    i++;
  }
  return out;
}

/** Les jetons de classe d'un sélecteur. `.deplie__m:not([hidden])` → ['deplie__m'] */
const jetons = (sel) => [...new Set((sel.match(/\.[A-Za-z0-9_-]+/g) || []).map((c) => c.slice(1)))];

// ═══════════════════════════════════════════════════════════════════════════
//  CE QUI CRÉE UN BLOC CONTENEUR POUR UN DESCENDANT `position:fixed`
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ Liste FERMÉE et NOMMÉE, pas une heuristique. Chaque entrée est une
// propriété dont une valeur autre que `none` établit le bloc conteneur des
// descendants fixés (CSS Position 3 / Transforms 2 / Filter Effects 1 /
// css-contain 2). ⛔ `will-change` compte : il établit le bloc conteneur
// **par anticipation**, c'est le piège le plus discret des cinq.
const CB = [
  { prop: 'transform',        neutre: /^(none)$/i },
  { prop: 'filter',           neutre: /^(none)$/i },
  { prop: 'backdrop-filter',  neutre: /^(none)$/i },
  { prop: '-webkit-backdrop-filter', neutre: /^(none)$/i },
  { prop: 'perspective',      neutre: /^(none)$/i },
  { prop: 'contain',          neutre: /^(none|size|inline-size|style)$/i },
  { prop: 'will-change',      neutre: /^(auto)$/i, valeurs: /transform|filter|perspective|contain/i },
];

/** La (ou les) propriétés d'un corps de règle qui créent un bloc conteneur. */
function creeBlocConteneur(corps) {
  const trouve = [];
  for (const { prop, neutre, valeurs } of CB) {
    const re = new RegExp(`(^|;)\\s*${prop.replace(/[-]/g, '\\-')}\\s*:\\s*([^;!]+)`, 'i');
    const m = corps.match(re);
    if (!m) continue;
    const v = m[2].trim();
    if (neutre.test(v)) continue;                 // `transform:none` ne crée rien
    if (valeurs && !valeurs.test(v)) continue;    // `will-change:opacity` non plus
    trouve.push(`${prop}:${v.slice(0, 34)}`);
  }
  return trouve;
}

// ═══════════════════════════════════════════════════════════════════════════
//  DEUX CONDITIONS @media SE CHEVAUCHENT-ELLES ?
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ SANS CE TEST, LE BANC SERAIT FAUX DANS LES DEUX SENS. Un `backdrop-filter`
// posé sous `min-width:1200px` ne gêne pas un `fixed` qui ne vit que sous
// `max-width:1040px` : crier là-dessus serait un faux rouge. À l'inverse, une
// règle SANS condition s'applique partout — donc elle chevauche toujours.
// ⛔ On ne modélise que `max-width` / `min-width`, les seules employées par ce
// dépôt (14 seuils, tous en `max-width` — mesuré le 11/08). Toute condition
// qu'on ne sait pas lire est traitée comme **chevauchante** : un instrument qui
// ne comprend pas doit alerter, pas se taire.
function bornes(cond) {
  if (!cond) return { min: 0, max: Infinity, sur: true };
  const mx = cond.match(/max-width\s*:\s*(\d+)px/);
  const mn = cond.match(/min-width\s*:\s*(\d+)px/);
  if (!mx && !mn) return { min: 0, max: Infinity, sur: false };   // condition non largeur
  return { min: mn ? +mn[1] : 0, max: mx ? +mx[1] : Infinity, sur: true };
}
const chevauchent = (a, b) => {
  const A = bornes(a), B = bornes(b);
  return Math.max(A.min, B.min) <= Math.min(A.max, B.max);
};

// ═══════════════════════════════════════════════════════════════════════════
//  §1 — LE CROISEMENT RÉEL : la feuille servie × le DOM produit
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n═══ LOT 139 — aucun ancêtre ne piège un `position:fixed` ═══');

const CANDIDATS = [
  'dist/client/index.html',
  'dist/index.html',
];
const page = CANDIDATS.find((p) => existsSync(join(R, p)));
if (!page) {
  indecis('le DOM produit', `aucune page trouvée (${CANDIDATS.join(' · ')}) — construire d'abord`);
} else {
  // ⭐ ON DIT QUELLE PAGE A ÉTÉ OUVERTE. Un banc qui ne nomme pas sa source
  //   laisse croire qu'il a mesuré le site entier ; celui-ci mesure UNE page —
  //   celle qui porte l'en-tête, donc le tiroir. *Un rapport qui tait son
  //   périmètre se lit comme un rapport complet.*
  console.log(`  📄 page ouverte : ${page}`);
  const html = readFileSync(join(R, page), 'utf8');
  const dom = await monterDOM(html);
  if (!dom) {
    indecis('le DOM produit', 'linkedom absent — `npm i -D linkedom`');
  } else {
    const { document } = dom;

    for (const cle of THEMES) {
      const rs = regles(readFileSync(join(DOSSIER, cle, 'theme.css'), 'utf8') + SOCLE);

      // Les règles qui posent `position:fixed`, et celles qui piègent.
      const fixes = rs.filter((r) => /(^|;)\s*position\s*:\s*fixed\b/i.test(r.corps));
      const pieges = rs.map((r) => ({ r, quoi: creeBlocConteneur(r.corps) })).filter((x) => x.quoi.length);

      const ecarts = [];
      for (const f of fixes) {
        for (const jf of jetons(f.sel)) {
          // ⭐ On interroge le DOM RÉEL : ce jeton atteint-il quelque chose ?
          //   Un sélecteur qui ne matche rien n'est pas un défaut ici — c'est le
          //   sujet de `test:regle-sans-emetteur`, pas de celui-ci.
          const cibles = [...document.querySelectorAll(`.${jf}`)];
          for (const el of cibles) {
            for (let p = el.parentElement; p; p = p.parentElement) {
              const cl = (p.getAttribute('class') || '').split(/\s+/).filter(Boolean);
              if (!cl.length) continue;
              for (const { r, quoi } of pieges) {
                const jp = jetons(r.sel);
                if (!jp.length || !jp.some((x) => cl.includes(x))) continue;
                // ⛔ `[data-leger] .site-h{backdrop-filter:none}` ne piège pas :
                //    `creeBlocConteneur` l'a déjà écarté sur la valeur `none`.
                if (!chevauchent(f.cond, r.cond)) continue;
                ecarts.push(
                  `.${jf}  [fixed${f.cond ? ` sous ${f.cond.replace(/\s+/g, '')}` : ' partout'}]`
                  + `\n           piégé par  ${r.sel.split(',')[0].trim().slice(0, 46)}`
                  + `${r.cond ? `  [${r.cond.replace(/\s+/g, '')}]` : '  [partout]'}`
                  + `\n           qui porte  ${quoi.join(' · ')}`
                  + `\n           ancêtre    <${p.tagName.toLowerCase()} class="${cl.join(' ')}">`);
              }
            }
          }
        }
      }

      const uniq = [...new Set(ecarts)];
      dire(uniq.length === 0,
        `${cle} — ${fixes.length} règle(s) \`position:fixed\`, ${pieges.length} créatrice(s) de bloc conteneur`
        + (uniq.length
          ? `\n     ⛔ ${uniq.length} PIÈGE(S) MESURÉ(S) SUR LE DOM SERVI :\n       · ` + uniq.join('\n       · ')
            + '\n     ⭐ Deux remèdes, et un seul est bon selon le cas :'
            + '\n       ① l\'ancêtre perd sa propriété AUX LARGEURS où le fixed vit ;'
            + '\n       ② l\'élément fixé sort du sous-arbre de l\'ancêtre.'
            + '\n     ⛔ Ce qui N\'EST PAS un remède : agrandir le fixed. Il n\'est pas'
            + '\n       trop petit, il est mesuré dans la mauvaise boîte.'
          : ''));
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  §2 — LA CONTRE-ÉPREUVE : le banc rougit-il quand il DOIT rougir ?
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ CE § N'OUVRE PAS `dist/`, ET C'EST LE POINT. Le jour où le défaut est
// corrigé, le §1 devient vert — et un §1 vert ne prouve plus que l'instrument
// fonctionne. *Un banc qui ne peut plus produire de rouge ne prouve plus rien
// par son vert.* On lui rejoue donc la panne EXACTE du 11/08, en dur, à chaque
// passage : `backdrop-filter` sur un ancêtre, `position:fixed` sur l'enfant.
// ⛔ Et le cas TÉMOIN va avec (le même arbre sans la propriété) : un banc qui
// rougit sur tout est aussi inutile qu'un banc qui verdit sur tout.
{
  console.log('\n  ── contre-épreuve (fabriquée, n\'ouvre pas dist/) ──');
  const essai = async (nom, css, html, attendu) => {
    const dom = await monterDOM(html);
    if (!dom) { indecis(`contre-épreuve « ${nom} »`, 'linkedom absent'); return; }
    const rs = regles(css);
    const fixes = rs.filter((r) => /(^|;)\s*position\s*:\s*fixed\b/i.test(r.corps));
    const pieges = rs.map((r) => ({ r, quoi: creeBlocConteneur(r.corps) })).filter((x) => x.quoi.length);
    let vu = 0;
    for (const f of fixes) for (const jf of jetons(f.sel))
      for (const el of dom.document.querySelectorAll(`.${jf}`))
        for (let p = el.parentElement; p; p = p.parentElement) {
          const cl = (p.getAttribute('class') || '').split(/\s+/).filter(Boolean);
          for (const { r } of pieges)
            if (jetons(r.sel).some((x) => cl.includes(x)) && chevauchent(f.cond, r.cond)) vu++;
        }
    dire((vu > 0) === attendu,
      `${nom} — ${vu} piège(s) vu(s), ${attendu ? 'au moins 1 attendu' : '0 attendu'}`);
  };

  const arbre = (cls) => `<header class="${cls}"><div class="deplie"><div class="deplie__m">m</div></div></header>`;
  const FIXE = '@media (max-width:1040px){.deplie__m{position:fixed;inset:0 auto 0 0}}';

  // ① LA PANNE DU 11/08, à l'octet près.
  await essai('panne réelle : backdrop-filter sur l\'en-tête',
    `.site-h{backdrop-filter:blur(14px)}${FIXE}`, arbre('site site-h'), true);
  // ② LE TÉMOIN — le même arbre, la propriété neutralisée.
  await essai('témoin : backdrop-filter:none',
    `.site-h{backdrop-filter:none}${FIXE}`, arbre('site site-h'), false);
  // ③ `transform` piège aussi — et il est bien plus courant.
  await essai('transform sur l\'ancêtre',
    `.site-h{transform:translateZ(0)}${FIXE}`, arbre('site site-h'), true);
  // ④ `will-change:transform` piège PAR ANTICIPATION, sans qu'aucune transformée
  //    ne soit posée. C'est le cas que personne ne soupçonne.
  await essai('will-change:transform (piège par anticipation)',
    `.site-h{will-change:transform}${FIXE}`, arbre('site site-h'), true);
  // ⑤ `will-change:opacity` ne piège PAS — sinon le banc crierait sur la moitié
  //    des animations du site.
  await essai('will-change:opacity (ne piège pas)',
    `.site-h{will-change:opacity}${FIXE}`, arbre('site site-h'), false);
  // ⑥ CONDITIONS DISJOINTES — le piège vit au-dessus de 1200 px, le fixed
  //    en dessous de 1040. Aucun visiteur ne voit les deux. ⛔ Crier ici serait
  //    un faux rouge, et un faux rouge se fait désarmer en trois jours.
  await essai('conditions disjointes (ne piège pas)',
    `@media (min-width:1200px){.site-h{transform:translateZ(0)}}${FIXE}`, arbre('site site-h'), false);
  // ⑦ L'ANCÊTRE N'EST PAS SUR LE CHEMIN — même propriété, autre branche.
  await essai('propriété sur une autre branche (ne piège pas)',
    `.ailleurs{backdrop-filter:blur(9px)}${FIXE}`,
    `<div class="ailleurs">x</div>${arbre('site')}`, false);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(
  indecidables && !echecs ? `\n⚠️  ${indecidables} point(s) INDÉCIDABLE(S) — rien n'est déclaré conforme\n`
  : echecs ? `\n❌ ${echecs} écart(s)\n`
  : '\n✅ aucun `position:fixed` piégé par un ancêtre\n');
process.exit(echecs ? 1 : indecidables ? 2 : 0);
