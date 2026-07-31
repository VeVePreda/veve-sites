// ⚠️ VeVePreda/veve-sites — src/middleware.js  (FICHIER NEUF)
// ═══════════════════════════════════════════════════════════════════════════
// LA PIÈCE QUI MANQUAIT — le middleware de session.
// ═══════════════════════════════════════════════════════════════════════════
// `engine/lib/access.mjs` l'attendait explicitement :
//     « `locals` = `Astro.locals`, où le FUTUR MIDDLEWARE DE SESSION déposera
//       le palier. Absent aujourd'hui => visitor. »
// Tant qu'il n'existe pas, TOUT LE MONDE est visiteur : la matrice de paliers
// tourne à vide, les portes se ferment pour tous, et aucun compte ne peut
// exister. C'est la clé de voûte de l'espace membres, et elle tient en 60 lignes.
//
// ⛔ CE FICHIER NE FAIT PAS L'AUTHENTIFICATION. Il ne fait que LIRE une session
// déjà émise et en déduire un palier. Émettre la session (mot de passe, lien
// magique, VEVE-ID) est un autre lot, et il vit ailleurs — cf. §Auth du
// LISEZ-MOI. Confondre « qui es-tu » et « à quoi as-tu droit » est la faute qui
// produit les failles d'élévation de privilège.
//
// ⚠️ EN MODE `static`, CE FICHIER NE S'EXÉCUTE JAMAIS. Astro n'appelle le
// middleware que pour les routes rendues à la demande. Un site statique reste
// donc intégralement public — ce qui est correct, et ce qu'il faut savoir avant
// de croire qu'une page est protégée parce qu'elle est « derrière un palier ».

import { PALIERS } from '../engine/lib/access.mjs';

const COOKIE = 'vp_session';

// ⭐ LE PALIER NE VIENT JAMAIS DU COOKIE EN CLAIR. Un cookie `palier=whale`
// serait modifiable par n'importe qui depuis la console du navigateur : ce
// serait vendre un abonnement en le laissant sur la table. Le cookie ne porte
// qu'un IDENTIFIANT DE SESSION opaque ; le palier se relit à la source.
async function palierDeLaSession(sid, env) {
  if (!sid) return null;
  const base = env?.SESSION_API || process.env.SESSION_API;
  // Pas de service de session configuré : on ne devine pas, on ferme.
  // ⛔ Un repli « par défaut membre » transformerait une panne de réseau en
  // distribution gratuite de l'abonnement.
  if (!base) return null;
  try {
    const r = await fetch(`${base}/session/${encodeURIComponent(sid)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(1500),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j?.palier === 'string' ? j.palier : null;
  } catch {
    // ⚠️ ÉCHOUER FERMÉ. Un `catch` qui rendrait « member » serait exactement le
    // défaut de `getattr(…, ())` qui a mal étiqueté 216 838 transferts : une
    // erreur silencieuse qui produit une valeur plausible au lieu d'un refus.
    return null;
  }
}

export async function onRequest(context, next) {
  const sid = context.cookies.get(COOKIE)?.value || null;
  const brut = await palierDeLaSession(sid, context.locals?.runtime?.env);

  // ⭐ On dépose la valeur BRUTE. C'est `palierVisiteur()` d'access.mjs qui
  // décide ce qu'elle vaut : il vérifie qu'elle existe, qu'elle est déclarée
  // dans `access.tiers` du site, et il RAMÈNE À VISITOR sinon, en le disant.
  // Dupliquer ce contrôle ici en ferait la deuxième source de vérité, et deux
  // sources de vérité sur un droit d'accès finissent toujours par diverger.
  if (brut && PALIERS.includes(brut)) context.locals.palier = brut;

  const reponse = await next();

  // ⚠️ UNE PAGE QUI DÉPEND DE LA SESSION NE DOIT JAMAIS ÊTRE MISE EN CACHE
  // PARTAGÉ. Sans cet en-tête, un cache intermédiaire peut servir la page d'un
  // abonné à un visiteur — la fuite est silencieuse et totale.
  if (context.locals.palier) {
    reponse.headers.set('cache-control', 'private, no-store');
    reponse.headers.append('vary', 'cookie');
  }
  return reponse;
}
