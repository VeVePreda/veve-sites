(function () {
// ═══════════════════════════════════════════════════════════════════════════
// LE REMPLISSAGE DES COTES — lot 101
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ IL EST DANS LE GABARIT DE BASE, ET PAS DANS <Cote>, POUR UNE RAISON
// MESUREE : une page de liste porte jusqu'a 40 emplacements. Un script par
// composant, ce serait 40 copies du meme code dans le HTML — et 40 appels
// reseau la ou UN suffit.
//
// ⭐⭐⭐ LE DECLENCHEUR EST LE COOKIE `vp_membre`, ET C'EST EXACTEMENT CE
// POUR QUOI IL A ETE ECRIT (lot 97). Il ne porte que « 1 », il n'accorde
// AUCUN droit, il est falsifiable a la main — et ca n'a aucune importance :
// le seul juge du palier est la route, qui lit `vp_session` (HttpOnly) cote
// serveur. Le poser a la main ne fait que declencher un appel qui se fera
// refuser exactement comme avant.
// ⛔ Le jour ou ce cookie deciderait d'un CONTENU, il faudrait le signer.
//    Ici il ne decide que d'un APPEL — la nuance est tout le dispositif.
//
// ⭐ Et il evite de reveiller Node pour les 8 500 pages visitees par des gens
// qui n'ont pas de compte : sans cookie, ce script ne fait rien du tout.
var membre = /(?:^|;\s*)vp_membre=1(?:;|$)/.test(document.cookie || '');
if (!membre) return;

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 LOT 155 — CE REMPLISSAGE DEVIENT RAPPELABLE, ET C'ETAIT LA SEULE FACON
// ═══════════════════════════════════════════════════════════════════════════
// Ce script ne tournait QU'UNE FOIS, au chargement, sur les `[data-cote]`
// presents a cet instant. La barre de filtres du lot 155 PEINT des lignes apres
// coup : sans point d'entree, leurs badges ATL/ATH resteraient cadenasses pour
// une raison FAUSSE — « je ne montre pas » la ou la verite est « on n'a pas
// encore demande ». Un cadenas qui ment est pire qu'un tiret nu (cf. Cote.astro).
// ⭐⭐ ET SURTOUT : ON N'ECRIT PAS UN SECOND APPELANT DE `/api/cote/lot`.
// Le pilote du rayon aurait pu faire son propre `fetch` — ce serait la deuxieme
// implementation du meme echange, donc la deuxieme a maintenir, avec son propre
// plafond de 60, sa propre lecture du 401 et son propre format de nombre. C'est
// exactement la faute « deux gabarits qui rendent la meme liste », transposee a
// un appel reseau. ⇒ UN SEUL remplisseur, expose, appele par qui peint.
// ⛔ `window.vpCote` et pas un evenement : un evenement se poste dans le vide si
// personne n'ecoute, et on ne le sait jamais. Un appel a une fonction absente
// leve — et `rayon.js` teste sa presence AVANT (il peut tourner sur un site sans
// porte des prix, ou ce fichier n'est pas embarque : voir CONDITIONS dans
// socle_js.mjs). *La condition voyage avec le code, ou elle disparait.*
window.vpCote = remplir;

remplir(document);

function remplir(racine) {
var places = (racine || document).querySelectorAll('[data-cote]:not([data-ouverte])');
if (!places.length) return;

var uuids = [];
var vus = {};
for (var i = 0; i < places.length; i++) {
  var u = places[i].getAttribute('data-cote');
  if (u && !vus[u]) { vus[u] = 1; uuids.push(u); }
}
// ⚠️ MEME PLAFOND QUE LA ROUTE (MAX_LOT = 60). Le dupliquer ici est un choix :
// demander 200 uuid pour n'en recevoir que 60 laisserait 140 emplacements
// vides sans qu'aucune erreur ne le dise. On tronque en connaissance de cause.
if (uuids.length > 60) uuids = uuids.slice(0, 60);

var nf = document.documentElement.getAttribute('data-nf') || 'en-GB';
function nb(v) {
  if (v === null || v === undefined || !isFinite(v)) return null;
  return Number(v).toLocaleString(nf, { maximumFractionDigits: 2 });
}

fetch('/api/cote/lot?u=' + uuids.join(','), {
  credentials: 'same-origin', headers: { accept: 'application/json' }
}).then(function (r) {
  // ⛔ ON NE DEGRADE PAS EN SILENCE, ET ON NE CRIE PAS NON PLUS. 401/403 :
  // le tiret est la BONNE reponse, la personne n'a simplement pas le palier —
  // rien a dire. 404/500 : la donnee est due et n'arrive pas, et une reserve
  // non copiee dans l'image rendrait TOUTES les fiches muettes pour les
  // seuls abonnes, avec un deploiement vert. La, il faut une trace.
  if (r.status === 401 || r.status === 403) return null;
  if (!r.ok) { console.warn('[cote] HTTP ' + r.status); return null; }
  return r.json();
}).then(function (j) {
  if (!j || !j.ok || !j.c) return;
  // 💱 LOT 181 — le cours du jour, s'il en est venu un. Voir `lot.js` : la clé
  //    est ABSENTE quand il n'y a pas de cours frais, jamais `null`.
  var taux = (j.taux && isFinite(j.taux.omiUsd) && j.taux.omiUsd > 0) ? j.taux.omiUsd : 0;
  for (var k = 0; k < places.length; k++) {
    var el = places[k];
    var c = j.c[el.getAttribute('data-cote')];
    if (!c) continue;
    var champ = el.getAttribute('data-champ');
    var brut = c[champ];
    var v = nb(brut);
    if (v === null) continue;
    var cible = el.querySelector('[data-cote-v]') || el;
    cible.textContent = v;
    el.setAttribute('data-ouverte', '1');
    el.removeAttribute('title');
    // ═══════════════════════════════════════════════════════════════════════
    // 💱 L'ÉQUIVALENT EN DOLLARS DU PLANCHER STACKR — point 156 de sa liste
    // ═══════════════════════════════════════════════════════════════════════
    // ⭐⭐⭐ IL SE CALCULE ICI, ET IL NE POUVAIT SE CALCULER NULLE PART
    // AILLEURS. `floorStackr` est dans `CHAMPS_COTE` : à l'instant où la fiche
    // est rendue, le champ n'existe DÉJÀ PLUS sur l'objet public
    // (`projeter()`, cote.mjs). Le multiplier côté serveur aurait demandé de
    // le garder — c'est-à-dire de rouvrir la fuite du lot 101 par la porte
    // d'à côté, avec un montant exact déductible d'une division. Le montant
    // n'existe que dans CE navigateur, après CETTE réponse, pour quelqu'un qui
    // a franchi la porte. ⛔ Ne jamais remonter ce calcul dans le gabarit.
    //
    // ⛔ `champ === 'floorStackr'` ET RIEN D'AUTRE. `floor`, `ath`, `atl` sont
    // en GEMS chez VeVe — leur appliquer un cours OMI serait exactement la
    // conversion entre deux MARCHÉS que trois commentaires de ce dépôt
    // interdisent (rapport non constant, médiane 4 423). Une garde sur le nom
    // du champ, pas sur la présence du taux.
    if (champ !== 'floorStackr' || !taux) continue;
    var eq = document.querySelector('[data-omi-usd="' + el.getAttribute('data-cote') + '"]');
    if (!eq) continue;
    var usd = Number(brut) * taux;
    if (!isFinite(usd) || usd <= 0) continue;
    // ⭐ « ≈ » EST LA MOITIÉ DU MESSAGE. Le plancher a été relevé à une heure,
    //   le cours à une autre : le produit est un ORDRE DE GRANDEUR, et le dire
    //   coûte un caractère. Un montant exact au centime affirmerait une
    //   précision que ni l'une ni l'autre des deux observations ne porte.
    // ⭐ Le gabarit a écrit le modèle (« ≈ $%s ») dans `data-omi-modele` : la
    //   traduction reste dans les dictionnaires, ce script ne connaît aucun
    //   texte. ⛔ Ne jamais coder « $ » en dur ici.
    var modele = eq.getAttribute('data-omi-modele') || '≈ $%s';
    eq.textContent = modele.replace('%s',
      usd.toLocaleString(nf, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    eq.removeAttribute('hidden');
  }
}).catch(function (e) { console.warn('[cote] ' + e.message); });
}
})();
