(function () {
var hotes = document.querySelectorAll('[data-cadran]');
if (!hotes.length) return;

if (!document.documentElement.hasAttribute('data-membre')) return;

hotes.forEach(function (hote) {
  var uuid = hote.getAttribute('data-cadran');
  var cible = hote.querySelector('[data-cible]');
  var svgHote = hote.querySelector('[data-svg]');
  var bulle = hote.querySelector('[data-bulle]');
  var legende = hote.querySelector('[data-legende]');

  // LOT 213 — le teasing s'efface ICI, et surtout pas la ou le graphe arrive.
  // Ce module sort a sa premiere ligne sans `data-membre` : quiconque atteint
  // cette ligne a une session. L'effacer plus bas, au moment ou la courbe est
  // dessinee, aurait laisse un membre lire « l'historique s'ouvre a partir du
  // palier Membre » pendant tout l'aller-retour reseau — un message faux,
  // affiche a la seule personne qui sait qu'il est faux.
  // Un membre sans droit sur aucune plage ne voit donc ni graphe ni teasing :
  // c'est ce qu'il voyait deja avant ce lot, et le refus a son propre libelle.
  var teaser = hote.querySelector('[data-teaser]');
  if (teaser) teaser.hidden = true;

  var enCours = false;

  function charger() {
    if (enCours) return;
    enCours = true;

    fetch('/api/historique/' + encodeURIComponent(uuid), {
      credentials: 'same-origin', headers: { accept: 'application/json' }
    }).then(function (r) {
      if (r.status === 401 || r.status === 403) return null;
      if (!r.ok) { console.warn('[cadran] ' + uuid + ' : HTTP ' + r.status); return null; }
      return r.json();
    }).then(function (j) {
      // 🕰️ LOT 217 — `vu` REMONTE AVEC LES POINTS, ET IL VIENT DE `j.h`.
      // ⛔ PAS DE `j.vu` : l'enveloppe de la route porte le palier et la
      // profondeur ; la SERIE porte sa date d'observation. Les confondre
      // rendrait `undefined` en silence, et la courbe s'arreterait au dernier
      // changement — c'est-a-dire exactement la panne qu'on repare.
      // ⭐ `>= 1` ET PLUS `>= 2` : en escalier, UN point suffit a tracer une
      // ligne plate jusqu'a l'observation. C'est meme le cas le plus frequent
      // sur une fenetre courte, et l'ancien seuil le renvoyait au repli
      // normalise — un membre voyait donc la courbe SANS PRIX pour la seule
      // raison que le prix n'avait pas bouge.
      if (j && j.ok && j.h && j.h.p && j.h.p.length >= 1) {
        recevoir(j.h.p, { h: j.h, palier: j.palier, vu: j.h.vu });
        return null;
      }
      return fetch('/api/cote/' + encodeURIComponent(uuid), {
        credentials: 'same-origin', headers: { accept: 'application/json' }
      }).then(function (r) { return r.ok ? r.json() : null; }).then(function (c) {
        if (!c || !c.ok || !c.c || !c.c.courbe || c.c.courbe.length < 2) return null;
        // 🔴🔴 LOT 140-2 — `palier: c.palier` ETAIT ABSENT, ET C'EST TOUTE LA PANNE.
        // Cette branche est le REPLI : on n'y arrive qu'apres un refus de
        // `/api/historique/`. C'est donc la SEULE que prend un palier a qui la
        // porte `price_history` dit non — c'est-a-dire, du lot 132 au lot 140,
        // TOUT MEMBRE. La reponse de `/api/cote/` porte son palier (route,
        // ligne 72) ; on le jetait, `deverrouiller()` lisait `meta.palier ||
        // 'visitor'`, et « 3 J — Member unlocks this » restait cadenasse A VIE.
        // ⭐ Une ligne. Mais ce qui la tient, c'est `test_plages.mjs` §3 ter, qui
        //   FABRIQUE le refus au lieu de l'esperer : le banc d'avant rendait 200
        //   au premier appel, donc n'empruntait jamais ce chemin.
        recevoir(c.c.courbe, { normalisee: true, palier: c.palier });
        return null;
      });
    }).catch(function (e) {
      console.warn('[cadran] ' + uuid + ' : ' + e.message);
    }).then(function () {
      enCours = false;
    });
  }

  charger();

  var TOUS = null, META = null;
  // ⛔ `hote.querySelector`, ET SURTOUT PAS `document.querySelector`.
  //    La version d'origine (lot 104) cherchait dans TOUT le document : sur
  //    une page portant deux cadrans, les deux auraient piloté le MÊME groupe
  //    de boutons, et le second aurait écrasé le premier — sans erreur.
  //    Le groupe vit DANS `.graph-hote`, donc dans ce cadran : on le cherche
  //    là, et nulle part ailleurs.
  var groupe = hote.querySelector('[data-plages]');
  var refus = hote.querySelector('[data-refus]');

  function recevoir(pts, meta) {
    TOUS = pts; META = meta;
    deverrouiller(meta);
    appliquer();
  }

  // 🕰️ LOT 217 — L'ANCRAGE DE LA FENETRE : LA DERNIERE OBSERVATION.
  // ⛔ ET SURTOUT PAS LE DERNIER POINT. C'est la panne que Preda a mesuree le
  // 03/09 sur deux fiches : l'onglet actif disait « 3d » et le graphe tracait
  // 13 jours (Donny) ou CINQ MOIS (ASM #252). Le fichier de prix est
  // append-on-change — le dernier point est le dernier CHANGEMENT, pas le
  // dernier jour. Ancrer dessus etirait la fenetre jusqu'au changement
  // precedent, aussi loin fut-il.
  // ⭐ MEME REGLE QUE `tronquer()` dans `engine/lib/reserve.mjs`, et c'est un
  // invariant : le serveur decoupe pour le PALIER, le client redecoupe pour
  // l'ONGLET. Deux ancrages differents se rattraperaient l'un l'autre sur la
  // plage la plus profonde et ne se verraient jamais sur les autres.
  function ancre() {
    var dernier = TOUS[TOUS.length - 1][0];
    var v = META ? Number(META.vu) : NaN;
    return (isFinite(v) && v > dernier) ? v : dernier;
  }

  function deverrouiller(meta) {
    if (!groupe) return;
    var rangs = (hote.getAttribute('data-paliers') || '').split(',');
    var mien = rangs.indexOf(meta.palier || 'visitor');
    var boutons = groupe.querySelectorAll('button[data-tier]');
    var b, exige, ouvert, premier = null;
    for (b = 0; b < boutons.length; b++) {
      exige = rangs.indexOf(boutons[b].getAttribute('data-tier'));
      ouvert = (mien >= 0 && exige >= 0 && mien >= exige);
      if (ouvert) {
        boutons[b].removeAttribute('data-verrou');
        boutons[b].removeAttribute('title');
        premier = boutons[b];
      }
      boutons[b].setAttribute('aria-pressed', 'false');
    }
    if (premier) premier.setAttribute('aria-pressed', 'true');
    else if (boutons.length) boutons[0].setAttribute('aria-pressed', 'true');
  }

  function bornePressee() {
    if (!groupe) return null;
    var p = groupe.querySelector('button[aria-pressed="true"]');
    if (!p) return null;
    var j = p.getAttribute('data-jours');
    return (j === null || j === '') ? null : parseInt(j, 10);
  }

  function appliquer() {
    if (!TOUS || !TOUS.length) return;
    var jours = bornePressee();
    var vus = TOUS;
    if (jours) {
      var seuil = ancre() - (jours * 86400);
      var dedans = TOUS.filter(function (p) { return p[0] >= seuil; });
      // ⭐⭐⭐ LE POINT QUI PRECEDE LA FENETRE EST LA MOITIE QUI MANQUAIT.
      // L'ancien `filter(>= seuil)` jetait le dernier changement d'AVANT —
      // c'est-a-dire la seule chose qui dise a quel prix la piece etait au
      // debut de la fenetre. La courbe commencait donc au premier changement
      // OBSERVE dans la fenetre, souvent le troisieme ou le sixieme : « la
      // courbe s'arrete avant le dernier releve » a un jumeau au debut.
      // ⭐ On le RECALE sur `seuil` : meme montant, meme nombre d'offres,
      //   date du bord. Ce n'est pas un releve invente, c'est le meme releve
      //   lu a l'instant ou la fenetre s'ouvre — le fichier etant
      //   append-on-change, la source le garantit.
      var avant = null, i;
      for (i = TOUS.length - 1; i >= 0; i--) {
        if (TOUS[i][0] < seuil) { avant = TOUS[i]; break; }
      }
      vus = avant === null ? dedans : [[seuil].concat(avant.slice(1))].concat(dedans);
      // ⛔ L'ANCIEN REPLI `vus = TOUS.slice(-2)` EST PARTI, ET C'ETAIT LUI LE
      //   MENSONGE. Quand la fenetre ne contenait pas deux points, il prenait
      //   les deux derniers QUEL QUE SOIT LEUR AGE : l'onglet disait « 3d » et
      //   le graphe tracait cinq mois, sans qu'aucune erreur ne le dise.
      //   En escalier il n'a plus d'objet — un seul point trace une ligne
      //   PLATE jusqu'a l'observation, ce qui est la reponse exacte.
    }
    dessiner(vus, META, ancre());
  }

  if (groupe) {
    groupe.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('button[data-tier]') : null;
      if (!b || !groupe.contains(b)) return;
      // 🔴🔴 LOT 217 — « cliquer un onglet cadenasse ne fait rien ET NE DIT
      // RIEN » (Preda, 03/09). Le `return` muet etait la, depuis le lot 132.
      // ⭐ ET LE LIBELLE EXISTAIT DEJA, DANS LES CINQ LANGUES : le bouton
      //   porte `title="{palier} l'ouvre"` (`dash.locked`), pose par
      //   `Cadran.astro`. On ne fabrique aucun texte — on cesse de jeter
      //   celui qu'on avait. *Un `title` ne se lit qu'au survol : sur un
      //   telephone, personne ne l'a jamais vu.*
      // ⛔ PAS D'`alert()`, PAS DE REDIRECTION VERS /offre/. Un clic sur un
      //   onglet est une exploration, pas une demande d'achat : on repond a
      //   la question posee (« pourquoi ca ne bouge pas ? ») et on laisse le
      //   lien du teasing faire le reste.
      if (b.hasAttribute('data-verrou')) {
        if (refus) {
          refus.textContent = b.getAttribute('title')
            || hote.getAttribute('data-l-refus') || '';
          refus.hidden = false;
        }
        return;
      }
      if (refus) refus.hidden = true;
      var t = groupe.querySelectorAll('button[data-tier]');
      for (var i = 0; i < t.length; i++) t[i].setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      appliquer();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🔴🔴🔴 LOT 217 — UNE FONCTION EN ESCALIER, PAS UNE INTERPOLATION
  // ═══════════════════════════════════════════════════════════════════════
  // ⭐⭐⭐ « UN PRIX INCHANGE EST UNE DONNEE » (Preda, 03/09). Le trace
  // reliait deux changements par une DIAGONALE : entre le 3 juin a 900 gems
  // et le 12 aout a 1 200, il dessinait une montee reguliere de deux mois qui
  // n'a jamais eu lieu. Le prix a valu 900 jusqu'au 12 aout, puis 1 200.
  // ⛔ Une diagonale sur une donnee append-on-change n'est pas une
  //   simplification graphique : c'est une affirmation fausse sur chaque
  //   point intermediaire, et elle est indiscernable d'une vraie tendance.
  // ⭐ `fin` prolonge le dernier palier jusqu'a la derniere OBSERVATION —
  //   et pas jusqu'a aujourd'hui. Sans observation, on ne sait pas.
  function dessiner(pts, meta, fin) {
    var nf = hote.getAttribute('data-nf') || 'en-GB';
    var df = hote.getAttribute('data-df') || 'en-GB';
    var W = 720, H = 260, pad = { l: 46, r: 18, t: 16, b: 26 };
    var dernierTs = pts[pts.length - 1][0];
    // ⚠️ `fin` N'ELARGIT JAMAIS VERS LE PASSE. S'il est en deca du dernier
    //    point (horloges incoherentes, observation plus vieille que le
    //    changement), on retombe sur le dernier point : il fait foi.
    var xFin = (isFinite(fin) && fin > dernierTs) ? fin : dernierTs;
    var xs = pts.map(function (p) { return p[0]; }).concat([xFin]);
    var ys = pts.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var spanX = (x1 - x0) || 1, spanY = (y1 - y0) || 1;
    var px = function (v) { return pad.l + ((v - x0) / spanX) * (W - pad.l - pad.r); };
    var py = function (v) { return H - pad.b - ((v - y0) / spanY) * (H - pad.t - pad.b); };
    // ⭐ L'ESCALIER : on va d'abord a l'HORIZONTALE jusqu'a la date du
    //   changement (le prix d'avant tient), PUIS a la VERTICALE (il change).
    //   C'est `stepAfter`, et c'est la seule forme fidele a la source.
    // ⛔ LA PROJECTION EST UN PARAMETRE, ET CE N'EST PAS DE LA COQUETTERIE :
    //   la courbe des offres a SON echelle (`pyO`, sol a zero). Un escalier
    //   code en dur sur `py` aurait laisse les offres en diagonale — donc une
    //   seule des deux series aurait dit la verite, sur le meme graphique.
    var escalier = function (val, proj) {
      var out = 'M' + px(pts[0][0]).toFixed(1) + ' ' + proj(val(0)).toFixed(1), i;
      for (i = 1; i < pts.length; i++) {
        out += ' L' + px(pts[i][0]).toFixed(1) + ' ' + proj(val(i - 1)).toFixed(1)
             + ' L' + px(pts[i][0]).toFixed(1) + ' ' + proj(val(i)).toFixed(1);
      }
      // Le palier courant court jusqu'a la derniere observation.
      out += ' L' + px(xFin).toFixed(1) + ' ' + proj(val(pts.length - 1)).toFixed(1);
      return out;
    };
    var d = escalier(function (i) { return pts[i][1]; }, py);
    var aire = d + ' L' + px(x1).toFixed(1) + ' ' + (H - pad.b) + ' L' + px(x0).toFixed(1) + ' ' + (H - pad.b) + ' Z';
    var iHaut = ys.indexOf(y1), iBas = ys.indexOf(y0);
    var nb = function (v) { return v.toLocaleString(nf, { maximumFractionDigits: 2 }); };
    var jour = function (s) { return new Date(s * 1000).toLocaleDateString(df); };

    var g = '';
    [y0, (y0 + y1) / 2, y1].forEach(function (v, k) {
      g += '<line x1="' + pad.l + '" y1="' + py(v).toFixed(1) + '" x2="' + (W - pad.r)
        + '" y2="' + py(v).toFixed(1) + '" class="grille-l"/>'
        + '<text x="' + (pad.l - 8) + '" y="' + (py(v) + 4).toFixed(1)
        + '" class="axe' + (k === 1 ? ' axe--d' : '') + '" text-anchor="end">'
        + (meta.normalisee ? '' : nb(v)) + '</text>';
    });
    [x0, (x0 + x1) / 2, x1].forEach(function (v) {
      g += '<text x="' + px(v).toFixed(1) + '" y="' + (H - 6)
        + '" class="axe axe--d" text-anchor="middle">' + jour(v) + '</text>';
    });
    g += '<path d="' + aire + '" class="aire"/><path d="' + d + '" class="ligne" fill="none"/>';

    // ═══════════════════════════════════════════════════════════════════════
    // 🔢 LA COURBE DES OFFRES — LOT 171 (21/08/2026), point `v` de l'audit
    // ═══════════════════════════════════════════════════════════════════════
    // Preda, 14/08 : « le tableau Floor Price contient les listings » — le
    // TABLEAU les avait, **la COURBE non**.
    //
    // 🔴🔴🔴 ET C'EST ICI QU'ELLE VA, PAS DANS `chart.mjs`.
    // Le premier jet de ce lot l'a ecrite dans `courbeSVG` (engine/lib/chart.mjs).
    // Mesure faite ensuite : **`courbeSVG` n'est appelee par PERSONNE**. La
    // courbe publique a quitte la fiche au lot 123 ; le seul graphique de
    // floor encore rendu est CELUI-CI, dessine ici, cote navigateur, apres
    // `/api/historique/`. Le code aurait ete mort — exactement ce que le
    // lot 123 reprochait au calcul qu'il retirait.
    // ⭐⭐⭐ *Un point herite d'un audit est une observation DATEE : la page a
    // change sous lui.* Il fallait mesurer OU vit le graphique avant d'y
    // ajouter quoi que ce soit.
    //
    // ⭐ LA DONNEE ETAIT DEJA LA, DE BOUT EN BOUT : `reserve.point()` ecrit
    //   `ts,floor,listings` depuis toujours, et `/api/historique/` rend
    //   `p:[[ts, floor, listings], …]`. On ne collecte rien, on ne transporte
    //   rien de plus : **on cesse d'ignorer la troisieme colonne.**
    //   (Le repli `/api/cote/` la porte aussi depuis ce meme lot, cf.
    //   `normaliser()` dans engine/lib/cote.mjs.)
    //
    // ⛔ SON ECHELLE EST LA SIENNE, ET LE SOL EST ZERO. Partager l'echelle du
    //   prix n'aurait aucun sens (des gems contre un compte), et partir du
    //   minimum de la serie transformerait « 4 offres au creux » en
    //   effondrement. ⚠️ Le maximum est ECRIT en haut a droite : une seconde
    //   ligne sans echelle, sur un graphique qui en a une, invite a lire l'une
    //   avec l'autre.
    // ⛔ RIEN N'EST TRACE SI AUCUN POINT NE PORTE D'OFFRE. Une ligne plate a
    //   zero AFFIRMERAIT « il n'y en a jamais eu » la ou la source dit « je ne
    //   sais pas ». ⭐ Le silence est la seule reponse honnete a une absence.
    var offres = pts.map(function (p) {
      var v = Number(p[2]);
      return (isFinite(v) && v > 0) ? v : 0;
    });
    var oMax = Math.max.apply(null, offres);
    if (oMax > 0) {
      var pyO = function (v) { return H - pad.b - (v / oMax) * (H - pad.t - pad.b); };
      var dO = escalier(function (i) { return offres[i]; }, pyO);
      // ⭐⭐ `ligne-offres` EXISTE DEJA DANS LE THEME (theme.css l. 842) et
      //   n'etait utilisee NULLE PART : la regle CSS attendait sa courbe
      //   depuis un lot. On l'emploie telle quelle plutot que d'en ecrire une
      //   seconde. ⛔ Et SANS la classe `.ligne` : celle-ci porte
      //   `stroke-dasharray:var(--len)` et l'animation `trace`, qui se
      //   battraient avec le pointille des offres selon l'ordre des regles.
      g += '<path d="' + dO + '" class="ligne-offres" fill="none"/>';
      // 🔢 LOT 217 — « la legende de la 2e serie est illisible » (Preda,
      // 03/09). Elle etait juste : un texte gris en `axe--d` (opacite .75),
      // colle au bord haut, sans rien qui le relie au pointille qu'il nomme.
      // ⭐ On lui donne son ECHANTILLON — un segment de la MEME classe
      //   `ligne-offres`, donc du meme pointille et de la meme couleur. Le
      //   lecteur n'a plus a deviner laquelle des deux courbes est nommee.
      // ⛔ Aucune classe neuve : `.ligne-offres` et `.axe` existent au theme
      //   (theme.css l. 986 et 990). *Le nom EST le contrat avec le theme.*
      // ⭐ Et il quitte `axe--d` : `.axe` seul est a pleine opacite. Une
      //   legende est du texte a lire, pas une graduation a effleurer.
      // ⛔ LA POSITION DE L'ECHANTILLON SE MESURE, ELLE NE SE DEVINE PAS.
      //   Un decalage en dur (« le texte fait ~96 px ») serait faux des la
      //   premiere traduction : « 12 offres » en francais, « 12 Angebote » en
      //   allemand, et le tiret se poserait au milieu du mot. On le place
      //   APRES insertion, d'apres la largeur REELLE du texte.
      var xLeg = W - pad.r;
      g += '<text x="' + xLeg + '" y="' + (pad.t + 4)
        + '" class="axe" data-leg-txt text-anchor="end">'
        + nb(oMax) + ' ' + (hote.getAttribute('data-l-offres') || '') + '</text>';
      g += '<line class="ligne-offres" data-leg-ech x1="0" y1="' + (pad.t + 0.5)
        + '" x2="0" y2="' + (pad.t + 0.5) + '"/>';
    }
    g += '<circle cx="' + px(pts[iHaut][0]).toFixed(1) + '" cy="' + py(y1).toFixed(1) + '" class="pt-haut"/>';
    g += '<circle cx="' + px(pts[iBas][0]).toFixed(1) + '" cy="' + py(y0).toFixed(1) + '" class="pt-bas"/>';
    g += '<line class="cadran" x1="0" y1="' + pad.t + '" x2="0" y2="' + (H - pad.b) + '" data-curseur/>';
    g += '<circle class="cadran-pt" cx="0" cy="0" data-curseur-pt/>';

    svgHote.innerHTML = '<svg class="graph" viewBox="0 0 ' + W + ' ' + H
      + '" role="img" aria-label="' + (hote.getAttribute('data-l-pts') || '') + '">' + g + '</svg>';
    legende.textContent = meta.h
      ? meta.h.n.toLocaleString(nf) + ' ' + (hote.getAttribute('data-l-pts') || '')
      : '';

    cible.hidden = false;

    var svg = svgHote.querySelector('svg');
    // 🔢 L'echantillon de la legende, cale sur la largeur mesuree du texte.
    // ⚠️ `getComputedTextLength` LEVE si le SVG n'est pas rendu (jsdom du banc,
    //    onglet cache). Un `try` muet est ici la bonne reponse : sans lui, le
    //    graphe entier disparaitrait pour un tiret de 18 px.
    var ech = svg.querySelector('[data-leg-ech]');
    var txt = svg.querySelector('[data-leg-txt]');
    if (ech && txt) {
      try {
        var lgTxt = txt.getComputedTextLength();
        var xd = (W - pad.r) - lgTxt - 8;
        ech.setAttribute('x1', (xd - 18).toFixed(1));
        ech.setAttribute('x2', xd.toFixed(1));
      } catch (e) { ech.parentNode.removeChild(ech); }
    }
    var lig = svg.querySelector('[data-curseur]');
    var ptc = svg.querySelector('[data-curseur-pt]');
    svg.addEventListener('pointermove', function (ev) {
      var b = svg.getBoundingClientRect();
      var vx = ((ev.clientX - b.left) / b.width) * W;
      var t = x0 + ((vx - pad.l) / (W - pad.l - pad.r)) * spanX;
      var best = 0, dist = Infinity;
      for (var i = 0; i < pts.length; i++) {
        var dd = Math.abs(pts[i][0] - t);
        if (dd < dist) { dist = dd; best = i; }
      }
      var p = pts[best];
      lig.setAttribute('x1', px(p[0]).toFixed(1)); lig.setAttribute('x2', px(p[0]).toFixed(1));
      ptc.setAttribute('cx', px(p[0]).toFixed(1)); ptc.setAttribute('cy', py(p[1]).toFixed(1));
      bulle.hidden = false;
      bulle.innerHTML = '<span class="j">' + jour(p[0]) + '</span><b>' + nb(p[1]) + '</b>';
      var rx = (px(p[0]) / W) * b.width;
      bulle.style.left = Math.min(Math.max(rx - 40, 0), b.width - 120) + 'px';
      bulle.style.top = ((py(p[1]) / H) * b.height - 46) + 'px';
    });
    svg.addEventListener('pointerleave', function () { bulle.hidden = true; });
  }
});
})();
