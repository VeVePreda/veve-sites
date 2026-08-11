(function () {
  // Une classe sur <html> : le seul élément qui existe déjà quand un script du
  // <head> s'exécute. C'est elle qui révèle les boutons, via le CSS.
  document.documentElement.classList.add('js');

  function telecharger(bouton) {
    var bloc = bouton.closest('.fig');
    var svg = bloc && bloc.querySelector('svg');
    if (!svg) return;
    bouton.setAttribute('aria-busy', 'true');
    var boite = svg.viewBox && svg.viewBox.baseVal;
    var L = (boite && boite.width) || svg.clientWidth || 900;
    var H = (boite && boite.height) || svg.clientHeight || 400;
    var ECHELLE = 2;
    var xml = new XMLSerializer().serializeToString(svg);
    var url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    var img = new Image();
    img.onload = function () {
      var c = document.createElement('canvas');
      c.width = L * ECHELLE; c.height = H * ECHELLE;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(function (png) {
        bouton.removeAttribute('aria-busy');
        if (!png) return;
        var a = document.createElement('a');
        a.href = URL.createObjectURL(png);
        a.download = (bloc.getAttribute('data-fig-nom') || 'figure') + '.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      }, 'image/png');
    };
    img.onerror = function () { URL.revokeObjectURL(url); bouton.removeAttribute('aria-busy'); };
    img.src = url;
  }

  // Écouteur DÉLÉGUÉ sur `document`, attaché tout de suite : il n'a pas besoin
  // que les boutons existent, seulement que le clic remonte jusqu'ici.
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('.fig .fig-dl');
    if (b) { e.preventDefault(); telecharger(b); }
  });
})();
