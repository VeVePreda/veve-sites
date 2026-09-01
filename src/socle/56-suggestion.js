// ⚠️ VeVePreda/veve-sites — src/socle/56-suggestion.js   (FICHIER NEUF — lot 212)
// ═══════════════════════════════════════════════════════════════════════════
//  LA SUGGESTION DE LANGUE — UNE INFOBULLE SOUS LE BOUTON, PLUS UN BANDEAU
// ═══════════════════════════════════════════════════════════════════════════
//
// 🖼️ DEMANDE DE PREDA (01/09) : « améliorer la suggestion de langue, avec
// plutôt une info-bulle qui apparaît sous le bouton langue si l'utilisateur est
// dans une autre langue que celui du site ».
//
// 🔬 CE QUE LA MESURE A TROUVÉ AVANT D'ÉCRIRE UNE LIGNE — et ce n'était pas
// qu'une affaire de place. Le bandeau avait DEUX défauts plus graves que sa
// forme, et aucun banc ne pouvait les voir.
//
// ① IL COMPARAIT LA LANGUE DU FICHIER, PAS CELLE QUE LA PERSONNE VOIT.
//    L'ancien code faisait `navigator.language` contre `lang`. Or veveprice est
//    pré-généré : `lang` vaut « en » sur 3 097 pages sur 3 097. Un lecteur qui
//    avait choisi le français trois semaines plus tôt se voyait donc proposer
//    « ce site est aussi disponible en Français » — sur un site déjà en
//    français. La langue vue vit dans le COOKIE, et nulle part ailleurs.
//    ⭐⭐⭐ *Un test qui n'a jamais eu de raison de rougir n'est pas prudent, il
//    est aveugle.* Celui-ci était vrai à chaque exécution.
//
// ② SA LISTE ÉTAIT VIDE SUR 168 PAGES SUR 178 (mesuré sur `dist/`).
//    Elle se dérivait des ADRESSES de la page — et veveprice n'a d'adresses
//    traduites que sur le blog. Le mécanisme était servi partout et ne pouvait
//    s'exécuter nulle part ailleurs. On lit maintenant DEUX sources :
//      · `data-ui`  — les langues d'INTERFACE, jamais vides : de quoi proposer
//                     sur tout le site ;
//      · `data-adr` — les ADRESSES, quand la page en a : de quoi emmener le
//                     lecteur sur l'ARTICLE traduit et pas sur des menus.
//    *Deux questions, deux sources.* Les confondre, c'est ce qui a produit un
//    composant mort — la même faute que le compteur « Tout » du même lot.
//
// ③ ET SA PLACE COÛTAIT 72 px DU PREMIER ÉCRAN MOBILE (44 px + 2 × 14 de
//    marge), en tête de `<main>`, au-dessus du fil d'ariane — sur le même
//    premier écran que ce lot dégage par ailleurs. Une infobulle ancrée sous le
//    bouton dit la même chose sans déplacer une ligne, et le dit là où la main
//    va cliquer.
//
// ⛔⛔ LE BANDEAU N'EST PAS SUPPRIMÉ, IL DEVIENT LE REPLI. Le socle sert les
// 15 sites du réseau, et `themes/encyclopedie/theme.css` habille `#langsuggest`
// en propre (l. 242 et l. 583, la seconde pour l'impression). Un site sans
// `#langue-ui` — vevewiki en est un, il n'a pas `langues_dans: compte` — n'a
// aucun bouton sous lequel s'ancrer. *Un composant du socle ne se remplace pas,
// il se double.*
//
// ⚠️ CE FICHIER DOIT ÊTRE DÉCLARÉ DANS `ORDRE`, dans `engine/lib/socle_js.mjs`.
// Le §4 de ce fichier LÈVE si le dossier et la liste divergent — c'est voulu,
// et c'est ce qui empêche un module d'être déposé sans jamais s'exécuter.

(function () {
  var boite = document.getElementById('langsuggest');
  // ⭐ LE GARDE. Le socle part sur toutes les pages des 15 sites ; ce conteneur
  // vient de `Base.astro` et existe partout, mais un site futur pourrait ne pas
  // l'émettre. Sans lui, il n'y a rien à câbler et on sort.
  if (!boite) return;

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // ⭐ ON NE PROPOSE RIEN À QUI A DÉJÀ RÉPONDU — dans un sens ou dans l'autre.
    // ═══════════════════════════════════════════════════════════════════════
    // `langChoice` : la personne a suivi la suggestion. `langDismiss` : elle
    // l'a refusée. Les deux clés sont celles de l'ancien code, à l'identique —
    // ⛔ les renommer aurait REPROPOSÉ la bulle à tous ceux qui l'avaient déjà
    // écartée, une fois, le jour du déploiement. Un état conservé chez le
    // visiteur ne se renomme pas sans le lui redemander.
    if (localStorage.getItem('langChoice') || localStorage.getItem('langDismiss')) return;

    var nav = (navigator.language || '').slice(0, 2).toLowerCase();
    if (!/^[a-z]{2}$/.test(nav)) return;

    // ⭐⭐ LA LANGUE VUE = LE COOKIE. Absent ⇒ « en » — exactement la convention
    // de `55-langue.js`, qui EFFACE le cookie pour revenir au pivot plutôt que
    // d'y écrire « en ». Deux lectures d'un même réglage doivent retomber sur
    // la même valeur, sinon l'une des deux ment un jour sur deux.
    var mc = document.cookie.match(/(?:^|;\s*)vp_langue=([a-z]{2})/);
    var vue = (mc && mc[1]) || 'en';
    if (nav === vue) return;

    function lire(attr) {
      // ⛔ Un JSON illisible ne doit pas emporter le reste du socle. Le `try`
      // englobant suffirait, mais il ferait aussi taire les deux autres blocs :
      // une donnée abîmée doit coûter la suggestion, pas la page.
      try { return JSON.parse(boite.getAttribute(attr) || '[]'); } catch (e) { return []; }
    }
    var ui = lire('data-ui').filter(function (s) { return s.l === nav; })[0];
    // ⭐ ON NE PROPOSE PAS UNE LANGUE QU'ON NE PARLE PAS. Un lecteur japonais
    // n'a rien à faire d'une bulle ; sans ce filtre elle s'ouvrirait vide.
    if (!ui) return;
    var adr = lire('data-adr').filter(function (s) { return s.l === nav; })[0];

    var txt = boite.getAttribute('data-txt') || '';
    var non = boite.getAttribute('data-non') || '';

    // ═══════════════════════════════════════════════════════════════════════
    // ALLER — poser le cookie, PUIS partir.
    // ═══════════════════════════════════════════════════════════════════════
    // ⭐⭐ LE COOKIE D'ABORD DANS LES DEUX CAS. Naviguer sans lui ferait arriver
    // sur l'article français dans une interface anglaise, le temps que
    // `50-i18n.js` s'exécute — un clignotement sur la seule page où l'on vient
    // précisément de demander le français.
    // ⛔ ET C'EST LA MÊME ÉCRITURE QUE `55-langue.js` : `path=/`, un an,
    // `SameSite=Lax`, pas de `Secure` (refusé en HTTP local, donc mort dans la
    // seule configuration où on peut regarder le sélecteur à l'œil).
    function aller() {
      localStorage.setItem('langChoice', nav);
      if (nav === 'en') document.cookie = 'vp_langue=; path=/; max-age=0; samesite=lax';
      else document.cookie = 'vp_langue=' + nav + '; path=/; max-age=31536000; samesite=lax';
      // ⛔ `assign` et non `replace` : le bouton « précédent » doit ramener à
      // l'article d'où l'on vient. `replace` effacerait l'étape.
      if (adr) window.location.assign(adr.h); else window.location.reload();
    }

    function bouton(libelle, principal, action) {
      var b = document.createElement('button');
      b.type = 'button';
      // ⛔ `textContent`, jamais `innerHTML`. L'ancien bandeau concaténait le
      // nom de langue dans une chaîne de balisage ; on ne recopie pas une
      // faiblesse en déménageant, même quand la donnée est de chez nous.
      b.textContent = libelle;
      if (!principal) b.setAttribute('data-non', '');
      b.addEventListener('click', action);
      return b;
    }

    var hote = document.querySelector('#langue-ui .globe__m');

    if (hote) {
      // ── LA FORME DEMANDÉE : une infobulle dans le menu du bouton ──────────
      // ⚠️ ELLE VIT DANS `.globe__m`, LE MENU DÉJÀ POSITIONNÉ (`position:absolute`,
      // `top:calc(100% + 6px)`, `right:0`). Écrire un placement à côté aurait
      // donné une SECONDE définition de la position de ce panneau, à tenir
      // d'accord avec la première à chaque retouche de l'en-tête. Le menu sait
      // déjà où il est ; on lui ajoute une section, on ne le double pas.
      var bulle = document.createElement('div');
      bulle.className = 'globe__sugg';
      var p = document.createElement('p');
      p.textContent = txt + ' ' + ui.n;
      bulle.appendChild(p);
      var acts = document.createElement('span');
      acts.appendChild(bouton(ui.n, true, aller));
      acts.appendChild(bouton(non, false, function () {
        localStorage.setItem('langDismiss', '1');
        bulle.remove();
      }));
      bulle.appendChild(acts);
      hote.appendChild(bulle);
      // ⭐⭐⭐ ET ON OUVRE LE MENU. Une infobulle repliée dans un `<details>`
      // fermé est une infobulle que PERSONNE NE VOIT : le code s'exécute, le
      // nœud existe, le banc le trouve — et l'écran ne montre rien. C'est un
      // banc muet, mais en CSS, et c'est la forme la plus difficile à
      // diagnostiquer. Une ligne suffit à ne pas s'y mettre.
      var det = document.getElementById('langue-ui');
      if (det) det.open = true;
    } else {
      // ── LE REPLI : le bandeau d'origine, pour un site sans `#langue-ui` ────
      var t = document.createElement('span');
      t.textContent = txt + ' ' + ui.n + ' — ';
      boite.appendChild(t);
      boite.appendChild(bouton(ui.n, true, aller));
      boite.appendChild(bouton(non, false, function () {
        localStorage.setItem('langDismiss', '1');
        boite.style.display = 'none';
      }));
      boite.style.display = 'block';
    }
  } catch (e) {}
})();
