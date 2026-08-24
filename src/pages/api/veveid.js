// ⚠️ VeVePreda/veve-sites — src/pages/api/veveid.js  (FICHIER NEUF, lot 98)
// ═══════════════════════════════════════════════════════════════════════════
// LA PASSERELLE VERS VeVe ID — on n'emmène pas la personne, on l'y fait entrer.
// ═══════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ POURQUOI LE PARCOURS DE PREUVE N'EST PAS ICI, ET NE LE SERA JAMAIS.
// Prouver qu'un portefeuille VeVe vous appartient demande de lire la chaîne,
// de tenir un défi ouvert trente minutes et de surveiller l'escrow. Ce code
// existe, il est éprouvé, et il a été REMONTÉ dans `veveid` le 20/07/2026
// précisément parce qu'il était déjà écrit DEUX FOIS — dans MightysArena et
// dans Loop — et allait l'être une troisième.
// ⛔ Le réécrire ici serait la troisième fois. On appelle, on ne recopie pas.
//
// ⭐⭐ ET C'EST AUSSI CE QU'IL FAUT DIRE À LA PERSONNE : VeVe ID est un service
// INDÉPENDANT de VeVePrice, qui rend le même service à plusieurs sites.
// VeVePrice ne voit jamais que le résultat — oui ou non. Ce n'est pas une
// formule de politesse, c'est la description exacte de ce que fait ce fichier.
//
// ⭐ LITTERAL, ET C'EST LE POINT. Astro exige que `prerender` soit
// statiquement analysable ; une EXPRESSION n'est pas evaluee et retombe
// silencieusement sur `true`. La valeur reelle est posee par l'integration
// `veve:routes-compte` (engine/lib/astro_routes_compte.mjs) selon le mode du
// manifeste. `true` ici est le defaut SUR : sans adaptateur, un build static
// ne peut pas rendre cette route a la demande.
export const prerender = true;

// ⭐⭐ DEUX NOMS POUR LE MEME SECRET — corrige au lot 94. `veveid` lit
// `ID_SERVICE`, ce depot lisait `VEVEID_SERVICE`. On accepte les deux : un
// secret partage qui porte deux noms selon le cote est une erreur de recopie
// en attente.
// 🔴 LOT 140-3 — LA DEFINITION A DEMENAGE, ELLE N'A PAS ETE RECOPIEE.
// `engine/lib/compte.mjs` en a besoin pour interroger `/api/session?sid=`.
// En ecrire une deuxieme copie ici aurait donne deux definitions d'un meme
// secret : le jour ou l'une apprend un troisieme nom de variable et pas
// l'autre, une moitie du site parle a veveid et l'autre non. C'est la panne
// P30 du lot 139, et le lot 140-1 vient d'en payer une autre avec trois
// lectures de `plages:`. ⛔ Un predicat recopie est un predicat qui divergera.
import { secretDeService } from '../../../engine/lib/compte.mjs';

// ⛔ LA LISTE EST FERMÉE ICI AUSSI, ET CE N'EST PAS UNE DUPLICATION INUTILE.
// `veveid` refuse déjà toute destination hors de sa propre liste — c'est LUI
// qui décide, et c'est bien ainsi. Mais un formulaire de ce site ne doit pas
// pouvoir POSTER une valeur arbitraire vers un service : le refus au plus près
// de la saisie évite un aller-retour réseau pour rien, et surtout il dit ce
// que CE site sait demander.
// ❤️ LOT 141 — `decouvrir` REJOINT LA LISTE, ET L'OUBLIER AURAIT ÉTÉ MUET.
// Le gabarit de `/compte/` demande désormais `decouvrir` quand aucun
// portefeuille n'est encore saisi. ⛔ Une valeur absente d'ici ne provoque
// AUCUNE erreur : la boucle ci-dessous la laisse tomber et `vers` garde son
// défaut, `verifier` — c'est-à-dire exactement l'ancien parcours, sur un build
// vert et sans un message. ⭐⭐⭐ C'est pour ça que `test:membre` §7 EXERCE la
// passerelle au lieu de lire ce fichier : il extrait les destinations que la
// page demande vraiment, et vérifie qu'elles arrivent intactes chez veveid.
// ⚠️ Et il y a bien DEUX listes, ici et chez veveid, ce qui est voulu : veveid
// décide seul de ce qu'il sert ; celle-ci dit ce que CE site sait demander, et
// évite qu'un formulaire de ce domaine poste une valeur arbitraire vers un
// service. ⛔ Mais elles doivent grandir ENSEMBLE — et veveid a été déposé en
// premier, exprès : entre les deux dépôts, le site n'envoyait encore que des
// destinations que veveid connaissait déjà.
const DESTINATIONS = ['compte', 'verifier', 'decouvrir'];

export async function POST({ request, cookies, redirect }) {
  const sid = cookies.get('vp_session')?.value || null;
  const base = process.env.SESSION_API || '';
  // ⛔ Sans session ou sans service, on ne fabrique rien et on renvoie à la
  // porte. Un message d'erreur ici n'apprendrait rien à personne : quelqu'un
  // sans session n'a aucune raison d'être sur cette route.
  if (!sid || !base) return redirect('/acces/', 303);

  let vers = 'verifier';
  try {
    const form = await request.formData();
    const v = String(form.get('vers') ?? '');
    if (DESTINATIONS.includes(v)) vers = v;
  } catch { /* corps illisible : on garde la destination par défaut */ }

  try {
    const r = await fetch(`${base}/api/passerelle`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-service': secretDeService() },
      body: JSON.stringify({ sid, vers }),
      // ⚠️ Sans délai maximum, un service muet retient la requête du visiteur
      // jusqu'au bout du timeout système — deux minutes de page blanche.
      signal: AbortSignal.timeout(4000),
    });
    if (r.ok) {
      const j = await r.json();
      // ⭐ ON NE REDIRIGE QUE VERS UNE ADRESSE QUE veveid A FABRIQUÉE, et on
      // vérifie qu'elle commence bien par le service qu'on a interrogé. Sans
      // ce contrôle, une réponse compromise ferait de cette route une
      // redirection ouverte — et elle porterait NOTRE domaine.
      if (typeof j?.url === 'string' && j.url.startsWith(base)) return redirect(j.url, 303);
    }
  } catch { /* on retombe sur le message d'échec ci-dessous */ }

  // ⚠️ ON REVIENT SUR /compte/ AVEC UN CODE, jamais sur une page d'erreur nue :
  // la personne doit retrouver son compte, pas un cul-de-sac.
  return redirect('/compte/?e=id', 303);
}

// Un GET ici n'est pas une entrée : il serait déclenché par un préchargeur de
// liens, et brûlerait un jeton à usage unique sans que personne ait cliqué.
export const GET = () => new Response('Méthode non autorisée — utiliser POST.',
  { status: 405, headers: { allow: 'POST' } });
