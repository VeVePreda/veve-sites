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
import re
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
# ⭐⭐ NETTOYAGE DU TEMPORAIRE — audit d'hygiene du 03/08/2026. Ce banc laissait
# un dossier par execution ; cumules, ils ont rempli le disque et provoque un
# ENOSPC. ⛔ PAS un `try/finally` : ce fichier appelle `sys.exit()` a quatre
# endroits avant la fin. `atexit` tourne quand meme — c'est le seul point de
# sortie commun.
import atexit, shutil
atexit.register(lambda: shutil.rmtree(base, ignore_errors=True))

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

# ⭐ Depuis que le lanceur pose un lien symbolique, les deux modes servent
# depuis la MEME racine. Si elles divergeaient, un mode servirait un repertoire
# vide — 404 partout, sans une erreur de configuration.
def racine(payload):
    for f in payload['config']:
        def marche(bs):
            for b in bs:
                if b['directive'] == 'root':
                    return ' '.join(b.get('args', []))
                r = marche(b.get('block') or [])
                if r:
                    return r
            return None
        r = marche(f['parsed'])
        if r:
            return r
    return None


def directives_serveur(payload):
    """{ directive : arguments } au niveau `server`, hors blocs `location`."""
    out = {}

    def marche(blocs, dans_location=False):
        for b in blocs:
            if b['directive'] == 'location':
                marche(b.get('block') or [], True)
                continue
            if not dans_location:
                out[b['directive']] = ' '.join(b.get('args', []))
            marche(b.get('block') or [], dans_location)

    for f in payload['config']:
        marche(f['parsed'])
    return out


print('\n3 bis. la compression est PRECOMPRESSEE, et des deux cotes')
# ⭐ `gzip on` seul compresse a la volee au niveau 1 — le defaut, qu'on ne
#    declarait nulle part — a chaque requete et sur chacune des ~8 500 pages.
#    Le Dockerfile produit desormais les `.gz` niveau 9 ; sans `gzip_static`,
#    ils dorment sur le disque et le site reste exactement aussi lent qu'avant.
#    C'est encore le motif « depose mais pas actif » : rien n'echoue.
# ⭐ Le controle porte sur les DEUX fichiers, parce que le mode d'un site se
#    change en editant une ligne de manifeste : un site bascule en `server`
#    perdrait silencieusement la precompression si seul nginx.conf l'avait.
ds = directives_serveur(analyses['nginx.conf'])
dv = directives_serveur(analyses['nginx.server.conf'])
for cle, pourquoi in (('gzip_static', 'sert les .gz produits au build'),
                      ('gzip_vary', 'dit aux caches que la reponse depend d\'Accept-Encoding')):
    verifie(f'`{cle} on` dans les deux configurations',
            ds.get(cle) == 'on' and dv.get(cle) == 'on',
            f"statique={ds.get(cle) or 'absent'} serveur={dv.get(cle) or 'absent'} — {pourquoi}")

print('\n4. la racine servie est la meme des deux cotes')
ra, rb = racine(analyses['nginx.conf']), racine(analyses['nginx.server.conf'])
verifie('meme `root` dans les deux configurations', ra is not None and ra == rb,
        f'{ra} / {rb}')

print('\n5. le mode serveur delegue a Node — et seulement ou il le declare')
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

# =============================================================================
# 6. LE CONTROLE QUI MANQUAIT — ajoute le 06/08/2026 apres une panne de PROD.
# =============================================================================
# CE QU'IL FERME. Le 06/08, `/compte/`, `/connexion/` et `/inscription/`
# rendaient 404 en production. Le manifeste disait `rendering: server`,
# l'integration `veve:routes-compte` posait bien `prerender = false`, Node
# servait bel et bien les trois routes — et nginx ne lui a jamais rien demande.
# Une route rendue a la demande n'ecrit AUCUN fichier dans dist/client : le
# `try_files … =404` la trouvait absente et servait notre propre 404.html.
#
# ⭐⭐⭐ ET LES CINQ SECTIONS AU-DESSUS ETAIENT VERTES. Elles ont ete ecrites
# pour prouver que les deux configurations sont JUMELLES ; elles n'ont jamais
# eu a dire si le mode serveur sert bien tout ce qu'il rend. La section 5
# affirmait meme « le mode serveur delegue a Node — et seulement ou il le
# declare » : la seconde moitie de la phrase etait gardee, la premiere non.
# ⭐⭐ UN BANC SE JUGE SUR CE QU'IL LAISSE PASSER, PAS SUR CE QU'IL VERIFIE.
#
# ⭐ SON ATTENTE VIENT DU MOTEUR, PAS D'UNE LISTE RECOPIEE ICI. Une liste
# recopiee vieillirait avec le premier ajout, et ce banc redeviendrait vert
# pour la meme mauvaise raison. Il lit `ROUTES_COMPTE` dans
# `engine/lib/astro_routes_compte.mjs` — la SEULE source qui decide quelles
# routes sont dynamiques. Ajouter une page de compte sans regle nginx fait
# desormais ECHOUER le banc, donc le deploiement.
# ⭐ Il sort en echec s'il n'a extrait AUCUNE route : un banc qui n'a rien
# inspecte n'a rien prouve, et son vert est le plus cher de tous.
print('\n6. tout ce que Node REND, nginx le DEMANDE')

ROUTES_MJS = RACINE / 'engine' / 'lib' / 'astro_routes_compte.mjs'


def routes_dynamiques():
    """Les URL rendues a la demande, lues dans le moteur (jamais recopiees)."""
    if not ROUTES_MJS.exists():
        return []
    src = ROUTES_MJS.read_text(encoding='utf-8')
    bloc = re.search(r'const\s+ROUTES_COMPTE\s*=\s*\[(.*?)\];', src, re.S)
    if not bloc:
        return []
    urls = []
    for fichier in re.findall(r"'([^']+\.(?:astro|js|ts))'", bloc.group(1)):
        # `pages/compte/index.astro` -> `/compte/` ; `pages/api/sante.js` ->
        # `/api/sante` ; `pages/api/historique/[uuid].js` -> `/api/historique/x`.
        u = re.sub(r'^.*?pages/', '/', fichier)
        u = re.sub(r'/index\.(astro|js|ts)$', '/', u)
        u = re.sub(r'\.(astro|js|ts)$', '', u)
        u = re.sub(r'\[[^\]]+\]', 'x', u)
        urls.append(u)
    return sorted(set(urls))


def sert(url, locs):
    """Une regle de `locs` delegue-t-elle `url` a Node ? (semantique nginx)

    ⚠️ APPROXIMATION ASSUMEE, ET ELLE PENCHE DU BON COTE : on ne reimplemente
    pas l'ordre de priorite de nginx (c'est le role du controle de demarrage,
    qui interroge A TRAVERS un vrai nginx). On demande seulement qu'AU MOINS
    UNE regle proxy corresponde. Une regle qui perdrait la priorite passerait
    ici — mais l'ABSENCE TOTALE de regle, qui est la panne reelle du 06/08, ne
    passe plus.
    """
    for cle, contenu in locs.items():
        if not any('127.0.0.1:4321' in a for d, a in contenu if d == 'proxy_pass'):
            continue
        motif = cle.split(' ', 1)[-1] if ' ' in cle else cle
        regex = cle.startswith('~')
        if regex and re.search(motif, url):
            return cle
        if not regex and url.startswith(motif):
            return cle
    return None


dynamiques = routes_dynamiques()
verifie('la liste des routes dynamiques a bien ete lue dans le moteur',
        len(dynamiques) >= 5,
        f'{len(dynamiques)} route(s) : {", ".join(dynamiques)}' if dynamiques
        else f'ROUTES_COMPTE introuvable dans {ROUTES_MJS.name} — banc creux')

for url in dynamiques:
    regle = sert(url, loc_serveur)
    verifie(f'{url} est servie par nginx en mode serveur', regle is not None,
            f'via `location {regle}`' if regle
            else 'AUCUNE regle ne la delegue a Node — Node la rend, personne ne la demande, '
                 'nginx sert un 404')

# ⛔ ET LE MODE STATIQUE NE DOIT SURTOUT PAS LES CONNAITRE. En statique il n'y a
# pas de Node : ces pages sont des FICHIERS pre-generes, servis par le bloc `/`.
# Une regle proxy cote statique pointerait vers un port ou personne n'ecoute.
fautives = [u for u in dynamiques if sert(u, loc_statique)]
verifie('le mode statique ne delegue aucune de ces routes', not fautives,
        'aucun proxy applicatif en statique' if not fautives
        else f'proxy inattendu pour : {", ".join(fautives)}')

print(f"\n{'✅ configurations jumelles, et tout ce que Node rend est demande' if echecs == 0 else f'❌ {echecs} echec(s)'}")
sys.exit(0 if echecs == 0 else 1)
