// Preuve que chaque instruction RUN du Dockerfile est du shell VALIDE.
//
//     npm run test:dockerfile
//
// CE QU'ON TESTE, ET POURQUOI. Le 29/07/2026 a 09:52 le build est parti rouge
// sur une seule faute de frappe : un `find ... -type f ( -name '*.html' ...`
// dont les parentheses n'etaient pas echappees. `(` est un mot reserve du
// shell : celui-ci refuse la commande A LA LECTURE, avant d'executer la moindre
// ligne. Resultat : 110 ms, zero sortie, et un build rouge sans message utile.
//
// ⭐⭐ LA LECON QUI JUSTIFIE CE BANC. L'etape portait DEJA son garde-fou —
// `[ "$n" -gt 0 ] || { echo "ERREUR: aucune ressource precompressee"; exit 1; }`
// — et il n'a pas pu tirer, parce qu'il vivait DANS le `RUN` qui ne parse pas.
// Un garde-fou loge dans ce qu'il surveille meurt avec lui. Celui-ci vit
// DEHORS : dans un fichier de test, joue avant la livraison, sur la machine du
// developpeur et en CI.
//
// ⭐ POURQUOI CA VAUT LE COUP POUR SI PEU DE CODE. Ce Dockerfile est le
// Dockerfile du MOTEUR : il construit les 15 sites du reseau. Une faute de
// syntaxe dedans n'est pas un site casse, ce sont tous les sites bloques. Le
// controle coute ~200 ms et ne demande aucun reseau, aucun docker, aucune
// dependance.
//
// ⚠️ LIMITES ASSUMEES, ecrites ici pour qu'on ne les redecouvre pas.
//  1. `sh -n` verifie la SYNTAXE, pas le sens. `find` mal appele passe, un
//     chemin qui n'existe pas passe. Ce banc attrape la classe de defaut du
//     29/07, pas les erreurs d'execution.
//  2. Le `sh` de la machine de test (dash/bash) n'est pas le `sh` de l'image
//     (busybox ash). Les deux refusent la meme grammaire POSIX ; un `[[ ]]`
//     bashiste passerait ici et casserait dans l'image. On ne s'en sert pas.
//  3. Les `RUN` en forme exec (`RUN ["a","b"]`) ne passent pas par un shell :
//     ils sont comptes et sautes, pas testes.
//  4. Les heredocs (`RUN <<EOF`) ne sont pas geres. S'il en apparait un, le
//     banc ECHOUE au lieu de le sauter en silence : mieux vaut un banc qu'on
//     doit etendre qu'un banc qui se croit complet.
//
// ⭐⭐ CE QUE LA VERIFICATION A L'ENVERS A APPRIS. Ecrit d'abord avec le seul
// `sh -n`, ce banc laissait passer une mutation : retirer l'antislash de
// CONTINUATION d'un `RUN set -e; \`. Le premier morceau (`set -e;`) reste du
// shell parfaitement valide — `sh -n` dit oui — et les 10 lignes suivantes
// deviennent des instructions Docker orphelines. D'ou la section 1bis : tout ce
// qui est au premier niveau doit etre une instruction Docker CONNUE.
// ⭐ Un banc ne se juge pas sur ce qu'il attrape mais sur ce qu'il laisse
// passer, et ca ne se voit qu'en le cassant expres.
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOCKERFILE = process.env.DOCKERFILE_A_TESTER || join(RACINE, 'Dockerfile');

// Les scripts shell du depot subissent exactement le meme risque : ils sont
// COPIES dans l'image et lances par l'entrypoint, donc une faute de syntaxe
// dedans ne se voit qu'au demarrage du conteneur, en production.
const SCRIPTS = ['docker-entrypoint.sh'];

let echecs = 0;
function verifie(nom, condition, detail = '') {
  if (condition) {
    console.log(`   OK  ${nom}`);
  } else {
    echecs++;
    console.error(`   NON ${nom}${detail ? ` — ${detail}` : ''}`);
  }
}

// --- 1. Extraction des RUN, continuations recollees ------------------------
//
// Regles Docker respectees ici :
//  · une ligne qui se termine par `\` continue sur la suivante ;
//  · une ligne de COMMENTAIRE au milieu d'une continuation est RETIREE par
//    Docker avant d'atteindre le shell — donc on la retire aussi, sinon on
//    testerait un texte que le shell ne verra jamais ;
//  · l'instruction peut porter des drapeaux (`RUN --mount=...`) : ils ne font
//    pas partie du script.
const INSTRUCTIONS = new Set([
  'FROM', 'RUN', 'CMD', 'LABEL', 'MAINTAINER', 'EXPOSE', 'ENV', 'ADD', 'COPY',
  'ENTRYPOINT', 'VOLUME', 'USER', 'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL',
  'HEALTHCHECK', 'SHELL',
]);

// Decoupe le Dockerfile en instructions de PREMIER NIVEAU, continuations
// recollees. Chaque entree porte son mot-cle, ses numeros de ligne, et — pour
// les RUN — le script shell debarrasse des antislash.
function instructions(texte) {
  const lignes = texte.split('\n');
  const out = [];
  let i = 0;
  while (i < lignes.length) {
    const brute = lignes[i];
    if (/^[ \t]*$/.test(brute) || /^[ \t]*#/.test(brute)) { i++; continue; }
    const debut = i + 1; // numero de ligne humain
    const motCle = (brute.match(/^[ \t]*([A-Za-z][A-Za-z0-9_]*)/) || [, ''])[1].toUpperCase();
    const morceaux = [];
    let ligne = brute.replace(/^[ \t]*[A-Za-z][A-Za-z0-9_]*[ \t]*/, '');
    for (;;) {
      const continuee = /\\[ \t]*$/.test(ligne);
      morceaux.push(continuee ? ligne.replace(/\\[ \t]*$/, '') : ligne);
      if (!continuee) break;
      i++;
      // Sauter les lignes de commentaire internes, comme le fait Docker.
      while (i < lignes.length && /^[ \t]*#/.test(lignes[i])) i++;
      if (i >= lignes.length) break;
      ligne = lignes[i];
    }
    out.push({ motCle, debut, fin: i + 1, brute: brute.trim(), script: morceaux.join('\n') });
    i++;
  }
  return out;
}

console.log(`Dockerfile teste : ${DOCKERFILE}`);
if (!existsSync(DOCKERFILE)) {
  console.error(`\nECHEC : ${DOCKERFILE} est introuvable.`);
  process.exit(1);
}
const texte = readFileSync(DOCKERFILE, 'utf8');

// ⭐ Le garde-fou du banc lui-meme, et il vit DEHORS de ce qu'il surveille.
// Sans lui, une regexp cassee ferait un banc qui trouve zero RUN, ne teste
// rien, et sort VERT. C'est exactement la forme du defaut du 29/07 : un
// controle qui se croit arme parce qu'il ne dit rien.
const toutes = instructions(texte);
const runs = toutes.filter((x) => x.motCle === 'RUN');
console.log(`\n1. extraction`);
verifie('le Dockerfile contient des instructions RUN', runs.length > 0,
  'zero RUN trouve : soit le fichier a change de forme, soit l\'extraction est cassee');
console.log(`   ${runs.length} instruction(s) RUN, lignes ${runs.map((r) => r.debut).join(', ')}`);

// Plancher anti-aveuglement. Ce n'est pas une valeur a figer (on ajoutera des
// etapes) : c'est un seuil bas qui detecte une extraction devenue aveugle.
// Le Dockerfile du 30/07/2026 en compte 18.
verifie('l\'extraction voit au moins 10 RUN (plancher anti-aveuglement)', runs.length >= 10,
  `${runs.length} trouve(s)`);

const heredocs = runs.filter((r) => /<<-?\s*['"]?[A-Za-z_]/.test(r.script));
verifie('aucun heredoc (non gere par ce banc, cf. limite 4)', heredocs.length === 0,
  heredocs.map((r) => `ligne ${r.debut}`).join(', '));

// --- 1bis. Aucune ligne orpheline au premier niveau ------------------------
//
// Ce controle existe parce que le banc, teste a l'envers, laissait passer une
// continuation coupee : le debut du RUN restait du shell valide et la SUITE
// tombait au premier niveau. Docker refuserait le fichier, mais `sh -n` ne
// pouvait pas le savoir — il ne voit que ce qu'on lui donne.
console.log(`\n1bis. instructions de premier niveau`);
const inconnues = toutes.filter((x) => !INSTRUCTIONS.has(x.motCle));
verifie('toute ligne de premier niveau est une instruction Docker connue',
  inconnues.length === 0,
  inconnues.map((x) => `ligne ${x.debut} : « ${x.brute.slice(0, 48)} »`).join(' · '));
console.log(`   ${toutes.length} instruction(s) : ${[...new Set(toutes.map((x) => x.motCle))].join(' ')}`);
verifie('le fichier commence par un FROM', toutes.length > 0 && toutes[0].motCle === 'FROM',
  toutes.length ? `commence par ${toutes[0].motCle}` : 'fichier vide');

// --- 2. sh -n sur chaque RUN ----------------------------------------------
console.log(`\n2. controle de syntaxe (sh -n), un RUN a la fois`);
const base = mkdtempSync(join(tmpdir(), 'dockerfile-'));
let testes = 0;
let exec = 0;
try {
  for (const r of runs) {
    // Forme exec : pas de shell, rien a verifier.
    if (/^\s*\[/.test(r.script)) {
      exec++;
      console.log(`   --  ligne ${r.debut} : forme exec (JSON), pas de shell`);
      continue;
    }
    // Les drapeaux `--mount=...` precedent le script et n'en font pas partie.
    const script = r.script.replace(/^(\s*--[A-Za-z0-9-]+(=\S+)?\s*)+/, '');
    const f = join(base, `run-${r.debut}.sh`);
    writeFileSync(f, script + '\n');
    const res = spawnSync('sh', ['-n', f], { encoding: 'utf8' });
    testes++;
    const premiere = script.split('\n')[0].trim().slice(0, 62);
    if (res.status === 0) {
      console.log(`   OK  ligne ${String(r.debut).padStart(3)} · ${premiere}`);
    } else {
      echecs++;
      console.error(`   NON ligne ${String(r.debut).padStart(3)} · ${premiere}`);
      console.error(`        ${(res.stderr || res.stdout || `code ${res.status}`).trim().replace(/\n/g, '\n        ')}`);
      console.error(`        (RUN lignes ${r.debut}-${r.fin} du Dockerfile)`);
    }
  }

  // --- 3. Les scripts shell copies dans l'image ---------------------------
  console.log(`\n3. scripts shell du depot`);
  for (const nom of SCRIPTS) {
    const chemin = join(RACINE, nom);
    if (!existsSync(chemin)) {
      console.log(`   --  ${nom} absent`);
      continue;
    }
    const res = spawnSync('sh', ['-n', chemin], { encoding: 'utf8' });
    verifie(`${nom} est du shell valide`, res.status === 0, (res.stderr || '').trim());
  }
} finally {
  rmSync(base, { recursive: true, force: true });
}

console.log(`\nbilan : ${testes} RUN passes a sh -n · ${exec} en forme exec (sautes)`);
if (echecs) {
  console.error(`\nECHEC : ${echecs} verification(s) en defaut.`);
  console.error('Un RUN qui ne parse pas rend le build rouge en ~110 ms, sans message,');
  console.error('et empeche le garde-fou de l\'etape de tirer : il vit dans le RUN.');
  process.exit(1);
}
console.log('\nOK : chaque RUN du Dockerfile est du shell syntaxiquement valide.');
