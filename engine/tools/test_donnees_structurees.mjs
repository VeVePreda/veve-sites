// test_donnees_structurees.mjs — les donnees structurees des pages editoriales
//
//   node engine/tools/test_donnees_structurees.mjs
//
// ⚠️ DEPOT : VeVePreda/veve-sites  ·  CHEMIN : engine/tools/test_donnees_structurees.mjs
//
// ⭐ POURQUOI CE TEST EXISTE
// Une donnee structuree est une PROMESSE faite a un moteur. Elle a deux facons
// de mal tourner, et aucune des deux ne fait echouer un build :
//   1. elle DISPARAIT — quelqu'un retire le `ld={...}` d'un gabarit, la page
//      reste parfaitement valide, et 87 termes definis cessent d'exister pour
//      un moteur. C'est le motif « depose puis debranche », paye trois fois
//      dans ce projet ;
//   2. elle MENT — un `DefinedTerm` sans definition, un `Event` avec une date
//      inventee, un `Article` sur une page qui n'en est pas un. La page est
//      alors « valide, seulement fausse » : le mode de panne le plus cher d'ici.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { definedTermSetLd, chronologieLd, pageAProposLd, itemListLd } from '../lib/seo.mjs';

const F = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const dit = (b, quoi, detail = '') => {
  if (b) { ok++; console.log(`  ✅ ${quoi}`); }
  else { ko++; console.log(`  ❌ ${quoi}${detail ? ` — ${detail}` : ''}`); }
};

console.log('\n1. Les fabriques ne promettent que ce qu\'elles ont');
{
  const set = definedTermSetLd({
    name: 'Glossaire', url: 'https://x.test/glossary/',
    termes: [
      { name: 'Gem', description: 'la monnaie interne', url: 'https://x.test/glossary/#gem' },
      { name: 'SansDefinition' },
      { name: 'Vide', description: '' },
    ],
  });
  dit(set['@type'] === 'DefinedTermSet', 'un glossaire est un DefinedTermSet');
  dit(set.hasDefinedTerm.length === 1,
    'une entree SANS definition est ecartee',
    `${set.hasDefinedTerm.length} terme(s) retenu(s) au lieu de 1 — un DefinedTerm sans description n'apprend rien`);
  dit(set.hasDefinedTerm[0].inDefinedTermSet === 'https://x.test/glossary/',
    'chaque terme sait a quel ensemble il appartient');

  const vide = definedTermSetLd({ name: 'x', url: 'https://x.test/', termes: [] });
  dit(!('hasDefinedTerm' in vide), 'un ensemble sans aucun terme n\'annonce pas une liste vide');
}

console.log('\n2. Une date imprecise reste imprecise');
{
  const c = chronologieLd([
    { name: 'jour', date: '2020-10-13' },
    { name: 'mois', date: '2020-10' },
    { name: 'annee', date: '2020' },
    { name: 'flou', date: 'vers 2021' },
    { name: 'rien', date: '' },
  ], 'https://x.test/history/');
  const dates = c.itemListElement.map((x) => x.item.startDate);
  dit(dates[0] === '2020-10-13' && dates[1] === '2020-10' && dates[2] === '2020',
    'les dates ISO (jour, mois, annee) sont declarees', JSON.stringify(dates));
  dit(dates[3] === undefined && dates[4] === undefined,
    'une date NON ISO ne devient pas une startDate',
    'completer « vers 2021 » ferait dire au moteur ce que la page ne dit pas');
  dit(c.itemListElement.every((x) => x.item['@type'] === 'Event'),
    'un jalon date est un Event');
}

console.log('\n3. Une fiche de marque ne se declare pas comme un article');
{
  const w = pageAProposLd({ name: 'Voltron', description: 'd', url: 'https://x.test/brands/voltron/' });
  dit(w['@type'] === 'WebPage', 'la fiche est une WebPage');
  dit(w.about && w.about['@type'] === 'Brand', 'elle declare l\'entite dont elle parle');
  dit(JSON.stringify(w).indexOf('"Article"') === -1,
    'elle n\'emet PAS d\'Article',
    'une note de 30 caracteres et des chiffres calcules ne sont pas un article ; '
    + 'Google pese le contenu maigre au niveau du SITE');
}

console.log('\n4. Aucune cle vide ne fuit dans le JSON-LD');
{
  const objets = [
    definedTermSetLd({ name: 'x', url: 'u', termes: [{ name: 'a', description: 'b' }] }),
    chronologieLd([{ name: 'a', date: '' }], 'u'),
    pageAProposLd({ name: 'a', url: 'u' }),
    itemListLd([{ name: 'a' }], 'u'),
  ];
  const fuite = objets.flatMap((o) => JSON.stringify(o).match(/:(null|"")/g) || []);
  dit(fuite.length === 0, 'ni `null` ni chaine vide dans le JSON-LD produit',
    `${fuite.length} valeur(s) vide(s) — une cle vide est une promesse vide, pas une absence`);
}

console.log('\n5. Les gabarits sont vraiment BRANCHES dessus');
// ⭐ Les quatre sections precedentes prouvent que les fabriques sont justes.
//   Rien ne prouvait qu'elles sont APPELEES. C'est exactement l'ecart qui a
//   coute trois fois a ce projet : le code existe, il est juste, il ne sert
//   a rien, et aucun journal ne differe.
{
  const ED = readFileSync(F('../../src/components/pages/Editorial.astro'), 'utf8');
  dit(/ld=\{ldSection\}/.test(ED), 'Editorial.astro passe ses donnees structurees a Base',
    'sans `ld={ldSection}`, le calcul se fait et le resultat n\'est jamais emis');
  for (const [section, fabrique] of [
    ['glossary', 'definedTermSetLd'], ['acronyms', 'definedTermSetLd'],
    ['history', 'chronologieLd'], ['annuaire', 'itemListLd'],
  ]) {
    const bloc = new RegExp(`section === '${section}'[\\s\\S]{0,900}?${fabrique}\\(`);
    dit(bloc.test(ED), `« ${section} » est declare avec ${fabrique}`);
  }
  const EN = readFileSync(F('../../src/components/pages/EditorialEntry.astro'), 'utf8');
  dit(/const ld = \[\s*\n?\s*pageAProposLd\(/.test(EN),
    'EditorialEntry.astro declare l\'entite dont la fiche parle',
    'la fiche retomberait sur le seul fil d\'Ariane');
}

console.log(`\n${ko === 0 ? '✅ donnees structurees : tout est vert' : `❌ ${ko} controle(s) en echec`} (${ok + ko} controles)\n`);
process.exit(ko === 0 ? 0 : 1);
