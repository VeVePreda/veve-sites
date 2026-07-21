#!/bin/sh
# LANCEUR — le MANIFESTE decide du mode, ce script l'applique et le VERIFIE.
#
#   static : nginx seul, sur dist/
#   server : nginx (port 80) devant Node (127.0.0.1:4321), sur dist/client
#
# ⭐ CE FICHIER EST SURTOUT UN CONTROLE DE DEMARRAGE.
# Je n'ai pas de nginx dans mon bac a sable : la verification a donc ete
# deplacee LA OU ELLE COMPTE — a chaque demarrage, et A TRAVERS nginx.
# Si quelque chose ne va pas, le conteneur REFUSE DE VIVRE au lieu de servir un
# site « valide, seulement faux ». Coolify le montre immediatement.
set -eu

MODE=$(cat /app/.rendering 2>/dev/null || echo static)
CONF=/etc/nginx/http.d/default.conf
RACINE_WEB=/usr/share/nginx/html

echec() { echo "[demarrage] ECHEC : $*" >&2; exit 1; }

case "$MODE" in
  server) SOURCE=/app/nginx.server.conf; CONTENU=/app/dist/client ;;
  static) SOURCE=/app/nginx.conf;        CONTENU=/app/dist ;;
  *) echec "mode inconnu dans .rendering : « $MODE »" ;;
esac
echo "[demarrage] mode « $MODE » (lu dans le manifeste au moment du build)"

[ -d "$CONTENU" ] || echec "$CONTENU introuvable — l'image ne correspond pas au mode annonce"

# Les deux modes servent depuis la MEME racine ; seul ce lien change.
rm -rf "$RACINE_WEB"
ln -s "$CONTENU" "$RACINE_WEB"
mkdir -p /etc/nginx/http.d
cp "$SOURCE" "$CONF"

# --- Garde-fou anti-divergence des deux configurations ----------------------
# Le proxy /stats/ porte l'anti-empreinte du reseau : le visiteur ne voit jamais
# l'adresse du serveur de statistiques. Son oubli casserait la mesure d'audience
# SANS AUCUN SIGNAL, en repondant 200 partout.
grep -q "location \^~ /stats/" "$CONF" || echec "le proxy /stats/ a disparu de $SOURCE — la mesure d'audience serait morte, et l'anti-empreinte avec"

nginx -t || echec "configuration nginx invalide (voir ci-dessus)"

# --- Node d'abord, si le mode l'exige ---------------------------------------
NODE_PID=""
if [ "$MODE" = "server" ]; then
  [ -f /app/dist/server/entry.mjs ] || echec "dist/server/entry.mjs introuvable — image construite en mode statique ?"
  # 🔴 HOTE ET PORT FORCES ICI, ET NON HERITES DE L'ENVIRONNEMENT.
  # Coolify injecte ses propres HOST et PORT au demarrage du conteneur, et ils
  # ECRASENT les ENV du Dockerfile. Constate en production le 21/07/2026 :
  # « [@astrojs/node] Server listening on http://localhost:80 » — Node prenait
  # le port de nginx, nginx ne demarrait pas, et le conteneur bouclait.
  # Le port 4321 est INTERNE : il ne doit dependre de personne d'autre que de
  # ce fichier et de nginx.server.conf, qui sont livres ensemble.
  HOST=127.0.0.1 PORT=4321 RENDERING=server node /app/dist/server/entry.mjs &
  NODE_PID=$!
  i=0
  while [ "$i" -lt 30 ]; do
    wget -q -O /dev/null "http://127.0.0.1:4321/api/sante" 2>/dev/null && break
    i=$((i + 1)); sleep 1
  done
  if [ "$i" -ge 30 ]; then
    # Diagnostic : si Node repond ailleurs, on le DIT au lieu de laisser
    # chercher. Une panne qui s'explique elle-meme coute une minute ;
    # une panne muette coute une soiree.
    if wget -q -O /dev/null "http://127.0.0.1:80/api/sante" 2>/dev/null; then
      echec "Node a pris le PORT 80 (celui de nginx) : HOST/PORT ont ete ecrases par la plateforme. Ils doivent etre forces au lancement, dans ce fichier."
    fi
    echec "Node n'a pas repondu sur 4321 en 30 s"
  fi
  echo "[demarrage] Node repond sur 4321"
fi

nginx -g 'daemon off;' &
NGINX_PID=$!

# --- Le controle qui compte : A TRAVERS nginx, sur le port 80 ---------------
i=0
while [ "$i" -lt 20 ]; do
  wget -q -O /dev/null "http://127.0.0.1:80/" 2>/dev/null && break
  i=$((i + 1)); sleep 1
done
[ "$i" -lt 20 ] || echec "nginx ne sert pas la racine sur le port 80"

# /api/sante existe dans les deux modes : fichier pre-genere en statique,
# calcule par Node en serveur. Sa reponse doit CORRESPONDRE au mode annonce.
SANTE=$(wget -q -O - "http://127.0.0.1:80/api/sante" 2>/dev/null || echo '')
case "$SANTE" in
  '') echec "/api/sante ne repond pas a travers nginx" ;;
  *"\"mode\":\"$MODE\""*) echo "[demarrage] /api/sante traverse nginx et confirme le mode : $SANTE" ;;
  *) echec "/api/sante annonce un mode different de « $MODE » : $SANTE" ;;
esac

if [ "$MODE" = "server" ]; then
  echo "[demarrage] ✅ nginx (80) devant Node (4321), pages pre-generees servies par nginx"
else
  echo "[demarrage] ✅ nginx (80) seul, site entierement pre-genere"
fi

# --- Surveillance : si l'un meurt, tout meurt --------------------------------
# 🔴 Sans ca, un Node mort passerait inapercu derriere un nginx bien vivant :
# les pages continueraient de s'afficher et seules les routes dynamiques
# tomberaient. C'est exactement le genre de panne qu'on ne voit pas.
arreter() { kill -TERM $NGINX_PID ${NODE_PID:-} 2>/dev/null || true; }
trap 'arreter; exit 0' TERM INT

while kill -0 "$NGINX_PID" 2>/dev/null; do
  if [ -n "$NODE_PID" ] && ! kill -0 "$NODE_PID" 2>/dev/null; then
    echo "[demarrage] Node s'est arrete — on coupe nginx pour que le redemarrage soit visible" >&2
    arreter; exit 1
  fi
  sleep 2
done
echo "[demarrage] nginx s'est arrete — on coupe tout" >&2
arreter
exit 1
