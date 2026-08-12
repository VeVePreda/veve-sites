// ⚠️ VeVePreda/veve-sites — src/socle/modules/favoris.js  (NEUF — lot 140-3)
// ═══════════════════════════════════════════════════════════════════════════
// LE PILOTE DES DEUX VUES — `/favoris/` et la tuile du tableau de bord
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ IL NE PARLE PAS AU RÉSEAU. Le seul appel à `/api/favoris` du dépôt vit
// dans `src/socle/40-favoris.js` ; ce fichier consomme `window.vpFav`. C'est
// la contrainte que `test_membre` §6 mesure — « un accès unique » — et elle
// existe parce que le lot 140-1 a payé trois lectures indépendantes et toutes
// justes d'une même donnée, qui ont divergé dès qu'UNE a appris une règle de
// plus.
// ⚠️ L'ORDRE EST GARANTI : le socle est émis dans le `<head>` (Base.astro
// l. 651), ce module dans le `<body>` ; les deux sont `defer`, donc exécutés
// dans l'ordre du document. `window.vpFav` existe forcément ici.
//
// ⭐⭐ ET IL N'EST PAS EN LIGNE, C'EST TOUT L'INTÉRÊT DE CE DÉPLACEMENT. Un
// `<script is:inline>` s'exécute quand l'analyseur l'atteint : un `#id` déclaré
// plus bas rend `null`, et un banc qui monte le HTML entier y est aveugle. Les
// deux scripts que ce fichier remplace vivaient après leur cible et
// marchaient — mais la règle du dépôt est que tout pilote sort du HTML, et ces
// deux-là partaient en double sur deux gabarits.
//
// ⭐ DEUX VUES, UN FICHIER : elles affichent la MÊME liste, dans le MÊME ordre,
// avec le MÊME rendu de ligne. Les séparer aurait recréé le doublon qu'on
// vient de retirer, à un `slice(0, 8)` près.

(function () {
  var vues = [
    // `/favoris/` — la liste complète.
    { hote: 'fav-l', vide: 'fav-vide', compteur: null, coupe: 0 },
    // Le tableau de bord — un point de départ, pas la liste complète.
    // ⭐ HUIT, PAS TOUT : le lien « voir tout » vit dans le TITRE de la
    //   section, il ne dépend plus d'avoir plus de huit favoris pour exister.
    { hote: 'tb-fav', vide: 'tb-vide', compteur: 'tb-nfav', coupe: 8 },
  ];

  var actives = vues.filter(function (v) { return document.getElementById(v.hote); });
  if (!actives.length) return;
  // ⛔ AUCUN REPLI LOCAL. La clé du navigateur est morte au lot 140-3 : sans
  //    l'accès du socle, ce pilote ne fait rien plutôt que de rouvrir en
  //    silence la source qu'on vient de fermer.
  if (!window.vpFav) return;

  window.vpFav.liste().then(function (r) {
    var favs = r.favoris || {};
    // ⭐ Le serveur rend déjà le plus récent en premier (`ORDER BY pose_le
    //   DESC`). ⛔ On ne retrie pas ici : ce serait une deuxième définition de
    //   « l'ordre des favoris », et deux définitions finissent par diverger.
    var cles = Object.keys(favs);

    actives.forEach(function (v) {
      var hote = document.getElementById(v.hote);
      var vide = document.getElementById(v.vide);
      var cpt = v.compteur ? document.getElementById(v.compteur) : null;

      // ⭐ Le compteur est `hidden` par défaut : à zéro, il n'apparaît pas.
      if (cpt && cles.length) { cpt.textContent = String(cles.length); cpt.hidden = false; }
      if (!cles.length) return;
      // ⭐ L'ÉTAT VIDE EST RENDU AU BUILD ET VISIBLE PAR DÉFAUT ; on le masque
      //   seulement si on a trouvé quelque chose. L'inverse montrerait un écran
      //   nu à qui n'a pas de JavaScript, et un clignotement à tous les autres.
      if (vide) vide.hidden = true;

      (v.coupe ? cles.slice(0, v.coupe) : cles).forEach(function (u) {
        var f = favs[u] || {};
        var li = document.createElement('li');
        li.className = 'rayon__l';
        // ⛔ `textContent`, JAMAIS `innerHTML`. Le nom vient maintenant du
        //    SERVEUR, mais il y a été écrit par un navigateur : la précaution
        //    ne change pas de nature en changeant de source.
        var a = document.createElement(f.p ? 'a' : 'div');
        a.className = 'rayon__c' + (f.p ? '' : ' rayon__c--muet');
        if (f.p) a.setAttribute('href', f.p);
        var n = document.createElement('span');
        n.className = 'rayon__n';
        n.textContent = f.n || u;
        a.appendChild(n);
        li.appendChild(a);
        hote.appendChild(li);
      });
    });
  }).catch(function () {
    // ⛔ 503 : LA BASE EST MUETTE, ET ON NE DIT PAS « AUCUN FAVORI ». L'état
    //    vide rendu au build reste affiché tel quel — il dit « rien à
    //    montrer », pas « vous n'avez rien ». Écraser l'écran avec une liste
    //    vide serait affirmer une chose qu'on ne sait pas.
  });
})();
