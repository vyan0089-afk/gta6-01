// Tanjung Matahari — the make.fun gta6-01 entrypoint (Node 22, stdlib only).
// The game is the static folder game/ (plain ES modules, no libraries, no
// network requests): a desktop browser loads game/index.html offline and
// plays. This program hands it in: it copies game/ and screenshots/ from
// beside this file to /output and writes /output/dossier.json, the summary
// the judge reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The copy is byte-for-byte deterministic: the same tree always produces
// the same /output, so a second run can be diffed against the first to
// prove nothing in the hand-in wobbled between runs.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const SHOT_EXT = /\.(jpe?g|png)$/i;
const MAX_SHOT_BYTES = 262144;

// Copy the game and the screenshots into the output folder.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer refuses more than 4 screenshots or one over 256 KiB, so check
// the set before writing the dossier instead of handing in a refused entry.
const shotsDir = join(here, 'screenshots');
const shots = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((f) => SHOT_EXT.test(f)).sort()
  : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`expected 3-4 screenshots, found ${shots.length}`);
}
for (const f of shots) {
  const size = statSync(join(shotsDir, f)).size;
  if (size > MAX_SHOT_BYTES) {
    throw new Error(`screenshot ${f} is ${size} bytes, over the 256 KiB cap`);
  }
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or
// 48 MiB of game files, in all, or a path under game/ over 1000 bytes).
const gameFiles = readdirSync(join(out, 'game'), { recursive: true });
console.log(`game/ copied: ${gameFiles.length} files`);
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: MAX_SHOT_BYTES },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Tanjung Matahari -> ${out} (${shots.length} screenshots: ${shots.join(', ')})`);
console.log(`dossier.json: ${statSync(join(out, 'dossier.json')).size} bytes`);
