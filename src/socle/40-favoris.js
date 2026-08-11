
(function () {
  var CLE = 'vp_fav';
  function lire() {
    try { return JSON.parse(localStorage.getItem(CLE) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function ecrire(o) {
    try { localStorage.setItem(CLE, JSON.stringify(o)); } catch (e) { /* quota, mode privé */ }
  }
  var favs = lire();
  var boutons = document.querySelectorAll('[data-fav]');
  if (!boutons.length) return;
  function peindre(b, on) {
    b.setAttribute('aria-pressed', String(on));
    var l = b.getAttribute(on ? 'data-l-on' : 'data-l-off');
    if (l) { b.setAttribute('aria-label', l); b.setAttribute('title', l); b.setAttribute('data-l', l); }
  }
  boutons.forEach(function (b) {
    var u = b.getAttribute('data-fav');
    peindre(b, !!favs[u]);
    b.addEventListener('click', function () {
      favs = lire();                       // ⭐ on relit : un autre onglet a pu écrire
      if (favs[u]) delete favs[u];
      // ⭐⭐ ON MÉMORISE LE NOM ET LE CHEMIN, PAS SEULEMENT L'UUID.
      //   La page /favoris/ est STATIQUE : elle ne peut pas retrouver le nom
      //   d'une pièce à partir d'un uuid sans appeler le réseau. Trois
      //   octets de plus ici évitent une requête là-bas — et la liste
      //   s'affiche même hors ligne.
      //   ⛔ On n'y met AUCUN prix : un favori est une intention, pas une
      //   cote. Le mur reste exactement où il est.
      else favs[u] = { p: b.getAttribute('data-fav-path') || '',
                       n: b.getAttribute('data-fav-nom') || '', t: Date.now() };
      ecrire(favs);
      peindre(b, !!favs[u]);
    });
  });
})();
