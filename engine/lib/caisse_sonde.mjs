// ⚠️ VeVePreda/veve-sites — engine/lib/caisse_sonde.mjs   (FICHIER NEUF — lot 199)
// ═══════════════════════════════════════════════════════════════════════════
//  LA SONDE DE LA CAISSE — « ce conteneur peut-il lire le réseau Base ? »
// ═══════════════════════════════════════════════════════════════════════════
//
// 💳 LE BESOIN, DIT PAR PREDA LE 25/08/2026 : « recevoir des usdc/usdt sur le
// reseau base et que ça donne automatiquement le role qu'ils sont acheter pour
// la durée. » Encaisser nous-mêmes exige UNE chose du serveur, et une seule :
// qu'il puisse interroger un noeud Base en HTTPS sortant.
//
// 🔴🔴🔴 ET C'ÉTAIT LE SEUL POINT INDÉCIDABLE DU CHANTIER. Mesuré le 25/08
// depuis le bac à sable : `mainnet.base.org` répond, `eth_getLogs` est plafonné
// à 10 000 blocs, la latence va de 0,2 s à 1,2 s. Mais le bac à sable N'EST PAS
// le conteneur : veveprice ne `fetch` aujourd'hui que `id.digitalcollectible.net`,
// qui vit sur la MÊME machine. Rien, nulle part, ne prouve que le conteneur
// Coolify joint un hôte de l'internet public.
// ⭐⭐⭐ *Le bac à sable prédit le code, jamais la machine.* Ce fichier ne fait
// donc RIEN d'utile au site : il rend une question mesurable depuis n'importe
// quel navigateur, avant qu'on écrive les huit cents lignes qui en dépendent.
//
// ⛔ CE MODULE NE TOUCHE NI CLÉ, NI ARGENT, NI COMMANDE. Il lit un numéro de
// bloc public. Le jour où il rougit, on saura que le collecteur doit vivre
// ailleurs qu'ici — et on l'aura su AVANT de le construire.

// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ LE DÉCLENCHEUR EST `CAISSE_ADRESSE`, ET LE CHOIX EST MESURÉ
// ═══════════════════════════════════════════════════════════════════════════
// Il fallait un discriminant entre « le build » et « le serveur qui sert ».
// ⛔ PAS `RENDERING` : le Dockerfile fait `export RENDERING=$(cat /app/.rendering)`
//    JUSTE AVANT `astro build` — la variable existe donc des DEUX côtés, et un
//    garde-fou qui s'y fierait laisserait partir un appel réseau pendant la
//    construction de l'image. C'est exactement l'argument déjà écrit dans le
//    Dockerfile à propos de `test:analytics`.
// ⭐ `CAISSE_ADRESSE` est posée dans Coolify, au RUNTIME, et n'existe dans
//    aucun `RUN` du Dockerfile. Sans elle : aucun fetch, jamais, nulle part.
//    Et c'est cohérent — sans adresse d'encaissement, il n'y a pas de caisse.
const RPC = () => process.env.CAISSE_RPC || 'https://mainnet.base.org';
const ADRESSE = () => String(process.env.CAISSE_ADRESSE || '').trim();

// ⚠️ INJECTABLES POUR LE BANC, ET SEULEMENT POUR LUI. Le banc tourne dans le
// Dockerfile : il ne peut pas attendre 2,5 s ni sortir sur l'internet.
const DELAI_MS = () => Number(process.env.CAISSE_DELAI_MS) || 2500;
const FRAICHEUR_MS = () => Number(process.env.CAISSE_FRAICHEUR_MS) || 60000;

// ═══════════════════════════════════════════════════════════════════════════
// 🔴🔴🔴 CETTE SONDE NE DOIT JAMAIS FAIRE ATTENDRE `/api/sante`
// ═══════════════════════════════════════════════════════════════════════════
// `docker-entrypoint.sh` interroge `/api/sante` au démarrage et REFUSE DE
// SERVIR si la route ne répond pas en 30 secondes — Coolify arrête alors le
// conteneur au bout de douze essais. Une sonde qui attend un hôte injoignable
// tiendrait la réponse jusqu'à son propre délai, à chaque appel, et un réseau
// bloqué se transformerait en **503 sur tout le site**.
// ⇒ `etatDeLaCaisse()` ne rend QUE ce qu'elle a déjà en mémoire, et déclenche
//   la mesure DERRIÈRE elle. Le premier appel rend `joignable: null` ; le
//   suivant rend la réponse. ⭐ INCONNU ≠ FAUX, comme `montee: null` pour le
//   volume des favoris et comme `commit: null` pour la version servie.
let dernier = null;
let enCours = false;

// ⛔ LISTE BLANCHE DE CAUSES, PAS LE MESSAGE DE L'ERREUR. Un message brut
// porterait l'URL du noeud, un chemin, parfois une adresse IP — et cette route
// est publique. Quatre causes suffisent à décider quoi faire :
//   'delai'  → l'hôte ne répond pas assez vite (ou pas du tout)
//   'reseau' → la connexion a été refusée / le nom ne résout pas
//   'http'   → l'hôte a répondu, mais pas 200 (proxy, blocage, quota)
//   'forme'  → réponse reçue mais illisible (ce n'est pas un noeud JSON-RPC)
// ⭐ 'reseau' et 'http' sont DEUX chemins de sortie distincts, et c'est le but :
//   « personne ne décroche » et « quelqu'un décroche et refuse » ne se
//   réparent pas pareil.
const CAUSES = ['delai', 'reseau', 'http', 'forme'];

// ⭐ LA FORME DE L'ADRESSE SE VÉRIFIE ICI, ET C'EST UN VRAI GARDE-FOU.
// Une variable Coolify se saisit à la main. Une adresse tronquée d'un caractère
// reste « une chaîne qui commence par 0x » : le collecteur filtrerait alors sur
// une cible qui ne reçoit rien, ne verrait JAMAIS aucun paiement, et ne
// rougirait nulle part. Un silence parfait sur un site qui encaisse.
// ⚠️ La forme n'est pas le contrôle de somme EIP-55 (il faudrait keccak, donc
//   une dépendance — et `package.json` ne bouge pas pour ça). Elle attrape la
//   faute de saisie ordinaire : longueur, préfixe, caractères.
export const adresseBienFormee = (a) => /^0x[0-9a-fA-F]{40}$/.test(String(a || '').trim());

function mesurer() {
  if (enCours) return;
  enCours = true;
  const debut = Date.now();
  const ac = new AbortController();
  const minuteur = setTimeout(() => ac.abort(), DELAI_MS());
  // 🔴🔴 LE `.catch()` FINAL N'EST PAS DÉCORATIF. Cette promesse n'est jamais
  //   attendue par personne : un rejet non attrapé est une `unhandledRejection`,
  //   et Node peut décider d'arrêter le processus. Une sonde qui tue le serveur
  //   qu'elle surveille est le pire instrument possible.
  fetch(RPC(), {
    method: 'POST',
    signal: ac.signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
  })
    .then(async (r) => {
      if (!r.ok) return { joignable: false, cause: 'http', bloc: null };
      let bloc = null;
      try {
        const j = await r.json();
        // ⚠️ `parseInt` accepte n'importe quoi et rend NaN sans se plaindre. On
        //   exige la FORME avant de convertir : un hôte qui rend
        //   « bonjour » n'est pas un noeud, et doit sortir par 'forme', jamais
        //   par « bloc 0 ». *Inconnu n'est pas zéro.*
        if (typeof j?.result === 'string' && /^0x[0-9a-fA-F]{1,12}$/.test(j.result)) {
          bloc = Number.parseInt(j.result, 16);
        }
      } catch { bloc = null; }
      return Number.isFinite(bloc) && bloc > 0
        ? { joignable: true, cause: null, bloc }
        : { joignable: false, cause: 'forme', bloc: null };
    })
    .catch((e) => ({
      joignable: false,
      cause: e && e.name === 'AbortError' ? 'delai' : 'reseau',
      bloc: null,
    }))
    .then((r) => {
      clearTimeout(minuteur);
      dernier = {
        joignable: r.joignable,
        bloc: r.bloc,
        ms: Date.now() - debut,
        cause: CAUSES.includes(r.cause) ? r.cause : null,
        quand: new Date().toISOString(),
      };
      enCours = false;
    })
    .catch(() => { clearTimeout(minuteur); enCours = false; });
}

// ⭐ EXPOSÉ POUR LE BANC. Une sonde qui garde un état entre deux mesures rend
//   chaque contrôle dépendant du précédent — c'est la question ⑲ de la liste
//   d'avant-codage : *mon instrument garde-t-il un état entre deux mesures ?*
export function oublierLaMesure() { dernier = null; enCours = false; }

// ⛔ QUE DES BOOLÉENS ET DES NOMBRES PUBLICS. Ni l'adresse d'encaissement, ni
//    l'URL du noeud, ni un fragment de l'une ou de l'autre. La question posée
//    ici est « est-ce branché, et est-ce que ça répond ? », jamais « branché
//    sur quoi ». Le numéro de bloc de Base est public par construction — il ne
//    désigne personne et ne s'approche d'aucun montant.
export function etatDeLaCaisse() {
  const a = ADRESSE();
  if (!a) {
    // ⭐ TROISIÈME RÉPONSE, ET ELLE COMPTE. `joignable: false` ici crierait sur
    //   une installation parfaitement correcte — celle d'aujourd'hui, où la
    //   caisse n'est simplement pas encore ouverte. On apprend à ignorer une
    //   sonde qui crie pour rien, et le jour où elle crie pour de bon, plus
    //   personne ne l'écoute.
    return { configuree: false, adresse: null, joignable: null, bloc: null, ms: null, cause: null, quand: null };
  }
  const forme = adresseBienFormee(a);
  // ⛔ UNE ADRESSE MAL FORMÉE NE DÉCLENCHE AUCUN APPEL. Sonder le réseau pour
  //    une cible impossible rendrait `joignable: true` sur une caisse qui ne
  //    peut rien encaisser — un vert pour la mauvaise raison, sur la seule
  //    question que cette sonde existe pour trancher.
  if (forme && (!dernier || Date.now() - Date.parse(dernier.quand) > FRAICHEUR_MS())) mesurer();
  return {
    configuree: true,
    // ⭐ Un booléen, pas l'adresse. Il dit « ce qui est saisi a la bonne
    //   forme », ce qui est exactement ce qu'on ne peut pas vérifier autrement
    //   depuis l'extérieur.
    adresse: forme,
    joignable: dernier ? dernier.joignable : null,
    bloc: dernier ? dernier.bloc : null,
    ms: dernier ? dernier.ms : null,
    cause: dernier ? dernier.cause : null,
    quand: dernier ? dernier.quand : null,
  };
}
