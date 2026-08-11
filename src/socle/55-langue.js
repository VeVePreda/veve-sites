// ⚠️ VeVePreda/veve-sites — src/socle/55-langue.js   (FICHIER NEUF — lot 139)
// ═══════════════════════════════════════════════════════════════════════════
//  LE SÉLECTEUR DE LANGUE D'INTERFACE, SUR LES PAGES PUBLIQUES
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 POURQUOI CE CODE EST DANS LE NAVIGATEUR ET NON DANS LE SERVEUR, ET CE
// N'EST PAS UN CHOIX DE STYLE — C'EST LA SEULE FORME POSSIBLE.
// Les pages publiques de veveprice sont PRÉ-GÉNÉRÉES (3 097 fichiers) et
// servies derrière les Cache Rules Cloudflare posées au lot 138 — mesuré le
// 11/08 : `cf-cache-status: HIT` sur l'accueil, TTL 2 h. Un lien `?lang=fr`
// comme celui de `/connexion/` y serait doublement mort :
//   ① personne ne le lit — un fichier statique n'a pas de gestionnaire de
//      requête, la chaîne de recherche est ignorée ;
//   ② et s'il était lu, la réponse française partirait au cache partagé et
//      serait servie à tout le monde. *Le remède serait pire que l'absence.*
// ⭐⭐ LE COOKIE, LUI, NE TOUCHE PAS AU CACHE. Le HTML reste identique pour
// tout le monde — c'est `50-i18n.js` qui échange les libellés chez le
// visiteur, après coup. La page reste cachable, et c'est ce qui rend ce
// sélecteur possible sans rien démonter ailleurs.
//
// ⛔ ON NE FAIT PAS L'ÉCHANGE ICI. `50-i18n.js` sait déjà le faire, il tourne
// juste avant dans le socle, et il porte cinq gardes durement acquis (page
// servie dans la langue pivot, gabarits `%s` non échangés, attributs, cache
// `sessionStorage`). Refaire l'échange ici en donnerait une SECONDE
// définition — et c'est la plus permissive qui gagnerait le jour où elles
// divergeraient. On pose le cookie, on recharge, et le module d'à côté fait
// son travail.
// ⭐ Conséquence assumée : un aller-retour réseau au changement de langue. Il
// est servi par le cache (HIT mesuré), et il arrive une fois par visiteur et
// par choix. *Un rechargement honnête vaut mieux qu'un second traducteur.*
//
// ⚠️ LES ATTRIBUTS DU COOKIE SONT RECOPIÉS DE `connexion/index.astro`, PAS
// RÉINVENTÉS : `path=/`, un an, `SameSite=Lax`. ⛔ `Secure` n'est PAS posé
// ici — en HTTP local (bac à sable, `localhost`) un cookie `Secure` est
// silencieusement REFUSÉ par le navigateur, et le sélecteur serait mort dans
// la seule configuration où on peut le regarder à l'œil. En production le
// site est en HTTPS strict (HSTS), donc le cookie ne voyage jamais en clair.
// ⭐ `httpOnly` est hors sujet : un cookie posé par un script ne peut pas
// l'être. Il ne porte aucun droit — c'est un réglage d'affichage, exactement
// comme la bascule jour/nuit.

(function () {
  var boite = document.getElementById('langue-ui');
  // ⭐ LE GARDE QUI REND CE FICHIER SÛR PARTOUT. Le socle est un seul fichier
  // pour toutes les pages du site : ce script part aussi sur `/compte/`,
  // `/market/`, `/favoris/` et `/dashboard/`, où le bouton n'est PAS émis
  // (décision de Preda du 11/08 : rien en espace membre). Sans bouton, il n'y
  // a rien à câbler et on sort. ⛔ Ce n'est pas la condition d'affichage —
  // celle-là est évaluée au build dans `Base.astro`, qui SAIT si la page est
  // rendue à la demande. Un script ne doit jamais décider ce qu'un gabarit a
  // déjà décidé : ce serait deux juges pour un affichage, la panne du lot 103.
  if (!boite) return;

  var LANGUE_PIVOT = 'en';

  // ═══════════════════════════════════════════════════════════════════════
  // ⭐⭐ L'ÉTAT COURANT SE POSE ICI, PARCE QUE LE FICHIER NE PEUT PAS LE SAVOIR
  // ═══════════════════════════════════════════════════════════════════════
  // La page est pré-générée : elle est le MÊME fichier pour les quatre
  // langues. `Base.astro` écrit donc « EN » et aucun `aria-current` — écrire
  // l'état au build afficherait « EN · courant » à quelqu'un qui lit en
  // français depuis trois semaines. Le cookie est la seule source, et lui
  // seul vit ici.
  // ⚠️ AVANT le câblage du clic, pas après : entre les deux, le bouton est
  // affiché avec un état faux. La fenêtre est courte — elle existe.
  var m = document.cookie.match(/(?:^|;\s*)vp_langue=([a-z]{2})/);
  var courante = (m && m[1]) || LANGUE_PIVOT;
  var etiq = document.getElementById('langue-ui-a');
  if (etiq) etiq.textContent = courante.toUpperCase();
  var choix = boite.querySelectorAll('[data-lang]');
  for (var i = 0; i < choix.length; i++) {
    // ⛔ `aria-current` RETIRÉ, pas mis à "false". Un `aria-current="false"`
    // est annoncé par certains lecteurs d'écran comme une information — on
    // dirait quatre fois « pas la page courante » avant d'arriver à la bonne.
    // L'absence de l'attribut est la façon dont ARIA dit « non ».
    if (choix[i].getAttribute('data-lang') === courante) choix[i].setAttribute('aria-current', 'true');
    else choix[i].removeAttribute('aria-current');
  }

  function poser(lang) {
    if (!/^[a-z]{2}$/.test(lang)) return;
    // ⚠️ ON EFFACE PLUTÔT QUE D'ÉCRIRE « en ». Le cookie absent et le cookie
    // `en` produisent le même écran — `50-i18n.js` sort immédiatement dans les
    // deux cas — mais un cookie posé sur la langue pivot est un état de plus à
    // porter, et il survivrait à un changement de langue pivot. *Revenir à
    // l'état par défaut, c'est retirer le réglage, pas en écrire un autre.*
    if (lang === LANGUE_PIVOT) {
      document.cookie = 'vp_langue=; path=/; max-age=0; samesite=lax';
    } else {
      document.cookie = 'vp_langue=' + lang + '; path=/; max-age=31536000; samesite=lax';
    }
    // ⭐ `location.reload()` ET NON un rendu à la main. La page revient du
    // cache, `50-i18n.js` la relit avec le nouveau cookie, et tout ce qui est
    // marqué `data-i18n` suit — y compris les 3 924 libellés qui vivent dans
    // un attribut. Réécrire ça ici en raterait une part, et on ne saurait pas
    // laquelle.
    window.location.reload();
  }

  // ⭐⭐ UN SEUL ÉCOUTEUR SUR LE CONTENEUR, PAS UN PAR LANGUE. Le nombre de
  // langues vient du manifeste (`languages.interface`) : un écouteur par
  // bouton marcherait aujourd'hui à quatre et se poserait la question à cinq.
  // La délégation ne compte rien.
  boite.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-lang]') : null;
    if (!b || !boite.contains(b)) return;
    e.preventDefault();
    poser(b.getAttribute('data-lang'));
  });

  // ⭐ LE MENU SE REFERME COMME CELUI DU COMPTE. `<details>` reste ouvert
  // après un clic ailleurs dans la page — c'est le comportement natif, et il
  // surprend. `20-menu.js` ferme déjà le tiroir sur Échap et sur un clic
  // extérieur ; on tient la même promesse ici plutôt que d'en avoir deux.
  document.addEventListener('click', function (e) {
    if (boite.open && !boite.contains(e.target)) boite.open = false;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && boite.open) {
      boite.open = false;
      var s = boite.querySelector('summary');
      if (s) s.focus();
    }
  });
})();
