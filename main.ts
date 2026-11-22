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
// screenshots, one too big, one in the wrong format or size, too many game
// files, a game folder too large, or a dossier over 1.5 MiB), so a failure
// here is caught before submission, not after.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

// The gate's own caps for the dossier and the screenshots (RULES.txt).
const DOSSIER_MAX_BYTES = 1572864; // 1.5 MiB
const SHOT_LONG_SIDE_MAX = 1280;
const SHOT_SHORT_SIDE_MIN = 480;

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

// Dimensions of a whole PNG or JPEG, read from its header bytes. Throws
// when the bytes are neither (the gate requires a whole PNG or JPEG).
function imageDimensions(buf) {
  // PNG: 8-byte signature, then IHDR with width/height as big-endian u32.
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: SOI marker, then segments until a start-of-frame carries the size.
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    let offset = 2;
    while (offset + 9 < buf.length) {
      // Skip fill bytes: a marker is 0xFF followed by a non-0xFF byte.
      while (buf[offset] === 0xff && buf[offset + 1] === 0xff) offset += 1;
      if (buf[offset] !== 0xff) fail('malformed JPEG screenshot');
      const marker = buf[offset + 1];
      if (marker === 0xd9 || marker === 0xda) fail('JPEG screenshot has no frame header');
      const length = buf.readUInt16BE(offset + 2);
      if (length < 2) fail('malformed JPEG screenshot');
      // Start-of-frame markers (0xC0-0xCF except DHT/JPG/DAC) hold the size:
      // precision (1 byte), height (2), width (2).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
    fail('JPEG screenshot has no frame header');
  }
  fail('screenshot is neither PNG nor JPEG');
}

// Fresh output every run, so a stale file can never leak into the entry.
// Only the directory's CONTENTS are removed, never the directory itself:
// /output may be a mount point, and removing it can fail with EBUSY.
if (existsSync(out)) {
  for (const name of readdirSync(out)) {
    rmSync(join(out, name), { recursive: true, force: true });
  }
}
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
    const path = join(shotsDir, name);
    const size = statSync(path).size;
    if (size > DOSSIER_CAPS.screenshots.max_bytes) {
      fail(`screenshots/${name} is ${size} bytes, over the 256 KiB cap`);
    }
    const { width, height } = imageDimensions(readFileSync(path));
    const longSide = Math.max(width, height);
    const shortSide = Math.min(width, height);
    if (longSide > SHOT_LONG_SIDE_MAX) {
      fail(`screenshots/${name} is ${width}x${height}, long side over the 1280 cap`);
    }
    if (shortSide < SHOT_SHORT_SIDE_MIN) {
      fail(`screenshots/${name} is ${width}x${height}, short side under the 480 minimum`);
    }
  }
}

cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, DOSSIER_CAPS);
if (dossier.length > DOSSIER_MAX_BYTES) {
  fail(`dossier.json would be ${dossier.length} bytes, over the 1.5 MiB cap`);
}
writeFileSync(join(out, 'dossier.json'), dossier);
