# ⚠️ CE FICHIER VA DANS LE DEPOT VeVePreda/veve-sites, A LA RACINE (./Dockerfile)
# UNE SEULE IMAGE, DEUX MODES — ET C'EST LE MANIFESTE QUI DECIDE.
#
#   sites/<SITE>/manifest.yml :  rendering: static   -> nginx seul
#                                rendering: server   -> nginx DEVANT Node
#
# ⭐ POURQUOI LE MANIFESTE ET NON UNE VARIABLE COOLIFY.
# La ligne `rendering:` existait dans le manifeste depuis le premier jour, et le
# Dockerfile l'ignorait au profit d'un build arg. C'etait — encore — un reglage
# pose a un endroit et ignore a un autre. Deux pieges Coolify en decoulaient :
#   1. une variable d'environnement ordinaire n'est PAS un build arg (il faut
#      cocher « Build Variable », ce qui ne se voit nulle part) ;
#   2. Coolify SAUTE la construction si le commit n'a pas change — donc modifier
#      une variable ne reconstruit rien.
# En lisant le manifeste, les deux disparaissent : basculer un site, c'est
# editer une ligne et pousser. Le commit change, donc le build aussi. Et c'est
# le principe de toute l'usine : le manifeste decide, le code obeit.
#
# ⭐ nginx RESTE LA PORTE D'ENTREE DANS LES DEUX MODES, sur le port 80.
# `nginx.conf` ne sert pas que des fichiers : il porte le proxy /stats/
# (anti-empreinte), le cache, les en-tetes de securite et gzip. Node n'en
# reprend rien. En mode serveur, nginx sert les pages pre-generees et ne
# delegue a Node (127.0.0.1:4321, jamais expose) que /api/.

# --- Etape 1 : construction du site ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY . .
ARG SITE=veveprice
ARG SITE_URL=https://veveprice.com
ENV SITE=$SITE SITE_URL=$SITE_URL
# Marge de securite : le catalogue et l'historique grandissent avec le temps.
ENV NODE_OPTIONS=--max-old-space-size=3072

# Le mode est LU DANS LE MANIFESTE, une fois, et depose dans un fichier que
# toutes les etapes suivantes relisent (chaque RUN est un shell distinct).
RUN set -e; \
    node engine/lib/chrono_build.mjs debut; \
    MODE=$(sed -n 's/^rendering:[[:space:]]*\([a-zA-Z]*\).*/\1/p' "sites/$SITE/manifest.yml" | head -1); \
    [ -n "$MODE" ] || MODE=static; \
    case "$MODE" in \
      static|server) ;; \
      *) echo "ERREUR: rendering: « $MODE » inconnu dans sites/$SITE/manifest.yml (attendu static ou server)"; exit 1 ;; \
    esac; \
    echo "$MODE" > /app/.rendering; \
    echo "mode lu dans le manifeste : $MODE"

# Verifie que le jeu de donnees n'est construit qu'UNE fois (sinon le build
# lit le fichier de prix autant de fois qu'il y a de routes -> panne memoire).
# ═══════════════════════════════════════════════════════════════════════════
# 🔴🔴🔴 LOT 126 — `test:nginx` ENTRE DANS LE BUILD, ET VOICI POURQUOI
# ═══════════════════════════════════════════════════════════════════════════
# CE QUE JE CROYAIS (note « P10 » du suivi) : « test:nginx est MUET sans
# crossplane ». MESURE DU 10/08, en desinstallant vraiment la dependance :
#     avec crossplane .... code 0
#     sans crossplane .... code 1, « crossplane est absent », LA CHAINE S'ARRETE
# ⭐⭐⭐ IL N'EST PAS MUET. `test_nginx.py` fait `sys.exit(...)` plutot que de
# sauter le controle — un banc qui REFUSE de tourner vaut mille fois mieux
# qu'un banc qui se declare vert sans rien verifier. La note etait fausse, et
# elle m'aurait fait « corriger » un comportement deja correct.
#
# LE VRAI TROU EST AILLEURS, ET IL EST PLUS GRAVE : ce banc tourne dans la CI
# (`.github/workflows/tests.yml`, avec python + crossplane) mais **PAS DANS CE
# DOCKERFILE**. Or la CI se declenche sur `push: main` — c'est-a-dire APRES le
# depot, EN MEME TEMPS que le deploiement Coolify. Une regle nginx manquante
# partait donc en production, et la CI rougissait ensuite.
# ⭐⭐ Le Dockerfile est la seule porte que le deploiement RESPECTE : un banc qui
# n'y est pas ne bloque rien. La panne du lot 119 (`/favoris/` en 404) n'etait
# pas un silence du BANC, c'etait un silence du NON-EXECUTE.
# ⚠️ Le commentaire de `tests.yml` affirmait « le Dockerfile installe python3 » :
# c'etait faux — le stage de build n'avait AUCUN `apk add`. Corrige la-bas.
#
# ⭐ IL EST PLACE ICI, AVANT TOUT LE RESTE, ET C'EST VOULU : il ne lit que deux
# fichiers de configuration et la liste des routes. Il coute deux secondes, et
# il echoue AVANT les quatorze bancs et les trente-cinq secondes de build.
# ⚠️ `--break-system-packages` : alpine 3.19+ refuse un pip global sans lui.
#    Ce stage-ci n'est PAS l'image servie — le runtime repart d'un FROM propre.
# ⚠️ SUR UNE SEULE LIGNE, ET C'EST UNE CONVENTION DU FICHIER : aucun des 39
#    RUN n'utilise de continuation `\`. `test:dockerfile` extrait chaque RUN
#    et le passe a `sh -n` en aplatissant — une ligne qui commence par `&&`
#    lui devient un `"&&" unexpected`. Il a rougi sur ma premiere version.
RUN apk add --no-cache python3 py3-pip && pip install --no-cache-dir --break-system-packages crossplane
RUN npm run test:nginx
# ═══════════════════════════════════════════════════════════════════════════
# 🔴🔴 LOT 144 (B-8) — SEPT BANCS NE GARDAIENT AUCUNE PORTE, ET C'ETAIT MESURABLE
# ═══════════════════════════════════════════════════════════════════════════
# Mesure du 13/08/2026 : `npm test` chainait **41** bancs, ce `Dockerfile` en
# lancait **34**. Les sept absents : test:adresses, test:demo (retire au 161), test:dockerfile,
# test:entrepot, test:plages, test:session, test:slugs.
# ⭐⭐ ET C'EST LE `Dockerfile` QUI COMPTE, PAS LA CI. « Le Dockerfile est la
# seule porte que le deploiement respecte ; la CI CONSTATE, elle n'EMPECHE
# pas. » Un banc absent d'ici est un banc qui peut rougir dans `tests.yml`
# pendant que Coolify met le site en ligne.
# ⛔ `test:slugs` RESTE DEHORS, et ce n'est pas un oubli : il enchaine trois
# `npm run build` (voir la note de `freeze-slugs` plus bas). Les six autres
# tournent en moins d'une minute a eux tous — mesure faite dans le bac a sable,
# apres un build reel.
# ⚠️ CHACUN EST PLACE OU IL PEUT MESURER, PAS EN BLOC : cinq avant le build (ils
# n'ont besoin que du code), un apres (il lit `dist/`).
# ⏱️🔴🔴🔴 LOT 214 — `test:memoire` N'ETAIT DANS AUCUN `RUN`, ET IL AURAIT DU.
# Mesure du 02/09 : le Dockerfile appelle 46 bancs ; celui-ci n'en faisait pas
# partie depuis sa naissance au lot 175. La sonde memoire etait donc EPROUVEE
# au bac a sable et NON GARDEE au deploiement — un banc depose n'est pas un
# banc branche, exactement comme un fichier. ⭐ Le lot 214 lui ajoute le §⑧,
# qui garde le chrono ; le laisser dehors aurait livre un instrument que rien
# ne surveille, sur le seul chemin qui compte.
# ⭐⭐ GREFFE SUR LE `RUN` VOISIN, PAS DE COUCHE EN PLUS. Ce lot cherche a
# ALLEGER l'image ; lui ajouter une 60ᵉ couche pour se mesurer lui-meme serait
# se contredire. Et les deux bancs observent la MEME chose — le Dockerfile :
# `test:dockerfile` sa syntaxe, `test:memoire` §⑧ la position de ses jalons.
# ⛔ `&&` ET NON `;` — la lecon du lot 27, ecrite trois fois dans ce fichier :
# avec `;` le code de sortie serait celui du dernier, et un `test:dockerfile`
# rouge passerait au vert.
RUN npm run test:dockerfile && WAREHOUSE_OFFLINE=1 npm run test:memoire
# 🔗 `test:liens` — LOT 213. AVANT LE BUILD, parce qu'il lit la SOURCE.
# Il verifie qu'un lien vers une adresse gatee est garde par la fonction qui la
# gate. Ecrit apres une mesure, pas par principe : le 01/09, retirer la garde
# du lien de pied de page a produit 58 liens vers un 404 sur vevewiki, et les
# CINQ bancs qui auraient pu le voir (adresses, pages, cache, lastmod, schema)
# sont restes VERTS. Le build, lui, sort rc=0 avec la page fantome dans dist/.
# ⭐ Il ne depend NI de `dist/` NI de `SITE=` : sur veveprice, un banc adosse a
# la sortie serait vert faute de condition — un interrupteur de plus.
RUN npm run test:liens
# 💳 `test:caisse` — LOT 199. IL EST ICI, AVANT LE BUILD, ET HORS RESEAU.
# ═══════════════════════════════════════════════════════════════════════════
# Il juge la sonde qui doit dire, depuis `/api/sante`, si le conteneur peut
# lire le reseau Base. ⛔ IL NE SORT SUR AUCUN RESEAU : il monte son propre
# noeud sur 127.0.0.1 et lui fait jouer les cinq reponses possibles. Un banc
# qui interrogerait mainnet.base.org mesurerait le reseau du CONSTRUCTEUR
# D'IMAGES — une question qui n'est pas la sienne, et dont la reponse change
# d'une machine a l'autre. ⭐ *Un banc juge le code, pas l'avancement.*
# ⛔ ET IL NE REND AUCUN INDECIDABLE : il tourne dans cette porte, donc il
#   tranche, toujours, sur les huit points qu'il pose.
# ⭐⭐⭐ CE QU'IL GARDE VRAIMENT : que la sonde N'ATTENDE JAMAIS. Le lanceur
#   interroge `/api/sante` au demarrage et refuse de servir si la route tarde ;
#   Coolify arrete alors le conteneur au bout de douze essais. Une sonde qui
#   attendrait un hote injoignable transformerait un pare-feu sortant en 503
#   sur tout le site — et hors ligne, ou le faux noeud repond en 1 ms, ce
#   defaut serait parfaitement invisible.
# ⛔ IL VA AVANT LE BUILD : il ne lit que `engine/lib/` et `src/pages/api/`,
#   jamais `dist/`. Place apres, il ne mesurerait ni plus ni mieux, et il
#   ferait perdre quatre minutes avant de dire qu'un fichier est fautif.
RUN npm run test:caisse
RUN WAREHOUSE_OFFLINE=1 npm run test:entrepot

RUN WAREHOUSE_OFFLINE=1 npm run test:donnees
# Verifie qu'aucun type n'est evince de la vitrine (le 18/07 la prod a
# publie 400 fiches et ZERO comic sans qu'aucun controle ne s'en plaigne).
RUN WAREHOUSE_OFFLINE=1 npm run test:quotas
# Verifie que les paliers d'acces sont lus par la matrice, et par elle seule.
# 🔴🔴🔴 `test:rayon` — LOT 113, ET IL EST ICI, AVANT LE BUILD, POUR UNE RAISON
#    QUI A COUTE UN DEPLOIEMENT (10/08/2026).
#    Il importe `dataset()`. Sous `WAREHOUSE_OFFLINE=1`, `dataset()` RECALCULE
#    sur `engine/data/sample/` — et `projeter()` puis `reserve.fermer()`
#    s'executent POUR DE BON : `.reserve/cote/` passe de 1 201 fichiers a 0.
#    Place APRES le build, il DETRUISAIT donc la reserve que le build venait
#    d'ecrire, et l'etape de controle plus bas rendait :
#      « ERREUR: mode server mais la reserve de COTE est VIDE »
#    ⭐⭐⭐ UN BANC QUI RECALCULE CE QU'IL DOIT JUGER NE LE JUGE PLUS, IL LE
#    REMPLACE. C'est exactement la panne du lot 101 sur `test:fuite`, refaite a
#    l'identique — et la regle etait ecrite. *Un avertissement qu'on ne peut pas
#    faire rougir finit lu sans etre suivi.*
#    ⛔ NE JAMAIS le redescendre apres `npm run build`. Les autres bancs qui
#    importent `dataset()` (`test:donnees`, `test:quotas`, `test:acces`) sont
#    ici pour la meme raison : le build qui suit reecrit la reserve.
#    ⭐ Ce qui a sauve le deploiement : l'etape de controle de la reserve, qui a
#    fait ECHOUER le build au lieu de mettre en ligne un site vert ou aucun
#    abonne n'aurait vu un seul prix.
RUN WAREHOUSE_OFFLINE=1 npm run test:rayon
RUN WAREHOUSE_OFFLINE=1 npm run test:acces
# ⭐ LOT 144 (B-8) — `test:session` controle le CIRCUIT de session, et il
# n'arretait pas un deploiement. Il voisine `test:acces` parce qu'ils repondent
# a la meme question — « qui a le droit de voir quoi » — et parce qu'aucun des
# deux ne lit `dist/`.
# 🗑️ LOT 161 — `test:demo` etait ici aussi. Il est parti avec le mecanisme.
RUN WAREHOUSE_OFFLINE=1 npm run test:session
# ═══════════════════════════════════════════════════════════════════════════
# 🔴🔴 LOT 154-B — `test:prefs` EST ICI, ET LA RAISON EST UNE PERTE DE DONNEES
# ═══════════════════════════════════════════════════════════════════════════
# Ce banc garde une chose qu'aucun autre ne regarde : DEUX MAGASINS PARTAGENT
# LE FICHIER DE BASE MONTE SUR `/data` (`favoris.mjs` depuis le lot 140-3,
# `prefs.mjs` depuis celui-ci). Si le second abime la table du premier, les
# favoris des membres disparaissent — sans erreur, sans run rouge, sans plainte.
# ⭐⭐⭐ C'est exactement la classe de defaut que le `Dockerfile` doit EMPECHER
#   et pas seulement CONSTATER : « la CI constate, elle n'empeche pas ». Un banc
#   qui garde des donnees d'utilisateur n'a rien a faire uniquement dans
#   `tests.yml`, ou son rouge arrive pendant que Coolify met le site en ligne.
# ⭐ AVANT LE BUILD, comme ses voisins : il n'importe pas `dataset()` et ne lit
#   pas `dist/`. Il ouvre une base SQLite dans `os.tmpdir()` et l'efface.
# ⛔ IL N'ECRIT PAS DANS `/data` — la base d'essai vit dans un dossier temporaire
#   pose par `mkdtempSync`, via `DB_PATH`. Un banc qui toucherait le volume de
#   production serait pire que le defaut qu'il surveille.
RUN WAREHOUSE_OFFLINE=1 npm run test:prefs
# ═══════════════════════════════════════════════════════════════════════════
# 🔴🔴🔴 `test:projection` — LOT 117. IL IMPORTE `dataset()` : IL EST **ICI**.
# ═══════════════════════════════════════════════════════════════════════════
# Il ferme le CIRCUIT que les controles precedents n'ouvraient qu'a une
# extremite. Le controle de reserve de l'etape finale COMPTE LES FICHIERS de
# `.reserve/cote/` : il prouve l'ECRITURE, et il a sauve le deploiement du
# 10/08. Mais rien ne prouvait la LECTURE — et le 10/08, `lireCotes()`
# appelait `readFileSync` SANS L'IMPORTER : l'erreur etait avalee par un
# `try/catch` ecrit pour un JSON corrompu, `/market/` servait 200 lignes de
# tirets aux seuls abonnes, tri par prix mort, sur un build parfaitement vert.
# ⭐ Ce banc fait l'aller-retour : il depose une cote temoin (dans un
#   `mktemp`, jamais dans `.reserve/`) et exige qu'elle revienne.
# ⭐ Il verifie aussi que l'empreinte des prix est scellee AVANT la
#   projection, que la courbe du Marche se trace, et qu'aucun gabarit ne lit
#   `history` hors d'une liste blanche NOMMEE.
# ⛔ NE JAMAIS le redescendre apres `npm run build` : sous
#   `WAREHOUSE_OFFLINE=1` il RECALCULE et viderait `.reserve/cote/`. Meme
#   raison, mot pour mot, que `test:rayon` juste au-dessus.
RUN WAREHOUSE_OFFLINE=1 npm run test:projection
# ⭐⭐ `test:reserve` — LE BANC DU MUR (01/08/2026).
# Il garde six pannes dont AUCUNE ne fait échouer un build Astro :
#   · un uuid d'URL qui sert de chemin de fichier (traversée) ;
#   · une route qui rend la donnée sans vérifier le palier — le mur devient
#     décoratif, et un mur décoratif se découvre par une capture d'écran ;
#   · un refus qui échoue OUVERT sur une session absente : c'est exactement
#     `getattr(…, ())` et ses 216 838 transferts mal étiquetés, transposé à
#     un droit d'accès — donc à de l'abonnement distribué gratuitement ;
#   · la réserve qui atterrit sous dist/, servie en clair par nginx ;
#   · une réserve non triée : la courbe se replie sur elle-même, et seul un
#     abonné la voit — donc trop tard ;
#   · des classes émises par le Cadran que le thème n'habille pas.
RUN WAREHOUSE_OFFLINE=1 npm run test:reserve

# 💰 LOT 210 — LE BANC DES VENTES RESERVEES. Voisin de `test:reserve` parce
# qu'il garde le meme genre de chose : une donnee qui ne doit PAS entrer dans
# `dist/`. Trois pannes qu'il attrape, et aucune ne leve d'erreur : une fuite
# de prix, un DECALAGE du tableau positionnel (un champ insere au milieu
# ferait afficher un prix a la place d'une edition, sans rien casser), une
# adresse entiere publiee le jour ou l'amont cesserait de tronquer.
# ⭐ PAS de `WAREHOUSE_OFFLINE=1`, contrairement a son voisin, ET C'EST VOULU :
# ce banc ne lit pas l'entrepot, il fabrique ses lignes. Poser la variable
# laisserait croire qu'il en depend.
RUN npm run test:ventes

# ⭐ Les garde-fous qui ne tournent PAS en production ne gardent rien.
# `test:blog`, `test:figures` et `test:fiches` protègent trois pannes 100 %
# silencieuses : un article sans date qui passe en brouillon, une figure sans
# date de collecte qui part se faire partager, une fiche dont la « voisine »
# pointe vers une page non publiée. Aucune ne fait échouer un build Astro —
# d'où leur place ici, où un échec ARRÊTE le déploiement.
RUN WAREHOUSE_OFFLINE=1 npm run test:blog
RUN WAREHOUSE_OFFLINE=1 npm run test:figures
RUN WAREHOUSE_OFFLINE=1 npm run test:fiches
# ⭐ `test:lastmod` garde une panne muette : si engine/data/lastmod.<site>.json
#    manque ou ne couvre plus une section publiée, le sitemap redate TOUTES
#    ses URL du jour du build — rien n'échoue, et le signal meurt.
#    Un garde-fou qui ne tourne pas en production ne garde rien.
RUN WAREHOUSE_OFFLINE=1 npm run test:lastmod
# ⭐⭐ `test:langues` garde LA panne la plus silencieuse du réseau : une page
#    publiée dans une langue mais RECOPIÉE de la langue pivot. Elle a son titre,
#    sa description, son canonical, ses hreflang et son poids — elle dit
#    simplement autre chose que ce que son <html lang> promet. Aucun build
#    n'échoue, et l'audit du HTML ne peut pas la distinguer sans un seuil qui
#    produit des fausses alertes (essayé, mesuré, retiré : voir audit_seo.py).
#    Ici on interroge le moteur, qui sait champ par champ ce qui est retombé.
RUN WAREHOUSE_OFFLINE=1 npm run test:langues
# ⭐⭐ `test:renommage` garde LE mode de panne du chantier d'identite.
#    `test:slugs` prouve qu'une adresse ne bouge pas quand le CLASSEMENT
#    change ; il ne dit RIEN du RENOMMAGE. Or migrer l'identite vers
#    CollectChain change slug(serie) sur 16 266 comics sur 16 266 (mesure du
#    28/07/2026) — et `sites/<SITE>/slugs.json` n'existe dans AUCUN site.
#    Ce test chiffre le deplacement sans gel, prouve qu'avec gel il est nul,
#    et fait ECHOUER un site qui declare `adresses_gelees: true` sans la table.
#    (`test:slugs` reste hors du build : il enchaine trois `npm run build`.)
# ⭐ Les donnees structurees ont deux facons de mal tourner, et aucune ne fait
# echouer un build Astro : elles DISPARAISSENT (quelqu'un retire le `ld={...}`
# d'un gabarit — 87 termes definis cessent d'exister pour un moteur, la page
# reste parfaitement valide), ou elles MENTENT (un DefinedTerm sans definition,
# un Event avec une date inventee). D'ou leur place ici, ou un echec ARRETE le
# deploiement.
RUN npm run test:schema
# ⭐ AJOUTÉ LE 30/07/2026 — APRÈS UN BUILD DE PRODUCTION CASSÉ PAR UNE FAUTE DE
# FORME. Un commentaire JSX mal placé dans un .astro a fait tomber le
# déploiement à l'étape 17/20, après 12 bancs verts et 3 minutes de build.
# Ce banc lit les 48 gabarits en quelques millisecondes, sans dépendance.
# ⚠️ IL EST PLACÉ JUSTE AVANT `npm run build`, ET C'EST VOULU : il coûte
# 40 ms, le compilateur coûte 3 minutes. Un défaut de forme doit être vu par le
# moins cher des deux. ⛔ Il ne REMPLACE pas le compilateur, il le précède.
RUN npm run test:gabarits
# ⭐⭐ LES DEUX CONTROLES DU 31/07/2026 — ECRITS APRES DEUX PANNES DE PROD,
# CABLES ICI POUR QU'ILS N'AIENT PAS A ETRE RELANCES A LA MAIN.
#   · `css-mort` : du CSS parfaitement VALIDE qui ne s'appliquera jamais —
#     `@container` sans conteneur, `var(--x)` sans `--x`, une classe du socle
#     sans regle, et une FAMILLE nommee que rien ne charge. Ce dernier cas a
#     sorti 58 regles de prix en chasse fixe pendant toute la refonte.
#   · `imports-orphelins` : un fichier supprime se supprime DEUX FOIS — le
#     fichier, et ceux qui le nomment. `Piece.astro` retire a juste titre a
#     casse le build en prod a l'etape 18/21, APRES 17 bancs verts.
# ⚠️ PLACES AVANT `npm run build`, comme `test:gabarits`, et pour la meme
# raison : ils coutent 40 ms chacun la ou le compilateur coute 3 minutes.
# ⛔ NE PAS les deplacer apres le build « pour gagner du temps » : leur valeur
# vient entierement du fait qu'ils parlent AVANT que quoi que ce soit soit long.
# ⭐ `css-mort` sort en rc=2 s'il n'a lu AUCUN theme : une racine fausse fait
# echouer l'etape au lieu de rendre un vert a vie. Un controle qui n'a rien
# inspecte n'a rien prouve.
RUN node outils/css-mort.mjs
RUN node outils/imports-orphelins.mjs
# ⭐⭐ `cascade-aplatie` — LE CONTROLE QUI MANQUAIT VRAIMENT (31/07, au soir).
# Les deux au-dessus demandent « cette regle EXISTE-T-ELLE ? ». La reponse
# etait OUI partout, pendant que le site servait sa disposition MOBILE a
# toutes les largeurs : 46 regles de `@media (max-width:…)` avaient ete
# RECOPIEES a la racine, et la copie racine gagnait la cascade.
# Navigation invisible, 4 paliers empiles en 1 colonne, fiche sans colonne
# laterale, barre de recherche reduite a un carre de 44 px.
# ⭐⭐ « EST-CE LA ? » ET « EST-CE CE QUI GAGNE ? » SONT DEUX QUESTIONS.
RUN node outils/cascade-aplatie.mjs

RUN WAREHOUSE_OFFLINE=1 npm run test:renommage
# ⭐ LOT 144 (B-8) — `test:adresses` juge la hierarchie /comics/<serie>/<num>/
# <rarete>/ : meme sujet que `test:renommage`, meme moment (il appelle
# `dataset()` hors ligne, donc AVANT le build, comme test:quotas et test:rayon).
RUN WAREHOUSE_OFFLINE=1 npm run test:adresses

# ⚠️ LE DOSSIER EXISTE TOUJOURS, MEME VIDE. En mode static (vevewiki) la
# reserve ne s'ouvre jamais : la porte `price_history` est inactive, tout
# l'historique est deja public, et l'ecrire couterait des dizaines de Mo pour
# proteger ce que la page donne. Sans ce mkdir, le `COPY /app/.reserve` de
# l'etape suivante ferait echouer le build de vevewiki sur une source absente.
# 🔴🔴 `&&` ET NON `;` — CORRIGE LE 03/08/2026, C'ETAIT MA FAUTE (lot 27).
# En ajoutant `mkdir -p /app/.reserve` APRES le build, j'ai ecrit :
#     npm run build; mkdir -p /app/.reserve
# Avec `;`, le code de sortie de l'ETAPE est celui de la DERNIERE commande —
# donc celui du `mkdir`, qui reussit toujours. Un build Astro qui echoue
# passait desormais AU VERT, et l'erreur ne reapparaissait qu'a l'etape
# suivante, sous un message qui pointe ailleurs :
#     « ERREUR: rendering:server mais pas de dist/server/entry.mjs
#       — adaptateur Node absent ? »
# ⭐⭐ UN GARDE-FOU QUI ECHOUE OUVERT, ET C'EST MOI QUI L'AI INTRODUIT. C'est
# exactement le defaut de `getattr(…, ())` : l'erreur reelle est avalee et
# remplacee par un diagnostic plausible mais faux. Ici le compilateur Astro
# CRIAIT, et le Dockerfile l'a rendu muet.
# ⭐ `set -e` en plus du `&&` : ceinture et bretelles sur une ligne qui decide
# si 8 500 pages existent.
# 🌍🔴 LOT 129 — `I18N_MARQUAGE=1` EST POSE ICI, ET NULLE PART AILLEURS.
# Il demande a `t()` d'enrober chaque libelle de sa cle. Le serveur de
# production est un AUTRE processus (`node dist/server/entry.mjs`) : il ne l'a
# pas, donc les pages rendues a la demande — /compte/, /favoris/, /market/ —
# rendent du texte NU, deja dans la bonne langue. Les deux mondes ne se croisent
# jamais, et c'est cette ligne-ci qui le garantit.
RUN set -e; node engine/lib/chrono_build.mjs build; export RENDERING=$(cat /app/.rendering); I18N_MARQUAGE=1 npm run build && mkdir -p /app/.reserve

# 🌍🔴🔴 ET LE POST-TRAITEMENT, IMMEDIATEMENT APRES LE BUILD.
# Il convertit les sentinelles en `data-i18n` et ecrit les dictionnaires servis.
# ⛔ IL DOIT VENIR AVANT LA PRECOMPRESSION : les `.gz` se fabriquent a partir de
# `dist/`, donc compresser d'abord reviendrait a servir des caracteres de
# controle a tout le monde, invisibles a l'oeil et impossibles a diagnostiquer.
# ⭐⭐ `test:i18n` refuse toute sentinelle survivante dans `dist/` : c'est lui qui
# MESURE cet ordre, au lieu de se contenter de l'ecrire en commentaire.
RUN set -e; node engine/lib/chrono_build.mjs apres-build; npm run marquer:i18n

# 🔴 LE GARDE-FOU : le mode annonce et la forme produite doivent coincider.
# Sans lui, l'incoherence se decouvre en production, en servant des pages
# muettes — et rien dans les logs ne l'annonce.
RUN set -e; MODE=$(cat /app/.rendering); \
    if [ "$MODE" = "server" ]; then \
      test -f dist/server/entry.mjs || { echo "ERREUR: rendering:server mais pas de dist/server/entry.mjs — adaptateur Node absent ?"; exit 1; }; \
      test -d dist/client || { echo "ERREUR: rendering:server mais pas de dist/client — les pages pre-generees ont disparu"; exit 1; }; \
      test -f dist/client/index.html || { echo "ERREUR: rendering:server mais pas de dist/client/index.html — LA PAGE D'ACCUEIL N'EXISTE PAS"; exit 1; }; \
      echo "mode server : $(find dist/client -name index.html | wc -l) pages pre-generees + un serveur Node"; \
    else \
      test -f dist/index.html || { echo "ERREUR: rendering:static mais pas de dist/index.html"; exit 1; }; \
      test ! -d dist/server || { echo "ERREUR: rendering:static mais un dist/server existe — nginx servirait la mauvaise arborescence"; exit 1; }; \
      echo "mode static : $(find dist -name index.html | wc -l) pages"; \
    fi

# ⭐⭐ `test:cles` — LE BANC QUI MANQUAIT, ET IL M'A MANQUE A MOI (03/08/2026).
# Le lot 34 retirait `/rarity/` : 6 cles i18n supprimees, 6 fichiers a
# supprimer A LA MAIN. Les cles sont parties, les fichiers non. Resultat en
# ligne, dans 5 langues : `<h1>rarities.title</h1>`, `<title>rarities.title |
# VeVe Price</title>`, 24 pages.
# 🔴 ET LES DIX CONTROLES ETAIENT VERTS. `test:langues` compare les langues
# ENTRE ELLES : les 5 avaient perdu les MEMES cles, il etait donc vert — et il
# avait raison de l'etre. ⭐⭐ UN CONTROLE DE COHERENCE NE VOIT PAS UNE PERTE
# UNIFORME.
# ⚠️ IL EST APRES `npm run build`, contrairement a css-mort / imports-orphelins
# / cascade-aplatie, et ce n'est pas un oubli : sa question — « qu'est-ce que
# la page DIT ? » — n'a de reponse qu'apres rendu. Il lit `dist/`.
# ⭐ Il sort en rc=2 s'il n'a lu aucune page ou moins de 20 cles : un banc qui
# n'a rien inspecte n'a rien prouve, et son vert est le plus cher de tous.
RUN WAREHOUSE_OFFLINE=1 npm run test:cles
# ⭐⭐ `test:routes` — LA TROISIEME PANNE DE LA MEME FAMILLE, LE MEME JOUR.
# 03/08/2026 : (1) 24 pages `/rarity/` en placeholder, (2) `src/pages/index.astro`
# supprime par megarde — LA PAGE D'ACCUEIL, build vert a 438 pages, (3) un
# `editorial: {pages:[blog]}` au manifeste faisant tomber le build de 439 a 424
# pages : /fr/, /es/, /de/ et 12 pages legales, sans une erreur.
# ⭐⭐ « QU'EST-CE QUE LA PAGE DIT ? » (test:cles) ET « LA PAGE EXISTE-T-ELLE ? »
# SONT DEUX QUESTIONS. Aucun banc ne posait la seconde ; deux fois sur trois,
# c'est un humain comparant des comptes de pages qui a vu la panne.
# ⚠️ SON ATTENTE VIENT DU MANIFESTE, PAS D'UNE LISTE. Sa premiere version la
# tirait de `languesDuSite()` — la fonction qui PORTAIT le defaut n°3 — et
# restait verte : l'attente retrecissait avec la panne. Un instrument branche en
# aval de ce qu'il mesure ne mesure rien.
RUN WAREHOUSE_OFFLINE=1 npm run test:routes
# 🔴🔴 `test:fuite` — LE BANC DU LOT 101, ET IL EST DIFFERENT DES 22 AUTRES.
# Tous les autres prouvent une INTENTION (le code fait-il ce qu'on a ecrit ?).
# Celui-ci prouve un FAIT sur le produit fini : « il n'y a pas un seul montant
# dans ce qu'on publie ». Il ouvre les fichiers de `dist/`, prend les vrais
# prix dans `.reserve/cote/` et va voir s'ils s'y retrouvent.
# ⭐⭐⭐ C'est le seul controle qu'un lot FUTUR ne peut pas defaire sans le
# faire echouer : il suffira que quelqu'un passe une valeur a un gabarit, de
# bonne foi, pour une page neuve — et rien d'autre ne le verrait.
# ⚠️ APRES le build, forcement : il lit `dist/`.
RUN WAREHOUSE_OFFLINE=1 npm run test:fuite
# 🔴 `test:phrases` — LOT 102. Il ne cherche que des chaines EXACTES, listees
# a la main avec le lot qui les a retirees. ⭐ Il existe parce que le lot 77 a
# declare avoir retire « toutes les 30 minutes » de la DERNIERE des trois
# mentions visibles, et que la phrase vivait encore dans la FAQ, en QUATRE
# langues, dix jours plus tard. UN TEXTE NE S'IMPORTE PAS, IL SE RECOPIE :
# une fonction retiree casse ses appelants, une phrase retiree ne casse rien.
# ⚠️ APRES le build, comme test:fuite : il lit `dist/`, pas les sources — une
# phrase peut venir d'un manifeste, d'un dictionnaire, d'un gabarit ou d'un
# Sheet recolte ce matin, et `dist/` est le seul endroit ou toutes se croisent.
RUN WAREHOUSE_OFFLINE=1 npm run test:phrases
# 🔴 `test:entete` — LOT 103. Il tient la regle du lot 100 : « une page
# pre-generee n'a pas de visiteur, son en-tete ne depend QUE du cookie ».
# ⭐⭐⭐ Le lot 100 l'avait ecrite ET violee : l'avatar rendu inconditionnel,
# le bouton d'inscription reste conditionnel — deux DOM differents, donc le
# clignotement « parfois » que Preda a signale deux fois sans qu'on puisse le
# reproduire. Ce banc a trouve une SECONDE occurrence a sa premiere execution
# (le selecteur de langues, qui emportait les liens hreflang avec lui).
# ⚠️ AVANT le build : il lit la SOURCE, pas `dist/`. Reproduire le symptome
# demanderait une vraie session serveur, donc le reseau — interdit aux bancs.
RUN WAREHOUSE_OFFLINE=1 npm run test:entete
# 🔥 `test:feuille` — LOT 105. Il tient le lot contre son propre défaisement.
# ⭐⭐⭐ Réinliner du CSS est le geste le plus naturel du monde : plus simple,
# marche tout de suite, une requête en moins, et ça ne casse RIEN. Le lot 105
# se déferait donc tout seul, de bonne foi, au premier lot qui aura besoin
# d'une règle « juste pour cette page » — et la seule alarme serait, trois
# semaines plus tard, un déploiement qui échoue sur un cache Docker plein.
# ⚠️ APRÈS le build (il lit `dist/`) et AVANT la précompression (sinon il
# parcourt 8 500 `.gz` de plus pour rien).
# ⭐ Il sort en rc=2 s'il n'a lu aucune feuille ou moins de 100 pages : un banc
# qui n'a rien inspecté n'a rien prouvé.
RUN WAREHOUSE_OFFLINE=1 npm run test:feuille
# 🔴🔴 LOT 134 — `test:titres` : UN `<h1>`, UN `<title>`, UNE DESCRIPTION.
#    Il entre ici parce que les deux defauts qu'il attrape ont vecu des MOIS en
#    production sans qu'aucun des 39 bancs ne bouge :
#      · l'accueil servait DEUX `<h1>` (« My dashboard » en premier) depuis le
#        lot 126, sous un texte devenu faux au lot 131 ;
#      · `/collections/` et `/sets/` rendaient le MEME `<title>` depuis le
#        lot 113 — Google n'en indexe qu'une des deux.
#    ⭐⭐⭐ AUCUN NE CASSE RIEN : build vert, page qui s'affiche, humain qui ne
#    voit rien (le second `<h1>` est `hidden`, le titre ne vit que dans
#    l'onglet). *Ce qui n'a pas de lecteur humain n'a que des bancs pour
#    lecteurs* — donc ce banc doit etre devant la porte, pas seulement dans la
#    CI qui CONSTATE apres coup.
# ⚠️ APRES le build (il lit `dist/`), au meme endroit que `test:feuille`.
# ⭐ Il sort en rc=2 sous 100 pages de contenu : un vert qui n'a rien inspecte
#    est le plus cher de tous.
RUN WAREHOUSE_OFFLINE=1 npm run test:titres
# 🔴🔴🔴 `test:opacite` — LOT 111, ET C'EST LE PREMIER BANC QUI REGARDE CE QUI
#    S'AFFICHE PLUTOT QUE CE QUI EXISTE.
#    Le 09/08, Preda signale « le bouton menu ne fonctionne pas ». Il
#    fonctionnait : `.deplie__m` partait d'une `opacity:0` que rien ne rouvrait.
#    Le HTML etait juste, le script etait juste, la structure etait juste — et
#    les 27 bancs etaient verts. ⭐⭐⭐ UN ELEMENT TRANSPARENT PASSE TOUS LES
#    CONTROLES DE STRUCTURE : il est la, bien forme, au bon endroit.
#    A son PREMIER run il a trouve deux autres cas, dont un que personne
#    n'aurait jamais signale : les cartes de l'accueil etaient invisibles pour
#    qui a active « reduire les animations ».
#    ⚠️ Il lit `themes/` et `engine/lib/`, jamais `dist/` : il peut donc tourner
#    AVANT le build. Il est place ici pour rester avec les bancs de la feuille.
RUN WAREHOUSE_OFFLINE=1 npm run test:opacite
# 🔴🔴🔴 `test:tiroir` — LOT 139, ET C'EST LE FRERE DU PRECEDENT.
#    Le 11/08, Preda signale « sur petit ecran le menu lateral ne fonctionne
#    pas, il est si compacte qu'on ne peut pas l'utiliser ». Il fonctionnait :
#    il etait HAUT DE 64 PIXELS. `.site-h` porte `backdrop-filter`, et un
#    ancetre qui porte `backdrop-filter` (ou `transform`, `filter`,
#    `perspective`, `contain`, `will-change` sur l'une d'elles) DEVIENT le bloc
#    conteneur de ses descendants en `position:fixed`. `inset:0 auto 0 0` ne
#    visait donc pas la fenetre mais l'en-tete.
#    ⭐⭐⭐ MEME FAMILLE QUE LE 111, UN CRAN PLUS LOIN : le 111 regardait ce qui
#    s'AFFICHE plutot que ce qui EXISTE ; celui-ci regarde DANS QUELLE BOITE.
#    Rien dans `.deplie__m` n'est faux — la cause est chez un ancetre, et elle
#    n'a meme pas l'air d'etre une regle de position.
#    ⚠️ Il lit `themes/` ET `dist/` (l'ancetre reel, pas celui du gabarit) :
#    ⛔ il ne peut donc PAS tourner avant le build, contrairement a `test:opacite`.
RUN WAREHOUSE_OFFLINE=1 npm run test:tiroir
# 🟠 DETTE DU 07/08 RAMASSEE AU PASSAGE — `test:promesses` etait dans `npm test`
#    et PAS ici, seul des 27 dans ce cas. *Un garde-fou qui ne tourne pas en
#    production ne garde rien.* Il casse le build si `offer.url` se remplit
#    alors qu'un module `bientot: true` est attribue a un palier PAYANT.
RUN WAREHOUSE_OFFLINE=1 npm run test:promesses
# ═══════════════════════════════════════════════════════════════════════════
# 🖥️ `test:affichage` — LOT 118. APRES LE BUILD, et pour une seule raison.
# ═══════════════════════════════════════════════════════════════════════════
# Il n'importe PAS `dataset()` : il pourrait vivre n'importe ou. Mais son §2
# lit `dist/` — il verifie que les visuels des sets et des drops arrivent
# vraiment dans le HTML, ce qu'aucune lecture de gabarit ne peut dire (la cause
# du defaut n'etait pas dans le .astro : `rayonDe()` ne nommait pas `image`).
# ⭐ Sans `dist/`, il ecrit INDECIDABLE et ne passe pas au vert par defaut.
# ⛔ Ne pas le remonter avant le build « puisqu'il lit surtout des sources » :
#    on perdrait le seul controle qui regarde le PRODUIT.
RUN WAREHOUSE_OFFLINE=1 npm run test:affichage
# ═══════════════════════════════════════════════════════════════════════════
# 🔴🔴🔴 `test:marche` — LOT 125. LE BANC DE LA PAGE RENDUE A LA DEMANDE.
# MESURE DU 10/08 (serveur reel, curl) : 1ʳᵉ requete a /market/ = 10 440 ms,
# suivantes = 55 ms. Les 10 328 ms etaient `await dataset()` : la page
# retelechargeait 2,37 M de lignes de prix ET reecrivait `.reserve/cote/` dans
# le processus qui repond. Elle lit desormais `.reserve/marche.json`, depose au
# build. ⭐ Le soupcon d'origine — « 200 fichiers JSON par requete » — etait
# FAUX : ces lectures coutent 3 ms.
# ⛔ IL VA APRES `npm run build` : la projection qu'il verifie n'existe qu'apres.
# ⚠️ ET IL N'IMPORTE PAS `dataset.mjs` — sinon il recalculerait la vitrine et
#    VIDERAIT `.reserve/cote/`, la panne que le Dockerfile decrit plus haut.
RUN WAREHOUSE_OFFLINE=1 npm run test:marche
# 🧭🔴 `test:membre` — LOT 126. LE PARCOURS D'UN MEMBRE, DE BOUT EN BOUT.
# Quatre pannes, toutes deja payees ailleurs sur ce depot :
#   §1 `retourSur()` n'accepte que la liste blanche — 13 temoins hostiles,
#      dont la redirection ouverte `?suite=https://ailleurs.example/` ;
#   §2 tout `?suite=` ecrit a un LECTEUR (il n'en avait aucun depuis le lot
#      104 : parametre pose et jamais lu, la famille du lot 122) ;
#   §3 chaque route de compte est dans les TROIS endroits — ROUTES_COMPTE,
#      nginx, et un banc. L'oubli nginx = 404 sur build vert (lot 119) ;
#   §4 aucun `<button>` dans un `<a>` dans dist/ (`.carte` EST un `<a>`) ;
#   §5 le coeur est EMIS sur les cartes — `.socle__fav` etait stylee depuis le
#      lot 15 et n'avait aucun emetteur. Une regle CSS sans emetteur ne se voit
#      pas dans une feuille de 2 300 lignes.
# ⛔ IL VA APRES `npm run build` : les §4 et §5 lisent `dist/`.
# ⚠️ IL N'IMPORTE PAS `dataset.mjs` — il ne peut donc pas vider la reserve.
RUN WAREHOUSE_OFFLINE=1 npm run test:membre
# ═══════════════════════════════════════════════════════════════════════════
# 🔴 `test:fraicheur` — LOT 144 (B-5). IL LIT `dist/` : IL EST **ICI**.
# ═══════════════════════════════════════════════════════════════════════════
# L'invariant : aucune page publique ne peut afficher une date de fraicheur qui
# ne provienne pas de la donnee qu'elle decrit — et toute fiche sans date de
# relevement doit le DIRE, parce que le silence est indiscernable d'une donnee
# fraiche.
# ⛔ PLACE AVANT LE BUILD, IL SORTIRAIT INDECIDABLE, c'est-a-dire VERT SANS
# AVOIR MESURE : son §3 ouvre les fiches publiees une par une.
# ⭐⭐ IL COMPTE, IL NE DEDUIT PAS : il annonce combien de fiches il a ouvertes,
# combien portent une date, combien portent l'avertissement, et il EXIGE QUE LA
# SOMME FASSE LE TOTAL. Il compare aussi, fiche par fiche, la date du PIED a
# celle du bloc StackR — deux composants, une seule source.
# ⚠️ IL N'APPELLE PAS `dataset()` : seulement `indexerReleves()`, qui est pure.
# Il ne peut donc pas vider la reserve — la panne du lot 104, ou un banc a fait
# passer `.reserve/cote/` de 1 201 fichiers a 0 en rappelant `dataset()`.
RUN WAREHOUSE_OFFLINE=1 npm run test:fraicheur
# ⭐ LOT 144 (B-8) — `test:plages` lit `dist/` lui aussi (« ce banc va APRES
# npm run build », dit son propre code). Il n'arretait rien jusqu'ici.
RUN WAREHOUSE_OFFLINE=1 npm run test:plages
# 🔴🔴🔴 `test:pages` — LOT 124. IL LANCE LE SERVEUR ET DEMANDE LES PAGES.
# ═══════════════════════════════════════════════════════════════════════════
# LE 10/08, `/connexion/` et `/inscription/` ont rendu 500 (`ReferenceError`).
# Le build passait, les 31 bancs passaient — AUCUN NE REND CES PAGES : elles
# sont a la demande, donc absentes de `dist/`, donc invisibles a tout controle
# qui lit des fichiers. Le garde-fou de `docker-entrypoint.sh` les a testees au
# DEMARRAGE, a refuse de servir, et Coolify a arrete le conteneur au bout de
# 12 essais : **503 sur tout le site pendant une heure.**
# ⭐⭐⭐ *Une page qu'aucun banc ne demande n'est verifiee qu'en production.*
# ⭐ Ce banc pose la meme question ici, en 15 s, au lieu de la poser sur le VPS
#   apres quatre minutes de build.
# ⛔ IL VA APRES `npm run build` (il lui faut `dist/server/entry.mjs`), et il
#   ne recalcule RIEN : il parle a un serveur deja demarre, il ne peut donc pas
#   vider la reserve comme l'ont fait `test:fuite` (lot 101) et `test:rayon`
#   (lot 113).
# 📊🔴🔴 `test:analytics` — LOT 157. IL EST DANS LE DOCKERFILE PARCE QUE LA CI
# ═══════════════════════════════════════════════════════════════════════════
# CONSTATE ET N'EMPECHE PAS. `npm test` le chaine aussi, mais c'est CE fichier
# que le deploiement respecte : un banc absent d'ici ne bloque aucune mise en
# ligne.
# ⛔ IL VA APRES `npm run build` : il lit `dist/`. Avant, il se declarerait
#   INDECIDABLE — ce qu'il DIT, au lieu de passer au vert.
# ⭐⭐ CE QU'IL GARDE : les quatre pages de sujet sont `prerender = false` par
#   arbitrage de Preda. Oubliees dans `ROUTES_COMPTE`, elles seraient
#   PRE-GENEREES — quatre fichiers dans `dist/`, servis en clair par nginx,
#   avec le contenu que `franchit()` aurait laisse passer au build, et quatre
#   entrees de plus au sitemap. Le build resterait VERT.
#   *Un oubli qui rend muet se decouvre par une plainte ; un oubli qui rend
#   public ne se decouvre par rien.*
# ⚠️ IL NE LIT PAS `RENDERING`, ET C'EST DELIBERE : cette variable n'est PAS un
#   `ENV` de ce fichier — elle n'est exportee que dans le `RUN` du build. Un
#   banc qui s'y fierait se declarerait « sans objet » a chaque build, sur les
#   deux sites, en sortant 0. Il se cale sur `dist/server/entry.mjs`, que le
#   build PRODUIT.
RUN WAREHOUSE_OFFLINE=1 npm run test:analytics
RUN WAREHOUSE_OFFLINE=1 npm run test:pages
# 🐌🔴 `test:tuiles` — LOT 127. LE POIDS DE `/market/`, ET LE PREMIER BANC QUI
# ═══════════════════════════════════════════════════════════════════════════
# EXECUTE LE SCRIPT DE LA PAGE.
# MESURE DU 10/08 (serveur reel, session simulee, curl) : la page pesait
# 1 066 071 o NON compresses, dont 374 450 o (35,1 %) pour les MEMES 200 pieces
# rendues une seconde fois en tuiles `hidden`, et 135 699 o pour 600 `<svg>`
# dessinant SIX geometries. 47,8 % de la page etait de la repetition.
# ⚠️ gzip ramenait tout ca a ~80 Ko : le fil n'a jamais souffert, c'est le DOM
#   qui payait. ⇒ CE BANC MESURE LES OCTETS SERVIS ET LE NOMBRE DE NOEUDS,
#   jamais la taille compressee.
# ⭐⭐⭐ ET IL JOUE LE `<script is:inline>` DE LA PAGE DANS UN VRAI DOM. Sans
#   ca il serait vert le jour ou la vue Tuiles rend une grille VIDE : moins
#   d'octets, plus de fonction — l'instrument qui recompense la regression
#   qu'on craint. Il clique « Tuiles », coche une rarete, et exige que la
#   grille montre les memes pieces que le tableau.
# ⛔ IL VA APRES `npm run build` : il lui faut `dist/server/entry.mjs`.
# ⛔ IL LEVE UN FAUX `SESSION_API` : sans session `/market/` repond 302, et
#   `test:pages` ne l'atteint donc JAMAIS. Deux bancs demandent la meme
#   adresse et n'y voient pas la meme chose.
# ⚠️ IL N'IMPORTE PAS `dataset.mjs` — il ne peut pas vider la reserve.
RUN WAREHOUSE_OFFLINE=1 npm run test:tuiles
# 🆕 LOT 143 — TROIS BANCS QUI VIVAIENT HORS DE CETTE PORTE.
# Mesure du 12/08 : `npm test` chaine 41 bancs, ce Dockerfile en lancait 31.
# Les dix absents tournent en CI et n'y ARRETENT rien : la CI constate, seul le
# Dockerfile empeche. Un banc vert dans un onglet pendant qu'une image part en
# production est un banc decoratif.
# ⛔ ILS VONT APRES LE BUILD, comme `test:tuiles` juste au-dessus : les trois
#   lisent `dist/`. Place avant, `test:series` ne trouverait pas la page des
#   sets et sortirait INDECIDABLE — c'est-a-dire vert, sans avoir rien mesure.
# ⭐ `test:series` garde le lot 143 : depuis ce lot les puces des filtres ne
#   sont plus servies, elles se construisent a l'ouverture du panneau. Le banc
#   ouvre le panneau et exige que chaque valeur proposee existe sur une carte,
#   et l'inverse. Sans cette ligne, personne n'arreterait leur disparition.
# ⚠️ `test:indexnow` n'a besoin ni de `dist/` ni du reseau — il rejoue son
#   `main()` sur un faux sitemap. Il est ici par commodite de lecture, pas par
#   dependance : le deplacer plus haut ne casserait rien.
RUN WAREHOUSE_OFFLINE=1 npm run test:series
RUN WAREHOUSE_OFFLINE=1 npm run test:tableau
RUN npm run test:indexnow
# 🌍🔴 `test:i18n` — LOT 129. L'ECHANGE DES LIBELLES, JOUE POUR DE VRAI.
# Preda, 10/08 : « la langue est un coup en anglais, un coup en francais. »
# Les 3 097 pages publiques sont pre-generees en ANGLAIS et pre-compressees :
# au moment ou elles se fabriquent, il n'y a personne a qui demander sa langue.
# Un script les traduit chez le visiteur.
# ⭐⭐⭐ CE BANC N'EN COMPTE PAS LES ATTRIBUTS, IL JOUE LE SCRIPT. Compter des
# `data-i18n` est facile et ne prouve RIEN : dix mille attributs corrects ne
# disent pas qu'un seul mot change a l'ecran. Il monte la page la plus marquee
# dans un DOM, pose le cookie, sert le dictionnaire, execute le script de
# `Base.astro` TEL QUEL, et lit ce que la page dit ensuite.
# ⛔ Quatre pannes gardees : une sentinelle survivante (invisible a l'oeil), un
#   marquage qui deborde sur le SEO (<title>, <meta>), un dictionnaire servi qui
#   ne couvre pas ce qui est marque, et l'echange qui n'echange pas.
# ⛔ IL VA APRES `npm run marquer:i18n` : il lit ce que le post-traitement a ecrit.
RUN WAREHOUSE_OFFLINE=1 npm run test:i18n

# --- Precompression : le seul gain de vitesse qui restait ------------------
# ⭐⭐ POURQUOI PRECOMPRESSER, PLUTOT QUE DE MONTER LE NIVEAU DE gzip.
# `nginx.conf` declarait `gzip on` sans `gzip_comp_level` : nginx compressait
# donc AU NIVEAU 1, a la volee, a chaque requete, sur chacune des ~8 500 pages.
# Precompresser au build donne les deux a la fois : la compression MAXIMALE
# (fichiers plus petits) ET zero seconde de CPU par requete.
# ⚠️ 🔴 « maximale » et PAS « niveau 9 » : mesure le 24/08, busybox rend le MEME
#    fichier a `-1` et a `-9` — il ignore le niveau et compresse toujours au
#    plus fort. Le gain vient de PRECOMPRESSER, jamais du chiffre. `gzip_static on` sert le `.gz`
# quand il existe ; `gzip on` reste en second rideau pour le reste.
#
# ⚠️ On ne compresse QUE ce qui se compresse. Un .png ou un .woff2 sont deja
#    compresses : produire leur `.gz` gaspillerait du disque pour un fichier
#    plus GROS que l'original.
# ⚠️ En mode serveur on ne touche qu'a dist/client : dist/server est du code
#    que Node execute, nginx ne le sert jamais.
# ⚠️ Le seuil de 512 octets est le MEME que `gzip_min_length` : en dessous,
#    l'en-tete de compression coute plus que ce qu'elle economise.
#
# 🔴 UN GARDE-FOU QUI NE TOURNE PAS NE GARDE RIEN — d'ou le controle `n > 0` a
#    la fin de cette etape. Sans lui, une precompression qui ne produit rien
#    laisserait `gzip_static` sans fichier a servir : le site resterait
#    parfaitement valide, simplement plus lent, et rien ne le dirait.
# ⚠️ AUCUN COMMENTAIRE A L'INTERIEUR DE CE `RUN` : dans une continuation de
#    ligne, un `#` est lu par le parseur Dockerfile, pas par le shell.
# ⚠️ NI `find -printf`, NI `find -delete`, NI `stat -c` : ce sont des extensions
#    GNU, et l'image est une ALPINE (busybox). Elles rendraient une erreur au
#    build, pas un zero. (Mesure du 24/08 : busybox 1.30 refuse les trois.)
#
# ═══════════════════════════════════════════════════════════════════════════
# 🔴🔴 LOT 161 — CETTE ETAPE FAISAIT DEUX FOIS LE TRAVAIL NECESSAIRE
# ═══════════════════════════════════════════════════════════════════════════
# MESURE DU 24/08/2026, busybox, 13 000 fichiers / 763 Mo, meme resultat a
# l'octet pres (162 071 000 octets de `.gz` dans les deux cas) :
#
#   compression   `-exec sh -c 'gzip -c > .gz'`  23,3 s  ->  `xargs gzip -k`  14,8 s
#   total AVANT   `-exec cat {} + | wc -c`        2,91 s  ->  `ls -ln | awk`   0,06 s
#   total APRES   idem                            ~2,9 s  ->  idem            ~0,06 s
#   ────────────────────────────────────────────────────────────────────────
#   l'etape                                      29,1 s  ->                  14,9 s
#
# DEUX CAUSES, ET AUCUNE N'ETAIT LA COMPRESSION ELLE-MEME :
#   ① `-exec sh -c '…' _ {} \;` lance DEUX processus PAR FICHIER — un `sh` puis
#      un `gzip` — soit ~26 000 processus. `xargs` en lance UN PAR LOT de
#      quelques milliers. ⭐ `gzip -k` (garder l'original) rend le `sh`
#      inutile : c'est lui qui permet de passer les fichiers en vrac.
#   ② les deux totaux RELISAIENT TOUT LE CONTENU DEPUIS LE DISQUE — 762 Mo puis
#      162 Mo — POUR ECRIRE UNE LIGNE DE JOURNAL. `ls -ln` lit la taille dans
#      l'inode, sans ouvrir un seul fichier. ⭐⭐ *Une mesure ne doit pas couter
#      plus cher que ce qu'elle mesure.*
#
# ⛔ PAS DE `xargs -P` : busybox ne l'a pas (verifie, il n'est pas dans son
#    usage). Et le VPS a DEUX c/urs SANS SWAP — un parallelisme y a deja fait
#    tuer des deploiements. On ne l'echange pas contre 7 secondes.
# ⚠️ CE CORRECTIF NE GUERIT PAS LA VARIABILITE. Le meme travail a pris 72 s,
#    77 s, 322 s et plus de 720 s le MEME JOUR : ca, c'est la machine (deux
#    apps Coolify qui se chevauchent), pas la forme du code. Ici on divise le
#    travail par deux ; on ne rend pas la duree previsible.
# ⚠️ `-9` NE SERT A RIEN SUR BUSYBOX — mesure : `-1` et `-9` rendent le MEME
#    fichier, a l'octet. Busybox compresse toujours au maximum (12 467 o la ou
#    GNU `-9` en fait 12 477). On le garde : inoffensif, et exact le jour ou
#    l'image porterait le vrai `gzip`. ⛔ Mais le commentaire ci-dessus ne doit
#    plus dire que c'est `-9` qui donne la petite taille : c'est busybox.
# 🔴 `gzip -k` EST TESTE AVANT D'ETRE UTILISE. Il n'existe pas dans les vieux
#    busybox : sans ce test, une image de base plus ancienne ferait echouer
#    l'etape entiere. Le repli est l'ancienne forme, plus lente et sure.
RUN set -e; \
    node engine/lib/chrono_build.mjs precompression; \
    MODE=$(cat /app/.rendering); \
    if [ "$MODE" = "server" ]; then RACINE=dist/client; else RACINE=dist; fi; \
    liste() { R="$1"; shift; find "$R" -type f \( -name '*.html' -o -name '*.css' \
        -o -name '*.js' -o -name '*.mjs' -o -name '*.xml' -o -name '*.json' \
        -o -name '*.svg' -o -name '*.txt' \) -size +512c "$@"; }; \
    poids() { xargs -0 ls -ln 2>/dev/null | awk '{s+=$5} END{print s+0}'; }; \
    avant=$(liste "$RACINE" -print0 | poids); \
    echo test > /tmp/.k && gzip -k /tmp/.k 2>/dev/null && KOK=1 || KOK=0; \
    rm -f /tmp/.k /tmp/.k.gz; \
    if [ "$KOK" = "1" ]; then \
      liste "$RACINE" -print0 | xargs -0 gzip -9 -k; \
    else \
      echo "gzip -k absent : repli sur l'ancienne forme, plus lente"; \
      liste "$RACINE" -exec sh -c 'gzip -9 -c "$1" > "$1.gz"' _ {} \; ; \
    fi; \
    n=$(find "$RACINE" -name '*.gz' -type f | wc -l); \
    apres=$(find "$RACINE" -name '*.gz' -type f -print0 | poids); \
    [ "$n" -gt 0 ] || { echo "ERREUR: aucune ressource precompressee"; exit 1; }; \
    echo "precompression : $n fichier(s), $avant -> $apres octets"

# --- Audit SEO : SORTI DU BUILD LE 03/08/2026 ------------------------------
# ⛔⛔ IL N'EST PLUS ICI, ET C'EST UN GAIN, PAS UNE PERTE.
#
# CE QU'IL COUTAIT. Il charge TOUT le HTML en memoire d'un coup (~8 500 pages,
# une fiche veveprice pese ~146 Ko : l'ordre de grandeur est le GIGAOCTET
# resident), puis refait huit passes de regex dessus. Place APRES la
# precompression, son second parcours (`rglob('*')`) voit en plus les 7 887
# `.gz`. Mesure du 03/08 : le deploiement etait encore a l'etape 25/25 apres
# 25 MINUTES.
#
# ⭐⭐ ET IL NE GARDAIT RIEN. Son `|| true` avale le code de sortie — il ne peut
# donc rien bloquer — et son rapport se perd dans les logs Coolify, que
# personne ne relit. Un controle dont le resultat n'est lu NULLE PART ne garde
# rien : il ne fait que payer. On ne l'a jamais vu parce qu'il n'a jamais eu a
# se justifier, faute d'echouer.
# ⚠️ Personne n'avait mesure sa duree. Un instrument dont on ignore le cout est
# un instrument qu'on ne peut pas arbitrer.
#
# ➡️ IL VIT DESORMAIS DANS `.github/workflows/audit-seo.yml`, une fois par
# nuit, et son rapport devient un ARTEFACT telechargeable — c'est-a-dire un
# rapport qui a enfin un lecteur. Le deplacer ne l'affaiblit pas : ca lui rend
# la seule chose qui lui manquait.
# ⛔ NE PAS le remettre ici « pour ne pas l'oublier » : le remettre, c'est
# reprendre 25 minutes par deploiement pour un texte que personne n'ouvre.

# --- Etape 2 : service web (les deux modes) ---
FROM node:22-alpine AS runtime
RUN apk add --no-cache nginx && mkdir -p /run/nginx
WORKDIR /app
ARG SITE=veveprice
ARG SITE_URL=https://veveprice.com
# ⚠️ NI HOST NI PORT ICI — VOLONTAIREMENT.
# La plateforme (Coolify) injecte les siens au demarrage du conteneur et ils
# ecrasent tout ENV pose ici. Les declarer donnerait l'illusion de les
# controler. Le lanceur les FORCE au moment de lancer Node (127.0.0.1:4321),
# ou personne ne peut plus les ecraser. Node n'est ainsi joignable que par
# nginx : une seule porte d'entree, donc un seul jeu d'en-tetes.
ENV NODE_ENV=production SITE=$SITE SITE_URL=$SITE_URL
# ═══════════════════════════════════════════════════════════════════════════
# ❤️ LOT 140-3 — LE DOSSIER DES FAVORIS, ET LA LIGNE QUI N'EST PAS ECRITE
# ═══════════════════════════════════════════════════════════════════════════
# La base SQLite des favoris (engine/lib/favoris.mjs, `node:sqlite`, integre a
# Node 22 — aucune dependance ajoutee, package-lock.json ne bouge pas) vit ici.
#
# 🔴🔴 PAS DE `VOLUME ["/data"]`, ET C'EST VOLONTAIRE — recette reprise mot pour
# mot du Dockerfile de veveid (l. 47-60), qui porte le meme avertissement.
# Sans cette ligne, un `/data` non monte reste un simple dossier de l'image :
# la sonde `/api/sante` le voit et le DIT (`favoris.montee: false`). Avec elle,
# Docker cree un volume ANONYME au demarrage — la base survivrait au
# redemarrage et mourrait au redeploiement. ⭐ Le pire des deux mondes est
# celui qui a l'air de marcher.
#
# ⚠️ LE VOLUME COOLIFY EST CREE COTE PLATEFORME (12/08, avec Preda) et se
# montera au deploiement de ce lot. ⭐⭐⭐ L'ORDRE EST UNE DONNEE : cree APRES
# le premier deploiement, il masquerait un dossier deja ecrit et remettrait la
# base a zero — une seconde perte, plus discrete que la premiere.
RUN mkdir -p /data
ENV DB_PATH=/data/veve-favoris.db
COPY --from=build /app/.rendering ./.rendering
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
# Le rendu a la demande relit le manifeste et le moteur : ils doivent etre la.
COPY --from=build /app/engine ./engine
COPY --from=build /app/sites ./sites
# ⭐⭐ LA RESERVE — l'historique COMPLET, ecrit au build par engine/lib/reserve.mjs.
# ⛔ ELLE N'EST PAS DANS dist/, ET C'EST TOUT L'INTERET : nginx sert dist/ (ou
# dist/client) comme racine, donc il ne peut pas la servir, meme par accident.
# Seul Node la lit, et seulement apres que /api/historique/[uuid] a reconnu un
# palier. La copier ici est ce qui la rend lisible par Node.
# 🔴 SI CETTE LIGNE DISPARAIT, RIEN N'ECHOUE : le site se deploie, il est vert,
# et TOUTES les fiches restent muettes pour les abonnes. D'ou le controle qui
# suit — un garde-fou pose APRES la coupe qu'il surveille.
# ⚠️ `[^/]*` : le dossier commence par un point, et `COPY /app/.reserve` sur une
# source absente fait echouer le build avec un message clair. C'est voulu : une
# reserve vide doit arreter le deploiement, pas le laisser passer.
# 🔴🔴 LOT 101 — DEUX RESERVES, DEUX COMPTES, ET C'EST OBLIGATOIRE.
# Ce controle comptait `find .reserve -name '*.json'`, c'est-a-dire TOUT le
# dossier. En y ajoutant `.reserve/cote/`, ce total serait devenu positif meme
# avec ZERO historique : le garde-fou de l'historique se serait tu TOUT SEUL,
# sans qu'une ligne le concernant ne change, et personne n'aurait pu le relier
# au lot qui l'a eteint.
# ⭐⭐⭐ UN CONTROLE QUI AGREGE DEUX POPULATIONS MESURE LEUR SOMME, PAS CHACUNE —
# et c'est toujours la plus petite qui disparait dedans. On compte les deux
# separement, et on exige les deux.
# ⭐ La cote vide est aussi grave que l'historique vide, et plus difficile a
# voir : le site s'affiche parfaitement, seuls LES ABONNES ne voient plus aucun
# prix. Un deploiement vert qui ne casse que pour ceux qui paient.
# ⏱️🔴🔴🔴 LOT 214 — LE CHRONO DU BUILD VOYAGE DANS L'IMAGE.
# ⛔ IL N'EST PAS DANS `.reserve/`, ET C'ETAIT UNE ERREUR DE PREMIER JET :
# `engine/lib/reserve.mjs` l. 98 fait `rmSync(RESERVE_DIR, recursive)` PENDANT
# le build. Le temoin et le rapport memoire y survivent parce qu'ils sont ecrits
# APRES cette ligne ; le chrono, lui, pose son premier jalon AVANT le build — il
# aurait ete efface, et `/api/sante` aurait servi un chrono commencant au
# milieu, sans qu'aucun banc ne rougisse. D'ou la racine, hors de tout dossier
# que quelqu'un nettoie.
# ⚠️ `.chrono.json` EXISTE TOUJOURS : le jalon `debut` est pose au tout premier
# `RUN` de l'etape de construction. Un `COPY` sur une source absente ferait
# echouer le build — et ce serait la bonne reaction : un instrument disparu doit
# se voir, pas se taire.
COPY --from=build /app/.chrono.json ./.chrono.json
COPY --from=build /app/.reserve ./.reserve
RUN set -e; \
    node engine/lib/chrono_build.mjs image; \
    MODE=$(cat /app/.rendering); \
    if [ "$MODE" = "server" ]; then \
      n=$(find .reserve/historique -name '*.json' 2>/dev/null | wc -l); \
      nc=$(find .reserve/cote -name '*.json' 2>/dev/null | wc -l); \
      if [ "${RESERVE_OFF:-0}" = "1" ]; then \
        echo "⚠️ RESERVE_OFF=1 : les reserves sont VOLONTAIREMENT desactivees."; \
        echo "   /api/historique/[uuid] ET /api/cote/[uuid] rendront 404 pour TOUT LE MONDE."; \
        echo "   ⛔ C'est un CONTOURNEMENT, pas un reglage : le retirer des que la cause est connue."; \
      else \
        [ "$n" -gt 0 ] || { echo "ERREUR: mode server mais la reserve d'HISTORIQUE est VIDE — les abonnes n'auraient aucun historique"; exit 1; }; \
        [ "$nc" -gt 0 ] || { echo "ERREUR: mode server mais la reserve de COTE est VIDE — les abonnes ne verraient AUCUN prix, sur un site parfaitement vert"; exit 1; }; \
      fi; \
      echo "reserve : $n fiche(s) d'historique complet, hors de dist/"; \
      echo "cotes   : $nc fiche(s) de prix courant, hors de dist/"; \
    fi
# Les deux configurations voyagent dans l'image ; le lanceur choisit.
COPY nginx.conf nginx.server.conf ./
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
CMD ["/docker-entrypoint.sh"]
