
(function () {
  // ═══════════════════════════════════════════════════════════════════════
  // ❤️ L'ACCÈS UNIQUE AUX FAVORIS — et les trois lecteurs passent par lui
  // ═══════════════════════════════════════════════════════════════════════
  // ⭐⭐⭐ POURQUOI UN SEUL ACCÈS, ET POURQUOI IL EST ICI.
  // Le lot 140-1 vient de payer la forme inverse : trois lectures
  // indépendantes de `plages:`, toutes JUSTES, qui ont divergé le jour où une
  // seule a appris une règle de plus. Les favoris ont exactement trois
  // lecteurs — le bouton ★ (ce fichier), la page `/favoris/` et la tuile du
  // tableau de bord (`src/socle/modules/favoris.js`). Trois `fetch` seraient
  // trois occasions de traiter le 401 différemment.
  //
  // 🔴🔴 ET IL NE POUVAIT PAS VIVRE DANS `src/socle/modules/`, C'EST MESURÉ :
  // le socle est émis dans le `<head>` (Base.astro l. 651), un module de
  // composant dans le `<body>` ; les deux sont `defer`, donc exécutés DANS
  // L'ORDRE DU DOCUMENT. Un accès rangé dans `modules/` s'exécuterait APRÈS ce
  // fichier, qui ne pourrait pas l'appeler. L'accès est donc dans le socle, et
  // les modules l'y trouvent — jamais l'inverse.
  //
  // ⚖️ ARBITRAGE PREDA ③ DU 12/08 — ON PART PROPRE. `vp_fav` est MORT : plus
  // une lecture, plus une écriture, aucun versement des favoris locaux
  // existants. Une clé morte ne se laisse pas traîner « au cas où » : tant
  // qu'elle est lue quelque part, il y a deux sources de vérité pour la même
  // question. ⚠️ Le coût est assumé et il porte sur des VISITEURS : qui avait
  // mis des pièces de côté sans compte les perd, sans message.
  var API = '/api/favoris';

  // ⭐⭐ « SUIS-JE CONNECTÉ ? » SE LIT SUR L'ATTRIBUT `data-membre`, PAS SUR LE
  // COOKIE. C'est le mécanisme du lot 98, et `30-membre.js` dit pourquoi :
  // relire le cookie ici donnerait une SECONDE source de vérité pour une seule
  // question, et le jour où les deux divergeraient l'écran se contredirait.
  // ⛔ ET C'EST AUSSI CE QUI ÉVITE UN APPEL RÉSEAU SUR 3 097 PAGES : sans cette
  // porte, chaque fiche vue par un anonyme déclencherait un `/api/favoris` que
  // Cloudflare ne peut pas mettre en cache. Un accès unique doit aussi savoir
  // ne pas s'ouvrir.
  function membre() { return document.documentElement.hasAttribute('data-membre'); }

  var enCache = null;   // ⭐ une seule lecture par page, mémorisée
  function req(methode, corps) {
    return fetch(API, {
      method: methode,
      // ⚠️ Le cookie de session voyage, sinon la route rend 401 à un membre.
      credentials: 'same-origin',
      headers: corps ? { 'content-type': 'application/json' } : undefined,
      body: corps ? JSON.stringify(corps) : undefined,
    }).then(function (r) {
      // ⭐⭐⭐ TROIS RÉPONSES, ET ELLES NE SE CONFONDENT PAS.
      //   401 → il n'y a personne : liste vide, et c'est une VÉRITÉ.
      //   503 → on ne sait pas : on LÈVE, et l'appelant garde ce qu'il
      //         affiche. ⛔ Rendre `{}` ici ferait afficher « aucun favori » à
      //         quelqu'un qui en a trente, et le clic suivant écraserait la
      //         vraie liste par la fausse.
      if (r.status === 401) return { connecte: false, favoris: {} };
      if (!r.ok) throw new Error('favoris: HTTP ' + r.status);
      return r.json().then(function (j) {
        return { connecte: true, favoris: (j && j.favoris) || {} };
      });
    });
  }

  window.vpFav = {
    connecte: membre,
    // ⭐ Paresseuse ET mémorisée : deux lecteurs sur la même page (le bouton ★
    //   d'une fiche et rien d'autre, aujourd'hui) ne font qu'un aller-retour.
    liste: function () {
      if (!membre()) return Promise.resolve({ connecte: false, favoris: {} });
      if (!enCache) enCache = req('GET', null);
      return enCache;
    },
    poser: function (uuid, chemin, nom) {
      enCache = req('POST', { uuid: uuid, path: chemin || '', nom: nom || '' });
      return enCache;
    },
    retirer: function (uuid) {
      enCache = req('DELETE', { uuid: uuid });
      return enCache;
    },
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ★ LE BOUTON — premier lecteur de l'accès ci-dessus
  // ═══════════════════════════════════════════════════════════════════════
  // ⚖️ ARBITRAGE PREDA ④ DU 12/08 : le ★ est INVISIBLE tant qu'on n'est pas
  // connecté. ⛔ MAIS IL RESTE ÉMIS DANS LE HTML POUR TOUT LE MONDE, et seule
  // la CSS le masque (`html:not([data-membre]) .socle__fav`, Base.astro).
  // ⭐⭐⭐ CE N'EST PAS UN DÉTAIL D'IMPLÉMENTATION : `test_membre` §5 compte
  // AUTANT DE CŒURS QUE D'ENVELOPPES `.carte-h`, PAGE PAR PAGE. Le rendre
  // conditionnel au build ferait rougir ce banc sur toutes les pages de
  // vitrine — et le banc aurait raison, puisque la règle CSS qui le stylise
  // attendrait un émetteur disparu.
  var boutons = document.querySelectorAll('[data-fav]');
  if (!boutons.length) return;

  function peindre(b, on) {
    b.setAttribute('aria-pressed', String(on));
    var l = b.getAttribute(on ? 'data-l-on' : 'data-l-off');
    if (l) { b.setAttribute('aria-label', l); b.setAttribute('title', l); b.setAttribute('data-l', l); }
  }

  var etat = {};
  window.vpFav.liste().then(function (r) {
    etat = r.favoris;
    boutons.forEach(function (b) { peindre(b, !!etat[b.getAttribute('data-fav')]); });
  }).catch(function () { /* 503 : on laisse les boutons dans leur état de repos */ });

  boutons.forEach(function (b) {
    var u = b.getAttribute('data-fav');
    b.addEventListener('click', function () {
      // ⚖️ ARBITRAGE PREDA ② : AUCUN FAVORI POSSIBLE AVANT LA CONNEXION. Le
      // bouton est déjà invisible pour un anonyme ; ce garde couvre le cas où
      // il serait atteint autrement (clavier sur un `display:none` levé par
      // une extension, script). ⛔ On ne pose rien « en attendant » : ce
      // serait rouvrir la source locale qu'on vient de fermer.
      if (!window.vpFav.connecte()) return;
      var on = !etat[u];
      // ⭐ ON PEINT D'ABORD. L'aller-retour dure ce qu'il dure ; un bouton qui
      //   ne réagit qu'au retour du réseau se fait cliquer deux fois.
      peindre(b, on);
      var p = on
        ? window.vpFav.poser(u, b.getAttribute('data-fav-path'), b.getAttribute('data-fav-nom'))
        : window.vpFav.retirer(u);
      p.then(function (r) {
        etat = r.favoris;
        // ⛔ ET ON REPEINT SUR LA RÉPONSE, pas sur l'intention : si le plafond
        //    a refusé, le ★ doit revenir en arrière plutôt que mentir.
        peindre(b, !!etat[u]);
      }).catch(function () { peindre(b, !on); });
    });
  });
})();
