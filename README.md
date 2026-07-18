# Usine à sites VeVe — moteur + pilote VeVePrice

Un seul moteur, un manifeste par site. Chaque site choisit son mode de rendu
(`static` ou `server`) et ses fonctionnalités dans `sites/<site>/manifest.yml`.

## Structure

```
engine/
  data/warehouse.mjs     lecture de l'entrepôt jetonveve (CSV.gz par URL) + repli N-1 + échantillon
  data/sample/           échantillon local pour builder hors-ligne
  data/gen-sample.mjs    régénère l'échantillon
  lib/manifest.mjs       chargement du manifeste du site actif (variable SITE)
  lib/dataset.mjs        modèle de données : items, collections, raretés, mouvements
  lib/chart.mjs          courbe de prix rendue en SVG côté serveur (zéro JavaScript)
  lib/seo.mjs            JSON-LD (Product, ItemList, BreadcrumbList, WebSite)
sites/veveprice/manifest.yml
themes/aurora/theme.css
src/pages/               accueil, /item/<slug>, /collection/<slug>, /rarity/<slug>, /movers, sitemap, robots
```

## Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `SITE` | `veveprice` | quel manifeste charger (`sites/<SITE>/manifest.yml`) |
| `SITE_URL` | domaine du manifeste | URL publique (canonical, sitemap) |
| `RENDERING` | `static` | `static` (pré-généré) ou `server` (rendu serveur) |
| `WAREHOUSE_OFFLINE` | — | `1` pour forcer l'échantillon local (tests hors-ligne) |
| `CATALOGUE_URL` / `PRICES_URL` / `BASELINES_URL` | releases jetonveve | surcharge des sources |

## Commandes

```bash
npm install
npm run build                      # build avec les vraies données de l'entrepôt
WAREHOUSE_OFFLINE=1 npm run build  # build hors-ligne sur l'échantillon
npm run dev                        # serveur de développement
```

## Ajouter un site

1. Créer `sites/<nouveau>/manifest.yml` (copier celui de veveprice).
2. Choisir `rendering`, le thème et les modules.
3. Déployer une nouvelle ressource Coolify sur le même dépôt avec `SITE=<nouveau>`.

Aucun code à écrire : un site = un manifeste + un déploiement.
