// LA MATRICE DES NIVEAUX D'ACCES — source unique.
//
// PRINCIPE. Le palier est une DONNEE du manifeste. Aucune page ne teste un
// palier, aucune page ne lit un plafond. Un site 100 % gratuit, 100 % payant
// ou mixte, c'est le MEME code : seul le manifeste change.
//
// POURQUOI CE MODULE EXISTE. Avant le 20/07/2026 la « matrice a 3 paliers »
// etait une intention ecrite nulle part : le seul verrou du moteur etait
// `publication.public_points_max`, lu directement par dataset.mjs et rendu en
// dur par Item.astro. Un site gratuit n'avait aucun moyen de s'exprimer.
//
// ⚠️ LE PIEGE QUE CE MODULE FERME. Quatre fois sur ce projet, un reglage pose
// a un endroit a ete silencieusement ecrase par un autre — sans jamais planter.
// Ici la parade est double : les valeurs par defaut ne vivent QU'ICI, et
// `porte()` LEVE une erreur sur un nom inconnu. Un champ absent qui rend
// `null` est le defaut le plus difficile a voir ; on refuse d'en fabriquer un.
//
// RETRO-COMPATIBILITE. Si `access:` est absent du manifeste, la matrice est
// reconstruite depuis `publication:`. Aucun site existant ne change de
// comportement — c'est verifie par engine/tools/test_access.mjs.

import { manifest } from './manifest.mjs';
// 🔴 LOT 164 — la surcharge d'exploitation. ⛔ Ce module n'importe PAS
//   celui-ci en retour : ce serait un cycle. Voir son en-tête.
import { lireSurcharges } from './portes_surcharge.mjs';

// Ordre croissant de privilege. Un palier absent de `tiers` desactive les
// portes qui l'exigent (le contenu redevient entierement public).
// ⚠️ L'ORDRE EST LA SEULE CHOSE QUI COMPTE : `auMoins()` compare des RANGS.
// Inserer un palier au milieu deplace tous les suivants et change
// SILENCIEUSEMENT qui franchit quoi. On ajoute a la fin, jamais au milieu.
// ⭐ `member` est GRATUIT (compte sans paiement) : il est sous `crevette`.
export const PALIERS = ['visitor', 'free', 'member', 'crevette', 'langouste', 'whale'];

// ⭐ LES VALEURS HISTORIQUES VIVENT ICI, ET NULLE PART AILLEURS.
// Elles reproduisent exactement dataset.mjs L.170-171 d'avant la migration.
const DEFAUTS_PORTES = {
  price_history: { tier: 'member', public_max: 30, public_days: 90 },
  // ⭐ Ces portes ne se TRONQUENT pas : elles s'ouvrent ou non, pas de plafond.
  extremes:     { binaire: true, tier: 'crevette' },
  modules:      { binaire: true, tier: 'crevette' },
  // 🔴 LOT 104 (07/08/2026) — LES PLAFONDS CHANGENT : 0 / 1 / 5 / 15.
  // Arbitrage Preda, et il REMPLACE le 0/2/10/illimite du 20/07. ⭐ `whale`
  // n'est plus illimite : 15 est un NOMBRE, et un nombre se tient. « Illimite »
  // sur un moteur d'alertes qui interroge une source tierce est une promesse
  // que la source peut refuser a notre place — c'est le meme piege que le
  // module absent, deplace dans le temps.
  // ⛔ CES VALEURS NE SONT PAS VENDABLES AUJOURD'HUI : `/alertes/` n'existe
  // pas, et les 4 alertes muettes sur 7 de `jetonveve` ne sont reliees a aucun
  // compte. Elles sont la GRILLE, pas la livraison — cf. `offer.modules`.
  alerts:       { binaire: true, tier: 'crevette', caps: { member: 0, crevette: 1, langouste: 5, whale: 15 } },
  wallet_watch: { binaire: true, tier: 'whale' },
  // 🔴 LOT 101 (07/08/2026) — LA COTE : prix plancher courant, extrêmes,
  // percentiles. Arbitrage Preda du 06/08 : « pas le floor price actuel ».
  // ⚠️ CE DÉFAUT SUFFIT À L'ACTIVER, et il faut le savoir : `actif` vaut
  // `tier !== visitor && tiers.includes(tier)`. Tout site qui VEND le palier
  // `crevette` ferme donc sa cote sans avoir écrit une ligne — c'est-à-dire
  // veveprice, et lui seul (vevewiki déclare `tiers: [visitor]`, mesuré).
  // ⛔ Ne pas lire cette ligne comme « inerte par défaut » : les cinq portes
  // au-dessus se comportent pareil, et c'est le contrat de ce fichier.
  // ⭐ veveprice la déclare quand même EXPLICITEMENT dans son manifeste : un
  // arbitrage commercial doit se lire là où Preda le relira, pas ici.
  cote:         { binaire: true, tier: 'crevette' },
  // 🔴🔴 LOT 112 — `movers` : LE CLASSEMENT DES MOUVEMENTS.
  // Il n'avait pas de porte parce qu'il n'était pas fermé — il était SERVI EN
  // CLAIR sur l'accueil pendant que `/market/`, qui montre le même classement,
  // était réservé aux membres. Une même donnée, deux régimes, et le régime
  // ouvert était le plus visible.
  // ⭐ `binaire` : un classement ne se tronque pas. En montrer les 5 premiers
  // donnerait le podium, c'est-à-dire l'essentiel de ce qui se vend.
  movers:       { binaire: true, tier: 'crevette' },
};

// Ce que le moteur sait faire. Une porte inconnue est une faute de frappe,
// pas une fonctionnalite a venir : on prefere l'erreur bruyante.
// 🔴 LOT 164 — EXPORTÉE. L'écran de réglage des portes (`/compte/`) doit
//   lister exactement ce que ce moteur sait faire. Une seconde liste
//   là-bas aurait divergé au premier ajout de porte — c'est la panne du
//   lot 127 (`data-ch` à `300` d'un côté, `300.00` de l'autre).
export const PORTES_CONNUES = new Set(['price_history', 'extremes', 'modules', 'alerts', 'wallet_watch', 'cote', 'movers']);

let _cache = null;

export function acces() {
  if (_cache) return _cache;
  const m = manifest();
  const brut = m.access || {};
  const pub = m.publication || {};

  // 🔴 LE GARDE-FOU CENTRAL. Quatre fois sur ce projet, un reglage pose a un
  // endroit a ete silencieusement ecrase par un autre — jamais un plantage,
  // toujours une decouverte tardive dans les logs. Un manifeste qui declare
  // `access:` ET conserve les anciennes cles de `publication:` est exactement
  // cette situation : deux verites, une seule appliquee. On refuse de choisir
  // en silence.
  if (m.access) {
    const restes = ['public_points_max', 'public_history_days'].filter((k) => pub[k] !== undefined);
    if (restes.length) {
      throw new Error(
        `[acces] manifeste ambigu : « access: » est declare, mais publication.${restes.join(' et publication.')} ` +
        `${restes.length > 1 ? 'existent' : 'existe'} encore et ${restes.length > 1 ? 'seraient ignorees' : 'serait ignoree'}. ` +
        `Deplacer ${restes.length > 1 ? 'ces valeurs' : 'cette valeur'} dans access.gates.price_history, puis ` +
        `${restes.length > 1 ? 'les' : 'la'} supprimer de publication.`
      );
    }
  }

  // --- Paliers actifs sur ce site ----------------------------------------
  // Defaut retro-compatible : VeVePrice n'a jamais eu de palier « free », il
  // opposait un visiteur a un « membre ». On ne lui en invente pas un.
  let tiers = Array.isArray(brut.tiers) && brut.tiers.length ? brut.tiers.slice() : ['visitor', 'member'];
  const inconnus = tiers.filter((p) => !PALIERS.includes(p));
  if (inconnus.length) {
    throw new Error(`[acces] palier inconnu dans access.tiers : ${inconnus.join(', ')} (attendus : ${PALIERS.join(', ')})`);
  }
  if (!tiers.includes('visitor')) tiers.unshift('visitor');   // le visiteur existe toujours
  tiers = PALIERS.filter((p) => tiers.includes(p));           // ordre canonique

  // --- LA SESSION DE DEMONSTRATION : RETIREE AU LOT 161 --------------------
  // 🗑️ Demande `r` de Preda, 24/08/2026 : « supprimer tout le systeme de
  // Demonstration et ses mentions ». Le mecanisme entier est parti
  // (`engine/lib/demo_session.mjs`, `src/pages/api/demo.js`, la lecture dans
  // `src/middleware.js`, le bloc de `/compte/`, six cles dans les cinq
  // dictionnaires, le banc `test:demo`).
  //
  // 🔴🔴 CE QUI RESTE ICI EST UN REFUS, PAS UN RESTE. Supprimer la branche
  // aurait rendu `access.demo: crevette` INERTE EN SILENCE : ecrit dans un
  // manifeste demain, il ne ferait rien et ne dirait rien. C'est mot pour mot
  // le defaut que ce fichier denonce vingt lignes plus bas a propos des portes
  // inventees. ⭐⭐ ON NE REMPLACE PAS UN MECANISME PAR UN SILENCE : on le
  // remplace par une erreur qui NOMME le lot et la date.
  if (brut.demo !== undefined && brut.demo !== null && brut.demo !== false) {
    throw new Error('[acces] access.demo n\'existe plus : la session de demonstration a ete '
      + 'retiree au lot 161 (24/08/2026), a la demande de Preda. Retirer la ligne « demo: » '
      + 'de sites/<site>/manifest.yml. Pour ouvrir un acces, passer par les portes '
      + '(access.gates) ou par le reglage des portes de /compte/.');
  }

  // --- Portes -------------------------------------------------------------
  // ⛔ Ce fichier promettait « on prefere l'erreur bruyante », mais la boucle
  // itere PORTES_CONNUES : une porte inventee dans le manifeste etait ignoree
  // EN SILENCE. Un manifeste qui ne fait rien et ne dit rien est pire qu'un
  // manifeste qui echoue. On tient la promesse ici.
  // 🔴🔴 LOT 140-1 — `caps:` EST INTERDIT SUR `price_history`, ET C'EST LE COEUR
  // DE LA FEATURE. La profondeur accordee a chaque palier se LIT dans
  // `plages:` — la meme liste qui dessine les boutons. Declarer en plus des
  // `caps` ici ecrirait la MEME decision a deux endroits : le jour ou Preda
  // change la grille, les boutons diraient une chose et l'API en servirait une
  // autre, sans qu'aucun build echoue. C'est le defaut de famille de ce projet
  // (« deux verites, une seule appliquee »), et ce fichier existe pour le
  // refuser. ⭐ `alerts` garde ses `caps` : la, il n'y a pas de deuxieme liste.
  if ((brut.gates || {}).price_history && (brut.gates.price_history.caps !== undefined)) {
    throw new Error('[acces] access.gates.price_history.caps est interdit : la profondeur '
      + 'accordee a chaque palier se declare UNE SEULE FOIS, dans `plages:` '
      + '(la liste qui dessine aussi les boutons). Retirer `caps:` et ajuster `plages:`.');
  }

  const inconnues = Object.keys(brut.gates || {}).filter((n) => !PORTES_CONNUES.has(n));
  if (inconnues.length) {
    throw new Error(`[acces] porte inconnue dans access.gates : ${inconnues.join(', ')} `
      + `(connues : ${[...PORTES_CONNUES].join(', ')})`);
  }

  const portes = {};
  for (const nom of PORTES_CONNUES) {
    const def = DEFAUTS_PORTES[nom] || { tier: 'member' };
    const dit = (brut.gates || {})[nom] || {};

    // Retro-compat : sans bloc `access`, les plafonds viennent de `publication`.
    // ⚠️ `??` et non `||` : un 0 declare explicitement est une valeur, pas un
    // champ vide. Beaucoup de sources renvoient 0 pour dire « je ne sais pas »,
    // mais un manifeste, lui, est ecrit a la main : 0 y veut dire 0.
    const heritePlafond = nom === 'price_history' ? pub.public_points_max : undefined;
    const heriteFenetre = nom === 'price_history' ? pub.public_history_days : undefined;

    const tier = dit.tier ?? def.tier;
    if (!PALIERS.includes(tier)) {
      throw new Error(`[acces] palier inconnu pour la porte « ${nom} » : ${tier}`);
    }

    // Une porte est ACTIVE si elle exige mieux qu'un visiteur ET que le palier
    // exige existe sur ce site. Sinon le contenu est integralement public.
    const actif = tier !== 'visitor' && tiers.includes(tier);

    portes[nom] = {
      nom,
      tier,
      actif,
      // ⚠️ `binaire` : une porte qui OUVRE OU NON, sans troncature. Sans ce
      // drapeau, `Number(undefined)` valait NaN et le journal affichait
      // « NaN pts / NaN j ». ⛔ Un NaN dans une configuration d'acces est une
      // mine : toute comparaison `points > NaN` est fausse POUR TOUJOURS. Et
      // un journal qui affiche NaN entraine a ne plus lire le journal — or
      // c'est le journal qui sert d'instrument.
      binaire: Boolean(dit.binaire ?? def.binaire),
      public_max: (dit.binaire ?? def.binaire) ? Infinity
        : (actif ? Number(dit.public_max ?? heritePlafond ?? def.public_max) : Infinity),
      public_days: (dit.binaire ?? def.binaire) ? Infinity
        : (actif ? Number(dit.public_days ?? heriteFenetre ?? def.public_days) : Infinity),
      // ⚠️ `-1` = illimite, et il faut le DIRE : `Infinity` ne survit pas a un
      // aller-retour JSON, il en revient en `null`. Le sentinelle entier est le
      // seul qui traverse une serialisation sans se faire effacer.
      caps: { ...(def.caps || {}), ...(dit.caps || {}) },
    };
  }

  // --- Journalisation -----------------------------------------------------
  // ⭐ On ne DEVINE pas la configuration, on l'ECRIT dans le log. C'est ce qui
  // manquait aux quatre reglages ecrases : rien ne les affichait.
  const resume = Object.values(portes)
    .map((p) => `${p.nom}=${!p.actif ? 'public'
      : p.binaire ? p.tier
      : `${p.tier} (${p.public_max} pts / ${p.public_days} j)`}`)
    .join(' · ');
  const origine = m.access ? 'manifeste (access)' : 'retro-compat (publication)';
  console.log(`[acces] paliers : ${tiers.join(' < ')} — portes : ${resume} — source : ${origine}`);
  _cache = { tiers, portes };
  return _cache;
}

// Recupere une porte par son nom. LEVE si le nom est inconnu : un `undefined`
// silencieux se propagerait en `NaN` dans les plafonds, sans une erreur.
export function porte(nom) {
  const a = acces();
  const p = a.portes[nom];
  if (!p) {
    throw new Error(`[acces] porte inconnue : « ${nom} » (connues : ${[...PORTES_CONNUES].join(', ')})`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 🔴🔴🔴 LOT 164 — LA SURCHARGE D'EXPLOITATION S'APPLIQUE ICI, ET NULLE
  //    PART AILLEURS.
  // ═══════════════════════════════════════════════════════════════════════
  // ⭐⭐⭐ POURQUOI DANS `porte()` ET PAS DANS `franchit()`. Mesuré le 19/08 :
  //   `franchit()` est bien le point de DÉCISION, mais l'AFFICHAGE lit
  //   `porte(nom).tier` séparément — `Analytics.astro` l. 145 (le nom du grade
  //   sur le cadenas), `Offre.astro` l. 136, et `catalogueModules()` que lit
  //   le tableau de bord. Brancher sur `franchit()` seul aurait ouvert le
  //   contenu en continuant d'afficher « crevette » à côté. ⇒ un seul point,
  //   et les deux en descendent.
  //
  // ⛔ ON NE MUTE PAS L'OBJET MÉMOÏSÉ. `acces()` garde `_cache` pour toute la
  //   durée du processus : écrire `p.tier = …` rendrait la surcharge
  //   PERMANENTE jusqu'au redémarrage, c'est-à-dire exactement le contraire de
  //   la date de fin qui rend ce mécanisme acceptable. On rend une COPIE, et
  //   seulement quand il y a quelque chose à surcharger.
  //
  // ⛔ UN PALIER INCONNU EST IGNORÉ — la surcharge ne peut pas inventer un
  //   grade. Le magasin ne connaît pas les paliers (il n'importe pas ce
  //   fichier : ce serait un cycle) ; c'est donc ici qu'on borne le SENS,
  //   comme `prefs.mjs` le fait déjà pour la langue.
  //
  // ⚠️ AU BUILD, `lireSurcharges()` REND `{}` : la base vit dans `/data`, qui
  //   n'existe pas dans le conteneur de build (mesuré au lot 154-B). Les
  //   ~3 000 pages pré-générées figent donc toujours le palier DU MANIFESTE —
  //   ce n'est pas une précaution, c'est une conséquence.
  const sur = lireSurcharges();
  const t = sur[nom];
  if (t && t !== p.tier && PALIERS.includes(t)) return { ...p, tier: t, surcharge: true };
  return p;
}

// ===========================================================================
// LE PALIER DU VISITEUR — a ne JAMAIS confondre avec le palier de la porte.
// ===========================================================================
//
// 🔴 DEUX NOTIONS, DEUX CHAMPS, DEUX NOMS.
//   · `porte(nom).tier`  = le palier EXIGE. Vient du MANIFESTE. Dit ce que le
//     site vend. Connu au build, identique pour tout le monde.
//   · `palierVisiteur()` = le palier OBSERVE. Vient de la SESSION. Dit ce que
//     cette personne-ci a payé. Connu a la visite, different par visiteur.
//
// Les ranger dans un meme champ « tier » serait la cinquieme occurrence du
// defaut de famille de ce projet : un reglage pose a un endroit, silencieusement
// ecrase par un autre, sans jamais planter. On les garde separes par le nom.
//
// ⚠️ ETAT AU 21/07/2026 : AUCUN SYSTEME DE COMPTES N'EXISTE ENCORE. Cette
// fonction renvoie donc toujours « visitor », et c'est VOULU — c'est ce qui
// rend ce lot a comportement constant. Le jour ou les comptes arrivent, le
// middleware de session posera `locals.palier` et SEUL CE FICHIER changera.

export const palierParDefaut = () => 'visitor';

// 🗑️ LOT 161 — `palierDemo()` a ete retiree ici avec le reste du mecanisme.
// ⛔ Ne pas la recreer « pour compatibilite » : une fonction qui rend toujours
// `null` fait croire a un mecanisme eteint alors qu'il n'existe plus.

// ⭐⭐⭐ QUI EST CETTE PERSONNE ? — a ne PAS confondre avec `palierVisiteur()`,
// qui repond « qu'a-t-elle le droit de voir ? ». Les deux ont ete la MEME
// variable jusqu'au 06/08/2026, et c'est ce qui a fait repondre « vous etes
// deja connecte » a quelqu'un qui n'avait jamais de compte.
//   'reelle' -> vraie session · 'demo' -> jeton nominatif · null -> personne.
// ⛔ `access.demo` du manifeste ne rend JAMAIS 'reelle' : il donne un palier a
// tout le monde, donc il n'identifie personne. Un droit collectif n'est pas une
// identite. C'est le seul endroit ou cette regle est ecrite.
export const sessionDe = (locals) => (locals && locals.session) || null;

// A-t-on quelqu'un a deconnecter ? ⭐ La question que le bouton « Se
// deconnecter » aurait du poser depuis le debut : il s'affichait sur un palier,
// et un palier n'a pas de porte de sortie.
export const connecte = (locals) => sessionDe(locals) !== null;

// Un visiteur au palier `a` franchit-il une porte qui exige `requis` ?
// Comparaison par RANG, pas par egalite : un membre franchit une porte `free`.
export function auMoins(a, requis) {
  const ia = PALIERS.indexOf(a);
  const ir = PALIERS.indexOf(requis);
  // Un palier inconnu ne « passe » jamais : en cas de doute, on ferme.
  // L'inverse (ouvrir par defaut) transformerait une faute de frappe en fuite.
  if (ia < 0 || ir < 0) return false;
  return ia >= ir;
}

// Le palier de la personne qui regarde la page, maintenant.
// `locals` = `Astro.locals`, ou le futur middleware de session deposera le
// palier. Absent aujourd'hui => « visitor ».
export function palierVisiteur(locals) {
  const brut = locals && locals.palier;
  if (!brut) return palierParDefaut();
  if (!PALIERS.includes(brut)) {
    // On ne se tait pas et on ne devine pas : on ferme, et on le dit.
    console.log(`[acces] palier de session inconnu (« ${brut} ») — ramene a visitor`);
    return palierParDefaut();
  }
  // Un palier que le SITE ne declare pas ne peut pas etre porte par un
  // visiteur : sinon un vieux cookie « member » ouvrirait un site repasse en
  // gratuit, ou l'inverse.
  const { tiers } = acces();
  if (!tiers.includes(brut)) {
    console.log(`[acces] palier « ${brut} » absent de access.tiers — ramene a visitor`);
    return palierParDefaut();
  }
  return brut;
}

// Ce visiteur franchit-il cette porte ? LA question que posent les composants.
// Porte inactive (site gratuit) => tout le monde franchit.
export function franchit(nomPorte, locals) {
  const p = porte(nomPorte);
  if (!p.actif) return true;
  return auMoins(palierVisiteur(locals), p.tier);
}

// Ce vers quoi pointe l'appel a l'action d'une porte. Aujourd'hui : le lien
// d'offre du manifeste. La page d'offre generee (lot 4) se branchera ICI, et
// nulle part dans les composants.
export function cibleOffre() {
  const m = manifest();
  const o = m.offer || {};
  return { url: o.url || '' };
}

// Combien reste-t-il de cache ? Calcule sur la donnee REELLE, jamais sur le
// plafond du manifeste : une fiche a 12 releves qui annoncerait « 18 releves
// caches » mentirait au visiteur.
export function restant(total, montre) {
  const t = Number(total) || 0;
  const v = Number(montre) || 0;
  return Math.max(0, t - v);
}

// Reservee aux tests : la matrice est memoisee pour la duree d'un build.
export function _reinitialiser() { _cache = null; }

// Combien d'unites ce palier a-t-il droit sur cette porte ?
//   -1 = illimite · 0 = aucune (il voit le NOM du module, pas son contenu)
export function plafond(nomPorte, locals) {
  const p = porte(nomPorte);
  if (!p.actif) return -1;
  const v = p.caps?.[palierVisiteur(locals)];
  return v === undefined ? 0 : Number(v);
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 LOT 104 — LES PLAGES DU GRAPHIQUE, ET LE CATALOGUE DES MODULES
// ═══════════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// LES PLAGES — « 3 J / 7 J / 30 J / 90 J / Max », et qui ouvre laquelle.
// ---------------------------------------------------------------------------
// ⭐⭐⭐ POURQUOI ELLES DESCENDENT ICI ET PAS DANS LE GABARIT. Item.astro les
// ecrivait EN DUR : `['3 J','30 J','90 J','MAX']`, avec `data-verrou` sur tout
// sauf la premiere. Trois consequences, toutes silencieuses :
//   · « 7 J » n'existait pas, alors que c'est LE palier Crevette ;
//   · le verrou ne dependait d'aucun palier — il etait decoratif ;
//   · et le jour ou Preda change la grille, le gabarit ne le sait pas.
// ⛔ UN CONTROLE QUI NE REPOND PAS DOIT LE DIRE — la version en dur le disait
// deja (`aria-disabled`), mais elle disait la MEME chose a tout le monde. Un
// verrou identique pour l'abonne et le visiteur n'est pas un verrou, c'est un
// dessin de verrou.
//
// ⭐ FORME DECLAREE (sites/<site>/manifest.yml, access.gates.price_history) :
//     plages:
//       - { cle: '3j',  jours: 3,    tier: member   }
//       - { cle: 'max', jours: null, tier: whale    }
// `jours: null` = sans borne. L'ORDRE DU TABLEAU EST L'ORDRE AFFICHE.
//
// ⛔ AUCUN DEFAUT INVENTE. Si le manifeste ne declare rien, on rend une liste
// VIDE et le gabarit n'emet aucune plage. Fabriquer un 3/7/30/90/Max par
// defaut donnerait a un site qui n'a rien demande une grille commerciale
// plausible — et personne ne relit ce qui a l'air juste.
export function plages() {
  const m = manifest();
  const brut = ((m.access || {}).gates || {}).price_history || {};
  const liste = Array.isArray(brut.plages) ? brut.plages : [];
  const { tiers } = acces();
  return liste.map((p, i) => {
    if (!p || !p.cle) {
      throw new Error(`[acces] plage n°${i + 1} sans « cle » dans access.gates.price_history.plages`);
    }
    const tier = p.tier ?? 'visitor';
    if (!PALIERS.includes(tier)) {
      throw new Error(`[acces] plage « ${p.cle} » : palier inconnu « ${tier} » (attendus : ${PALIERS.join(', ')})`);
    }
    // ⭐ Une plage exigeant un palier que le site NE VEND PAS est ouverte, pas
    // fermee. Meme regle que `porte().actif` : un verrou vers un palier
    // inatteignable ne se leverait jamais, donc il ne se poserait pas.
    const verrouillee = tier !== 'visitor' && tiers.includes(tier);
    return { cle: String(p.cle), jours: p.jours ?? null, tier, verrouillee };
  });
}

// ---------------------------------------------------------------------------
// 🔴🔴🔴 LOT 140-1 — LA PROFONDEUR ACCORDEE : « combien de jours », pas « oui/non »
// ---------------------------------------------------------------------------
// ⭐⭐⭐ CE QU'ELLE REPARE, ET LA MESURE QUI L'A TROUVEE (12/08/2026).
// `/api/historique/[uuid]` appelait `franchit('price_history')`, un OUI/NON
// contre le palier de la porte (`crevette`). Or le manifeste declare, depuis le
// lot 132, une grille GRADUEE : 3 j -> member · 7 j -> crevette · 30 j + 90 j ->
// langouste · Max -> whale. Un membre etait donc refuse (403) par la seule route
// capable de lui livrer ses 3 jours, retombait sur `/api/cote/`, et voyait
// « 3 J — Member unlocks this » cadenasse A VIE.
// ⭐⭐⭐ L'arbitrage du lot 132 etait juste, complet, ecrit au bon endroit — et
// AUCUN mecanisme ne pouvait le livrer. Une demande juste peut viser un
// mecanisme impuissant : on mesure qu'il PEUT produire l'effet, avant de coder.
//
// ⭐⭐ POURQUOI ELLE DERIVE DE `plages()` ET PAS DE `caps:`. `plafond()` savait
// deja lire des `caps` par palier (`alerts` s'en sert) — c'etait la reponse
// evidente. Elle aurait ecrit la profondeur DEUX FOIS : dans `caps:` pour l'API,
// dans `plages:` pour les boutons. Ce depot a paye trois fois ce defaut : deux
// listes ne divergent pas bruyamment, elles se contredisent en silence.
// ⇒ La GRILLE FAIT LOI (arbitrage Preda du 12/08). Un invariant, pas une 2e
//   liste. `acces()` LEVE si un manifeste declare `caps:` sur `price_history`.
//
// ⚠️ TROIS VALEURS, TROIS SENS, ET IL FAUT LES DIRE :
//     -1  sans borne     (la porte est inactive, ou une plage `jours: null`)
//      0  RIEN           (aucune plage n'est ouverte a ce palier -> 401/403)
//      N  N jours        (la plus longue plage ouverte a ce palier)
// ⛔ NE PAS confondre 0 et -1 : c'est exactement le piege de `plafond()`, qui
//   rend -1 quand la porte dort et 0 quand le palier manque. Un site gratuit
//   (vevewiki, `tiers: [visitor]`) doit rester ENTIEREMENT ouvert, pas muet.
export function profondeur(locals) {
  const p = porte('price_history');
  // Porte inactive = site sans palier payant : tout est public, comme
  // `franchit()` le fait deja. ⛔ Rendre 0 ici rendrait vevewiki muet.
  if (!p.actif) return -1;

  const grille = plages();
  // ⛔ AUCUN DEFAUT INVENTE, ET AUCUNE REGRESSION NON PLUS. Un site qui active
  // la porte sans declarer de plages n'a pas demande une grille : on retombe
  // sur le comportement binaire d'avant le lot 140, mot pour mot. Rendre 0
  // fermerait l'historique a tout le monde sur un manifeste parfaitement legal.
  if (!grille.length) return franchit('price_history', locals) ? -1 : 0;

  const moi = palierVisiteur(locals);
  let max = 0;
  for (const g of grille) {
    // `auMoins` compare des RANGS : un whale franchit une plage `member`.
    if (!auMoins(moi, g.tier)) continue;
    // `jours: null` = sans borne, et elle DOMINE : inutile de continuer.
    // ⚠️ « sans borne » n'est pas « 0 » — la confusion raboterait la courbe du
    //   palier le plus cher a rien, ce que `test_plages.mjs` refuse deja cote
    //   bouton. Ici c'est la meme faute, cote donnee.
    if (g.jours === null) return -1;
    const j = Number(g.jours);
    // ⛔ Un NaN dans une profondeur est une mine : toute comparaison le rend
    //   faux POUR TOUJOURS. On l'ignore, on ne le propage pas.
    if (!Number.isFinite(j) || j <= 0) continue;
    if (j > max) max = j;
  }
  return max;
}

// ---------------------------------------------------------------------------
// LE CATALOGUE DES MODULES — ce que /offre/ annonce, et ce qui existe.
// ---------------------------------------------------------------------------
// 🔴🔴 ARBITRAGE PREDA DU 07/08/2026, PRIS CONTRE MON AVIS, ET APPLIQUE.
// La page d'offre annonce TOUS les modules, y compris ceux qui n'existent pas,
// avec une pastille « bientot ». Mon objection etait ecrite dans son propre
// brief — « un palier qui promet un module absent est une promesse rompue
// PAYANTE ». Elle reste vraie. Ce qui la desamorce aujourd'hui, c'est que
// `offer.url` est VIDE : rien n'est vendable, donc rien n'est promis contre de
// l'argent. Une feuille de route affichee n'est pas une promesse rompue.
//
// ⭐⭐⭐ MAIS LA CONDITION QUI LA DESAMORCE N'EST PAS PERMANENTE, ET C'EST TOUT
// LE PROBLEME. Le jour ou un prestataire de paiement est branche, `offer.url`
// se remplit — et la meme page devient exactement ce que le brief interdit,
// sans qu'une ligne ait change. Un avertissement ecrit ici n'y survivrait pas :
// ce depot a mesure quatre fois qu'un avertissement qui ne se MESURE pas finit
// lu sans etre suivi. ⇒ `engine/tools/test_promesses.mjs` REFUSE le build
// quand `offer.url` est renseigne et qu'un module `bientot: true` est attribue
// a un palier payant. La decision de Preda tient ; le piege se referme seul.
//
// ⭐ FORME DECLAREE (offer.modules) :
//     - { cle: market, porte: cote, bientot: false }     <- palier lu dans la matrice
//     - { cle: dashboard, palier: crevette, bientot: true }
// `porte:` et `palier:` s'excluent : le premier delegue a la matrice d'acces
// (source unique), le second sert aux modules qui ne sont pas des portes du
// moteur. Declarer les deux serait deux verites — on LEVE.
export function catalogueModules() {
  const m = manifest();
  const liste = Array.isArray(m.offer?.modules) ? m.offer.modules : [];
  const { tiers } = acces();
  return liste.map((mo, i) => {
    if (!mo || !mo.cle) {
      throw new Error(`[acces] module n°${i + 1} sans « cle » dans offer.modules`);
    }
    if (mo.porte && mo.palier) {
      throw new Error(`[acces] module « ${mo.cle} » declare a la fois « porte: ${mo.porte} » et `
        + `« palier: ${mo.palier} » : deux sources pour un meme palier. En garder UNE.`);
    }
    // ⭐ `porte()` LEVE deja sur un nom inconnu — on ne re-teste pas, on laisse
    // l'erreur bruyante remonter avec son message, qui est meilleur que le mien.
    const tier = mo.porte ? porte(mo.porte).tier : (mo.palier ?? 'member');
    if (!PALIERS.includes(tier)) {
      throw new Error(`[acces] module « ${mo.cle} » : palier inconnu « ${tier} »`);
    }
    if (!tiers.includes(tier)) {
      throw new Error(`[acces] module « ${mo.cle} » est attribue au palier « ${tier} », `
        + `absent de access.tiers (${tiers.join(', ')}). Il serait annonce sans jamais pouvoir s'ouvrir.`);
    }
    return {
      cle: String(mo.cle),
      tier,
      // ⚠️ `Boolean(...)` et pas la valeur brute : `bientot: "false"` (une
      // chaine, ce que YAML rend si on met des guillemets) est VRAI en
      // JavaScript. Un module livre serait annonce « bientot » pour un
      // guillemet — et la page aurait l'air correcte.
      bientot: mo.bientot === true,
      porte: mo.porte || null,
    };
  });
}

// Le palier est-il PAYANT sur ce site ? ⭐ « payant » ne se devine pas du nom :
// il se lit dans `offer.plans`, ou le prix est ecrit. `member` est a 0, donc
// gratuit, et c'est la seule facon de le savoir sans coder la liste en dur.
export function palierPayant(cle) {
  const m = manifest();
  const p = (m.offer?.plans || []).find((x) => x.cle === cle);
  return Boolean(p && Number(p.prix) > 0);
}
