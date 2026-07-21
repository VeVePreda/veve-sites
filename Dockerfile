# IMAGE A DEUX MODES — pilotee par RENDERING.
#
#   RENDERING=static  (defaut)  -> nginx sert des fichiers. C'est l'existant.
#   RENDERING=server            -> Node sert les MEMES pages pre-generees,
#                                  plus les routes a la demande (comptes...).
#
# ⚠️ POURQUOI CE FICHIER A CHANGE. `astro.config.mjs` connaissait deja
# `RENDERING` et annoncait « comptes, donnees live » — mais l'image finale etait
# TOUJOURS nginx. Passer RENDERING=server produisait un bundle serveur que
# personne ne lancait, et nginx servait un repertoire qui n'avait plus la forme
# attendue. Ca ne plantait pas : ca servait autre chose. Encore la meme famille
# de defaut — un reglage pose a un endroit, ignore a un autre, sans erreur.
#
# 🔴 EN MODE SERVER, LE PORT CHANGE : 80 (nginx) -> 4321 (Node).
#    A reporter dans Coolify, sinon le conteneur tourne et rien ne repond.

# ARG global : seul un ARG declare AVANT le premier FROM est utilisable dans un
# FROM. C'est ce qui permet de choisir l'etape finale.
ARG RENDERING=static

# --- Etape 1 : construction du site ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY . .
# Quel site construire (un manifeste par site dans sites/)
ARG SITE=veveprice
ARG SITE_URL=https://veveprice.com
ARG RENDERING
ENV SITE=$SITE SITE_URL=$SITE_URL RENDERING=$RENDERING
# Marge de securite : le catalogue et l'historique grandissent avec le temps.
ENV NODE_OPTIONS=--max-old-space-size=3072
# Verifie que le jeu de donnees n'est construit qu'UNE fois (sinon le build
# lit le fichier de prix autant de fois qu'il y a de routes -> panne memoire).
RUN WAREHOUSE_OFFLINE=1 npm run test:donnees
# Verifie qu'aucun type n'est evince de la vitrine (le 18/07 la prod a
# publie 400 fiches et ZERO comic sans qu'aucun controle ne s'en plaigne).
RUN WAREHOUSE_OFFLINE=1 npm run test:quotas
# Verifie que les paliers d'acces sont lus par la matrice, et par elle seule.
RUN WAREHOUSE_OFFLINE=1 npm run test:acces
RUN npm run build

# 🔴 LE GARDE-FOU QUI MANQUAIT : le mode demande et la forme produite doivent
# coincider. Sans lui, l'incoherence se decouvre en production, en servant des
# pages muettes — et rien dans les logs ne l'annonce.
RUN if [ "$RENDERING" = "server" ]; then \
      test -f dist/server/entry.mjs || { echo "ERREUR: RENDERING=server mais pas de dist/server/entry.mjs — adaptateur Node absent ?"; exit 1; }; \
      test -d dist/client || { echo "ERREUR: RENDERING=server mais pas de dist/client — les pages pre-generees ont disparu"; exit 1; }; \
      echo "mode server : $(find dist/client -name index.html | wc -l) pages pre-generees + un serveur Node"; \
    else \
      test -f dist/index.html || { echo "ERREUR: RENDERING=static mais pas de dist/index.html"; exit 1; }; \
      test ! -d dist/server || { echo "ERREUR: RENDERING=static mais un dist/server existe — nginx servirait la mauvaise arborescence"; exit 1; }; \
      echo "mode static : $(find dist -name index.html | wc -l) pages"; \
    fi

RUN apk add --no-cache python3 >/dev/null && python3 engine/tools/audit_seo.py dist || true

# --- Etape 2a : service web STATIQUE (nginx) — inchange ---
FROM nginx:alpine AS runtime-static
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

# --- Etape 2b : service web SERVEUR (Node) ---
# Sert les memes pages pre-generees depuis dist/client, plus les routes
# marquees `prerender = false`.
FROM node:22-alpine AS runtime-server
WORKDIR /app
ARG SITE=veveprice
ARG SITE_URL=https://veveprice.com
# SITE est indispensable AU RUNTIME : sans lui, manifest() retomberait sur le
# site par defaut et servirait la mauvaise marque — silencieusement.
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321 \
    SITE=$SITE SITE_URL=$SITE_URL RENDERING=server
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
# Le rendu a la demande relit le manifeste et le moteur : ils doivent etre la.
COPY --from=build /app/engine ./engine
COPY --from=build /app/sites ./sites
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]

# --- Etape finale : celle que RENDERING designe ---
FROM runtime-${RENDERING} AS final
