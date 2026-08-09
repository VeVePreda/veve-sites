// ⚠️ VeVePreda/veve-sites — engine/tools/test_opacite.mjs   (FICHIER NEUF)
//
// ═══════════════════════════════════════════════════════════════════════════
//  LOT 111 — UN ÉTAT DE DÉPART SANS ÉTAT D'ARRIVÉE
// ═══════════════════════════════════════════════════════════════════════════
//  Le 09/08/2026, Preda signale « le bouton menu ne fonctionne pas ». Il
//  fonctionnait. Le JavaScript retirait `hidden`, le panneau passait en
//  `display:grid`, il occupait sa place, il répondait au clavier et à Échap.
//  Il était TRANSPARENT :
//
//      .deplie__m{ opacity:0; transform:translateY(-8px) scale(.98) }
//
//  ...et rien, nulle part dans les 168 850 octets de la feuille, ne remettait
//  `opacity:1`. Un état de départ d'animation dont l'état d'arrivée n'a jamais
//  été écrit.
//
//  ⭐⭐⭐ POURQUOI AUCUN DES 27 BANCS NE POUVAIT LE VOIR. Le HTML est juste. Le
//  script est juste. La structure est juste. `test:entete` vérifie la présence
//  des éléments, `test:feuille` vérifie que le thème est servi au caractère
//  près, `test:gabarits` vérifie la forme des fichiers. Un élément transparent
//  PASSE TOUS LES CONTRÔLES DE STRUCTURE — il est là, il est bien formé, il est
//  au bon endroit. C'est le seul défaut de cette famille qui n'a pas de
//  symptôme structurel, et c'est pour ça qu'il a tenu.
//
//  ⭐⭐ ET IL Y EN AVAIT UN DEUXIÈME, QUE PERSONNE N'AVAIT SIGNALÉ :
//
//      .grille>*{ opacity:0 }                              ← à la racine
//      @media (prefers-reduced-motion: no-preference){
//        .revele{ animation:monte … }                      ← ce qui le relève
//      }
//
//  L'état de repos s'appliquait à TOUT LE MONDE ; ce qui le levait n'existait
//  que pour ceux qui n'ont PAS demandé de réduire les animations. Pour les
//  autres — un réglage système courant — les cartes de l'accueil, des sets et
//  du Market étaient invisibles. Le site était vide, et ils croyaient à une
//  panne. ⛔ Personne dans l'équipe n'a ce réglage, donc personne ne l'a vu.
//
// ═══════════════════════════════════════════════════════════════════════════
//  LA RÈGLE QUE CE BANC ÉMET, EN UNE PHRASE
// ═══════════════════════════════════════════════════════════════════════════
//  **Un état de repos ne doit jamais s'appliquer plus largement que ce qui le
//  lève.** Deux contrôles mécaniques en découlent :
//
//    ① `opacity:0` posé HORS de toute `@media` exige un releveur HORS de toute
//       `@media`, partageant au moins un jeton de classe.
//    ② `opacity:0` posé SOUS une `@media` est accepté si cette condition est
//       `prefers-reduced-motion: no-preference` — c'est exactement la parade :
//       l'état de repos ne vit que là où une animation existe pour le lever.
//       Sinon il lui faut un releveur sous la MÊME condition.
//
//  ⛔ CE BANC N'EST PAS UN MOTEUR DE RENDU. Il ne sait pas si un sélecteur
//  atteint un élément réel — `test:gabarits` et le compilateur ne le savent pas
//  non plus. Il attrape la faute de FORME qui a coûté ce lot, en quelques
//  millisecondes et sans dépendance. C'est tout ce qu'on lui demande.
//
//  ⚠️ IL LIT LA FEUILLE SERVIE, PAS LES FICHIERS DE THÈME. `feuille_theme.mjs`
//  concatène fontes + variables + thème + socle : une règle peut naître dans le
//  socle et en relever une du thème. Juger les fichiers séparément ferait crier
//  sur des paires parfaitement valides — c'est le défaut d'instrument du lot
//  105, « validé sur un échantillon n'est pas validé », transposé au découpage.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ⚠️ ON NE PEUT PAS IMPORTER `feuille_theme.mjs` : il assemble la feuille avec
// `import.meta.glob('?raw')`, une primitive de Vite qui n'existe pas sous Node
// nu — et il DOIT le rester (le Dockerfile ne copie pas `themes/` dans l'image
// de runtime ; un `readFileSync` là-bas marcherait partout sauf en production).
// ⭐ On relit donc les mêmes sources, dans le MÊME ordre, et on y ajoute le
// socle EXTRAIT DU MODULE plutôt que recopié : un socle recopié ici divergerait
// du socle servi, et un banc qui juge une feuille qui n'est pas la vraie ne
// juge rien. *Un texte ne s'importe pas, il se recopie — sauf quand on peut
// aller le chercher.*
const R = new URL('../..', import.meta.url).pathname;
const DOSSIER = join(R, 'themes');
const THEMES = readdirSync(DOSSIER).sort();
const SRC_FEUILLE = readFileSync(join(R, 'engine/lib/feuille_theme.mjs'), 'utf8');
const mSocle = SRC_FEUILLE.match(/const SOCLE = `([\s\S]*?)`;/);
if (!mSocle) {
  console.log('  ❌ le socle est introuvable dans feuille_theme.mjs — ce banc jugerait une feuille incomplète');
  process.exit(1);
}
const SOCLE = mSocle[1];
const feuilleDe = (cle) => readFileSync(join(DOSSIER, cle, 'theme.css'), 'utf8') + SOCLE;

let echecs = 0;
const dire = (ok, msg) => { if (!ok) echecs++; console.log(`  ${ok ? '✅' : '❌'} ${msg}`); };

/** Les jetons de classe d'un sélecteur. `.grille>*` → ['grille'].
 *  ⚠️ On garde les pseudo-classes HORS des jetons : `.deplie__m:not([hidden])`
 *  doit partager `deplie__m` avec `.deplie__m`, sinon aucune paire ne tient. */
const jetons = (sel) => [...new Set((sel.match(/\.[A-Za-z0-9_-]+/g) || [])
  .map((c) => c.slice(1)))];

/** Découpe une feuille en règles, en gardant la CONDITION @media de chacune.
 *  ⭐ Écrit à la main plutôt qu'avec une dépendance : le Dockerfile n'installe
 *  rien pour les bancs, et un banc qui exige un paquet est un banc qui se tait
 *  le jour où il n'est pas là (c'est `test:nginx` sans `crossplane`, déjà payé). */
function regles(css) {
  // ⚠️ On retire les commentaires AVANT tout : un commentaire peut contenir
  // « opacity:0 » — et un contrôle qui lit les commentaires trouve les défauts
  // que les commentaires DÉCRIVENT. Payé le 09/08 sur `etat_reel.py`.
  const propre = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [], pile = [];
  let i = 0, debut = 0;
  // 🔴 PREMIÈRE VERSION FAUSSE, ET ELLE MENTAIT EN SILENCE : elle repérait
  // l'ouverture d'une `@media` mais ne consommait jamais sa FERMETURE. Les
  // règles écrites APRÈS le bloc héritaient donc de sa condition — donc
  // `.flottantes img.ok{opacity:.35}` et `.grille>*` se retrouvaient rangés
  // sous des conditions qu'ils n'ont pas, et les paires ne se voyaient plus.
  // ⭐ Le banc rougissait sur du code juste, pour une raison qui n'avait rien
  // à voir avec ce qu'il prétendait mesurer. *Un banc peut être rouge pour de
  // mauvaises raisons* — on ne croit pas un instrument sur parole.
  while (i < propre.length) {
    const c = propre[i];
    if (c === '{') {
      const tete = propre.slice(debut, i).trim();
      if (tete.startsWith('@')) {
        // `@keyframes` et consorts sont empilés pour que leur `}` se referme
        // correctement, mais ils ne PORTENT pas de condition.
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

const OPACITE = /(^|;)\s*opacity\s*:\s*([^;!]+)/i;
const valeurOpacite = (corps) => { const m = corps.match(OPACITE); return m ? m[2].trim() : null; };
const REPOS = /^0?(\.0+)?$/;                       // 0, 0.0, .0 — et rien d'autre

/** ⭐ LA CONDITION QUI EST UNE PARADE, PAS UN CONTOURNEMENT.
 *  Un état de repos enfermé sous `no-preference` ne s'applique QUE là où une
 *  animation existe pour le lever. C'est la seule condition qui rend l'état de
 *  repos plus étroit que ce qui le relève, donc la seule qu'on accepte seule. */
const PARADE = /prefers-reduced-motion\s*:\s*no-preference/;

console.log('\n═══ LOT 111 — aucun état de repos plus large que ce qui le lève ═══');

for (const cle of THEMES) {
  const css = feuilleDe(cle);
  const rs = regles(css);
  const setters = rs.filter((r) => { const v = valeurOpacite(r.corps); return v !== null && REPOS.test(v); });
  const releveurs = rs.filter((r) => {
    const v = valeurOpacite(r.corps);
    return (v !== null && !REPOS.test(v)) || /(^|;)\s*animation\s*:/i.test(r.corps);
  });

  let mauvais = [];
  for (const s of setters) {
    if (s.cond && PARADE.test(s.cond)) continue;         // ② la parade
    const t = jetons(s.sel);
    if (!t.length) continue;                             // sélecteur sans classe : hors de portée
    const parle = (r) => r !== s && jetons(r.sel).some((x) => t.includes(x));
    // ① un releveur sous la MÊME condition (ou sans condition) suffit.
    const direct = releveurs.some((r) => parle(r) && (!r.cond || r.cond === s.cond));
    // ⭐⭐⭐ ③ — CE CAS-CI, C'EST LE BANC QUI ME L'A APPRIS À SON PREMIER RUN.
    // Il criait sur `.flottantes img{opacity:0}`. À tort : ce sélecteur a DEUX
    // releveurs, une animation sous `no-preference` et une opacité fixe sous
    // `reduce`. Aucun des deux n'est « au moins aussi large » que la racine —
    // et ENSEMBLE ils épuisent l'espace, parce que ces deux conditions sont
    // complémentaires par construction : tout visiteur est dans l'une ou dans
    // l'autre, jamais dans aucune.
    // ⛔ MA PREMIÈRE RÉACTION A ÉTÉ DE VOULOIR CORRIGER `.flottantes`. C'était
    // le code qui avait raison et l'instrument qui avait tort — et `.flottantes`
    // portait, écrit d'avance, l'idiome exact qui manquait à `.grille>*`.
    // ⭐⭐ *On corrige l'instrument, jamais le code pour lui plaire.* Ici le
    // détour a payé deux fois : le banc est juste, et le correctif du défaut
    // réel est devenu une COPIE d'un motif déjà présent dans la feuille, au
    // lieu d'une troisième façon de faire.
    const moities = releveurs.filter(parle).map((r) => r.cond).filter(Boolean);
    const couvre = moities.some((c) => /no-preference/.test(c))
                && moities.some((c) => /prefers-reduced-motion\s*:\s*reduce/.test(c));
    const ok = direct || couvre;
    if (!ok) mauvais.push(`${s.sel.slice(0, 70)}${s.cond ? `  [sous ${s.cond.slice(0, 46)}]` : ''}`);
  }

  dire(mauvais.length === 0,
    `${cle} — ${setters.length} état(s) de repos, ${releveurs.length} releveur(s)`
    + (mauvais.length ? `\n     ⛔ SANS RELEVEUR ATTEIGNABLE :\n       · ` + mauvais.join('\n       · ')
       + '\n     ⭐ Soit une règle le relève sous la MÊME condition, soit'
       + '\n       l\'état de repos descend sous `prefers-reduced-motion: no-preference`.' : ''));
}

console.log(echecs === 0
  ? '\n✅ tout état de repos a de quoi être levé\n'
  : `\n❌ ${echecs} thème(s) en défaut\n`);
process.exit(echecs ? 1 : 0);
