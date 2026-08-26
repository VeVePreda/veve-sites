// ⚠️ VeVePreda/veve-sites — engine/lib/tableau.mjs   (FICHIER NEUF — lot 202)
// ═══════════════════════════════════════════════════════════════════════════
// LES ACCÈS RAPIDES DU TABLEAU DE BORD — point `z` de la liste de Preda
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴 CE QUE PREDA A DEMANDÉ, AVEC SES MOTS (point `z`, audit du 14/08) :
//    « ajouter / supprimer / AGENCER des modules d'accès rapide ».
//    Tranché sur maquette le 25/08 : cases à cocher + flèches montée/descente
//    sur `/compte/`, à côté des réglages e-mails. ⛔ Pas de glisser-déposer —
//    il ne marche pas sans JavaScript, il est pénible au doigt, et il
//    demanderait un « remettre comme avant » que personne n'a demandé.
//    Tranché le 26/08 : la liste porte les 4 modules ET les 3 rayons, et la
//    rangée « Le catalogue » du bas disparaît — un rayon ne se montre plus
//    qu'à UN endroit.
//
// ⭐⭐⭐ POURQUOI CE FICHIER EXISTE, ALORS QUE LA TABLE VIVAIT DANS LE GABARIT.
//    Elle doit maintenant être lue par TROIS endroits qui ne se voient pas :
//      · `/compte/` — pour dessiner les cases dans le bon ordre ;
//      · `/api/reglages` — pour REFUSER une clé qui n'existe pas ;
//      · `Dashboard.astro` — pour rendre les tuiles.
//    Une table recopiée trois fois diverge au premier module ajouté, et elle
//    diverge EN SILENCE : la case s'affiche, la route l'accepte, la tuile ne
//    sort pas. ⇒ un seul fichier, importé par les trois.
//
// ⛔ CE MODULE NE SAIT NI LIRE UNE BASE, NI RENDRE UN CHIFFRE. Il porte
//    l'IDENTITÉ des accès rapides et la GRAMMAIRE de l'agencement, rien de
//    plus. C'est ce qui permet à `/api/reglages` de l'importer sans traîner
//    `cote.mjs` — une route de POST qui chargerait la projection du marché
//    paierait 8 840 fiches pour valider une case à cocher.
//
// ═══════════════════════════════════════════════════════════════════════════
// 🔑 LES QUATRE DÉCISIONS, ET CE QU'ELLES ÉVITENT
// ═══════════════════════════════════════════════════════════════════════════
//
// ① L'ORDRE ET LA SÉLECTION TIENNENT DANS UNE SEULE VALEUR.
//    Deux clés (« l'ordre » d'un côté, « les cochées » de l'autre) sont deux
//    écritures, donc deux occasions qu'une seule aboutisse — et un tableau de
//    bord rangé dans un ordre qui ne correspond plus aux cases. Une chaîne,
//    une écriture, aucun état intermédiaire possible.
//    La forme : les clés séparées par des virgules, dans l'ordre d'affichage,
//    un signe moins devant celles qui sont décochées.
//      favoris,market,-price_history,modules,sets,-collectibles,comics
//
// ② UNE CLÉ INCONNUE DE LA VALEUR ENREGISTRÉE ARRIVE À LA FIN, ET COCHÉE.
//    ⭐ C'est le point qui se paie dans six mois, pas aujourd'hui. Le jour où
//    un 8ᵉ accès rapide est livré, tous les membres qui ont déjà enregistré un
//    agencement ont une valeur qui ne le nomme pas. Le traiter comme
//    « décoché » rendrait le module neuf invisible pour EUX SEULS, sans une
//    ligne de journal — c'est-à-dire au moment précis où on croit l'avoir
//    livré. On le montre, et celui qui n'en veut pas le décoche.
//
// ③ UNE CLÉ QUE LE CATALOGUE NE CONNAÎT PLUS EST JETÉE, SANS BRUIT.
//    Le mouvement inverse : un module retiré du site laisse son nom dans les
//    valeurs déjà rangées. ⛔ Ne pas le jeter ferait rendre une tuile vers une
//    adresse qui n'existe plus. ⭐ LISTE BLANCHE ET FORME — on ne se protège
//    pas de ce qu'on imagine, on n'accepte que ce qu'on connaît.
//
// ④ CE MODULE NE DIT RIEN DES PORTES.
//    Un accès rapide `rayon` est PUBLIC et le reste ; un accès rapide `module`
//    est soumis au palier, et c'est `access.mjs` qui en juge — lui seul, et il
//    le fait déjà. Deux juges pour un même palier, c'est deux réponses le jour
//    où l'un change (la leçon écrite en tête de `prefs.mjs`).

/** La clé sous laquelle l'agencement est rangé dans `prefs`.
 * ⭐ Exportée plutôt que recopiée : `/compte/`, `/api/reglages` et
 *   `/api/entrer` la nomment tous les trois. */
export const CLE_PREF = 'agencement';

/** Le cookie qui PORTE l'agencement jusqu'au tableau de bord.
 *
 * 🔴🔴🔴 LA BASE EST LA VÉRITÉ, LE COOKIE EST LE PORTEUR — et c'est
 * exactement le dispositif de la langue (lot 154-B), pour la même raison
 * mesurée : `/dashboard/` ne connaît PAS le compte. Le middleware ne demande
 * que le palier ; l'identifiant de compte vient d'un autre appel, qui exige le
 * secret de service et pose un délai de 4 secondes. Résoudre le compte pour
 * ranger quatre tuiles ajouterait cet aller-retour à CHAQUE affichage de la
 * page d'arrivée d'un membre.
 * ⇒ On le repose depuis la base à la CONNEXION, le seul endroit du site où
 *   l'aller-retour est déjà payé, et à chaque enregistrement.
 *
 * ⭐ Il est `httpOnly`, contrairement au cookie de langue. La différence n'est
 *   pas un oubli : la langue est lue PAR LE NAVIGATEUR sur ~3 000 pages
 *   pré-générées, l'agencement n'est lu que par une page rendue à la demande.
 *   Un cookie que personne n'a besoin de lire côté client n'a rien à y faire.
 */
export const COOKIE = 'vp_tb';

/** ⭐ UN AN, comme la langue. Une préférence de rangement ne s'oublie pas au
 *  bout d'un mois — et si le cookie disparaît, la base le repose à la
 *  connexion suivante. Le pire cas est donc « l'ordre par défaut jusqu'au
 *  prochain login », jamais une perte. */
export const COOKIE_DUREE = 60 * 60 * 24 * 365;

// ═══════════════════════════════════════════════════════════════════════════
// LE CATALOGUE — l'ordre de cette table EST l'ordre par défaut
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ `favoris` EST EN TÊTE, et ce n'est pas décoratif : c'est le point `aa`,
//    livré au lot 160-B. ⛔ Ne pas le déplacer sans une demande.
//
// ⭐ `module:` NOMME UNE CLÉ DE `offer.modules` DU MANIFESTE. C'est ce lien
//    qui permet à `test:tableau` de refuser une tuile qui nommerait un module
//    inexistant — « mod.truc » s'afficherait alors en toutes lettres, car
//    `t()` sur une clé absente rend la clé, en silence.
//
// ⭐ `rayon: true` DIT « PUBLIC, JAMAIS DE CADENAS ». Les rayons ne sont pas
//    dans `offer.modules` et n'ont pas à y être : ils n'ont jamais été fermés.
//    ⛔ Sans ce drapeau, le banc les prendrait pour des modules inventés.
//
// ⚠️ `price_history` ET `collectibles` MÈNENT TOUS DEUX À `/collectibles/`.
//    Ce n'est pas neuf (la table du lot 160 le faisait déjà) et ce n'est pas
//    un doublon : l'un est le RAYON, l'autre est la PROFONDEUR d'historique
//    qu'un palier ouvre, et leur libellé le dit. ⛔ Ne pas « dédoublonner » par
//    l'adresse : ce sont deux promesses différentes qui partagent une porte.
export const ACCES_RAPIDES = [
  {
    cle: 'favoris', href: '/favoris/', module: 'favoris',
    nomCle: 'mod.favoris', descCle: 'mod.favoris.d',
    // ⭐ Le chiffre des favoris appartient à un COMPTE : il ne peut pas venir
    //   du build. Un « 0 » rendu au serveur mentirait à qui en a trente.
    compteur: 'tb-nfav',
  },
  {
    cle: 'market', href: '/market/', module: 'market',
    nomCle: 'mod.market', descCle: 'mod.market.d',
  },
  {
    cle: 'sets', href: '/sets/', rayon: true,
    nomCle: 'rayon.sets', descCle: 'dash.sets.d',
  },
  {
    cle: 'collectibles', href: '/collectibles/', rayon: true,
    nomCle: 'rayon.collectibles', descCle: 'dash.collectibles.d',
  },
  {
    cle: 'comics', href: '/comics/', rayon: true,
    nomCle: 'rayon.comics', descCle: 'dash.comics.d',
  },
  {
    cle: 'price_history', href: '/collectibles/', module: 'price_history',
    nomCle: 'mod.price_history', descCle: 'mod.price_history.d',
  },
  {
    cle: 'modules', href: '/analytics/', module: 'modules',
    nomCle: 'mod.modules', descCle: 'mod.modules.d',
  },
];

/** Les clés du catalogue, dans l'ordre par défaut. */
export const CLES = ACCES_RAPIDES.map((x) => x.cle);

/** ⭐ LA VALEUR LA PLUS LONGUE POSSIBLE, calculée et non devinée : toutes les
 *  clés, toutes décochées, plus les virgules. `poserPref` borne à 4 096 o ;
 *  ce plafond-ci est là pour refuser une chaîne fabriquée AVANT d'entrer dans
 *  la boucle, pas pour protéger la base. */
export const PLAFOND = CLES.join(',').length + CLES.length + 8;

const PAR_CLE = new Map(ACCES_RAPIDES.map((x) => [x.cle, x]));

/** Rend l'accès rapide portant cette clé, ou `null`. */
export function accesRapide(cle) {
  return PAR_CLE.get(String(cle || '')) || null;
}

/** Lit une valeur rangée et rend l'agencement COMPLET, prêt à afficher.
 *
 * Rend une liste de `{ cle, montre, ...identité }` qui porte TOUJOURS les
 * mêmes clés que le catalogue, ni plus ni moins.
 *
 * ⭐⭐⭐ ELLE NE PEUT PAS LEVER, ET C'EST DÉLIBÉRÉ. Elle est appelée depuis le
 * frontmatter de deux pages rendues à la demande. Une exception y est une 500
 * servie à un membre connecté — pour un ordre de tuiles. Une valeur illisible
 * retombe donc sur le défaut du site, qui est un état parfaitement utilisable.
 * ⛔ Ce n'est PAS l'aplatissement interdit en tête de `prefs.mjs` : ici rien
 *    n'est écrit par-dessus. La lecture retombe sur un défaut, elle n'efface
 *    aucune préférence rangée.
 */
export function lireAgencement(brut) {
  const vus = new Set();
  const out = [];
  const chaine = typeof brut === 'string' ? brut.slice(0, PLAFOND) : '';

  for (const morceau of chaine.split(',')) {
    const t = morceau.trim();
    if (!t) continue;
    const montre = t[0] !== '-';
    const cle = montre ? t : t.slice(1);
    // ⛔ LISTE BLANCHE. Une clé que le catalogue ne connaît pas est jetée —
    //    pas signalée, pas conservée : elle ne peut plus rien ouvrir.
    if (!PAR_CLE.has(cle) || vus.has(cle)) continue;
    vus.add(cle);
    out.push({ ...PAR_CLE.get(cle), montre });
  }

  // ⭐⭐ LA DÉCISION ② — ce qui manque arrive à la fin, COCHÉ.
  for (const x of ACCES_RAPIDES) {
    if (!vus.has(x.cle)) out.push({ ...x, montre: true });
  }
  return out;
}

/** L'inverse : une liste `{ cle, montre }` redevient une valeur rangeable.
 *
 * ⭐ Elle repasse par `lireAgencement` d'abord. Écrire ce que l'appelant
 *   propose sans le normaliser rangerait des doublons et des clés inconnues
 *   dans la base — que la lecture jetterait ensuite, en donnant l'impression
 *   d'un réglage qui « ne s'enregistre pas ».
 */
export function ecrireAgencement(liste) {
  const demande = new Map();
  for (const x of Array.isArray(liste) ? liste : []) {
    const cle = String(x?.cle ?? '');
    if (PAR_CLE.has(cle) && !demande.has(cle)) demande.set(cle, Boolean(x?.montre));
  }
  const ordre = [...demande.keys()];
  for (const c of CLES) if (!demande.has(c)) { ordre.push(c); demande.set(c, true); }
  return ordre.map((c) => (demande.get(c) ? c : `-${c}`)).join(',');
}

/** Déplace une clé d'un cran vers le haut (pas négatif) ou vers le bas.
 *
 * ⭐⭐ ELLE TRAVAILLE SUR LA LISTE ENTIÈRE, cochées et décochées mêlées, et
 * c'est le seul comportement qui ne surprend pas : les cases sont affichées
 * dans cet ordre-là. Une flèche qui sauterait par-dessus une ligne décochée
 * ferait bouger la ligne d'à côté sans que rien ne l'explique.
 *
 * ⭐ Un déplacement impossible (déjà en bout, clé inconnue) rend la liste
 *   INCHANGÉE plutôt qu'une erreur : la flèche du haut de la première ligne
 *   n'est de toute façon pas rendue, et une requête fabriquée à la main ne
 *   mérite pas un message.
 */
export function deplacer(liste, cle, pas) {
  const l = [...(Array.isArray(liste) ? liste : [])];
  const i = l.findIndex((x) => x?.cle === cle);
  const j = i + (pas < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= l.length) return l;
  [l[i], l[j]] = [l[j], l[i]];
  return l;
}
