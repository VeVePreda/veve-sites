#!/usr/bin/env python3
"""Preuve que les DEUX configurations nginx restent jumelles.

    npm run test:nginx

POURQUOI CE TEST EXISTE
=======================
Le mode statique et le mode serveur ont chacun leur fichier :

    nginx.conf          nginx sert des fichiers, point.
    nginx.server.conf   nginx sert les memes fichiers ET delegue /api/ a Node.

Tout doit rester IDENTIQUE entre les deux sauf le strict necessaire. Le risque
n'est pas theorique : le bloc `/stats/` porte l'anti-empreinte du reseau — le
visiteur ne voit jamais l'adresse du serveur de statistiques. L'oublier d'un
cote, ou le laisser deriver, casserait la mesure d'audience SANS AUCUN SIGNAL,
en repondant 200 partout. C'est le mode de panne le plus cher de ce projet :
« valide, seulement faux ».

⚠️ CE QUE CE TEST NE FAIT PAS. Il analyse la configuration, il ne l'execute pas.
L'ordre de priorite reel des `location`, le cache et les en-teteres ne sont
prouves que par un vrai nginx — c'est le role du controle de demarrage dans
docker-entrypoint.sh, qui interroge le site A TRAVERS nginx.

Dependance : crossplane, l'analyseur officiel de NGINX Inc.
    pip install crossplane
"""
import pathlib
import sys

try:
    import crossplane
except ImportError:
    sys.exit("crossplane est absent : pip install crossplane")

RACINE = pathlib.Path(__file__).resolve().parents[2]
STATIQUE = RACINE / 'nginx.conf'
SERVEUR = RACINE / 'nginx.server.conf'

echecs = 0


def verifie(titre, ok, detail):
    global echecs
    print(f"  {'OK  ' if ok else 'ECHEC'} {titre} — {detail}")
    if not ok:
        echecs += 1


def analyser(fragment: pathlib.Path, tmp: pathlib.Path):
    """Enveloppe le fragment dans un nginx.conf minimal et l'analyse."""
    tmp.mkdir(parents=True, exist_ok=True)
    (tmp / 'http.d').mkdir(exist_ok=True)
    (tmp / 'http.d' / 'default.conf').write_text(fragment.read_text(encoding='utf-8'), encoding='utf-8')
    racine = tmp / 'nginx.conf'
    racine.write_text(
        'events { worker_connections 1024; }\n'
        'http {\n'
        f'  include {tmp}/http.d/*.conf;\n'
        '}\n', encoding='utf-8')
    return crossplane.parse(str(racine), catch_errors=True)


def locations(payload):
    """{ argument du location : bloc trie } pour toutes les locations trouvees."""
    out = {}

    def marche(blocs):
        for b in blocs:
            if b['directive'] == 'location':
                cle = ' '.join(b.get('args', []))
                out[cle] = sorted(
                    (c['directive'], ' '.join(c.get('args', [])))
                    for c in (b.get('block') or [])
                )
            marche(b.get('block') or [])

    for f in payload['config']:
        marche(f['parsed'])
    return out


import tempfile
base = pathlib.Path(tempfile.mkdtemp(prefix='nginx-'))

print('\n1. les deux configurations sont-elles valides ?')
analyses = {}
for nom, chemin in (('nginx.conf', STATIQUE), ('nginx.server.conf', SERVEUR)):
    if not chemin.exists():
        verifie(f'{nom} existe', False, 'fichier introuvable')
        continue
    p = analyser(chemin, base / nom)
    analyses[nom] = p
    erreurs = p.get('errors', [])
    verifie(f'{nom} s\'analyse sans erreur', p.get('status') == 'ok' and not erreurs,
            erreurs[0]['error'] if erreurs else 'aucune erreur de syntaxe ni de directive')

if len(analyses) != 2:
    sys.exit('les deux fichiers sont necessaires : test invalide')

loc_statique = locations(analyses['nginx.conf'])
loc_serveur = locations(analyses['nginx.server.conf'])

# Garde-fou anti-test-creux : si l'analyse ne trouvait aucune location, tout ce
# qui suit passerait au vert sans rien prouver.
if len(loc_statique) < 3 or len(loc_serveur) < 3:
    sys.exit(f'analyse suspecte ({len(loc_statique)} et {len(loc_serveur)} locations) : test invalide')

print('\n2. le bloc /stats/ — l\'anti-empreinte du reseau')
cle = '^~ /stats/'
present = cle in loc_statique and cle in loc_serveur
verifie('present dans les DEUX configurations', present,
        f"statique={cle in loc_statique} serveur={cle in loc_serveur}")
if present:
    verifie('rigoureusement identique', loc_statique[cle] == loc_serveur[cle],
            'meme proxy, memes en-tetes' if loc_statique[cle] == loc_serveur[cle]
            else f"ecarts : {set(map(str, loc_statique[cle])) ^ set(map(str, loc_serveur[cle]))}")

print('\n3. les regles communes ne divergent pas')
communes = (set(loc_statique) & set(loc_serveur)) - {'/'}
verifie('il y a bien des regles communes a comparer', len(communes) >= 3,
        f'{len(communes)} regles partagees')
divergentes = [c for c in sorted(communes) if loc_statique[c] != loc_serveur[c]]
verifie('aucune regle commune ne diverge', not divergentes,
        'identiques' if not divergentes else ', '.join(divergentes))

print('\n4. le mode serveur delegue a Node — et seulement ou il le declare')
api = '^~ /api/'
verifie('le mode serveur route /api/ vers Node', api in loc_serveur
        and any('127.0.0.1:4321' in a for _, a in loc_serveur[api]),
        'proxy_pass vers 127.0.0.1:4321' if api in loc_serveur else 'bloc /api/ absent')
verifie('le mode statique, lui, ne connait pas /api/', api not in loc_statique,
        'aucun proxy applicatif en statique' if api not in loc_statique else 'presence inattendue')

# 🔴 La regle qui protege les 8 514 pages : une adresse sans fichier doit rendre
# un 404 nginx, PAS reveiller Node. Le routage vers Node est explicite, prefixe
# par prefixe — jamais un repli attrape-tout.
racine_serveur = loc_serveur.get('/', [])
attrape_tout = any('@' in a for d, a in racine_serveur if d == 'try_files')
verifie('aucun repli attrape-tout vers Node', not attrape_tout,
        'les adresses inconnues restent un 404 nginx' if not attrape_tout
        else 'try_files renvoie vers un @bloc : tout robot reveillerait Node')

print(f"\n{'✅ les deux configurations sont jumelles' if echecs == 0 else f'❌ {echecs} echec(s)'}")
sys.exit(0 if echecs == 0 else 1)
