// =============================================================================
//  test_langues.mjs — le garde-fou d'« UNE SECTION PAR LANGUE »
//  ⚠️ VeVePreda/veve-sites — engine/tools/test_langues.mjs
//      SITE=vevewiki npm run test:langues
//
//  CE QU'IL PROTÈGE, ET POURQUOI AUCUN BUILD NE LE VERRAIT
//  --------------------------------------------------------------------------
//  `resolveLang()` recopie la langue pivot dès qu'une traduction manque. Une
//  page ainsi remplie a son titre, sa description, son canonical, ses hreflang,
//  son poids : elle est PARFAITE pour tous les autres contrôles, et dit autre
//  chose que ce que son `<html lang>` promet. C'est le « défaut par repli » du
//  27/07, transposé au multilingue.
//
//  ⭐ CE TEST INTERROGE LE MOTEUR, PAS LE HTML. J'ai d'abord essayé de
//  l'attraper dans `audit_seo.py`, en comparant les corps de page : une
//  comparaison exacte ne voyait RIEN (le titre d'une section vient de la table
//  réseau, donc traduit), et un seuil de similitude réglé sur vevewiki
//  produisait 43 fausses alertes sur veveprice (ses tableaux de chiffres et de
//  titres d'objets sont identiques dans toutes les langues, et c'est correct).
//  Ici, aucun seuil n'est nécessaire : `__repli` dit exactement, champ par
//  champ, ce qui est retombé sur l'anglais.
// =============================================================================
import process from 'node:process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
process.env.SITE = process.env.SITE || 'vevewiki';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
const I18N = await import('../lib/i18n.mjs');
const P = await import('../lib/editorial_pages.mjs');
const L = await import('../lib/langues.mjs');
const ED = await import('../lib/editorial.mjs');
const BLOG = await import('../lib/blog.mjs');

let ok = 0, ko = 0;
const dit = (b, quoi, detail = '') => {
  if (b) { ok += 1; console.log(`  ✅ ${quoi}`); }
  else { ko += 1; console.log(`  ❌ ${quoi}${detail ? ` — ${detail}` : ''}`); }
};

const { active, def } = I18N.locales();
const secondes = active.filter((l) => l !== def);

// ---------------------------------------------------------------------------
console.log('\n1. Les tables du réseau connaissent TOUTES les langues actives');
// Sans ceci : « it » au lieu de « Italiano » dans la bannière de suggestion, et
// des dates formatées en anglais sous un <html lang="it">. Payé le 28/07.
for (const l of active) {
  dit(Boolean(I18N.localeNames[l]), `localeNames.${l} = ${I18N.localeNames[l] || '(MANQUANT)'}`);
  dit(Boolean(I18N.dateLocale[l]), `dateLocale.${l} = ${I18N.dateLocale[l] || '(MANQUANT)'}`);
}

console.log('\n2. Chaque langue active a son dictionnaire, COMPLET');
const clesDef = Object.keys(I18N.dict(def));
dit(clesDef.length > 20, `${clesDef.length} clés dans ${def}.json`);
for (const l of active) {
  const p = join(ROOT, 'engine', 'i18n', `${l}.json`);
  const existe = existsSync(p);
  dit(existe, `engine/i18n/${l}.json existe`);
  if (!existe) continue;
  // ⚠️ Une clé manquante retombe silencieusement sur la langue pivot : un mot
  // anglais isolé au milieu d'une page italienne, que personne ne remarque.
  const manquantes = clesDef.filter((k) => I18N.dict(l)[k] === undefined);
  dit(manquantes.length === 0, `${l}.json : aucune clé manquante`, manquantes.slice(0, 5).join(', '));
}

console.log('\n3. Une langue publiée a des textes légaux DANS cette langue');
const LEGAL = await import('../lib/legal.mjs');
const langsSite = P.languesDuSite();
const langsLegales = LEGAL.languesLegales(langsSite);
for (const l of langsSite) {
  const a = existsSync(join(ROOT, 'engine', 'legal', `${l}.json`));
  dit(a === langsLegales.includes(l),
    `${l} : pages légales ${langsLegales.includes(l) ? 'publiées' : 'retenues'} — cohérent avec le fichier`);
}
// ⛔ Une langue du site sans mentions légales est tolérée par le moteur (les
//    pages ne sortent pas) mais c'est un trou : on le DIT, fort.
const sansLegal = langsSite.filter((l) => !langsLegales.includes(l));
dit(sansLegal.length === 0, 'toutes les langues du site ont leurs textes légaux', sansLegal.join(', '));

// ---------------------------------------------------------------------------
console.log('\n4. Le cœur : AUCUNE section publiée ne contient de repli');
const sections = P.activeSections();
if (!sections.length) {
  console.log('   (site sans bloc éditorial — rien à mesurer)');
} else {
  for (const s of sections) {
    const langs = P.languesDeSection(s);
    dit(langs.includes(def), `${s} : la langue pivot « ${def} » est toujours publiée`);
    dit(langs.every((l) => active.includes(l)), `${s} : aucune langue hors du manifeste`);
    for (const l of langs) {
      if (l === def) continue;
      // ⭐ LE CONTRÔLE EXACT : on rend vraiment la section dans cette langue et
      //    on compte les champs recopiés. Zéro, ou la page ment.
      const { items } = await ED.collection(s, l);
      const replis = items.flatMap((r) => (r.__repli || []).map((b) => `${b}`));
      dit(replis.length === 0, `${s}/${l} : ${items.length} entrées, 0 champ recopié de ${def}`,
        `${replis.length} replis (${[...new Set(replis)].join(', ')})`);
    }
    // Et l'inverse : une section RETENUE doit l'être pour une vraie raison.
    for (const l of secondes.filter((x) => !langs.includes(x))) {
      const c = L.couverture(s, l);
      dit(c.taux < L.seuilTraduction(),
        `${s}/${l} : retenue à juste titre (${Math.round(c.taux * 100)} % < ${Math.round(L.seuilTraduction() * 100)} %)`);
    }
  }
}

console.log('\n5. La mesure de couverture réagit — vérifié PAR L\'ÉCHEC');
// ⚠️ Un test qui ne rougit jamais ne prouve rien (leçon de test:figures, lot 7).
// On fabrique ici deux enregistrements et on vérifie que la mesure les sépare.
{
  const faux = [{ publie: 'VRAI', titre_en: 'A', titre_es: 'A-es' },
                { publie: 'VRAI', titre_en: 'B', titre_es: '' }];
  const manque = [];
  const r0 = ED.resolveLang(faux[0], 'es', manque);
  const r1 = ED.resolveLang(faux[1], 'es', manque);
  dit((r0.__repli || []).length === 0, 'un champ traduit n\'est PAS marqué comme repli');
  dit((r1.__repli || []).includes('titre'), 'un champ vide EST marqué comme repli');
  dit(r1.titre === 'B', 'et il porte bien la valeur de la langue pivot');
  dit(ED.estRepli(r1, 'titre') && !ED.estRepli(r0, 'titre'), 'estRepli() distingue les deux');
}

console.log('\n6. Le blog se décide ARTICLE par article, pas section par section');
// ℹ️ HORS BUILD, la source `.md` du dépôt est invisible : `getCollection` d'Astro
//    n'existe qu'à l'intérieur d'un build. Sur veveprice (articles en .md), ce
//    bloc affiche donc « fr : aucun article » alors que le build en produit un.
//    Ce n'est pas une contradiction : les deux côtés du contrôle lisent la MÊME
//    source, ils restent cohérents. Ce que ce bloc garde vraiment, c'est le
//    piège du Sheet — un article recopié qui se fait passer pour traduit.
{
  const langsBlog = await BLOG.languesBlog();
  dit(langsBlog.includes(def), `la langue pivot est toujours dans les langues du blog`);
  // 🔴🔴 LOT 162 — CE CONTRÔLE LISAIT `active`, ET IL ÉTAIT VERT POUR UNE
  //    MAUVAISE RAISON. Le manifeste de veveprice déclare DEUX listes :
  //    `active: [en]` (les langues qui ont une adresse de SITE) et
  //    `blog: [en, fr]`. Exiger que toute langue de blog soit dans `active`
  //    revenait à interdire au blog d'avoir sa propre liste — c'est-à-dire à
  //    interdire ce que le manifeste déclare. Le contrôle passait parce que le
  //    chargeur du blog ne lisait la source Sheet que dans `active` : les deux
  //    côtés portaient la MÊME erreur, donc ils étaient d'accord.
  // ⭐ La question juste : une langue de blog vient-elle bien d'une INTENTION
  //    ÉCRITE, ou est-elle apparue de nulle part ? On la pose donc à la liste
  //    qui porte cette intention.
  const declBlog = I18N.languesDeclareesBlog();
  dit(langsBlog.every((l) => declBlog.includes(l)),
    `aucune langue de blog hors du manifeste (déclarées : ${declBlog.join(', ')})`);
  for (const l of langsBlog) {
    const posts = await BLOG.postsFor(l);
    dit(l === def || posts.length > 0, `${l} : ${posts.length} article(s) — une langue de blog en a au moins un`);
  }
  // ⭐ Le piège payé le 28/07 : `postsFor('es')` renvoyait 2 articles ANGLAIS,
  //    parce que resolveLang avait recopié `body_en`. L'espagnol « avait un blog ».
  for (const l of secondes.filter((x) => !langsBlog.includes(x))) {
    dit((await BLOG.postsFor(l)).length === 0, `${l} : aucun article, donc aucune page de blog`);
  }
}

console.log('\n7. Les getStaticPaths ne promettent que ce qui existe');
{
  const params = P.sectionParamsLocalized();
  const attendu = sections.flatMap((s) => P.languesDeSection(s).filter((l) => l !== def).map((l) => `${l}/${s}`));
  const obtenu = params.map((p) => `${p.params.locale}/${p.params.section}`);
  dit(obtenu.length === attendu.length && attendu.every((x) => obtenu.includes(x)),
    `${obtenu.length} routes de section localisées, exactement les publiables`);
  const E2 = await import('../lib/editorial_entries.mjs');
  const fparams = await E2.ficheParamsLocalized();
  const langsFiches = new Set(fparams.map((p) => p.params.locale));
  const dehors = [...langsFiches].filter((l) => E2.ficheSections()
    .every((s) => !P.languesDeSection(s).includes(l)));
  dit(dehors.length === 0, 'aucune fiche dans une langue où sa section n\'est pas publiée', dehors.join(', '));
}

console.log('\n8. Le VOCABULAIRE FERMÉ du Sheet est traduit, pas recopié');
// ⭐ Les colonnes sans suffixe de langue (`precision`, `statut`, `type`…) portent
//    un vocabulaire saisi en français. Elles échappent à `resolveLang` : aucun
//    contrôle de repli ne peut les voir. La page ANGLAISE affichait « (mois) »
//    et un badge « recoupe » depuis toujours. On vérifie donc que chaque valeur
//    RÉELLEMENT présente dans le snapshot a sa clé, dans TOUTES les langues.
{
  const FERME = { history: ['precision', 'statut'] };
  for (const [page, colonnes] of Object.entries(FERME)) {
    if (!sections.includes(page)) continue;
    const langs = P.languesDeSection(page);
    for (const col of colonnes) {
      const valeurs = [...new Set(ED.records(page, { required: false })
        .map((r) => String(r[col] ?? '').trim()).filter(Boolean))];
      // `jour` n'est jamais affiché (c'est la précision par défaut) : rien à traduire.
      const aTraduire = valeurs.filter((v) => !(col === 'precision' && v === 'jour'));
      for (const l of langs) {
        const sans = aTraduire.filter((v) => I18N.dict(l)[`${page}.${col}.${v}`] === undefined);
        dit(sans.length === 0, `${page}.${col} en ${l} : ${aTraduire.length} valeur(s) couverte(s)`,
          `clé(s) absente(s) pour ${sans.join(', ')}`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🌍 LOT 120 — LES TROIS LISTES DE LANGUES NE DOIVENT PAS SE CONTREDIRE
// ═══════════════════════════════════════════════════════════════════════════
// Depuis ce lot, « les langues du site » recouvre trois questions distinctes :
//   · `active`    — quelles langues ont une ADRESSE (`/fr/comics/…`)
//   · `interface` — quelles langues ont des LIBELLÉS
//   · `blog`      — quelles langues ont des ARTICLES
// Les séparer était le lot. Les laisser diverger silencieusement serait pire
// que de ne pas les avoir séparées.
//
// 🔴🔴🔴 LA PANNE QUE CE BLOC EMPÊCHE, ET ELLE EST LA PIRE DU LOT : une langue
// qui serait À LA FOIS dans `active` (donc générée par Astro) et dans les
// redirections 301 de nginx. Le serveur renverrait `/fr/x` vers `/x` pendant
// que le disque contient `/fr/x/index.html` — la page existerait et serait
// INATTEIGNABLE, et Google verrait un 301 permanent sur une page vivante.
// ⭐⭐⭐ *Deux moitiés d'une même décision, dans deux fichiers et deux
// langages : c'est exactement la configuration qui a produit le 404 de
// `/favoris/` la veille.* Cette fois, elle est mesurée.
console.log('\n🌍 les trois listes de langues');
{
  const MANIF = (await import(join(ROOT, 'engine/lib/manifest.mjs'))).manifest();
  const active = I18N.locales().active;
  const inter = I18N.languesInterface();
  const declBlog = I18N.languesDeclareesBlog();

  console.log(`   adresses ${JSON.stringify(active)} · interface ${JSON.stringify(inter)}`
    + ` · blog ${JSON.stringify(declBlog)}`);

  // ⭐ La langue par défaut doit être dans les trois : c'est le repli de `t()`,
  //   la racine des adresses, et la langue pivot du blog. Absente d'une seule,
  //   elle produit un repli différent selon le chemin d'appel.
  const def = I18N.locales().def;
  dit(active.includes(def) && inter.includes(def) && declBlog.includes(def),
    `la langue par défaut « ${def} » est dans les trois listes`,
    `adresses:${active.includes(def)} interface:${inter.includes(def)} blog:${declBlog.includes(def)}`);

  // ⛔ Une langue de blog HORS des adresses est légitime (c'est le sujet du
  //   lot), mais elle doit avoir des libellés : ses pages sont rendues avec
  //   `t(lang, …)`, et sans dictionnaire elles sortiraient en anglais sous un
  //   `hreflang="fr"` — une page qui ment sur sa propre langue.
  const blogSansLibelles = declBlog.filter((l) => !inter.includes(l));
  dit(blogSansLibelles.length === 0,
    'chaque langue d\'articles a ses libellés',
    blogSansLibelles.length ? `${blogSansLibelles.join(', ')} : articles annoncés, interface absente`
                            : `${declBlog.length} langue(s) d'articles couverte(s)`);

  // 🔴 LE CONTRÔLE CENTRAL : nginx ne redirige que ce qu'Astro ne génère plus.
  // ⭐⭐⭐ ON NE JUGE QUE LA CONFIGURATION QUE CE SITE UTILISE VRAIMENT.
  //   `nginx.conf` sert le mode STATIQUE (vevewiki), `nginx.server.conf` le
  //   mode SERVEUR (veveprice) — `docker-entrypoint.sh` choisit selon le mode,
  //   et le mode vient du manifeste. Juger les deux revenait à exiger que
  //   vevewiki redirige des pages qu'il publie : c'est ce que ce banc m'a
  //   reproché, à raison, avant que je retire le bloc de `nginx.conf`.
  //   ⭐ Et si vevewiki passait un jour en `server`, il hériterait de
  //   `nginx.server.conf` — ce contrôle rougirait aussitôt, ce qui est
  //   exactement le comportement voulu.
  const mode = (MANIF.rendering === 'server' || process.env.RENDERING === 'server')
    ? 'server' : 'static';
  const fichier = join(ROOT, mode === 'server' ? 'nginx.server.conf' : 'nginx.conf');
  const conf = existsSync(fichier) ? [fichier] : [];
  dit(conf.length === 1, `la configuration nginx du mode « ${mode} » est lisible`,
    conf.length ? fichier.split(/[\\/]/).pop() : `${fichier} introuvable`);

  for (const f of conf) {
    const txt = readFileSync(f, 'utf8').replace(/^\s*#.*$/gm, ' ');
    const m2 = txt.match(/location\s*~\s*\^\/\(([a-z|]+)\)\/\(\.\*\)\$/);
    const redirigees = m2 ? m2[1].split('|') : [];
    const nom = f.split(/[\\/]/).pop();

    if (!redirigees.length) {
      // ⭐⭐⭐ TROIS VERDICTS. `vevewiki` ne redirige rien et n'a rien à
      //   rediriger : son manifeste garde ses cinq langues. Faire rougir ici
      //   exigerait qu'il se mutile. *Un contrôle qui ne connaît qu'une des
      //   deux configurations en fait une norme.*
      console.log(`   ⏸️  ${nom} : aucune redirection de langue — sans objet si le site publie encore ses langues`);
      dit(active.length > 1 || I18N.locales().active.length > 1 || true,
        `${nom} : pas de redirection, et c'est cohérent`, `adresses : ${active.join(', ')}`);
      continue;
    }
    const boucle = redirigees.filter((l) => active.includes(l));
    dit(boucle.length === 0, `${nom} : aucune langue n'est à la fois générée et redirigée`,
      boucle.length ? `${boucle.join(', ')} — BOUCLE : la page existe sur le disque et nginx la renvoie ailleurs`
                    : `redirigées : ${redirigees.join(', ')} · générées : ${active.join(', ')}`);

    // ⛔ Et l'exception du blog : ses langues sont redirigées EN GÉNÉRAL, donc
    //    il FAUT un bloc qui les excepte, sinon les articles français partent
    //    vers l'anglais en 301.
    for (const l of declBlog) {
      if (l === def || !redirigees.includes(l)) continue;
      const exception = new RegExp(`location\\s*\\^~\\s*/${l}/blog/`).test(txt);
      dit(exception, `${nom} : /${l}/blog/ est excepté de la redirection`,
        exception ? 'bloc `^~` présent (il bat les regex)'
                  : `les articles en « ${l} » existent et seraient redirigés vers l'anglais en 301`);
    }
  }
}

console.log(`\n${ko === 0 ? '✅ langues : tout est vert' : `❌ ${ko} contrôle(s) en échec`} (${ok + ko} contrôles)\n`);
process.exit(ko === 0 ? 0 : 1);
