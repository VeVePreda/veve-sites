// ⚠️ DEPOT : VeVePreda/veveid   ·   CHEMIN : src/portes.ts   (FICHIER NEUF)
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 LOT 163-B① — LA SURCHARGE DES PORTES, ET SA DATE DE FIN.
 * ═══════════════════════════════════════════════════════════════════════════
 * Demande de Preda du 19/08/2026 : une page d'exploitation qui déplace un
 * module d'un grade à l'autre, « durant les tests je les donne accessibles aux
 * membres, PUIS ENSUITE je les mets qu'aux payants ».
 *
 * ⛔⛔ LE « PUIS ENSUITE » EST L'OUBLI QUE `access.mjs` REFUSE DÉJÀ PAR ÉCRIT.
 * Son commentaire sur `access.demo`, mot pour mot :
 *   « Le risque énoncé n'est pas “la démo est dangereuse”, c'est RIEN NE ME
 *     RAPPELLERA DE L'ÉTEINDRE. Une variable Coolify est invisible depuis le
 *     dépôt : elle ne peut être rappelée par rien. […] ⛔ NE PAS la déplacer
 *     dans l'environnement “pour pouvoir l'éteindre sans redéployer” : c'est
 *     précisément la propriété qu'on ne veut pas. »
 * ⇒ Ce module fait exactement la chose interdite — ouvrir sans redéployer —
 *   et il n'est acceptable QUE parce que la date de fin est obligatoire et
 *   COURTE. Ce n'est pas un rappel, c'est une fermeture.
 *
 * ⭐ POURQUOI 30 JOURS ET PAS 400 comme un abonnement. Un abonnement ouvre des
 *   droits À UNE PERSONNE qui a payé. Une surcharge de porte les ouvre À TOUT
 *   LE MONDE sur un site public — dont `whales`, qui est le classement
 *   nominatif des 100 plus gros portefeuilles AVEC LEURS ADRESSES. Les deux
 *   gestes n'ont pas le même rayon, ils n'ont pas la même borne.
 *
 * ⚠️ UNE SEULE CLÉ PAR PORTE, ET SA VALEUR EST UN JSON COMPLET. Le lot 163-A
 *   a dû écrire « effacer les deux colonnes ENSEMBLE » parce qu'un palier sans
 *   date et une date sans palier ne veulent rien dire. Ici le problème ne peut
 *   pas se poser : la ligne existe entière, ou elle n'existe pas.
 */
import { q, q1, run, now } from './db.ts';
import { normaliserSite } from './sites.ts';
// ⭐ Les paliers viennent d'`avoirs.ts` — PAS d'une seconde liste. Le lot
//   163-A explique déjà pourquoi la recopie inter-dépôts est tolérable ; une
//   recopie DANS le même dépôt ne l'est pas.
import { PALIERS } from './avoirs.ts';

/**
 * 🔴 LA LISTE BLANCHE DES PORTES — recopiée de `PORTES_CONNUES`
 * (`engine/lib/access.mjs`, veve-sites). Même dispositif que `PALIERS` au lot
 * 163-A : les deux dépôts ne partagent aucun fichier, alors on rend la
 * divergence INOFFENSIVE au lieu de prétendre l'éviter.
 * ⭐⭐ LES DEUX CÔTÉS ÉCHOUENT FERMÉ : ici une porte hors liste est refusée à
 *   l'écriture ; là-bas `porte()` LÈVE sur un nom inconnu. Une porte inventée
 *   d'un côté n'ouvre donc rien de l'autre — au pire elle n'existe pas.
 * ⛔ NE PAS y ajouter une porte « en prévision » : elle serait posable, elle
 *   n'ouvrirait rien, et le geste aurait l'air d'avoir marché.
 */
export const PORTES = ['price_history', 'extremes', 'modules', 'alerts', 'wallet_watch', 'cote', 'movers'];

/** ⭐ Le plafond de durée. Voir l'en-tête : ce n'est pas la borne d'un abonnement. */
export const JOURS_MAX = 30;

export interface Surcharge { porte: string; tier: string; jusqu_a: string }

const cle = (site: string, porte: string) => `porte.${site}.${porte}`;

/**
 * Les surcharges ENCORE VALIDES d'un site.
 *
 * ⭐⭐ LE FILTRE D'EXPIRATION EST ICI, PAS CHEZ L'APPELANT. C'est la seule
 *   façon d'être sûr que veveprice, la page d'admin et un futur troisième
 *   lecteur appliquent la même règle. Le lot 140-1 a payé l'inverse : trois
 *   lectures justes de la même loi, qui divergent le jour où UNE apprend une
 *   règle de plus.
 * ⚠️ ON NE SUPPRIME PAS LA LIGNE EXPIRÉE au passage. Une lecture qui écrit
 *   est une lecture qui peut échouer, et une trace expirée dit « ceci a été
 *   ouvert jusqu'au 3 » — c'est utile, et c'est le seul endroit qui le dit.
 */
export function lireSurcharges(site: string, maintenant = now()): Surcharge[] {
  const s = normaliserSite(site);
  const lignes = q<{ cle: string; valeur: string }>(
    'SELECT cle, valeur FROM reglages WHERE cle LIKE ? ORDER BY cle', `porte.${s}.%`);
  const out: Surcharge[] = [];
  for (const l of lignes) {
    const porte = l.cle.slice(`porte.${s}.`.length);
    if (!PORTES.includes(porte)) continue;          // liste blanche, jamais liste noire
    let v: { tier?: unknown; jusqu_a?: unknown };
    // ⛔ UN JSON ILLISIBLE EST IGNORÉ, IL NE LÈVE PAS. Cette fonction est
    //   appelée par la route de service : une ligne abîmée ne doit pas
    //   empêcher veveprice de lire les six autres, ni le faire échouer tout
    //   court. ⭐ Ignorer, ici, c'est fermer — donc c'est sûr.
    try { v = JSON.parse(l.valeur); } catch { continue; }
    const tier = String(v.tier ?? '');
    const jusqu_a = String(v.jusqu_a ?? '');
    // ⚠️ `!jusqu_a` EST RECOUVERT PAR LE CONTRÔLE D'EXPIRATION juste en
    //    dessous (`'' <= toute date` est vrai), et c'est mesuré : l'injection
    //    qui le retire laisse le banc VERT. On le garde quand même — une
    //    ceinture qui ne sert que le jour où les bretelles cassent — mais on
    //    l'écrit, parce qu'un lecteur qui le croirait seul garant se
    //    tromperait. ⛔ Ne pas « nettoyer » l'un en pensant que l'autre suit :
    //    ils suivent aujourd'hui, dans cet ordre-là uniquement.
    if (!PALIERS.includes(tier) || !jusqu_a) continue;
    if (jusqu_a <= maintenant) continue;            // ⭐ elle s'est refermée seule
    out.push({ porte, tier, jusqu_a });
  }
  return out;
}

/**
 * Poser une surcharge. `jours = 0` la RETIRE.
 *
 * ⛔ QUATRE REFUS, ET AUCUN N'EST DÉCORATIF :
 *   1. porte hors liste blanche ;
 *   2. palier inconnu ;
 *   3. durée hors 0..JOURS_MAX ;
 *   4. rien de plus — en particulier ON N'INTERDIT PAS de RESSERRER une porte
 *      (poser `whale` sur `cote`). ⭐ Une surcharge qui ne saurait qu'ouvrir
 *      serait un outil à sens unique : le jour où il faut refermer vite, en
 *      production, il n'y aurait rien pour le faire.
 */
export function poserSurcharge(site: string, porte: string, tier: string, jours: number): string {
  const s = normaliserSite(site);
  if (!PORTES.includes(porte)) return 'Porte inconnue.';

  if (jours === 0) {
    run('DELETE FROM reglages WHERE cle=?', cle(s, porte));
    return `Surcharge retirée sur « ${porte} » — le manifeste reprend la main.`;
  }
  if (!PALIERS.includes(tier)) return 'Palier inconnu.';
  if (!Number.isInteger(jours) || jours < 0 || jours > JOURS_MAX) {
    return `Durée refusée : un entier de 0 à ${JOURS_MAX} jours (0 retire).`;
  }

  const jusqu_a = new Date(Date.now() + jours * 86_400_000).toISOString();
  const valeur = JSON.stringify({ tier, jusqu_a });
  // ⭐ `INSERT … ON CONFLICT` et pas « lire puis écrire » : deux gestes
  //   simultanés depuis deux onglets laisseraient sinon la dernière lecture
  //   écraser la première écriture sans que rien ne le dise.
  run('INSERT INTO reglages (cle, valeur, maj) VALUES (?,?,?) '
    + 'ON CONFLICT(cle) DO UPDATE SET valeur=excluded.valeur, maj=excluded.maj',
    cle(s, porte), valeur, now());
  return `« ${porte} » exige « ${tier} » jusqu’au ${jusqu_a.slice(0, 10)}.`;
}

/**
 * ⭐ CE QUE L'ÉCRAN D'ADMIN MONTRE : les sept portes, avec leur surcharge s'il
 *   y en a une. ⛔ Pas seulement celles qui sont surchargées : *un contrôle
 *   qui ne regarde que ce qui existe ne voit jamais ce qui manque* — et ici,
 *   ne montrer que les surcharges cacherait les six portes qu'on peut poser.
 * ⚠️ `expiree` est RENDUE, pas filtrée : « rien » et « ouvert jusqu'à hier »
 *   sont deux états différents, et le second se relit avec profit.
 */
export function tableauPortes(site: string, maintenant = now()) {
  const s = normaliserSite(site);
  const vivantes = new Map(lireSurcharges(s, maintenant).map((x) => [x.porte, x]));
  return PORTES.map((porte) => {
    const brut = q1<{ valeur: string }>('SELECT valeur FROM reglages WHERE cle=?', cle(s, porte));
    let jusqu_a: string | null = null;
    let tier: string | null = null;
    if (brut) {
      try {
        const v = JSON.parse(brut.valeur);
        tier = String(v.tier ?? '') || null;
        jusqu_a = String(v.jusqu_a ?? '') || null;
      } catch { /* ligne abîmée : elle se montre vide, elle n'empêche rien */ }
    }
    const vivante = vivantes.get(porte) ?? null;
    return { porte, tier, jusqu_a, active: vivante != null, expiree: brut != null && vivante == null };
  });
}
