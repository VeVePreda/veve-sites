// ⚠️ VeVePreda/veve-sites — src/socle/modules/bord.js   (FICHIER NEUF — lot J)
// ═══════════════════════════════════════════════════════════════════════════
// LE PILOTE DU TABLEAU DE BORD — il ADDITIONNE, il ne DEMANDE rien
// ═══════════════════════════════════════════════════════════════════════════
//
// ⛔⛔ AUCUN `fetch` DANS CE FICHIER, ET C'EST LA RÈGLE DU LOT 155 APPLIQUÉE.
// `60-cote.js` est l'appelant UNIQUE de `/api/cote/lot` : il porte le plafond
// de 60, la lecture du 401 et le format des nombres. Un second appel écrit ici
// traiterait forcément l'un des trois autrement le jour où l'un des deux
// fichiers apprendrait une règle de plus.
// ⇒ On s'INSCRIT (`window.vpQuandCotes`) et on lit les valeurs BRUTES.
//
// ⛔⛔⛔ ET ON NE RELIT JAMAIS LE TEXTE AFFICHÉ. Les colonnes voisines portent
// déjà « 1 234,5 » (fr) ou « 1.234,5 » (de) : les additionner reviendrait à
// mesurer avec la règle de mon outil au lieu de celle du site — la faute qui a
// fait lire « 4,1 % » pour 99,2 % parce qu'un nombre portait une virgule.
//
// ⭐⭐⭐ TROIS ÉTATS D'ARRIVÉE, TROIS PHRASES DIFFÉRENTES :
//   · des cotes           → on additionne, et on date ;
//   · `raison = 'palier'` → « réservé à votre palier » — ce n'est PAS une
//                           panne, et surtout pas un zéro ;
//   · `raison = 'panne'`  → « indisponible » — la donnée est due et n'arrive
//                           pas ; le tiret reste, jamais un chiffre.
// ⛔ Aucun de ces trois chemins n'écrit `0`. Un zéro sur la valeur d'une
//    collection est un chiffre faux, et c'est la seule faute que ce projet ne
//    rattrape pas.

(function () {
  var hote = document.getElementById('tb-collection');
  // ⭐ LE FILTRE D'EXISTENCE D'ABORD : ce module est servi par `toutLeJs()`,
  //   donc écrit dans `dist/` même là où aucune page ne l'appelle.
  if (!hote) return;
  if (typeof window.vpQuandCotes !== 'function') {
    // ⚠️ SANS LA PORTE DES PRIX, `60-cote.js` N'EST PAS EMBARQUÉ (voir
    //   `CONDITIONS` dans `socle_js.mjs`) : il n'y a pas de cote à attendre, et
    //   les cases gardent leur tiret. *La condition voyage avec le code, ou
    //   elle disparaît.*
    return;
  }

  var nf = document.documentElement.getAttribute('data-nf') || 'en-GB';
  // 🔑 `data-l-*` PORTE TOUS LES MOTS, et c'est la convention du dépôt
  //   (`Corner.astro`, `Cadran.astro`, `Carte.astro`). Ce fichier est du JS de
  //   socle : il ne connaît AUCUN texte, et il ne peut pas en connaître — il
  //   est servi identique aux cinq langues. ⛔ Une chaîne écrite ici sortirait
  //   en anglais dans les cinq, sans erreur : c'est la panne P30 du lot 139.
  // ⭐ Et `test:fuite` §7 admet explicitement cette famille : elle ne porte que
  //   des mots traduits, jamais une valeur.
  function txt(cle, repli) {
    var v = hote.getAttribute('data-l-' + cle);
    return (typeof v === 'string' && v) ? v : repli;
  }
  function nb(v, dec) {
    return Number(v).toLocaleString(nf, { maximumFractionDigits: dec === undefined ? 0 : dec });
  }
  function ecrire(id, valeur) { var e = document.getElementById(id); if (e) e.textContent = valeur; }

  window.vpQuandCotes(function (cotes, raison) {
    if (!cotes) {
      var phrase = raison === 'palier' ? txt('reserve', '') : txt('hs', '');
      // ⛔ ON N'ÉCRASE PAS LE TIRET PAR UNE CHAÎNE VIDE. Si le gabarit n'a pas
      //    posé le libellé, la case garde « — », qui est déjà juste.
      if (phrase) { ecrire('tb-valeur-s', phrase); ecrire('tb-var-s', phrase); }
      return;
    }

    // ═══ LA SOMME ═════════════════════════════════════════════════════════
    // ⚠️ ON PARCOURT LES HÔTES DU DOCUMENT, PAS LES CLÉS DE `cotes`.
    //    `window.vpCotes` est CUMULATIF (il garde ce qu'un autre remplissage a
    //    rapporté) : additionner ses clés compterait des pièces qui ne sont pas
    //    dans MES favoris le jour où une autre page partagerait ce canal.
    //    ⭐ *On somme la population qu'on montre, pas le cache qu'on trouve.*
    var places = document.querySelectorAll('[data-cote][data-champ="floor"]');
    var vus = {};
    var total = 0;
    var comptees = 0;
    var manquantes = 0;
    for (var i = 0; i < places.length; i++) {
      var u = places[i].getAttribute('data-cote');
      if (!u || vus[u]) continue;
      vus[u] = 1;
      var c = cotes[u];
      var f = c ? Number(c.floor) : NaN;
      // ⭐ UNE PIÈCE SANS PLANCHER N'EST PAS UNE PIÈCE À ZÉRO. Elle sort du
      //   total ET se compte à part : c'est ce qui permet à la sous-ligne de
      //   dire « 12 pièces sur 17 » au lieu d'annoncer un total muet.
      if (!isFinite(f)) { manquantes++; continue; }
      total += f;
      comptees++;
    }

    if (!comptees) {
      // ⛔ AUCUNE COTE REÇUE ⇒ ON N'ÉCRIT PAS « 0 ». La liste peut être vide,
      //    la réserve peut manquer : dans les deux cas le tiret dit vrai.
      var p2 = txt('vide', '');
      if (p2) ecrire('tb-valeur-s', p2);
      return;
    }

    ecrire('tb-valeur', nb(total));
    var modele = manquantes
      ? txt('partiel', '')
      : txt('faite', '');
    if (modele) {
      ecrire('tb-valeur-s', modele.replace('{n}', nb(comptees)).replace('{m}', nb(comptees + manquantes)));
    }

    // ═══ LA VARIATION 7 JOURS ═════════════════════════════════════════════
    // ⭐⭐ PONDÉRÉE PAR LES PLANCHERS, ET C'EST LA SEULE MOYENNE QUI VEUILLE
    //    DIRE QUELQUE CHOSE ICI. La moyenne SIMPLE des pourcentages donne le
    //    même poids à une pièce à 45 gems et à une pièce à 2 400 : elle répond
    //    à « comment vont mes pièces », pas à « combien vaut ma collection ».
    //    C'est la seconde question que la case pose, juste sous un total.
    // ⚠️ On reconstruit la valeur d'il y a 7 jours (`f / (1 + p/100)`) plutôt
    //    que de moyenner des pourcentages : c'est la même opération que fait la
    //    somme, à une semaine de distance.
    var avant = 0;
    var apres = 0;
    for (var k in vus) {
      if (!Object.prototype.hasOwnProperty.call(vus, k)) continue;
      var cc = cotes[k];
      if (!cc) continue;
      var fl = Number(cc.floor);
      var ch = Number(cc.change7d);
      if (!isFinite(fl) || !isFinite(ch)) continue;
      var base = fl / (1 + ch / 100);
      if (!isFinite(base) || base <= 0) continue;
      avant += base;
      apres += fl;
    }
    if (avant > 0) {
      var pct = ((apres - avant) / avant) * 100;
      var e = document.getElementById('tb-var');
      if (e) {
        e.textContent = (pct > 0 ? '+' : '') + nb(pct, 1) + ' %';
        // ⭐ LA COULEUR VIENT DES CLASSES DU SITE (`.up` / `.down`), pas d'un
        //   style en ligne : `--baisse-txt` de la maquette n'existe pas dans ce
        //   thème, et inventer un jeton pour une case aurait fait diverger la
        //   palette. ⛔ La flèche n'est pas ajoutée ici : la valeur porte déjà
        //   son signe, et un SVG écrit dans ce fichier serait une seconde
        //   fabrique de `delta()`.
        e.className = 'v ' + (pct > 0 ? 'up' : pct < 0 ? 'down' : '');
      }
    }

    // ═══ LES JAUGES BAS ↔ HAUT ════════════════════════════════════════════
    // 🔑 TROIS MONTANTS (atl, floor, ath) ⇒ elle ne pouvait se calculer QUE
    //    ici, après la réponse. Le serveur n'a plus aucun des trois.
    var jauges = document.querySelectorAll('[data-jauge]');
    for (var j = 0; j < jauges.length; j++) {
      var g = jauges[j];
      var cj = cotes[g.getAttribute('data-jauge')];
      if (!cj) continue;
      var lo = Number(cj.atl); var hi = Number(cj.ath); var fo = Number(cj.floor);
      // ⛔ `hi > lo` STRICTEMENT : une pièce dont l'ATL vaut l'ATH n'a pas de
      //    place à montrer, et la division rendrait l'infini. Elle garde sa
      //    jauge vide plutôt qu'un curseur planté à 0 %, qui se lirait « au
      //    plus bas ».
      if (!isFinite(lo) || !isFinite(hi) || !isFinite(fo) || !(hi > lo)) continue;
      var pos = ((fo - lo) / (hi - lo)) * 100;
      pos = Math.max(0, Math.min(100, pos));
      var barre = g.querySelector('i');
      if (barre) barre.style.insetInlineStart = pos.toFixed(1) + '%';
      g.setAttribute('data-remplie', '1');
    }

    // ═══ LES SEUILS FRANCHIS ══════════════════════════════════════════════
    // ⛔⛔ RIEN N'EST ÉCRIT ICI, ET C'EST DÉLIBÉRÉ. Un seuil franchi se compte
    //    dans la table `declenchements` (lot 215), derrière l'arbitrage ⑤ —
    //    GELÉ. Écrire un nombre à partir de ce qu'on a sous la main (« combien
    //    de mes favoris ont baissé ») répondrait à une AUTRE question sous le
    //    libellé de celle-ci. *Une case qui garde son tiret est honnête ; une
    //    case remplie par un chiffre voisin est un mensonge tranquille.*
  });
})();
