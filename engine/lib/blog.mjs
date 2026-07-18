// Articles : lecture de la collection Markdown (sites/<site>/blog/<langue>/<slug>.md)
import { getCollection } from 'astro:content';
import { locales } from './i18n.mjs';

let _cache = null;
async function loadAll() {
  if (_cache) return _cache;
  const entries = await getCollection('blog', (e) => !e.data.draft);
  _cache = entries.map((e) => {
    const i = e.id.indexOf('/');
    const lang = i > 0 ? e.id.slice(0, i) : locales().def;
    const slug = i > 0 ? e.id.slice(i + 1) : e.id;
    return { entry: e, lang, slug, data: e.data };
  });
  return _cache;
}

const byDateDesc = (a, b) => new Date(b.data.date) - new Date(a.data.date);

export async function postsFor(lang) {
  return (await loadAll()).filter((p) => p.lang === lang).sort(byDateDesc);
}

export async function postBySlug(lang, slug) {
  return (await loadAll()).find((p) => p.lang === lang && p.slug === slug) || null;
}

// Les traductions d'un meme article peuvent avoir des slugs DIFFERENTS :
// c'est cette carte qui permet un hreflang correct.
export async function translationPaths(key) {
  const out = {};
  for (const p of await loadAll()) {
    if (p.data.translationKey === key) out[p.lang] = `/blog/${p.slug}/`;
  }
  return out;
}

export async function tagsFor(lang) {
  const counts = new Map();
  for (const p of await postsFor(lang)) {
    for (const t of p.data.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  }
  // Un theme a un seul article ne serait qu'un doublon de l'index :
  // on ne lui cree pas de page tant qu'il n'a pas au moins 2 articles.
  const MIN = Number(process.env.TAG_MIN_POSTS || 2);
  return [...counts.entries()].filter(([, n]) => n >= MIN)
    .map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n);
}

export async function postsByTag(lang, tag) {
  return (await postsFor(lang)).filter((p) => (p.data.tags || []).includes(tag));
}

// Maillage interne : les articles qui citent une fiche donnee.
export async function postsForItem(lang, uuid) {
  return (await postsFor(lang)).filter((p) => (p.data.items || []).includes(uuid));
}

export const allLangs = async () => [...new Set((await loadAll()).map((p) => p.lang))];
