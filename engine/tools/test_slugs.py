#!/usr/bin/env python3
"""Preuve que les adresses des fiches ne bougent JAMAIS.

    npm run test:slugs

Le danger reel, constate en production le 18/07/2026 : plusieurs collectibles
VeVe portent le meme nom ("Batgirl" x3, "C-3PO" x2...). Le premier rencontre
gardait /item/batgirl/, les suivants recevaient un suffixe. Comme le parcours
suivait le NOMBRE DE RELEVES — qui change tous les jours — l'adresse
/item/batgirl/ pouvait passer d'un collectible a un AUTRE. C'est pire qu'une
page disparue : l'adresse repond, mais montre autre chose.

Ce test bouscule volontairement le classement puis verifie deux choses :
  1. aucune fiche ne change d'adresse ;
  2. aucune adresse ne change d'objet.
"""
import collections
import csv
import json
import os
import pathlib
import random
import re
import shutil
import subprocess
import sys

RACINE = pathlib.Path(__file__).resolve().parents[2]
PRIX = RACINE / 'engine' / 'data' / 'sample' / 'prices.csv'
# ═══════════════════════════════════════════════════════════════════════════
# 🔴🔴 `dist` OU `dist/client` — LA MEME ERREUR, POUR LA TROISIEME FOIS.
# ═══════════════════════════════════════════════════════════════════════════
# En mode `static`, Astro pose les pages dans `dist/`. En mode `server`, il les
# pose dans `dist/client/` et met le serveur dans `dist/server/`. Ce fichier ne
# regardait que `dist/` : lance apres un build `server`, il ne trouvait AUCUNE
# fiche et rendait « aucune fiche produite : test invalide ».
#
# ⭐ ET LE DEPOT SAVAIT DEJA. `audit_seo.py`, dans ce meme dossier, porte la
#    lecon en toutes lettres depuis le 30/07 : « il avait deja lu `dist` au lieu
#    de `dist/client` ». La connaissance existait a trois fichiers d'ici.
#
# ⭐⭐ CE BANC A EU RAISON DE CRIER. Il a refuse de rendre un verdict sur zero
#     element, au lieu de dire « tout est vert, 0 fiche verifiee » — ce qui est
#     exactement ce qu'on demande a un controle. On corrige OU il regarde, pas
#     ce qu'il exige.
_DIST = RACINE / 'dist'
DIST = _DIST / 'client' if (_DIST / 'client').is_dir() else _DIST


# ═══════════════════════════════════════════════════════════════════════════
# 🔴 LOT 102 — CE BANC SORT SUR LE MANIFESTE, PAS SUR UN DOSSIER VIDE
# ═══════════════════════════════════════════════════════════════════════════
# Mesure du 07/08 : sur vevewiki, ce banc echouait avec « aucune fiche produite :
# test invalide ». Et il avait tort — non pas sur la forme (refuser un verdict
# sur zero element est exactement ce qu'on lui demande) mais sur la QUESTION.
# vevewiki ne publie AUCUNE fiche de prix, par construction : il n'a pas
# d'adresses a geler, donc rien a verifier, donc rien a rater.
#
# ⭐⭐⭐ « ZERO FICHE PARCE QUE LE BUILD A CASSE » ET « ZERO FICHE PARCE QUE CE
# SITE N'EN PUBLIE PAS » SE RESSEMBLENT SUR LE DISQUE ET SONT L'INVERSE L'UN DE
# L'AUTRE. Seul le manifeste sait laquelle des deux on regarde. Le banc le lui
# demande donc AVANT de construire quoi que ce soit — et il garde ses dents
# entieres la ou elles servent : un site QUI publie des fiches et n'en produit
# aucune fait toujours echouer, exactement comme avant.
#
# ⛔ NE PAS remplacer ce test par « le dossier collectibles/ existe-t-il ? » :
# ce serait rededuire la reponse d'un artefact du disque, c'est-a-dire heriter
# de tout ce que le disque a garde d'un build precedent.
def publie_des_fiches():
    """Le manifeste de CE site declare-t-il des pages de prix ?
    On interroge `priceEnabled()` — la MEME fonction que le moteur — au lieu de
    relire le YAML a la main : deux lectures du meme fait divergent un jour."""
    r = subprocess.run(
        ['node', '--input-type=module', '-e',
         "const m = await import('./engine/lib/features.mjs');"
         "process.exit(m.priceEnabled() ? 0 : 3);"],
        cwd=RACINE, capture_output=True, text=True)
    if r.returncode not in (0, 3):
        sys.exit('impossible de lire le manifeste :\n' + r.stdout[-800:] + r.stderr[-800:])
    return r.returncode == 0


if not publie_des_fiches():
    site = os.environ.get('SITE', '(defaut)')
    print("site « %s » : aucune page de prix declaree au manifeste." % site)
    print("Il n'a donc aucune adresse a geler, et rien a verifier ici.")
    print("⚠️ Sur veveprice, ce message EST la panne — le site publie des fiches.")
    sys.exit(0)


def construire():
    env = {**os.environ, 'WAREHOUSE_OFFLINE': '1'}
    r = subprocess.run(['npm', 'run', 'build'], cwd=RACINE, env=env,
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit('la construction a echoue :\n' + r.stdout[-2000:] + r.stderr[-2000:])


def carte():
    """uuid -> adresse, lu dans les donnees structurees des pages produites."""
    out = {}
    fiches = list(DIST.glob('collectibles/*/*/index.html')) + list(DIST.glob('comics/*/*/index.html'))
    for f in fiches:
        h = f.read_text(encoding='utf-8', errors='ignore')
        for bloc in re.findall(r'<script type="application/ld\+json">(.*?)</script>', h, re.S):
            try:
                n = json.loads(bloc)
            except json.JSONDecodeError:
                continue
            if n.get('@type') == 'Product':
                out[n['sku']] = '/' + str(f.parent.relative_to(DIST)).replace('\\', '/') + '/'
    if not out:
        sys.exit('aucune fiche produite : test invalide')
    return out


def bousculer():
    """Simule ce que fait vraiment le backfill : des items peu fournis
    recoivent d'un coup des centaines de releves et remontent au classement."""
    lignes = list(csv.reader(open(PRIX, encoding='utf-8')))
    entete, donnees = lignes[0], lignes[1:]
    freq = collections.Counter(r[0] for r in donnees)
    faibles = [u for u, _ in freq.most_common()[-12:]]
    ajout = []
    for u in faibles:
        modele = next(r for r in donnees if r[0] == u)
        for i in range(900):
            r = list(modele)
            r[1] = f"2020-01-{(i % 28) + 1:02d}T00:00:00Z"
            r[2] = str(round(random.uniform(1, 90), 2))
            ajout.append(r)
    with open(PRIX, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(entete)
        w.writerows(donnees + ajout)
    return len(ajout)


def rendre_dist_propre():
    """Reconstruit dist/ a partir des donnees RESTAUREES.

    🔴 CE N'EST PAS UNE POLITESSE, C'EST UNE CORRECTION.
    Sans elle, ce test laissait `dist/` construit a partir des donnees
    BOUSCULEES : 12 fiches y portaient 900 releves fictifs. Les donnees, elles,
    etaient bien restaurees — donc rien ne signalait le probleme, et
    `npm run audit`, qui lit `dist/`, auditait un site falsifie.

    Le 21/07/2026 j'ai compare un `dist/` laisse dans cet etat a un `dist/`
    propre et j'en ai conclu que 58 adresses avaient change d'objet toutes
    seules. Fausse alerte : 126 releves + 900 injectes = les 1 026 que je
    croyais etre une derive.

    ⭐ Un test qui salit un artefact partage doit le rendre PROPRE, sinon il
    transforme le suivant en menteur.

    (Cette fonction porte un nom plutot que d'appeler `construire()` en ligne :
    un correctif invisible dans le code est un correctif que les controles ne
    savent pas verifier — ils ignorent les commentaires, a juste titre.)
    """
    construire()


sauvegarde = PRIX.with_suffix('.csv.bak')
shutil.copy(PRIX, sauvegarde)
try:
    construire()
    avant = carte()
    n = bousculer()
    construire()
    apres = carte()
finally:
    shutil.move(sauvegarde, PRIX)
    rendre_dist_propre()

communs = set(avant) & set(apres)
deplacees = {u: (avant[u], apres[u]) for u in communs if avant[u] != apres[u]}
inv_a = {v: k for k, v in avant.items()}
inv_b = {v: k for k, v in apres.items()}
detournees = [s for s in set(inv_a) & set(inv_b) if inv_a[s] != inv_b[s]]

print(f"classement bouscule ({n} releves ajoutes), {len(communs)} fiches comparees")
print(f"  adresses deplacees        : {len(deplacees)}")
print(f"  adresses changeant d'objet: {len(detournees)}")
for u, (x, y) in list(deplacees.items())[:5]:
    print(f"    {u} : /{x}/ -> /{y}/")
for s in detournees[:5]:
    print(f"    /{s}/ : {inv_a[s]} -> {inv_b[s]}")

if deplacees or detournees:
    sys.exit("ECHEC : les adresses ne sont pas stables.")
print("OK : les adresses resistent a un bouleversement complet du classement.")
