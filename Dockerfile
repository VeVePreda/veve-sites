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
RUN set -e; export RENDERING=$(cat /app/.rendering); npm run build && mkdir -p /app/.reserve

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
RUN WAREHOUSE_OFFLINE=1 npm run test:pages

# --- Precompression : le seul gain de vitesse qui restait ------------------
# ⭐⭐ POURQUOI PRECOMPRESSER, PLUTOT QUE DE MONTER LE NIVEAU DE gzip.
# `nginx.conf` declarait `gzip on` sans `gzip_comp_level` : nginx compressait
# donc AU NIVEAU 1, a la volee, a chaque requete, sur chacune des ~8 500 pages.
# Precompresser au build donne les deux a la fois : le niveau 9 (fichiers plus
# petits) ET zero seconde de CPU par requete. `gzip_static on` sert le `.gz`
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
# ⚠️ NI `find -printf` NI `stat -c` : ce sont des extensions GNU, et l'image est
#    une ALPINE (busybox). Elles rendraient une erreur au build, pas un zero.
RUN set -e; \
    MODE=$(cat /app/.rendering); \
    if [ "$MODE" = "server" ]; then RACINE=dist/client; else RACINE=dist; fi; \
    avant=$(find "$RACINE" -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' \
        -o -name '*.mjs' -o -name '*.xml' -o -name '*.json' -o -name '*.svg' \
        -o -name '*.txt' \) -size +512c -exec cat {} + | wc -c); \
    find "$RACINE" -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' \
        -o -name '*.mjs' -o -name '*.xml' -o -name '*.json' -o -name '*.svg' \
        -o -name '*.txt' \) -size +512c \
      -exec sh -c 'gzip -9 -c "$1" > "$1.gz"' _ {} \; ; \
    n=$(find "$RACINE" -name '*.gz' -type f | wc -l); \
    apres=$(find "$RACINE" -name '*.gz' -type f -exec cat {} + | wc -c); \
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
COPY --from=build /app/.reserve ./.reserve
RUN set -e; \
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
