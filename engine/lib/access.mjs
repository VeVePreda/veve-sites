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
  alerts:       { binaire: true, tier: 'crevette', caps: { member: 0, crevette: 2, langouste: 10, whale: -1 } },
  wallet_watch: { binaire: true, tier: 'whale' },
};

// Ce que le moteur sait faire. Une porte inconnue est une faute de frappe,
// pas une fonctionnalite a venir : on prefere l'erreur bruyante.
const PORTES_CONNUES = new Set(['price_history', 'extremes', 'modules', 'alerts', 'wallet_watch']);

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

  // --- LA SESSION DE DEMONSTRATION ---------------------------------------
  // 🔴 ARBITRAGE ASSUME DU 01/08/2026, LIVRE LE 03/08 (lot 34). Tant qu'aucun
  // service de session n'existe, `access.demo` fait entrer TOUT LE MONDE au
  // palier declare. C'est une porte grande ouverte, volontairement, et sans
  // date de fin : personne ne la refermera a notre place.
  //
  // ⭐⭐ POURQUOI ICI ET PAS DANS UNE VARIABLE D'ENVIRONNEMENT. Le risque
  // enonce n'est pas « la demo est dangereuse », c'est « rien ne me rappellera
  // de l'eteindre ». Une variable Coolify est invisible depuis le depot : elle
  // ne peut etre rappelee par rien. Ecrite ici, elle devient un MARQUEUR —
  // `etat_reel.py` la lit, donc l'oubli devient impossible a maintenir.
  // ⛔ NE PAS la deplacer dans l'environnement « pour pouvoir l'eteindre sans
  // redeployer » : c'est precisement la propriete qu'on ne veut pas.
  let demo = null;
  if (brut.demo !== undefined && brut.demo !== null && brut.demo !== false) {
    if (!PALIERS.includes(brut.demo)) {
      throw new Error(`[acces] access.demo : palier inconnu « ${brut.demo} » (attendus : ${PALIERS.join(', ')})`);
    }
    // Un palier que le site ne VEND pas ne peut pas etre offert en demo :
    // `palierVisiteur()` le ramenerait a visitor et la demo serait un mensonge
    // silencieux — une porte qu'on croit ouverte et qui ne l'est pas.
    if (!tiers.includes(brut.demo)) {
      throw new Error(`[acces] access.demo = « ${brut.demo} » mais ce palier est absent de access.tiers `
        + `(${tiers.join(', ')}). Une demo vers un palier non declare ne s'appliquerait jamais.`);
    }
    demo = brut.demo;
  }

  // --- Portes -------------------------------------------------------------
  // ⛔ Ce fichier promettait « on prefere l'erreur bruyante », mais la boucle
  // itere PORTES_CONNUES : une porte inventee dans le manifeste etait ignoree
  // EN SILENCE. Un manifeste qui ne fait rien et ne dit rien est pire qu'un
  // manifeste qui echoue. On tient la promesse ici.
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
  // ⭐ On le CRIE. Une porte ouverte qui ne se voit pas dans le journal de
  // build est une porte qu'on decouvrira par un tiers, pas par nous.
  if (demo) {
    console.log(`[acces] 🔴 SESSION DE DEMONSTRATION ACTIVE — access.demo = « ${demo} ». `
      + `Tout visiteur sans session vaudra « ${demo} » SI ET SEULEMENT SI aucun SESSION_API `
      + `n'est configure. Retirer « demo: » de sites/<site>/manifest.yml pour refermer.`);
  }

  _cache = { tiers, portes, demo };
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

// Le palier de demonstration declare par le manifeste, ou `null`.
// ⛔ Ce n'est PAS le palier applique : c'est le middleware qui decide s'il a le
// droit de s'en servir (cf. src/middleware.js). Les separer est le meme
// principe que `porte().tier` contre `palierVisiteur()` — ce que le site
// DECLARE et ce qu'une personne PORTE sont deux choses.
export const palierDemo = () => acces().demo;

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
