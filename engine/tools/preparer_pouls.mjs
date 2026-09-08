#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// 🫀 preparer_pouls.mjs — LE PONT DU POULS 24 H  (lot L, 08/09/2026)
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐⭐⭐ CE QUI MANQUAIT N'ÉTAIT PAS UNE COLLECTE, C'ÉTAIT CE FICHIER.
// Quatre notes de suite ont dit « le pouls 24 h demande de collecter des
// données ». C'était faux, et la même erreur à chaque fois : une note qui nomme
// une SOLUTION fait sauter la question du BESOIN. La donnée est publiée,
// quotidienne, à J-1, depuis toujours :
//   · `VeVePreda/scrapeur-veve` release `chain-archive-daily`
//     → `transfers_daily_<AAAA-MM-JJ>.csv.gz`, 90 assets, publié ~07:15 UTC
//   · `fanablefrance/jetonveve` `data/burns_daily.csv` (OMI brûlés, quotidien)
//   · le catalogue, qu'on charge déjà, pour le `store_price` des pièces mintées
//
// ⛔ POURQUOI UN OUTIL ET PAS UN `fetch` DANS LA PAGE. Le tableau de bord est
// `prerender = true`, mais `engine/lib/pouls.mjs` charge son constat par
// `import … with { type: 'json' }` — délibérément, parce qu'un `readFileSync`
// y avait produit une page TRONQUÉE sous HTTP 200 (lot J). On ne remet pas de
// réseau dans le rendu : on REGÉNÈRE le JSON que le bundle embarque.
//
// ⇒ USAGE :   node engine/tools/preparer_pouls.mjs [--sec]
//   `--sec` : n'écrit rien, affiche ce qui changerait. À lancer dans un
//   workflow quotidien, après la publication de `transfers_daily_<J-1>`.
//
// 🔬 LA CONTRE-ÉPREUVE QUI AUTORISE À REMPLACER LE CONSTAT ÉCRIT À LA MAIN :
// rejoué sur `transfers_daily_2026-09-06`, ce calcul rend **7 013 transferts**
// — exactement le nombre que le constat portait. Les wallets tombent à **942**
// au lieu de 943, et l'écart est VOULU : le constat comptait l'adresse nulle,
// qui est le contrat qui frappe, pas un portefeuille actif.
// ⛔ Un pont qui rendrait d'autres chiffres que le constat qu'il remplace ne
// serait pas un pont : ce serait un second constat, et il faudrait choisir.

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compterPouls } from '../lib/pouls.mjs';
import { chargerTransfertsQuotidiens, getCatalogue, getBurns } from '../data/warehouse.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const CIBLE = join(ICI, '..', 'data', 'pouls24.json');
const SEC = process.argv.includes('--sec');

// ⚠️ `store_price` ÉCRIT SA DÉCIMALE À LA VIRGULE : « 6,99 » vaut 6.99, pas
// 699. Un `replace(',', '')` appliqué sans regarder multiplie le prix par cent
// — fait le 08/09 sur ce même fichier, et le total sortait à 10 485 000 $ au
// lieu de 104 850. ⛔ On mesure avec la règle du SITE, jamais la sienne.
export function nombre(s) {
  const t = String(s ?? '').replace(/[$\s ]/g, '').trim();
  if (!t) return null;
  const u = (t.includes(',') && t.includes('.')) ? t.replace(/,/g, '')
    : (t.includes(',') ? t.replace(',', '.') : t);
  const v = Number(u);
  return Number.isFinite(v) ? v : null;
}

async function principal() {
  // ── contre-épreuve du lecteur de nombre, AVANT toute somme ───────────────
  if (nombre('6,99') !== 6.99 || nombre('1,234.56') !== 1234.56 || nombre('') !== null) {
    console.error('❌ le lecteur de nombre échoue sur une chaîne témoin. Rien ne sera écrit.');
    process.exit(2);
  }

  const paquet = await chargerTransfertsQuotidiens();
  if (!paquet) {
    console.error('❌ aucun `transfers_daily_<J>` joignable. Le constat existant est CONSERVÉ :'
      + ' un pouls périmé et daté vaut mieux qu\'un pouls effacé.');
    process.exit(1);
  }

  const catalogue = await getCatalogue();
  const prix = new Map();
  for (const c of catalogue) {
    const p = nombre(c.store_price);
    if (p !== null) prix.set(c.uuid, p);
  }

  const compte = compterPouls(paquet.rows, prix);
  if (!compte) {
    console.error('❌ `compterPouls` a refusé ces lignes — colonnes `from`/`to`/`kind` absentes.'
      + ' Le schéma de la release a changé : à relire AVANT de toucher au calcul.');
    process.exit(2);
  }

  // ── 🔥 les OMI brûlés, dernière ligne du fichier quotidien ────────────────
  let omiBrules = null;
  const burns = await getBurns();
  if (burns.length) {
    const dernier = burns[burns.length - 1];
    const v = nombre(dernier.omi_burned);
    // ⚠️ On n'affiche le brûlage QUE s'il porte le MÊME JOUR que les transferts.
    // Deux fraîcheurs différentes sous une seule étiquette « 24 h », c'est la
    // faute des DEUX HORLOGES, déjà payée. Jours différents ⇒ on ne sert pas.
    if (v !== null && dernier.date === compte.jour) omiBrules = { v, jour: dernier.date };
    else if (v !== null) {
      console.warn(`⚠️  burns_daily s'arrête au ${dernier.date} et les transferts au `
        + `${compte.jour} : la case « OMI brûlés » reste NON SERVIE plutôt que de`
        + ' mélanger deux journées.');
    }
  }

  const ancien = JSON.parse(readFileSync(CIBLE, 'utf8'));
  const constat = {
    _lisezMoi: 'LE POULS 24 H, CALCULÉ. Ce fichier n\'est plus recopié à la main :'
      + ' `engine/tools/preparer_pouls.mjs` le régénère depuis la release'
      + ' `chain-archive-daily` de VeVePreda/scrapeur-veve, le catalogue et'
      + ' `burns_daily.csv`. ⛔ Ne pas l\'éditer : relancer l\'outil.',
    mesureLe: new Date().toISOString(),
    mesurePar: paquet.source,
    fenetre: {
      ...ancien.fenetre,
      jourVeve: compte.jour,
      // ⛔ La fenêtre d'un `transfers_daily_<J>` couvre la JOURNÉE PACIFIQUE J :
      //    premier horodatage 07:00:00Z le jour J, dernier 06:57:30Z le
      //    lendemain. L'étiquette dit donc le jour VeVe ET son décalage.
      debutUtc: `${compte.jour}T07:00:00Z`,
      finUtc: `${new Date(Date.parse(`${compte.jour}T07:00:00Z`) + 86400000 - 150000)
        .toISOString().slice(0, 19)}Z`,
    },
    transferts: compte.transferts,
    wallets: {
      actifs: compte.wallets,
      _definition: 'a envoyé OU reçu — l\'union, jamais la somme. ⛔ L\'adresse'
        + ' nulle est EXCLUE : c\'est le contrat qui frappe, pas un porteur.',
    },
    mints: compte.mints,
    revenue: {
      // 💰 ARRONDI À DEUX DÉCIMALES À L'ÉCRITURE. Une somme de flottants rend
      //    `4065.099999999998` : ce n'est pas une précision, c'est le binaire
      //    qui déborde, et ça se lirait tel quel dans un JSON relu à la main.
      usd: compte.revenue === null ? null : Math.round(compte.revenue * 100) / 100,
      mints: compte.mints,
      mintsChiffres: compte.mintsChiffres,
      _definition: 'REVENUE 24 H = LE SUPPLY AU DROP VENDUE (arbitrage Preda,'
        + ' 08/09/2026) : la somme des `store_price` des pièces FRAPPÉES dans la'
        + ' journée. ⚠️ `mintsChiffres` dit sur combien de mints la somme porte —'
        + ' une pièce trop neuve pour le catalogue publié n\'a pas encore de prix.',
    },
    omiBrules: omiBrules
      ? { ...omiBrules, _unite: 'OMI — ⛔ jamais converti en dollars' }
      : null,
  };

  const couverture = compte.mints ? Math.round((compte.mintsChiffres / compte.mints) * 100) : 100;
  console.log(`\n🫀 pouls du ${compte.jour} — ${compte.transferts} transferts · `
    + `${compte.wallets} wallets · ${compte.mints} mints`);
  console.log(`   revenue : ${compte.revenue === null ? '—' : compte.revenue.toFixed(2) + ' $'}`
    + ` sur ${compte.mintsChiffres}/${compte.mints} mints chiffrés (${couverture} %)`);
  console.log(`   OMI brûlés : ${omiBrules ? omiBrules.v : '— (non servi)'}`);
  console.log(`   source : ${paquet.source}`);

  if (SEC) { console.log('\n(--sec : rien n\'a été écrit)'); return; }
  writeFileSync(CIBLE, `${JSON.stringify(constat, null, 2)}\n`, 'utf8');
  console.log(`\n✅ ${CIBLE} réécrit.`);
}

principal().catch((e) => { console.error(e); process.exit(2); });
