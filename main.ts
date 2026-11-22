// Ember Duel — main.ts (Node 22, standard library only)
//
// The hand-in program for the Best Card Game bounty. It takes this
// repository's game/ (the playable static game) and screenshots/ (four real
// renders of it) and writes them to /output together with /output/dossier.json,
// the summary the judge reads, built with the vendored make.fun library.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The program is deterministic on purpose: it clears the output directory
// first, then copies the same files in the same order, so two runs write the
// same bytes. It refuses to hand in an entry the gate would refuse (too many
// screenshots, one too big, too many game files, or a game folder too large),
// so a failure here is caught before submission, not after.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's own caps, from the kit's reference/gate.json. Only
// text_max_bytes shapes the dossier's bytes; the rest refuse an entry the
// scorer would refuse outright.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function countEntries(dir) {
  let total = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    total += 1;
    if (statSync(path).isDirectory()) total += countEntries(path);
  }
  return total;
}

function folderBytes(dir) {
  let total = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const info = statSync(path);
    total += info.isDirectory() ? folderBytes(path) : info.size;
  }
  return total;
}

function fail(message) {
  throw new Error(`Ember Duel hand-in refused: ${message}`);
}

// Fresh output every run, so a stale file can never leak into the entry.
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
if (!existsSync(gameDir)) fail('game/ is missing');
if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');

const gameFiles = countEntries(gameDir);
if (gameFiles > DOSSIER_CAPS.game_max_files) {
  fail(`game/ holds ${gameFiles} entries, over the ${DOSSIER_CAPS.game_max_files} cap`);
}
const gameBytes = folderBytes(gameDir);
if (gameBytes > DOSSIER_CAPS.game_max_bytes) {
  fail(`game/ is ${gameBytes} bytes, over the ${DOSSIER_CAPS.game_max_bytes} cap`);
}

if (existsSync(shotsDir)) {
  const shots = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
  if (shots.length > DOSSIER_CAPS.screenshots.max) {
    fail(`${shots.length} screenshots, over the ${DOSSIER_CAPS.screenshots.max} cap`);
  }
  for (const name of shots) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > DOSSIER_CAPS.screenshots.max_bytes) {
      fail(`screenshots/${name} is ${size} bytes, over the 256 KiB cap`);
    }
  }
}

cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

writeFileSync(join(out, 'dossier.json'), buildDossier(out, DOSSIER_CAPS));
