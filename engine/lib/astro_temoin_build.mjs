// ⚠️ VeVePreda/veve-sites — engine/lib/astro_temoin_build.mjs   (FICHIER NEUF — lot 128)
// ═══════════════════════════════════════════════════════════════════════════
//  LE TÉMOIN DU BUILD — ce que le build a VRAIMENT déposé, et dans quel monde
// ═══════════════════════════════════════════════════════════════════════════
//
// 🔴🔴🔴 LA PANNE QU'IL RÉPARE, MESURÉE LE 10/08/2026.
// Discord : « les bancs sont tombés sur `main`. Le prochain build part sur du
// code non gardé. » Et au même moment, le déploiement Coolify : **vert**, site
// en ligne, 3 104 fichiers servis. Les deux disaient vrai.
//
// La CI (`tests.yml`) construit avec `WAREHOUSE_OFFLINE=1` — délibérément :
// *« un banc qui appelle le réseau ne prouve rien le jour où le réseau tombe,
// c'est-à-dire le seul jour où le code de repli sert »*. Or hors ligne,
// `engine/data/sample` porte des uuid `sample-0033-570553` que la liste blanche
// refuse tous : **`.reserve/cote/` sort avec 1 fichier et `marche.json` avec
// 90 lignes**. Mesuré, pas déduit.
// Et `test:marche` §4, depuis le lot 125, exige « une réserve de la taille
// d'une réserve de PRODUCTION (≥ 200 cotes) ».
//
// ⭐⭐⭐ CE BANC ÉTAIT DONC ROUGE PAR CONSTRUCTION EN CI, ET VERT DANS LE
// DOCKERFILE — qui, lui, construit EN LIGNE. Le même banc, le même code, deux
// verdicts opposés, et aucun des deux n'était faux. *Un banc peut être rouge
// pour une mauvaise raison ; il est alors aussi inutile qu'un banc vert pour
// une mauvaise raison, et plus coûteux : on finit par ignorer sa couleur.*
//
// ⚠️⚠️ ET LE PIRE EST AILLEURS. `cote.mjs` PORTE DÉJÀ CETTE PHRASE, écrite le
// 07/08, quatre lignes de commentaire au-dessus du code concerné :
//     « `.reserve/cote/` sort VIDE de tout build hors reseau — donc de la CI. »
// Elle était juste, elle était là, et le lot 125 a quand même écrit un seuil
// qu'elle rendait intenable. **Un avertissement qui ne se MESURE pas finit lu
// sans être suivi** ⇒ celui-ci devient un fichier, pas une phrase.
//
// ═══════════════════════════════════════════════════════════════════════════
// POURQUOI UN TÉMOIN, ET POURQUOI PAS UN DRAPEAU DANS `marche.json`
// ═══════════════════════════════════════════════════════════════════════════
// La tentation immédiate : que `deposerMarche()` écrive `horsLigne: true`.
// ⛔ ÇA NE MARCHE PAS, et il faut dire pourquoi, sinon quelqu'un le refera.
// `deposerMarche()` est appelée à la fin de `dataset()` — donc au build, MAIS
// AUSSI chaque fois qu'un banc rappelle `dataset()`. Or les bancs tournent sous
// `WAREHOUSE_OFFLINE=1`. Un banc qui écrase la réserve APRÈS un build en ligne
// — la panne du lot 113, payée deux fois — réécrirait donc `marche.json` avec
// `horsLigne: true`, et le contrôle conclurait « échantillon, rien à juger ».
// **Le drapeau aurait couvert exactement la panne qu'il devait dénoncer.**
//
// ⇒ LE TÉMOIN EST ÉCRIT PAR LE BUILD, À `astro:build:done`, ET PAR LUI SEUL.
//   `dataset()` ne le connaît pas et ne peut pas le réécrire. Il enregistre
//   l'état du disque À CET INSTANT-LÀ. Tout écart constaté plus tard entre le
//   témoin et le disque est, par construction, arrivé APRÈS le build.
//
// ⭐⭐⭐ C'EST LA MÊME MÉTHODE QUE `test:marche` §4 EMPLOIE DÉJÀ CONTRE
// LUI-MÊME : *« un banc qui n'interroge qu'un seul fichier ne peut pas savoir
// que ce fichier est le mauvais ⇒ le confronter à l'AUTRE artefact du build. »*
// Ici l'autre artefact, c'est le build lui-même qui le signe.
//
// ⛔ IL VIT DANS `.reserve/`, JAMAIS DANS `dist/`. Hors de tout ce qui est
// servi, et son nom commence par `_` : `uuidValide()` refuse ce nom, donc ni
// `/api/cote/[uuid]` ni `/api/cote/lot` ne peuvent le lire même en le demandant
// nommément. C'est le motif déjà en place pour le journal de projection.
// ⚠️ Il ne porte AUCUN montant — que des COMPTES. Un nombre de fichiers n'est
// pas un prix, et `test:fuite` n'aurait de toute façon rien à trouver ici.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const TEMOIN_FICHIER = (racine) => join(racine, '.reserve', '_temoin-build.json');

/** Relit le témoin. `null` s'il n'y en a pas — et un `null` se traite comme
 *  INDÉCIDABLE, jamais comme « tout va bien ». */
export function lireTemoin(racine) {
  const f = TEMOIN_FICHIER(racine);
  if (!existsSync(f)) return null;
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; }
}

export default function temoinBuild(mode) {
  return {
    name: 'veve:temoin-build',
    hooks: {
      // ⭐ `astro:build:done` : après `deposerMarche()` (fin de `dataset()`,
      // appelée pendant le rendu) et après l'intégration analytics. Le témoin
      // doit décrire le disque tel qu'il est quand le build RAND LA MAIN.
      'astro:build:done': async ({ logger }) => {
        const racine = process.cwd();
        const dossierCote = join(racine, '.reserve', 'cote');
        const marche = join(racine, '.reserve', 'marche.json');

        let cotes = 0;
        if (existsSync(dossierCote)) {
          cotes = readdirSync(dossierCote).filter((f) => f.endsWith('.json')).length;
        }
        let lignes = null;
        let itemsTotal = null;
        // ⭐ `null` À L'INITIALISATION, pas `0` : si la projection est illisible,
        //   le témoin doit dire « je ne sais pas », jamais « aucune ». C'est la
        //   même règle que `memoireDuBuild()` dans `/api/sante` — INCONNU ≠ ZÉRO.
        let avecImage = null;
        let ecartes = null;
        // 🔬 LOT 214 — voir le § de `dataset.mjs`. `null` a l'initialisation
        //   comme ses voisins : « je n'ai pas pu lire » n'est pas « aucune ».
        let candidats = null;
        if (existsSync(marche)) {
          try {
            const c = JSON.parse(readFileSync(marche, 'utf8'));
            lignes = Array.isArray(c.marche) ? c.marche.length : null;
            itemsTotal = c.itemsTotal ?? null;
            // 🔬 LOT 214 — LE SEUL COMPTE DE CE FICHIER QUI NE SE RECOMPTE PAS
            // SUR LES LIGNES, ET LA RAISON EST DANS LA DONNEE : `floor` a
            // disparu de la projection a `projeterCote()`. Il n'y a donc rien
            // a recompter ici — la valeur ne peut venir que d'amont, comme
            // `itemsTotal` juste au-dessus, qui est deja dans ce cas.
            // ⛔ On ne le derive de rien : absent = `null`, jamais 0.
            candidats = Number.isFinite(c.candidats) ? c.candidats : null;
            // 🔴🔴🔴 LOT 196 — DEUX COMPTES QUI DOIVENT ATTEINDRE UN LECTEUR.
            // Le lot 195 les avait posés dans le journal du build. Mesuré sur
            // le déploiement du 25/08 à 11 h 23 : **le journal Coolify s'arrête
            // à la 10ᵉ seconde de l'étape**, en plein milieu de la lecture des
            // sources. La ligne était écrite, elle était juste, et personne
            // n'a jamais pu la lire. *Un instrument dont la sortie n'atteint
            // pas son lecteur ne mesure rien.*
            // ⇒ Ils passent par le TÉMOIN, que `/api/sante` sait déjà servir :
            //   une adresse publique, interrogeable à tout moment, qui ne
            //   dépend d'aucun journal et ne se tronque pas.
            // ⛔ Ils sont comptés ICI, sur le fichier RELU depuis le disque, et
            //   pas transmis par `deposerMarche()` : ce fichier est ce que la
            //   page recevra vraiment. Un compte transmis en mémoire dirait ce
            //   que le build croyait déposer.
            if (Array.isArray(c.marche)) {
              avecImage = c.marche.reduce((n, i) => n + (i && i.image ? 1 : 0), 0);
              ecartes = c.marche.reduce((n, i) => n + (i && i.floorEcarte ? 1 : 0), 0);
            }
          } catch { /* témoin partiel vaut mieux que pas de témoin */ }
        }

        const t = {
          quand: new Date().toISOString(),
          site: process.env.SITE || null,
          mode: mode || null,
          // 🔴 LA LIGNE QUI PORTE TOUT LE LOT. `warehouse.mjs` lit exactement
          // cette variable (`OFFLINE = process.env.WAREHOUSE_OFFLINE === '1'`) :
          // on relit LA MÊME, pas une approximation.
          horsLigne: process.env.WAREHOUSE_OFFLINE === '1',
          cotes,
          marche: lignes,
          itemsTotal,
          // ⭐ `null` et pas `0` quand la projection est illisible : « je n'ai
          //   pas pu compter » et « il n'y en a aucune » sont deux réponses,
          //   et c'est précisément la seconde qu'on cherche à reconnaître.
          marcheAvecImage: avecImage,
          marcheEcartes: ecartes,
          // 🔬 LOT 214 — `ecartes` seul est INDECIDABLE a zero. Avec celui-ci,
          //   « la collecte s'est nettoyee » et « la regle ne mord plus »
          //   cessent d'emprunter le meme chemin de sortie.
          marcheCandidats: candidats,
        };

        const f = TEMOIN_FICHIER(racine);
        mkdirSync(dirname(f), { recursive: true });
        writeFileSync(f, JSON.stringify(t, null, 2), 'utf8');
        logger.info(
          `témoin déposé : ${t.cotes} cote(s), ${t.marche ?? '—'} ligne(s) de marché, `
          + `${t.horsLigne ? 'build HORS LIGNE (échantillon)' : 'build EN LIGNE (production)'}.`);
      },
    },
  };
}
