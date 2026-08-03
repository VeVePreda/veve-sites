# LOT 35 — `VeVePreda/veve-sites`
## `test:cles` — le banc qui manquait, et qui m'a manqué à moi

Zip : `vevesites-35-BANC-CLES-I18N-0308.zip` · racine du zip = racine du dépôt.
**Ne remplace pas le lot 34** : il le complète. Le lot 34 reste correct.

---

# 🔴 D'ABORD, CE QUI N'EST TOUJOURS PAS FAIT

**Les 6 suppressions manuelles du lot 34 n'ont pas été faites.** Vérifié dans
le miroir après ton upload : `demo: crevette` est bien arrivé, `src/pages/rarity/`
est encore là. Ce lot **ne les remplace pas** — il fait en sorte que ça ne
puisse plus passer inaperçu.

```
src/pages/rarity/index.astro
src/pages/rarity/[slug].astro
src/pages/[locale]/rarity/index.astro
src/pages/[locale]/rarity/[slug].astro
src/components/pages/Rarities.astro
src/components/pages/RarityPage.astro
```

puis les dossiers vides `src/pages/rarity/` et `src/pages/[locale]/rarity/`.

⚠️ **Si tu déposes le lot 35 SANS faire ces suppressions, le build ÉCHOUERA** —
c'est exactement ce qu'on lui demande. Fais les suppressions d'abord.

---

# 1. Ce qui s'est passé

Le lot 34 supprimait 6 clés i18n dans 5 langues, et 6 fichiers **à la main**.
Les clés sont parties. Les fichiers, non. Rendu en ligne :

```html
<title>rarities.title | VeVe Price</title>
<h1>rarities.title</h1>
<meta name="description" content="desc.rarities">
```

24 pages, 5 langues, **168 emplacements**.

## 🔴 Et les DIX contrôles étaient verts

`test:gabarits` · `test:langues` · `test:lastmod` · `test:schema` ·
`test:fiches` · `test:acces` · `test:reserve` · `test:donnees` · `css-mort` ·
`imports-orphelins`. Aucun n'a bronché. 463 pages rendues sans une erreur.

**⭐⭐ Pourquoi `test:langues` ne pouvait PAS le voir.** Il compare chaque
langue à la langue pivot : *« fr a-t-il toutes les clés de en ? »*. Les cinq
langues avaient perdu **exactement les mêmes six clés**. Il était donc vert —
**et il avait raison de l'être** : les traductions étaient parfaitement
cohérentes entre elles. Cohérentes **et** absentes.

> **Un contrôle de cohérence ne voit pas une perte uniforme.**
> Il faut un contrôle qui compare la page à la RÉALITÉ, pas les langues
> entre elles.

**⭐⭐ Et pourquoi rien n'a planté.** `engine/lib/i18n.mjs` l.27 :

```js
const raw = d[key] !== undefined ? d[key] : (dict(def)[key] ?? key);
```

Le `?? key` est **délibéré et bon** : une clé manquante ne doit pas faire tomber
un site en production. Mais un repli qui produit une valeur **plausible** est
invisible — même mécanisme que le `getattr(…, ())` qui a mal étiqueté 216 838
transferts. **On ne retire pas le repli : on ajoute l'instrument qui le rend
audible.**

---

# 2. Le banc — `engine/tools/test_cles_i18n.mjs`

## Ce qu'il refuse de faire

⛔ **Il ne devine pas à quoi « ressemble » une clé.** Une règle de forme
(« mot.mot sans espace ») accuserait `veveprice.com`, `sitemap.xml`, `3.14`,
`spider-man.jpg`. Un contrôle qui crie à tort cesse d'être lu — c'est la leçon
du 31/07, les 172 griefs de `css-mort` sur encyclopedie.

## Ce qu'il fait

⭐ **Il lit le vocabulaire réel.** Les clés que le code peut émettre sont
écrites en clair dans les gabarits : `t(lang, 'nav.blog')`. On extrait cet
ensemble des sources, puis on cherche **ces chaînes-là** dans le HTML produit.
Zéro heuristique donc zéro faux positif : pour accuser à tort, il faudrait
qu'une page affiche volontairement le texte `rarities.title`.

Surfaces inspectées : `<title>`, `<meta description>`, `<meta og:*>`,
`<h1>`→`<h6>`, et le texte visible. **Pas** les attributs techniques
(`href`, `class`, `src`) — une adresse contient légitimement des points.

## ⭐ Ce que j'ai trouvé en écrivant le banc, et pas avant

**a) `item.7d` et `item.30d` étaient hors de portée.** `Item.astro` l.211 fait
`[['item.7d', v], ['item.30d', v]].map(([k,v]) => t(lang, k))` : ce **sont** des
littéraux, ils n'étaient simplement pas à l'endroit où je regardais. Le banc
accepte maintenant tout littéral dont le **préfixe est un espace de noms
réellement déclaré** dans `engine/i18n` — le vocabulaire se déduit du
dictionnaire, il ne se devine pas.

**b) `blog.json` et `movers.astro` étaient entrés dans le vocabulaire.** Leurs
préfixes `blog` et `movers` **sont** de vrais espaces de noms. Ce sont des noms
de fichiers. Sur vevewiki — une encyclopédie — un article peut parfaitement
citer « blog.json » dans son texte : le banc aurait accusé une page saine.
Corrigé par une liste d'extensions.

> ⭐⭐ **Un détecteur se relit sur ce qu'il a mis dans sa LISTE, pas seulement
> sur son verdict.** Le verdict était vert ; la liste était déjà fausse.

## Sa limite, écrite parce qu'elle est réelle

Une clé **construite** (`t(lang, 'nav.' + nom)`) n'est pas un littéral et ne
sera pas vue. Le banc **affiche ce compte à chaque tour** — 3 appels
aujourd'hui, dont un (`Editorial.astro` l.47) qui se protège déjà tout seul
(`v === cle ? brut : v`) et un qui est la définition de `t()` elle-même.
Reste **un** vrai point aveugle. *« Quelle fraction mon contrôle couvre-t-il ? »*
est la question, et la réponse doit être écrite, pas supposée.

## Trois auto-contrôles

1. Une page témoin portant une vraie clé **est** détectée — sinon son vert ne
   vaut rien.
2. Une page normale (domaine, nom de fichier, décimales) **n'est pas** accusée
   — sans quoi un détecteur qui répond « coupable » à tout serait vert au 1.
3. Le vocabulaire **ne contient aucun nom de fichier** — ajouté après avoir
   trouvé `blog.json` dedans.

Et `rc=2` s'il n'a lu aucune page, ou moins de 20 clés : **un banc qui n'a rien
inspecté n'a rien prouvé**, et son vert est le plus cher de tous. Même
dispositif que `css-mort`.

---

# 3. Où il est câblé

`Dockerfile`, **après** `npm run build` (l.182), avant la précompression.

⚠️ **Et c'est un choix, pas un oubli.** `css-mort`, `imports-orphelins` et
`cascade-aplatie` parlent AVANT le compilateur pour 40 ms chacun. Celui-ci ne
peut pas : sa question — *« qu'est-ce que la page DIT ? »* — n'a de réponse
qu'après rendu. Il lit `dist/` (ou `dist/client/` en mode server).

Aussi ajouté à la fin de `npm test`.

---

# 4. Ce qui a été joué

| état | veveprice | vevewiki |
|---|---|---|
| **dépôt corrigé** (6 fichiers supprimés) | ✅ 443 pages propres | ✅ 244 pages propres |
| **dépôt actuel** (suppressions non faites) | ❌ 5 clés / 168 emplacements | — |

Les **16 bancs × 2 manifestes** = 32/32 verts sur l'état corrigé, plus les
3 contrôles. `test:dockerfile` accepte la nouvelle étape sur les deux sites.

⛔ Rappel de la règle du 02/08 : un banc câblé dans le Dockerfile tourne pour
TOUS les sites. Celui-ci a été joué avec `SITE=veveprice` **et**
`SITE=vevewiki` avant livraison.

---

# 5. ⏳ Toujours pas fait

- 🔴 **Les 6 suppressions du lot 34** — préalable à ce lot.
- ⏳ **Recherche globale** — diagnostiquée le 03/08, toujours pas livrée.
- ⏳ **Blog** — `maquette-veveprice.html` à porter avec `outils/porter.mjs`.
- ⏳ **Vraie page Marché** — filtres, favoris, colonnes, Sets.
- ⏳ **~20 classes du thème jamais émises.**
- ⏳ **Les 3 lectures** (couvertures comics, ATL>ATH, audit SEO nocturne).
- ✅ *Hors dépôt* : `outils/etat_reel.py` a reçu une **section 1 bis
  « portes ouvertes »** qui signale la démo sans polluer le compteur d'écarts.
