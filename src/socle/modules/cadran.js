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
      if (j && j.ok && j.h && j.h.p && j.h.p.length >= 2) { recevoir(j.h.p, j); return null; }
      return fetch('/api/cote/' + encodeURIComponent(uuid), {
        credentials: 'same-origin', headers: { accept: 'application/json' }
      }).then(function (r) { return r.ok ? r.json() : null; }).then(function (c) {
        if (!c || !c.ok || !c.c || !c.c.courbe || c.c.courbe.length < 2) return null;
        recevoir(c.c.courbe, { normalisee: true });
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

  function recevoir(pts, meta) {
    TOUS = pts; META = meta;
    deverrouiller(meta);
    appliquer();
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
    if (!TOUS || TOUS.length < 2) return;
    var jours = bornePressee();
    var vus = TOUS;
    if (jours) {
      var fin = TOUS[TOUS.length - 1][0];
      var seuil = fin - (jours * 86400);
      vus = TOUS.filter(function (p) { return p[0] >= seuil; });
      if (vus.length < 2) vus = TOUS.slice(-2);
    }
    dessiner(vus, META);
  }

  if (groupe) {
    groupe.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('button[data-tier]') : null;
      if (!b || !groupe.contains(b)) return;
      if (b.hasAttribute('data-verrou')) return;
      var t = groupe.querySelectorAll('button[data-tier]');
      for (var i = 0; i < t.length; i++) t[i].setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      appliquer();
    });
  }

  function dessiner(pts, meta) {
    var nf = hote.getAttribute('data-nf') || 'en-GB';
    var df = hote.getAttribute('data-df') || 'en-GB';
    var W = 720, H = 260, pad = { l: 46, r: 18, t: 16, b: 26 };
    var xs = pts.map(function (p) { return p[0]; });
    var ys = pts.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var spanX = (x1 - x0) || 1, spanY = (y1 - y0) || 1;
    var px = function (v) { return pad.l + ((v - x0) / spanX) * (W - pad.l - pad.r); };
    var py = function (v) { return H - pad.b - ((v - y0) / spanY) * (H - pad.t - pad.b); };
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + px(p[0]).toFixed(1) + ' ' + py(p[1]).toFixed(1); }).join(' ');
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
