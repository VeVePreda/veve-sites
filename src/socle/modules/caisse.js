// ⚠️ VeVePreda/veve-sites — src/socle/modules/caisse.js   (FICHIER NEUF — lot 200)
// ═══════════════════════════════════════════════════════════════════════════
// LE PILOTE DE L'ÉCRAN D'ACHAT — il ouvre la commande, puis il attend
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ « LA PAGE SE DÉBLOQUE TOUTE SEULE » — c'est le choix de Preda du
// 25/08, et c'est la seule raison d'être de ce fichier. Il n'y a rien à
// rafraîchir, rien à copier dans un formulaire : l'acheteur envoie son
// virement, et l'écran passe de lui-même à « c'est bon ».
//
// 🔴 IL VIT DANS `src/socle/modules/`, PAS EN LIGNE DANS LA PAGE. Un `<script>`
// en ligne s'exécute au moment où l'analyseur l'atteint — avant que le DOM qui
// le suit existe. C'est la règle du dépôt, et elle a déjà été payée.
//
// ⛔ CE FICHIER NE CALCULE AUCUN PRIX. Il affiche ce que le serveur lui a
// répondu. Un montant calculé des deux côtés est un montant qui divergera —
// et ici, une divergence d'un centime rend le paiement non reconnaissable.

(function () {
  var racine = document.getElementById('caisse');
  if (!racine) return;

  var boutons = racine.querySelectorAll('[data-caisse-acheter]');
  var ecran = racine.querySelector('#caisse-ecran');
  var choix = racine.querySelector('#caisse-choix');
  var champMontant = racine.querySelector('#caisse-montant');
  var champAdresse = racine.querySelector('#caisse-adresse');
  var champReste = racine.querySelector('#caisse-reste');
  var champEtat = racine.querySelector('#caisse-etat');
  var lienWallet = racine.querySelector('#caisse-wallet');
  var boutonRetour = racine.querySelector('#caisse-retour');
  if (!ecran || !choix) return;

  var sonde = null;
  var horloge = null;

  function texte(cle) {
    // ⭐ LES LIBELLÉS VIENNENT DU DOM, JAMAIS D'ICI. Le site traduit son
    //   interface en cinq langues ; une chaîne écrite dans ce fichier serait
    //   anglaise pour tout le monde, et invisible au marquage i18n.
    var n = racine.querySelector('[data-caisse-mot="' + cle + '"]');
    return n ? n.textContent : '';
  }

  function dollars(cents) {
    // ⚠️ `toFixed(2)` sur un ENTIER de centimes, jamais sur un flottant de
    //   dollars : `6.07` n'existe pas exactement en binaire, et l'arrondi se
    //   verrait sur le seul chiffre qui compte ici.
    return (cents / 100).toFixed(2);
  }

  function stop() {
    if (sonde) { clearInterval(sonde); sonde = null; }
    if (horloge) { clearInterval(horloge); horloge = null; }
  }

  function montrerEcran(d) {
    champMontant.textContent = dollars(d.cents);
    champAdresse.textContent = d.adresse;
    if (lienWallet) {
      // ⭐ Un lien `ethereum:` ouvre l'application de portefeuille du
      //   téléphone avec l'adresse déjà remplie. S'il n'y en a pas, le lien ne
      //   fait rien de mal — l'adresse reste lisible juste au-dessus.
      lienWallet.setAttribute('href', 'ethereum:' + d.adresse + '@8453');
    }
    choix.hidden = true;
    ecran.hidden = false;
    var reste = d.reste_s;
    horloge = setInterval(function () {
      reste -= 1;
      if (reste <= 0) {
        champReste.textContent = texte('expire');
        stop();
        return;
      }
      var mn = Math.floor(reste / 60);
      var sc = reste % 60;
      champReste.textContent = mn + ':' + (sc < 10 ? '0' : '') + sc;
    }, 1000);

    // ⚠️ TOUTES LES CINQ SECONDES, PAS PLUS SOUVENT. La sonde tape une route
    //   qui, elle, réveille le collecteur : la resserrer ne ferait pas arriver
    //   l'argent plus vite, elle ferait marteler un noeud public gratuit.
    sonde = setInterval(function () { demanderEtat(d.reference); }, 5000);
  }

  function demanderEtat(reference) {
    fetch('/api/caisse?ref=' + encodeURIComponent(reference), { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        if (j.etat === 'payee' || j.etat === 'a_accorder') {
          stop();
          champEtat.textContent = texte('recu');
          champEtat.hidden = false;
          // ⭐ ON RECHARGE, ET C'EST VOLONTAIRE. Le palier est rendu AU
          //   SERVEUR : bannière, portes, modules, tout le reste de la page a
          //   été calculé pour l'ancien palier. Repeindre un morceau en
          //   laisserait le reste faux.
          setTimeout(function () { window.location.reload(); }, 2500);
        }
      })
      .catch(function () { /* une sonde muette vaut mieux qu'une page cassée */ });
  }

  for (var i = 0; i < boutons.length; i++) {
    boutons[i].addEventListener('click', function (ev) {
      var b = ev.currentTarget;
      b.disabled = true;
      fetch('/api/caisse', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          palier: b.getAttribute('data-caisse-acheter'),
          mois: Number(b.getAttribute('data-caisse-mois')),
        }),
      })
        .then(function (r) { return r.json().catch(function () { return null; }); })
        .then(function (j) {
          b.disabled = false;
          if (!j || !j.ok) {
            champEtat.textContent = texte('erreur');
            champEtat.hidden = false;
            return;
          }
          montrerEcran(j);
        })
        .catch(function () {
          b.disabled = false;
          champEtat.textContent = texte('erreur');
          champEtat.hidden = false;
        });
    });
  }

  if (boutonRetour) {
    boutonRetour.addEventListener('click', function () {
      // ⛔ ON N'ANNULE PAS LA COMMANDE CÔTÉ SERVEUR. Elle reste reconnaissable
      //    vingt-quatre heures : quelqu'un qui ferme l'écran puis paie quand
      //    même doit obtenir son palier. Ce bouton ne fait que ramener au
      //    choix — il ne détruit rien.
      stop();
      ecran.hidden = true;
      choix.hidden = false;
    });
  }
}());
