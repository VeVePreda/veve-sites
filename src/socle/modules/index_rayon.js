// ⚠️ VeVePreda/veve-sites — src/socle/modules/index_rayon.js   (FICHIER NEUF — lot 155-B)
// ═══════════════════════════════════════════════════════════════════════════
//  LE CHARGEUR D'INDEX DE RAYON — UN SEUL, POUR LES DEUX PILOTES
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 POURQUOI CE FICHIER EXISTE, ET POURQUOI IL EST NÉ AU LOT 155-B.
// Au 155-A, un seul pilote lisait `/rayon-index/*.json` : `rayon.js`. Ce lot en
// fait lire un second — `series.js`, pour que `/sets/` cesse de rendre ses
// 3 113 cartes. Deux lecteurs du même fichier, c'est le motif que ce dépôt a
// déjà payé quatre fois (lots 127, 131, 132, puis 155-A) : *deux fabriques qui
// lisent la même chose divergent au premier lot qui n'en touche qu'une.*
//
// ⭐⭐ ET LE PRÉCÉDENT EST ÉCRIT : au §M-193 ⑧, le pilote de rayon aurait pu
// faire son propre `fetch` vers `/api/cote/lot` — avec son propre plafond, sa
// propre lecture du 401, son propre format de nombre. On a fait `window.vpCote`,
// un seul remplisseur appelé par qui peint. **Même geste ici, même raison.**
//
// ⛔ CE QU'IL NE FAIT PAS, ET C'EST LA MOITIÉ DE SON INTÉRÊT :
//   · il ne filtre pas, ne trie pas, ne peint pas — deux pilotes rendent deux
//     choses différentes (des LIGNES de tableau, des CARTES de set) ;
//   · il ne connaît aucun identifiant de page (`f-rayon`, `f-sets`, `s-grille`) ;
//   · il n'écrit RIEN dans le document. Un chargeur qui touche à la page
//     déciderait à la place du pilote de ce qu'un échec veut dire.
//
// 🔴 ET SI LE `fetch` ÉCHOUE, IL REND `null` — PAS UNE CHARGE VIDE.
// La page du serveur reste servie, paginée, exacte. C'est au pilote de dire
// l'échec à l'endroit qu'il a prévu pour ça. ⛔ Une charge vide rendue ici
// ferait remplacer la liste par du néant, en silence.
//
// ⛔⛔ ET IL N'EST PAS DANS LE SOCLE GLOBAL. C'est l'arbitrage du lot 137 repris
// mot pour mot : 3 093 pages sur 3 097 n'ont aucune barre de filtres. Le verser
// au socle commun déplacerait le gaspillage au lieu de le supprimer.
(function () {
  var cache = {};   // url -> promesse, pour que deux appels ne fassent qu'un fetch

  /** Charge un index de rayon et rend un petit objet de lecture.
   *  ⭐⭐ `pos` EST CONSTRUIT DEPUIS `cols`, JAMAIS ÉCRIT EN DUR — c'est LE
   *  contrat du 155-A : « le jour où une colonne s'ajoute au milieu, le pilote
   *  lit `cols` et se décale tout seul ; s'il lisait des positions gravées des
   *  deux côtés, il rendrait des marques à la place des licences, sans erreur. »
   *  Ce lot vient précisément d'ajouter deux colonnes aux sets (`nv`, `c`) : la
   *  promesse est tenue le jour même où elle est mise à l'épreuve. */
  window.vpIndexRayon = function (url) {
    if (cache[url]) return cache[url];
    cache[url] = fetch(url, { headers: { accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) {
        // ⛔ UN INDEX VIDE N'EST PAS UN INDEX. `priceEnabled()` faux rend une
        // charge à zéro ligne (cf. la route) : la traiter comme un succès
        // remplacerait la page par du vide.
        if (!j || !j.lignes || !j.lignes.length) throw new Error('index vide');
        var pos = {};
        for (var k = 0; k < j.cols.length; k++) pos[j.cols[k]] = k;
        return {
          charge: j,
          pos: pos,
          /** La valeur brute d'une colonne, ou `null` si la colonne n'existe pas
           *  dans CETTE charge. ⭐ `null` et pas `undefined` : un pilote qui teste
           *  `== null` attrape les deux, un qui teste `=== undefined` en rate un. */
          val: function (l, k) { return pos[k] === undefined ? null : l[pos[k]]; },
          /** Le MOT derrière un index de dictionnaire. ⭐ Les dictionnaires sont
           *  1-indexés et `0` veut dire « vide » — c'est la convention du
           *  producteur (`rayon_index.mjs`), et elle se lit ici une seule fois. */
          mot: function (l, k) {
            var i = pos[k] === undefined ? 0 : l[pos[k]];
            var d = j.dic && j.dic[k];
            return i && d ? d[i - 1] : '';
          },
        };
      })
      .catch(function (e) {
        // ⭐ ON OUBLIE L'ÉCHEC : un second geste du visiteur doit pouvoir
        // réessayer. Un cache d'échec transformerait une coupure d'une seconde
        // en panne définitive pour toute la visite.
        delete cache[url];
        if (window.console) console.warn('[index-rayon] ' + url + ' indisponible : ' + e.message);
        return null;
      });
    return cache[url];
  };
})();
