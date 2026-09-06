// ⚠️ VeVePreda/veve-sites — src/socle/modules/rail.js   (FICHIER NEUF — LOT D)
// ═══════════════════════════════════════════════════════════════════════════
//  LA FORME DE LA BARRE DE FILTRES — RAIL EN PC, FEUILLE EN MOBILE
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 CE QU'IL FAIT, ET SURTOUT CE QU'IL NE FAIT PAS.
// Il n'a AUCUNE idée de ce qu'est un filtre. Il ne lit pas l'index, ne coche
// rien, ne compte rien, ne peint aucune ligne. Il ouvre une feuille, il replie
// un rail, et il recopie un nombre que le pilote a écrit. C'est tout.
// ⭐⭐ C'est la même frontière que `index_rayon.js` (lot 155-B) : *un module
// qui touche à la fois à la forme et au fond finit par décider à la place du
// pilote de ce qu'un état vide veut dire.*
//
// ⛔⛔ ET C'EST POUR ÇA QU'IL EST UN SEUL FICHIER POUR TROIS PAGES.
// Les rayons (`rayon.js`), `/sets/` (`series.js`) et `/market/` (son script en
// page) filtrent de trois façons différentes — l'un sur un index public,
// l'autre sur des nœuds présents, le troisième au SERVEUR en GET. Mais tous
// les trois portent la MÊME barre `.barre-f`. Écrire l'ouverture de la feuille
// dans chacun des trois, c'est le motif que ce dépôt a payé quatre fois (lots
// 127, 131, 132, 155-A) : trois copies se ressemblent six mois, puis l'une
// gagne la fermeture par Échap et les deux autres non.
//
// 🔑 IL SE BRANCHE SUR LE DOM, PAS SUR UNE PAGE. Aucun identifiant de page
// (`f-rayon`, `f-sets`, `filtres`) n'est écrit ici : le module prend la
// première `.barre-f` de son enveloppe. Le jour où une quatrième page porte
// une barre, elle l'a sans qu'on touche à ce fichier.
//
// ⚠️ AUCUN LIBELLÉ N'EST ÉCRIT ICI. « Voir les 41 résultats » vient de
// `data-modele`, traduit au serveur par `t()`. Un texte écrit dans un `.js` du
// socle serait servi en anglais aux cinq langues, et `test:cles` ne le verrait
// pas : il lit les appels à `t()`, pas les littéraux d'un fichier `.js`.
(function () {
  var env = document.querySelector('.avec-rail');
  if (!env) return;
  var f = env.querySelector('.barre-f');
  if (!f) return;

  // ── LE SEUIL, LU UNE FOIS ET NULLE PART AILLEURS ─────────────────────────
  // ⭐⭐ 1 040 px est écrit dans le thème (`@media (min-width:1041px)`), et il
  // est RELU ici par `matchMedia` avec la même valeur. C'est une duplication,
  // et elle est assumée : l'alternative — mesurer `getComputedStyle` d'un
  // témoin — ferait dépendre le pilote d'une propriété calculée à un moment où
  // la feuille externe peut ne pas être arrivée (la panne du 05/09 sur les
  // variables de marque). ⛔ Le jour où le seuil bouge, il bouge aux DEUX
  // endroits : c'est ce que le banc vérifie.
  var PC = window.matchMedia('(min-width:1041px)');

  // ── ① LA FEUILLE ─────────────────────────────────────────────────────────
  var ouvrir = env.querySelector('.f-ouvrir');
  var voir = f.querySelector('.f-voir');

  function feuille(on) {
    if (on) f.setAttribute('data-ouverte', '');
    else f.removeAttribute('data-ouverte');
    if (ouvrir) ouvrir.setAttribute('aria-expanded', String(!!on));
    // ⛔ ON NE TOUCHE PAS AU DÉFILEMENT DU CORPS. La feuille de la maquette
    // (variante C) monte à 62 % et laisse les résultats visibles au-dessus :
    // c'est justement pour qu'on puisse les regarder se rafraîchir. Bloquer le
    // défilement du document empêcherait de faire ce que cette variante a été
    // choisie pour permettre.
  }
  if (ouvrir) {
    ouvrir.addEventListener('click', function () {
      feuille(!f.hasAttribute('data-ouverte'));
    });
  }
  // ⭐ « Voir les N résultats » FERME, il ne valide rien : les filtres sont
  // déjà appliqués derrière, à chaque clic. Un bouton qui aurait l'air de
  // valider laisserait croire que rien n'a bougé tant qu'on n'a pas appuyé.
  if (voir) voir.addEventListener('click', function () { feuille(false); });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && f.hasAttribute('data-ouverte')) feuille(false);
  });

  // 🔴 LE PASSAGE D'UNE VUE À L'AUTRE REMET LA FEUILLE À PLAT. Sans ça, une
  // fenêtre agrandie au-delà du seuil garderait `data-ouverte` sur un rail —
  // inoffensif à l'œil, mais l'attribut mentirait, et le banc qui le lit
  // aussi. ⭐ *Un état qui survit à la disparition de sa forme est un état
  // faux.*
  var surSeuil = function () { if (PC.matches) feuille(false); };
  if (PC.addEventListener) PC.addEventListener('change', surSeuil);
  else if (PC.addListener) PC.addListener(surSeuil);

  // ── ② LE REPLI DU RAIL ───────────────────────────────────────────────────
  // 📏 248 → 52 px, soit 196 px rendus à la liste.
  // ⛔ L'ÉTAT N'EST PAS MÉMORISÉ. Ni `localStorage` ni cookie : personne n'a
  // mesuré qu'un visiteur veut retrouver son rail replié à la visite suivante,
  // et un état persistant qu'on n'a pas mesuré est un état à déboguer plus
  // tard. Le jour où Umami dit le contraire, c'est trois lignes.
  var replier = f.querySelector('[data-repli]');
  if (replier) {
    replier.addEventListener('click', function () {
      var on = !f.hasAttribute('data-replie');
      // ⭐⭐ L'ATTRIBUT EST POSÉ AUX DEUX ENDROITS, ET C'EST VOULU : la largeur
      // de la GRILLE est une propriété de l'enveloppe, la forme du RAIL une
      // propriété du formulaire. Un `:has()` aurait laissé le navigateur
      // déduire l'un de l'autre — et un état déduit ne se lit pas dans le DOM.
      if (on) { f.setAttribute('data-replie', ''); env.setAttribute('data-replie', ''); }
      else { f.removeAttribute('data-replie'); env.removeAttribute('data-replie'); }
      replier.setAttribute('aria-expanded', String(!on));
    });
  }

  // ── ③ LES DEUX NOMBRES, RECOPIÉS ET JAMAIS RECALCULÉS ────────────────────
  // 🔴🔴 C'EST LA RÈGLE QUI TIENT CE MODULE. Le nombre d'axes armés se lit sur
  // les jetons que le pilote a peints dans `.actifs` ; le nombre de résultats
  // se lit dans `data-retenues`, que le pilote écrit au moment où il le
  // calcule. ⛔ Les recompter ici — parcourir les cases cochées, compter les
  // nœuds peints — donnerait deux vérités : celle du pilote, et la mienne. Le
  // dépôt a mesuré cette panne le 10/08 (`data-ch` à « 300 » d'un côté et
  // « 300.00 » de l'autre, deux lots durant).
  // ⚠️ Et compter les nœuds peints donnerait la TRANCHE (20), pas les
  // retenues : le bouton dirait « Voir les 20 résultats » sur 41 retenues.
  var armes = env.querySelector('.f-armes');
  var actifs = f.querySelector('.actifs');
  var modele = voir ? (voir.getAttribute('data-modele') || '') : '';
  var libelleNu = voir ? voir.textContent : '';

  function refleter() {
    if (armes && actifs) {
      var n = actifs.children.length;
      armes.textContent = String(n);
      armes.hidden = n === 0;
    }
    if (voir && modele) {
      var r = f.getAttribute('data-retenues');
      // ⭐ TANT QUE LE PILOTE N'A RIEN CALCULÉ, LE BOUTON NE DIT PAS DE NOMBRE.
      // `null` n'est pas `0` : « Voir les 0 résultats » servi avant le premier
      // filtre serait un chiffre faux, pas un état d'attente. C'est la leçon
      // de `#r-cpt`, qui sort vide pour la même raison.
      voir.textContent = r === null ? libelleNu : modele.replace('{n}', r);
    }
  }

  // ⭐ UN OBSERVATEUR, PAS UN ÉVÉNEMENT SUR LE FORMULAIRE. Le pilote peint les
  // jetons APRÈS avoir filtré, parfois de façon asynchrone (il attend l'index).
  // Un écouteur `input` s'exécuterait avant lui et lirait l'état précédent —
  // le compteur aurait toujours un geste de retard.
  if (window.MutationObserver) {
    var obs = new MutationObserver(refleter);
    if (actifs) obs.observe(actifs, { childList: true });
    obs.observe(f, { attributes: true, attributeFilter: ['data-retenues'] });
  }
  refleter();
})();
