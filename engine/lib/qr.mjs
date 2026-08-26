// ⚠️ VeVePreda/veve-sites — engine/lib/qr.mjs   (FICHIER NEUF — lot 201)
// ═══════════════════════════════════════════════════════════════════════════
//  UN CODE QR, ÉCRIT À LA MAIN, PARCE QUE CE DÉPÔT N'AJOUTE PAS DE DÉPENDANCE
// ═══════════════════════════════════════════════════════════════════════════
//
// ⛔⛔ POURQUOI PAS UNE BIBLIOTHÈQUE. `package.json` porte QUATRE dépendances
// de production (`astro`, `@astrojs/node`, `@astrojs/markdown-satteri`,
// `js-yaml`) et c'est une règle tenue depuis le premier lot. Une cinquième
// pour dessiner 33 × 33 carrés, ce serait un paquet de plus à auditer, à
// mettre à jour, et une surface d'attaque supplémentaire sur la page qui
// affiche une adresse de paiement. Le format est figé depuis 2000 et tient en
// 300 lignes : il est moins cher de l'écrire que de le surveiller.
//
// ⭐⭐⭐ ET IL EST RENDU AU SERVEUR, PAS DANS LE NAVIGATEUR. L'adresse
// d'encaissement est une CONSTANTE du déploiement — la même pour tout le
// monde, c'est le MONTANT qui identifie le paiement, jamais l'adresse. Il n'y
// a donc rien à calculer chez le visiteur : le SVG part dans le HTML, déjà
// dessiné. Zéro octet de JavaScript, et un code QR qui s'affiche même si le
// script de la page ne s'exécute jamais.
//
// 🔑 CE QU'IL ENCODE, ET POURQUOI EXACTEMENT ÇA : `ethereum:<adresse>@8453`,
// c'est-à-dire MOT POUR MOT ce que porte déjà le bouton « ouvrir mon
// portefeuille » (`src/socle/modules/caisse.js`). ⛔ Deux cibles différentes
// pour un même geste, c'est la divergence garantie au premier lot qui touche
// l'une des deux. Le `8453` est l'identifiant de chaîne de Base.
//
// ⛔⛔ LE MONTANT N'EST PAS DANS LE CODE QR, ET C'EST UN ARBITRAGE, PAS UN
// OUBLI. La norme EIP-681 sait décrire un virement de jeton avec sa somme
// (`ethereum:<contrat>@8453/transfer?address=…&uint256=…`), et ce serait
// tentant : le montant EST le verrou, un portefeuille qui le pré-remplirait
// supprimerait le pire mode de panne de cette caisse (quelqu'un qui arrondit).
// ⇒ MAIS la prise en charge est inégale d'un portefeuille à l'autre, et le cas
// où elle rate est CATASTROPHIQUE : un portefeuille qui ignore la partie
// « jeton » propose d'envoyer 6,07 **ETH** au lieu de 6,07 USDC. Une panne
// rare qui coûte vingt mille dollars est pire qu'une gêne fréquente qui coûte
// trois secondes de recopie. ⭐ Le montant reste donc écrit en gros, en clair,
// à côté du code — là où il est déjà.

// ═══════════════════════════════════════════════════════════════════════════
//  ① LES TABLES DE LA NORME — versions 1 à 10, niveau de correction M
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ NIVEAU M (≈ 15 % de redondance), PAS L. Ce code sera lu sur un écran, par
//   un téléphone tenu à la main, parfois photographié de travers. M est le
//   niveau que la norme recommande par défaut, et il ne coûte ici qu'une
//   version de plus.
// ⛔ ON S'ARRÊTE À LA VERSION 10, ET C'EST DÉLIBÉRÉ : elle porte 213 octets,
//   soit près de quatre fois l'adresse la plus longue qu'on lui présentera
//   (`ethereum:` + 42 + `@8453` = 56). Déclarer les 40 versions aurait ajouté
//   trente chemins de code que rien n'emprunte — et *un chemin jamais emprunté
//   n'est pas sûr, il est non mesuré*. Au-delà, la fonction LÈVE.
//
// Chaque ligne : [ octets de données, octets de correction PAR BLOC,
//                  [nb blocs du groupe 1, octets de données par bloc],
//                  [nb blocs du groupe 2, octets de données par bloc] ]
const TABLE_M = {
  1:  [16,  10, [1, 16], null],
  2:  [28,  16, [1, 28], null],
  3:  [44,  26, [1, 44], null],
  4:  [64,  18, [2, 32], null],
  5:  [86,  24, [2, 43], null],
  6:  [108, 16, [4, 27], null],
  7:  [124, 18, [4, 31], null],
  8:  [154, 22, [2, 38], [2, 39]],
  9:  [182, 22, [3, 36], [2, 37]],
  10: [216, 26, [4, 43], [1, 44]],
};

// ⭐ Les centres des motifs d'alignement, par version. La version 1 n'en a
//   aucun : c'est la seule, et l'oublier produit un code lisible par certains
//   décodeurs et pas par d'autres — le pire des défauts.
const ALIGNEMENT = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

// ⚠️ LES BITS DE BOURRAGE FINAUX. La norme ajoute quelques bits nuls après les
//   octets, pour que la zone de données remplisse exactement la matrice. Ils
//   valent 0 partout sauf entre les versions 2 et 6 (7 bits). Les omettre
//   décale la lecture d'un bit et rend le code illisible — sans que rien ne
//   paraisse anormal à l'œil.
const RESTE_BITS = (v) => (v >= 2 && v <= 6 ? 7 : 0);

// ═══════════════════════════════════════════════════════════════════════════
//  ② LE CORPS DE GALOIS — l'arithmétique de la correction d'erreurs
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ Les tables se calculent au chargement plutôt que de s'écrire en dur : 512
//   nombres recopiés à la main, c'est 512 occasions de se tromper d'un chiffre
//   — et une erreur y produirait un code QR d'apparence normale que rien ne
//   lirait. Huit lignes de code sont plus sûres que deux cents de données.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;   // le polynôme générateur du corps, fixé par la norme
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Le polynôme générateur de degré `n` : le produit des (x − α^i), i de 0 à n−1.
 *
 * ⚠️ LES COEFFICIENTS VONT DU PLUS HAUT DEGRÉ AU PLUS BAS, et `correction()`
 * en dépend : elle suppose `g[0] === 1` pour annuler le terme de tête à chaque
 * pas de la division.
 *
 * 🔴🔴🔴 PREMIÈRE VERSION : LE POLYNÔME ÉTAIT CONSTRUIT À L'ENVERS. Les deux
 *   lignes du produit étaient interverties (`suivant[j] ^= g[j] · α^i` au lieu
 *   de `suivant[j+1]`), ce qui rend le polynôme MIROIR — coefficients justes,
 *   ordre inversé. Conséquence mesurée : les 16 octets de données sortaient
 *   parfaitement, les 10 octets de correction étaient tous faux, et **aucun
 *   lecteur ne décodait le code**.
 *   ⭐⭐⭐ Et rien ne le disait à l'œil : la matrice avait ses trois cibles, sa
 *   synchronisation, son format, sa taille. Elle ressemblait exactement à un
 *   code QR. *Un code QR d'apparence normale que rien ne lit est le mode de
 *   panne par défaut de ce format* — c'est pour ça que ce module se mesure en
 *   DÉCODANT sa propre sortie, jamais en la regardant.
 */
function generateur(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const suivant = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      suivant[j] ^= g[j];                     // × x
      suivant[j + 1] ^= mul(g[j], EXP[i]);    // × α^i
    }
    g = suivant;
  }
  return g;
}

/** Les `n` octets de correction d'un bloc de données. */
function correction(donnees, n) {
  const g = generateur(n);
  const reste = new Uint8Array(donnees.length + n);
  reste.set(donnees);
  for (let i = 0; i < donnees.length; i++) {
    const facteur = reste[i];
    if (facteur === 0) continue;
    for (let j = 0; j < g.length; j++) reste[i + j] ^= mul(g[j], facteur);
  }
  return reste.slice(donnees.length);
}

// ═══════════════════════════════════════════════════════════════════════════
//  ③ LES CODES BCH — format et version, calculés et non recopiés
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ MÊME RAISON QUE LES TABLES DE GALOIS. Les 32 mots de format et les 34 mots
//   de version sont publiés en annexe de la norme ; les recopier, c'est se
//   fier à une transcription qu'aucun contrôle ne relira. Calculés, ils sont
//   justes par construction — et le banc les recompare de toute façon à une
//   sortie indépendante.
// 🔴🔴🔴 PREMIÈRE VERSION : BOUCLE INFINIE, ET ELLE N'A RIEN AFFICHÉ.
//   Le décalage se calculait avec `for (t = d; t >= haut; t >>>= 1) decalage++`
//   — un cran de trop : l'alignement doit amener le bit de tête du générateur
//   SOUS celui de `d`, pas en dessous. Le `^=` ne retirait donc jamais le bit
//   de tête, et la boucle tournait pour toujours. ⚠️ Une boucle infinie dans
//   un module importé au BUILD ne rougit pas : le build **se fige en silence**,
//   et le journal Coolify s'arrête de toute façon à la 10ᵉ seconde.
//   ⭐ La longueur en bits, nommée, plutôt qu'un compteur dans la condition.
const longueurBits = (x) => { let n = 0; while (x) { n++; x >>>= 1; } return n; };
function bch(valeur, generateur_, largeur) {
  let d = valeur << (largeur - 1);
  while (longueurBits(d) >= largeur) d ^= generateur_ << (longueurBits(d) - largeur);
  return d;
}
// ⚠️ Le niveau M vaut `00` dans les deux bits de niveau, et le tout se
//   masque par `0x5412` — sans ce masque, un code au masque 0 et au niveau M
//   aurait un format entièrement nul, indiscernable d'une zone vide.
const motFormat = (masque) => {
  const v = (0b00 << 3) | masque;
  return ((v << 10) | bch(v, 0b10100110111, 11)) ^ 0b101010000010010;
};
const motVersion = (v) => (v << 12) | bch(v, 0b1111100100101, 13);

// ═══════════════════════════════════════════════════════════════════════════
//  ④ LA MATRICE
// ═══════════════════════════════════════════════════════════════════════════

/** Les octets UTF-8 d'un texte. ⭐ `TextEncoder` plutôt qu'une boucle sur les
 *  points de code : une adresse est en ASCII, mais rien ne garantit que ce
 *  module ne servira qu'à ça, et une boucle écrite à la main se trompe sur les
 *  paires de substitution. */
const octets = (texte) => new TextEncoder().encode(String(texte));

/** La plus petite version qui accepte `n` octets en mode binaire.
 *  ⛔ Elle LÈVE au-delà de la version 10 plutôt que de rendre `null` : un
 *  appelant qui ne regarde pas la valeur de retour dessinerait une matrice
 *  vide, et un carré blanc à la place d'un code QR ne se voit pas en revue. */
export function versionPour(n) {
  for (let v = 1; v <= 10; v++) {
    // ⚠️ L'indicateur de longueur pèse 8 bits jusqu'à la version 9 et 16 à
    //    partir de la 10 : le compter à 8 partout ferait déborder la version 10
    //    d'un octet, exactement au bord de la table.
    const enTete = 4 + (v >= 10 ? 16 : 8);
    if (n * 8 + enTete <= TABLE_M[v][0] * 8) return v;
  }
  throw new Error(`qr: ${n} octets — au-delà de la version 10 (213 octets), volontairement non pris en charge`);
}

/** Les octets de données, en-tête et bourrage compris. */
function motsDonnees(oct, version) {
  const capacite = TABLE_M[version][0];
  const bits = [];
  const pousser = (valeur, largeur) => {
    for (let i = largeur - 1; i >= 0; i--) bits.push((valeur >> i) & 1);
  };
  pousser(0b0100, 4);                                  // mode binaire
  pousser(oct.length, version >= 10 ? 16 : 8);         // longueur
  for (const o of oct) pousser(o, 8);
  // ⭐ Le terminateur fait AU PLUS quatre bits : s'il ne reste que deux places,
  //   on n'en écrit que deux. Un terminateur de longueur fixe déborderait la
  //   capacité sur un message qui la remplit exactement.
  for (let i = 0; i < 4 && bits.length < capacite * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const mots = [];
  for (let i = 0; i < bits.length; i += 8) {
    let o = 0;
    for (let j = 0; j < 8; j++) o = (o << 1) | bits[i + j];
    mots.push(o);
  }
  // ⚠️ LE BOURRAGE ALTERNE 0xEC ET 0x11, ET CE N'EST PAS ARBITRAIRE : la norme
  //    l'impose, et deux octets qui alternent évitent une grande plage
  //    uniforme — donc une pénalité de masque énorme sur les messages courts.
  const REMPLISSAGE = [0xec, 0x11];
  for (let i = 0; mots.length < capacite; i++) mots.push(REMPLISSAGE[i % 2]);
  return mots;
}

/** L'entrelacement : blocs de données, puis blocs de correction, colonne par
 *  colonne. ⛔ Concaténer les blocs bout à bout produit un code QR
 *  PARFAITEMENT FORMÉ que rien ne décode — le genre de faute qu'on ne trouve
 *  qu'en essayant de le lire pour de vrai. */
function entrelacer(mots, version) {
  const [, nEc, g1, g2] = TABLE_M[version];
  const blocs = [];
  let i = 0;
  for (const [nb, taille] of [g1, g2].filter(Boolean)) {
    for (let b = 0; b < nb; b++) { blocs.push(mots.slice(i, i + taille)); i += taille; }
  }
  const ec = blocs.map((b) => correction(Uint8Array.from(b), nEc));
  const sortie = [];
  const maxi = Math.max(...blocs.map((b) => b.length));
  for (let k = 0; k < maxi; k++) for (const b of blocs) if (k < b.length) sortie.push(b[k]);
  for (let k = 0; k < nEc; k++) for (const b of ec) sortie.push(b[k]);
  return sortie;
}

const MASQUES = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** Les quatre pénalités de la norme. ⭐ On les calcule TOUTES et on garde le
 *  masque le moins pénalisé — c'est ce que fait la norme, et c'est ce qui rend
 *  la sortie comparable à celle de n'importe quel autre encodeur conforme.
 *  ⛔ Choisir un masque fixe « qui marche » donnerait un code lisible mais
 *  DIFFÉRENT de toute référence : plus rien ne serait mesurable. */
function penalite(m, n) {
  const a = (r, c) => m[r * n + c];
  let p = 0;
  // ① séries de cinq modules identiques ou plus
  for (let i = 0; i < n; i++) {
    for (const ligne of [true, false]) {
      let court = 1;
      for (let j = 1; j < n; j++) {
        const ici = ligne ? a(i, j) : a(j, i);
        const avant = ligne ? a(i, j - 1) : a(j - 1, i);
        if (ici === avant) court++;
        else { if (court >= 5) p += court - 2; court = 1; }
      }
      if (court >= 5) p += court - 2;
    }
  }
  // ② carrés de 2 × 2 de même couleur
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const v = a(r, c);
    if (v === a(r, c + 1) && v === a(r + 1, c) && v === a(r + 1, c + 1)) p += 3;
  }
  // ③ le motif 1:1:3:1:1 suivi ou précédé de quatre blancs
  const MOTIF = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const MOTIF2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  for (let i = 0; i < n; i++) for (let j = 0; j <= n - 11; j++) {
    for (const ligne of [true, false]) {
      let ok1 = true, ok2 = true;
      for (let k = 0; k < 11; k++) {
        const v = ligne ? a(i, j + k) : a(j + k, i);
        if (v !== MOTIF[k]) ok1 = false;
        if (v !== MOTIF2[k]) ok2 = false;
      }
      if (ok1) p += 40;
      if (ok2) p += 40;
    }
  }
  // ④ le déséquilibre entre modules sombres et clairs
  let sombres = 0;
  for (let i = 0; i < n * n; i++) sombres += m[i];
  const pourcent = (sombres * 100) / (n * n);
  p += Math.floor(Math.abs(pourcent - 50) / 5) * 10;
  return p;
}

/**
 * La matrice d'un code QR, niveau M, mode binaire.
 * @returns {{ version:number, taille:number, masque:number, modules:Uint8Array }}
 *   `modules[r * taille + c]` vaut 1 pour un module sombre.
 */
export function matrice(texte) {
  const oct = octets(texte);
  const version = versionPour(oct.length);
  const n = 17 + version * 4;
  const flux = entrelacer(motsDonnees(oct, version), version);

  // ⭐ DEUX PLANS, ET C'EST LA CLÉ DE TOUT LE PLACEMENT : `mod` porte la
  //   couleur, `fixe` dit « ce module appartient à un motif de service ». Sans
  //   le second, le parcours des données écraserait les repères — ou les
  //   éviterait par des conditions recopiées à cinq endroits, qui divergeraient.
  const mod = new Uint8Array(n * n);
  const fixe = new Uint8Array(n * n);
  const poser = (r, c, v) => { mod[r * n + c] = v; fixe[r * n + c] = 1; };

  // les trois motifs de détection, et leur séparateur blanc
  for (const [dr, dc] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const y = dr + r, x = dc + c;
      if (y < 0 || y >= n || x < 0 || x >= n) continue;
      // 🔴🔴🔴 LE SÉPARATEUR EST BLANC, ET LA PREMIÈRE VERSION LE PEIGNAIT NOIR.
      //   La boucle balaie de -1 à 7 pour couvrir motif ET séparateur d'un
      //   coup — mais la règle « bord » (`r===0 || r===6 || …`) s'appliquait
      //   AUSSI en dehors du carré 0..6 : la case (0, 7), qui est du
      //   séparateur, passait pour un bord de motif. Résultat : huit modules
      //   sombres d'affilée là où la norme en veut sept, et 420 modules
      //   différents d'une référence indépendante.
      //   ⭐ La condition d'APPARTENANCE d'abord, la règle de couleur ensuite.
      const dansMotif = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const bord = dansMotif && (r === 0 || r === 6 || c === 0 || c === 6);
      const coeur = dansMotif && r >= 2 && r <= 4 && c >= 2 && c <= 4;
      poser(y, x, bord || coeur ? 1 : 0);
    }
  }
  // les lignes de synchronisation
  for (let i = 8; i < n - 8; i++) { poser(6, i, i % 2 === 0 ? 1 : 0); poser(i, 6, i % 2 === 0 ? 1 : 0); }
  // ── les motifs d'alignement ──────────────────────────────────────────────
  // 🔴🔴🔴 ON N'EN SAUTE QUE TROIS, ET LA LISTE EST EXPLICITE. La première
  //   version écrivait `if (fixe[…]) continue;` — « s'il y a déjà quelque
  //   chose ici, passe ». C'est faux : un motif d'alignement CHEVAUCHE
  //   légitimement la ligne de synchronisation, et il doit s'écrire par-dessus.
  //   ⚠️ ET LE MODE DE PANNE EST BRUTAL : un motif sauté laisse ses 25 cases
  //   NON RÉSERVÉES, donc le parcours des données les remplit — tout le flux
  //   se décale de 25 modules à partir de là.
  //   ⭐⭐⭐ MESURÉ, ET C'EST CE QUI L'A TROUVÉ : les versions 1 à 6 décodaient,
  //   les versions 7 à 10 non. La 7 est la première dont un centre
  //   d'alignement (6, 22) tombe SUR la synchronisation — en dessous, les
  //   centres tombaient tous à côté et la faute dormait.
  //   ⇒ Les seuls à ne pas dessiner sont les trois qui tomberaient dans un
  //   motif de DÉTECTION : (6,6), (6, n−7), (n−7, 6). C'est une liste de
  //   trois cas nommés, pas une condition qui devine.
  const centres = ALIGNEMENT[version];
  const coinDeDetection = (r, c) => (r === 6 && c === 6)
    || (r === 6 && c === n - 7) || (r === n - 7 && c === 6);
  for (const r of centres) for (const c of centres) {
    if (coinDeDetection(r, c)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const bord = Math.abs(dr) === 2 || Math.abs(dc) === 2;
      poser(r + dr, c + dc, bord || (dr === 0 && dc === 0) ? 1 : 0);
    }
  }
  // ⚠️ LE MODULE TOUJOURS SOMBRE. Une seule case, jamais expliquée par la
  //    norme, et son oubli ne se voit pas : le code reste beau et ne se lit pas.
  poser(n - 8, 8, 1);

  // les emplacements du format (réservés maintenant, remplis après le masque)
  // 🔴🔴🔴 L'ORDRE DES BITS DE FORMAT N'EST PAS UNE LISTE DE CASES, C'EST UNE
  //   FONCTION DU NUMÉRO DE BIT. La première version empilait `[8,i]` et
  //   `[i,8]` en alternance dans une seule boucle — les quinze bits partaient
  //   donc entrelacés entre les deux copies. Le code restait parfaitement
  //   formé, et aucun lecteur au monde ne l'aurait décodé : le format dit le
  //   masque, et un masque faux rend TOUTE la zone de données fausse.
  // ⭐ On indexe donc PAR BIT (0 = poids faible), et chaque bit connaît ses
  //   DEUX emplacements — les deux copies sont posées par la même expression,
  //   donc elles ne peuvent pas diverger.
  const CASES_FORMAT = [];
  for (let i = 0; i < 15; i++) {
    // ⚠️ EN [LIGNE, COLONNE], ET LA PREMIÈRE VERSION LES AVAIT TRANSPOSÉS.
    //   Les descriptions publiées de la norme écrivent ce placement en
    //   (x, y) — donc (colonne, ligne). Recopié tel quel dans un dépôt qui
    //   indexe en [ligne, colonne], le format part en miroir : la bande
    //   verticale devient horizontale. 170 modules faux, code illisible, et
    //   RIEN à l'œil pour le dire.
    const a1 = i < 6 ? [i, 8] : i === 6 ? [7, 8] : i === 7 ? [8, 8] : i === 8 ? [8, 7] : [8, 14 - i];
    const a2 = i < 8 ? [8, n - 1 - i] : [n - 15 + i, 8];
    CASES_FORMAT.push([a1, a2]);
  }
  for (const paire of CASES_FORMAT) for (const [r, c] of paire) fixe[r * n + c] = 1;
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      fixe[Math.floor(i / 3) * n + (n - 11 + (i % 3))] = 1;
      fixe[(n - 11 + (i % 3)) * n + Math.floor(i / 3)] = 1;
    }
  }

  // ── le parcours en zigzag, depuis le coin bas-droit ──────────────────────
  const bits = [];
  for (const o of flux) for (let i = 7; i >= 0; i--) bits.push((o >> i) & 1);
  for (let i = 0; i < RESTE_BITS(version); i++) bits.push(0);
  let k = 0, montant = true;
  for (let cd = n - 1; cd > 0; cd -= 2) {
    // ⚠️ LA COLONNE 6 EST SAUTÉE : c'est la ligne de synchronisation verticale.
    //    Sans ce saut, tout le flux se décale d'une colonne à partir du milieu.
    const colonne = cd <= 6 ? cd - 1 : cd;
    for (let i = 0; i < n; i++) {
      const r = montant ? n - 1 - i : i;
      for (const c of [colonne, colonne - 1]) {
        if (fixe[r * n + c]) continue;
        mod[r * n + c] = k < bits.length ? bits[k] : 0;
        k++;
      }
    }
    montant = !montant;
  }

  // ── le masque : on les essaie tous les huit ──────────────────────────────
  let meilleur = 0, meilleurScore = Infinity, meilleurPlan = null;
  for (let m = 0; m < 8; m++) {
    const essai = Uint8Array.from(mod);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!fixe[r * n + c] && MASQUES[m](r, c)) essai[r * n + c] ^= 1;
    }
    // ⭐⭐⭐ LE FORMAT EST ÉCRIT AVANT DE PÉNALISER, ET C'EST UNE FAUTE CLASSIQUE
    //   DE NE PAS LE FAIRE : la norme note la matrice COMPLÈTE. Pénaliser une
    //   matrice sans son format choisit un autre masque que tous les autres
    //   encodeurs — le code reste lisible, mais plus rien n'est comparable, et
    //   le banc accuserait le code au lieu de l'ordre des opérations.
    const f = motFormat(m);
    CASES_FORMAT.forEach((paire, i) => {
      const b = (f >> i) & 1;
      for (const [r, c] of paire) essai[r * n + c] = b;
    });
    const s = penalite(essai, n);
    if (s < meilleurScore) { meilleurScore = s; meilleur = m; meilleurPlan = essai; }
  }

  if (version >= 7) {
    const vBits = motVersion(version);
    for (let i = 0; i < 18; i++) {
      const b = (vBits >> i) & 1;
      meilleurPlan[Math.floor(i / 3) * n + (n - 11 + (i % 3))] = b;
      meilleurPlan[(n - 11 + (i % 3)) * n + Math.floor(i / 3)] = b;
    }
  }
  return { version, taille: n, masque: meilleur, modules: meilleurPlan };
}

// ═══════════════════════════════════════════════════════════════════════════
//  ⑤ LE RENDU — un SVG, et rien d'autre
// ═══════════════════════════════════════════════════════════════════════════

/** L'adresse de paiement telle qu'un portefeuille l'attend.
 *  ⭐ ELLE EST FABRIQUÉE ICI, EN UN SEUL ENDROIT, et le pilote de l'écran
 *  d'achat en fait autant pour son bouton. Le jour où la chaîne change, les
 *  deux doivent bouger — ce point unique est ce qui rendra l'oubli visible. */
export const adressePaiement = (adresse, chaine = 8453) => `ethereum:${adresse}@${chaine}`;

/**
 * Le code QR, en SVG autonome.
 * ⭐ UN SEUL `<path>`, PAS UN `<rect>` PAR MODULE — et les chiffres sont
 *   MESURÉS, pas estimés (25/08, sur l'adresse de production, v4, 573 modules
 *   sombres) : **24 260 o** avec un rectangle par module, **4 229 o** avec un
 *   chemin unique (**1 026 o une fois gzippé**). Sur `/compte/`, qui est
 *   `no-store`, ces octets repartent de l'origine à chaque visite.
 *   ⚠️ La première rédaction de ce commentaire annonçait « ~1,3 Ko » de tête.
 *   C'était faux d'un facteur trois. *Un chiffre écrit sans être mesuré est un
 *   chiffre faux qui traverse toutes les revues*, parce que personne ne relit
 *   un ordre de grandeur plausible.
 * ⭐ `shape-rendering="crispEdges"` : sans lui, l'antialiasing du navigateur
 *   grise le bord des modules et les lecteurs les plus stricts refusent le code
 *   sur un petit écran.
 * ⚠️ LA MARGE BLANCHE EST OBLIGATOIRE (« quiet zone », 4 modules). Ce n'est pas
 *   de la mise en page : un décodeur a besoin de ce blanc pour trouver les
 *   bords. Un code collé à un fond sombre ne se lit pas, et l'erreur ressemble
 *   à un problème d'appareil photo.
 */
export function svg(texte, { marge = 4, taille = 220, titre = '' } = {}) {
  const { modules, taille: n } = matrice(texte);
  const total = n + marge * 2;
  let d = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!modules[r * n + c]) { c++; continue; }
      let large = 1;
      while (c + large < n && modules[r * n + c + large]) large++;
      d += `M${c + marge} ${r + marge}h${large}v1h-${large}z`;
      c += large;
    }
  }
  // ⛔ `currentColor` POUR LES MODULES, `#fff` EN DUR POUR LE FOND. Le site a
  //    un thème sombre : un fond transparent laisserait passer le noir, et un
  //    code QR sombre sur sombre n'existe pas. C'est le seul endroit du dépôt
  //    où une couleur est écrite en dur, et c'est parce qu'elle n'est pas une
  //    couleur de thème — c'est une contrainte du format.
  const etiquette = titre
    ? `<title>${String(titre).replace(/[<&>]/g, (x) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[x]))}</title>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}"`
    + ` width="${taille}" height="${taille}" shape-rendering="crispEdges"`
    + ` role="img"${titre ? '' : ' aria-hidden="true"'}>${etiquette}`
    + `<rect width="${total}" height="${total}" fill="#fff"/>`
    + `<path d="${d}" fill="#000"/></svg>`;
}
