// ⚠️ VeVePreda/veve-sites — src/socle/modules/series.js   (FICHIER NEUF — lot 139)
// ═══════════════════════════════════════════════════════════════════════════
//  LE PILOTE DE `/sets/` — FILTRER, TRIER, COMPTER, ET **TRANCHER**
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 POURQUOI IL A DÉMÉNAGÉ, ET CE N'EST PAS UNE OPTIMISATION.
// Il vivait `<script is:inline>` dans `Collections.astro`, et il ne marchait
// pas. Mesuré sur le HTML de production du 11/08 :
//
//     #s-grille          écrit à l'octet  104 306
//     le <script>        écrit à l'octet  887 140   ← il cherche #s-plus
//     <button id=s-plus> écrit à l'octet  891 075   ← pas encore analysé
//
// Un `<script>` en ligne NON DIFFÉRÉ s'exécute **au moment où l'analyseur
// l'atteint**. À cet instant le bouton « voir plus » n'existe pas encore :
// `getElementById('s-plus')` rend `null`, donc `pas = 0`, donc
// `montre = pas || 1e9` vaut **un milliard**, donc **aucune carte n'est
// cachée**. La page annonçait 60 tuiles et en montrait **910**.
//
// ⭐⭐⭐ ET `test:series` ÉTAIT VERT PENDANT TROIS JOURS. Il monte le HTML
// **entier** dans un DOM **puis** exécute le pilote : il ne peut
// structurellement pas voir un défaut d'ORDRE DE PARSE. Il avait « raison »
// sur un DOM que personne ne reçoit. *Un banc peut être vert pour une mauvaise
// raison — branché sur quoi, depuis quand, et sur quel ÉTAT du DOM ?*
//
// 🩹 ⛔ NI DÉPLACER LE `<script>` APRÈS LE BOUTON, NI L'ENVELOPPER DANS
// `DOMContentLoaded` : les deux marchent, et les deux laissent **8 788 octets
// de pilote en ligne** sur une page qui en pèse déjà 899 000, retéléchargés à
// chaque visite. Le socle, lui, est servi en `<script defer src>` avec une
// empreinte dans son nom, donc mis en cache trente jours.
// ⭐ `defer` attend la fin de l'analyse **par construction** : l'ordre cesse
// d'être un pari sur la position du script dans le document.
// ⇒ Une seule correction ferme le défaut d'ordre **et** allège la page.
//
// ⛔ AUCUNE LIGNE DE CE PILOTE N'A CHANGÉ. Le déplacement doit être prouvable
// à l'identique : si le comportement bougeait en même temps que l'adresse, on
// ne saurait plus lequel des deux a réparé quoi.

// ⭐ MÊME PILOTE QUE LE MARCHÉ, EN PLUS COURT : filtrer, trier, compter,
// écrire des jetons. ⛔ Pas de mémorisation ici — une page de parcours se
// rouvre pour tout revoir, pas pour retrouver un filtre d'il y a trois
// jours. Le Marché, lui, est un poste de travail : il mémorise.
(function () {
  var f = document.getElementById('f-sets'); if (!f) return;

  // LOT 143 - LES PUCES SONT CONSTRUITES ICI, PLUS SERVIES DANS LE HTML.
  // Mesure du 12/08 sur la production : 83 licences et 469 marques pesaient
  // 84 423 o et 1 187 noeuds sur chaque visite, dans un formulaire hidden que
  // seuls les membres peuvent ouvrir. Les 3 097 pages sont pre-generees : le
  // meme HTML part vers tout le monde, donc on ne peut pas conditionner au
  // palier - on peut seulement ne pas l'ecrire.
  // La valeur est lue SUR LA CARTE et pas retrimee. C'est volontaire : garde()
  // plus bas compare exactement dataset.brand et dataset.lic. Une puce trimee
  // cesserait de correspondre a la carte le jour ou une valeur du catalogue
  // porte un espace de bord, et le filtre repondrait sans rien selectionner.
  // Les deux ordres du serveur sont reproduits, ils ne sont pas decoratifs :
  // licences par nombre de sets decroissant, marques par ordre alphabetique.
  var puceFaite = {};
  function remplirPuces(hote){
    if (!hote) return false;
    var axe = hote.getAttribute('data-puces');
    if (!axe || puceFaite[axe]) return false;
    var grille = document.getElementById('s-grille'); if (!grille) return false;
    var champ = (axe === 'lic') ? 'lic' : 'brand';
    var nom   = (axe === 'lic') ? 's-lic' : 's-brand';
    var n = {}, ordre = [];
    [].slice.call(grille.querySelectorAll('.col-carte')).forEach(function(c){
      var v = c.dataset[champ];
      if (!v) return;
      if (!(v in n)) { n[v] = 0; ordre.push(v); }
      n[v]++;
    });
    if (ordre.length < 2) return false;
    ordre.sort((axe === 'lic')
      ? function(a, b){ return (n[b] - n[a]) || a.localeCompare(b); }
      : function(a, b){ return a.localeCompare(b); });
    var frag = document.createDocumentFragment();
    ordre.forEach(function(v){
      var l = document.createElement('label');
      l.className = 'puce';
      l.setAttribute('data-b', v.toLowerCase());
      var i = document.createElement('input');
      i.type = 'checkbox'; i.name = nom; i.value = v;
      l.appendChild(i);
      l.appendChild(document.createTextNode(' ' + v + ' '));
      if (axe === 'lic') {
        var e = document.createElement('span');
        e.className = 'etiq';
        e.style.opacity = '.65';
        e.style.marginLeft = '5px';
        e.textContent = String(n[v]);
        l.appendChild(e);
      }
      frag.appendChild(l);
    });
    hote.appendChild(frag);
    puceFaite[axe] = true;
    return true;
  }
  // 🔴 LOT 115b — LA RECHERCHE DANS UNE LISTE DE PUCES.
  //  🆕 LOT 170 — ELLE SERT MAINTENANT DEUX PANNEAUX : marque ET licence.
  //
  // ⭐ Elle ne touche ni aux cases cochées ni à la grille : elle masque des
  //   étiquettes, rien de plus. `hidden` et pas une classe — une étiquette
  //   masquée doit sortir de l'ordre de tabulation, sinon on tabule dans
  //   quarante cases invisibles.
  //
  // 🔴 CE QUE LE LOT 170 RETIRE, ET POURQUOI ON L'ÉCRIT PLUTÔT QUE DE
  //   L'EFFACER. Le lot 133 posait ici, en toutes lettres, une décision
  //   contraire : « LE PANNEAU LICENCE N'A PAS DE CHAMP DE RECHERCHE, ET C'EST
  //   UNE DÉCISION MESURÉE : 96 licences tiennent à l'écran, 1 492 marques
  //   non. » ⭐ Sa prémisse a été REMESURÉE le 21/08 sur
  //   `/rayon-index/sets.json` en production : **93 licences, 1 130 marques**.
  //   Le chiffre tenait encore — ce n'est donc pas lui qui a périmé l'argument.
  //   Ce qui l'a périmé, c'est le point `e` de la liste de Preda, écrit APRÈS,
  //   et un détail que le lot 133 n'avait pas pesé : les puces licence sont
  //   triées par NOMBRE DE SETS décroissant, pas alphabétiquement. Une liste
  //   de 93 noms qu'on ne peut pas parcourir dans l'ordre ne « tient » pas à
  //   l'œil, même si elle tient à l'écran.
  //   ⇒ *Un argument de conception juste ne survit pas à l'usage qu'il n'avait
  //   pas prévu, et « mesuré » ne veut pas dire « définitif ».*
  //
  // ⭐⭐ COÛT : ZÉRO NŒUD DE PLUS. `remplirPuces()` pose déjà `data-b` sur les
  //   puces des DEUX axes, en casse basse. Le pilote est donc le même, appelé
  //   une seconde fois — pas un second pilote à maintenir.
  function chercheDansPuces(idChamp, idHote, idVide) {
    var q = document.getElementById(idChamp);
    var hote = document.getElementById(idHote);
    var vide = document.getElementById(idVide);
    if (!q || !hote) return;
    // LOT 143 - la liste se relit, elle ne se capture plus au chargement :
    // les etiquettes n'existent qu'apres la premiere ouverture du panneau.
    var etiquettes = [];
    q.addEventListener('input', function () {
      if (!etiquettes.length) etiquettes = [].slice.call(hote.querySelectorAll('[data-b]'));
      var t = q.value.trim().toLowerCase();
      var n = 0;
      etiquettes.forEach(function (el) {
        var on = !t || el.getAttribute('data-b').indexOf(t) !== -1;
        el.hidden = !on;
        if (on) n++;
      });
      if (vide) vide.hidden = n > 0;
    });
  }
  chercheDansPuces('s-bq', 's-brands', 's-bq-vide');
  chercheDansPuces('s-lq', 's-lics', 's-lq-vide');

var G = document.getElementById('s-grille');
  var C = [].slice.call(G.querySelectorAll('.col-carte'));
  var cpt = document.getElementById('s-cpt'), vide = document.getElementById('s-vide');
  var corpus = '';

  // ═══════════════════════════════════════════════════════════════════════
  //  🔴🔴🔴 LOT 155-B — LE RESTE DE LA GRILLE ARRIVE DE L'INDEX
  // ═══════════════════════════════════════════════════════════════════════
  //
  // CE QUE ÇA CORRIGE, MESURÉ EN PRODUCTION LE 17/08 AVEC `?cb=` :
  //   `/sets/`  3 391 892 o bruts — **454 436 o GZIP**, servis à CHAQUE visiteur
  //   `/comics/`   61 865 o bruts —  **10 859 o gzip**
  // 3 369 815 des 3 391 892 octets étaient la grille : 3 113 cartes et 6 090
  // `<img>`, dont le navigateur n'en montrait que 60. ⭐ *La page payait 3 053
  // cartes pour que le filtre soit exact* — c'est la règle du lot 113, et elle
  // était juste. Ce qui a changé, c'est qu'un index porte maintenant le rayon.
  //
  // ⭐⭐⭐ ET LE PILOTE N'A PAS CHANGÉ DE RÈGLES : il bâtit les cartes
  // MANQUANTES, avec les mêmes `data-*`, puis `garde()`, `ORDRE` et
  // `remplirPuces()` continuent de travailler sur des `.col-carte` — inchangés,
  // au caractère près. ⛔ Réécrire le filtrage autour des lignes de l'index
  // aurait refait le filtre une seconde fois, dans un second langage, pour un
  // gain nul : c'est la faute que ce dépôt a payée aux lots 127, 131 et 132.
  //
  // 🔴🔴 CE QUI SERAIT ARRIVÉ SANS ÇA, ET IL FAUT L'ÉCRIRE : `remplirPuces()`
  // compte les marques et les licences SUR LES CARTES DU DOM. Avec 60 cartes,
  // il aurait offert les marques de 60 sets sur 3 113 — un filtre qui RÉPOND, et
  // dont la réponse est fausse. *C'est exactement ce que le lot 113 refusait, et
  // ça revenait par la porte de derrière.*
  //
  // ⚠️ CE QUE ÇA COÛTE, ET À QUI — mesuré, pas estimé :
  //   · qui ne fait rien : **454 436 → ~13 000 o gzip**. C'est tout le monde.
  //   · qui ouvre les filtres OU clique « voir plus » : l'index, **359 439 o
  //     gzip** (68 106 avant ce lot : les couvertures pèsent +291 333).
  //   ⛔ Donc un anonyme qui clique « voir plus » paie l'index alors qu'il ne
  //   filtrera jamais. Assumé : il payait 454 Ko à l'arrivée, sans rien demander.
  var idx = null, enCours = null;
  var TOTAL = bPlusTotal();
  function bPlusTotal() {
    var b = document.getElementById('s-plus');
    var n = b && parseInt(b.getAttribute('data-total'), 10);
    return n || 0;
  }

  // ⭐ LES DEUX MORCEAUX QUI VIENNENT DU SERVEUR, JAMAIS RÉÉCRITS ICI.
  // `innerHTML` d'un `<template>` : le contenu n'est pas peint, et c'est
  // toujours le glyphe et le libellé traduits DU SERVEUR — une seule source.
  var TPL_HEXA = document.getElementById('s-hexa');
  var TPL_LOT = document.getElementById('s-lot');

  /** Bâtit une carte à l'identique de `CarteSet.astro`.
   *  🔴🔴 CHAQUE CHAMP VIENT DE L'INDEX, AUCUN N'EST REDÉRIVÉ — et c'est
   *  `regle-seconde-fabrique-ne-montre-que-sa-source`, vue AVANT d'écrire :
   *    · `nv` (le nom COUPÉ) est déposé par le serveur parce que `nomSet()`
   *      coupe aux MOTS après `nu()` — « Once Upon a Mouse…in the Future #1 »
   *      devient « Once Upon a Mouse…in the… », qui n'est PAS un préfixe.
   *      Réécrire `couperMots` ici serait la règle de ce matin, celle qui a
   *      cassé 978 pages : la même logique dans deux langages.
   *    · `c` (les vignettes) est CHOISI par `pileSet()` au build — « les
   *      premières qui ont une image, puis compléter » — et pas ici.
   *  ⛔ `0` dans `c` donne l'hexagone gris, JAMAIS un `src` vide : `src=""`
   *  recharge la PAGE COURANTE (lot 131). */
  function batir(ix, l) {
    var nom = ix.val(l, 'n') || '';
    var vu = ix.val(l, 'nv');
    var marque = ix.mot(l, 'b');
    var taille = ix.val(l, 't') || 0;

    var a = document.createElement('a');
    a.className = 'col-carte revele';
    a.href = ix.charge.prefixe + ix.val(l, 'p');
    // ⚠️ LES MÊMES `data-*`, AVEC LES MÊMES VALEURS NON RETRIMÉES que le
    // serveur : `garde()` compare `dataset.brand` à la valeur de la puce, et
    // une valeur trimée d'un seul côté cesserait de correspondre — le filtre
    // répondrait sans rien sélectionner.
    a.setAttribute('data-n', nom.toLowerCase());
    a.setAttribute('data-brand', marque);
    a.setAttribute('data-lic', ix.mot(l, 'l'));
    a.setAttribute('data-an', ix.val(l, 'a') ? String(ix.val(l, 'a')) : '');
    a.setAttribute('data-ty', ix.mot(l, 'ty'));
    a.setAttribute('data-taille', String(taille));

    var pile = document.createElement('span');
    pile.className = 'col-carte__pile';
    pile.setAttribute('aria-hidden', 'true');
    (ix.val(l, 'c') || []).forEach(function (u) {
      var socle = document.createElement('span');
      socle.className = 'socle';
      if (u) {
        var img = document.createElement('img');
        img.className = 'socle__net ok';
        // ⭐ LE PRÉFIXE EST RECOLLÉ, PAS DEVINÉ : le producteur ne factorise que
        // les adresses qui le portent, et stocke les autres ENTIÈRES.
        img.src = (String(u).indexOf('http') === 0 ? '' : (ix.charge.cdn || '')) + u;
        img.alt = ''; img.width = 400; img.height = 600;
        img.loading = 'lazy'; img.decoding = 'async';
        socle.appendChild(img);
      } else if (TPL_HEXA) {
        socle.innerHTML = TPL_HEXA.innerHTML;
      }
      pile.appendChild(socle);
    });
    a.appendChild(pile);

    var cart = document.createElement('span');
    cart.className = 'cartouche';
    var n1 = document.createElement('span');
    n1.className = 'cartouche__n';
    // ⭐ Le `title` porte le nom ENTIER, et seulement s'il a été coupé — un nom
    // tronqué sans moyen de lire l'entier est une perte d'information.
    if (vu) n1.title = nom;
    n1.textContent = vu || nom;
    cart.appendChild(n1);
    if (marque) {
      var m = document.createElement('span');
      m.className = 'etiq';
      m.textContent = marque;
      cart.appendChild(m);
    }
    if (TPL_LOT) {
      var lot = document.createElement('span');
      lot.innerHTML = TPL_LOT.innerHTML;
      var el = lot.firstElementChild;
      if (el) {
        var b = el.querySelector('b');
        if (b) b.textContent = String(taille);
        cart.appendChild(el);
      }
    }
    a.appendChild(cart);
    return a;
  }

  /** Charge l'index et complète la grille. Rend `true` si elle est complète.
   *  ⛔ SI LE `fetch` ÉCHOUE, ON NE TOUCHE À RIEN : les 60 cartes du serveur
   *  restent, exactes. Le compteur porte l'échec — le silence serait pire. */
  function completer() {
    if (idx) return Promise.resolve(true);
    if (enCours) return enCours;
    if (!TOTAL || C.length >= TOTAL) return Promise.resolve(true);
    enCours = window.vpIndexRayon('/rayon-index/sets.json').then(function (ix) {
      if (!ix) { enCours = null; return false; }
      idx = ix;
      // ⭐⭐ ON NE REBÂTIT PAS LES 60 DÉJÀ SERVIES. Deux raisons, et la seconde
      // est la bonne : on ne repeint pas ce qui est correct, et surtout **une
      // divergence entre les deux fabriques reste VISIBLE** — les 60 du serveur
      // et les suivantes sont côte à côte dans la même grille. Tout repeindre
      // masquerait l'écart au lieu de le révéler. C'est ce que `test:series`
      // mesure, et c'est pour ça qu'il peut le mesurer.
      var frag = document.createDocumentFragment();
      for (var i = C.length; i < ix.charge.lignes.length; i++) {
        var el = batir(ix, ix.charge.lignes[i]);
        frag.appendChild(el);
        C.push(el);
      }
      G.appendChild(frag);
      return true;
    });
    return enCours;
  }
  function num(v){ var n = parseInt(v, 10); return isNaN(n) ? null : n; }
  function val(id){ var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function coches(nom){
    return [].slice.call(f.querySelectorAll('input[name="' + nom + '"]:checked')).map(function(x){ return x.value; });
  }
  function etat(){
    return { q:(val('s-q')||'').toLowerCase(), corpus:corpus, tri:val('s-tri')||'taille',
             brands:coches('s-brand'), lics:coches('s-lic'),
             a1:num(val('s-a1')), a2:num(val('s-a2')),
             tmin:num(val('s-tmin')), tmax:num(val('s-tmax')) };
  }
  // ⚠️ Un set SANS année connue traverse les bornes d'année : l'absence
  // n'est pas une date ancienne. Même règle que le Marché.
  function garde(e, x){
    var d = x.dataset;
    if (e.q && d.n.indexOf(e.q) === -1) return false;
    if (e.corpus && d.ty !== e.corpus) return false;
    if (e.brands.length && e.brands.indexOf(d.brand) === -1) return false;
    // 🆕 LOT 133 — la licence. ⚠️ `d.lic` est ce que `CarteSet.astro` a
    //    ÉMIS ; il n'est pas recalculé ici. Un filtre qui redérive son axe
    //    depuis le nom du set aurait divergé de la carte au premier set dont
    //    la licence majoritaire n'est pas celle de sa première pièce.
    if (e.lics.length && e.lics.indexOf(d.lic) === -1) return false;
    if (d.an) {
      if (e.a1 !== null && parseInt(d.an, 10) < e.a1) return false;
      if (e.a2 !== null && parseInt(d.an, 10) > e.a2) return false;
    }
    var tl = parseInt(d.taille, 10);
    if (e.tmin !== null && tl < e.tmin) return false;
    if (e.tmax !== null && tl > e.tmax) return false;
    return true;
  }
  var ORDRE = {
    taille: function(a,b){ return parseInt(b.dataset.taille,10) - parseInt(a.dataset.taille,10); },
    annee:  function(a,b){ return (b.dataset.an || '').localeCompare(a.dataset.an || ''); },
    nom:    function(a,b){ return a.dataset.n.localeCompare(b.dataset.n); },
    // 🆕 LOT 133 — TRI PAR LICENCE, et il a un SECOND critère.
    // ⛔ Trier sur la seule licence laisserait les 2 986 sets Marvel dans
    //    l'ordre où le DOM les a rendus, c'est-à-dire dans l'ordre du tri
    //    PRÉCÉDENT : la page changerait d'aspect selon d'où l'on vient, sans
    //    que rien ne l'explique. Un tri instable se lit comme un bug.
    // ⭐ À licence égale, on retombe donc sur la taille décroissante — le tri
    //    par défaut de cette page, donc celui qu'on connaît déjà.
    licence: function(a,b){
      var d = (a.dataset.lic || '').localeCompare(b.dataset.lic || '');
      return d !== 0 ? d : (parseInt(b.dataset.taille,10) - parseInt(a.dataset.taille,10));
    }
  };
  var bPlus = document.getElementById('s-plus');
  var cPlus = document.getElementById('s-plus-cpt');
  var pas = bPlus ? parseInt(bPlus.dataset.pas, 10) : 0;
  var montre = pas || 1e9;
  function appliquer(){
    var e = etat(), vis = [];
    C.forEach(function(x){ var ok = garde(e, x); x.hidden = !ok; if (ok) vis.push(x); });
    vis.sort(ORDRE[e.tri] || ORDRE.taille);
    vis.forEach(function(x){ G.appendChild(x); });
    // ⭐ La tranche s'applique APRÈS le filtre et le tri : « voir plus » ne
    // doit jamais révéler une carte que le filtre a écartée.
    if (bPlus) {
      for (var k = 0; k < vis.length; k++) vis[k].hidden = k >= montre;
      // 🔴 LOT 155-B — TANT QUE L'INDEX N'EST PAS LÀ, LE BOUTON RESTE.
      // Sans ce `|| !idx`, la grille servie (60 cartes, tranche de 60) cacherait
      // « voir plus » AVANT d'avoir chargé quoi que ce soit : 3 053 sets
      // deviendraient inatteignables, et la page aurait l'air complète.
      // ⭐⭐ C'est le défaut le plus dangereux de ce lot, parce qu'il ne
      // ressemble pas à une panne — il ressemble à un catalogue plus petit.
      bPlus.hidden = !(!idx || vis.length > montre);
      cPlus.textContent = Math.min(montre, vis.length) + ' / ' + (idx ? vis.length : TOTAL);
    }
    // ⚠️ LE DÉNOMINATEUR EST LE CORPUS, PAS CE QUI EST DANS LE DOM. Avant
    // chargement, `C.length` vaut 60 : le compteur aurait annoncé « 60 / 60 »
    // sur un rayon de 3 113 sets.
    cpt.textContent = vis.length + ' / ' + (idx ? C.length : (TOTAL || C.length));
    vide.hidden = vis.length !== 0;
    var j = document.getElementById('s-actifs'); j.innerHTML = '';
    function jeton(txt, retirer){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'jeton';
      b.innerHTML = txt + ' <span aria-hidden="true">×</span>';
      b.setAttribute('aria-label', b.textContent);
      b.onclick = function(){ retirer(); appliquer(); };
      j.appendChild(b);
    }
    e.brands.forEach(function(v){ jeton(v, function(){ var c = f.querySelector('input[name=s-brand][value="' + v + '"]'); if (c) c.checked = false; }); });
    e.lics.forEach(function(v){ jeton(v, function(){ var c = f.querySelector('input[name=s-lic][value="' + v + '"]'); if (c) c.checked = false; }); });
    [['s-a1', e.a1], ['s-a2', e.a2], ['s-tmin', e.tmin], ['s-tmax', e.tmax]].forEach(function(pr){
      if (pr[1] === null) return;
      var ch = document.getElementById(pr[0]);
      var et = ch && ch.parentNode.querySelector('.etiq');
      jeton((et ? et.textContent + ' ' : '') + pr[1], function(){ ch.value = ''; });
    });
    var par = { licence: e.lics.length, marque: e.brands.length,
                annee: (e.a1 !== null) + (e.a2 !== null),
                taille: (e.tmin !== null) + (e.tmax !== null) };
    [].slice.call(f.querySelectorAll('.f-b[data-g]')).forEach(function(b){
      var c = b.querySelector('.cpt-f'); if (!c) return;
      var v = par[b.dataset.g] || 0; c.textContent = v; c.hidden = !v;
    });
  }
  // 🔴🔴 LOT 155-B — TOUT GESTE COMPLÈTE LA GRILLE AVANT D'AGIR.
  // ⛔ Un filtre appliqué sur 60 cartes RÉPONDRAIT, et sa réponse serait fausse
  // — c'est mot pour mot ce que le lot 113 refusait. `completer()` ne fait qu'un
  // seul `fetch`, quel que soit le nombre de gestes.
  function apresChargement(fn) {
    return function () {
      var args = arguments, self = this;
      completer().then(function () { fn.apply(self, args); });
    };
  }
  [].slice.call(f.querySelectorAll('[data-corpus]')).forEach(function(b){
    b.addEventListener('click', apresChargement(function(){
      corpus = b.dataset.corpus;
      [].slice.call(f.querySelectorAll('[data-corpus]')).forEach(function(o){ o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      appliquer();
    }));
  });
  var boutons = [].slice.call(f.querySelectorAll('.f-b[data-g]'));
  boutons.forEach(function(b){
    var pan = document.getElementById('sp-' + b.dataset.g); if (!pan) return;
    b.addEventListener('click', apresChargement(function(){
      // LOT 143 - on remplit avant d'afficher, jamais apres : un panneau
      // montre puis rempli fait sauter la mise en page sous le doigt.
      // 🔴 LOT 155-B — ET APRÈS `completer()`, jamais avant : `remplirPuces()`
      // compte les marques SUR LES CARTES. Sur les 60 servies, il aurait offert
      // les marques de 60 sets sur 3 113.
      remplirPuces(pan.querySelector('[data-puces]'));
      var ouvrir = pan.hidden;
      boutons.forEach(function(o){ var p2 = document.getElementById('sp-' + o.dataset.g);
        if (p2) p2.hidden = true; o.setAttribute('aria-expanded', 'false'); });
      pan.hidden = !ouvrir; b.setAttribute('aria-expanded', String(ouvrir));
    }));
  });
  if (bPlus) bPlus.addEventListener('click', apresChargement(function(){ montre += pas; appliquer(); }));
  // ⛔ Changer de filtre revient à la première tranche : sinon « 300 / 12 ».
  f.addEventListener('input',  apresChargement(function(){ montre = pas || 1e9; appliquer(); }));
  f.addEventListener('change', apresChargement(function(){ montre = pas || 1e9; appliquer(); }));
  f.addEventListener('reset',  apresChargement(function(){ setTimeout(function(){ corpus = ''; montre = pas || 1e9; appliquer(); }, 0); }));
  // ⭐⭐⭐ ON CHARGE À L'INTENTION, PAS AU CLIC — ET C'EST `test:series` QUI A
  // RENDU CE DÉFAUT VISIBLE. Le lot 143 exige de remplir un panneau AVANT de
  // l'afficher (« un panneau montré puis rempli fait sauter la mise en page
  // sous le doigt »). Mais depuis ce lot, remplir veut dire attendre le réseau :
  // le membre cliquerait « Licence » et **rien ne se passerait** le temps du
  // `fetch`. Un contrôle qui ne répond pas au doigt se lit comme une panne.
  // ⇒ Approcher la barre EST le premier geste. `pointerenter` et `focusin`
  // lancent le chargement pendant que la main arrive ; le clic, lui, retrouve
  // l'index déjà là. ⛔ Et la garde asynchrone RESTE : elle est la correction,
  // ceci n'est que le confort. *Un préchargement qui devient la seule garantie
  // est une garantie qui dépend d'une souris.*
  // ⛔ Et ça ne charge rien pour qui ne voit pas la barre : elle est `hidden`
  // et `data-membre`. Un anonyme ne la survole pas.
  f.addEventListener('pointerenter', function () { completer(); });
  f.addEventListener('focusin', function () { completer(); });
  // ⭐ LE PREMIER `appliquer()` NE CHARGE RIEN, ET C'EST TOUT L'INTÉRÊT DU LOT :
  // il peint les 60 cartes du serveur. L'index n'arrive qu'au premier geste —
  // même politique que la barre de rayon du 155-A, et que `search-index.json`.
  appliquer();
})();
