(function () {
// ═══════════════════════════════════════════════════════════════════════════
// LOT 218 — LE COIN DE LA PIECE. Voir l'en-tete de src/components/Corner.astro.
// ═══════════════════════════════════════════════════════════════════════════
var hotes = document.querySelectorAll('[data-corner]');
if (!hotes.length) return;

// Meme premiere ligne que `cadran.js` : sans session, rien ne part sur le
// reseau. Le voile reste, et il dit deja ce qu'il faut.
if (!document.documentElement.hasAttribute('data-membre')) return;

// ⛔ `document.querySelector` serait un bug SANS ERREUR sur une page qui
// porterait deux panneaux : les deux piloteraient le meme corps. On cherche
// DANS l'hote. C'est la lecon du lot 104, deja payee sur le cadran.
hotes.forEach(function (hote) {
  var uuid  = hote.getAttribute('data-corner');
  var corps = hote.querySelector('[data-corner-corps]');
  var etat  = hote.querySelector('[data-corner-etat]');
  var voile = hote.querySelector('[data-corner-voile]');
  var L = function (n) { return hote.getAttribute('data-l-' + n) || ''; };

  var nf = new Intl.NumberFormat(document.documentElement.lang || 'en');
  var n0 = function (v) { return nf.format(Math.round(v)); };
  var pc = function (v) { return (Math.round(v * 10) / 10).toString() + ' %'; };
  var nb = function (v) { var x = Number(v); return isFinite(x) ? x : null; };

  function stat(etiq, valeur) {
    if (valeur === null || valeur === undefined || valeur === '') return null;
    var d = document.createElement('div'); d.className = 'stat';
    var e = document.createElement('div'); e.className = 'etiq'; e.textContent = etiq;
    var v = document.createElement('div'); v.className = 'stat__v'; v.textContent = valeur;
    d.appendChild(e); d.appendChild(v); return d;
  }

  fetch('/api/analytics/corner?uuid=' + encodeURIComponent(uuid), {
    credentials: 'same-origin', headers: { accept: 'application/json' }
  }).then(function (r) {
    // 401/403 : le palier ne suffit pas. ⛔ On ne touche a RIEN — le voile est
    // deja la bonne reponse, et il porte le nom du palier qui ouvre.
    if (r.status === 401 || r.status === 403) return null;
    // 404 : les 0,7 % de pieces sans corner (102 sur 14 090, mesure du 04/09).
    // ⭐⭐ LE BLOC LE DIT AU LIEU DE DISPARAITRE. Un panneau qui s'evapore se
    // lit comme une panne ; « pas de donnee de detention pour cette piece » se
    // lit comme un fait. Deux causes opposees ne partagent pas un signe.
    if (r.status === 404) { ouvrir(); if (etat) etat.textContent = L('absent'); return null; }
    if (!r.ok) { console.warn('[corner] ' + uuid + ' : HTTP ' + r.status); return null; }
    return r.json();
  }).then(function (d) {
    if (!d) return null;
    ouvrir();
    remplir(d);
    // La capitalisation est le SEUL chiffre d'argent du panneau, et il n'est
    // pas dans `corner_full` : il se calcule ici, avec un plancher qui vient
    // d'une route qui lit la session. ⛔ Il ne peut donc jamais etre pre-cuit
    // dans le HTML — c'est l'invariant que `test:fuite` §7 tient.
    return fetch('/api/cote/' + encodeURIComponent(uuid), {
      credentials: 'same-origin', headers: { accept: 'application/json' }
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var f = j && j.ok && j.c ? nb(j.c.floor) : null;
      var circ = nb(d.circulating);
      // ⛔ `f > 0` ET PAS `f != null` : depuis le lot 218 un plancher nul veut
      // dire « inconnu » et non « zero ». Multiplier par lui afficherait une
      // capitalisation de 0 gems sur une piece qui vaut 465 — exactement le
      // defaut que ce meme lot repare vingt lignes plus haut dans dataset.mjs.
      if (f && f > 0 && circ && circ > 0) {
        var m = stat(L('mcap'), n0(f * circ) + ' gems');
        if (m && corps) corps.appendChild(m);
      }
      return null;
    });
  }).catch(function (e) {
    console.warn('[corner] ' + uuid + ' : ' + e.message);
  });

  function ouvrir() {
    hote.removeAttribute('data-verrouille');
    if (voile) voile.hidden = true;
    if (corps) corps.hidden = false;
  }

  function remplir(d) {
    if (!corps) return;
    var circ = nb(d.circulating);

    // ═══════════════════════════════════════════════════════════════════════
    // 🔴🔴🔴 `topN_cnt` N'EST PAS CUMULATIF — MESURE DU 04/09/2026
    // ═══════════════════════════════════════════════════════════════════════
    // Sur `#100 Todd McFarlane Batman` : `top1_cnt` 216 (2,89 % de 7 485) et
    // `top10_cnt` **23** (0,31 %). Le second est PLUS PETIT que le premier.
    // Ce ne sont donc pas des cumuls « le top 10 detient X » : c'est le
    // N-IEME detenteur, un a un.
    // ⭐⭐⭐ AFFICHER `top10_pct` TEL QUEL AURAIT ANNONCE « top 10 : 0,3 % de
    // l'offre » — c'est-a-dire une piece parfaitement repartie — la ou le vrai
    // cumul vaut ~10 %. Un champ se lit par ce qu'il CALCULE, jamais par son
    // nom ; celui-ci en portait un qui affirmait le contraire de sa valeur.
    // ⛔ NE JAMAIS revenir a `d.top10_pct` : la ligne serait plus courte, elle
    //    serait fausse, et elle serait fausse dans le sens rassurant.
    var cum = 0, vus = 0;
    for (var i = 1; i <= 10; i++) {
      var v = nb(d['top' + i + '_cnt']);
      if (v !== null) { cum += v; vus++; }
    }
    var top10 = (vus > 0 && circ && circ > 0) ? (cum / circ) * 100 : null;
    var top1  = nb(d.top1_pct);

    // L'offre DORMANTE. ⭐ Le prefixe decide du sens et il n'est explique nulle
    // part ailleurs : `act_pers_*` compte des PERSONNES, `act_sup_*` compte des
    // PIECES. On veut la part de l'offre immobile, donc `sup`. Prendre `pers`
    // rendrait « part des detenteurs inactifs », une autre question — juste,
    // mais pas celle qu'on pose.
    var dort = 0, aDort = false;
    ['Somnolant', 'Inactif', 'Désinscrit', 'Fantôme'].forEach(function (k) {
      var v = nb(d['act_sup_' + k]);
      if (v !== null) { dort += v; aDort = true; }
    });
    var pctDort = (aDort && circ && circ > 0) ? (dort / circ) * 100 : null;

    // Le profil le plus represente, en PERSONNES (c'est un portrait de la
    // communaute, pas une part d'offre).
    var meilleur = null, score = -1;
    Object.keys(d).forEach(function (k) {
      if (k.indexOf('prof_pers_') !== 0) return;
      var v = nb(d[k]);
      if (v !== null && v > score) { score = v; meilleur = k.slice(10); }
    });

    var g = nb(d.gini);
    [
      stat(L('holders'),  nb(d.holders) !== null ? n0(d.holders) : null),
      // ⭐ Gini sur 0..1 dans la source (0,3457 mesure). On le rend tel quel,
      //   avec deux decimales : le convertir en pourcentage inventerait une
      //   echelle que la donnee ne porte pas.
      stat(L('gini'),     g !== null ? (Math.round(g * 100) / 100).toString() : null),
      stat(L('top1'),     top1 !== null ? pc(top1) : null),
      stat(L('top10'),    top10 !== null ? pc(top10) : null),
      stat(L('dormante'), pctDort !== null ? pc(pctDort) : null),
      stat(L('persona'),  d.activity_dominant || null),
      stat(L('profil'),   meilleur),
      stat(L('repartition'), d.qty_dominant
        ? d.qty_dominant + (nb(d.qty_dominant_pct) !== null ? ' (' + pc(nb(d.qty_dominant_pct)) + ')' : '')
        : null)
    ].forEach(function (n) { if (n) corps.appendChild(n); });
  }
});
})();
