// ⚠️ VeVePreda/veve-sites — src/pages/api/inscription.js  (FICHIER NEUF)
// ═══════════════════════════════════════════════════════════════════════════
// LA ROUTE QUI REFUSE HONNÊTEMENT — lot 42, 03/08/2026
// ═══════════════════════════════════════════════════════════════════════════
// ⛔⛔ CETTE ROUTE NE CRÉE AUCUN COMPTE, ET C'EST L'ÉTAT ACTUEL, PAS UN OUBLI.
// Arbitrage Preda du 03/08 : le courriel + mot de passe se fera EN DERNIER.
// `veveid` — le seul service d'identité qui existe — ne connaît que le parcours
// par wallet : ni mot de passe, ni `/oauth/start` (vérifié dans son server.ts,
// sa table de routes est /connexion, /entrer, /choisir, /verification, /apres).
//
// ⭐⭐ ALORS POURQUOI ÉCRIRE LA ROUTE MAINTENANT ?
// Parce que le formulaire de la page existe, et qu'un `action` qui pointe vers
// le vide rend un 404 brut au moment exact où quelqu'un vient de taper son mot
// de passe. Une route qui répond « pas encore, et voici pourquoi » est le seul
// comportement qui ne mente pas.
//
// 🔴 ET SURTOUT : ELLE NE LIT PAS LE CORPS DE LA REQUÊTE.
// ⛔ Pas de `formData()`, pas de journal, pas de « on garde les courriels pour
// prévenir à l'ouverture ». Un mot de passe qu'on ne lit pas est un mot de
// passe qu'on ne peut pas écrire dans un journal par accident — et les fuites
// de journaux sont la façon la plus banale de perdre des données d'autrui.
// ⭐ Ce qui n'est pas conservé ne peut pas fuiter. C'est déjà la phrase de
// `login.why` dans les cinq langues ; la route l'applique au lieu de la citer.

export const prerender = true;

import { t, locales } from '../../../engine/lib/i18n.mjs';

export async function POST(context) {
  const { active, def } = locales();
  const souhait = (context.request.headers.get('accept-language') || '')
    .split(',').map((x) => x.split(';')[0].trim().slice(0, 2).toLowerCase());
  const lang = souhait.find((l) => active.includes(l)) || def;

  const ouverte = Boolean(process.env.INSCRIPTION_API);

  if (!ouverte) {
    // ⭐ 503 ET PAS 404 : le service EXISTE et sera disponible. 404 dirait
    // « cette adresse n'existe pas », ce qui est faux et enverrait chercher
    // une faute de frappe. ⚠️ `Retry-After` est volontairement ABSENT : on ne
    // connaît pas la date, et l'inventer serait une deuxième promesse.
    return new Response(
      `${t(lang, 'signup.closed')}\n\n${t(lang, 'signup.closed.d')}\n`,
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } },
    );
  }

  // ⏳ LE JOUR OÙ `INSCRIPTION_API` EXISTERA, C'EST ICI QUE LE RELAIS SE POSE.
  // ⛔ Et ce jour-là, la règle ne change pas : ce dépôt RELAIE, il ne stocke
  // pas. Le hachage, le salage, la limitation de débit, la réinitialisation et
  // la notification de fuite vivent dans le service d'identité — c'est la dette
  // la plus coûteuse qu'un site à un seul développeur puisse contracter, et la
  // seule dont l'échec se paie en données d'autrui.
  return new Response('Not implemented', {
    status: 501, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// ⚠️ UN GET SUR CETTE ADRESSE N'EST PAS UNE INSCRIPTION. Sans ce garde, Astro
// rendrait 404 sur un GET — ce qui laisserait croire que le POST n'existe pas
// non plus. On redirige vers la page qui porte le formulaire.
export async function GET() {
  return new Response(null, { status: 302, headers: { location: '/inscription/', 'cache-control': 'no-store' } });
}
