
(function () {
  var LANGUE_PIVOT = 'en';
  var m = document.cookie.match(/(?:^|;\s*)vp_langue=([a-z]{2})/);
  var lang = m && m[1];
  if (!lang || lang === LANGUE_PIVOT) return;

  // ⛔⛔ ON N'ÉCHANGE QUE SUR UNE PAGE SERVIE DANS LA LANGUE PIVOT.
  // ⚠️ CE N'EST PAS UNE PRÉCAUTION THÉORIQUE : le réseau fait DEUX sites, et
  // vevewiki, lui, génère vraiment `/fr/`, `/es/`, `/de/`, `/it/`. Sans cette
  // ligne, quelqu'un qui lit `/fr/glossary/` avec un cookie `es` verrait sa
  // page française réécrite en espagnol par-dessus — un site qui se traduit
  // deux fois, dans le mauvais sens.
  // ⭐ Elle protège aussi les pages membre de veveprice : elles sont rendues à
  // la demande, DÉJÀ dans la bonne langue et sans aucun marquage. Le garde est
  // redondant là-bas, et c'est très bien : *un garde-fou qui ne sert que dans
  // le cas qu'on n'avait pas prévu est exactement celui qui manque le jour J.*
  if ((document.documentElement.getAttribute('lang') || '') !== LANGUE_PIVOT) return;

  var CLE = 'vp-i18n-' + lang;

  // ═══════════════════════════════════════════════════════════════════════
  // ⭐⭐ REMPLIR UN GABARIT TRADUIT — la moitié cliente des libellés à variables
  // ═══════════════════════════════════════════════════════════════════════
  // `marquer_i18n.mjs` a extrait les valeurs au build et les a posées dans
  // `data-i18n-v` (voir sa section « LES LIBELLÉS À VARIABLES »). Ici on les
  // réinjecte dans le gabarit de la langue choisie.
  // ⛔ ON REND `null` DÈS QU'UN JETON N'A PAS SA VALEUR. Poser un texte où il
  //   reste un `{n}` ou un `%s` visible serait pire que l'anglais : le lecteur
  //   verrait la mécanique. *Un texte anglais juste vaut mieux qu'un texte
  //   français faux* — c'est la même règle qu'au marquage.
  function remplir(gabarit, vals) {
    var manque = false;
    var pos = 0;
    var out = String(gabarit).replace(/\{(\w+)\}|%s/g, function (tout, nom) {
      var cle = nom !== undefined ? nom : String(pos++);
      var v = vals[cle];
      if (v === undefined || v === null) { manque = true; return tout; }
      return nombreLocal(String(v));
    });
    return manque ? null : out;
  }

  // ⚠️ ET LES NOMBRES CHANGENT DE SÉPARATEUR D'UNE LANGUE À L'AUTRE. Le texte
  //   anglais porte « 2,758 » ; un lecteur français lit « 2 758 ». Traduire la
  //   phrase en laissant le nombre à l'anglaise donnerait un français qui sonne
  //   faux au milieu d'une phrase correcte.
  // ⛔⛔ MAIS ON N'Y TOUCHE QUE SUR UNE FORME CERTAINE : au moins un groupe
  //   « ,ddd ». Sans cette exigence, « 2026 » (une année) deviendrait « 2 026 »
  //   et une référence comme « 176 » serait reformatée pour rien. La borne
  //   basse protège plus que la haute ici : dans le doute, on ne touche pas.
  function nombreLocal(x) {
    if (!/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(x)) return x;
    var n = Number(x.replace(/,/g, ''));
    if (!isFinite(n)) return x;
    try { return n.toLocaleString(lang); } catch (e) { return x; }
  }

  function echanger(d) {
    if (!d) return;
    var n = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < n.length; i++) {
      var e = n[i];
      if (e.hasAttribute('data-i18n-var')) {
        // ⭐ Un libellé à variables SANS `data-i18n-v` reste anglais, et c'est
        //   volontaire : le marquage a refusé de le découper (jetons collés,
        //   littéral vide) plutôt que de deviner. On ne redevine pas ici.
        var brut = e.getAttribute('data-i18n-v');
        if (!brut) continue;
        var vals;
        try { vals = JSON.parse(brut); } catch (x) { continue; }
        var g = d[e.getAttribute('data-i18n')];
        if (g === undefined) continue;
        var rempli = remplir(g, vals);
        if (rempli !== null) e.textContent = rempli;
        continue;
      }
      var v = d[e.getAttribute('data-i18n')];
      // ⚠️ `!== undefined` et pas un test de vérité : une traduction
      // légitimement vide effacerait le texte anglais si on la refusait ici,
      // et une chaîne vide est falsy. Le cas est rare — il est arrivé.
      // ⛔ UN GABARIT NE S'ÉCHANGE PAS TEL QUEL. `movers.capped` vaut
      // « Showing the top %s… » : le gabarit anglais a DÉJÀ été rempli au
      // build (`.replace('%s', …)`), la traduction ne l'est pas. L'écrire
      // afficherait « %s » à l'écran — un texte français FAUX vaut moins
      // qu'un texte anglais juste.
      // ⚠️ `\u007B` ET PAS UNE ACCOLADE LITTÉRALE. `test:gabarits` compte les
      // accolades du corps pour repérer un gabarit mal fermé ; une accolade
      // seule dans une chaîne JavaScript le fait rougir — 304 ouvertes, 303
      // fermées. ⛔ On corrige LE CODE, pas le banc : il a raison de ne pas
      // savoir lire le JavaScript, c'est un compteur, et un compteur qu'on
      // apprend à taire ne compte plus rien.
      if (v !== undefined && !/%s|\u007B/.test(v)) e.textContent = v;
    }
    // ── LES ATTRIBUTS. 3 924 libellés sur 10 919 vivent dans un `title=`,
    // un `aria-label=` ou un `alt=` — 36 % du total, mesuré. Les laisser en
    // anglais aurait donné une page française dont chaque infobulle parle
    // anglais, **y compris pour un lecteur d'écran**.
    // ⛔ `marquer_i18n.mjs` n'y note que les libellés qui occupent TOUTE la
    // valeur : un attribut mixte reste anglais plutôt que d'être écrasé.
    var a = document.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < a.length; j++) {
      var paires = a[j].getAttribute('data-i18n-attr').split(' ');
      for (var p = 0; p < paires.length; p++) {
        var c = paires[p].indexOf(':');
        if (c < 1) continue;
        var w = d[paires[p].slice(c + 1)];
        if (w !== undefined) a[j].setAttribute(paires[p].slice(0, c), w);
      }
    }
    // ⭐ On corrige aussi l'attribut `lang` du document. Sans lui, un lecteur
    // d'écran lit du français avec une voix anglaise — l'interface serait
    // traduite pour l'œil et pas pour l'oreille.
    document.documentElement.setAttribute('lang', lang);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // 🔴🔴🔴⭐⭐⭐ AFFICHER DEPUIS LE CACHE, PUIS REVALIDER — TOUJOURS.
  // ═════════════════════════════════════════════════════════════════════════
  //
  // ⛔⛔ CE QUI ÉTAIT ÉCRIT ICI JUSQU'AU 25/08/2026, ET POURQUOI C'ÉTAIT GRAVE :
  //
  //     if (cache) { echanger(cache); return; }   // ⛔ ON NE REVENAIT JAMAIS
  //
  // Le dictionnaire était rangé UNE FOIS chez le visiteur, puis relu
  // indéfiniment. Aucune version, aucune date, aucune revalidation. ⇒ Toute
  // clé ajoutée après la première visite d'un lecteur restait ANGLAISE chez
  // lui, **pour toujours**. Et le défaut s'aggravait à chaque lot : le
  // dictionnaire grossit, les caches des fidèles ne bougent plus.
  //
  // 🔬 MESURÉ LE 25/08 SUR UNE CAPTURE DE PREDA (`/collectibles/`, cookie fr) :
  //   une même rangée de boutons portait « Tout » et « pas encore de fiche » en
  //   français, « With a page » et « Filters » en anglais. Les trois maillons
  //   du site étaient pourtant sains — dépôt, `/i18n/fr.json` servi (231 clés,
  //   les quatre présentes), gabarit. Le coupable était le `localStorage` du
  //   navigateur, et lui seul.
  //
  // ⭐⭐⭐ CE DÉFAUT EST INVISIBLE PARTOUT OÙ ON REGARDE D'HABITUDE : la CI,
  //   `curl`, un navigateur neuf et une fenêtre privée partent tous d'un cache
  //   VIDE — donc tous voient la traduction correcte. Seul un navigateur qui a
  //   DÉJÀ visité le site est touché, c'est-à-dire exactement le lecteur
  //   fidèle. *Un instrument qui ne garde pas d'état ne peut pas voir un défaut
  //   d'état.*
  //
  // ⭐ LE COÛT DE LA REVALIDATION EST QUASI NUL, ET C'EST MESURÉ, PAS SUPPOSÉ :
  //   `/i18n/fr.json` est servi en `cache-control: public, max-age=0,
  //   must-revalidate` AVEC un `etag` (relevé le 25/08, `cf-cache-status: HIT`).
  //   Le navigateur envoie donc une requête CONDITIONNELLE et reçoit un 304 —
  //   quelques centaines d'octets, pas les 4 127 o du corps gzip.
  //   ⛔ Si un jour ces en-têtes passaient à `immutable` ou à un `max-age` long,
  //   cette revalidation redeviendrait muette et le défaut reviendrait EN
  //   SILENCE. C'est `test:cache` qui borne ce risque, pas ce fichier.
  //
  // ⚠️ ON COMPARE LE TEXTE BRUT, PAS L'OBJET. Re-sérialiser pour comparer
  //   dépendrait de l'ordre des clés et déclencherait un échange inutile à
  //   chaque page. Le texte est ce qu'on a rangé, c'est donc ce qu'on compare.
  var cache = null;
  try { cache = localStorage.getItem(CLE); } catch (e) { cache = null; }
  if (cache) {
    // ⛔ UN CACHE ILLISIBLE SE JETTE, IL NE FAIT PAS TOMBER LA PAGE. Un
    //   `localStorage` tronqué (quota atteint en cours d'écriture) rendrait
    //   `JSON.parse` throw, et le `fetch` plus bas ne partirait jamais.
    try { echanger(JSON.parse(cache)); } catch (e) { cache = null; }
  }

  fetch('/i18n/' + lang + '.json', { credentials: 'omit' })
    .then(function (r) { return r.ok ? r.text() : null; })
    .then(function (txt) {
      if (!txt || txt === cache) return; // rien n'a bougé : aucun travail DOM
      var d;
      // ⛔ UN DICTIONNAIRE ILLISIBLE NE DOIT PAS ÉCRASER CELUI QUI MARCHE.
      try { d = JSON.parse(txt); } catch (e) { return; }
      // ⛔ ON ÉCHANGE AVANT DE RANGER. Si `localStorage` est plein ou refusé
      // (navigation privée), la page doit quand même être traduite : ranger
      // d'abord ferait dépendre l'affichage d'un stockage qui n'est pas
      // garanti. C'est le même principe que « prouver l'écriture ne prouve
      // pas la lecture », pris dans l'autre sens.
      echanger(d);
      try { localStorage.setItem(CLE, txt); } catch (e) { /* tant pis */ }
    })
    .catch(function () { /* le cache a déjà servi ; sinon la page reste en anglais */ });
})();
