// ⚠️ VeVePreda/veve-sites — src/socle/modules/alertes.js  (FICHIER NEUF — lot 215)
// ═══════════════════════════════════════════════════════════════════════════
// LE PILOTE DES DEUX PAGES D'ALERTES — il n'invente rien, il corrige
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ LES DEUX PAGES FONCTIONNENT SANS CE FICHIER, ET C'EST LA RÈGLE QU'IL
// RESPECTE. Le feed est rendu AU SERVEUR, avec son heure en UTC, écrite et
// étiquetée. Les configurations aussi. ⇒ Sans JavaScript, tout est lisible et
// exact ; ce pilote AMÉLIORE, il ne rend pas la page possible.
// ⛔ C'est l'inverse du motif « page vide + script qui remplit » : ce motif-là
//    donne un écran blanc quand le script ne charge pas, et personne ne le voit
//    en développement.
//
// ⚠️ CE FICHIER SERT LES DEUX PAGES. Chaque bloc commence donc par son FILTRE
// D'EXISTENCE : sur `/alertes/` le second bloc sort tout de suite, et
// réciproquement. C'est le motif de `favoris.js`, et il évite un module par
// page — donc une empreinte de plus dans le socle.

// ═══════════════════════════════════════════════════════════════════════════
// ① L'HEURE PASSE DANS LE FUSEAU DU LECTEUR
// ═══════════════════════════════════════════════════════════════════════════
// 🔑 Preda, 03/09 : « l'heure doit être précise ». Le serveur vit en UTC et ne
// peut pas connaître le fuseau du navigateur : il écrit donc l'heure UTC, et il
// l'ÉTIQUETTE. ⭐ Le navigateur, lui, connaît son fuseau. Il réécrit la ligne,
// et il RETIRE la mention « UTC » — laisser l'étiquette sur une heure locale
// serait pire que de ne rien faire : ce serait une heure fausse, affirmée.
//
// ⛔ ON LIT `datetime`, PAS LE TEXTE AFFICHÉ. Le texte est formaté pour être
//    lu ; le reparser reviendrait à deviner un format qui dépend de la langue.
//    L'attribut, lui, est un instant en ISO 8601, sans ambiguïté.
(function () {
  var feed = document.getElementById('al-feed');
  if (!feed) return;
  var lignes = feed.querySelectorAll('time[datetime]');
  if (!lignes.length) return;

  var fmt;
  try {
    fmt = new Intl.DateTimeFormat(document.documentElement.lang || undefined, {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch (e) {
    // ⛔ ON NE TOUCHE À RIEN SI ON NE SAIT PAS FORMATER. L'heure UTC déjà
    //    servie est juste ; la remplacer par un repli approximatif
    //    échangerait une donnée exacte contre une donnée plausible.
    return;
  }

  for (var i = 0; i < lignes.length; i += 1) {
    var el = lignes[i];
    var d = new Date(el.getAttribute('datetime'));
    // ⚠️ Une date illisible se saute, elle ne s'écrase pas. `Invalid Date`
    //    afficherait littéralement « Invalid Date » à la place d'un horodatage
    //    correct — un défaut qui a l'air d'une panne du site entier.
    if (isNaN(d.getTime())) continue;
    el.textContent = fmt.format(d);
  }
})();

// ═══════════════════════════════════════════════════════════════════════════
// ② LE BOUTON « RETIRER » — /alertes/reglages/
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ IL REPEINT SUR LA RÉPONSE, JAMAIS SUR L'INTENTION. La ligne ne disparaît
// qu'après un succès du serveur. ⛔ La retirer au clic ferait croire à une
// suppression qu'un 503 vient de refuser — et la personne rechargerait la page
// pour retrouver l'alerte qu'elle croyait effacée. *On n'affiche jamais un état
// qu'on n'a pas obtenu.*
//
// ⚠️ IL PASSE PAR `window.vpAlertes` ET N'OUVRE AUCUN `fetch`.
// 🔴🔴 LE PREMIER JET DE CE FICHIER APPELAIT `fetch('/api/alertes')` DIRECTEMENT,
// et c'était juste — tant qu'il était le seul lecteur. Le panneau de la fiche
// (lot 215-B) en a fait un second : deux accès, donc deux occasions de traiter
// le 401 et le 503 différemment le jour où l'un des deux apprend une règle de
// plus. C'est mot pour mot ce que les favoris ont payé au lot 140-1.
// ⇒ L'accès est descendu dans le socle (`src/socle/45-alertes.js`), qui est émis
//   dans le `<head>` et donc déjà exécuté quand ce module démarre.
// ⭐ *Un accès unique ne se décide pas au premier lecteur, il se décide au
//   second — et le second arrive toujours.*
(function () {
  var hote = document.getElementById('al-cfgs');
  if (!hote) return;
  var vide = document.getElementById('al-cfg-vide');

  hote.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-retirer]') : null;
    if (!b || !hote.contains(b)) return;
    var uuid = b.getAttribute('data-retirer');
    if (!uuid) return;

    // ⭐ ON DÉSARME LE BOUTON PENDANT L'APPEL. Sans ça, deux clics rapides
    //   envoient deux requêtes ; la seconde réussit aussi (retirer ce qui n'est
    //   plus là est un succès), et rien ne casse — mais l'interface reste
    //   figée sans dire pourquoi pendant deux allers-retours.
    b.disabled = true;

    if (!window.vpAlertes) { b.disabled = false; return; }
    window.vpAlertes.retirer(uuid).then(function () {
      var li = b.closest('li');
      if (li) li.remove();
      // ⭐ ET L'ÉTAT VIDE REVIENT QUAND LA DERNIÈRE PART. Il est rendu au
      //   build : sans cette ligne, retirer sa dernière alerte laisse une page
      //   sans liste ET sans phrase — un blanc qui ressemble à une panne.
      if (!hote.querySelector('li')) {
        hote.hidden = true;
        if (vide) vide.hidden = false;
      }
    }).catch(function () {
      // ⛔ ON REND LE BOUTON, ON N'EFFACE RIEN. « Je ne sais pas » n'emprunte
      //    jamais la sortie de « c'est fait ».
      b.disabled = false;
    });
  });
})();
