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
RUN npm run build

# --- Etape 2 : service web ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
