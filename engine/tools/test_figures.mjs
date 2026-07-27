// =============================================================================
//  test_figures.mjs — le garde-fou des FIGURES DE DONNÉES
//  ⚠️ VeVePreda/veve-sites — engine/tools/test_figures.mjs
//      SITE=vevewiki npm run test:figures
//
//  Ce que ces contrôles protègent, et pourquoi ça vaut un fichier de tests :
//  une figure part se faire partager SANS sa page. Si elle perd sa source, sa
//  date de collecte ou sa marque, elle devient une image anonyme qui circule
//  avec nos chiffres. Et si elle cesse d'être autonome, elle se rastérise en
//  noir sur noir sans que personne ne le voie avant le partage.
// =============================================================================
import process from 'node:process';
process.env.SITE = process.env.SITE || 'vevewiki';

const { figureSVG, figureHTML, verifierFigure } = await import('../lib/figures.mjs');
const { renderMarkdown } = await import('../lib/markdown.mjs');

let ok = 0, ko = 0;
const dit = (b, quoi, detail = '') => {
  if (b) { ok += 1; console.log(`  ✅ ${quoi}`); }
  else { ko += 1; console.log(`  ❌ ${quoi}${detail ? ` — ${detail}` : ''}`); }
};
const CTX = { lang: 'fr', marque: 'VeVe Wiki', domaine: 'vevewiki.com',
  palette: { primary: '#d4af37', accent: '#c0c5ce', bg: '#0c0d10', surface: '#16181d', text: '#e7e9ee', muted: '#9aa0ab' } };
const BASE = { id: 'demo', type: 'barres', titre: { fr: 'Titre', en: 'Title' },
  source: { fr: 'entrepôt on-chain', en: 'on-chain warehouse' }, collecte: '2026-07-27',
  donnees: [{ label: 'un', valeur: 10 }, { label: 'deux', valeur: 30 }] };

console.log('\n1. Un descripteur incomplet est REFUSÉ, pas rendu au mieux');
dit(verifierFigure(BASE, 'demo').length === 0, 'un descripteur complet passe');
for (const champ of ['collecte', 'source', 'titre', 'type']) {
  const f = { ...BASE }; delete f[champ];
  dit(verifierFigure(f, 'demo').length > 0, `sans « ${champ} » : refusé`);
}
dit(verifierFigure({ ...BASE, donnees: [] }, 'demo').length > 0, 'sans donnée : refusé');

console.log('\n2. Le SVG est AUTONOME (il sera rastérisé hors de la page)');
const svg = figureSVG(BASE, CTX);
dit(svg.includes('xmlns="http://www.w3.org/2000/svg"'), 'le xmlns est présent (sans lui, pas d\'image)');
dit(/width="\d+"/.test(svg) && /height="\d+"/.test(svg), 'width et height explicites, pas seulement le viewBox');
dit(!svg.includes('var(--'), 'aucune variable CSS (elle deviendrait noire une fois rastérisée)');
dit(!/class="/.test(svg), 'aucune classe : le SVG ne dépend d\'aucune feuille de style');
dit(svg.includes('#d4af37'), 'les couleurs du manifeste sont écrites en dur');

console.log('\n3. Le cartouche — une image partagée reste attribuable');
dit(svg.includes('VeVe Wiki'), 'la marque est dans l\'image');
dit(svg.includes('vevewiki.com'), 'le domaine est dans l\'image');
dit(svg.includes('entrepôt on-chain'), 'la source est dans l\'image');
dit(svg.includes('27 juillet 2026'), 'la date de COLLECTE est écrite en toutes lettres');
dit(figureSVG(BASE, { ...CTX, lang: 'en' }).includes('27 July 2026'), 'et dans la langue du lecteur');

console.log('\n4. Les trois types tracent, et rien n\'est inventé');
for (const [type, donnees] of [['barres', BASE.donnees], ['series', BASE.donnees],
  ['jalons', [{ label: '2020', valeur: 'DC' }]]]) {
  const s = figureSVG({ ...BASE, type, donnees }, CTX);
  dit(s.length > 400 && s.startsWith('<svg'), `type « ${type} » : tracé`);
}
dit(figureSVG({ ...BASE, type: 'inconnu' }, CTX) === '', 'un type inconnu ne trace RIEN (plutôt qu\'à peu près)');

console.log('\n5. Échappement — un libellé n\'est pas du code');
const mechant = figureSVG({ ...BASE, donnees: [{ label: '<script>x</script>', valeur: 1 }] }, CTX);
dit(!mechant.includes('<script>'), 'un libellé contenant du HTML est échappé');

console.log('\n6. Le téléchargement — un nom de fichier qui se comprend seul');
const html = figureHTML(BASE, CTX);
dit(html.includes('data-fig-nom="vevewiki.com-demo-2026-07-27"'), 'domaine + identifiant + date de collecte');
// ⚠️ Le bouton NE DOIT PAS porter `hidden` : il faudrait alors du JavaScript
// pour le retirer, et ce script est servi dans le <head> — il s'exécute avant
// que le <body> n'existe, ne trouve aucun bouton, et sort. Le bouton
// n'apparaissait jamais. C'est le CSS (`.js .fig .fig-dl`) qui décide.
dit(html.includes('<button') && !/<button[^>]*hidden/.test(html),
  'le bouton ne dépend PAS d\'un JavaScript qui irait le chercher dans le DOM');
dit(html.includes('<figure') && html.includes('<figcaption'), 'structure sémantique figure/figcaption');

console.log('\n7. Markdown — une figure seule est un BLOC, jamais dans un <p>');
const rendu = renderMarkdown('Texte.\n\n![Légende](figure:demo)\n\nSuite.',
  { figure: (id, leg) => `<figure class="fig">${id}|${leg}</figure>` });
dit(!/<p>\s*<figure/.test(rendu), 'pas de <figure> dans un <p> (HTML invalide)');
dit(rendu.includes('demo|Légende'), 'l\'identifiant et la légende arrivent au moteur');
dit(renderMarkdown('![x](/img/a.png)', {}).includes('<img'), 'une vraie image reste une image');

console.log('\n8. Liens internes d\'un corps de Sheet — le piège i18n');
const fr = renderMarkdown('Voir le [glossaire](/glossary/) et [X](https://x.com).',
  { localiser: (u) => `/fr${u}` });
dit(fr.includes('href="/fr/glossary/"'), 'un renvoi interne suit la langue du lecteur');
dit(fr.includes('href="https://x.com"'), 'un lien externe n\'est JAMAIS réécrit');
dit(renderMarkdown('[g](/glossary/)', {}).includes('href="/glossary/"'), 'sans localiser, rien ne change');

console.log(`\n${ko === 0 ? '✅ figures : tout est vert' : `❌ ${ko} contrôle(s) en échec`} (${ok + ko} contrôles)\n`);
process.exit(ko === 0 ? 0 : 1);
