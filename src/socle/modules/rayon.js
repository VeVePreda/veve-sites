// ⚠️ VeVePreda/veve-sites — src/socle/modules/rayon.js   (FICHIER NEUF — lot 155)
// ═══════════════════════════════════════════════════════════════════════════
//  LE PILOTE DE LA BARRE DE RAYON — UN SEUL, POUR LES TROIS RAYONS
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ CE PILOTE NE FILTRE PAS DES NŒUDS, IL FILTRE DES VALEURS ET REND DES
// NŒUDS. C'est toute la différence avec `series.js`, qui cache et réordonne les
// 3 113 cartes déjà présentes dans le DOM — et c'est pour ça que `/sets/` pèse
// 3 254 934 o. Ici la page sert 20 lignes, l'index porte le rayon entier, et le
// pilote peint ce que le filtre retient. → `engine/lib/rayon_index.mjs`
//
// ⛔⛔ L'INDEX N'EST CHARGÉ QU'AU PREMIER GESTE, ET C'EST LA MOITIÉ DU GAIN.
// Un `fetch` au chargement le ferait payer par tout membre qui passe sur
// `/comics/page/412/` sans rien chercher. Même politique que la recherche du
// site, qui charge `search-index.json` à la PREMIÈRE FRAPPE : *qui ne cherche
// rien ne paie rien.*
//
// 🔴🔴 ET SI LE `fetch` ÉCHOUE, LA PAGE DU SERVEUR RESTE. C'est écrit ici parce
// que le réflexe inverse coûte cher : vider la liste puis échouer laisserait un
// rayon VIDE, sans erreur visible, sur une page qui marchait. On ne prend la
// main sur la liste qu'une fois l'index EN MAIN — et un échec le DIT.
// → `regle-repli-ecrit-avant-la-source` : un repli qui se tait est un repli
//   qu'on découvre en production.
//
// ⚠️ ÉCRIT EN ES5 (`var`, `function`), comme `series.js`, `cadran.js` et
// `favoris.js` : ces modules ne passent par aucun transpileur — ils sont servis
// tels quels par la route du socle.
(function () {
  var f = document.getElementById('f-rayon');
  if (!f) return;
  var L = document.getElementById('r-liste');
  if (!L) return;

  var CPT = document.getElementById('r-cpt');
  var VIDE = document.getElementById('r-vide');
  var ACTIFS = document.getElementById('r-actifs');
  var PAGIN = document.getElementById('r-pagin');
  var PLUS = document.getElementById('r-plus');
  var PLUSC = document.getElementById('r-plus-cpt');

  // ⭐ LE PAS VIENT DU SERVEUR (`data-pas`), IL N'EST PAS ÉCRIT ICI. C'est le
  // `PAR_PAGE` de `Rayon.astro` : une tranche filtrée doit faire la même taille
  // qu'une page du rayon, sinon la liste change de rythme dès qu'on filtre.
  var PAS = parseInt(f.getAttribute('data-pas'), 10) || 20;

  // ⭐ LES LIBELLÉS VIENNENT D'ATTRIBUTS POSÉS PAR LE SERVEUR, JAMAIS D'UNE
  // CHAÎNE ÉCRITE ICI. Un texte en dur dans un module de socle est un texte
  // anglais servi aux cinq langues, et `test:cles` ne le verrait pas : il lit
  // les appels à `t()`, pas les littéraux d'un fichier `.js`.
  function txt(cle) { return f.getAttribute('data-' + cle) || ''; }

  // 🔴 LE CADENAS VIENT D'UN `<template>`, PAS D'UN ATTRIBUT — voir le bloc de
  //   `BarreRayon.astro` : un SVG dans une valeur d'attribut désynchronise
  //   `marquer_i18n.mjs` sous `I18N_MARQUAGE=1`, et casse la balise entière.
  //   ⭐ `innerHTML` d'un `<template>` : le contenu n'est jamais peint, et c'est
  //   toujours le glyphe du serveur — une seule source.
  var TPL = document.getElementById('r-cadenas');
  var CADENAS = TPL ? TPL.innerHTML : '';

  var idx = null;        // la charge de l'index, une fois arrivée
  var pos = {};          // nom de colonne -> position dans une ligne
  var enCours = null;    // la promesse du fetch, pour ne pas le lancer deux fois
  var laMain = false;    // le pilote a-t-il pris la main sur la liste ?
  var montre = 0;        // combien de lignes filtrées sont peintes
  var puceFaite = {};

  function nombre(v) { var n = parseInt(v, 10); return isNaN(n) ? null : n; }
  function val(id) { var e = document.getElementById(id); return e ? String(e.value).trim() : ''; }
  function ligneVal(l, k) { return pos[k] === undefined ? null : l[pos[k]]; }
  function mot(l, k) {
    var i = ligneVal(l, k);
    var d = idx.dic[k];
    return i && d ? d[i - 1] : '';
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ① CHARGER L'INDEX
  // ═══════════════════════════════════════════════════════════════════════
  // 🔴 LOT 155-B — LE `fetch` A DÉMÉNAGÉ DANS `index_rayon.js`, ET CE N'EST PAS
  // UN RANGEMENT. `series.js` lit désormais le MÊME fichier pour `/sets/` :
  // deux `fetch`, deux lectures de `cols`, deux conventions de dictionnaire, et
  // c'est le motif que ce dépôt a payé quatre fois. ⭐ Même geste qu'au §M-193 ⑧
  // avec `window.vpCote` : un seul appelant du même échange.
  // ⛔ CE QUI RESTE ICI EST CE QUI EST PROPRE À CETTE PAGE — le message d'attente,
  // le message d'échec, `bornes()` et `elaguer()`. Un chargeur qui écrirait dans
  // le compteur déciderait à la place du pilote de ce qu'un échec veut dire.
  function charger() {
    if (idx) return Promise.resolve(true);
    if (enCours) return enCours;
    CPT.textContent = txt('chargement');
    enCours = window.vpIndexRayon(f.getAttribute('data-index')).then(function (ix) {
      if (!ix) {
        // 🔴 ON NE TOUCHE PAS À LA LISTE. La page du serveur reste servie,
        // paginée, exacte. Le compteur porte l'échec — le silence serait pire.
        enCours = null;
        CPT.textContent = txt('echec');
        return false;
      }
      idx = ix.charge;
      pos = ix.pos;
      bornes();
      elaguer();
      return true;
    });
    return enCours;
  }

  /** ⚠️ LES BORNES SONT CALCULÉES SUR LE CORPUS, JAMAIS ÉCRITES EN DUR. Un
   *  `placeholder="1 000"` gravé se périme le jour où le catalogue bouge, en
   *  silence, et personne ne relit un placeholder. Même règle que `bornes()`
   *  dans `Market.astro`, appliquée du côté du navigateur. */
  function bornes() {
    var mini = {}, maxi = {};
    for (var i = 0; i < idx.lignes.length; i++) {
      var l = idx.lignes[i];
      ['a', 't'].forEach(function (k) {
        var v = ligneVal(l, k);
        if (!v) return;                       // 0 = inconnu, ⛔ pas « zéro »
        if (mini[k] === undefined || v < mini[k]) mini[k] = v;
        if (maxi[k] === undefined || v > maxi[k]) maxi[k] = v;
      });
    }
    [['r-a1', 'a', mini], ['r-a2', 'a', maxi], ['r-t1', 't', mini], ['r-t2', 't', maxi]]
      .forEach(function (p) {
        var e = document.getElementById(p[0]);
        if (!e || p[2][p[1]] === undefined) return;
        e.placeholder = String(p[2][p[1]]);
        if (p[1] === 'a') { e.min = String(mini.a); e.max = String(maxi.a); }
      });
  }

  /**
   * ⛔⛔ UN ONGLET QUI NE SÉPARE RIEN EST RETIRÉ, ET C'EST LE JOURNAL DU BUILD
   * QUI A EXIGÉ CETTE FONCTION.
   * Au premier build réel du lot 155, `journalIndex()` a sorti :
   *     comics : … · e 0/16789 (0 valeurs)
   * Zéro. `mentionEdition()` ne retient que FA, FE et AP (liste de Preda,
   * `vitrine.mjs` l. 101) et AUCUN comic n'en porte — les 220 valeurs brutes
   * d'`edition_type` sont autre chose. L'onglet « Édition » se serait donc
   * affiché sur les 839 pages de comics, se serait ouvert sur un panneau vide,
   * et aurait rendu « 0 / 16 789 » dès qu'on aurait coché quoi que ce soit.
   * ⭐⭐ C'est la règle du lot 133, appliquée par le pilote au lieu du serveur :
   * un filtre n'apparaît que s'il a au moins DEUX valeurs. À une seule, il ne
   * sépare rien et occupe la place d'un contrôle utile.
   * ⚠️ ET LE SERVEUR NE POUVAIT PAS LE FAIRE : il émet la barre sans savoir ce
   * que l'index contiendra (l'index est construit par une autre route). C'est
   * donc ici, une fois la charge en main, ou nulle part.
   * 🔴 Un onglet retiré l'est AVEC son panneau : un panneau orphelin reste
   * atteignable au clavier.
   */
  function elaguer() {
    [].slice.call(f.querySelectorAll('.f-b[data-g]')).forEach(function (b) {
      var g = b.getAttribute('data-g');
      var pan = document.getElementById('rp-' + g);
      if (!pan) return;
      var hote = pan.querySelector('[data-puces]');
      var garder;
      if (hote) {
        var axe = hote.getAttribute('data-puces');
        var vus = {}, n = 0;
        if (pos[axe] === undefined) { n = 0; } else {
          for (var i = 0; i < idx.lignes.length; i++) {
            var v = ligneVal(idx.lignes[i], axe);
            if (v && !vus[v]) { vus[v] = 1; n++; }
          }
        }
        garder = n > 1;
      } else {
        // Les panneaux de BORNES (année, tirage) : deux valeurs distinctes au
        // moins, sinon la plage n'a rien à trancher.
        var k = g === 'annee' ? 'a' : 't';
        var mini = null, maxi = null;
        for (var j = 0; j < idx.lignes.length; j++) {
          var x = ligneVal(idx.lignes[j], k);
          if (!x) continue;
          if (mini === null || x < mini) mini = x;
          if (maxi === null || x > maxi) maxi = x;
        }
        garder = mini !== null && maxi !== null && maxi > mini;
      }
      if (!garder) { b.hidden = true; pan.hidden = true; }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ② LES PUCES — CONSTRUITES DEPUIS L'INDEX, AVEC LEUR COMPTE
  // ═══════════════════════════════════════════════════════════════════════
  // ⭐⭐ LE COMPTEUR SE COMPTE, IL NE SE RECOPIE PAS (leçon du lot 143).
  // « Marvel 2 986 » dit d'un coup d'œil où est la matière ; un nombre qui ne
  // correspond pas à ce qui s'affiche est la faute la plus coûteuse d'un
  // filtre — il n'a pas l'air cassé, il a l'air faux.
  function remplirPuces(hote) {
    if (!hote) return;
    var axe = hote.getAttribute('data-puces');
    if (!axe || puceFaite[axe] || !idx || pos[axe] === undefined) return;
    var noms = idx.dic[axe] || [];
    var n = [];
    for (var i = 0; i < idx.lignes.length; i++) {
      var v = ligneVal(idx.lignes[i], axe);
      if (v) n[v] = (n[v] || 0) + 1;
    }
    var ordre = [];
    for (var k = 1; k <= noms.length; k++) if (n[k]) ordre.push(k);
    // ⭐⭐⭐ LA LICENCE ET LA RARETÉ SE TRIENT PAR NOMBRE, LA MARQUE PAR NOM, ET
    // C'EST UNE MESURE, PAS UN GOÛT (lot 133) : Marvel porte l'essentiel des
    // titres ; un ordre alphabétique mettrait « ABLAZE Publishing » en tête et
    // enterrerait Marvel au milieu. La marque, elle, se cherche par son nom —
    // 1 169 entrées et un champ de recherche. Deux listes, deux usages.
    if (axe === 'b' || axe === 'se') ordre.sort(function (a, b) { return noms[a - 1].localeCompare(noms[b - 1]); });
    else ordre.sort(function (a, b) { return (n[b] - n[a]) || noms[a - 1].localeCompare(noms[b - 1]); });

    var frag = document.createDocumentFragment();
    ordre.forEach(function (k) {
      var brut = noms[k - 1];
      var lab = document.createElement('label');
      lab.className = 'puce';
      lab.setAttribute('data-b', String(brut).toLowerCase());
      var c = document.createElement('input');
      c.type = 'checkbox'; c.name = 'r-' + axe; c.value = String(k);
      lab.appendChild(c);
      // ⭐ LA RARETÉ SORT SA PASTILLE, ET C'EST CELLE DU SERVEUR : `idx.rar`
      //   porte le HTML rendu par `rar()`. ⛔ Le réécrire ici produirait une
      //   sixième forme de « deux gabarits pour une même liste ».
      if (axe === 'r' && idx.rar && idx.rar[brut]) {
        var p = document.createElement('span');
        p.innerHTML = idx.rar[brut].h;
        lab.appendChild(p);
      } else {
        lab.appendChild(document.createTextNode(' ' + brut + ' '));
      }
      var e = document.createElement('span');
      e.className = 'etiq';
      e.style.opacity = '.65';
      e.style.marginLeft = '5px';
      e.textContent = String(n[k]);
      lab.appendChild(e);
      frag.appendChild(lab);
    });
    hote.appendChild(frag);
    puceFaite[axe] = true;
  }

  // ⭐ LA RECHERCHE DANS UN PANNEAU DE PUCES — un seul écouteur pour les deux
  // panneaux qui en ont un (licence et marque), branché sur `data-cherche`.
  // ⛔ Deux scripts pour le même geste, c'était l'écart exact que Preda a
  // signalé : le filtre Marque de `/sets/` avait sa recherche, le filtre
  // Licence non, à vingt lignes de distance.
  // ⚠️ ELLE NE FILTRE QUE L'AFFICHAGE DES CASES, jamais les lignes. Une case
  // décochée reste décochée quand elle réapparaît — sinon taper trois lettres
  // effacerait la sélection en cours.
  [].slice.call(f.querySelectorAll('[data-cherche]')).forEach(function (q) {
    q.addEventListener('input', function () {
      var pan = q.closest ? q.closest('.f-panneau') : q.parentNode;
      if (!pan) return;
      var etiquettes = [].slice.call(pan.querySelectorAll('[data-b]'));
      var t = q.value.trim().toLowerCase();
      var vus = 0;
      etiquettes.forEach(function (el) {
        var on = !t || el.getAttribute('data-b').indexOf(t) !== -1;
        el.hidden = !on;
        if (on) vus++;
      });
      var vide = pan.querySelector('[data-vide]');
      if (vide) vide.hidden = vus > 0;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  ③ L'ÉTAT ET LE FILTRE
  // ═══════════════════════════════════════════════════════════════════════
  var fiche = '';   // '' = tout · '1' = avec une fiche · '0' = sans

  function coches(axe) {
    return [].slice.call(f.querySelectorAll('input[name="r-' + axe + '"]:checked'))
      .map(function (x) { return parseInt(x.value, 10); });
  }

  function etat() {
    return {
      q: val('r-q').toLowerCase(),
      fiche: fiche,
      tri: val('r-tri') || 'fiche',
      l: coches('l'), b: coches('b'), r: coches('r'), e: coches('e'),
      a1: nombre(val('r-a1')), a2: nombre(val('r-a2')),
      t1: nombre(val('r-t1')), t2: nombre(val('r-t2')),
    };
  }

  function garde(e, l) {
    if (e.fiche === '1' && !ligneVal(l, 'p')) return false;
    if (e.fiche === '0' && ligneVal(l, 'p')) return false;
    // ⭐ LA RECHERCHE PORTE SUR LE NOM **ET** LA SÉRIE. Un collectionneur tape
    //   « spider-man » en pensant à la série autant qu'au titre de la pièce.
    if (e.q) {
      var n = String(ligneVal(l, 'n') || '').toLowerCase();
      if (n.indexOf(e.q) === -1 && String(mot(l, 'se')).toLowerCase().indexOf(e.q) === -1) return false;
    }
    var axes = ['l', 'b', 'r', 'e'];
    for (var i = 0; i < axes.length; i++) {
      var k = axes[i];
      if (e[k].length && e[k].indexOf(ligneVal(l, k)) === -1) return false;
    }
    // ⛔ UNE BORNE NE JETTE PAS CE QU'ELLE NE CONNAÎT PAS. Une année ou un
    //   tirage à 0 vaut « inconnu », pas « zéro » : le filtrer sur `< min`
    //   ferait disparaître 99 lignes de comics sans mention d'année, et le
    //   filtre aurait l'air de marcher. Elles passent, et le tri les met au bout.
    var a = ligneVal(l, 'a');
    if (a) { if (e.a1 !== null && a < e.a1) return false; if (e.a2 !== null && a > e.a2) return false; }
    var tg = ligneVal(l, 't');
    if (tg) { if (e.t1 !== null && tg < e.t1) return false; if (e.t2 !== null && tg > e.t2) return false; }
    return true;
  }

  // 🔴 LE PREMIER TRI EST CELUI DU SERVEUR. `Rayon.astro` trie « ce qui a une
  //   fiche d'abord, puis série, puis nom », et l'index est DÉPOSÉ dans cet
  //   ordre : `fiche` n'a donc rien à trier, il rend l'ordre du fichier.
  //   ⛔ Un comparateur qui « refait » ce tri risquerait d'en produire un autre.
  var ORDRE = {
    fiche: null,
    nom: function (a, b) { return String(a[pos.n]).localeCompare(String(b[pos.n])); },
    annee: function (a, b) { return (b[pos.a] || 0) - (a[pos.a] || 0); },
    tirage: function (a, b) { return (a[pos.t] || Infinity) - (b[pos.t] || Infinity); },
    licence: function (a, b) {
      var d = String(mot(a, 'l')).localeCompare(String(mot(b, 'l')));
      return d !== 0 ? d : String(a[pos.n]).localeCompare(String(b[pos.n]));
    },
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  ④ RENDRE UNE LIGNE — LE MÊME BALISAGE QUE `Rayon.astro`
  // ═══════════════════════════════════════════════════════════════════════
  // 🔴🔴🔴 LA SECONDE FABRIQUE NE MONTRE QUE CE QUE SA SOURCE PORTE, ET C'EST
  // POUR ÇA QUE L'INDEX PORTE CE QU'IL PORTE : la mention d'édition RENDUE, la
  // pastille de rareté RENDUE, l'uuid pour le badge ATL/ATH. Chaque champ de ce
  // gabarit a été mis dans l'index EXPRÈS. ⛔ Ajouter un `<span>` ici sans
  // ajouter sa source là-bas ne produirait rien — la faute qui a coûté deux
  // lots (`/market/`, `/favoris/`).
  // ⚠️ `<a>` OU `<div>`, JAMAIS un `<a>` sans `href` : un lien sans destination
  //   reste focusable et s'annonce comme un lien. Même règle qu'au serveur.
  // ⚠️ `textContent` PARTOUT, jamais `innerHTML`, pour tout ce qui vient du
  //   catalogue : un nom de pièce est une donnée d'un Sheet. Les deux seuls
  //   `innerHTML` de ce fichier reçoivent du HTML fabriqué par `vitrine.mjs`.
  function rendre(l) {
    var li = document.createElement('li');
    li.className = 'rayon__l';
    var p = ligneVal(l, 'p');
    var boite = document.createElement(p ? 'a' : 'div');
    boite.className = 'rayon__c' + (p ? '' : ' rayon__c--muet');
    if (p) boite.setAttribute('href', idx.prefixe + p);

    var n = document.createElement('span');
    n.className = 'rayon__n';
    n.textContent = String(ligneVal(l, 'n') || '');
    boite.appendChild(n);

    var se = mot(l, 'se');
    if (se) {
      var s = document.createElement('span');
      s.className = 'rayon__s';
      s.textContent = se;
      boite.appendChild(s);
    }
    var men = mot(l, 'e');
    if (men) {
      var m = document.createElement('span');
      m.className = 'rayon__e';
      m.textContent = men;
      boite.appendChild(m);
    }
    var code = mot(l, 'r');
    if (code && idx.rar && idx.rar[code]) {
      var rr = document.createElement('span');
      rr.innerHTML = idx.rar[code].h;
      boite.appendChild(rr.firstChild);
    }
    // 🔴🔴 LES EXTRÊMES, ET SEULEMENT SI LA PIÈCE A UNE FICHE — décision Preda
    //   du 11/08 : les lignes sans fiche n'auront JAMAIS de cote, et un cadenas
    //   dessus dirait « je ne montre pas » là où la vérité est « je n'ai pas ».
    //   ⭐ Le balisage est celui de `Cote.astro` : `60-cote.js` cherche
    //   `[data-cote]` et remplit `[data-cote-v]`. On l'appelle en fin de rendu.
    var u = ligneVal(l, 'u');
    if (p && u) {
      var ext = document.createElement('span');
      ext.className = 'rayon__ext';
      ext.setAttribute('aria-hidden', 'true');
      ext.innerHTML = cadenas('b', 'ATL', u, 'atl') + cadenas('h', 'ATH', u, 'ath');
      boite.appendChild(ext);
    }
    var tg = ligneVal(l, 't');
    if (tg) {
      var tt = document.createElement('span');
      tt.className = 'rayon__t';
      tt.textContent = String(tg);
      boite.appendChild(tt);
    }
    if (!p) {
      var x = document.createElement('span');
      x.className = 'rayon__x';
      x.textContent = txt('sansfiche');
      boite.appendChild(x);
    }
    li.appendChild(boite);
    return li;
  }

  /** Le `<span class="cote">` de `Cote.astro`, sans son SVG de cadenas : le
   *  thème le dessine depuis `.cote__l`, et le serveur l'écrit en dur. ⭐ On
   *  émet la même structure et le même `title` (`data-titre`, posé par le
   *  serveur donc traduit) — le cadenas graphique est repris du gabarit. */
  function cadenas(cl, k, uuid, champ) {
    return '<span class="' + cl + '"><i>' + k + '</i><b>'
      // ⛔ `class="cote"` ET RIEN DE PLUS — comparé à l'octet près au HTML servi
      //   par `Extremes.astro` sur `/comics/page/2/`. La première version
      //   écrivait `class="cote rayon__cote"` : une classe QUE PERSONNE NE PEINT
      //   (le thème connaît `.rayon__ext` et `.cote`, pas `.rayon__cote`).
      //   Elle n'aurait rien cassé et n'aurait rien fait — c'est
      //   `regle-emetteur-sans-regle`, la faute qui traverse une revue parce
      //   qu'elle est invisible dans les deux sens.
      + '<span class="cote" data-cote="' + uuid + '" data-champ="' + champ + '"'
      + ' title="' + txt('titrecote').replace(/"/g, '&quot;') + '">'
      + '<span class="cote__v" data-cote-v>—</span>'
      + '<span class="cote__l" aria-hidden="true">' + CADENAS + '</span>'
      + '</span></b></span>';
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ⑤ APPLIQUER
  // ═══════════════════════════════════════════════════════════════════════
  function prendreLaMain() {
    if (laMain) return;
    // ⛔ LA PAGINATION DU SERVEUR EST RETIRÉE, PAS LAISSÉE À CÔTÉ. Elle mène aux
    //   pages du rayon NON filtré : la garder afficherait « page 2 sur 839 »
    //   sous une liste de trois résultats. Un contrôle qui répond à côté est
    //   pire qu'un contrôle absent.
    if (PAGIN) PAGIN.hidden = true;
    laMain = true;
  }

  function appliquer() {
    if (!idx) return;
    prendreLaMain();
    var e = etat();
    var vus = [];
    for (var i = 0; i < idx.lignes.length; i++) if (garde(e, idx.lignes[i])) vus.push(idx.lignes[i]);
    var cmp = ORDRE[e.tri];
    if (cmp) vus.sort(cmp);

    if (!montre) montre = PAS;
    var tranche = vus.slice(0, montre);
    // ⭐ UN SEUL REMPLACEMENT DU CONTENU, PAS `n` INSERTIONS. Peindre 20 lignes
    //   une par une dans le document vivant provoque autant de recalculs.
    var frag = document.createDocumentFragment();
    for (var k = 0; k < tranche.length; k++) frag.appendChild(rendre(tranche[k]));
    L.textContent = '';
    L.appendChild(frag);

    // ⭐ ET ON RÉCLAME LES COTES POUR CE QUI VIENT D'ÊTRE PEINT. `60-cote.js`
    //   ne tourne qu'au chargement : sans cet appel, les badges ATL/ATH des
    //   lignes filtrées resteraient cadenassés pour une raison fausse.
    if (window.vpCote) window.vpCote(L);

    CPT.textContent = vus.length + ' / ' + idx.total;
    VIDE.hidden = vus.length !== 0;
    if (PLUS) {
      PLUS.hidden = vus.length <= montre;
      if (PLUSC) PLUSC.textContent = Math.min(montre, vus.length) + ' / ' + vus.length;
    }
    jetons(e);
    compteurs(e);
  }

  /** Les jetons de ce qui est actif. ⭐ Chacun sait se retirer : un filtre qu'on
   *  ne voit pas est un filtre qu'on oublie, puis qu'on croit cassé. */
  function jetons(e) {
    ACTIFS.textContent = '';
    function jeton(texte, retirer) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'jeton';
      b.textContent = texte + ' ';
      var x = document.createElement('span');
      x.setAttribute('aria-hidden', 'true');
      x.textContent = '×';
      b.appendChild(x);
      b.setAttribute('aria-label', texte);
      b.onclick = function () { retirer(); montre = PAS; appliquer(); };
      ACTIFS.appendChild(b);
    }
    ['l', 'b', 'r', 'e'].forEach(function (axe) {
      e[axe].forEach(function (k) {
        var brut = (idx.dic[axe] || [])[k - 1] || '';
        var libelle = (axe === 'r' && idx.rar && idx.rar[brut]) ? idx.rar[brut].l : brut;
        jeton(libelle, function () {
          var c = f.querySelector('input[name="r-' + axe + '"][value="' + k + '"]');
          if (c) c.checked = false;
        });
      });
    });
    [['r-a1', e.a1], ['r-a2', e.a2], ['r-t1', e.t1], ['r-t2', e.t2]].forEach(function (pr) {
      if (pr[1] === null) return;
      var ch = document.getElementById(pr[0]);
      var et = ch && ch.parentNode.querySelector('.etiq');
      jeton((et ? et.textContent + ' ' : '') + pr[1], function () { ch.value = ''; });
    });
  }

  function compteurs(e) {
    var par = {
      licence: e.l.length, marque: e.b.length, rarete: e.r.length, edition: e.e.length,
      annee: (e.a1 !== null ? 1 : 0) + (e.a2 !== null ? 1 : 0),
      tirage: (e.t1 !== null ? 1 : 0) + (e.t2 !== null ? 1 : 0),
    };
    [].slice.call(f.querySelectorAll('.f-b[data-g]')).forEach(function (b) {
      var c = b.querySelector('.cpt-f');
      if (!c) return;
      var v = par[b.getAttribute('data-g')] || 0;
      c.textContent = String(v);
      c.hidden = !v;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ⑥ LES ÉCOUTEURS — chacun charge l'index d'abord
  // ═══════════════════════════════════════════════════════════════════════
  function agir() { montre = PAS; charger().then(function (ok) { if (ok) appliquer(); }); }

  [].slice.call(f.querySelectorAll('[data-fiche]')).forEach(function (b) {
    b.addEventListener('click', function () {
      fiche = b.getAttribute('data-fiche');
      [].slice.call(f.querySelectorAll('[data-fiche]')).forEach(function (o) {
        o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
      });
      agir();
    });
  });

  var boutons = [].slice.call(f.querySelectorAll('.f-b[data-g]'));
  boutons.forEach(function (b) {
    var pan = document.getElementById('rp-' + b.getAttribute('data-g'));
    if (!pan) return;
    b.addEventListener('click', function () {
      // ⭐ L'INDEX ARRIVE AVANT LES PUCES, ET LES PUCES AVANT L'OUVERTURE — sinon
      //   le panneau s'ouvre vide et se remplit sous les doigts.
      charger().then(function (ok) {
        if (ok) remplirPuces(pan.querySelector('[data-puces]'));
        var ouvrir = pan.hidden;
        boutons.forEach(function (o) {
          var p2 = document.getElementById('rp-' + o.getAttribute('data-g'));
          if (p2) p2.hidden = true;
          o.setAttribute('aria-expanded', 'false');
        });
        pan.hidden = !ouvrir;
        b.setAttribute('aria-expanded', String(ouvrir));
      });
    });
  });

  if (PLUS) PLUS.addEventListener('click', function () { montre += PAS; appliquer(); });
  f.addEventListener('input', agir);
  f.addEventListener('change', agir);
  // ⚠️ `setTimeout` : au moment où `reset` se déclenche, les champs portent
  //   encore leurs anciennes valeurs. Même détour que `series.js`.
  f.addEventListener('reset', function () {
    setTimeout(function () {
      fiche = '';
      [].slice.call(f.querySelectorAll('[data-fiche]')).forEach(function (o) {
        o.setAttribute('aria-pressed', o.getAttribute('data-fiche') === '' ? 'true' : 'false');
      });
      agir();
    }, 0);
  });

  // ⛔ AUCUN APPEL À `appliquer()` ICI. Le pilote se tait jusqu'au premier geste :
  // la page servie par le serveur est déjà juste, et un rendu immédiat ferait
  // payer l'index à qui n'a rien demandé. *Un module qui s'active tout seul est
  // un module qu'on ne peut plus ne pas payer.*
  CPT.textContent = '';
})();
