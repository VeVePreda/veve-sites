// ⚠️ VeVePreda/veve-sites — engine/lib/sets.mjs   (FICHIER NEUF — lot N)
// ═══════════════════════════════════════════════════════════════════════════
//  LES SETS — UNE PAGE `/collection/` = UN SET DE VeVe, CLÉ `series_uuid`
// ═══════════════════════════════════════════════════════════════════════════
//
// 🗣️ ARBITRAGE DE PREDA (08/09/2026, registre E) — **OPTION A** : « une page
// = un set ». Décision prise contre ma recommandation (je conseillais de ne
// pas toucher aux adresses). ⛔ On n'y revient pas, on ne la re-argumente pas.
//
// 🔬 POURQUOI LA CLÉ D'AVANT ÉTAIT FAUSSE, MESURÉ LE 08/09 (catalogue 19 913
// lignes joint à `elements_v3.csv`) :
//   · la clé `<série> #<numéro>` (lot 71) laissait **643 pages de comics sur
//     1 271** (et 5 collectibles sur 921) contenir PLUSIEURS sets — surtout
//     des RÉIMPRESSIONS : « Red Sonja: Noir #1 » = l'édition 2025 ET
//     l'édition 2026, 9 pièces sous une adresse, deux `series_uuid` ;
//   · `series_uuid` est la clé de VeVe elle-même : comics **jamais plus de 5
//     pièces**, 2 075/2 075 groupes de 5 à 5 raretés DISTINCTES ; collectibles
//     924 groupes contre 936 « Sets » publiés par `getSets` (1,3 % d'écart) ;
//   · 390 sets de comics n'ont qu'UNE pièce, et c'est VRAI : 374 sont des
//     drops « Common seul » de 2025-2026 (tirage 1 000). Ce ne sont pas des
//     trous de collecte — la chaîne (`elements_v3`) rend les mêmes tailles ;
//   · le bonus MCP de set (`sets_mcp.mjs`) tombait sur des objets qui ne
//     sont pas des sets : `/api/analytics/sets_mcp?n=200` servait 176 numéros
//     de comics sur 200. Le classement était faux à 88 % — par la clé, pas
//     par le barème. ⭐ Ce module reçoit les pièces, `sets_mcp.mjs` reçoit les
//     sets : un seul endroit décide ce qu'est un set.
//
// ═══════════════════════════════════════════════════════════════════════════
//  🔴🔴 LES ADRESSES — AUCUNE ANCIENNE N'EST PERDUE, ET C'EST LE DISPOSITIF
// ═══════════════════════════════════════════════════════════════════════════
// Le registre dit « les anciennes adresses DOIVENT être redirigées ». On fait
// mieux qu'une redirection : **chaque ancien slug reste servi**, par le set
// le plus ANCIEN du groupe qu'il désignait (`red-sonja-noir-1` → l'édition
// 2025). Les autres sets du groupe reçoivent une adresse NEUVE. Zéro 404,
// zéro 301 à maintenir, et l'autorité de l'ancienne page reste sur une page
// qui montre encore ce qu'elle montrait (en partie).
//   · l'aîné du groupe = date de sortie la plus ancienne, puis `series_uuid`
//     (ordre STABLE d'un build à l'autre : une nouvelle réimpression sort
//     après, elle ne peut pas voler le slug de l'aînée) ;
//   · le nouveau slug = celui du NOM du set s'il est libre
//     (« Red Sonja: Noir #1 (2026) » → `red-sonja-noir-1-2026`), sinon
//     `<ancien>-<8 hex de series_uuid>` (« Supernatural #1 (2025) » existe
//     deux fois avec deux `series_uuid` : la seconde devient
//     `supernatural-1-19611d16`).
//   ⭐ Tous les anciens slugs sont RÉSERVÉS avant qu'un nouveau ne se
//     choisisse : un nom de set ne peut pas prendre l'adresse d'un groupe.
//
// ⛔⛔ AUCUN REPLI SILENCIEUX SUR L'ANCIENNE CLÉ. `chargerFacultatif()` rend
// `[]` quand une source manque : appliqué ici, une release sans la colonne
// ferait re-basculer ~3 000 adresses sur l'ancien découpage, puis revenir le
// lendemain. Des adresses qui dépendent de l'humeur d'une release sont le
// pire des états. ⇒ `exigerColonneSets()` FAIT ÉCHOUER LE BUILD si l'en-tête
// n'a pas `series_uuid`. Une PIÈCE sans valeur (colonne présente, cellule
// vide) est tolérée et COMPTÉE : elle forme un set « orphelin » sous son
// ancienne clé, rangé DERNIER (il ne prend jamais un ancien slug si un vrai
// set le réclame). Au-delà de `ORPHELINS_MAX` (10 %), le build échoue aussi :
// ce n'est plus un trou, c'est une colonne vide qui se fait passer pour
// présente.
//
// 🔤 LE NOM D'UN SET : chez un comic, le nom de ses pièces (toutes les
// raretés portent le même : « Red Sonja: Noir #1 (2026) », l'année incluse —
// 20 sets sur 4 287 ont plusieurs noms, on prend le majoritaire) ; chez un
// collectible, la série. Deux sets homonymes (127 sur 5 211, mesuré) se
// distinguent par leur jour de sortie, sinon par 8 hex : `test:titres` exige
// zéro `<title>` partagé, et une page dont le titre est celui d'une autre
// n'est indexée qu'une fois.

/** Le seuil au-delà duquel « quelques pièces sans clé » devient « la colonne
 *  est vide » — 10 % : mesuré le 08/09, `elements_v3` couvre 96,7 % du
 *  catalogue et 100 % de ses propres lignes ont la clé. */
export const ORPHELINS_MAX = 0.10;

/** Les 8 premiers hex d'un `series_uuid` — assez pour être unique, court
 *  dans une adresse. */
export const uuid8 = (u) => String(u || '').replace(/[^0-9a-f]/gi, '').slice(0, 8).toLowerCase();

/**
 * ⛔ LA PORTE. Lève si le catalogue a des lignes et qu'aucune ne porte la
 * clé `series_uuid` dans son EN-TÊTE (une cellule vide est une valeur ; une
 * clé absente de l'objet est une colonne absente).
 * ⭐ On regarde la PREMIÈRE ligne : `parseCSV` donne à chaque ligne toutes
 *   les colonnes de l'en-tête, vide ou non. Si la première n'a pas la clé,
 *   aucune ne l'a.
 */
export function exigerColonneSets(cat) {
  if (!Array.isArray(cat) || cat.length === 0) return;
  if (Object.prototype.hasOwnProperty.call(cat[0], 'series_uuid')) return;
  throw new Error(
    '[sets] `series_uuid` ABSENT de l\'en-tête du catalogue — le découpage des '
    + 'pages /collection/ (une page = un set, lot N) n\'a pas sa clé. Build '
    + 'interrompu VOLONTAIREMENT : servir l\'ancien découpage ferait changer '
    + '~3 000 adresses au gré des releases. Vérifier la release `catalogue` de '
    + 'fanablefrance/jetonveve (scrapeur-veve `b0aeedf` ou postérieur).');
}

/** L'ancienne clé (lot 71) — gardée UNIQUEMENT pour la continuité des
 *  adresses : elle dit quel slug le groupe portait hier. */
export function cleHeritee(i) {
  if (i.type !== 'comic') return i.series;
  const n = String(i.edition_type || '').trim();
  return n ? `${i.series} #${n}` : i.series;
}

const majoritaire = (liste, lire) => {
  const c = new Map();
  for (const x of liste) {
    const v = String(lire(x) || '').trim();
    if (!v) continue;
    c.set(v, (c.get(v) || 0) + 1);
  }
  let gagnant = '', n = 0;
  for (const [v, k] of c) if (k > n) { gagnant = v; n = k; }   // `>` : à égalité, le premier — stable
  return gagnant;
};

/**
 * Construit les sets à partir des pièces publiées.
 * @param items  pièces avec `uuid type series edition_type name seriesUuid releaseDate`
 * @param outils `{ slugify, jourISO }` — ceux du moteur, jamais recopiés ici
 * @returns `{ collections: Map<slug, {slug, name, seriesUuid, items, brand, licensor}>, stats }`
 * Effet : pose `i.colSlug` sur chaque pièce (l'adresse de son set, posée par
 * celui qui fabrique la page — leçon du lot 102).
 */
export function construireSets(items, { slugify, jourISO }) {
  const stats = { pieces: 0, sansSerie: 0, orphelins: 0, sets: 0, setsOrphelins: 0,
                  groupesEclates: 0, slugsHerites: 0, slugsNeufs: 0, slugsUuid: 0, nomsDesambigues: 0, alias: 0 };

  // ── 1. les pièces → les sets (clé `series_uuid`, sinon orphelin sous l'ancienne clé)
  const parCle = new Map();
  for (const i of items) {
    if (!i.series) { stats.sansSerie++; continue; }
    stats.pieces++;
    const su = String(i.seriesUuid || '').trim();
    const legacy = slugify(cleHeritee(i));
    const cle = su ? `u:${su}` : `l:${legacy}`;
    if (!su) stats.orphelins++;
    let s = parCle.get(cle);
    if (!s) { s = { seriesUuid: su, orphelin: !su, items: [] }; parCle.set(cle, s); }
    s.items.push(i);
  }
  const sets = [...parCle.values()];
  stats.sets = sets.length;
  stats.setsOrphelins = sets.filter((s) => s.orphelin).length;

  if (stats.pieces > 0 && stats.orphelins / stats.pieces > ORPHELINS_MAX) {
    throw new Error(
      `[sets] ${stats.orphelins} pièce(s) sur ${stats.pieces} sans \`series_uuid\` `
      + `(${(100 * stats.orphelins / stats.pieces).toFixed(1)} % > ${100 * ORPHELINS_MAX} %) — la colonne `
      + 'est là mais vide : c\'est l\'ancien découpage qui reviendrait en silence. Build interrompu.');
  }

  // ── 2. ce que chaque set S'APPELLE, et le slug qu'il PORTAIT (l'ancienne clé)
  for (const s of sets) {
    const premier = s.items[0];
    s.type = premier.type;
    s.name = (s.type === 'comic' ? majoritaire(s.items, (x) => x.name) : majoritaire(s.items, (x) => x.series))
      || premier.series || premier.name;
    s.slugHerite = majoritaire(s.items, (x) => slugify(cleHeritee(x)));
    // la sortie la plus ancienne du set — '' (inconnue) se range APRÈS toute date connue
    let plusTot = '';
    for (const x of s.items) { const j = jourISO(x.releaseDate); if (j && (!plusTot || j < plusTot)) plusTot = j; }
    s.sortie = plusTot || '9999-99-99';
  }

  // ── 3. l'ordre dans chaque ancien groupe : l'aîné garde l'adresse
  const groupes = new Map();
  for (const s of sets) {
    if (!groupes.has(s.slugHerite)) groupes.set(s.slugHerite, []);
    groupes.get(s.slugHerite).push(s);
  }
  const ordre = (a, b) => (a.orphelin - b.orphelin) || a.sortie.localeCompare(b.sortie)
    || a.seriesUuid.localeCompare(b.seriesUuid);
  const pris = new Set(groupes.keys());          // ⭐ tous les anciens slugs, réservés d'abord
  // ⭐⭐ QUI A DROIT AU SLUG DE SON NOM : le PLUS ANCIEN des cadets qui le
  //   veulent, tous groupes confondus — jamais « le premier groupe dans
  //   l'ordre alphabétique ». Mesuré sur l'échantillon (08/09) : avec l'ordre
  //   des groupes, ajouter un set plus ancien dans le groupe `…-2` faisait
  //   perdre son slug de nom au cadet du groupe `…-65-deaths`. Un set NEUF
  //   (donc plus jeune) ne peut plus déplacer une adresse existante.
  const cadets = [];
  const collections = new Map();
  for (const slugHerite of [...groupes.keys()].sort()) {
    const liste = groupes.get(slugHerite).sort(ordre);
    if (liste.length > 1) stats.groupesEclates++;
    liste.forEach((s, k) => { s.slugHerite = slugHerite; s.rang = k; if (k > 0) cadets.push(s); });
  }
  const parVoulu = new Map();
  for (const s of cadets.sort(ordre)) {
    const voulu = slugify(s.name);
    if (voulu && !pris.has(voulu) && !parVoulu.has(voulu)) { parVoulu.set(voulu, s); s.slug = voulu; stats.slugsNeufs++; }
  }
  for (const v of parVoulu.keys()) pris.add(v);
  for (const s of cadets) {
    if (s.slug) continue;
    let slug = `${s.slugHerite}-${uuid8(s.seriesUuid)}`; stats.slugsUuid++;
    // ⛔ jamais deux sets sur une adresse — même par un uuid tronqué
    let n = 2; const base = slug;
    while (pris.has(slug)) slug = `${base}-${n++}`;
    pris.add(slug);
    s.slug = slug;
  }
  for (const slugHerite of [...groupes.keys()].sort()) {
    const liste = groupes.get(slugHerite).sort(ordre);
    liste.forEach((s, k) => {
      const slug = k === 0 ? slugHerite : s.slug;
      if (k === 0) stats.slugsHerites++;
      s.slug = slug;
      for (const i of s.items) i.colSlug = slug;
      collections.set(slug, { slug, name: s.name, seriesUuid: s.seriesUuid, orphelin: s.orphelin,
                              sortie: s.sortie === '9999-99-99' ? '' : s.sortie,
                              // l'ancien groupe et le rang qu'on y tient : l'appelant s'en sert
                              // pour garder une ancienne adresse SERVIE quand son aîné n'a pas de page
                              slugHerite, rang: k,
                              alias: [], brand: '', licensor: '', items: s.items });
    });
  }

  // ── 3 bis. LES ADRESSES QU'AUCUN SET NE PORTE PLUS → des ALIAS, pas des 404
  // 🔬 Mesuré le 08/09 : 19 anciens slugs sur 5 283 ne désignent plus aucun
  // set — des pièces dont la `series` du Sheet diffère de leurs sœurs
  // (« Fantastic Four Vol. 8 » contre « Fantastic Four »). Hier elles avaient
  // une page à elles (fausse : 1 pièce séparée de son set) ; aujourd'hui
  // elles rejoignent leur set, et leur ancienne adresse serait un 404.
  // ⭐ Le set qui les absorbe est aussi SERVI à cette ancienne adresse, avec
  //   `<link rel="canonical">` vers sa vraie page : un doublon DÉCLARÉ, ce
  //   que Google consolide sans perte. ⛔ Pas un talon `http-equiv=refresh` :
  //   sur ce site un talon dans `dist/` est une page fantôme (lot 139), et
  //   nginx sert `/collection/` sans jamais passer par Node — aucun 301
  //   n'est possible là sans toucher à sa configuration.
  for (const c of collections.values()) {
    const anciens = new Set(c.items.map((x) => slugify(cleHeritee(x))));
    anciens.delete(c.slug);
    c.alias = [...anciens].filter((a) => a && !pris.has(a)).sort();
    for (const a of c.alias) pris.add(a);
    stats.alias += c.alias.length;
  }

  // ── 4. deux sets homonymes → le jour de sortie, sinon 8 hex (`test:titres` exige des titres distincts)
  const parNom = new Map();
  for (const c of collections.values()) {
    if (!parNom.has(c.name)) parNom.set(c.name, []);
    parNom.get(c.name).push(c);
  }
  for (const liste of parNom.values()) {
    if (liste.length < 2) continue;
    liste.sort((a, b) => a.sortie.localeCompare(b.sortie) || a.slug.localeCompare(b.slug));
    const vus = new Set([liste[0].name]);
    for (const c of liste.slice(1)) {
      let nom = c.sortie ? `${c.name} (${c.sortie})` : c.name;
      if (vus.has(nom)) nom = `${c.name} (${uuid8(c.seriesUuid) || c.slug})`;
      vus.add(nom);
      c.name = nom;
      stats.nomsDesambigues++;
    }
  }
  return { collections, stats };
}
