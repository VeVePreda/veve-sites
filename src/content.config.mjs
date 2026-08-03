import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Les articles vivent DANS LE DEPOT, par site et par langue :
//   sites/<site>/blog/<langue>/<slug>.md
const SITE = process.env.SITE || 'veveprice';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `./sites/${SITE}/blog` }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    items: z.array(z.string()).default([]),      // uuid des fiches liees (maillage interne)
    // ⭐ RANG DANS UNE SERIE — optionnel (lot 45). Il double la colonne `ordre`
    // de l'onglet Sheet : les deux sources d'un meme blog doivent savoir dire
    // la meme chose, sinon un article migre du Sheet vers un .md et perd sa
    // place dans la serie sans qu'aucun controle ne parle.
    ordre: z.number().int().positive().optional(),
    translationKey: z.string(),                   // relie les versions de langue
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
