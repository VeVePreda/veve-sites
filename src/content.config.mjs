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
    translationKey: z.string(),                   // relie les versions de langue
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
