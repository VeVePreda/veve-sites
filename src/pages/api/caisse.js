// ⚠️ VeVePreda/veve-sites — src/pages/api/caisse.js   (FICHIER NEUF — lot 200)
// ═══════════════════════════════════════════════════════════════════════════
//  LA PORTE DE LA CAISSE — ouvrir une commande, puis suivre son état
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ UNE SEULE ROUTE POUR LES DEUX GESTES, ET LE CHOIX EST STRUCTUREL.
// Une route de compte se déclare à SEPT endroits dans ce réseau, dont un hors
// dépôt (Cloudflare). Mais pour une route SOUS `/api/`, il n'y en a que DEUX —
// `ROUTES_COMPTE` ici, et `nginx.server.conf` qui porte déjà
// `location ^~ /api/`, générique. C'est écrit noir sur blanc dans
// `astro_routes_compte.mjs`, au lot 140-3. ⇒ Deux fichiers `/api/caisse/*.js`
// auraient coûté deux déclarations ; une seule route en coûte une.
//
// ⛔ ET SURTOUT : AUCUNE PAGE NEUVE. L'écran d'achat vit dans `/compte/`, qui
// est DÉJÀ une route de compte, déjà connue de nginx et déjà connue du bord.
// Créer `/caisse/` aurait rouvert les sept endroits — dont celui que le dépôt
// ne peut pas voir.
//
// 🔴 `prerender` EST UN LITTÉRAL, comme partout ailleurs. Astro exige qu'il
// soit statiquement analysable ; une expression retombe silencieusement sur
// `true`. C'est l'intégration `veve:routes-compte` qui pose la vraie valeur,
// à condition que ce fichier soit inscrit dans `ROUTES_COMPTE`. ⛔ L'y oublier
// pré-génèrerait cette route EN SILENCE : un fichier figé, incapable de lire
// un cookie, qui servirait la même réponse à tout le monde. C'est la panne du
// lot 24, et c'est la sixième fois qu'elle est écrite dans ce dépôt.
export const prerender = true;

import { compteDeLaSession } from '../../../engine/lib/compte.mjs';
import { ouvrirCommande, lireCommande, reveiller, grille } from '../../../engine/lib/caisse.mjs';

const ENTETES = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: ENTETES });

// ⭐ MÊME PORTIER QUE `/api/favoris`, MOT POUR MOT. Deux façons de reconnaître
//   un visiteur connecté, ce sont deux façons de se tromper — et c'est
//   toujours celle qu'on a oubliée qui sert.
async function qui(cookies) {
  const sid = cookies.get('vp_session')?.value || null;
  if (!sid) return { refus: json({ erreur: 'session' }, 401) };
  let compte = null;
  try {
    compte = await compteDeLaSession(sid);
  } catch {
    return { refus: json({ erreur: 'indisponible' }, 503) };
  }
  if (!compte) return { refus: json({ erreur: 'session' }, 401) };
  return { compte };
}

const corps = async (request) => { try { return await request.json(); } catch { return null; } };

// ⛔ L'ADRESSE D'ENCAISSEMENT SORT ICI, ET C'EST NORMAL : l'acheteur DOIT la
//   voir pour payer, elle est imprimée sur l'écran. Ce n'est pas un secret —
//   c'est le contraire d'un secret. ⚠️ Elle ne sort PAS de `/api/sante`, qui
//   répond à tout le monde sans session : là-bas, un booléen suffit.
const adresse = () => String(process.env.CAISSE_ADRESSE || '').trim();

/**
 * GET /api/caisse            → la grille des prix et l'adresse d'encaissement
 * GET /api/caisse?ref=<r>    → l'état d'UNE commande (c'est ce que la page sonde)
 */
export async function GET({ url, cookies }) {
  const { compte, refus } = await qui(cookies);
  if (refus) return refus;
  try {
    // ⭐ CHAQUE PASSAGE RÉVEILLE LE COLLECTEUR. C'est le seul endroit du site
    //   qui s'exécute forcément pendant qu'un acheteur attend, et il ne coûte
    //   rien quand aucune commande n'est ouverte : `reveiller()` s'arrête tout
    //   seul dans ce cas.
    reveiller();
    const ref = url.searchParams.get('ref');
    if (ref) {
      const c = lireCommande(ref, compte);
      if (!c) return json({ erreur: 'inconnue' }, 404);
      return json({
        etat: c.etat,
        cents: c.cents,
        palier: c.palier,
        mois: c.mois,
        // ⭐ ON REND LE TEMPS QUI RESTE, PAS L'HEURE DE FIN. L'horloge du
        //   visiteur peut avoir des minutes de décalage ; un compte à rebours
        //   calculé sur SON horloge afficherait « expiré » sur une commande
        //   parfaitement valide, ou l'inverse.
        reste_s: Math.max(0, Math.round((c.ecran_a - Date.now()) / 1000)),
      });
    }
    return json({ grille: grille(), adresse: adresse() });
  } catch (e) {
    return json({ erreur: 'stockage', detail: String((e && e.message) || e) }, 503);
  }
}

/**
 * POST /api/caisse  { palier, mois }  → ouvre une commande et rend le montant
 */
export async function POST({ request, cookies }) {
  const { compte, refus } = await qui(cookies);
  if (refus) return refus;
  const b = await corps(request);
  if (!b) return json({ erreur: 'corps' }, 400);
  try {
    const r = ouvrirCommande(compte, b.palier, Number(b.mois));
    if (!r.ok) {
      // ⚠️ CHAQUE REFUS A SON PROPRE CODE. « le palier n'existe pas » et « la
      //   caisse n'est pas configurée » ne se réparent pas de la même façon,
      //   et un 400 unique enverrait chercher un défaut dans le navigateur
      //   alors qu'il manque une variable sur le serveur.
      const codes = { palier: 400, duree: 400, compte: 400, caisse: 503, sature: 429 };
      return json({ erreur: r.raison }, codes[r.raison] || 400);
    }
    // ⭐ LE RÉVEIL VIENT APRÈS LA CRÉATION, PAS AVANT : `reveiller()` ne
    //   démarre rien tant qu'aucune commande n'attend, et celle-ci vient
    //   justement de naître.
    reveiller();
    return json({
      ok: true,
      reference: r.reference,
      cents: r.cents,
      palier: r.palier,
      mois: r.mois,
      adresse: adresse(),
      reste_s: Math.max(0, Math.round((r.ecran_a - Date.now()) / 1000)),
    });
  } catch (e) {
    return json({ erreur: 'stockage', detail: String((e && e.message) || e) }, 503);
  }
}
