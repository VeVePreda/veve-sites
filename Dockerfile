# --- Etape 1 : construction du site ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY . .
# Quel site construire (un manifeste par site dans sites/)
ARG SITE=veveprice
ARG SITE_URL=https://veveprice.com
ARG RENDERING=static
ENV SITE=$SITE SITE_URL=$SITE_URL RENDERING=$RENDERING
# Marge de securite : le catalogue et l'historique grandissent avec le temps.
ENV NODE_OPTIONS=--max-old-space-size=3072
# Verifie que le jeu de donnees n'est construit qu'UNE fois (sinon le build
# lit le fichier de prix autant de fois qu'il y a de routes -> panne memoire).
RUN WAREHOUSE_OFFLINE=1 npm run test:donnees
RUN npm run build
RUN apk add --no-cache python3 >/dev/null && python3 engine/tools/audit_seo.py dist || true

# --- Etape 2 : service web ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
