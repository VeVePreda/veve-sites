
(function () {
  // ⚠️ `vp_membre=1` ET RIEN D'AUTRE. Un `indexOf('vp_membre')` dirait vrai
  // pour un cookie nommé `vp_membre_ancien`, et un `vp_membre=` accepterait
  // la valeur vide que pose l'effacement dans certains navigateurs.
  // ⭐⭐ ON RELIT L'ATTRIBUT POSÉ DANS LE `<head>`, PAS LE COOKIE. Le
  // clignotement du lot 98 venait de ce que la décision se prenait ici, en
  // bas du `<body>`, après la première peinture. Elle se prend maintenant
  // dans l'en-tête du document et l'AFFICHAGE est réglé par deux règles
  // CSS. ⛔ Relire le cookie ici donnerait une SECONDE source de vérité
  // pour la même question — et le jour où les deux divergeraient (cookie
  // effacé dans un autre onglet, par exemple), l'écran se contredirait
  // lui-même sans qu'on sache lequel croire.
  var membre = document.documentElement.hasAttribute('data-membre');

  // 👤 L'AVATAR — le CSS l'a déjà montré ou caché avant la peinture ; ce qui
  // suit remet l'ATTRIBUT `hidden` en accord avec ce qui est affiché.
  // ⭐ Ce n'est pas de la cosmétique : `hidden` n'est pas qu'un style, il
  // retire l'élément de l'arbre d'accessibilité. Un avatar visible à l'œil
  // et absent pour un lecteur d'écran serait un bouton qui n'existe que
  // pour les voyants.
  var av = document.querySelector('.globe[data-membre]');
  if (av) av.hidden = !membre;

  // ⛔ MÊME RAISON POUR CE QUI DOIT DISPARAÎTRE : l'appel à l'inscription et
  // le globe des langues (le réglage de langue vit dans le compte).
  // ⭐ Les liens de langue ne quittent PAS le DOM — le globe est `hidden`,
  // ses `<a hreflang>` restent lisibles par un robot, et les
  // `<link rel="alternate">` du <head> n'ont jamais bougé. Les retirer
  // ferait disparaître le multilingue des résultats de recherche, un dégât
  // invisible pendant des mois.
  if (membre) {
    var anon = document.querySelectorAll('[data-anonyme]');
    for (var i = 0; i < anon.length; i++) anon[i].hidden = true;
  }

  // ⭐ LA BARRE MOBILE. Sur téléphone, `.onglets` est la navigation réelle ;
  // sur une page pré-générée elle n'a que 3 entrées, puisque le gabarit
  // n'ajoute `/compte/` qu'à quelqu'un qu'il sait connecté. Sa grille est
  // déjà en 4 colonnes — la quatrième était simplement vide.
  var nav = document.querySelector('nav.onglets');
  if (membre && nav && av && !nav.querySelector('a[href="/compte/"]')) {
    var lien = document.createElement('a');
    lien.href = '/compte/';
    lien.textContent = av.querySelector('summary').getAttribute('aria-label') || '';
    if (lien.textContent) nav.appendChild(lien);
  }

  // 🖱️ LE SURVOL — demande de Preda. ⭐ C'EST UN CONFORT POSÉ PAR-DESSUS,
  // jamais le seul moyen d'ouvrir : `<details>` s'ouvre au clic et au
  // clavier sans une ligne de JavaScript, et il continue de le faire ici.
  // Un menu qui n'existe qu'au survol n'existe pas sur un téléphone.
  if (av) {
    var fermeture = null;
    av.addEventListener('mouseenter', function () {
      if (fermeture) { clearTimeout(fermeture); fermeture = null; }
      av.open = true;
    });
    // ⚠️ LE DÉLAI N'EST PAS UNE COQUETTERIE. Entre le bouton et le menu il y
    // a quelques pixels de vide ; sans ce répit, le menu se referme pendant
    // que la souris le traverse, et l'entrée devient impossible à cliquer.
    av.addEventListener('mouseleave', function () {
      fermeture = setTimeout(function () { av.open = false; }, 250);
    });
  }
})();
