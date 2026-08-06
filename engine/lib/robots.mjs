// ⚠️ VeVePreda/veve-sites — engine/lib/robots.mjs  (FICHIER NEUF, lot 96)
// ═══════════════════════════════════════════════════════════════════════════
// LES GARDE-FOUS ANTI-ROBOTS DU FORMULAIRE D'INSCRIPTION
// ═══════════════════════════════════════════════════════════════════════════
// 🔴 LE DANGER N'EST PAS « DES ROBOTS CRÉENT DES COMPTES ». Un compte naît à la
// CONSOMMATION du lien, jamais à sa demande : mille adresses postées ne créent
// aucun compte. Les deux vrais dangers sont ailleurs, et ils coûtent cher :
//
//  ① LE QUOTA D'ENVOI. 300 courriels/jour au palier gratuit de Brevo. Un robot
//     le brûle en minutes, et plus personne ne peut s'inscrire jusqu'au
//     lendemain — sans le moindre signe, la page dira toujours « vérifiez vos
//     e-mails ».
//  ② LE BOMBARDEMENT D'UN TIERS. Cent liens envoyés à une adresse qui n'est
//     pas la sienne. La victime signale « indésirable », et c'est NOTRE
//     domaine qui perd sa réputation d'envoi.
//     ⭐⭐⭐ Celui-là ne coûte pas une panne : il coûte la capacité d'envoyer,
//     pour tout le monde, durablement.
//
// ⛔ PAS DE CAPTCHA, ET C'EST UN CHOIX. Dépendance externe, JavaScript tiers,
//    traceur, et friction sur l'écran le plus fragile du parcours. Les deux
//    contrôles ci-dessous ne coûtent RIEN à un humain et arrêtent l'écrasante
//    majorité des robots : ceux qui postent un formulaire sans le rendre.

import { createHmac, timingSafeEqual } from 'node:crypto';

export const CHAMP_PIEGE = 'site_web';
export const DELAI_MIN_MS = 2500;
export const DELAI_MAX_MS = 2 * 3600_000;   // deux heures : un onglet oublié

// ⚠️ Lecture PARESSEUSE : `const X = process.env.Y` s'évalue à l'import, donc
// avant que l'adaptateur ait posé l'environnement. Piège déjà payé ailleurs.
const secret = () =>
  process.env.VEVEID_SERVICE || process.env.ID_SERVICE || process.env.SESSION_SECRET || 'sans-secret';

const signer = (v) => createHmac('sha256', `${secret()}|robots`).update(v).digest('base64url');

/** L'heure d'affichage du formulaire, signée. */
export function sceau(maintenant = Date.now()) {
  const corps = String(maintenant);
  return `${corps}.${signer(corps)}`;
}

/**
 * 🔴 LE SCEAU EST SIGNÉ, ET C'EST TOUT L'INTÉRÊT. Sans signature, il suffirait
 *    de poster un horodatage vieux de dix secondes : le contrôle ne coûterait
 *    rien à contourner et donnerait l'illusion d'une protection.
 * ⚠️ ET IL EXPIRE : un sceau valable indéfiniment se récolte une fois et se
 *    rejoue mille fois — ce serait un laissez-passer, pas un délai.
 */
export function verdict(champPiege, sceauFourni, maintenant = Date.now()) {
  if (champPiege && String(champPiege).trim() !== '')
    return { ok: false, pourquoi: 'champ piège rempli' };

  const s = String(sceauFourni ?? '');
  if (!s.includes('.')) return { ok: false, pourquoi: 'sceau absent' };
  const i = s.lastIndexOf('.');
  const corps = s.slice(0, i);
  const sig = s.slice(i + 1);
  const attendu = signer(corps);
  if (sig.length !== attendu.length) return { ok: false, pourquoi: 'sceau invalide' };
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(attendu))) return { ok: false, pourquoi: 'sceau invalide' };

  const ts = Number(corps);
  if (!Number.isFinite(ts)) return { ok: false, pourquoi: 'sceau illisible' };
  const age = maintenant - ts;
  if (age < DELAI_MIN_MS) return { ok: false, pourquoi: `formulaire posté en ${age} ms` };
  if (age > DELAI_MAX_MS) return { ok: false, pourquoi: 'sceau périmé' };
  return { ok: true };
}

/**
 * ⭐⭐ L'ADRESSE DU VISITEUR — celle qui sert de clé au limiteur de veveid.
 *
 * 🔴 SANS ELLE, LE LIMITEUR DE veveid EST UN SEAU PARTAGÉ PAR LE MONDE ENTIER :
 *    il s'indexe sur l'adresse de la connexion, qui est celle de CE serveur.
 *    Cinq inscriptions par dix minutes, pour tous. Ce n'était pas une
 *    protection : c'était une panne à partir du sixième inscrit.
 *
 * ⚠️ `CF-Connecting-IP` d'abord : c'est Cloudflare qui la pose, et en
 *    production toute requête passe par lui. `clientAddress` d'Astro ensuite.
 * ⛔ ON NE JOURNALISE PAS CETTE VALEUR et on ne la stocke nulle part : elle
 *    ne sert qu'à indexer un seau en mémoire, chez veveid.
 */
export function adresseVisiteur(request, clientAddress) {
  const cf = request?.headers?.get?.('cf-connecting-ip');
  const brut = (cf || clientAddress || '').split(',')[0].trim();
  if (!brut || brut.length > 45) return null;
  return /^[0-9a-fA-F:.]+$/.test(brut) ? brut : null;
}

/**
 * Le bloc HTML du champ piège. ⭐ STYLES EN LIGNE, pas de classe : ce moteur
 * a trois contrôles CSS qui traquent les règles sans émetteur et les classes
 * jamais émises. Une classe posée ici pour un seul champ invisible serait
 * exactement le genre de dette qu'ils cherchent.
 * ⛔ NI `display:none` NI `type=hidden` : un robot un peu sérieux ignore les
 *    deux. On sort le champ de l'écran, il reste « visible » pour le code.
 * ⚠️ `aria-hidden` + `tabindex=-1` + `autocomplete=off` sont OBLIGATOIRES :
 *    sans eux, un lecteur d'écran l'annonce et un gestionnaire de mots de
 *    passe le remplit — on bloquerait de vraies personnes, en silence.
 */
export const champPiegeHtml = () =>
  `<div aria-hidden="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden">`
  + `<label for="${CHAMP_PIEGE}">Ne remplissez pas ce champ</label>`
  + `<input id="${CHAMP_PIEGE}" name="${CHAMP_PIEGE}" type="text" tabindex="-1" autocomplete="off"></div>`;
