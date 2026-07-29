// =============================================================================
//  test_blog.mjs — preuve que le blog HYBRIDE (Sheet + Markdown) se comporte
//
//  ⚠️ CE FICHIER VA DANS LE DÉPÔT  VeVePreda/veve-sites , dans  engine/tools/
//     (chemin exact : engine/tools/test_blog.mjs)
//
//      npm run test:blog
//
//  CE QU'ON TESTE, ET POURQUOI. Le blog a maintenant DEUX entrées : une ligne
//  de Sheet et un fichier `.md`. Les régressions de ce genre sont invisibles —
//  le site reste valide, il publie simplement un brouillon, ou en avale un.
//  On vérifie donc les quatre garde-fous qui coûtent cher s'ils lâchent :
//    1. la PUBLICATION PROGRAMMÉE (`publish` futur = retenu, vide = brouillon,
//       `statut: brouillon` et `publie: FAUX` = masqués) ;
//    2. le rendu Markdown du Sheet et son ÉCHAPPEMENT (une cellule n'est pas
//       une entrée de code : `<script>` et `javascript:` sont neutralisés) ;
//    3. le lien entre TRADUCTIONS (`translation_key`) malgré des slugs différents ;
//    4. `blogEnabled()` : un site qui n'active pas `blog` n'a pas de lien de nav ;
//    5. le LECTEUR DE DATES partage avec editorial.mjs (`parseDay`/`canonDate`),
//       parce qu'un Sheet reformate renvoie « 27/07/2026 » et non « 2026-07-27 » —
//       et que la chronologie se trie sur cette chaine.
//
//  Chaque scénario tourne dans un PROCESSUS SÉPARÉ : manifeste et snapshots sont
//  mémoïsés au premier appel (comme test_quotas.mjs), donc on ne peut pas
//  évaluer deux manifestes différents dans le même processus.
// =============================================================================
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BLOG = JSON.stringify(join(RACINE, 'engine', 'lib', 'blog.mjs'));
const MD = JSON.stringify(join(RACINE, 'engine', 'lib', 'markdown.mjs'));
const base = mkdtempSync(join(tmpdir(), 'blog-'));
let echecs = 0;

const MANIFESTE = (pages) => `
site:
  domain: exemple.test
  brand: "Test"
languages:
  default: en
  active: [en, fr]
rendering: static
identity:
  theme: aurora
  palette: {}
  fonts: {}
seo: {}
content:
  data_modules: []
editorial:
  sheet_id: "TEST"
  pages: [${pages.join(', ')}]
`;

/** Prépare une racine de projet jetable : manifeste + snapshot blog.json. */
function racine(nom, { pages = ['glossary', 'blog'], lignes = [] }) {
  const root = join(base, nom);
  mkdirSync(join(root, 'sites', 'test', 'editorial'), { recursive: true });
  mkdirSync(join(root, 'engine', 'i18n'), { recursive: true });
  writeFileSync(join(root, 'sites', 'test', 'manifest.yml'), MANIFESTE(pages));
  writeFileSync(join(root, 'sites', 'test', 'editorial', 'blog.json'),
    JSON.stringify(lignes, null, 2));
  writeFileSync(join(root, 'engine', 'i18n', 'en.json'), '{}');
  return root;
}

/** Exécute du code dans un processus neuf, avec sa propre racine de projet. */
function dans(root, code) {
  const f = join(base, `run-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(f, code);
  const r = spawnSync(process.execPath, [f], {
    encoding: 'utf8',
    env: { ...process.env, PROJECT_ROOT: root, SITE: 'test', BUILD_DATE: '2026-07-27' },
  });
  return { code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

function verifier(nom, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${nom}`); return; }
  echecs++;
  console.log(`  ❌ ${nom}${detail ? `\n     ${detail}` : ''}`);
}

// ---------------------------------------------------------------------------
console.log('\n1. Publication programmée (le Sheet décide du JOUR de sortie)');
// ---------------------------------------------------------------------------
const lignes = [
  { slug: 'sorti', translation_key: 'a', lang: 'en', titre: 'Sorti',
    body: 'Corps visible.', publish: '2026-07-20', date: '2026-07-20', statut: 'publie' },
  { slug: 'aujourdhui', translation_key: 'b', lang: 'en', titre: "Aujourd'hui",
    body: 'Corps du jour.', publish: '2026-07-27', date: '2026-07-27', statut: 'publie' },
  { slug: 'futur', translation_key: 'c', lang: 'en', titre: 'Futur',
    body: 'Pas encore.', publish: '2026-12-01', date: '2026-12-01', statut: 'publie' },
  { slug: 'sans-date', translation_key: 'd', lang: 'en', titre: 'Sans date',
    body: 'Brouillon implicite.', publish: '', statut: 'publie' },
  { slug: 'brouillon', translation_key: 'e', lang: 'en', titre: 'Brouillon',
    body: 'Non.', publish: '2026-07-01', statut: 'brouillon' },
  { slug: 'depublie', translation_key: 'f', lang: 'en', titre: 'Dépublié',
    body: 'Non plus.', publish: '2026-07-01', statut: 'publie', publie: 'FAUX' },
];
{
  const root = racine('gate', { lignes });
  const r = dans(root, `
    const { postsFor } = await import(${BLOG});
    const p = await postsFor('en');
    console.log(JSON.stringify(p.map((x) => x.slug).sort()));
  `);
  const vus = r.code === 0 ? JSON.parse(r.out.split('\n').pop()) : [];
  verifier('un article daté d\'hier est publié', vus.includes('sorti'), r.err);
  verifier('un article daté du JOUR sort le jour dit', vus.includes('aujourdhui'), r.err);
  verifier('un article daté du FUTUR est retenu', !vus.includes('futur'), r.err);
  verifier('`publish` vide = brouillon', !vus.includes('sans-date'), r.err);
  verifier('`statut: brouillon` est masqué', !vus.includes('brouillon'), r.err);
  verifier('`publie: FAUX` est masqué', !vus.includes('depublie'), r.err);
}

// ---------------------------------------------------------------------------
console.log('\n2. Rendu du corps venu du Sheet (Markdown, et rien d\'autre)');
// ---------------------------------------------------------------------------
{
  const corps = [
    '## Un titre',
    '',
    'Un **gras**, un [lien](https://exemple.test/x), du `code`.',
    '',
    '- premier',
    '- second',
    '',
    '<script>alert(1)</script>',
    '',
    '[piege](javascript:alert(1))',
  ].join('\n');
  const root = racine('rendu', {
    lignes: [{ slug: 'rendu', translation_key: 'r', lang: 'en', titre: 'Rendu',
               body: corps, publish: '2026-07-01', statut: 'publie', tags: 'histoire, veve' }],
  });
  const r = dans(root, `
    const { postsFor } = await import(${BLOG});
    const [p] = await postsFor('en');
    console.log(JSON.stringify({ html: p.html, desc: p.data.description, tags: p.data.tags }));
  `);
  const o = r.code === 0 ? JSON.parse(r.out.split('\n').pop()) : { html: '', tags: [] };
  verifier('titre ## rendu en <h2>', o.html.includes('<h2>Un titre</h2>'), r.err);
  verifier('gras / lien / code rendus',
    o.html.includes('<strong>gras</strong>') && o.html.includes('href="https://exemple.test/x"')
      && o.html.includes('<code>code</code>'), o.html);
  verifier('liste rendue en <ul>', o.html.includes('<li>premier</li>'), o.html);
  verifier('HTML brut d\'une cellule NEUTRALISÉ',
    !o.html.includes('<script>') && o.html.includes('&lt;script&gt;'), o.html);
  verifier('lien javascript: neutralisé', !/href="javascript:/i.test(o.html), o.html);
  verifier('tags « a, b » découpés en liste',
    Array.isArray(o.tags) && o.tags.length === 2 && o.tags[0] === 'histoire', JSON.stringify(o.tags));
  verifier('description auto quand `excerpt` est vide', String(o.desc || '').length > 0, r.err);
}

// ---------------------------------------------------------------------------
console.log('\n3. Traductions reliées malgré des slugs différents');
// ---------------------------------------------------------------------------
{
  const root = racine('trad', {
    lignes: [
      { slug: 'the-first-drop', translation_key: 'premier-drop', lang: 'en', titre: 'The first drop',
        body: 'EN.', publish: '2026-07-01', statut: 'publie' },
      { slug: 'le-premier-drop', translation_key: 'premier-drop', lang: 'fr', titre: 'Le premier drop',
        body: 'FR.', publish: '2026-07-01', statut: 'publie' },
    ],
  });
  const r = dans(root, `
    const { translationPaths, postsFor } = await import(${BLOG});
    console.log(JSON.stringify({
      paths: await translationPaths('premier-drop'),
      fr: (await postsFor('fr')).map((p) => p.slug),
    }));
  `);
  const o = r.code === 0 ? JSON.parse(r.out.split('\n').pop()) : { paths: {}, fr: [] };
  verifier('EN et FR reliés par translation_key',
    o.paths.en === '/blog/the-first-drop/' && o.paths.fr === '/blog/le-premier-drop/',
    JSON.stringify(o.paths));
  verifier('chaque langue ne voit QUE ses articles',
    o.fr.length === 1 && o.fr[0] === 'le-premier-drop', JSON.stringify(o.fr));
}

// ---------------------------------------------------------------------------
console.log('\n4. blogEnabled() — la nav suit le manifeste');
// ---------------------------------------------------------------------------
{
  const avec = racine('avec', { pages: ['glossary', 'blog'], lignes: [] });
  const sans = racine('sans', { pages: ['glossary'], lignes: [] });
  const lire = (root) => dans(root, `
    const { blogEnabled } = await import(${BLOG});
    console.log(String(blogEnabled()));
  `);
  const a = lire(avec), s = lire(sans);
  verifier('`pages: [… blog]` -> blog actif', a.out.split('\n').pop() === 'true', a.err);
  verifier('sans `blog` -> pas de blog', s.out.split('\n').pop() === 'false', s.err);
}

// ---------------------------------------------------------------------------
console.log('\n5. Thèmes : pas de page pour un thème à un seul article');
// ---------------------------------------------------------------------------
{
  const root = racine('tags', {
    lignes: [
      { slug: 'a', translation_key: 'a', lang: 'en', titre: 'A', body: 'a', publish: '2026-07-01', tags: 'histoire, solo' },
      { slug: 'b', translation_key: 'b', lang: 'en', titre: 'B', body: 'b', publish: '2026-07-02', tags: 'histoire' },
    ],
  });
  const r = dans(root, `
    const { tagsFor } = await import(${BLOG});
    console.log(JSON.stringify(await tagsFor('en')));
  `);
  const o = r.code === 0 ? JSON.parse(r.out.split('\n').pop()) : [];
  verifier('un thème à 2 articles a sa page',
    o.some((x) => x.tag === 'histoire' && x.n === 2), JSON.stringify(o));
  verifier('un thème à 1 article n\'en a pas', !o.some((x) => x.tag === 'solo'), JSON.stringify(o));
}

// ---------------------------------------------------------------------------
console.log('\n6. markdown.mjs isolé (garde-fous d\'échappement)');
// ---------------------------------------------------------------------------
{
  const r = dans(base, `
    const { renderMarkdown, stripMarkdown } = await import(${MD});
    console.log(JSON.stringify({
      vide: renderMarkdown(''),
      guillemets: renderMarkdown('Il a dit "bonjour" & <b>parti</b>'),
      img: renderMarkdown('![chat](https://exemple.test/c.png)'),
      cite: renderMarkdown('> une citation'),
      nu: stripMarkdown('## Titre **gras** [lien](https://x)'),
    }));
  `);
  const o = r.code === 0 ? JSON.parse(r.out.split('\n').pop()) : {};
  verifier('corps vide -> chaîne vide', o.vide === '', JSON.stringify(o.vide));
  verifier('guillemets et balises échappés',
    String(o.guillemets).includes('&lt;b&gt;') && !String(o.guillemets).includes('<b>'), o.guillemets);
  verifier('image rendue avec lazy', String(o.img).includes('<img src="https://exemple.test/c.png"'), o.img);
  verifier('citation rendue en <blockquote>', String(o.cite).includes('<blockquote>'), o.cite);
  verifier('stripMarkdown rend du texte nu', o.nu === 'Titre gras lien', JSON.stringify(o.nu));
}

// ---------------------------------------------------------------------------
console.log('\n7. Onglet « COLONNES PAR LANGUE » (la vraie forme du Sheet vevewiki)');
// ---------------------------------------------------------------------------
// L'onglet Blog réel de vevewiki n'a PAS de colonne `lang` : il a `titre`,
// `publish`, `statut` et des familles `description_en/_fr`. Le lecteur doit donc
// accepter cette forme AUSSI, via le repli multilingue d'editorial.mjs.
{
  const root = racine('familles', {
    lignes: [
      { slug: 'histoire-veve', translation_key: 'histoire-veve', titre: 'Histoire de VeVe',
        publish: '2026-07-01', statut: 'publie', mots_cles: 'histoire, veve',
        description_en: 'The story.', description_fr: "L'histoire.",
        body_en: '## Story\n\nIn English.', body_fr: '## Histoire\n\nEn francais.' },
      { slug: 'sans-corps', translation_key: 'sans-corps', titre: 'Fiche sans corps',
        publish: '2026-07-01', statut: 'publie', description_en: 'No body yet.' },
    ],
  });
  const r = dans(root, `
    const { postsFor } = await import(${BLOG});
    const en = await postsFor('en'), fr = await postsFor('fr');
    console.log(JSON.stringify({
      en: en.map((p) => ({ slug: p.slug, html: p.html, desc: p.data.description, tags: p.data.tags })),
      fr: fr.map((p) => ({ slug: p.slug, html: p.html, desc: p.data.description })),
    }));
  `);
  const o = r.code === 0 ? JSON.parse(r.out.split('\n').pop()) : { en: [], fr: [] };
  verifier('un article par langue depuis UNE ligne',
    o.en.length === 1 && o.fr.length === 1, JSON.stringify(o).slice(0, 200) + (r.err || ''));
  verifier('chaque langue a SON corps',
    String(o.en[0]?.html).includes('In English') && String(o.fr[0]?.html).includes('En francais'),
    JSON.stringify([o.en[0]?.html, o.fr[0]?.html]));
  verifier('description_fr utilisée en FR', o.fr[0]?.desc === "L'histoire.", o.fr[0]?.desc);
  verifier('`mots_cles` accepté comme tags',
    Array.isArray(o.en[0]?.tags) && o.en[0].tags.includes('histoire'), JSON.stringify(o.en[0]?.tags));
  verifier('une ligne SANS corps n\'est pas publiée',
    !o.en.some((p) => p.slug === 'sans-corps'), JSON.stringify(o.en.map((p) => p.slug)));
}

// ---------------------------------------------------------------------------
console.log('\n8. Dates telles que Google Sheets les AFFICHE');
// ---------------------------------------------------------------------------
// Sheets convertit une date importee en VRAIE date, et la renvoie ensuite au
// format d'affichage de la cellule — donc « 27/07/2026 » si le classeur est en
// francais. Avec l'ancien lecteur, cette date devenait `null` = BROUILLON, et
// l'article disparaissait SANS erreur de build. C'est le scenario le plus
// couteux du lot : il ne se voit pas.
{
  const root = racine('dates', {
    lignes: [
      { slug: 'iso', translation_key: 'i', lang: 'en', titre: 'ISO',
        body: 'ok', publish: '2026-07-20', statut: 'publie' },
      { slug: 'francais', translation_key: 'f', lang: 'en', titre: 'FR',
        body: 'ok', publish: '20/07/2026', statut: 'publie' },
      { slug: 'francais-futur', translation_key: 'ff', lang: 'en', titre: 'FR futur',
        body: 'ok', publish: '01/12/2026', statut: 'publie' },
      { slug: 'points', translation_key: 'p', lang: 'en', titre: 'Points',
        body: 'ok', publish: '20.07.2026', statut: 'publie' },
      { slug: 'illisible', translation_key: 'x', lang: 'en', titre: 'Illisible',
        body: 'ok', publish: 'la semaine prochaine', statut: 'publie' },
    ],
  });
  const r = dans(root, `
    const { postsFor } = await import(${BLOG});
    const p = await postsFor('en');
    console.log(JSON.stringify(p.map((x) => [x.slug, new Date(x.data.date).toISOString().slice(0,10)])));
  `);
  const o = r.code === 0 ? JSON.parse(r.out.split('\n').pop()) : [];
  const vus = Object.fromEntries(o);
  verifier('« 2026-07-20 » publie', 'iso' in vus, JSON.stringify(o) + (r.err || ''));
  verifier('« 20/07/2026 » publie AUSSI', 'francais' in vus, JSON.stringify(o));
  verifier('« 20.07.2026 » publie aussi', 'points' in vus, JSON.stringify(o));
  verifier('la date FR est lue au BON jour', vus.francais === '2026-07-20', vus.francais);
  verifier('« 01/12/2026 » (futur) reste retenu', !('francais-futur' in vus), JSON.stringify(o));
  verifier('une date illisible ne publie pas (et journalise)',
    !('illisible' in vus) && /date illisible/.test(r.err), r.err.slice(0, 200));
}

// ---------------------------------------------------------------------------
console.log('\n9. History : la chronologie ne se melange pas');
// ---------------------------------------------------------------------------
// Les jalons sont TRIES sur la chaine de la date. Si le Sheet affiche
// « 01/03/2022 », un tri par chaine compare le JOUR avant l'ANNEE : la timeline
// part dans le desordre sans qu'aucune erreur ne soit levee. `canonDate` remet
// tout en ISO tronque a la precision AVANT que la page ne trie.
{
  const root = racine('histoire', { pages: ['history'], lignes: [] });
  const fs = await import('node:fs');
  fs.writeFileSync(join(root, 'sites', 'test', 'editorial', 'history.json'),
    JSON.stringify([
      { id: 'a', date: '17/10/2020', precision: 'jour', titre_en: 'Genese' },
      { id: 'b', date: '01/03/2022', precision: 'mois', titre_en: 'Mars 2022' },
      { id: 'c', date: '2021-05',    precision: 'mois', titre_en: 'Mai 2021' },
      { id: 'd', date: '2026',       precision: 'annee', titre_en: 'Annee seule' },
      { id: 'e', date: 'un jour',    precision: 'jour', titre_en: 'Illisible' },
    ]));
  const r = dans(root, `
    const { collection } = await import(${JSON.stringify(join(RACINE, "engine", "lib", "editorial.mjs"))});
    const { items } = await collection('history', 'en');
    const tri = items.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    console.log(JSON.stringify({ dates: items.map((x) => [x.id, x.date]), ordre: tri.map((x) => x.id) }));
  `);
  const o = r.code === 0 ? JSON.parse(r.out.split('\n').pop()) : { dates: [], ordre: [] };
  const d = Object.fromEntries(o.dates || []);
  verifier('« 17/10/2020 » canonise en 2020-10-17', d.a === '2020-10-17', JSON.stringify(o) + (r.err || ''));
  verifier('« 01/03/2022 » + precision mois -> 2022-03', d.b === '2022-03', d.b);
  verifier('une date deja ISO ne bouge pas', d.c === '2021-05', d.c);
  verifier('une annee seule reste une annee', d.d === '2026', d.d);
  verifier('une date illisible est conservee telle quelle', d.e === 'un jour', d.e);
  verifier('le tri chronologique est correct',
    JSON.stringify(o.ordre) === JSON.stringify(['a', 'c', 'b', 'd', 'e']), JSON.stringify(o.ordre));
}

// ---------------------------------------------------------------------------
console.log('\n10. Sources : « toute information porte un lien vers sa source »');
// ---------------------------------------------------------------------------
{
  const root = racine('sources', { pages: ['history'], lignes: [] });
  const r = dans(root, `
    const { parseSources } = await import(${JSON.stringify(join(RACINE, "engine", "lib", "editorial.mjs"))});
    console.log(JSON.stringify({
      url:    parseSources('https://www.veve.me/blog/veve/updates/omi-to-gems/'),
      duo:    parseSources('blog VeVe https://a.test/x ; Infos VeVe.docx'),
      libelle:parseSources('Infos VeVe.docx'),
      vide:   parseSources(''),
      lignes: parseSources('https://a.test/1\\nhttps://a.test/2').length,
    }));
  `);
  const o = r.code === 0 ? JSON.parse(r.out.split('\n').pop()) : {};
  verifier('une URL seule devient un lien',
    o.url && o.url[0].href === 'https://www.veve.me/blog/veve/updates/omi-to-gems/', JSON.stringify(o.url) + (r.err || ''));
  verifier('« libelle url » garde son libelle',
    o.duo && o.duo[0].label === 'blog VeVe' && o.duo[0].href === 'https://a.test/x', JSON.stringify(o.duo));
  verifier('une source non cliquable reste une source',
    o.duo && o.duo[1].href === null && o.duo[1].label === 'Infos VeVe.docx', JSON.stringify(o.duo));
  verifier('un libelle seul n a pas de lien',
    o.libelle && o.libelle.length === 1 && o.libelle[0].href === null, JSON.stringify(o.libelle));
  verifier('aucune source -> liste vide', Array.isArray(o.vide) && o.vide.length === 0, JSON.stringify(o.vide));
  verifier('separateur saut de ligne accepte', o.lignes === 2, String(o.lignes));
}

// ── Le flux RSS est-il DECLARE, et seulement ou il existe ? ────────────────
// ⭐ Les routes /rss.xml et /<langue>/rss.xml sont construites depuis toujours ;
//   jusqu'au 29/07/2026 rien ne les declarait dans le <head>. Un flux que
//   personne ne peut decouvrir est un fichier qu'on genere pour rien.
// ⚠️ ET IL NE DOIT PAS ETRE DECLARE PARTOUT. `[locale]/rss.xml.js` ne construit
//   le flux que dans les langues qui ont des articles. L'annoncer dans les
//   autres enverrait les lecteurs sur un 404 — la meme faute que les hreflang
//   vers des pages non construites, payee le 28/07. La condition doit donc
//   etre `blogDansCetteLangue`, celle-la meme qui pilote la navigation.
{
  const BASE = readFileSync(new URL('../../src/layouts/Base.astro', import.meta.url), 'utf8');
  const bloc = BASE.match(/\{blogDansCetteLangue && \([^}]*rss\+xml[\s\S]{0,400}?\)\}/);
  verifier('le <head> declare le flux RSS', /application\/rss\+xml/.test(BASE),
    'aucun <link rel="alternate" type="application/rss+xml"> dans Base.astro');
  verifier('il ne le declare QUE dans les langues qui ont un flux', Boolean(bloc),
    'la declaration doit etre conditionnee par `blogDansCetteLangue`, sinon elle '
    + 'annonce un flux inexistant dans les langues sans article');
}

rmSync(base, { recursive: true, force: true });
console.log(echecs === 0 ? '\n✅ blog hybride : tout est vert\n'
                         : `\n❌ blog hybride : ${echecs} échec(s)\n`);
process.exit(echecs === 0 ? 0 : 1);
