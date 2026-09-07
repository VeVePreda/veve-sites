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
    edition: 'tuile__e', prix: 'tuile__p', tirage: 'tuile__t', sansFiche: 'tuile__x',
    // 🧩 LOT I ④ — CE QUE LE MARCHÉ SAIT ET QUE LE RAYON IGNORE. Symétrique de
    //   `__e`/`__t`/`__x` trois lignes plus haut, qui sont l'inverse. Les deux
    //   classes existent dans le thème depuis le lot 127.
    off: 'tuile__off', delta: 'delta'
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
  //   onerror, comic, rarHtml, losangeHtml, prixHtml, sansFicheTxt,
  //   et depuis le lot I : offresTxt, ext (tableau), prixNoeuds (tableau),
  //   deltaSens, deltaTxt, classePlus, attrs.
  // ⭐⭐ AUCUN PRIX N'ENTRE ICI EN CLAIR, et ce n'est pas une précaution : sur
  //   un rayon, `prixHtml` est le CADENAS rendu par `Cote.astro` — le montant
  //   n'existe pas encore à l'instant du rendu. `test:fuite` ratisse ces pages,
  //   et il a raison de le faire.
  function decrire(v) {
    v = v || {};
    var haut = [];
    // ① LA RARETÉ EN PASTILLE SUR L'IMAGE — c'était l'écart ① du lot E, annulé.
    if (v.rarHtml) haut.push(n('span', C.rar, { h: v.rarHtml }));
    // 🧩 LOT I ④ — LE NOMBRE D'OFFRES, à droite du bandeau. ⚠️ `!= null` et pas
    //   une vérité : `'0'` est un compte légitime, et `''` veut dire INCONNU —
    //   ce sont deux choses que `if (v.offresTxt)` aurait confondues.
    if (v.offresTxt != null && v.offresTxt !== '') haut.push(n('span', C.off, { x: v.offresTxt }));

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
    // 🧩🔴🔴 LOT I ④ — LE BANDEAU DES EXTRÊMES EST DÉCRIT ICI, PLUS ASSEMBLÉ
    //   EN CHAÎNE CHEZ L'APPELANT. Il l'était deux fois : `rayon.js` le
    //   concaténait dans `cadenas()`, `Market.astro` le montait en DOM. Les deux
    //   écrivaient LA MÊME FORME — `<span class="b"><i>ATL</i><b>…</b></span>` —
    //   et rien ne les tenait ensemble. ⭐ Ce qui DIFFÈRE d'un appelant à l'autre
    //   n'est pas la forme, c'est ce qu'on met dans le `<b>` : un cadenas de cote
    //   pour le rayon, une valeur CLONÉE de la ligne pour le Marché. C'est donc
    //   la seule chose qu'on laisse passer en paramètre.
    if (v.ext && v.ext.length) {
      var morceaux = [];
      for (var e2 = 0; e2 < v.ext.length; e2++) {
        var x2 = v.ext[e2];
        if (!x2) continue;
        morceaux.push(n('span', x2.c, {
          a: x2.col ? { 'data-col': x2.col } : null,
          k: [n('i', '', { x: x2.lib }), n('b', '', x2.noeud ? { k: [x2.noeud] } : { h: x2.h || '' })]
        }));
      }
      if (morceaux.length) dedans.push(n('span', C.ext, { a: { 'aria-hidden': 'true' }, k: morceaux }));
    }

    var bas = [];
    // 🔤 LE NOM COUPÉ EST AFFICHÉ, LE NOM ENTIER EST EN `title`, et les DEUX
    //   fabriques posent l'attribut. C'est la correction du lot 182, et le
    //   défaut mesuré le 06/09 en production : le pilote écrivait le nom
    //   ENTIER là où le serveur écrivait le nom COUPÉ, sur 89,7 % des comics,
    //   masqué par `text-overflow`.
    bas.push(n('span', C.nom, { x: v.nomVu || '',
      a: v.nomComplet ? { title: v.nomComplet } : null }));
    // 🔴🔴 LOT I ④ — `serieVide` : UNE DIVERGENCE CONSTATÉE, PAS UN OUBLI.
    //   Les deux fabriques ne traitent pas pareil une pièce SANS sous-ligne :
    //   le rayon n'émet rien, `/market/` émettait un `<span>` vide. MESURÉ sur
    //   la page servie le 06/09 : 2 lignes sur 20 sont dans ce cas, leur
    //   cartouche fait 98 px contre 114 (le prix remonte de 15 px), et le span
    //   vide en reprend 6 — il ATTÉNUE le décalage, il ne le crée pas.
    //   ⛔ Aligner les deux fabriques ici aurait changé le rendu de `/market/`
    //   dans un lot dont la consigne est « aucun effet visible », OU celui des
    //   9 354 pages de rayon, qui ne sont pas la surface de ce lot. On garde
    //   donc les deux politiques, on les NOMME, et on laisse la trace : le bon
    //   geste est probablement d'émettre le créneau des deux côtés, mais il se
    //   décide sur une mesure du rayon, pas ici.
    if (v.serie || (v.serieVide && v.serie != null)) {
      bas.push(n('span', C.serie, { x: v.serie,
        a: v.serieComplete ? { title: v.serieComplete } : null }));
    }
    // ③④ LA SÉRIE, LA MENTION D'ÉDITION ET LE TIRAGE RESTENT — Preda, 06/09,
    //   confirmé une seconde fois en voyant le rendu : ce sont les axes par
    //   lesquels un collectionneur reconnaît une pièce.
    if (v.edition) bas.push(n('span', C.edition, { x: v.edition }));
    // 💰 LE PIED DE CARTOUCHE — le prix à gauche, le tirage à droite.
    //   `.tuile__p` est en `justify-content:space-between` depuis le lot 127 :
    //   la mise en page existe déjà, on ne lui ajoute rien.
    //   ⛔ ÉMIS MÊME VIDE ? NON. `.tuile__p` porte un `border-top` : une
    //   cartouche sans prix afficherait un filet qui ne sépare rien.
    if (v.prixHtml || v.tirage || (v.prixNoeuds && v.prixNoeuds.length) || v.deltaSens) {
      var pied = [];
      // 🧩🔴🔴 LOT I ④ — DEUX APPELANTS, DEUX FORMES DE PIED, ET C'EST VOULU.
      //   `.tuile__p` est en `justify-content:space-between` : ses ENFANTS
      //   DIRECTS sont la mise en page. Le rayon en a UN (le cadenas), le Marché
      //   en a TROIS (le montant, l'alerte, la variation) — mesuré sur la page
      //   servie : 46 px · 16 px · 58 px. Emballer les trois du Marché dans le
      //   `<span>` du rayon aurait fait passer la cartouche de 3 enfants à 2 et
      //   déplacé la variation. ⭐ Ce n'est donc pas une seconde description :
      //   c'est la même, avec un pied qui compte ce que l'appelant lui donne.
      if (v.prixNoeuds) {
        for (var q2 = 0; q2 < v.prixNoeuds.length; q2++) {
          if (v.prixNoeuds[q2]) pied.push(v.prixNoeuds[q2]);
        }
      } else if (v.prixHtml) pied.push(n('span', '', { h: v.prixHtml }));
      // 📉 LA VARIATION — ⭐⭐⭐ SON TRACÉ VIT ICI ET NULLE PART AILLEURS. C'était
      //   une recette recopiée dans `Market.astro` : trois `path` en dur dans un
      //   `innerHTML`. *Quand deux fabriques doivent montrer la même chose, on
      //   transporte le résultat, pas la recette* — et une flèche est une forme,
      //   donc elle est décrite ici, comme la tuile qui la porte.
      //   ⚠️ Le TEXTE est une donnée (« -24,6 % ») : il passe par `x`, jamais par
      //   `h`. Le SVG est une forme fixe : il passe par `h`. Les deux cohabitent
      //   dans le même nœud, et `monter()` sait poser l'un puis l'autre.
      if (v.deltaSens) {
        var trace = v.deltaSens === 'up' ? 'M6 2 11 9H1z'
          : v.deltaSens === 'down' ? 'M6 10 1 3h10z' : 'M2 6h8';
        pied.push(n('span', C.delta + ' ' + C.delta + '--' + v.deltaSens, {
          h: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="' + trace + '"/></svg>',
          x: v.deltaTxt == null ? '' : v.deltaTxt
        }));
      }
      if (v.tirage) pied.push(n('span', C.tirage, { x: v.tirage }));
      if (pied.length) bas.push(n('span', C.prix, { k: pied }));
    }
    if (v.sansFicheTxt) bas.push(n('span', C.sansFiche, { x: v.sansFicheTxt }));

    // ⚠️ `<a>` OU `<div>`, JAMAIS UN `<a>` SANS `href` : un lien sans
    //   destination reste focusable et s'annonce comme un lien. Règle tenue par
    //   les trois fabriques depuis le lot 113.
    // 🧩 LOT I ④ — `classePlus` et `attrs` : ce que le Marché pose sur la boîte
    //   et que le rayon ne pose pas — la classe `revele` de l'apparition, le
    //   `--i` de son rang, et les DIX attributs `data-` recopiés en bloc depuis
    //   la ligne. ⛔ Ils passent par un dictionnaire ANONYME : nommer les dix
    //   ici rouvrirait exactement la panne ① du lot 71 (quatre attributs sur
    //   dix, donc quatre groupes de filtres qui laissaient tout passer).
    var attrsR = v.href ? { href: v.href } : {};
    if (v.attrs) { for (var w2 in v.attrs) if (v.attrs[w2] != null) attrsR[w2] = v.attrs[w2]; }
    var racineN = n(v.href ? 'a' : 'div',
      (v.href ? C.boite : C.muet) + (v.classePlus ? ' ' + v.classePlus : ''),
      { a: attrsR, k: [] });
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
    // 🧩 LOT I ④ — `h` PUIS `x` PEUVENT COHABITER, et c'est la variation qui
    //   l'exige : une flèche fabriquée (`h`) suivie d'un pourcentage de données
    //   (`x`). ⛔ `textContent` après `innerHTML` aurait EFFACÉ la flèche : on
    //   ajoute donc un nœud de texte, on ne réécrit pas le contenu.
    if (d.h) {
      e.innerHTML = d.h;
      if (d.x) e.appendChild(doc.createTextNode(d.x));
    } else if (d.x != null) e.textContent = d.x;
    // 🧩🔴🔴 LOT I ④ — UN ENFANT PEUT ÊTRE UN NŒUD DÉJÀ MONTÉ. C'est la règle du
    //   transport prise au mot : le Marché CLONE le montant, l'alerte et les
    //   extrêmes depuis la ligne du tableau — il ne les refabrique pas, et il
    //   n'a donc pas de description à en donner. ⛔ Ce cas n'existe QUE chez le
    //   client : `engine/lib/tuile.mjs`, qui sérialise au build, refuse un nœud
    //   plutôt que de le sérialiser à moitié.
    if (d.k) for (var i = 0; i < d.k.length; i++) {
      var enf = d.k[i];
      if (!enf) continue;
      e.appendChild(enf.nodeType ? enf : monter(enf, doc));
    }
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
