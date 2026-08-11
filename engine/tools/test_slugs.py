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


def dist():
    """Ou sont les pages, DECIDE APRES le build et jamais avant.

    🔴🔴 LOT 103 — QUATRIEME OCCURRENCE DU MEME DEFAUT EN UNE JOURNEE.
    Ce chemin etait resolu AU CHARGEMENT DU MODULE, donc avant que
    `construire()` ait tourne : il heritait de la disposition laissee par le
    build PRECEDENT. Mesure le 07/08 : apres un build de vevewiki (`static`,
    pages dans `dist/`), le banc de veveprice (`server`, pages dans
    `dist/client/`) regardait `dist/` et rendait « aucune fiche produite : test
    invalide » sur un site parfaitement sain.
    ⭐⭐⭐ C'est exactement ce que l'en-tete de ce fichier raconte deja pour
    `dist` contre `dist/client` — « la meme erreur, pour la troisieme fois ». La
    cause residuelle n'etait plus OU il regarde, mais QUAND il decide ou
    regarder. Un chemin deduit d'un artefact du disque herite de tout ce que le
    disque a garde.
    ⛔ NE PAS remettre une constante de module : la valeur doit etre relue apres
    chaque construction, parce que c'est la construction qui la fabrique.
    """
    return _DIST / 'client' if (_DIST / 'client').is_dir() else _DIST


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
    D = dist()
    fiches = list(D.glob('collectibles/*/*/index.html')) + list(D.glob('comics/*/*/index.html'))
    for f in fiches:
        h = f.read_text(encoding='utf-8', errors='ignore')
        for bloc in re.findall(r'<script type="application/ld\+json">(.*?)</script>', h, re.S):
            try:
                n = json.loads(bloc)
            except json.JSONDecodeError:
                continue
            if n.get('@type') == 'Product':
                out[n['sku']] = '/' + str(f.parent.relative_to(D)).replace('\\', '/') + '/'
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

    LOT 137 — « PROPRE » INCLUT LE MARQUAGE i18n, ET CA A COUTE UN ROUGE EN CI.
    ================================================================
    Mesure du 11/08/2026, run #115 : le job `bancs (veveprice)` sortait en 1 a
    l'etape `npm test`, sur `test:i18n`, « 147 page(s) portent encore les
    sentinelles ». Le banc avait RAISON.

    LA CAUSE. Le lot 135B a ajoute `I18N_MARQUAGE: '1'` a l'etape `npm test`
    (P32). Le workflow fait, dans l'ordre : build avec la variable, PUIS
    `npm run marquer:i18n`, PUIS `npm test`. Mais `npm test` enchaine
    `test:slugs`, qui reconstruit `dist/` trois fois — en heritant de la
    variable, donc en REPOSANT les sentinelles — et personne ne rejoue le
    post-traitement derriere. `test:i18n`, 38e de la chaine, les trouve.

    POURQUOI VEVEWIKI RESTAIT VERT, ET CE N'EST PAS RASSURANT : ce fichier
    sort en 0 des la ligne 103 sur un site sans page de prix. Il ne construit
    jamais. Le defaut existait donc sur UN site sur deux, ce qui le rendait
    parfaitement invisible dans une matrice a deux jobs dont un vert.

    ETOILE LA LECON EST CELLE QUE CETTE FONCTION ENONCE DEJA, POUSSEE D'UN CRAN.
    « Un test qui salit un artefact partage doit le rendre PROPRE » — et le
    marquage fait partie de propre. Reconstruire sans re-marquer rend un
    `dist/` qui a l'air complet, qui pese le bon nombre d'octets, et qui est
    faux d'une maniere qu'aucun coup d'oeil ne rattrape.

    ATTENTION ON NE RE-MARQUE QUE SI LA VARIABLE EST POSEE. Sans elle, le build
    n'emet aucune sentinelle et `marquer:i18n` n'aurait rien a faire : le jouer
    quand meme masquerait la difference entre les deux conditions, alors que
    c'est precisement ce que la quatrieme condition du projet mesure.
    """
    construire()
    if os.environ.get('I18N_MARQUAGE') == '1':
        env = {**os.environ, 'WAREHOUSE_OFFLINE': '1'}
        r = subprocess.run(['npm', 'run', 'marquer:i18n'], cwd=RACINE, env=env,
                           capture_output=True, text=True)
        # PAS DE SILENCE ICI. Si le post-traitement echoue, `dist/` reste
        # sali et c'est `test:i18n` qui portera le chapeau trente secondes
        # plus tard — un banc qui rougit pour la faute d'un autre est la
        # panne la plus chere a diagnostiquer de ce projet.
        if r.returncode != 0:
            sys.exit('le re-marquage i18n a echoue apres la reconstruction :\n'
                     + r.stdout[-2000:] + r.stderr[-2000:])


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
