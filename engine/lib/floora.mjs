// ⚠️ VeVePreda/veve-sites — engine/lib/floora.mjs   (FICHIER NEUF — relooking 2)
// ═══════════════════════════════════════════════════════════════════════════
// 🌱 FLOORA — LA POSE NE SE CHOISIT PAS, ELLE EST ASSIGNÉE
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 CE MODULE EXISTE POUR RENDRE UNE RÈGLE **STRUCTURELLE** AU LIEU DE LA
// LAISSER EN CONVENTION. Le brief le dit en toutes lettres : *« les poses sont
// assignées, pas choisies à l'ambiance »*, et il donne la table. Une table dans
// un document est une intention ; une table dans le code est un invariant.
// ⇒ Un gabarit ne demande donc JAMAIS une pose. Il demande un **usage**
//   (`'404'`, `'500'`…) et ce fichier répond. On ne peut pas mettre `coeur` sur
//   une erreur serveur : il n'y a pas d'argument pour le dire.
//
// 📐 ET LES TAILLES NE SONT PAS LIBRES NON PLUS. Le brief : *96 → 52 · 176 → 88
// · 208 → 104*, et **il n'existe pas de `-384`**. Le nombre du nom de fichier
// est la HAUTEUR du fichier (mesuré le 06/09 : `floora-loupe-208.webp` fait
// 254 × 208) ; la valeur de droite est la hauteur d'AFFICHAGE.
// ⛔ ET LE RAPPORT N'EST PAS CONSTANT : 96/52 = 1,85, mais 176/88 et 208/104
//    valent 2. J'avais écrit « toujours 2 » — c'était une déduction, pas la
//    table, et `test:floora` §2 me l'a rendue rouge au premier tour. La table
//    du brief fait autorité ; la seule propriété qu'on vérifie est qu'aucune
//    ligne n'AGRANDIT le fichier.
// ⛔ Agrandir au-delà de +15 % floute — le sujet utile ne mesure que 148 à
//    248 px dans le fichier. L'erreur a déjà été commise deux fois (150 px,
//    170 px), c'est pourquoi la table est FERMÉE et qu'une taille hors table
//    lève au lieu de rendre approximativement.

/** usage ⟶ pose. ⛔ FERMÉE. Ajouter un usage, c'est ajouter une ligne ICI, et
 *  la revue voit alors passer la décision — ce qui est le but. */
export const POSE_DE = {
  404: 'loupe',
  500: 'panique',
  'filtre-vide': 'perplexe',
  'favoris-vides': 'coeur',
  alerte: 'choc',
  fiche: 'serieux',
  'alertes-armees': 'attente',
  // 🆕 06/09 (LOT D) — LES QUATRE PERCHES DE PAGE-OUTIL. ⛔ Elles ne sont pas
  // choisies « à l'ambiance » : chacune est écrite dans la table du livrable
  // (`livraison-floora/LISEZ-MOI.md`, §3), avec sa clé de bulle et sa taille.
  // C'est la règle du dossier — *les poses sont assignées* — et l'ajout passe
  // par ici précisément pour que la revue le voie.
  // ⚠️ Les DEUX rayons (`/collectibles/`, `/comics/`) n'y sont PAS : la table
  // du livrable ne leur assigne aucune pose. Leur en inventer une aurait été
  // le premier pas vers « on met celle qui va bien ».
  market: 'lunettes',
  sets: 'clin-oeil',
  collections: 'panier',
  analytics: 'emerveille',
};

/** usage ⟶ clé de la bulle. ⛔ FERMÉE elle aussi, et pour la même raison que
 *  `POSE_DE` : c'est la table du livrable (`livraison-floora/LISEZ-MOI.md` §3)
 *  qui apparie une pose, un écran et une phrase. Un gabarit qui choisirait sa
 *  clé pourrait expliquer deux fois la même chose de deux façons.
 *  ⚠️ Les usages d'ÉTAT VIDE (404, 500, filtre vide, favoris vides) n'entrent
 *  pas ici : leur texte est un titre + une description (`floora.404.t/.d`),
 *  pas une bulle de perche. Deux formes, deux tables. */
const BULLE_DE = {
  fiche: 'floora.item',
  market: 'floora.market',
  sets: 'floora.sets',
  collections: 'floora.collections',
  analytics: 'floora.analytics',
};

/** hauteur du FICHIER ⟶ hauteur d'AFFICHAGE. ⛔ Pas de 384 : il n'existe pas. */
export const AFFICHAGE = { 96: 52, 176: 88, 208: 104 };

/** Dimensions intrinsèques MESURÉES sur les fichiers déposés.
 *  🆕 06/09 (LOT D) — LES SEIZE POSES, ET ELLES NE SONT PAS RE-MESURÉES ICI :
 *  ces largeurs sont RECOPIÉES de `livraison-floora/floora-manifeste.json`,
 *  qui les tient de la génération des fichiers. ⭐⭐ Les remesurer à la main
 *  aurait créé une seconde vérité sur la même chose.
 *  ⛔ CE QUI A CHANGÉ N'EST PAS LA TABLE, C'EST LE DISQUE : les 45 fichiers
 *  existaient depuis le 04/09 dans `livraison-floora/`, et seuls DEUX avaient
 *  été déposés. « Il n'y a que deux poses » décrivait le DÉPÔT, pas le travail
 *  livré. *Une absence dans le dépôt n'est pas une absence tout court.*
 *  (ancien en-tête ↓)
 *  ⛔ Elles ne se déduisent pas du nom : `loupe-208` fait 254 px de large,
 *  `panique-208` en fait 216. Sans elles, `width`/`height` seraient faux et la
 *  page sauterait au chargement — ou l'image serait déformée. */
const LARGEUR_FICHIER = {
  'attente': { 96: 133, 176: 243 },
  'calculatrice': { 96: 104, 176: 190, 208: 225 },
  'choc': { 96: 103, 176: 189, 208: 223 },
  'chrono': { 96: 94, 176: 173, 208: 204 },
  'clin-oeil': { 96: 90, 176: 165, 208: 195 },
  'coeur': { 96: 117, 176: 214, 208: 253 },
  'emerveille': { 96: 100, 176: 183, 208: 217 },
  'fier': { 96: 103, 176: 188, 208: 223 },
  'jumelles': { 96: 127, 176: 233 },
  'loupe': { 96: 117, 176: 215, 208: 254 },
  'lunettes': { 96: 113, 176: 208 },
  'pancarte-alerte': { 96: 121, 176: 222, 208: 263 },
  'panier': { 96: 118, 176: 217, 208: 256 },
  'panique': { 96: 100, 176: 183, 208: 216 },
  'perplexe': { 96: 88, 176: 161, 208: 190 },
  'serieux': { 96: 90, 176: 165, 208: 195 },
};

/**
 * @param {string} usage  une clé de `POSE_DE` — PAS une pose
 * @param {number} hauteurFichier  96, 176 ou 208
 * @returns {{src:string, pose:string, width:number, height:number, cle:string}}
 *   `cle` est la clé i18n de l'`alt` : la traduction porte « Floora », et c'est
 *   ce que `test:floora` vérifie — un `alt` en dur serait anglais partout.
 */
export function floora(usage, hauteurFichier = 208) {
  const pose = POSE_DE[usage];
  if (!pose) throw new Error(`[floora] usage inconnu : « ${usage} » — la table POSE_DE est fermée`);
  const h = AFFICHAGE[hauteurFichier];
  if (!h) {
    throw new Error(`[floora] taille « ${hauteurFichier} » hors table — seules 96, 176 et 208 existent`
      + ' (il n\'y a pas de -384, et agrandir de plus de 15 % floute le sujet)');
  }
  const lf = LARGEUR_FICHIER[pose];
  if (!lf || !lf[hauteurFichier]) {
    throw new Error(`[floora] la pose « ${pose} » n'a pas de fichier en ${hauteurFichier} —`
      + ' mesurer le fichier et l\'inscrire dans LARGEUR_FICHIER avant de l\'utiliser');
  }
  // ⭐ On rend la taille d'AFFICHAGE, pas celle du fichier : ce sont ces deux
  // nombres qui réservent la place et empêchent la page de sauter.
  const ratio = lf[hauteurFichier] / hauteurFichier;
  return {
    src: `/floora/floora-${pose}-${hauteurFichier}.webp`,
    pose,
    width: Math.round(h * ratio),
    height: h,
    cle: 'floora.alt',
    // 🆕 06/09 (LOT D) — LA CLÉ DE LA BULLE SORT D'ICI, PAS DU GABARIT.
    // ⭐⭐ Même raison que la pose : si la page choisissait son texte, deux
    // pages finiraient par expliquer la même chose de deux façons, et la règle
    // « une bulle est écrite une fois » (LISEZ-MOI §3) serait invérifiable.
    // ⛔ `null` quand l'usage n'a pas de bulle assignée — surtout pas une
    // chaîne vide, qui rendrait une infobulle vide au lieu de n'en rendre
    // aucune. Le gabarit teste et n'écrit rien.
    cleBulle: BULLE_DE[usage] || null,
  };
}
