// ⚠️ VeVePreda/veve-sites — src/socle/modules/classeur.js  (NEUF — lot 224)
// ═══════════════════════════════════════════════════════════════════════════
// LE PILOTE DES DEUX PAGES DU CLASSEUR — inventaire, et Mint Hunter
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ ICI LE PILOTE N'AMÉLIORE PAS : IL REND LA PAGE POSSIBLE, ET C'EST UNE
// EXCEPTION ASSUMÉE À LA RÈGLE DE `alertes.js`. La différence est l'ENTRÉE :
// le feed d'alertes a une donnée à rendre AVANT toute action, le classeur n'en
// a aucune tant qu'une adresse n'est pas tapée. Il n'y a donc rien à rendre au
// serveur, et le motif « page vide + script qui remplit » n'est pas un
// raccourci ici : c'est la forme juste.
// ⭐⭐ ET ELLE PROTÈGE : même pré-générée par erreur, cette page ne porterait
// AUCUNE donnée réservée, parce que tout arrive de `/api/classeur/`, qui lit
// la session. C'est le mur du lot 104 obtenu par l'architecture, pas par un
// test qu'on peut oublier — exactement l'argument de `reserve_analytics.mjs`.
//
// ⚠️ CE FICHIER SERT LES DEUX PAGES : chaque bloc commence par son FILTRE
// D'EXISTENCE, motif de `alertes.js` et `favoris.js`.

// ⭐ UNE SEULE DÉFINITION DE CHAQUE FORME, ET ELLES SONT LES MÊMES QUE CÔTÉ
// SERVEUR. ⛔ Ce contrôle-ci est un CONFORT (il évite un aller-retour), jamais
// une sécurité : la route d'API refait les deux, et c'est elle qui juge. Un
// contrôle de formulaire ne garde rien — il se contourne avec la console.
const RE_ADRESSE = /^0x[0-9a-fA-F]{40}$/;
const RE_UUID = /^[0-9a-f-]{8,64}$/i;

const $ = (id) => document.getElementById(id);
const montre = (el, oui) => { if (el) el.hidden = !oui; };

// ⏰ LA FRAÎCHEUR — DEMANDÉE UNE FOIS, POUR LES DEUX PAGES.
// ⛔ Ne pas l'écrire en dur dans le gabarit : elle vient du méta écrit AU
// BUILD, et un texte figé mentirait dès le déploiement suivant.
async function fraicheur(el) {
  if (!el) return;
  try {
    const r = await fetch('/api/classeur/meta', { credentials: 'same-origin' });
    if (!r.ok) return;
    const m = await r.json();
    if (!m || !m.construitLe) return;
    // ⚠️ « AU PLUS TARD LE … », JAMAIS « LE … ». `construitLe` date le BUILD,
    // pas le fichier source : la release ne porte pas sa date dans son
    // contenu. La donnée a entre 1 et 8 jours de plus. ⭐ Un « à peu près »
    // annoncé vaut mieux qu'un exact inventé.
    const d = new Date(m.construitLe);
    // ⭐⭐ ON AJOUTE, ON NE REMPLIT PAS UN TROU. La phrase rendue par le serveur
    // est DÉJÀ vraie et complète (« la donnée a de 1 à 8 jours ») : sans
    // JavaScript, la page ne montre aucun gabarit `{d}` en clair. Le pilote
    // n'ajoute qu'une précision. ⛔ Un `{d}` dans la phrase de base serait
    // visible chez qui bloque le JS, et `test:cles` ne l'attraperait pas — il
    // cherche des noms de CLÉS, pas des accolades restées ouvertes.
    if (Number.isFinite(d.getTime()) && el.dataset.on) {
      el.textContent += ' ' + el.dataset.on.replace('{d}', d.toLocaleDateString());
      delete el.dataset.on;
    }
  } catch { /* la page reste juste : le gabarit porte déjà la fenêtre 1-8 j. */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// ① L'INVENTAIRE — /classeur/
// ═══════════════════════════════════════════════════════════════════════════
(function inventaire() {
  const form = $('cl-form');
  if (!form) return;
  fraicheur($('cl-fresh'));
  const out = $('cl-out'), corps = $('cl-body');
  const OUI = out.dataset.yes, NON = out.dataset.no, SANSPAGE = out.dataset.nopage;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = ($('cl-a').value || '').trim();
    // ⛔ QUATRE SORTIES QUI NE SE CONFONDENT PAS — on les remet TOUTES à zéro
    //    avant chaque demande. Sans ça, un « adresse invalide » resterait
    //    affiché sous un résultat parfaitement valide obtenu ensuite.
    for (const id of ['cl-hs', 'cl-bad', 'cl-none', 'cl-out']) montre($(id), false);
    if (!RE_ADRESSE.test(a)) { montre($('cl-bad'), true); return; }
    let d;
    try {
      const r = await fetch(`/api/classeur/wallet?adresse=${encodeURIComponent(a)}`,
                            { credentials: 'same-origin' });
      // ⚠️ UN 401 N'EST PAS UNE PANNE : la session a expiré pendant la visite.
      //    On renvoie à la porte au lieu d'afficher « indisponible », qui
      //    enverrait chercher un défaut côté site.
      if (r.status === 401) { location.href = '/connexion/?suite=%2Fclasseur%2F'; return; }
      if (!r.ok) { montre($('cl-hs'), true); return; }
      d = await r.json();
    } catch { montre($('cl-hs'), true); return; }

    const lignes = (d && d.pieces) || [];
    // ⭐ « CE PORTEFEUILLE NE TIENT RIEN » EST UNE RÉPONSE VRAIE, et elle a sa
    //    propre sortie. La confondre avec `hs` ferait chercher une panne là où
    //    il n'y a qu'un portefeuille vide — 709 450 sont indexés, tous ne
    //    détiennent pas.
    if (!lignes.length) { montre($('cl-none'), true); return; }

    corps.textContent = '';
    for (const l of lignes) {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td');
      // ⚠️ UNE PIÈCE SANS FICHE PUBLIÉE RESTE AFFICHÉE, ET N'EST PAS UN LIEN.
      //    9 354 fiches pour 19 485 pièces au grand livre : la retirer
      //    silencieusement amputerait l'inventaire de quelqu'un pour un défaut
      //    d'affichage — et démentirait « inventaire COMPLET », qui est
      //    l'arbitrage. C'est la règle de `Alertes.astro`, même forme.
      // ⛔ `textContent`, JAMAIS `innerHTML` : ces chaînes viennent d'une API.
      if (l.uuid) {
        const a2 = document.createElement('a');
        a2.href = `/item/${l.uuid}/`; a2.textContent = l.uuid; td1.append(a2);
      } else { td1.textContent = SANSPAGE; }
      const td2 = document.createElement('td'); td2.textContent = `#${l.edition}`;
      const td3 = document.createElement('td'); td3.textContent = l.listed ? OUI : NON;
      tr.append(td1, td2, td3); corps.append(tr);
    }
    const c = $('cl-count');
    if (c) c.textContent = c.dataset.tpl
      ? c.dataset.tpl.replace('{n}', lignes.length) : String(lignes.length);
    montre(out, true);
  });
})();

// ═══════════════════════════════════════════════════════════════════════════
// ② MINT HUNTER — /mint-hunter/
// ═══════════════════════════════════════════════════════════════════════════
(function mint() {
  const form = $('mh-form');
  if (!form) return;
  fraicheur($('mh-fresh'));
  const out = $('mh-out'), corps = $('mh-body');
  const OUI = out.dataset.yes, NON = out.dataset.no, VIDE = out.dataset.unheld;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = ($('mh-u').value || '').trim();
    for (const id of ['mh-hs', 'mh-bad', 'mh-absent', 'mh-out']) montre($(id), false);
    if (!RE_UUID.test(u)) { montre($('mh-bad'), true); return; }
    let d;
    try {
      const r = await fetch(`/api/classeur/piece?uuid=${encodeURIComponent(u)}`,
                            { credentials: 'same-origin' });
      if (r.status === 401) { location.href = '/connexion/?suite=%2Fmint-hunter%2F'; return; }
      // ⭐ 404 ET 503 NE DISENT PAS LA MÊME CHOSE, ET LA PAGE NE DOIT PAS LES
      //    FONDRE. 404 = cette pièce n'a pas de fiche publiée — le cas d'une
      //    pièce sur deux, un état NORMAL. 503 = la réserve n'a pas été
      //    écrite, et là c'est le site qui a un problème. Les fondre ferait
      //    dire « indisponible » à la moitié des demandes légitimes.
      if (r.status === 404) { montre($('mh-absent'), true); return; }
      if (!r.ok) { montre($('mh-hs'), true); return; }
      d = await r.json();
    } catch { montre($('mh-hs'), true); return; }

    const eds = (d && d.editions) || [];
    if (!eds.length) { montre($('mh-absent'), true); return; }

    corps.textContent = '';
    for (const l of eds) {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td'); td1.textContent = `#${l.edition}`;
      const td2 = document.createElement('td');
      // ⚖️ « NON DÉTENUE », INDISTINCTE — arbitrage Preda du 04/09.
      // ⛔⛔ NE JAMAIS ÉCRIRE « brûlée » NI « en réserve » : le grand livre
      //    porte le BIT (14,64 % des numéros) et pas la DISTINCTION. Les deux
      //    états valent ensemble 1 825 547, à une unité près sur 1,8 million,
      //    et rien ici ne dit lequel est lequel.
      if (l.holder) { td2.textContent = l.holder; td2.className = 'mh-a'; }
      else { td2.textContent = VIDE; td2.className = 'mh-vide'; }
      const td3 = document.createElement('td'); td3.textContent = l.listed ? OUI : NON;
      tr.append(td1, td2, td3); corps.append(tr);
    }
    const c = $('mh-count');
    if (c) c.textContent = c.dataset.tpl
      ? c.dataset.tpl.replace('{n}', eds.length) : String(eds.length);
    montre(out, true);
  });
})();
