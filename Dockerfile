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
RUN WAREHOUSE_OFFLINE=1 npm run test:donnees
# Verifie qu'aucun type n'est evince de la vitrine (le 18/07 la prod a
# publie 400 fiches et ZERO comic sans qu'aucun controle ne s'en plaigne).
RUN WAREHOUSE_OFFLINE=1 npm run test:quotas
# Verifie que les paliers d'acces sont lus par la matrice, et par elle seule.
RUN WAREHOUSE_OFFLINE=1 npm run test:acces

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
RUN WAREHOUSE_OFFLINE=1 npm run test:renommage

RUN export RENDERING=$(cat /app/.rendering); npm run build

# 🔴 LE GARDE-FOU : le mode annonce et la forme produite doivent coincider.
# Sans lui, l'incoherence se decouvre en production, en servant des pages
# muettes — et rien dans les logs ne l'annonce.
RUN set -e; MODE=$(cat /app/.rendering); \
    if [ "$MODE" = "server" ]; then \
      test -f dist/server/entry.mjs || { echo "ERREUR: rendering:server mais pas de dist/server/entry.mjs — adaptateur Node absent ?"; exit 1; }; \
      test -d dist/client || { echo "ERREUR: rendering:server mais pas de dist/client — les pages pre-generees ont disparu"; exit 1; }; \
      echo "mode server : $(find dist/client -name index.html | wc -l) pages pre-generees + un serveur Node"; \
    else \
      test -f dist/index.html || { echo "ERREUR: rendering:static mais pas de dist/index.html"; exit 1; }; \
      test ! -d dist/server || { echo "ERREUR: rendering:static mais un dist/server existe — nginx servirait la mauvaise arborescence"; exit 1; }; \
      echo "mode static : $(find dist -name index.html | wc -l) pages"; \
    fi

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

RUN apk add --no-cache python3 >/dev/null && python3 engine/tools/audit_seo.py dist || true

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
# Les deux configurations voyagent dans l'image ; le lanceur choisit.
COPY nginx.conf nginx.server.conf ./
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
CMD ["/docker-entrypoint.sh"]
