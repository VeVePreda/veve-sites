// =============================================================================
//  figures_markdown.mjs — la MÊME syntaxe de figure dans les articles `.md`
//
//  ⚠️ CE FICHIER VA DANS LE DÉPÔT  VeVePreda/veve-sites , dans  engine/lib/
//     (chemin exact : engine/lib/figures_markdown.mjs)
//
//  POURQUOI IL EXISTE
//  Un article de ce réseau arrive par DEUX chemins : le Sheet (rendu par
//  engine/lib/markdown.mjs) et un `.md` du dépôt (rendu par le processeur
//  Markdown d'Astro). Si la figure ne marchait que d'un côté, l'auteur devrait
//  savoir par où passe son texte pour choisir sa syntaxe — c'est exactement le
//  genre de règle qu'on oublie, et la figure disparaît sans bruit.
//  ⭐ UNE syntaxe, `![légende](figure:mon-id)`, valable des deux côtés.
//
//  ⚠️ PIÈGE PAYÉ (27/07/2026) — `markdown.remarkPlugins` N'EXISTE PLUS
//  Astro 7 rend les `.md` avec **Sätteri**, pas avec remark. Passer un greffon
//  remark fait échouer le build en réclamant `npm install @astrojs/markdown-remark`
//  — une dépendance de plus, alors que `npm ci` est le poste de coût du build
//  ici. Sätteri a son PROPRE système de greffons, déjà installé : c'est celui-là
//  qu'on utilise. Un visiteur par type de nœud, aucune dépendance ajoutée.
//
//  ⚠️ La LANGUE vient du CHEMIN du fichier (`sites/<site>/blog/<langue>/…`) :
//     c'est la seule information de langue dont dispose un greffon Markdown.
//     Un `.md` rangé hors de ce schéma retombe sur la langue par défaut du
//     site — d'où le journal ci-dessous plutôt qu'un silence.
// =============================================================================
import { figureParId } from './figures.mjs';
import { locales } from './i18n.mjs';

const langueDuChemin = (chemin) => {
  const m = /\/blog\/([a-z]{2})\//i.exec(String(chemin || '').replace(/\\/g, '/'));
  return m ? m[1].toLowerCase() : null;
};

/** Greffon mdast Sätteri. Fabrique appelée une fois par document : la langue
 *  est donc résolue par fichier, pas une seule fois pour tout le site. */
export default function figuresMarkdown() {
  return {
    name: 'veve:figures',
    image(noeud, ctx) {
      const m = /^figure:(.+)$/i.exec(String(noeud.url || '').trim());
      if (!m) return;

      const { active, def } = locales();
      let lang = langueDuChemin(ctx.fileURL ? ctx.fileURL.pathname : '');
      if (!lang || !active.includes(lang)) {
        if (lang) console.warn(`[figures] langue « ${lang} » inconnue pour ${ctx.fileURL} — repli sur « ${def} ».`);
        lang = def;
      }

      const html = figureParId(m[1].trim(), lang, noeud.alt || '');
      if (!html) return;                       // identifiant inconnu : deja journalise

      // Une figure est un BLOC. Si elle est SEULE dans son paragraphe, on
      // remplace le paragraphe entier : sinon <figure> se retrouverait dans un
      // <p>, du HTML invalide que le navigateur « repare » en cassant la mise
      // en page. Dans un paragraphe mixte, on remplace juste l'image.
      const parent = ctx.parent(noeud);
      const seule = parent && parent.type === 'paragraph'
        && Array.isArray(parent.children) && parent.children.length === 1;
      ctx.replaceNode(seule ? parent : noeud, { rawHtml: html });
    },
  };
}
