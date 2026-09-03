// ⚠️ VeVePreda/veve-sites — src/socle/modules/alerte_fiche.js  (NEUF — lot 215-B)
// ═══════════════════════════════════════════════════════════════════════════
// LE PANNEAU « SURVEILLER CE PRIX » — sur la fiche, et il ne fabrique rien
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚖️ ARBITRAGES PREDA DU 03/09, tranchés sur `maquette-lot215b-bouton-fiche.html` :
//   ① **les DEUX sens** — « sous » et « au-dessus de » ;
//   ② quand une alerte existe déjà : **un simple rappel**, et on va sur
//      `/alertes/reglages/` pour changer ou retirer ;
//   ③ le libellé est **« Surveiller ce prix »**, jamais « Me prévenir ».
//      ⭐ Le mot compte : rien n'est envoyé (arbitrage ④ du 03/09, aucune
//      notification). *Un bouton qui promet un message qui n'arrivera pas est
//      un mensonge que personne ne relit.*
//
// ⭐⭐⭐ TOUTES LES FACES DU PANNEAU SONT RENDUES PAR LE SERVEUR, `hidden`.
// Ce fichier n'écrit AUCUN libellé : il montre une face et en cache d'autres.
// ⛔ Le motif inverse — un panneau vide qu'un script remplit — donnerait un
// écran blanc quand le script ne charge pas, et ses textes échapperaient à
// `marquer:i18n` (qui lit le HTML servi, pas le JavaScript). Les cinq langues
// s'en iraient sans qu'aucun banc ne le dise.
//
// ⛔⛔ ET AUCUN PRIX N'EST RENDU PAR LE SERVEUR. La fiche est un FICHIER
// STATIQUE, identique pour tout le monde, robots compris : y écrire le plancher
// du jour — même comme simple suggestion dans le champ — mettrait un montant
// réservé dans 8 484 fichiers publics. C'est le mur du lot 101, et c'est
// pourquoi le champ part VIDE et que le seuil déjà posé est écrit ICI, à
// l'exécution, à partir de la réponse d'une route qui, elle, lit la session.
//
// ⚠️ IL PASSE PAR `window.vpAlertes` ET N'OUVRE AUCUN `fetch`. C'est l'accès
// unique de `src/socle/45-alertes.js` — la règle du lot 140-1 : deux appelants
// finissent par traiter le 401 différemment. Le socle est dans le `<head>`,
// donc déjà exécuté quand ce module démarre ; l'ordre du document le garantit.

(function () {
  var hote = document.querySelector('[data-alerte]');
  if (!hote) return;                       // ⭐ le filtre d'existence d'abord

  var uuid = hote.getAttribute('data-alerte');
  var bouton = hote.querySelector('[data-bascule]');
  var panneau = hote.querySelector('[data-panneau]');
  if (!uuid || !bouton || !panneau) return;

  var faces = {};
  var tousLesNoeuds = panneau.querySelectorAll('[data-face]');
  for (var i = 0; i < tousLesNoeuds.length; i += 1) {
    faces[tousLesNoeuds[i].getAttribute('data-face')] = tousLesNoeuds[i];
  }

  /** Montre UNE face, cache les autres. ⭐ `hidden` et pas `display:none` en
   *  ligne : l'attribut est lisible par les technologies d'assistance et par un
   *  banc, une propriété calculée ne l'est ni par l'un ni par l'autre. */
  function montrer(nom) {
    for (var k in faces) if (Object.prototype.hasOwnProperty.call(faces, k)) {
      faces[k].hidden = (k !== nom);
    }
  }

  var sel = hote.querySelector('[data-sens]');
  var champ = hote.querySelector('[data-seuil]');
  var poser = hote.querySelector('[data-poser]');
  var etat = hote.querySelector('[data-etat]');
  var nSurveille = hote.querySelector('[data-n]');
  var nPlafond = hote.querySelector('[data-m]');

  /** Le libellé d'un sens, lu DANS le menu que le serveur a rendu.
   *  ⛔ Ne pas écrire « sous » en dur ici : ce mot existe en cinq langues, et
   *     il vit déjà dans les `<option>`. Deux sources pour un libellé, c'est
   *     une divergence qui attend son tour. */
  function motDuSens(s) {
    if (!sel) return s;
    var o = sel.querySelector('option[value="' + s + '"]');
    return o ? o.textContent.trim() : s;
  }

  // ⭐ LE MONTANT SE FORMATE DANS LA LANGUE DE LA PAGE. `Intl` connaît la
  //   virgule française et le point anglais ; les écrire à la main donnerait
  //   « 40.00 $ » à un lecteur français, ce qui se lit comme une erreur.
  // ⛔ LE `$` EST UN LITTÉRAL, PAS UN `Intl` EN `style:'currency'` — même
  //   raison qu'`Item.astro` : celui-ci rendrait « 40,00 $US » en français.
  var nf;
  try {
    nf = new Intl.NumberFormat(document.documentElement.lang || undefined,
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch (e) { nf = null; }
  function argent(v) {
    var n = Number(v);
    if (!isFinite(n)) return '';
    return '$' + (nf ? nf.format(n) : n.toFixed(2));
  }

  function peindre(r) {
    // ⚠️ `connecte: false` ICI VEUT DIRE QUELQUE CHOSE. Cette page est publique
    //    et pré-générée : un anonyme la lit normalement. On lui montre la porte,
    //    on ne cache pas le bouton — c'est la meilleure raison qu'a le site de
    //    faire créer un compte, et le cœur ★ suit déjà cette règle depuis le
    //    lot 100.
    if (!r.connecte) { montrer('anon'); return; }

    var mienne = null;
    for (var i = 0; i < r.alertes.length; i += 1) {
      if (r.alertes[i].uuid === uuid) { mienne = r.alertes[i]; break; }
    }

    if (mienne) {
      // ⚖️ ARBITRAGE ② : UN SIMPLE RAPPEL. On dit le seuil et l'état, et on
      //    renvoie aux réglages pour changer ou retirer. Un seul endroit où
      //    l'on modifie, donc un seul chemin à garder.
      if (etat) etat.textContent = motDuSens(mienne.sens) + ' ' + argent(mienne.seuil);
      // ⭐ LE BOUTON DIT L'ÉTAT, ET C'EST LUI QU'ON VOIT SANS OUVRIR LE PANNEAU.
      bouton.setAttribute('aria-pressed', 'true');
      montrer('posee');
      return;
    }

    if (r.alertes.length >= r.plafond) {
      // ⭐ LE REFUS DIT LE CHIFFRE. Un « non » sans nombre se lit comme une
      //   panne ; avec le nombre, il se lit comme une limite — et il propose
      //   ses deux sorties (libérer une place, ou monter d'un palier).
      if (nSurveille) nSurveille.textContent = String(r.alertes.length);
      if (nPlafond) nPlafond.textContent = String(r.plafond);
      montrer('plein');
      return;
    }

    if (nSurveille) nSurveille.textContent = String(r.alertes.length);
    if (nPlafond) nPlafond.textContent = String(r.plafond);
    montrer('poser');
  }

  // ── L'ÉTAT SE LIT UNE FOIS, À L'OUVERTURE ────────────────────────────────
  // ⭐ PAS AU CHARGEMENT DE LA PAGE. Sur 8 484 fiches, un appel réseau à chaque
  //   visite coûterait une requête que Cloudflare ne peut pas mettre en cache,
  //   pour un panneau que la plupart n'ouvriront jamais. On paie au clic.
  // ⛔ Et `window.vpAlertes.liste()` mémorise : rouvrir le panneau ne rappelle
  //   pas le serveur.
  var lu = false;
  function ouvrir() {
    panneau.hidden = false;
    bouton.setAttribute('aria-expanded', 'true');
    if (lu) return;
    lu = true;
    if (!window.vpAlertes) { montrer('hs'); return; }
    window.vpAlertes.liste().then(peindre).catch(function () {
      // ⛔ 503 : ON NE SAIT PAS, ET ON LE DIT. Montrer le formulaire de pose
      //    laisserait quelqu'un écraser un seuil qu'on n'a pas pu lire.
      lu = false;                       // ⭐ on pourra réessayer à la réouverture
      montrer('hs');
    });
  }

  bouton.addEventListener('click', function () {
    if (panneau.hidden) { ouvrir(); return; }
    panneau.hidden = true;
    bouton.setAttribute('aria-expanded', 'false');
  });

  if (poser) {
    poser.addEventListener('click', function () {
      var v = Number(String(champ && champ.value).replace(',', '.'));
      // ⛔ ON REFUSE ICI CE QUE LA ROUTE REFUSE LÀ-BAS, ET PAS DAVANTAGE. Ce
      //    contrôle est un CONFORT (éviter un aller-retour pour rien), jamais
      //    la garde : le serveur revalide tout. Un contrôle de navigateur qui
      //    serait la seule garde est une garde qu'on retire avec la console.
      if (!isFinite(v) || v <= 0) { if (champ) champ.focus(); return; }
      poser.disabled = true;
      window.vpAlertes.poser(uuid, sel ? sel.value : 'sous', v,
        hote.getAttribute('data-path'), hote.getAttribute('data-nom'))
        .then(function (r) {
          poser.disabled = false;
          // ⭐ ON REPEINT SUR LA RÉPONSE, JAMAIS SUR L'INTENTION. Le serveur
          //   renvoie la liste à jour : c'est elle qui décide de la face
          //   affichée, pas ce qu'on vient de cliquer.
          peindre(r);
        })
        .catch(function () { poser.disabled = false; montrer('hs'); });
    });
  }
})();
