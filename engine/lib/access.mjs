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
export const PALIERS = ['visitor', 'free', 'member'];

// ⭐ LES VALEURS HISTORIQUES VIVENT ICI, ET NULLE PART AILLEURS.
// Elles reproduisent exactement dataset.mjs L.170-171 d'avant la migration.
const DEFAUTS_PORTES = {
  price_history: { tier: 'member', public_max: 30, public_days: 90 },
};

// Ce que le moteur sait faire. Une porte inconnue est une faute de frappe,
// pas une fonctionnalite a venir : on prefere l'erreur bruyante.
const PORTES_CONNUES = new Set(['price_history']);

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

  // --- Portes -------------------------------------------------------------
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
      public_max: actif ? Number(dit.public_max ?? heritePlafond ?? def.public_max) : Infinity,
      public_days: actif ? Number(dit.public_days ?? heriteFenetre ?? def.public_days) : Infinity,
    };
  }

  // --- Journalisation -----------------------------------------------------
  // ⭐ On ne DEVINE pas la configuration, on l'ECRIT dans le log. C'est ce qui
  // manquait aux quatre reglages ecrases : rien ne les affichait.
  const resume = Object.values(portes)
    .map((p) => `${p.nom}=${p.actif ? `${p.tier} (${p.public_max} pts / ${p.public_days} j)` : 'public'}`)
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
