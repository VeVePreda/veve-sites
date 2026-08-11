
(function () {
  var b = document.getElementById('menu-b');
  var m = document.getElementById('menu-m');
  if (!b || !m) return;
  function poser(ouvert) {
    m.hidden = !ouvert;
    b.setAttribute('aria-expanded', String(ouvert));
    // 🔴 LOT 118 — LE VOILE DU TIROIR. `body[data-tiroir]::after` l'allume.
    // ⭐ UN SEUL ATTRIBUT POUR DEUX EFFETS (l'assombrissement ET
    //   `pointer-events`), posé au même instant que `hidden`. Deux
    //   interrupteurs pour un seul état finissent par diverger : un voile
    //   resté transparent MAIS cliquable intercepte tous les clics de la
    //   page en silence — c'est la panne de l'élément transparent du lot
    //   111, vue de l'autre côté.
    // ⛔ `document.body` et pas un nœud fabriqué ici : un élément ajouté par
    //   ce script survivrait à une erreur survenue entre deux gestes, et
    //   resterait affiché par-dessus la page sans plus rien pour le retirer.
    if (ouvert) document.body.setAttribute('data-tiroir', '1');
    else document.body.removeAttribute('data-tiroir');
  }
  b.addEventListener('click', function (e) {
    e.stopPropagation();
    poser(m.hidden);
  });
  // ⭐ Un clic AILLEURS referme. Sans ça, le menu reste ouvert par-dessus la
  // page et on croit avoir cliqué à côté d'un lien alors qu'on a cliqué sur
  // le voile invisible du menu.
  document.addEventListener('click', function (e) {
    if (!m.hidden && !m.contains(e.target) && e.target !== b) poser(false);
  });
  // 🔴 LOT 118 — UN LIEN DU TIROIR REFERME LE TIROIR.
  // ⭐ Ça n'a l'air de rien et ça se remarque tout de suite : sur les
  //   ancres internes (`/collections/#sets`) ou quand le navigateur restaure
  //   la page depuis son cache arrière/avant, la navigation ne recharge pas
  //   le document — le tiroir resterait ouvert par-dessus la page d'arrivée,
  //   voile compris. Un panneau qui survit à sa propre navigation ressemble
  //   à un écran figé. ⛔ Le `click` général au-dessus ne suffit pas : le
  //   lien est DANS `m`, donc `m.contains(e.target)` est vrai.
  m.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('a')) poser(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !m.hidden) { poser(false); b.focus(); }
  });
})();
