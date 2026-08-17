// ⚠️ VeVePreda/veve-sites — src/socle/modules/favoris.js  (lot 140-3, REFONDU au 154-A)
// ═══════════════════════════════════════════════════════════════════════════
// LE PILOTE DE `/favoris/` — IL NE BÂTIT PLUS LA LISTE, IL LA CORRIGE
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 CE QUI A CHANGÉ AU LOT 154-A, ET POURQUOI CE N'ÉTAIT PAS UN CHOIX.
// Ce fichier remplissait `#fav-l` (et `#tb-fav`, sur le tableau de bord) depuis
// `window.vpFav`. La page est passée en TUILES — et une tuile veut une
// COUVERTURE, que `window.vpFav` n'a pas : un favori ne retient qu'un uuid, un
// chemin et un nom. L'adresse de l'image ne se devine pas davantage
// (`…image.<uuid>.<SECOND-uuid>.full.jpeg`). ⇒ La liste est désormais rendue
// AU SERVEUR, qui lit l'index déposé au build (`engine/lib/vignettes.mjs`).
// ⛔ La vue `tb-*` est partie avec les deux objets Favoris du tableau de bord
//    (demande de Preda, 14/08). Elle n'a pas été « désactivée » : une branche
//    morte que le filtre d'existence écarte en silence est une branche que
//    personne ne corrige.
//
// ⭐⭐ IL RESTE UN TRAVAIL, ET IL N'EXISTAIT PAS AVANT. Sur une page rendue au
// serveur, décocher un cœur ne fait plus rien disparaître : la tuile reste là
// jusqu'au rechargement. Sur la page dont c'est le seul sujet, ça se lit comme
// « le clic n'a pas marché ». Ce fichier ne fait donc plus qu'une chose : quand
// un cœur de CETTE page passe à « éteint », sa tuile s'en va.
//
// ⭐⭐⭐ IL OBSERVE `aria-pressed`, IL N'APPELLE RIEN ET NE DÉCIDE DE RIEN.
// C'est `40-favoris.js` qui parle au réseau — l'accès unique que `test_membre`
// §6 mesure — et surtout qui REPEINT SUR LA RÉPONSE, pas sur l'intention : si
// le serveur refuse le retrait, `aria-pressed` revient à `true` et la tuile ne
// bouge pas. En écoutant l'attribut plutôt que le clic, ce pilote hérite de
// cette garantie au lieu d'en écrire une seconde, qui divergerait.
// ⛔ Ne pas remplacer par un `addEventListener('click')` : ce serait revenir à
//    juger sur l'intention, et faire disparaître une tuile qu'un 409 « plafond »
//    ou un 503 vient de refuser d'ôter.

(function () {
  var hote = document.getElementById('fav-l');
  if (!hote) return;
  var vide = document.getElementById('fav-vide');

  function retirerLaTuile(bouton) {
    // ⚠️ `.carte-h` ET NON `.carte` : le cœur est un FRÈRE du lien, pas un
    //    enfant (`.carte` EST un `<a>`, et un bouton dans un lien est du HTML
    //    invalide — lot 126). L'unité à retirer est l'enveloppe, qui porte les
    //    deux. Retirer `.carte` laisserait un cœur orphelin flottant.
    var enveloppe = bouton.closest('.carte-h');
    if (!enveloppe || !hote.contains(enveloppe)) return;
    enveloppe.remove();

    // ⭐ ET L'ÉTAT VIDE REVIENT QUAND LA DERNIÈRE PART. Il est rendu au build,
    //   `hidden` : sans cette ligne, quelqu'un qui décoche son dernier favori
    //   se retrouve devant une page sans liste ET sans phrase — un blanc qui
    //   ressemble à une panne.
    if (!hote.querySelector('.carte-h')) {
      hote.hidden = true;
      if (vide) vide.hidden = false;
    }
  }

  // ⚠️ UN SEUL OBSERVATEUR SUR L'HÔTE, PAS UN PAR TUILE. `subtree: true` suit
  //    les 30 cœurs d'une même liste sans en enregistrer 30 — et il continue de
  //    fonctionner si une tuile est ajoutée plus tard (lot 154-C).
  var oeil = new MutationObserver(function (changements) {
    for (var i = 0; i < changements.length; i += 1) {
      var c = changements[i];
      var b = c.target;
      if (!b || !b.getAttribute) continue;
      if (!b.hasAttribute('data-fav')) continue;
      if (b.getAttribute('aria-pressed') === 'false') retirerLaTuile(b);
    }
  });
  oeil.observe(hote, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
})();
