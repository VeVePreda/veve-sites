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
DIST = RACINE / 'dist'


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
