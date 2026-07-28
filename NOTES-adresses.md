# Lot « garde-fous d'adresses » — le reste de l'étape 2

Dépôt : **`VeVePreda/veve-sites`**. Quatre fichiers.

```
engine/tools/test_renommage.mjs        NOUVEAU
package.json                           MODIFIÉ (script + npm test)
Dockerfile                             MODIFIÉ (le test tourne AU BUILD)
.github/workflows/freeze-slugs.yml     MODIFIÉ (matrice SITE)
```

⚠️ `.github/workflows/` ne passe pas au glisser-déposer : déposer ce fichier-là
en le créant à la main, comme pour `daily.yml`.

**Rien ne change en production.** Le test mesure et n'échoue pas dans l'état
actuel — vérifié : les 9 tests du build passent, y compris le nouveau.

## Pourquoi ce lot doit être en place AVANT de toucher aux adresses

`test:slugs` prouve qu'une adresse ne bouge pas quand le **classement** change
(défaut du 18/07 : `/item/batgirl/` passait d'un collectible à un autre). Il ne
dit **rien** de l'autre mode de panne, celui qui nous attend : le **renommage**.

Or migrer l'identité vers CollectChain change `slug(série)` sur **16 266 comics
sur 16 266**. Et `sites/<SITE>/slugs.json` n'existe dans **aucun** site.

## Ce que `test:renommage` établit

Il rejoue la vraie migration sur l'échantillon (la série d'un comic redevient
une série, les libellés prennent leur forme canonique), puis compare les
adresses. Résultat mesuré :

| | adresses déplacées | changeant d'objet |
|---|---|---|
| **sans** table de gel | **90 / 90** | 0 |
| **avec** table de gel | **0 / 90** | 0 |

➡️ Le gel est bien ce qui sépare une migration propre d'un déménagement massif.

Il ajoute un troisième contrôle : **un site qui déclare
`publication.adresses_gelees: true` sans avoir sa table fait échouer le build.**

⭐ C'est un interrupteur de **donnée**, pas de code. Aujourd'hui aucun site ne
le déclare → le test mesure sans bloquer. À l'étape « geler » du chantier, on
pose `adresses_gelees: true` dans le manifeste et le garde-fou s'arme tout seul.
C'est la même doctrine que les paliers d'accès : le réglage est une donnée.

## Le défaut corrigé dans `freeze-slugs.yml`

Le workflow ne posait **aucune variable `SITE`**. Or `manifest.mjs` fait
`SITE = process.env.SITE || 'veveprice'` : le gel ne couvrait **qu'un seul site
sur 15**, en silence. Les 14 autres croyaient leurs adresses gelées.

Corrigé par une **matrice découverte depuis `sites/`** — un site nouveau est
gelé sans toucher au fichier. Avec deux garde-fous : une liste vide fait échouer
le job (elle ne gèlerait rien en silence), et `max-parallel: 1` évite que deux
sites qui committent dans le même dépôt se marchent dessus.

## Pourquoi `test:slugs` reste hors du build

Il enchaîne **trois `npm run build`** (avant, après bousculade, remise au
propre). Impossible à mettre dans le `Dockerfile`, qui construit déjà une fois.
`test:renommage` suit le patron de `test:quotas` : copie temporaire + processus
séparé, aucun build Astro — il tourne en quelques secondes.

## À supprimer à la racine du projet après dépôt

- `_lot_adresses/`
