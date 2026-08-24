/* ═══════════════════════════════════════════════════════════════════════════
   CASCADE RÉSOLUE — « qui GAGNE sur cet élément ? »
   ═══════════════════════════════════════════════════════════════════════════
   ⭐⭐ ÉCRIT LE 24/08/2026, APRÈS AVOIR DÉFENDU PENDANT DIX-HUIT JOURS UNE
   RÈGLE QUI N'A JAMAIS PEINT. `themes/vitrine/theme.css` posait
   `main{padding:… var(--s8)}` — 88 px d'air avant le pied de page — avec douze
   lignes de commentaire pour expliquer pourquoi un padding et pas une marge.
   Mesuré sur la feuille servie en production : ce padding valait **0**.
   `Base.astro` émet `<main class="wrap">`, et `.wrap{padding:0 24px}` gagne :
   une CLASSE (0,1,0) bat un ÉLÉMENT (0,0,1) quel que soit l'ordre.

   ⭐⭐⭐ LES DEUX AUTRES OUTILS POSAIENT UNE AUTRE QUESTION.
     · `css-mort.mjs`       — « cette règle EXISTE-t-elle ? »       → oui
     · `cascade-aplatie.mjs` — « la version mobile FUIT-elle ? »     → non
   Aucun des deux ne pouvait voir le défaut. Celui-ci pose la troisième, et
   c'est la seule qui décide de ce qu'on voit à l'écran.

   Usage :
     node outils/cascade-resolue.mjs <feuille.css> <page.html> [sélecteur] [largeur]
   Exemple, sur ce qui est SERVI (et pas sur le dépôt) :
     curl -s https://veveprice.com/analytics/            -o /tmp/p.html
     curl -s https://veveprice.com/theme-<empreinte>.css -o /tmp/t.css
     node outils/cascade-resolue.mjs /tmp/t.css /tmp/p.html main 1280

   ⛔ CE QU'IL NE FAIT PAS — à lire avant de s'en servir : il ne résout pas
   `var()`, n'applique ni héritage ni layout, ne connaît que `min/max-width` en
   px, ignore `@supports` et `@container`. Il répond à UNE question.
   ⭐ Le moteur vit dans `engine/tools/_cascade.mjs` — le même que celui du banc
   `test:feuille`, et il n'a AUCUNE dépendance hors `linkedom` (déjà déclaré).
   Deux instruments qui répondraient séparément finiraient par diverger.
   ═══════════════════════════════════════════════════════════════════════════ */
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { decouper, quiGagne } from '../engine/tools/_cascade.mjs';

const [, , fCss, fHtml, sel = 'main', largeurA] = process.argv;
if (!fCss || !fHtml) {
  console.error('usage : node outils/cascade-resolue.mjs <feuille.css> <page.html> [sélecteur] [largeur]');
  process.exit(2);
}
const LARGEURS = largeurA ? [Number(largeurA)] : [1280, 390];
const { document } = parseHTML(readFileSync(fHtml, 'utf8'));
const el = document.querySelector(sel);
if (!el) { console.error(`« ${sel} » est absent de ${fHtml} — rien à mesurer.`); process.exit(2); }

const { regles, anomalies } = decouper(readFileSync(fCss, 'utf8'));
console.log(`\n${regles.length} règle(s) lue(s) dans ${fCss}`);
if (anomalies.length) {
  console.log(`\n⚠️  ${anomalies.length} anomalie(s) de découpage — un navigateur les jette EN SILENCE :`);
  for (const a of anomalies.slice(0, 12)) console.log(`     ~L${a.ligne}  ${a.quoi} : « ${a.texte} »`);
  if (anomalies.length > 12) console.log(`     … et ${anomalies.length - 12} autre(s)`);
}

// Les propriétés qu'on résout, et le raccourci qui peut les poser aussi.
const SUJETS = [
  ['padding-top', ['padding', 0]], ['padding-right', ['padding', 1]],
  ['padding-bottom', ['padding', 2]], ['padding-left', ['padding', 3]],
  ['margin-top', ['margin', 0]], ['margin-bottom', ['margin', 2]],
  ['border-radius', null], ['width', null], ['height', null], ['border', null],
  ['display', null], ['position', null], ['background', null], ['color', null],
];
for (const largeur of LARGEURS) {
  console.log(`\n── « ${sel} » à ${largeur} px ──`);
  for (const [prop, racc] of SUJETS) {
    const g = quiGagne(regles, el, prop, largeur, racc);
    if (!g) continue;
    console.log(`   ${prop.padEnd(17)} = ${String(g.val).padEnd(24)} ⟵ ${g.sel}`
      + `  (spec ${g.spec.join(',')}${g.imp ? ' !important' : ''}${g.media ? ' · @' + g.media.trim() : ''})`);
  }
}
console.log('');
