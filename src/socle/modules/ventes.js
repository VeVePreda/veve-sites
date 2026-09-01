(function () {
// ═══════════════════════════════════════════════════════════════════════════
// LE TABLEAU DES DERNIERES VENTES — lot 211
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ MODULE DE COMPOSANT, PAS MORCEAU DE SOCLE, et c'est une mesure. Ce code
// ne sert que sur une FICHE. Le verser a `src/socle/*.js` le ferait telecharger
// par les pages de rayon, l'accueil et les 5 pages editoriales, qui n'ont aucun
// `[data-ventes]` a remplir — on aurait deplace le gaspillage au lieu de le
// supprimer. C'est l'arbitrage de `cadran.js` (lot 45), mot pour mot.
//
// ⭐⭐⭐ ET LE DECLENCHEUR EST LE MEME QUE `60-cote.js` : le cookie `vp_membre`.
// Il ne porte que « 1 », il n'accorde AUCUN droit, il est falsifiable a la
// main — et ca n'a aucune importance : le seul juge du palier est la route, qui
// lit `vp_session` (HttpOnly) cote serveur. Le poser a la main ne fait que
// declencher un appel qui se fera refuser exactement comme avant.
// ⛔ Le jour ou ce cookie deciderait d'un CONTENU, il faudrait le signer. Ici
// il ne decide que d'un APPEL — la nuance est tout le dispositif.
var hote = document.querySelector('[data-ventes]');
if (!hote) return;
if (!/(?:^|;\s*)vp_membre=1(?:;|$)/.test(document.cookie || '')) return;

var uuid = hote.getAttribute('data-ventes');
if (!uuid) return;

// ⚠️ CE MODULE N'ECRIT AUCUN TEXTE, ET IL N'A MEME PAS BESOIN D'EN RECEVOIR.
// Les en-tetes du tableau sont rendus par le GABARIT, au build, dans la langue
// de la page : ils sont deja dans le HTML quand ce code s'execute. Il n'y a
// donc ni libelle en dur ici (panne P30 du lot 139) ni `data-l-*` a relire —
// la seule facon de n'avoir aucun probleme de traduction est de n'avoir aucun
// texte a traduire.
// ⛔ SEULE EXCEPTION, ET ELLE EST NOMMEE : « VeVe » et « StackR » sont des noms
// propres de marches. Ils ne se traduisent dans aucune langue.
var nf = document.documentElement.getAttribute('data-nf') || 'en-GB';
var corps = hote.querySelector('[data-ventes-corps]');
var voile = hote.querySelector('[data-ventes-voile]');
var trame = hote.querySelector('[data-ventes-trame]');
// ⚠️ LE FOND FLOUTE DOIT SE DEFLOUTER, ET C'EST UN PIEGE A UN SEUL SENS.
// `.verrou__fond` porte `filter: blur() saturate(.42); opacity:.34`. Retirer le
// voile sans retirer cette classe rendrait le VRAI tableau flou et a 34 %
// d'opacite — lisible pour personne, sur un membre qui a paye, sans la moindre
// erreur. Le defaut ne se verrait qu'a l'oeil, et seulement chez les abonnes.
var fond = hote.querySelector('[data-ventes-fond]');
if (!corps) return;

fetch('/api/ventes/' + encodeURIComponent(uuid), {
  credentials: 'same-origin', headers: { accept: 'application/json' }
}).then(function (r) {
  // ⛔ ON NE DEGRADE PAS EN SILENCE, ET ON NE CRIE PAS NON PLUS — meme partage
  // qu'a `60-cote.js`, pour les memes raisons :
  //   · 401/403 : la personne n'a pas le palier. Le verrou EST la bonne
  //     reponse, il est deja dans la page, il n'y a rien a dire.
  //   · 404 : ANORMAL ICI, et c'est nouveau. Le bloc n'est emis que si
  //     `item.nVentes > 0` — un 404 veut donc dire que `.reserve/ventes/` n'a
  //     pas ete copie dans l'image, et que TOUTES les fiches sont muettes pour
  //     les seuls membres, sur un deploiement vert. Ca, il faut le tracer.
  //   · 5xx : la donnee est due et n'arrive pas. Idem.
  if (r.status === 401 || r.status === 403) return null;
  if (!r.ok) { console.warn('[ventes] HTTP ' + r.status + ' sur ' + uuid); return null; }
  return r.json();
}).then(function (j) {
  if (!j || !j.ok || !j.v || !j.v.length) return;

  // 🔑 ON S'INDEXE SUR `champs`, JAMAIS SUR DES POSITIONS EN DUR.
  // Chaque vente est un tableau positionnel — 8 429 lignes x 7 clefs repetees
  // seraient ~350 Ko de noms de champs pour zero information. Mais un tableau
  // positionnel se decale en SILENCE : un champ insere au milieu ferait
  // afficher un prix a la place d'une edition, sans erreur, puisque les deux
  // sont des nombres. La route envoie l'ordre avec la donnee ; on le lit.
  // ⛔ Ecrire `v[2]` pour le prix ici serait la faute que ce contrat existe
  // pour rendre impossible.
  var c = j.champs || [];
  var iTs = c.indexOf('ts'), iEd = c.indexOf('edition'), iUsd = c.indexOf('usd');
  var iOmi = c.indexOf('omi'), iMar = c.indexOf('marche');
  var iVen = c.indexOf('vendeur'), iAch = c.indexOf('acheteur');
  // ⚠️ UN CONTRAT ROMPU SE TAIT, IL NE DEVINE PAS. Si la route cesse d'annoncer
  // un champ, remplir le tableau avec ce qui reste afficherait des colonnes
  // decalees — un mensonge silencieux. Mieux vaut le verrou intact et une
  // trace : l'etat « je ne sais pas lire » ressemble alors a « je n'ai pas le
  // droit », ce qui est faux mais INOFFENSIF, et la console dit la verite.
  if (iTs < 0 || iUsd < 0 || iOmi < 0 || iMar < 0) {
    console.warn('[ventes] contrat inattendu : ' + c.join(','));
    return;
  }

  var dtf;
  try { dtf = new Intl.DateTimeFormat(nf, { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch (e) { dtf = null; }

  var frag = document.createDocumentFragment();
  for (var k = 0; k < j.v.length; k++) {
    var v = j.v[k];
    var tr = document.createElement('tr');

    // ⏱️ EPOCH EN SECONDES — meme convention que la reserve d'historique, des
    // deux cotes. Multiplier par 1000 ici et nulle part ailleurs.
    var d = new Date(Number(v[iTs]) * 1000);
    tr.appendChild(td(dtf && isFinite(d.getTime()) ? dtf.format(d) : '—'));

    // ⚠️ `0` VEUT DIRE « ABSENT », JAMAIS « ZERO ». C'est le prix a payer pour
    // un tableau positionnel, et il se paie a CHAQUE lecture : une edition 0
    // n'existe pas, un prix 0 n'est pas une vente a zero dollar.
    var ed = Number(v[iEd]) || 0;
    tr.appendChild(td(ed ? '#' + nb(ed, 0) : '—', 'n'));

    // 💵 LE DOLLAR D'ABORD — arbitrage Preda du 29/08. `usd` est vide sur une
    // vente StackR dont le jour n'a pas de cours ; `omi` est vide sur TOUTE
    // vente du marche VeVe, payee en gems. On affiche ce qu'on a.
    // ⛔ ON NE FABRIQUE JAMAIS L'AUTRE. Convertir un OMI en dollar avec le
    // cours du jour COURANT donnerait un montant faux pour une vente d'il y a
    // trois mois — et 273 ventes appariees ont montre un rapport $/OMI qui
    // varie de x4,2. La conversion honnete est faite en amont, au cours du JOUR
    // DE LA VENTE, ou elle n'est pas faite du tout.
    var usd = Number(v[iUsd]) || 0, omi = Number(v[iOmi]) || 0;
    tr.appendChild(td(usd ? '$' + nb(usd, 2) : (omi ? nb(omi, 2) + ' OMI' : '—'), 'n'));

    // 🏷️ 0 = VeVe, 1 = StackR. Deux marches, deux couleurs deja au theme
    // (`--gems` cyan, `--omi` rouge) : la classe suffit, aucun style en ligne.
    var st = Number(v[iMar]) === 1;
    var tdm = td(st ? 'StackR' : 'VeVe');
    tdm.setAttribute('data-marche', st ? '1' : '0');
    tr.appendChild(tdm);

    // 🧑 PSEUDO QUAND ON L'A, ADRESSE SINON — sa demande du 29/08. Le repli est
    // la REGLE sur un marche et l'EXCEPTION sur l'autre : StackR rend un pseudo
    // dans 100 % des cas, VeVe dans 18 % / 9 %. Le module ne choisit rien : il
    // affiche la chaine que la source a fournie, quelle qu'en soit la nature.
    tr.appendChild(td((v[iVen] || '—') + ' → ' + (v[iAch] || '—'), 'qui'));

    frag.appendChild(tr);
  }

  corps.appendChild(frag);
  // ⭐ LE VERROU PART EN DERNIER, UNE FOIS LE TABLEAU REELLEMENT PEUPLE.
  // Le retirer avant le `fetch` — ou meme avant cette boucle — laisserait une
  // fraction de seconde de tableau vide en clair, et un echec a mi-parcours
  // laisserait un bloc ouvert et VIDE : « aucune vente » affiche a la place de
  // « je n'ai pas pu ». Deux causes opposees ne partagent pas un signe.
  if (voile) voile.remove();
  if (trame) trame.remove();
  if (fond) fond.classList.remove('verrou__fond');
  hote.removeAttribute('data-verrouille');
}).catch(function (e) { console.warn('[ventes] ' + e.message); });

function nb(x, dec) {
  return Number(x).toLocaleString(nf, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function td(texte, classe) {
  var e = document.createElement('td');
  // ⛔ `textContent`, JAMAIS `innerHTML`. `vendeur` et `acheteur` viennent d'une
  // source tierce (StackR) : un pseudo peut contenir n'importe quoi. Le contenu
  // de ce tableau n'est pas du balisage, et rien ne doit pouvoir le devenir.
  e.textContent = texte;
  if (classe) e.className = classe;
  return e;
}
})();
