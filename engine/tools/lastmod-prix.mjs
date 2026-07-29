#!/usr/bin/env node
// ⚠️ DEPOT : VeVePreda/veve-sites   ·   CHEMIN : engine/tools/lastmod-prix.mjs
//
// Date de dernier changement REEL de chaque FICHE de prix, et des index qui
// les rassemblent. Ecrit dans le meme `engine/data/lastmod.<site>.json` que
// `engine/tools/lastmod.py`, dont il ne touche pas les sections editoriales.
//
//     SITE=veveprice node engine/tools/lastmod-prix.mjs --site veveprice
//
// A lancer DANS LE WORKFLOW, AVANT de declencher le deploiement : le build se
// contente de lire le fichier produit ici.
//
// ==========================================================================
// POURQUOI CET OUTIL EXISTE EN JAVASCRIPT ET PAS EN PYTHON
// ==========================================================================
// `lastmod.py` porte cet avertissement depuis le 27/07, et il a raison :
// « ne PAS reproduire ici la fabrication des slugs, qui vit dans le
// JavaScript — deux implementations d'une meme regle finissent toujours par
// diverger ». Dater PAR FICHE oblige a connaitre l'adresse exacte de chaque
// fiche ET l'ensemble exact des fiches publiees (quotas, seuils, report,
// plafond par serie, gel des adresses). Tout cela vit dans `dataset()`.
// ➡️ On appelle donc `dataset()`, la MEME fonction que le build. Il ne peut
//    pas y avoir de divergence, parce qu'il n'y a pas de seconde version.
//
// ==========================================================================
// ⭐⭐ CE QU'ON HACHE, ET SURTOUT CE QU'ON NE HACHE PAS
// ==========================================================================
// Une fiche de prix recoit un nouveau point de courbe chaque jour. Si on
// hachait la courbe, TOUTES les fiches se declareraient modifiees tous les
// jours — c'est-a-dire exactement le defaut qu'on repare, avec un mecanisme
// plus complique pour le produire. Sont donc EXCLUS de l'empreinte :
//
//   history, points, totalPoints, since  -> la courbe s'allonge toute seule ;
//   change7d                             -> une variation calculee sur une
//        FENETRE GLISSANTE bouge d'elle-meme : le point de reference sort de
//        la fenetre alors qu'aucun prix n'a change. La dater serait annoncer
//        a un moteur un changement que le visiteur ne verrait pas ;
//   updatedAt du jeu de donnees          -> c'est l'heure du build.
//
// On hache la SUBSTANCE : ce qu'un visiteur verrait changer d'un jour a
// l'autre — le prix plancher, le nombre d'offres, les extremes historiques,
// les reperes statistiques, et l'identite de la fiche.
//
// ⚠️ Une fiche qui SORT de la vitrine est retiree de la carte. Si elle revient
//    un jour, elle repart avec la date du jour : on prefere une date trop
//    recente sur une poignee de fiches a une date inventee sur toutes.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { dataset } from '../lib/dataset.mjs';
import { priceEnabled } from '../lib/features.mjs';

const args = process.argv.slice(2);
const opt = (nom, def = null) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const SITE = opt('site', process.env.SITE);
const JOUR = opt('jour', new Date().toISOString().slice(0, 10));
if (!SITE) {
  console.error('usage : node engine/tools/lastmod-prix.mjs --site <site> [--jour AAAA-MM-JJ]');
  process.exit(2);
}
// ⚠️ `dataset()` et `manifest()` lisent la variable d'environnement SITE, pas
//    notre argument. Les laisser diverger daterait un site avec les fiches
//    d'un autre — le genre de faute qui ne fait echouer personne.
if (process.env.SITE && process.env.SITE !== SITE) {
  console.error(`ABANDON : SITE=${process.env.SITE} mais --site ${SITE}. `
    + 'Les deux doivent designer le meme site.');
  process.exit(2);
}
process.env.SITE = SITE;

const RACINE = process.env.PROJECT_ROOT || process.cwd();
const FICHIER = join(RACINE, 'engine', 'data', `lastmod.${SITE}.json`);

const sha = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');

function charger() {
  if (!existsSync(FICHIER)) return {};
  const d = JSON.parse(readFileSync(FICHIER, 'utf8'));
  if (d.site && d.site !== SITE) {
    console.error(`ABANDON : ${FICHIER} appartient a « ${d.site} », pas a « ${SITE} ».`);
    process.exit(1);
  }
  return d;
}

// Une entree conserve sa date tant que son empreinte ne bouge pas.
function majEmpreinte(carte, cle, h) {
  const ancien = carte[cle];
  if (ancien && ancien.h === h) return { entree: ancien, change: false };
  return { entree: { h, d: JOUR }, change: true };
}

async function main() {
  if (!priceEnabled()) {
    // Pas une erreur : un wiki n'a pas de fiches de prix. On le dit et on sort.
    console.log(`lastmod-prix : « ${SITE} » ne publie pas de pages de prix — rien a dater ici.`);
    return 0;
  }

  const ds = await dataset();
  const fichier = charger();
  const sections = { ...(fichier.sections || {}) };
  const ancienItems = fichier.items || {};
  const items = {};
  let bouges = 0;

  for (const i of ds.items) {
    const substance = [
      i.path, i.qualifie || i.name, i.series, i.rarity, i.edition_type, i.kind,
      i.brand, i.licensor, i.releaseDate, i.tirage, i.storePrice,
      i.floor, i.listings, i.ath, i.atl, i.prixMedian, i.p95, i.offresMedianes,
    ];
    const { entree, change } = majEmpreinte(ancienItems, i.path, sha(substance));
    items[i.path] = entree;
    if (change) bouges += 1;
  }
  const disparues = Object.keys(ancienItems).filter((p) => !(p in items)).length;

  // Les INDEX : ils changent quand leur COMPOSITION change, pas quand un prix
  // bouge a l'interieur. `/movers/` fait exception par nature — c'est un
  // classement de variations, donc il change des qu'un classement change.
  const compo = (m) => [...m.values()].map((c) => [c.slug, c.name, (c.items || []).length]).sort();
  const familles = {
    collections: sha(compo(ds.collections)),
    rarity: sha(compo(ds.rarities)),
    movers: sha([...ds.movers.up, ...ds.movers.down].map((i) => [i.path, i.change7d])),
    // ⛔ ON N'ECRIT PAS `donnees` ICI, ET C'EST DELIBERE.
    // `lastmod.py` la tient deja (agregats + figures). Deux outils qui
    // ecrivent la meme cle avec deux definitions differentes, c'est le
    // mecanisme exact du churn fantome trouve cote 🟠H-PRIX : chacun defait
    // l'autre, et la valeur finale depend de l'ORDRE des etapes du workflow.
    // Le sitemap n'en a de toute facon plus besoin pour les fiches : elles ont
    // desormais leur date propre, et `donnees` n'est plus qu'un dernier
    // recours pour une fiche qui n'en aurait pas.
  };
  const changees = [];
  for (const [cle, h] of Object.entries(familles)) {
    const { entree, change } = majEmpreinte(sections, cle, h);
    sections[cle] = entree;
    if (change) changees.push(cle);
  }

  mkdirSync(dirname(FICHIER), { recursive: true });
  writeFileSync(FICHIER, `${JSON.stringify({
    _note: fichier._note || ('Date du dernier changement REEL de chaque famille de pages, '
      + 'et de chaque fiche pour un site a prix. Produit par engine/tools/lastmod.py '
      + 'et engine/tools/lastmod-prix.mjs, lu par src/pages/sitemap.xml.js. '
      + 'Ne pas editer a la main : la date suivrait le fichier, pas le contenu.'),
    site: SITE,
    // ⭐ Compte les passages REELS de cet outil. Le premier passage date tout
    //    du jour : c'est normal et sans valeur d'information. Le test s'en
    //    sert pour ne pas crier « toutes les dates sont identiques » sur un
    //    fichier qui vient de naitre — et pour le crier ensuite.
    passages: (fichier.passages || 0) + 1,
    sections,
    items,
  }, null, 1)}\n`, 'utf8');

  const dates = new Set(Object.values(items).map((x) => x.d));
  console.log(`lastmod-prix : ${Object.keys(items).length} fiche(s) — `
    + `${bouges} avec un contenu modifie, ${disparues} sortie(s) de la vitrine.`);
  console.log(`               ${dates.size} date(s) distincte(s) sur les fiches.`);
  if (changees.length) console.log(`               index modifie(s) : ${changees.join(', ')}`);
  return 0;
}

main().then((c) => process.exit(c)).catch((e) => {
  console.error(`lastmod-prix : ${e.message}`);
  process.exit(1);
});
