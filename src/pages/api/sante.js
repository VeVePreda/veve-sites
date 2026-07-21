// ROUTE DE SANTE — la preuve que le mode serveur vit vraiment.
//
// C'est la seule route dynamique du socle hybride, et elle ne fait rien d'utile :
// elle repond « je suis la, dans tel mode ». Son role est d'etre la premiere
// chose a interroger apres un deploiement. Si /api/sante repond « server »,
// alors l'image, le port et l'adaptateur sont corrects — et les lots suivants
// (comptes, webhook du prestataire) peuvent s'appuyer dessus.
//
// ⚠️ LE `prerender` EST CONDITIONNEL, ET IL LE DOIT.
// Une route `prerender = false` fait ECHOUER le build en mode static, ou aucun
// adaptateur n'est installe (erreur NoAdapterInstalled). En mode static cette
// route devient donc un simple fichier ; en mode server, elle est calculee a la
// demande. Le mode se lit dans la reponse : c'est ce qui distingue « une page
// servie » de « une page calculee ».
export const prerender = process.env.RENDERING !== 'server';

export const GET = () => new Response(
  JSON.stringify({
    ok: true,
    mode: process.env.RENDERING === 'server' ? 'server' : 'static',
    site: process.env.SITE || 'veveprice',
  }),
  { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } },
);
