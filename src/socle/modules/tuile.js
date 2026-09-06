// ⚠️ VeVePreda/veve-sites  ·  CHEMIN : src/socle/modules/tuile.js
//
// ═══════════════════════════════════════════════════════════════════════════
// 🧩🔴🔴🔴 LOT G — **LA** TUILE. UNE SEULE DESCRIPTION, TROIS FABRIQUES.
// ═══════════════════════════════════════════════════════════════════════════
// 🗣️ PREDA, 06/09, EN VOYANT LE RENDU DU LOT E : « je n'aime pas les tuiles
//    actuelles, j'aimais bien mieux celles d'avant ». Mesuré : sa capture est la
//    vue « Tiles » de `/market/`. Le lot E avait fabriqué un SECOND composant,
//    plus pauvre, et les « quatre écarts voulus » acceptés le matin sur
//    DESCRIPTION ont été refusés le soir sur RENDU.
//    ⭐⭐ *Un arbitrage pris sur une description n'engage pas celui qu'on prend
//    en voyant la chose.* Les quatre écarts sont ANNULÉS, sauf le tirage.
//
// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 POURQUOI CE FICHIER EXISTE, ET POURQUOI IL EST À CET ENDROIT-LÀ
// ═══════════════════════════════════════════════════════════════════════════
// Le dépôt avait TROIS fabriques qui dessinaient une tuile :
//   ① `src/components/Rayon.astro`            — serveur, 9 354 pages, SEO ;
//   ② `src/socle/modules/rayon.js`            — client, au filtrage ;
//   ③ `Market.astro` → `batirTuiles()`        — client, `/market/` seulement.
// ⭐⭐⭐ CE MOTIF A DÉJÀ ÉTÉ PAYÉ **QUATRE FOIS** DANS CE DÉPÔT (lots 127, 131,
// 132, 155-A), et l'énoncé est écrit dans le socle de la feuille de style :
// *trois copies se ressemblent six mois, puis l'une gagne une correction et les
// deux autres non.* On ne recopie donc pas une quatrième fois : on décrit la
// tuile UNE fois, ici, et les trois fabriques lisent cette description.
//
// ⛔ CE FICHIER NE TOUCHE NI AU DOM NI AU HTML. Il rend un ARBRE DÉCRIT — des
//    objets `{ t, c, x, a, k }` — et rien d'autre. C'est ce qui lui permet
//    d'être exécuté des DEUX côtés :
//      · au build, `engine/lib/tuile.mjs` l'évalue et sérialise l'arbre en HTML ;
//      · chez le visiteur, `rayon.js` et le pilote du Marché le montent en DOM.
//    Une fonction qui rendrait une chaîne HTML ne servirait qu'au serveur ; une
//    qui rendrait des nœuds ne servirait qu'au client. L'arbre décrit sert aux
//    deux, et c'est la seule forme qui le permette.
//
// ⚠️ ES5, `var`, AUCUN `import` : ce fichier est servi tel quel au navigateur
//    par `moduleJs()`, exactement comme ses voisins de `src/socle/modules/`.
//    ⛔ Ne pas y mettre `export` — il est chargé en `<script defer>`, pas en
//    module, et un `export` le ferait échouer à l'analyse, SANS message utile.
(function (racine) {
  'use strict';

  // ── LE VOCABULAIRE, DÉCLARÉ UNE FOIS ────────────────────────────────────
  // ⭐ Ce sont les classes de `/market/`, PAS de nouvelles. `.tuile`,
  //   `.tuile__hd`, `.tuile__rar`, `.tuile__b`, `.tuile__n`, `.tuile__s`,
  //   `.tuile__p`, `.socle*` sont dans le thème depuis le lot 127 et portent le
  //   contrat visuel que Preda a désigné. ⛔ Les trois dernières (`__e`, `__t`,
  //   `__x`) sont neuves parce que le Marché n'a rien à mettre dedans — elles
  //   portent ce que le RAYON sait et que le Marché ignore.
  var C = {
    boite: 'tuile', muet: 'tuile tuile--muet',
    hd: 'tuile__hd', rar: 'tuile__rar',
    socle: 'socle', socleComic: 'socle socle--comic',
    fond: 'socle__fond ok', voile: 'socle__voile', net: 'socle__net ok',
    cage: 'socle__cage', ext: 'socle__ext',
    bas: 'tuile__b', nom: 'tuile__n', serie: 'tuile__s',
    edition: 'tuile__e', prix: 'tuile__p', tirage: 'tuile__t', sansFiche: 'tuile__x'
  };

  // ⭐ UN NŒUD DÉCRIT : `t` la balise, `c` la classe, `x` le texte, `a` les
  //   attributs, `k` les enfants, `h` du HTML DÉJÀ FABRIQUÉ par le serveur
  //   (pastille de rareté, cadenas, losange). ⛔ `h` ne reçoit JAMAIS de donnée
  //   de catalogue : un nom de pièce vient d'un Sheet et part toujours par `x`,
  //   c'est-à-dire par `textContent` chez le client et par un échappement chez
  //   le serveur. C'est la même ligne de partage que `rayon.js` tient déjà.
  function n(t, c, o) {
    var d = { t: t, c: c || '' };
    if (o) { if (o.x != null) d.x = o.x; if (o.a) d.a = o.a; if (o.k) d.k = o.k;
             if (o.h) d.h = o.h; }
    return d;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  LA DESCRIPTION D'UNE TUILE
  // ═════════════════════════════════════════════════════════════════════════
  // `v` porte des VALEURS DÉJÀ PRÊTES, jamais des champs bruts de catalogue :
  //   nomVu, nomComplet, serie, edition, tirage (texte), href, image, repli,
  //   onerror, comic, rarHtml, losangeHtml, prixHtml, extHtml, sansFicheTxt.
  // ⭐⭐ AUCUN PRIX N'ENTRE ICI EN CLAIR, et ce n'est pas une précaution : sur
  //   un rayon, `prixHtml` est le CADENAS rendu par `Cote.astro` — le montant
  //   n'existe pas encore à l'instant du rendu. `test:fuite` ratisse ces pages,
  //   et il a raison de le faire.
  function decrire(v) {
    v = v || {};
    var haut = [];
    // ① LA RARETÉ EN PASTILLE SUR L'IMAGE — c'était l'écart ① du lot E, annulé.
    if (v.rarHtml) haut.push(n('span', C.rar, { h: v.rarHtml }));

    var dedans = [];
    if (v.image) {
      var att = { width: '400', height: '600', loading: 'lazy', decoding: 'async' };
      if (v.repli) att['data-repli'] = v.repli;
      if (v.onerror) att.onerror = v.onerror;
      // ⛔ L'ADRESSE PART PAR `a.src`, JAMAIS DANS UNE CHAÎNE ASSEMBLÉE : une
      //   URL contenant un guillemet ferait de la ligne une injection. Côté
      //   client c'est la propriété, côté serveur c'est un attribut échappé.
      var f = {}, g = {}; var q;
      for (q in att) { f[q] = att[q]; g[q] = att[q]; }
      f.src = v.image; f.alt = ''; f['aria-hidden'] = 'true';
      g.src = v.image; g.alt = v.nomComplet || v.nomVu || '';
      dedans.push(n('img', C.fond, { a: f }));
      dedans.push(n('span', C.voile));
      dedans.push(n('img', C.net, { a: g }));
    } else {
      // ⭐⭐ LE LOSANGE EST TRANSPORTÉ, PAS REDESSINÉ — la règle du lot 155-B :
      //   *quand deux fabriques doivent montrer la même chose, on transporte le
      //   résultat, pas la recette.* ⛔ Recopier son `path` ici en ferait une
      //   seconde source, et le jour où le glyphe change une liste filtrée
      //   dessinerait l'ancien, sans que les deux soient jamais côte à côte.
      dedans.push(n('span', C.voile));
      dedans.push(n('span', C.cage, { a: { 'aria-hidden': 'true' }, h: v.losangeHtml || '' }));
    }
    // ② LES EXTRÊMES SUR LE SOCLE — c'était l'écart ② du lot E, annulé.
    //   ⚠️ `aria-hidden` : le bandeau répète en abrégé ce que la fiche dit en
    //   toutes lettres ; le lecteur d'écran n'a pas à l'entendre deux fois.
    if (v.extHtml) dedans.push(n('span', C.ext, { a: { 'aria-hidden': 'true' }, h: v.extHtml }));

    var bas = [];
    // 🔤 LE NOM COUPÉ EST AFFICHÉ, LE NOM ENTIER EST EN `title`, et les DEUX
    //   fabriques posent l'attribut. C'est la correction du lot 182, et le
    //   défaut mesuré le 06/09 en production : le pilote écrivait le nom
    //   ENTIER là où le serveur écrivait le nom COUPÉ, sur 89,7 % des comics,
    //   masqué par `text-overflow`.
    bas.push(n('span', C.nom, { x: v.nomVu || '',
      a: v.nomComplet ? { title: v.nomComplet } : null }));
    if (v.serie) bas.push(n('span', C.serie, { x: v.serie,
      a: v.serieComplete ? { title: v.serieComplete } : null }));
    // ③④ LA SÉRIE, LA MENTION D'ÉDITION ET LE TIRAGE RESTENT — Preda, 06/09,
    //   confirmé une seconde fois en voyant le rendu : ce sont les axes par
    //   lesquels un collectionneur reconnaît une pièce.
    if (v.edition) bas.push(n('span', C.edition, { x: v.edition }));
    // 💰 LE PIED DE CARTOUCHE — le prix à gauche, le tirage à droite.
    //   `.tuile__p` est en `justify-content:space-between` depuis le lot 127 :
    //   la mise en page existe déjà, on ne lui ajoute rien.
    //   ⛔ ÉMIS MÊME VIDE ? NON. `.tuile__p` porte un `border-top` : une
    //   cartouche sans prix afficherait un filet qui ne sépare rien.
    if (v.prixHtml || v.tirage) {
      var pied = [];
      if (v.prixHtml) pied.push(n('span', '', { h: v.prixHtml }));
      if (v.tirage) pied.push(n('span', C.tirage, { x: v.tirage }));
      bas.push(n('span', C.prix, { k: pied }));
    }
    if (v.sansFicheTxt) bas.push(n('span', C.sansFiche, { x: v.sansFicheTxt }));

    // ⚠️ `<a>` OU `<div>`, JAMAIS UN `<a>` SANS `href` : un lien sans
    //   destination reste focusable et s'annonce comme un lien. Règle tenue par
    //   les trois fabriques depuis le lot 113.
    var racineN = n(v.href ? 'a' : 'div', v.href ? C.boite : C.muet,
      { a: v.href ? { href: v.href } : null, k: [] });
    if (haut.length) racineN.k.push(n('span', C.hd, { k: haut }));
    racineN.k.push(n('span', v.comic ? C.socleComic : C.socle, { k: dedans }));
    racineN.k.push(n('span', C.bas, { k: bas }));
    return racineN;
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  LE MONTEUR DOM — celui des DEUX pilotes
  // ═════════════════════════════════════════════════════════════════════════
  // ⭐ Générique et court : il ne connaît pas la tuile, il connaît l'arbre. Le
  //   jour où la description gagne un nœud, ce code ne bouge pas.
  // ⛔ `x` PASSE PAR `textContent`, `h` PAR `innerHTML`, et jamais l'inverse :
  //   `x` porte de la donnée de catalogue (un Sheet), `h` porte du HTML que le
  //   serveur a fabriqué. Confondre les deux serait l'injection.
  function monter(d, doc) {
    var e = doc.createElement(d.t);
    if (d.c) e.className = d.c;
    if (d.a) { for (var k in d.a) if (d.a[k] != null) {
      if (k === 'src') e.src = d.a[k]; else e.setAttribute(k, d.a[k]); } }
    if (d.h) e.innerHTML = d.h;
    else if (d.x != null) e.textContent = d.x;
    if (d.k) for (var i = 0; i < d.k.length; i++) e.appendChild(monter(d.k[i], doc));
    return e;
  }

  // ⭐⭐ LE SEUL POINT DE SORTIE, ET IL EST LE MÊME DES DEUX CÔTÉS.
  //   Chez le visiteur, `racine` est `window` : les deux pilotes lisent
  //   `window.vpTuile`. Au build, `engine/lib/tuile.mjs` évalue ce fichier dans
  //   un objet vide qui joue le rôle de `window`, et y relit la même clé.
  //   ⛔ PAS DE `module.exports` : ce dépôt est en `"type": "module"`, donc un
  //   `.js` chargé par `require()` serait lu comme un ESM et `module` n'y
  //   existerait pas — testé, l'objet rendu était vide et rien n'avait rougi.
  //   *Un point de sortie qu'on n'a pas exercé est un point de sortie absent.*
  racine.vpTuile = { decrire: decrire, monter: monter, classes: C };
})(typeof window !== 'undefined' ? window : globalThis);
