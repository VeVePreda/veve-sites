// ⚠️ VeVePreda/veve-sites — engine/lib/entetes_attendus.mjs   (FICHIER NEUF)
// ═══════════════════════════════════════════════════════════════════════════
//  LA DÉCLARATION DES EN-TÊTES DE SÉCURITÉ — la moitié du dépôt qui SAIT
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 POURQUOI CE FICHIER EXISTE. Les en-têtes de sécurité de ce réseau ne
// vivent PAS dans le dépôt : ils sont posés dans CLOUDFLARE (Zone → Rules →
// Overview → règle `en-tetes-securite`, Response Header Transform Rule).
// C'est une décision de Preda du 11/08/2026, prise en connaissance de cause —
// elle achète la réversibilité en un clic là où nginx demande 11 à 13 minutes
// de déploiement.
// ⛔ MAIS UNE DÉCISION QUI SORT L'ÉTAT DU DÉPÔT LE REND INVISIBLE : si
// quelqu'un supprime la règle, ou si un réglage est réinitialisé, RIEN ne
// rougit. C'est « posé ≠ branché ».
// ⇒ Ce fichier est la liste DÉCLARÉE, versionnée, relisible ; `test_entetes.mjs`
//   est ce qui la RÉCLAME. Les deux ensemble referment le circuit.
//
// ⛔⛔ UNE RÈGLE PAR ZONE, ELLE NE VOYAGE PAS. `veveprice.com` et `vevewiki.com`
// sont deux zones Cloudflare distinctes : tout ajout se fait DEUX fois. Mesuré
// le 11/08 — après la pose sur veveprice, vevewiki était encore nu.
//
// ⭐ SI VOUS MODIFIEZ UN RÉGLAGE CLOUDFLARE, MODIFIEZ CE FICHIER DANS LE MÊME
//   GESTE. À partir de l'instant où les deux divergent, l'un des deux ment, et
//   le banc dira lequel.

// ═══════════════════════════════════════════════════════════════════════════
// 1. LES EN-TÊTES ATTENDUS
// ═══════════════════════════════════════════════════════════════════════════
//
// `genre` dit COMMENT on juge la valeur, et c'est volontairement varié :
//   'present'          — il suffit qu'il soit là (la valeur exacte peut évoluer)
//   'egal'             — la valeur doit être exactement celle-ci
//   'plancher-max-age' — ⭐ un PLANCHER, jamais une égalité : il rougit si la
//                        valeur BAISSE, il se tait si elle monte. Un intervalle
//                        se teste par ses deux extrémités ; ici, la borne qui
//                        protège est la basse.

export const ENTETES_ATTENDUS = {
  'strict-transport-security': {
    genre: 'plancher-max-age',
    plancher: 604800, // 7 j — relevé le 11/08/2026, VOIR L'ÉCHELLE PLUS BAS
    // ⛔ CES DEUX DIRECTIVES SONT REFUSÉES, ET CE N'EST PAS UN OUBLI.
    //   `includeSubDomains` engagerait des sous-domaines qui n'existent pas
    //   encore. `preload` inscrit le domaine dans une liste gravée DANS LES
    //   NAVIGATEURS, dont on ne sort pas en quelques mois.
    // 🔴 Le banc les cherche dans la valeur SERVIE, pas seulement ici : une
    //   directive irréversible glissée au bord doit se voir le jour même.
    interdits: ['includesubdomains', 'preload'],
    pourquoi: 'HSTS force HTTPS côté navigateur. La montée est irréversible : ' +
      'retirer la règle ne retire rien, les navigateurs gardent la valeur vue ' +
      "jusqu'à son terme.",
  },
  'permissions-policy': {
    genre: 'present',
    exemple: 'geolocation=(), camera=(), microphone=()',
    pourquoi: 'Refuse à la page et à ses iframes des capacités que ce site ' +
      "n'utilise pas.",
  },
  'referrer-policy': {
    genre: 'present',
    exemple: 'strict-origin-when-cross-origin',
    pourquoi: "Empêche l'adresse complète d'une page de fuiter vers un tiers.",
  },
  'x-content-type-options': {
    genre: 'egal',
    valeur: 'nosniff',
    pourquoi: 'Interdit au navigateur de deviner un type MIME — la valeur est ' +
      'normée, une égalité est donc légitime ici.',
  },
  'x-frame-options': {
    genre: 'present',
    exemple: 'SAMEORIGIN',
    pourquoi: 'Interdit la mise en cadre du site par un tiers (clickjacking).',
  },
};

// ⛔ LA CSP N'EST PAS DANS CETTE LISTE, ET C'EST DÉLIBÉRÉ.
//   Le site émet des `<script is:inline>` sur toutes les pages (~31 Ko par
//   fiche, P27). Une CSP stricte les tuerait sans `hash` ni `nonce`.
//   ⇒ LA CSP SUIT LA SORTIE DES SCRIPTS (OPT‑3), ELLE NE LA PRÉCÈDE JAMAIS.
//   Le jour venu : une troisième action dans la même règle Cloudflare, plus une
//   entrée ici, plus le banc qui la réclame — dans cet ordre.
export const CSP_VOLONTAIREMENT_ABSENTE = true;

// ═══════════════════════════════════════════════════════════════════════════
// 2. L'ÉCHELLE HSTS — le cliquet
// ═══════════════════════════════════════════════════════════════════════════
//
// 🪜  300 s ✅ → 86400 (24 h) ✅ → 604800 (7 j) ✅ ← ON EST ICI → 15552000 (6 mois)
//
// 📅 MONTÉ À 604800 LE 11/08/2026, sur les DEUX zones, dans le même geste que
//   ce `plancher`. Mesuré après pose : `max-age=604800` sur `/`, `/sitemap.xml`
//   ET un 404, zone par zone ; `test:entetes` exit 0, 32 requêtes.
// ⛔ LE BARREAU DES 6 MOIS A ÉTÉ ÉCARTÉ VOLONTAIREMENT, ET C'EST UNE DÉCISION,
//   pas un oubli. Sauter un barreau ne coûte rien tant que tout va bien ; le
//   jour où le HTTPS tombe, il décide si la panne dure une semaine ou six mois.
//   ⭐ La question à se poser avant de monter n'est pas « est-ce que ça marche
//   aujourd'hui ? » mais « combien de temps une erreur resterait-elle ? »
// ⏭️ PROCHAIN BARREAU : 15552000, pas avant le 18/08/2026 (une durée complète
//   écoulée sans incident HTTPS sur les deux zones). Le relever ici DANS LE
//   MÊME GESTE, sinon ce plancher se désarme tout seul.
//
// ⭐ LA MONTÉE EST IRRÉVERSIBLE, LA DESCENTE N'EXISTE PAS. Pendant toute la
//   durée en cours : ⛔ ne pas mettre Cloudflare en pause, ⛔ ne pas basculer le
//   DNS de *Proxied* à *DNS only*, ⛔ ne pas laisser un certificat expirer.
//
// ⛔ RELEVER `plancher` FAIT PARTIE DE LA MONTÉE, au même titre que le clic dans
//   Cloudflare. Un plancher qu'on oublie de relever ne se plaint pas — il se
//   désarme tout seul, par le simple passage du temps. C'est exactement ce qui
//   est arrivé au plancher de la chaîne de bancs, resté à 25 pendant qu'elle
//   montait à 40 : il autorisait quinze suppressions en silence.
export const ECHELLE_HSTS = [300, 86400, 604800, 15552000];

// ═══════════════════════════════════════════════════════════════════════════
// 3. LES ZONES — les deux, toujours
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐ LE BANC INTERROGE LES DEUX ZONES À CHAQUE EXÉCUTION, quel que soit `SITE`.
//   S'il n'en vérifiait qu'une par site, le jour où un site sort de la matrice
//   sa zone ne serait plus vérifiée par personne — et rien ne le dirait.
//   C'est `regle-circuit-ouvert` appliquée à la matrice elle-même.
export const ZONES = [
  { nom: 'veveprice.com', base: 'https://veveprice.com' },
  { nom: 'vevewiki.com', base: 'https://vevewiki.com' },
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. LES CIBLES — et pourquoi ce ne sont PAS que des pages qui existent
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 C'EST ICI QU'ÉTAIT LE DÉFAUT DU 11/08. L'audit du 10/08 déclarait
// `referrer-policy`, `x-content-type-options` et `x-frame-options` « ✅
// présents ». Il n'avait ouvert que l'accueil et des pages internes. Le 404 les
// contredit tous les trois.
// ⇒ TOUT AUDIT D'EN-TÊTES OUVRE UN 404 ET UN FICHIER STATIQUE. Un contrôle qui
//   ne regarde que ce qui existe ne voit jamais ce qui manque.
//
// ⭐ `statique: true` = adresse DÉCOUVERTE sur l'accueil, jamais figée : le nom
//   du thème porte un hachage qui change à chaque build (`/theme-<hash>.css`).
//   Une adresse figée ici rendrait le banc 404 au premier déploiement, et il
//   rougirait pour une raison qui n'est pas la sienne.
export const CIBLES = [
  { cle: 'accueil', chemin: '/', quoi: 'la page servie au visiteur' },
  { cle: 'sitemap', chemin: '/sitemap.xml', quoi: 'un fichier généré' },
  { cle: 'robots', chemin: '/robots.txt', quoi: 'un fichier statique de racine' },
  { cle: '404', fabrique404: true, quoi: 'une page qui N\'EXISTE PAS' },
  { cle: 'statique', decouvreCss: true, quoi: 'la feuille de style servie' },
];

// ═══════════════════════════════════════════════════════════════════════════
// 5. LES EXCEPTIONS — nommées, datées, et RÉVOQUÉES DÈS QU'ELLES SERVENT PLUS
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐ UNE EXCEPTION EST UN AVERTISSEMENT, ET UN AVERTISSEMENT SURVIT À SA CAUSE.
//   Trois exemplaires ont été trouvés le même jour dans ce projet (« les cartes
//   À venir ne sont pas cliquables, c'est structurel » — faux ; « favoris : rien
//   nulle part » — faux depuis onze lots ; « `.col-carte__v` est émise » — elle
//   ne l'est plus).
// ⇒ LE BANC SIGNALE UNE EXCEPTION DEVENUE INUTILE. Le jour où la cible porte
//   ses en-têtes, l'exception doit sauter — sinon elle protégerait un défaut
//   futur en croyant protéger un défaut passé.
export const EXCEPTIONS = [
  {
    cible: 'robots',
    zones: ['veveprice.com', 'vevewiki.com'],
    entetes: '*', // aucun en-tête attendu sur cette cible
    // 🔴 MESURÉ LE 11/08/2026, ET CE N'EST NI NGINX NI LA TRANSFORM RULE.
    //   `GET /robots.txt` rend 1 948 o SANS AUCUN en-tête (HSTS compris),
    //   là où `HEAD /robots.txt` rend 112 o AVEC tous les en-têtes et
    //   `cf-cache-status: HIT`. Deux réponses différentes pour une même adresse.
    //   Cause : Cloudflare « Managed robots.txt » (Content Signals Policy)
    //   GÉNÈRE la réponse au bord, en préfixant le fichier de l'origine. Cette
    //   réponse-là NE TRAVERSE PAS les Transform Rules.
    // ⛔ Ni le edge ni nginx ne peuvent la corriger : l'origine n'est jamais
    //   atteinte, et la règle ne s'applique pas. La seule sortie serait de
    //   désactiver Managed robots.txt.
    // ✅ DÉCISION DE PREDA, 11/08/2026 : ON LE GARDE. « Indexez-moi, n'entraînez
    //   pas sur moi. » Les signaux servis sont `search=yes, ai-input=no,
    //   ai-train=no`, et les trois crawlers d'entraînement bloqués sont
    //   `GPTBot`, `Google-Extended` et `meta-externalagent`.
    //   ⭐ `Google-Extended` NE PILOTE PAS Google Search : le bloquer ne retire
    //   rien au référencement, il ne gouverne que l'entraînement de Gemini.
    //   C'est le point que tout le monde confond, et c'est ce qui rend cette
    //   décision compatible avec « la véracité avant le SEO ».
    //   ⚠️ Ces signaux sont une réservation de droits (directive UE 2019/790,
    //   art. 4), pas un verrou : un crawler qui les ignore passe quand même.
    // ⭐ Portée réelle de l'écart : un fichier texte public, sans rendu, sans
    //   cookie. `x-frame-options` sur un `text/plain` ne protège rien. L'écart
    //   est cosmétique pour un scanner, nul pour un attaquant.
    // ⛔ Le contenu du site est PRÉSERVÉ — mesuré : Cloudflare PRÉFIXE, il ne
    //   remplace pas. Le `Sitemap:` et les `Disallow:` du dépôt sont intacts.
    //   Si un jour ils disparaissaient, ce serait une régression SEO muette.
    pourquoi: 'Cloudflare Managed robots.txt (Content Signals) génère la ' +
      'réponse au bord ; elle ne traverse pas les Transform Rules. ' +
      'Mesuré le 11/08/2026, GET ≠ HEAD sur la même adresse. ' +
      'Conservé volontairement (Preda, 11/08) : indexation oui, entraînement non.',
    revoirLe: '2026-11-11',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 6. LES RÉGLAGES DE MESURE
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ TROIS PASSAGES, JAMAIS UN SEUL APPEL. Le 11/08, une mesure lancée dans la
// seconde suivant le déploiement déclarait `Permissions-Policy` absente sur
// 2 URL sur 5. C'était faux : la règle se propageait encore.
// ⭐⭐ UNE MESURE PAS ENCORE MÛRE ET UN VRAI DÉFAUT SE RESSEMBLENT — et ils sont
//   l'inverse. Cousine de « une mesure qui périme et une pas encore mûre se
//   ressemblent ».
// ⇒ Après TOUTE modification d'une règle Cloudflare : `--attendre` (75 s) avant
//   de conclure. En usage courant, les 3 passages suffisent.
export const PASSAGES = 3;
export const PAUSE_MS = 1500;
export const ATTENTE_PROPAGATION_MS = 75_000;
export const DELAI_MS = 20_000;

// 🔴🔴 LA MÉTHODE EST `GET`, ET C'EST UNE MESURE, PAS UNE PRÉFÉRENCE.
//   `HEAD` et `GET` rendent des réponses DIFFÉRENTES sur ce réseau (voir
//   l'exception `robots` ci-dessus). Un banc qui mesure en HEAD mesure une
//   réponse qu'aucun visiteur ne reçoit.
export const METHODE = 'GET';
