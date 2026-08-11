// ⚠️ VeVePreda/veve-sites — src/socle/modules/series.js   (FICHIER NEUF — lot 139)
// ═══════════════════════════════════════════════════════════════════════════
//  LE PILOTE DE `/sets/` — FILTRER, TRIER, COMPTER, ET **TRANCHER**
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 POURQUOI IL A DÉMÉNAGÉ, ET CE N'EST PAS UNE OPTIMISATION.
// Il vivait `<script is:inline>` dans `Collections.astro`, et il ne marchait
// pas. Mesuré sur le HTML de production du 11/08 :
//
//     #s-grille          écrit à l'octet  104 306
//     le <script>        écrit à l'octet  887 140   ← il cherche #s-plus
//     <button id=s-plus> écrit à l'octet  891 075   ← pas encore analysé
//
// Un `<script>` en ligne NON DIFFÉRÉ s'exécute **au moment où l'analyseur
// l'atteint**. À cet instant le bouton « voir plus » n'existe pas encore :
// `getElementById('s-plus')` rend `null`, donc `pas = 0`, donc
// `montre = pas || 1e9` vaut **un milliard**, donc **aucune carte n'est
// cachée**. La page annonçait 60 tuiles et en montrait **910**.
//
// ⭐⭐⭐ ET `test:series` ÉTAIT VERT PENDANT TROIS JOURS. Il monte le HTML
// **entier** dans un DOM **puis** exécute le pilote : il ne peut
// structurellement pas voir un défaut d'ORDRE DE PARSE. Il avait « raison »
// sur un DOM que personne ne reçoit. *Un banc peut être vert pour une mauvaise
// raison — branché sur quoi, depuis quand, et sur quel ÉTAT du DOM ?*
//
// 🩹 ⛔ NI DÉPLACER LE `<script>` APRÈS LE BOUTON, NI L'ENVELOPPER DANS
// `DOMContentLoaded` : les deux marchent, et les deux laissent **8 788 octets
// de pilote en ligne** sur une page qui en pèse déjà 899 000, retéléchargés à
// chaque visite. Le socle, lui, est servi en `<script defer src>` avec une
// empreinte dans son nom, donc mis en cache trente jours.
// ⭐ `defer` attend la fin de l'analyse **par construction** : l'ordre cesse
// d'être un pari sur la position du script dans le document.
// ⇒ Une seule correction ferme le défaut d'ordre **et** allège la page.
//
// ⛔ AUCUNE LIGNE DE CE PILOTE N'A CHANGÉ. Le déplacement doit être prouvable
// à l'identique : si le comportement bougeait en même temps que l'adresse, on
// ne saurait plus lequel des deux a réparé quoi.

// ⭐ MÊME PILOTE QUE LE MARCHÉ, EN PLUS COURT : filtrer, trier, compter,
// écrire des jetons. ⛔ Pas de mémorisation ici — une page de parcours se
// rouvre pour tout revoir, pas pour retrouver un filtre d'il y a trois
// jours. Le Marché, lui, est un poste de travail : il mémorise.
(function () {
  var f = document.getElementById('f-sets'); if (!f) return;
  // 🔴 LOT 115b — la recherche DANS la liste des marques.
  // ⭐ Elle ne touche ni aux cases cochées ni à la grille : elle masque des
  //   étiquettes, rien de plus. `hidden` et pas une classe — une étiquette
  //   masquée doit sortir de l'ordre de tabulation, sinon on tabule dans
  //   quarante cases invisibles.
  (function () {
    var q = document.getElementById('s-bq');
    var hote = document.getElementById('s-brands');
    var vide = document.getElementById('s-bq-vide');
    if (!q || !hote) return;
    var etiquettes = hote.querySelectorAll('[data-b]');
    q.addEventListener('input', function () {
      var t = q.value.trim().toLowerCase();
      var n = 0;
      etiquettes.forEach(function (el) {
        var on = !t || el.getAttribute('data-b').indexOf(t) !== -1;
        el.hidden = !on;
        if (on) n++;
      });
      if (vide) vide.hidden = n > 0;
    });
  })();
  // 🆕 LOT 133 — LE PANNEAU LICENCE N'A PAS DE CHAMP DE RECHERCHE, ET C'EST
  // UNE DÉCISION MESURÉE : 96 licences tiennent à l'écran, 1 492 marques
  // non. ⛔ Ajouter un champ « par symétrie » aurait posé un contrôle que
  // personne n'utilise sur une liste qu'on parcourt à l'œil — et il aurait
  // fallu le maintenir. *Deux listes de nature différente n'ont pas droit
  // au même habillage sous prétexte qu'elles se ressemblent.*
  var G = document.getElementById('s-grille');
  var C = [].slice.call(G.querySelectorAll('.col-carte'));
  var cpt = document.getElementById('s-cpt'), vide = document.getElementById('s-vide');
  var corpus = '';
  function num(v){ var n = parseInt(v, 10); return isNaN(n) ? null : n; }
  function val(id){ var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function coches(nom){
    return [].slice.call(f.querySelectorAll('input[name="' + nom + '"]:checked')).map(function(x){ return x.value; });
  }
  function etat(){
    return { q:(val('s-q')||'').toLowerCase(), corpus:corpus, tri:val('s-tri')||'taille',
             brands:coches('s-brand'), lics:coches('s-lic'),
             a1:num(val('s-a1')), a2:num(val('s-a2')),
             tmin:num(val('s-tmin')), tmax:num(val('s-tmax')) };
  }
  // ⚠️ Un set SANS année connue traverse les bornes d'année : l'absence
  // n'est pas une date ancienne. Même règle que le Marché.
  function garde(e, x){
    var d = x.dataset;
    if (e.q && d.n.indexOf(e.q) === -1) return false;
    if (e.corpus && d.ty !== e.corpus) return false;
    if (e.brands.length && e.brands.indexOf(d.brand) === -1) return false;
    // 🆕 LOT 133 — la licence. ⚠️ `d.lic` est ce que `CarteSet.astro` a
    //    ÉMIS ; il n'est pas recalculé ici. Un filtre qui redérive son axe
    //    depuis le nom du set aurait divergé de la carte au premier set dont
    //    la licence majoritaire n'est pas celle de sa première pièce.
    if (e.lics.length && e.lics.indexOf(d.lic) === -1) return false;
    if (d.an) {
      if (e.a1 !== null && parseInt(d.an, 10) < e.a1) return false;
      if (e.a2 !== null && parseInt(d.an, 10) > e.a2) return false;
    }
    var tl = parseInt(d.taille, 10);
    if (e.tmin !== null && tl < e.tmin) return false;
    if (e.tmax !== null && tl > e.tmax) return false;
    return true;
  }
  var ORDRE = {
    taille: function(a,b){ return parseInt(b.dataset.taille,10) - parseInt(a.dataset.taille,10); },
    annee:  function(a,b){ return (b.dataset.an || '').localeCompare(a.dataset.an || ''); },
    nom:    function(a,b){ return a.dataset.n.localeCompare(b.dataset.n); },
    // 🆕 LOT 133 — TRI PAR LICENCE, et il a un SECOND critère.
    // ⛔ Trier sur la seule licence laisserait les 2 986 sets Marvel dans
    //    l'ordre où le DOM les a rendus, c'est-à-dire dans l'ordre du tri
    //    PRÉCÉDENT : la page changerait d'aspect selon d'où l'on vient, sans
    //    que rien ne l'explique. Un tri instable se lit comme un bug.
    // ⭐ À licence égale, on retombe donc sur la taille décroissante — le tri
    //    par défaut de cette page, donc celui qu'on connaît déjà.
    licence: function(a,b){
      var d = (a.dataset.lic || '').localeCompare(b.dataset.lic || '');
      return d !== 0 ? d : (parseInt(b.dataset.taille,10) - parseInt(a.dataset.taille,10));
    }
  };
  var bPlus = document.getElementById('s-plus');
  var cPlus = document.getElementById('s-plus-cpt');
  var pas = bPlus ? parseInt(bPlus.dataset.pas, 10) : 0;
  var montre = pas || 1e9;
  function appliquer(){
    var e = etat(), vis = [];
    C.forEach(function(x){ var ok = garde(e, x); x.hidden = !ok; if (ok) vis.push(x); });
    vis.sort(ORDRE[e.tri] || ORDRE.taille);
    vis.forEach(function(x){ G.appendChild(x); });
    // ⭐ La tranche s'applique APRÈS le filtre et le tri : « voir plus » ne
    // doit jamais révéler une carte que le filtre a écartée.
    if (bPlus) {
      for (var k = 0; k < vis.length; k++) vis[k].hidden = k >= montre;
      bPlus.hidden = vis.length <= montre;
      cPlus.textContent = Math.min(montre, vis.length) + ' / ' + vis.length;
    }
    cpt.textContent = vis.length + ' / ' + C.length;
    vide.hidden = vis.length !== 0;
    var j = document.getElementById('s-actifs'); j.innerHTML = '';
    function jeton(txt, retirer){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'jeton';
      b.innerHTML = txt + ' <span aria-hidden="true">×</span>';
      b.setAttribute('aria-label', b.textContent);
      b.onclick = function(){ retirer(); appliquer(); };
      j.appendChild(b);
    }
    e.brands.forEach(function(v){ jeton(v, function(){ var c = f.querySelector('input[name=s-brand][value="' + v + '"]'); if (c) c.checked = false; }); });
    e.lics.forEach(function(v){ jeton(v, function(){ var c = f.querySelector('input[name=s-lic][value="' + v + '"]'); if (c) c.checked = false; }); });
    [['s-a1', e.a1], ['s-a2', e.a2], ['s-tmin', e.tmin], ['s-tmax', e.tmax]].forEach(function(pr){
      if (pr[1] === null) return;
      var ch = document.getElementById(pr[0]);
      var et = ch && ch.parentNode.querySelector('.etiq');
      jeton((et ? et.textContent + ' ' : '') + pr[1], function(){ ch.value = ''; });
    });
    var par = { licence: e.lics.length, marque: e.brands.length,
                annee: (e.a1 !== null) + (e.a2 !== null),
                taille: (e.tmin !== null) + (e.tmax !== null) };
    [].slice.call(f.querySelectorAll('.f-b[data-g]')).forEach(function(b){
      var c = b.querySelector('.cpt-f'); if (!c) return;
      var v = par[b.dataset.g] || 0; c.textContent = v; c.hidden = !v;
    });
  }
  [].slice.call(f.querySelectorAll('[data-corpus]')).forEach(function(b){
    b.addEventListener('click', function(){
      corpus = b.dataset.corpus;
      [].slice.call(f.querySelectorAll('[data-corpus]')).forEach(function(o){ o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      appliquer();
    });
  });
  var boutons = [].slice.call(f.querySelectorAll('.f-b[data-g]'));
  boutons.forEach(function(b){
    var pan = document.getElementById('sp-' + b.dataset.g); if (!pan) return;
    b.addEventListener('click', function(){
      var ouvrir = pan.hidden;
      boutons.forEach(function(o){ var p2 = document.getElementById('sp-' + o.dataset.g);
        if (p2) p2.hidden = true; o.setAttribute('aria-expanded', 'false'); });
      pan.hidden = !ouvrir; b.setAttribute('aria-expanded', String(ouvrir));
    });
  });
  if (bPlus) bPlus.addEventListener('click', function(){ montre += pas; appliquer(); });
  // ⛔ Changer de filtre revient à la première tranche : sinon « 300 / 12 ».
  f.addEventListener('input',  function(){ montre = pas || 1e9; appliquer(); });
  f.addEventListener('change', function(){ montre = pas || 1e9; appliquer(); });
  f.addEventListener('reset',  function(){ setTimeout(function(){ corpus = ''; montre = pas || 1e9; appliquer(); }, 0); });
  appliquer();
})();
