// ⚠️ VeVePreda/veve-sites — src/pages/api/inscription.js
// ═══════════════════════════════════════════════════════════════════════════
// LE RELAIS — lot 90, 06/08/2026. Avant : une route qui refusait honnêtement.
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐ CE QUI A CHANGÉ. Ce fichier disait, depuis le lot 42 :
//     « `veveid` ne connaît que le parcours par wallet : ni mot de passe, ni
//       /oauth/start. »
// C'était vrai, et ça ne l'est plus : le lot 89 y a posé l'inscription par
// e-mail et lien à usage unique. Cette route relaie donc pour de bon.
//
// ⛔ ET LA RÈGLE N'A PAS CHANGÉ D'UN MOT : CE DÉPÔT RELAIE, IL NE STOCKE PAS.
// Pas de compte ici, pas d'adresse conservée, rien à hacher. Le hachage, la
// limitation de débit, l'expiration et la notification de fuite vivent dans le
// service d'identité. C'est la dette la plus coûteuse qu'un site à un seul
// développeur puisse contracter, et la seule dont l'échec se paie en données
// d'autrui.
//
// ⭐⭐ ET IL N'Y A PLUS DE MOT DE PASSE DU TOUT — arbitrage du lot 89. Ce qui
// n'existe pas ne peut ni fuiter, ni être réutilisé ailleurs, ni obliger
// quiconque à en choisir un treizième.
//
// ⭐ LITTERAL, ET C'EST LE POINT. Astro exige que `prerender` soit
// statiquement analysable ; une EXPRESSION n'est pas evaluee et retombe
// silencieusement sur `true`. La valeur reelle est posee par l'integration
// `veve:routes-compte` (engine/lib/astro_routes_compte.mjs) selon le mode du
// manifeste. `true` ici est le defaut SUR : sans adaptateur, un build static
// ne peut pas rendre cette route a la demande.
export const prerender = true;

// ⭐⭐ DEUX NOMS POUR LE MEME SECRET — corrige au lot 94.
// `veveid` lit `ID_SERVICE`, ce depot lisait `VEVEID_SERVICE`. C'est la MEME
// valeur, et rien ne le disait : recopier la variable sous son nom d'origine
// — le geste evident — laissait `x-service` vide, veveid repondait 401, et la
// page affichait « nous n'avons pas pu envoyer le lien ».
// ⭐⭐⭐ UN SECRET PARTAGE QUI PORTE DEUX NOMS SELON LE COTE EST UNE ERREUR DE
//   RECOPIE EN ATTENTE. On accepte donc les deux, et `VEVEID_SERVICE` reste
//   le nom recommande — celui qui dit A QUI on parle.
const secretDeService = () => process.env.VEVEID_SERVICE || process.env.ID_SERVICE || '';


import { t, locales } from '../../../engine/lib/i18n.mjs';

const langueDe = (request) => {
  const { active, def } = locales();
  const souhait = (request.headers.get('accept-language') || '')
    .split(',').map((x) => x.split(';')[0].trim().slice(0, 2).toLowerCase());
  return souhait.find((l) => active.includes(l)) || def;
};

const texte = (corps, status) => new Response(corps, {
  status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
});

export async function POST(context) {
  const lang = langueDe(context.request);
  const base = process.env.INSCRIPTION_API || '';

  if (!base) {
    // ⭐ 503 ET PAS 404 : le service EXISTE et sera disponible. 404 dirait
    // « cette adresse n'existe pas », ce qui est faux et enverrait chercher
    // une faute de frappe. ⚠️ `Retry-After` est volontairement ABSENT : on ne
    // connaît pas la date, et l'inventer serait une deuxième promesse.
    return texte(`${t(lang, 'signup.closed')}\n\n${t(lang, 'signup.closed.d')}\n`, 503);
  }

  // 🔴 SESSION_API EST EXIGÉE ICI AUSSI, ET CE N'EST PAS UNE PRÉCAUTION DE
  // TROP. Le plan de départ posait `INSCRIPTION_API` puis `SESSION_API`, dans
  // cet ordre. Mesuré en écrivant ce lot : entre les deux, quelqu'un pourrait
  // s'inscrire, recevoir son courriel, cliquer — et `api/entrer.js` n'aurait
  // rien pour échanger le code. Un lien à usage unique CONSOMMÉ POUR RIEN,
  // c'est-à-dire une inscription perdue et un lien qui ne remarchera pas.
  // ⭐⭐ LES DEUX VARIABLES SE POSENT ENSEMBLE. Refuser tôt vaut mieux que
  //     brûler le lien de quelqu'un.
  if (!process.env.SESSION_API) {
    console.error('[inscription] INSCRIPTION_API posée sans SESSION_API — les deux vont ensemble.');
    return texte(`${t(lang, 'signup.closed')}\n\n${t(lang, 'signup.closed.d')}\n`, 503);
  }

  // ⚠️ ON NE LIT QUE L'ADRESSE. Pas de pseudo « pour plus tard », pas de
  // journal du corps. Une donnée qu'on ne lit pas est une donnée qu'on ne peut
  // pas écrire dans un journal par accident.
  let email = '';
  try { email = String((await context.request.formData()).get('courriel') ?? '').trim(); }
  catch { email = ''; }
  if (!email) return context.redirect('/inscription/?e=1', 303);

  // ⚠️ LE RETOUR EST CONSTRUIT CÔTÉ SERVEUR, JAMAIS REPRIS D'UN PARAMÈTRE.
  // Un `?retour=` accepté tel quel est une redirection ouverte. veveid le
  // revérifie de son côté (`retourAutorise()`, comparaison d'ORIGINES) : les
  // deux contrôles sont utiles, celui-ci empêche d'envoyer une bêtise, celui
  // de veveid empêche d'en accepter une.
  const origine = new URL(context.request.url).origin;
  const retour = new URL('/api/entrer', origine).href;

  try {
    const r = await fetch(`${base}/api/inscription`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-service': secretDeService() },
      body: JSON.stringify({
        email,
        site: process.env.VEVEID_SITE || process.env.SITE || '',
        retour,
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) {
      // ⚠️ ON NE RECOPIE PAS LA RAISON DANS LA PAGE. veveid distingue
      // « adresse invalide » de « trop de demandes » ; le dire au visiteur
      // rendrait le formulaire bavard sur ce qui existe. Le journal, lui, a
      // le droit de savoir.
      console.error(`[inscription] veveid a refusé : ${r.status} ${(await r.text()).slice(0, 200)}`);
      if (r.status === 400) return context.redirect('/inscription/?e=1', 303);
      return context.redirect('/inscription/?e=2', 303);
    }
  } catch (e) {
    console.error(`[inscription] veveid injoignable : ${e?.message}`);
    return context.redirect('/inscription/?e=2', 303);
  }

  // 🔴 LA MÊME PAGE DANS TOUS LES CAS DE SUCCÈS — adresse neuve ou déjà
  // inscrite. Une page qui dirait « compte créé » d'un côté et « content de
  // vous revoir » de l'autre transformerait ce formulaire en outil pour savoir
  // qui est inscrit : avec une liste d'adresses achetée, c'est une fuite à
  // l'échelle. veveid applique déjà cette règle ; on ne la défait pas ici.
  return context.redirect('/inscription/?envoye=1', 303);
}

// ⚠️ UN GET SUR CETTE ADRESSE N'EST PAS UNE INSCRIPTION. Sans ce garde, Astro
// rendrait 404 sur un GET — ce qui laisserait croire que le POST n'existe pas.
export const GET = () => new Response('Méthode non autorisée — utiliser POST.',
  { status: 405, headers: { allow: 'POST' } });
