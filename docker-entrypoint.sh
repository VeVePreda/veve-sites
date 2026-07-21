#!/bin/sh
# LANCEUR DU MODE SERVEUR — nginx (port 80) devant Node (port 4321 interne).
#
# ⭐ CE FICHIER EST SURTOUT UN CONTROLE DE DEMARRAGE.
# Je n'ai pas pu eprouver la configuration nginx avant livraison (pas de nginx
# dans mon bac a sable). La verification a donc ete deplacee LA OU ELLE COMPTE :
# a chaque demarrage du conteneur, et A TRAVERS nginx — pas a cote.
# Si quelque chose ne va pas, le conteneur REFUSE DE VIVRE au lieu de servir un
# site « valide, seulement faux ». Coolify le montre immediatement.
set -eu

CONF=/etc/nginx/http.d/default.conf
NODE=/app/dist/server/entry.mjs

echec() { echo "[demarrage] ECHEC : $*" >&2; exit 1; }

# --- 0. Garde-fou anti-divergence des deux configurations -------------------
# nginx.conf (statique) et nginx.server.conf doivent rester jumeaux sur tout
# sauf la regle de recherche des fichiers. Le proxy /stats/ est l'element dont
# l'oubli couterait le plus cher : il porte l'anti-empreinte du reseau.
grep -q "location \^~ /stats/" "$CONF" || echec "le proxy /stats/ a disparu de la configuration nginx — la mesure d'audience serait morte et l'anti-empreinte avec"

# --- 1. La configuration nginx est-elle seulement valide ? ------------------
nginx -t || echec "configuration nginx invalide (voir ci-dessus)"

# --- 2. Node d'abord, nginx ensuite -----------------------------------------
[ -f "$NODE" ] || echec "$NODE introuvable — image construite sans RENDERING=server ?"
node "$NODE" &
NODE_PID=$!

i=0
while [ "$i" -lt 30 ]; do
  wget -q -O /dev/null "http://127.0.0.1:4321/api/sante" 2>/dev/null && break
  i=$((i + 1))
  sleep 1
done
[ "$i" -lt 30 ] || echec "Node n'a pas repondu sur 4321 en 30 s"
echo "[demarrage] Node repond sur 4321"

mkdir -p /run/nginx
nginx -g 'daemon off;' &
NGINX_PID=$!

# --- 3. Le controle qui compte : A TRAVERS nginx, sur le port 80 ------------
i=0
while [ "$i" -lt 20 ]; do
  wget -q -O /dev/null "http://127.0.0.1:80/" 2>/dev/null && break
  i=$((i + 1))
  sleep 1
done
[ "$i" -lt 20 ] || echec "nginx ne sert pas la racine sur le port 80"

# La route dynamique doit traverser nginx ET etre calculee par Node.
SANTE=$(wget -q -O - "http://127.0.0.1:80/api/sante" 2>/dev/null || echo '')
case "$SANTE" in
  *'"mode":"server"'*) echo "[demarrage] /api/sante traverse nginx et repond : $SANTE" ;;
  '')  echec "/api/sante ne repond pas a travers nginx — le proxy vers 4321 ne fonctionne pas" ;;
  *)   echec "/api/sante repond mais pas en mode serveur : $SANTE" ;;
esac

echo "[demarrage] ✅ nginx (80) devant Node (4321), pages pre-generees servies par nginx"

# --- 4. Surveillance : si l'un meurt, tout meurt -----------------------------
# 🔴 Sans ca, un Node mort passerait inapercu derriere un nginx bien vivant :
# les pages continueraient de s'afficher et seules les routes dynamiques
# tomberaient. C'est exactement le genre de panne qu'on ne voit pas.
arreter() { kill -TERM "$NODE_PID" "$NGINX_PID" 2>/dev/null || true; }
trap 'arreter; exit 0' TERM INT

while kill -0 "$NODE_PID" 2>/dev/null && kill -0 "$NGINX_PID" 2>/dev/null; do
  sleep 2
done
echo "[demarrage] un des deux processus s'est arrete — on coupe tout pour que le redemarrage soit visible" >&2
arreter
exit 1
