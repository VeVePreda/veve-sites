
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

  function echanger(d) {
    if (!d) return;
    var n = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < n.length; i++) {
      var e = n[i];
      if (e.hasAttribute('data-i18n-var')) continue;
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

  var cache = null;
  try { cache = JSON.parse(localStorage.getItem(CLE)); } catch (e) { cache = null; }
  if (cache) { echanger(cache); return; }

  fetch('/i18n/' + lang + '.json', { credentials: 'omit' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d) return;
      // ⛔ ON ÉCHANGE AVANT DE RANGER. Si `localStorage` est plein ou refusé
      // (navigation privée), la page doit quand même être traduite : ranger
      // d'abord ferait dépendre l'affichage d'un stockage qui n'est pas
      // garanti. C'est le même principe que « prouver l'écriture ne prouve
      // pas la lecture », pris dans l'autre sens.
      echanger(d);
      try { localStorage.setItem(CLE, JSON.stringify(d)); } catch (e) { /* tant pis */ }
    })
    .catch(function () { /* la page reste en anglais : lisible, juste, complète */ });
})();
