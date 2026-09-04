// =============================================================================
//  astro_features.mjs — l'intégration Astro qui EFFACE les pages d'une
//  fonctionnalité désactivée par le manifeste.
//  ⚠️ VeVePreda/veve-sites — engine/lib/astro_features.mjs
//
//  LE PROBLÈME (audit SEO du 27/07/2026, « 3 pages fantômes »)
//  -----------------------------------------------------------------------------
//  Les routes de PRIX se coupent déjà toutes seules quand le site n'en publie
//  pas (`priceEnabled()` faux, cf. features.mjs) :
//    • version localisée `[locale]/movers.astro` -> `getStaticPaths()` rend []
//      -> AUCUNE page émise. Parfait.
//    • version racine `movers.astro` -> route STATIQUE, donc SANS
//      `getStaticPaths` : Astro la construit TOUJOURS, et le `Astro.redirect('/')`
//      y devient un talon `<meta http-equiv="refresh">`.
//  (Recit du 31/07/2026. `/rarity/` a depuis ete SUPPRIMEE du moteur — lot 34 —
//   et ne figure donc plus dans les prefixes ci-dessous.)
//  D'où, sur vevewiki, trois pages `/collections/`, `/movers/`, `/rarity/` sans
//  <html lang>, sans viewport, sans description, sans h1 — et toutes le même
//  <title> « Redirecting to: / ». Elles étaient en `noindex`, donc invisibles
//  dans l'index, mais elles restaient : du budget d'exploration dépensé pour
//  rien, et un audit rouge en permanence.
//
//  ⭐ LA LEÇON : une page ne se retire pas d'un site en la redirigeant.
//     Tant qu'elle est ÉMISE, elle existe. Il faut qu'elle ne soit pas écrite.
//
//  LE CHOIX
//  -----------------------------------------------------------------------------
//  Astro n'offre pas (encore) de moyen déclaratif d'annuler une route statique :
//  `astro:routes:resolved` est informatif, et `getStaticPaths` n'existe que sur
//  les routes dynamiques. On nettoie donc à `astro:build:done`, avec DEUX
//  garde-fous pour que ce ne soit jamais destructeur :
//    1. on ne regarde QUE les préfixes déclarés par une fonctionnalité ÉTEINTE ;
//    2. on n'efface un fichier que si c'est bel et bien un TALON DE REDIRECTION
//       (meta refresh + noindex). Une vraie page trouvée là = on n'y touche pas
//       et on le dit tout haut.
//  Résultat : sur veveprice (prix actifs) l'intégration ne fait STRICTEMENT rien.
// =============================================================================
import { readFileSync, rmSync, existsSync, statSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { priceEnabled, comptesActifs } from './features.mjs';

/** Préfixes d'URL portés par chaque fonctionnalité, dans l'ordre du plan de site.
 *  Ajouter une fonctionnalité gatée = ajouter une ligne ici, rien d'autre. */
const ZONES = [
  // ═════════════════════════════════════════════════════════════════════════
  // 🔴🔴 LOT 139 — `/sets/` REJOINT LA ZONE. **TROISIÈME OCCURRENCE.**
  // ═════════════════════════════════════════════════════════════════════════
  // MESURÉ SUR LA PRODUCTION LE 11/08/2026, puis REPRODUIT AU BAC À SABLE À
  // L'OCTET : `vevewiki.com/sets/` rend **200** avec **266 octets** — un talon
  // `<meta http-equiv="refresh">` + `noindex`. Et il porte
  // `<link rel="canonical" href="https://veveprice.com/">` : un wiki qui
  // désigne un site de PRIX comme sa version canonique, depuis une page vide.
  //
  // ⭐⭐⭐ C'EST LE DÉFAUT DU LOT 44, PUIS DU LOT 136, UNE TROISIÈME FOIS — et
  //   cette fois dans la zone « prix », que le remède du 136 ne couvrait pas.
  //   Le §1 de `test:cache` compare `ROUTES_COMPTE` aux préfixes de la zone
  //   « comptes ». Il a fermé le circuit d'UN CÔTÉ. L'autre côté n'avait
  //   toujours aucun lecteur, et il a produit la page suivante.
  // ⭐⭐ *Un remède qui referme le CAS et non la FAMILLE laisse la famille
  //   produire son cas suivant, ailleurs, avec le même visage.*
  //
  // ⛔ ON N'AJOUTE PAS UN SECOND `ROUTES_PRIX` À TENIR À JOUR. Un second
  //   contrat est un second contrat à oublier — c'est précisément ce qui vient
  //   de coûter cette page. Le lecteur qui ferme la FAMILLE est dans
  //   `test:cache` §1 ter, et il ne lit AUCUNE liste : il refuse qu'un TALON
  //   survive dans `dist/` après cette passe, quel que soit son nom.
  //   🔬 L'invariant est MESURÉ, pas supposé : sur veveprice (toutes les
  //   fonctionnalités actives) `dist/` contient **0** talon ; sur vevewiki il
  //   en contenait **1**, et c'était `/sets/`. Un préfixe qu'on oubliera
  //   d'écrire ici fera rougir le banc quand même.
  //
  // ═════════════════════════════════════════════════════════════════════════
  // 🔴🔴🔴 ET `/movers/` AUSSI — TROUVÉ PAR L'INVARIANT, PAS PAR LA LISTE
  // ═════════════════════════════════════════════════════════════════════════
  // ⭐⭐⭐ **L'EN-TÊTE DE CE FICHIER NOMME TROIS PAGES FANTÔMES ; LA LISTE EN
  //   DESSOUS N'EN CORRIGEAIT QUE DEUX.** Elle dit, mot pour mot : « d'où, sur
  //   vevewiki, trois pages `/collections/`, `/movers/`, `/rarity/` … toutes le
  //   même `<title> Redirecting to: /` ». `/rarity/` a été supprimée du moteur
  //   au lot 34 et le commentaire le dit. `/collections/` est dans la liste.
  //   **`/movers/` n'y a jamais été mise**, et elle est restée un talon depuis
  //   le 31/07/2026 — **en QUATRE exemplaires** (`/movers/`, `/fr/`, `/es/`,
  //   `/de/`), 303 à 321 octets chacun, `200` + `noindex`.
  // 🔴 Et elle redirige vers `/market/`, que cette même intégration **efface**
  //   sur vevewiki : un talon en 200 qui pointe vers une page qui n'existe pas.
  //   C'est le profil exact de P37 (`/favoris/` → `/connexion/`, un 404).
  // ⭐⭐ *Le diagnostic était écrit, complet et juste, DANS le fichier qui porte
  //   le remède — et le remède ne le couvrait pas entièrement. Une liste écrite
  //   à la main à côté d'une prose qui la contredit ne se relit jamais : c'est
  //   le lecteur qui manquait, pas la connaissance.*
  // ⛔ Sur veveprice, l'ajout ne fait STRICTEMENT rien : `priceEnabled()` y est
  //   vrai, et le rendu `server` fait de `/movers/` une VRAIE redirection HTTP,
  //   pas un talon. Mesuré : **0 talon `.html` dans `dist/` de veveprice**.
  //
  // 🔬 MESURE DE CE LOT, sur `dist/` de vevewiki :
  //     AVANT  : **5** talons `.html` survivants (`/sets/` + `/movers/` ×4)
  //     APRÈS  : **0**
  // ⚠️ Et mon premier instrument comptait **1** talon sur veveprice : il
  //   grepait `dist/` en entier et trouvait la chaîne dans `server/entry.mjs`,
  //   un paquet JavaScript de 235 Ko. *Un compteur qui ne borne pas ce qu'il
  //   ouvre compte autre chose que ce qu'il croit* — le banc ne regarde que les
  //   `.html`.
  // 🔴 LOT 213 — `/how-prices-work/` REJOINT LA ZONE, ET C'EST OBLIGATOIRE.
  // Une page qui EXPLIQUE d'ou viennent des prix, sur un site qui n'en publie
  // aucun, est une page fantome — plus le lien mort qui la designe au pied de
  // chaque page. C'est mot pour mot `/analytics/` au lot 157-B et `/favoris/`
  // au lot 104 : la route emet bien un talon quand `priceEnabled()` est faux,
  // mais un talon que PERSONNE N'EFFACE reste servi en 200.
  // ⭐ Le contrat annonce en tete de ce fichier tient toujours : « ajouter une
  // fonctionnalite gatee = ajouter une ligne ici ». On l'a suivi au lieu
  // d'inventer un second mecanisme d'extinction a cote du premier.
  { nom: 'prix', actif: priceEnabled,
    prefixes: ['/market/', '/collections/', '/collectibles/', '/comics/', '/collection/',
               '/sets/', '/movers/', '/how-prices-work/'] },
  // ⭐ LOT 42 — « ajouter une fonctionnalite gatee = ajouter une ligne ici ».
  // On suit le contrat que ce fichier annonce en tete, au lieu d'inventer un
  // second mecanisme d'extinction a cote du premier.
  // ⭐ LOT 44 — `/compte/` et `/connexion/` REJOIGNENT LA ZONE.
  // Elles emettaient de VRAIES pages sur vevewiki (55 Ko et 54 Ko de
  // vocabulaire `vitrine` sur un theme qui n'en a aucune regle). Le lot 42 les
  // avait laissees dehors parce que les gater fait DISPARAITRE deux pages et
  // que ca se decide. Preda a tranche le 03/08 : vevewiki n'aura jamais
  // d'espace membre.
  // ⚠️ Elles ne peuvent etre effacees QUE parce qu'elles emettent desormais un
  // TALON (le `redirect` ajoute dans chaque page). Sans lui, ce garde-fou ne
  // les toucherait pas — il refuse d'effacer une vraie page, par conception.
  // ═════════════════════════════════════════════════════════════════════════
  // 🔴🔴 LOT 136 — `/favoris/` ET `/dashboard/` REJOIGNENT LA ZONE.
  // ═════════════════════════════════════════════════════════════════════════
  // MESURÉ SUR LA PRODUCTION LE 11/08/2026 : `vevewiki.com/favoris/` rendait
  // **200** (418 o) et `/dashboard/` **200** (430 o) — deux TALONS de
  // redirection vers `/connexion/`, qui est un **404** sur ce site. Deux pages
  // fantômes qui envoient un visiteur nulle part, sur un site dont il est GELÉ
  // qu'il n'aura jamais d'espace membre.
  //
  // ⭐⭐⭐ ET C'EST EXACTEMENT LE DÉFAUT DU LOT 44, DEUX LOTS PLUS TARD.
  //   Le lot 104 a ajouté `market`, `favoris` et `dashboard` à `ROUTES_COMPTE`.
  //   `/market/` s'est trouvé couvert PAR HASARD — il figure dans la zone
  //   « prix ». Les deux autres n'étaient couverts par personne, et rien ne
  //   pouvait le dire : le build restait vert, les pages étaient en `noindex`,
  //   aucun humain ne va sur `/dashboard/` d'un wiki.
  // ⭐⭐ C'est `regle-circuit-ouvert` en entier : QUELQU'UN ÉCRIT (le lot 104
  //   ajoute des routes de compte), PERSONNE NE LIT (ce tableau n'a pas bougé).
  //   Le fichier annonce pourtant en tête « ajouter une fonctionnalité gatée =
  //   ajouter une ligne ici, rien d'autre » — le contrat était écrit, il n'était
  //   réclamé par rien.
  // ⇒ Le remède n'est pas cette ligne, c'est le § 1 de `test:cache` qui compare
  //   désormais `ROUTES_COMPTE` à ces préfixes et rougit à la prochaine
  //   omission. *Une phrase se relit ; un banc se déclenche.*
  //
  // ⚠️ Le garde-fou d'origine tient toujours : ces deux pages ne sont effacées
  //   QUE parce qu'elles émettent un TALON (meta refresh + noindex) — mesuré
  //   ci-dessus. Si l'une devenait une vraie page, l'intégration refuserait d'y
  //   toucher et le dirait tout haut, par conception.
  // ═════════════════════════════════════════════════════════════════════════
  // 📊🔴 LOT 157-B — ANALYTICS ENTIER REJOINT LA ZONE, PORTE COMPRISE
  // ═════════════════════════════════════════════════════════════════════════
  // ⭐⭐⭐ ET C'EST LA TROISIÈME FOIS QUE CE TABLEAU EST EN RETARD D'UN LOT.
  // Le 104 avait ajouté `market`, `favoris`, `dashboard` sans venir ici ; le
  // 157 a ajouté quatre sujets d'Analytics, même oubli, même symptôme. Mesuré
  // en production le 18/08 : `vevewiki.com/analytics/market/` rendait **200**,
  // un talon vers `/connexion/` qui est un **404** sur ce site — et
  // `vevewiki.com/analytics/` portait **quatre liens** vers ces fantômes.
  // ⇒ Le § 1 de `test:cache` a bien rougi sur `main`. ⭐ *Une phrase se relit ;
  //   un banc se déclenche.* Il s'est déclenché.
  //
  // ⛔⛔ LES QUATRE SUJETS **ET** LA PORTE, PAS SEULEMENT LES SUJETS. Éteindre
  // les quatre sans la porte aurait laissé `/analytics/` vivante avec quatre
  // liens vers des 404 — on aurait remplacé quatre pages fantômes par quatre
  // liens morts, ce qui est PIRE : un fantôme en `noindex` n'est jamais visité,
  // un lien de page d'accueil l'est.
  // 🎯 Arbitrage Preda du 18/08 : « **le wiki n'a plus de page Analytics** ».
  //
  // ⚠️ POUR QUE CETTE LIGNE SERVE, `src/pages/analytics/index.astro` DOIT ÉMETTRE
  //   UN TALON quand `comptesActifs()` est faux — cette passe n'efface QUE des
  //   talons, et refuse (en le disant) de toucher à une vraie page. Les deux
  //   moitiés se tiennent ; retirer l'une laisse soit une page morte, soit un
  //   préfixe qui ne garde rien.
  // ⭐ Les préfixes à DEUX segments marchent : la boucle fait
  //   `join(racine, prefixe.replace(/^\/|\/$/g, ''))`, donc `analytics/market`.
  //   ⚠️ `test:cache` § 2, lui, ne savait lire qu'UN segment — son motif a dû
  //   être élargi dans le même lot, sinon il aurait déclaré ces adresses « non
  //   éteintes » alors qu'elles le sont.
  // ═════════════════════════════════════════════════════════════════════════
  // 🔔🔴🔴 LOT 221 — `/alertes/` ET `/alertes/reglages/` REJOIGNENT LA ZONE.
  // ═════════════════════════════════════════════════════════════════════════
  // ⭐⭐⭐ **QUATRIÈME FOIS QUE CE TABLEAU EST EN RETARD D'UN LOT**, et le
  // fichier le disait déjà deux fois au-dessus : le 44, puis le 104, puis le
  // 157-B. Le lot 215-B a ajouté les alertes aux routes privées sans venir ici.
  //
  // MESURÉ SUR LA PRODUCTION LE 04/09/2026 :
  //   · `vevewiki.com/alertes/`          → **200**, 418 o, meta refresh + noindex
  //   · `vevewiki.com/alertes/reglages/` → **200**, 482 o, idem
  //   Deux TALONS qui redirigent vers `/connexion/`… qui est un **404** sur ce
  //   site. Profil identique, au décompte d'octets près, à `/favoris/` et
  //   `/dashboard/` au lot 136. ⇒ Deux pages fantômes de plus qui envoient un
  //   visiteur nulle part, sur un site dont il est GELÉ qu'il n'aura jamais
  //   d'espace membre.
  //
  // ⭐⭐ ET LE REMÈDE DU LOT 136 A FONCTIONNÉ : ce n'est pas un humain qui a vu
  // le défaut, c'est le §1 de `test:cache` — celui-là même que le 136 a écrit
  // « pour rougir à la prochaine omission ». Il rougit sur `main` depuis le
  // **03/09 à 06 h 51 UTC** (dernier run vert : 02/09 17 h 37), et l'alerte
  // Discord que Preda reçoit à chaque dépôt est la sienne.
  // *Une phrase se relit ; un banc se déclenche.* Il s'est déclenché une
  // troisième fois, et il a fallu quatre jours pour le lire.
  // ⚠️ Ce n'est donc PAS un rouge causé par les lots 218-220 : il leur est
  //   antérieur, et il vise l'AUTRE site.
  //
  // ⚠️ Le garde-fou d'origine tient : ces deux pages ne sont effacées QUE parce
  //   qu'elles émettent un TALON — vérifié ci-dessus. Si l'une devenait une
  //   vraie page, l'intégration refuserait d'y toucher et le dirait tout haut.
  // ⭐ `/alertes/reglages/` est un préfixe à DEUX segments : la boucle sait les
  //   lire depuis le lot 157-B, et le motif du §1 de `test:cache` aussi.
  { nom: 'comptes', actif: comptesActifs,
    prefixes: ['/acces/', '/inscription/', '/compte/', '/connexion/', '/favoris/', '/dashboard/',
               '/alertes/', '/alertes/reglages/',
               // 📒🔔 LOT 224 — `/classeur/` ET `/mint-hunter/`.
               // ⭐⭐ CE FICHIER EST EN RETARD D'UN LOT UNE FOIS SUR DEUX (44,
               // 104, 157-B, 215-B) : une route privée neuve déclare son
               // préfixe ici, sinon vevewiki sert un TALON 200 vers une page
               // qui n'existe pas chez lui — mesuré à 418 o pour `/favoris/`
               // et 430 o pour `/dashboard/` le 11/08. Deux pages fantômes de
               // plus qui envoient un visiteur nulle part, sur un site dont il
               // est GELÉ qu'il n'aura jamais d'espace membre.
               // ⭐ Le garde-fou d'origine tient : ces pages ne sont effacées
               // QUE parce qu'elles émettent un TALON. Si l'une devenait une
               // vraie page, l'intégration refuserait d'y toucher et le dirait.
               '/classeur/', '/mint-hunter/',
               '/analytics/',
               '/analytics/market/', '/analytics/catalogue/',
               '/analytics/collections/', '/analytics/chain/'] },
];

const estTalon = (html) =>
  /http-equiv="refresh"/i.test(html) && /name="robots"[^>]*noindex/i.test(html);

export default function fonctionnalitesEteintes() {
  return {
    name: 'veve:fonctionnalites-eteintes',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const racine = fileURLToPath(dir);
        let efface = 0;
        // ═════════════════════════════════════════════════════════════════════
        // 🔴🔴🔴 LOT 139 — CETTE PASSE ÉTAIT **MONOLINGUE SUR UN RÉSEAU
        // MULTILINGUE**, ET ÇA NE SE VOYAIT QUE DEPUIS L'AUTRE BOUT
        // ═════════════════════════════════════════════════════════════════════
        // Elle ne construisait qu'UN chemin par préfixe : `dist/movers`. Après
        // avoir ajouté `/movers/` aux préfixes, la mesure disait encore
        // **3 talons survivants** : `/fr/movers/`, `/es/movers/`, `/de/movers/`.
        // Le talon racine partait, ses trois traductions restaient.
        //
        // ⭐⭐ L'EN-TÊTE DE CE FICHIER AFFIRME LE CONTRAIRE : « version localisée
        //   `[locale]/movers.astro` → `getStaticPaths()` rend [] → AUCUNE page
        //   émise. Parfait. » **Mesuré : elles sont émises.** Le récit date du
        //   31/07/2026 et il a cessé d'être vrai sans que personne le relise.
        //   *Une note qui dit « ce cas ne peut pas arriver » est le meilleur
        //   endroit où le chercher.*
        //
        // ⛔ ON NE DEMANDE PAS LA LISTE DES LANGUES À `i18n.mjs`. Elle dirait ce
        //   que le site DEVRAIT émettre ; on a besoin de ce qu'il A émis. Les
        //   deux ont déjà divergé une fois — c'est toute cette panne. On lit
        //   donc l'arbre produit : tout dossier de tête en forme de code de
        //   langue est un préfixe d'adresses de plus.
        // ⭐ *Ne pas demander à une liste ce que le résultat sait déjà.*
        const LOC = /^[a-z]{2}(-[a-z]{2})?$/;
        const espaces = ['', ...readdirSync(racine, { withFileTypes: true })
          .filter((e) => e.isDirectory() && LOC.test(e.name))
          .map((e) => e.name)];
        for (const zone of ZONES) {
          if (zone.actif()) continue;                    // fonctionnalité ON : on ne touche à rien
          for (const brut of zone.prefixes) {
            for (const espace of espaces) {
            const prefixe = espace ? `/${espace}${brut}` : brut;
            const chemin = join(racine, prefixe.replace(/^\/|\/$/g, ''));
            if (!existsSync(chemin) || !statSync(chemin).isDirectory()) continue;
            const index = join(chemin, 'index.html');
            if (!existsSync(index)) continue;            // pas de page émise : rien à faire
            if (!estTalon(readFileSync(index, 'utf8'))) {
              logger.warn(`${prefixe} existe alors que la fonctionnalité « ${zone.nom} » est éteinte, `
                        + `et ce n'est PAS un talon de redirection — page conservée, à vérifier.`);
              continue;
            }
            rmSync(chemin, { recursive: true, force: true });
            efface += 1;
            logger.info(`talon de redirection retiré : ${prefixe} (fonctionnalité « ${zone.nom} » éteinte)`);
            }
          }
        }
        if (!efface) logger.info('aucun talon de redirection à retirer.');
        // ⭐⭐⭐ LE CIRCUIT SE FERME ICI, ET IL NE LIT AUCUNE LISTE.
        // Trois lots (44, 136, 139) ont ajouté des préfixes à la main ; les
        // trois fois, la page suivante est passée par le trou. Ce compte-là ne
        // dépend d'aucun préfixe : il constate qu'un TALON a survécu à la
        // passe, quel que soit son nom, sa langue et sa zone.
        // ⚠️ `.html` SEULEMENT : la première version de cette mesure grepait
        // `dist/` entier et comptait `server/entry.mjs` (235 Ko de JavaScript
        // qui contient la chaîne). *Un compteur qui ne borne pas ce qu'il ouvre
        // compte autre chose que ce qu'il croit.*
        // ⛔ Il AVERTIT, il n'arrête pas le build : le banc `test:pages` est ce
        //   qui refuse. Une intégration de build qui jette est une intégration
        //   qu'on finit par retirer.
        const restants = [];
        (function balayer(d) {
          for (const e of readdirSync(d, { withFileTypes: true })) {
            const f = join(d, e.name);
            if (e.isDirectory()) { if (e.name !== 'server' && e.name !== 'chunks') balayer(f); }
            else if (e.name.endsWith('.html') && estTalon(readFileSync(f, 'utf8'))) {
              restants.push(f.slice(racine.length).replace(/\\/g, '/'));
            }
          }
        })(racine);
        if (restants.length) {
          logger.warn(`🔴 ${restants.length} TALON(S) DE REDIRECTION SURVIVENT dans dist/ : `
            + `${restants.slice(0, 8).join(', ')}${restants.length > 8 ? '…' : ''} — `
            + `des pages fantômes en 200. Soit leur préfixe manque ci-dessus, soit la page `
            + `doit exister pour de bon.`);
        } else {
          logger.info('✅ aucun talon de redirection ne survit dans dist/ (invariant du lot 139).');
        }
      },
    },
  };
}
