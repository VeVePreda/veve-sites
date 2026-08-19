// ⚠️ VeVePreda/veve-sites — engine/lib/reserve_analytics.mjs  (FICHIER NEUF)
// ═══════════════════════════════════════════════════════════════════════════
// LES DÉRIVÉS DU GRAND LIVRE, ÉCRITS HORS DE `dist/` — lot 44, 03/08/2026
// ═══════════════════════════════════════════════════════════════════════════
// Arbitrage Preda du 03/08 : les cinq modules d'Analytics sont **intégralement
// derrière le mur**. Aucun chiffre ne doit donc apparaître dans une page
// pré-générée, ni dans un fichier servi par nginx.
//
// ⭐⭐ C'EST L'ARCHITECTURE QUI PROTÈGE, PAS LE CONTRÔLE D'ACCÈS.
// Le 03/08 au matin, `access.demo: crevette` a fait changer 374 pages sur 447 —
// et **aucune donnée réservée n'a fuité**, parce que l'historique complet
// n'était nulle part dans `dist/`. `franchit()` avait été contourné sans que
// personne ne le remarque ; c'est `.reserve/` qui a tenu. On applique ici la
// même règle, pour la même raison.
//
// ⛔ NE JAMAIS écrire ces fichiers sous `public/` ni sous `src/` : les deux
// sont recopiés dans `dist/`. Le dossier commence par un point ET vit à la
// racine du projet — c'est le commentaire de `reserve.mjs`, et il vaut ici.

import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getPulse, getWalletSize, getWhales, getCorner, getProfilsAgregats, getMetaLedger }
  from '../data/warehouse.mjs';

const ROOT = process.env.PROJECT_ROOT || process.cwd();
export const ANALYTICS_DIR = process.env.RESERVE_ANALYTICS_DIR
  || join(ROOT, '.reserve', 'analytics');

// La même liste blanche que `reserve.mjs`, et pour la même raison : le
// `veve_uuid` du corner sert de NOM DE FICHIER.
// ⚠️ Une seule définition de « ce qui est un uuid » — deux divergent un jour.
const RE_UUID = /^[0-9a-f-]{8,64}$/i;

const nombre = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// ⭐ LE TOP N SE CALCULE SUR UNE COLONNE NOMMÉE, JAMAIS SUR UNE POSITION.
// C'est la règle dure n°1 du Sheet, payée par un montant affiché « 15636,0 % »
// quand une colonne s'était insérée. `corner_full` fait 114 colonnes ; s'y
// repérer par index serait la même faute avec 114 occasions de la commettre.
const TRI_CORNER = 'gini';

export function ecrire() {
  if (process.env.RESERVE_OFF === '1') {
    console.log('[reserve-analytics] DESACTIVEE par RESERVE_OFF=1 — aucun module abonné ne sera servi.');
    return { ecrits: 0, off: true };
  }
  return Promise.all([
    getPulse(), getWalletSize(), getWhales(), getCorner(), getProfilsAgregats(), getMetaLedger(),
  ]).then(([pulse, taille, whales, corner, profils, meta]) => {
    if (existsSync(ANALYTICS_DIR)) rmSync(ANALYTICS_DIR, { recursive: true, force: true });
    mkdirSync(join(ANALYTICS_DIR, 'corner'), { recursive: true });

    const pose = (nom, o) =>
      writeFileSync(join(ANALYTICS_DIR, `${nom}.json`), JSON.stringify(o), 'utf8');

    // ── 1. LE PULSE — mois et lignes annuelles ─────────────────────────────
    // ⚠️ « Par semaine » n'existe pas : `pulse.csv` est un `_MonthlyPulse`.
    // Le pas hebdomadaire demanderait une agrégation neuve dans
    // `ledger_derived.py` (jetonveve), pas un affichage. On ne l'invente pas :
    // découper un mois en quatre serait une valeur fabriquée, et sur ce site
    // c'est la seule faute qu'on ne rattrape jamais.
    // ⭐ Une ligne dont `month` n'a pas de tiret est une ligne ANNUELLE : le
    // format porte le sens, on ne devine pas sur la longueur.
    const mois = pulse.filter((r) => String(r.month || '').includes('-'));
    const annees = pulse.filter((r) => String(r.month || '') && !String(r.month).includes('-'));
    pose('pulse', { mois, annees, colonnes: pulse.length ? Object.keys(pulse[0]) : [] });

    // ── 2. LA TAILLE PAR WALLET — 3 dimensions ─────────────────────────────
    const dims = {};
    for (const r of taille) (dims[r.dimension] ||= []).push(r);
    pose('wallet_size', dims);

    // ── 3. LES CLASSEMENTS WHALE — 3 blocs ─────────────────────────────────
    // ⚠️ CES LIGNES PORTENT DES ADRESSES DE WALLET. C'est de la donnée publique
    // on-chain, mais un classement nominatif des cent plus gros portefeuilles
    // est un outil de ciblage. Il ne sort QUE par l'API, jamais dans `dist/`,
    // et le mur est la seule chose qui l'en empêche.
    const blocs = {};
    for (const r of whales) (blocs[r.block] ||= []).push(r);
    pose('whales', blocs);

    // ── 4. LA CORNÉRISATION — top 20 + une fiche par pièce ─────────────────
    const classables = corner
      .filter((r) => nombre(r[TRI_CORNER]) !== null && nombre(r.holders) > 2)
      .sort((a, b) => nombre(b[TRI_CORNER]) - nombre(a[TRI_CORNER]));
    pose('corner_top', {
      tri: TRI_CORNER,
      // ⭐ On dit sur combien le top est calculé. Un « top 20 » sans son
      // dénominateur laisse croire que le catalogue fait 20 pièces.
      total: classables.length,
      // ⚠️ `holders > 2` écarté : un item à 1 détenteur a un gini parfait et
      // squatterait tout le classement sans rien dire du marché.
      exclus: corner.length - classables.length,
      lignes: classables.slice(0, 20),
    });

    let fiches = 0;
    for (const r of corner) {
      const u = String(r.veve_uuid || '');
      if (!RE_UUID.test(u)) continue;     // liste blanche, jamais liste noire
      writeFileSync(join(ANALYTICS_DIR, 'corner', `${u}.json`), JSON.stringify(r), 'utf8');
      fiches++;
    }

    // ── 5. LES PROFILS DE COLLECTIONNEURS — une grille, pas une liste ──────
    // La source arrive en FORME LONGUE : `bloc,ligne,colonne,wallets`, 249
    // lignes. On la replie ici en un total, un classement et trois grilles.
    //
    // 🔴🔴 L'ORDRE DES LIBELLÉS EST PORTÉ PAR LA SOURCE, ET IL EST SÉMANTIQUE.
    // Les profils vont de `Diamond-Hands` à `n/a`, les tranches de `1` à
    // `100k+`. Un `Object.keys().sort()` mettrait « 10001-50k » entre « 1 » et
    // « 1001-5k », et « 100k+ » en troisième position — une grille de taille de
    // portefeuille rendue illisible sans qu'aucun chiffre ne soit faux.
    // ⇒ on retient l'ORDRE D'APPARITION, jamais un tri.
    const ordonner = (arr, v) => { if (v !== '' && !arr.includes(v)) arr.push(v); return arr; };
    const parBloc = {};
    for (const r of profils) (parBloc[String(r.bloc || '')] ||= []).push(r);

    // ⛔ ON JETTE PLUTÔT QUE DE POSER UNE GRILLE VIDE. « Un tableau vide ne se
    // signale pas » est le mode de panne le plus coûteux de ce projet : une
    // page d'apparence normale, entièrement creuse. Ici la source est produite
    // par un autre dépôt (jetonveve) : si son format bouge, on veut un build
    // ROUGE, pas trois grilles blanches derrière le mur où personne ne regarde.
    const BLOCS = ['total', 'score', 'profil_activite', 'profil_taille', 'activite_taille'];
    const manquants = BLOCS.filter((b) => !(parBloc[b] || []).length);
    if (manquants.length) {
      throw new Error(`[reserve-analytics] profils_agregats : bloc(s) absent(s) « ${manquants.join(', ')} » `
        + `— ${profils.length} ligne(s) lues, blocs vus : ${Object.keys(parBloc).join(', ') || '(aucun)'}. `
        + `La source vient de fanablefrance/jetonveve (ledger_derived.py).`);
    }

    const totalProfils = nombre(parBloc.total[0].wallets) || 0;
    // ⭐ La part se calcule ICI, une fois, sur un dénominateur NOMMÉ — pas au
    // client sur une somme de colonne. Sommer la colonne donnerait le même
    // nombre aujourd'hui et un nombre faux le jour où un wallet tombe dans deux
    // profils. Le `total` de la source est la seule autorité.
    const score = parBloc.score.map((r) => ({
      nom: String(r.ligne || ''),
      wallets: nombre(r.wallets) || 0,
      pct: totalProfils ? Math.round((nombre(r.wallets) || 0) / totalProfils * 1000) / 10 : null,
    }));

    const grille = (nom) => {
      const lignes = []; const colonnes = [];
      const cases = new Map();
      for (const r of parBloc[nom]) {
        ordonner(lignes, String(r.ligne || ''));
        ordonner(colonnes, String(r.colonne || ''));
        cases.set(`${r.ligne} ${r.colonne}`, nombre(r.wallets) || 0);
      }
      return {
        lignes,
        colonnes,
        // ⭐ Une matrice indexée par POSITION, mais livrée avec ses deux axes
        // NOMMÉS juste au-dessus. Le client ne devine aucun ordre : il lit
        // `lignes[i]` et `colonnes[j]`. C'est ce qui rend la position sûre ici,
        // alors qu'elle ne l'est pas pour un tri (voir `TRI_CORNER`).
        cellules: lignes.map((l) => colonnes.map((c) => cases.get(`${l} ${c}`) ?? 0)),
      };
    };

    // ⚠️ `n/a` PÈSE 341 136 WALLETS SUR 708 492 — 48 %. Le profil dominant est
    // « pas de profil », et il se montre TEL QUEL. Le masquer, le fondre dans
    // « autres » ou recalculer les parts sans lui donnerait une page où
    // Diamond-Hands paraîtrait majoritaire : ce serait la seule faute qu'un
    // site de données ne rattrape jamais. ⛔ Ne pas « nettoyer » ce libellé.
    pose('profils', {
      total: totalProfils,
      score,
      grilles: [
        { id: 'profil_activite', ...grille('profil_activite') },
        { id: 'profil_taille', ...grille('profil_taille') },
        { id: 'activite_taille', ...grille('activite_taille') },
      ],
    });

    // ── 6. LE MÉTA — il DATE la donnée ─────────────────────────────────────
    // ⭐ Sans lui, un abonné ne peut pas savoir si ce qu'il lit date d'hier ou
    // du mois dernier. Un chiffre sans date n'est pas vérifiable, et ce site
    // ne publie que du vérifiable.
    pose('meta', meta[0] || {});

    console.log(`[reserve-analytics] ${mois.length} mois, ${annees.length} année(s), `
      + `${Object.keys(blocs).length} bloc(s) whale, ${classables.length} item(s) classables, `
      + `${score.length} profil(s) sur ${totalProfils} wallet(s), `
      + `${fiches} fiche(s) de cornérisation — HORS de dist/`);
    return { ecrits: fiches + 6, off: false };
  });
}
