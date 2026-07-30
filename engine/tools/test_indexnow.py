#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Banc de l'etat IndexNow — le checkpoint n'avance que sur un envoi REUSSI.

    npm run test:indexnow        # ou : python3 engine/tools/test_indexnow.py

Rejoue le VRAI `main()` sur un faux sitemap et un faux reseau : on remplace
`sitemap_servi` et `urllib.request.urlopen` dans le module charge. Aucun acces
reseau, aucune variante du code sous test.

⭐ Ce banc doit ETRE ROUGE sur la version d'avant le 30/07/2026 : c'est la seule
chose qui prouve qu'il mesure quelque chose. Les 4 scenarios sont ceux que la
production a exhibes ou qu'elle exhiberait.
"""
import importlib.util
import json
import pathlib
import sys
import tempfile
import urllib.request

CHEMIN = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else (
    pathlib.Path(__file__).resolve().parent / 'indexnow.py')
echecs = 0


def verifie(nom, condition, detail=''):
    global echecs
    if condition:
        print(f'   OK  {nom}')
    else:
        echecs += 1
        print(f'   NON {nom}' + (f' — {detail}' if detail else ''))


def charge_module(racine: pathlib.Path):
    """Charge indexnow.py en forcant sa RACINE vers un dossier jetable."""
    spec = importlib.util.spec_from_file_location('indexnow_sous_test', CHEMIN)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    m.RACINE = racine
    return m


class FauxReseau:
    """Remplace urlopen. `code=None` => succes, sinon leve une HTTPError."""

    def __init__(self, code=None):
        self.code = code
        self.envois = []

    def __call__(self, req, timeout=None):
        self.envois.append(json.loads(req.data.decode('utf-8')))
        if self.code is not None:
            raise urllib.error.HTTPError(req.full_url, self.code, 'refuse', {}, None)

        class R:
            status = 200

            def __enter__(self_inner):
                return self_inner

            def __exit__(self_inner, *a):
                return False
        return R()


def scenario(nom, etat_initial, sitemap, code_http, essai=False, plafond=None):
    """Rend (etat_apres, envois)."""
    base = pathlib.Path(tempfile.mkdtemp())
    (base / 'engine' / 'data').mkdir(parents=True)
    f = base / 'engine' / 'data' / 'indexnow_test.json'
    if etat_initial is not None:
        f.write_text(json.dumps({'urls': etat_initial}), encoding='utf-8')

    m = charge_module(base)
    m.sitemap_servi = lambda domaine: dict(sitemap)
    if plafond is not None:
        m.PLAFOND = plafond
    reseau = FauxReseau(code_http)
    m.urllib.request.urlopen = reseau

    argv = ['indexnow.py', '--site', 'test', '--domaine', 'test.com', '--cle', 'K']
    if essai:
        argv.append('--essai')
    vieux, sys.argv = sys.argv, argv
    try:
        m.main()
    finally:
        sys.argv = vieux
    apres = json.loads(f.read_text(encoding='utf-8')).get('urls', {}) if f.exists() else {}
    return apres, reseau.envois


print(f'Fichier teste : {CHEMIN}')

HIER = {'https://test.com/a': '2026-07-28', 'https://test.com/b': '2026-07-28'}
AUJ = {'https://test.com/a': '2026-07-30', 'https://test.com/b': '2026-07-30'}

# --- 1. LE DEFAUT DU 30/07 : soumission refusee (403) ----------------------
print('\n1. soumission refusee (403) — le cas vu en production')
apres, envois = scenario('403', HIER, AUJ, 403)
verifie('la soumission a bien ete tentee', len(envois) == 1)
verifie("l'etat n'a PAS avance", apres == HIER,
        f'etat={apres} (il devrait etre inchange, sinon les URL ne repartent jamais)')

# --- 2. Le meme, mais l'envoi reussit -------------------------------------
print('\n2. soumission acceptee (200)')
apres, envois = scenario('200', HIER, AUJ, None)
verifie("l'etat a avance", apres == AUJ, f'etat={apres}')
verifie('les 2 URL ont ete envoyees', len(envois[0]['urlList']) == 2)

# --- 3. --essai ne doit RIEN consommer ------------------------------------
print('\n3. --essai (simulation)')
apres, envois = scenario('essai', HIER, AUJ, None, essai=True)
verifie('rien envoye', envois == [])
verifie("l'etat n'a pas bouge", apres == HIER, f'etat={apres}')

# --- 4. Troncature au plafond : la queue ne doit PAS etre enregistree -----
print('\n4. troncature au plafond (1 seule URL envoyable sur 2)')
apres, envois = scenario('plafond', HIER, AUJ, None, plafond=1)
verifie('1 seule URL envoyee', len(envois[0]['urlList']) == 1,
        str(len(envois[0]['urlList'])))
envoyee = envois[0]['urlList'][0]
restante = [u for u in AUJ if u != envoyee][0]
verifie("l'URL envoyee est enregistree", apres.get(envoyee) == AUJ[envoyee])
verifie("l'URL TRONQUEE reste en attente", apres.get(restante) != AUJ[restante],
        f'{restante} enregistree comme soumise alors qu\'elle ne l\'a jamais ete')

print()
if echecs:
    print(f'ECHEC : {echecs} verification(s) en defaut.')
    print("Un checkpoint qui avance plus loin que ce qui a reussi transforme")
    print("« on reessaiera demain » en promesse que le fichier rend impossible.")
    sys.exit(1)
print("OK : l'etat IndexNow n'avance que sur ce qui a ete reellement soumis.")
