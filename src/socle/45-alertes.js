(function () {
  // ═══════════════════════════════════════════════════════════════════════
  // 🔔 L'ACCÈS UNIQUE AUX ALERTES — et les deux lecteurs passent par lui
  // ═══════════════════════════════════════════════════════════════════════
  // ⭐⭐⭐ POURQUOI UN SEUL ACCÈS, ET POURQUOI IL EST ICI.
  // C'est le jumeau exact de `40-favoris.js`, et pour la raison que celui-ci
  // écrit en tête : le lot 140-1 a payé la forme inverse — trois lectures
  // indépendantes, toutes JUSTES, qui ont divergé le jour où une seule a appris
  // une règle de plus. Les alertes ont exactement deux lecteurs :
  //   ① le panneau de la fiche       (`src/socle/modules/alerte_fiche.js`) ;
  //   ② la page des réglages         (`src/socle/modules/alertes.js`).
  // Deux `fetch` seraient deux occasions de traiter le 401 différemment.
  //
  // 🔴🔴 ET IL NE POUVAIT PAS VIVRE DANS `src/socle/modules/`, C'EST MESURÉ —
  // même contrainte que les favoris : le socle est émis dans le `<head>`, un
  // module de composant dans le `<body>` ; les deux sont `defer`, donc exécutés
  // DANS L'ORDRE DU DOCUMENT. Un accès rangé dans `modules/` s'exécuterait
  // APRÈS ses appelants, qui ne pourraient pas le trouver.
  //
  // ⚠️ IL EST TOUT PETIT, ET C'EST VOULU. Le socle part sur 3 097 pages ; le
  // PANNEAU, lui, n'a de sens que sur une fiche et vit donc dans un module. On
  // ne verse au socle que ce que plusieurs pages partagent — la règle est
  // écrite en tête de `socle_js.mjs`, avec sa mesure.
  var API = '/api/alertes';

  // ⭐⭐ « SUIS-JE CONNECTÉ ? » SE LIT SUR L'ATTRIBUT `data-membre`, PAS SUR LE
  // COOKIE — mécanisme du lot 98, et `30-membre.js` dit pourquoi : relire le
  // cookie ici donnerait une SECONDE source de vérité pour une seule question.
  // ⛔ ET C'EST AUSSI CE QUI ÉVITE UN APPEL RÉSEAU SUR 8 484 FICHES : sans cette
  // porte, chaque fiche vue par un anonyme déclencherait un `/api/alertes` que
  // Cloudflare ne peut pas mettre en cache. *Un accès unique doit aussi savoir
  // ne pas s'ouvrir.*
  function membre() { return document.documentElement.hasAttribute('data-membre'); }

  var enCache = null;   // ⭐ une seule lecture par page, mémorisée

  function req(methode, corps) {
    return fetch(API, {
      method: methode,
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: corps ? JSON.stringify(corps) : undefined,
    }).then(function (r) {
      // ⭐⭐⭐ TROIS SORTIES, ET ELLES NE SE CONFONDENT PAS — la même règle que
      //   la route qui répond :
      //     · 401 → il n'y a personne ;
      //     · 503 → on NE SAIT PAS (base ou veveid muet) ;
      //     · le reste → on sait.
      //   ⛔ Aplatir le 503 sur le 401 ferait qu'une panne ressemblerait à une
      //   déconnexion : l'écran effacerait la liste affichée et la personne
      //   croirait avoir perdu ses alertes.
      if (r.status === 401) return { connecte: false, alertes: [], plafond: 0 };
      if (!r.ok) throw new Error(String(r.status));
      return r.json().then(function (j) {
        return { connecte: true, alertes: j.alertes || [], plafond: Number(j.plafond) || 0 };
      });
    });
  }

  window.vpAlertes = {
    connecte: membre,
    /** La liste du compte. ⭐ Une seule requête par page : le panneau de la
     *  fiche et un éventuel second lecteur partagent la même promesse. */
    liste: function () {
      if (!membre()) return Promise.resolve({ connecte: false, alertes: [], plafond: 0 });
      if (!enCache) enCache = req('GET');
      return enCache;
    },
    /** Pose ou remplace un seuil. ⛔ `sens` vaut 'sous' ou 'sur' — la route
     *  refuse tout le reste, et c'est elle qui a le dernier mot. */
    poser: function (uuid, sens, seuil, chemin, nom) {
      // ⛔ ON INVALIDE LE CACHE AVANT L'APPEL, PAS APRÈS. Une écriture qui
      //    échoue laisse quand même l'état du serveur incertain : garder une
      //    liste d'avant serait affirmer un état qu'on n'a plus.
      enCache = null;
      return req('POST', { uuid: uuid, sens: sens, seuil: seuil, chemin: chemin, nom: nom });
    },
    retirer: function (uuid) {
      enCache = null;
      return req('DELETE', { uuid: uuid });
    },
  };
})();
