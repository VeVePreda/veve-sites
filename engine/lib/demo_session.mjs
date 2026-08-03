// ⚠️ VeVePreda/veve-sites — engine/lib/demo_session.mjs  (FICHIER NEUF)
// ═══════════════════════════════════════════════════════════════════════════
// LA SESSION DE DÉMONSTRATION NOMINATIVE — lot 42, 03/08/2026
// ═══════════════════════════════════════════════════════════════════════════
// CE QU'ELLE RÉSOUT, ET IL FALLAIT LE MESURER AVANT D'ÉCRIRE UNE LIGNE.
// `access.demo` du manifeste donne un palier à TOUT LE MONDE. Preda voulait
// autre chose : pouvoir se donner À LUI un palier, pour juger le rendu abonné,
// sans ouvrir la porte au public.
//
// 🔴 ET IL FAUT DIRE TOUT DE SUITE CE QU'ELLE NE FERA PAS.
// Mesuré sur le miroir du 03/08 : QUATRE routes seulement sont rendues à la
// demande (`/compte/`, `/connexion/`, `/api/deconnexion`, `/api/sante`), plus
// `/api/historique/[uuid]`. Les 443 autres pages sont PRÉ-GÉNÉRÉES.
// ⭐⭐ Un cookie ne change rien à un fichier écrit au build. Cette session rend
// donc un palier lisible SUR LES ROUTES À LA DEMANDE ET LÀ SEULEMENT. Tant que
// les modules abonnés ne sont pas servis par API, il n'y a rien de plus à voir.
// ⛔ NE PAS « corriger » ça en retirant `context.isPrerendered` du middleware :
// ce serait rouvrir exactement la panne du lot 34 — 374 pages sur 447 qui
// changent pour tout le monde et pour Google.
//
// ═══════════════════════════════════════════════════════════════════════════
// LES QUATRE RÈGLES, DANS L'ORDRE OÙ ELLES COMPTENT
// ═══════════════════════════════════════════════════════════════════════════
// 1. ⛔ LE PALIER EST SIGNÉ, DONC INFALSIFIABLE. Le cookie porte `palier.exp`
//    ET un HMAC. Sans lui, `vp_demo=whale` suffirait, tapé dans la console du
//    navigateur — ce serait vendre l'abonnement en le laissant sur la table.
//    ⚠️ ET IL FAUT LE DIRE EXACTEMENT : le jeton est SIGNÉ, PAS CHIFFRÉ.
//    `d2hhbGUuMTc4NjM2MDc0MQ` se décode en `whale.1786360741` — n'importe qui
//    peut LIRE son propre palier. C'est sans importance : il le connaît déjà,
//    puisqu'il a la clé pour l'avoir demandé. La propriété qui compte ici est
//    l'INTÉGRITÉ (on ne peut pas le fabriquer), pas la confidentialité.
//    ⭐ Écrire « jamais en clair » aurait été faux, et une affirmation fausse
//    sur un mécanisme de sécurité, écrite dans un livrable, est relue comme
//    vraie — c'est exactement ce qui est parti en production ce matin.
//    ⛔ Corollaire : ne JAMAIS mettre dans ce jeton autre chose qu'un palier.
//    Pas d'identifiant, pas de courriel, rien qui ne doive pas être lu.
// 2. ⛔ SANS `DEMO_CLE`, LA FONCTION EST ABSENTE, PAS DÉSACTIVÉE. Aucune
//    valeur par défaut, aucune clé de repli, aucun « mode développement ».
//    ⭐ Une clé par défaut dans un dépôt public EST la clé de tout le monde.
// 3. ⛔ ELLE S'EFFACE DÈS QUE `SESSION_API` EXISTE. Exactement la condition de
//    `palierDeDemonstration()`, et pour la même raison : une démo qui survit
//    au vrai service de session n'est plus une démo, c'est un CONTOURNEMENT —
//    et une panne réseau de l'API distribuerait l'abonnement.
// 4. ⛔ ELLE EXPIRE. `access.demo` du manifeste est une porte assumée sans date
//    de fin ; un jeton signé, non. ⭐ Une porte qu'on ouvre pour un après-midi
//    et qui n'a pas de fin est une porte qu'on oubliera — et les portes
//    oubliées sont celles que `etat_reel.py` a dû apprendre à compter.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { PALIERS } from './access.mjs';

export const COOKIE_DEMO = 'vp_demo';

// Sept jours. Assez pour une session de travail et ses lendemains, trop peu
// pour qu'un jeton oublié dans un navigateur devienne un abonnement gratuit.
export const DUREE_S = 7 * 24 * 3600;

const cle = (env) => String(env?.DEMO_CLE || process.env.DEMO_CLE || '').trim();
const sessionApi = (env) => String(env?.SESSION_API || process.env.SESSION_API || '').trim();

// ⭐ UN SEUL ENDROIT DÉCIDE SI LA FONCTION EXISTE. Répartir ce test entre la
// route qui émet et le middleware qui lit, c'est se donner deux occasions de
// se tromper, et une seule d'être cohérent.
export function demoDisponible(env) {
  if (sessionApi(env)) return false;   // règle 3 : le vrai service prime
  return cle(env).length >= 16;        // règle 2 : pas de clé, pas de fonction
}

// ⚠️ Une clé courte est une clé absente qui se croit présente. 16 caractères
// n'est pas un seuil cryptographique, c'est un refus de la faute de frappe :
// `DEMO_CLE=1` doit échouer bruyamment au lieu de protéger un abonnement.
export function raisonIndisponible(env) {
  if (sessionApi(env)) return 'SESSION_API est configure : la demo s\'efface, par construction.';
  const k = cle(env);
  if (!k) return 'DEMO_CLE n\'est pas renseignee : la session de demonstration n\'existe pas.';
  if (k.length < 16) return `DEMO_CLE fait ${k.length} caracteres ; il en faut au moins 16.`;
  return null;
}

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64url');
const deb64 = (s) => Buffer.from(s, 'base64url').toString('utf8');

const signature = (charge, k) => createHmac('sha256', k).update(charge).digest('base64url');

// ⭐ COMPARAISON À TEMPS CONSTANT. Un `===` sur une signature fuit sa réponse
// par le temps qu'il met à la donner : on la reconstruit octet par octet. Le
// coût ici est nul, l'habitude vaut pour les fois où elle comptera.
function memeSignature(a, b) {
  const x = Buffer.from(String(a), 'utf8');
  const y = Buffer.from(String(b), 'utf8');
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export function emettre(palier, env, maintenant = Date.now()) {
  if (!demoDisponible(env)) return null;
  if (!PALIERS.includes(palier)) return null;
  const exp = Math.floor(maintenant / 1000) + DUREE_S;
  const charge = b64(`${palier}.${exp}`);
  return `${charge}.${signature(charge, cle(env))}`;
}

// ⭐ RETOURNE LE PALIER BRUT, JAMAIS UN DROIT. C'est `palierVisiteur()` qui
// vérifie ensuite que ce palier est déclaré dans `access.tiers` du site et le
// ramène à `visitor` sinon. Deux sources de vérité sur un droit d'accès
// finissent toujours par diverger ; il n'y en a qu'une, et elle est ailleurs.
export function lire(valeur, env, maintenant = Date.now()) {
  if (!demoDisponible(env)) return null;
  if (!valeur || typeof valeur !== 'string') return null;
  const bouts = valeur.split('.');
  if (bouts.length !== 2) return null;
  const [charge, sig] = bouts;
  if (!memeSignature(sig, signature(charge, cle(env)))) return null;
  let palier; let exp;
  try {
    const clair = deb64(charge).split('.');
    palier = clair[0];
    exp = Number(clair[1]);
  } catch { return null; }
  if (!PALIERS.includes(palier)) return null;
  if (!Number.isFinite(exp) || exp * 1000 <= maintenant) return null;   // règle 4
  return palier;
}

// ⚠️ `HttpOnly` : ce jeton n'a aucune raison d'être lisible en JavaScript, et
// ce qu'un script ne peut pas lire, une injection ne peut pas voler.
// ⚠️ `SameSite=Lax` : un site tiers ne doit pas pouvoir déclencher la démo.
export const optionsCookie = (secure = true) => ({
  path: '/', httpOnly: true, sameSite: 'lax', secure, maxAge: DUREE_S,
});
