// main.ts — The entry program for Tanjung Matahari (gta6-01).
//
// Node 22, standard library only. It hands the game in: copy this
// repository's game/ and screenshots/ into the output directory and write
// /output/dossier.json with buildDossier from the vendored make.fun library.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output, so a local
// run looks like:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The program writes the same bytes on every run: it copies files in
// directory order and the dossier builder is deterministic, so the two
// grading runs agree byte for byte.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output directory: the game first, then the screenshots.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own (reference/gate.json): the dossier text is
// capped at 160 KiB, at most 4 screenshots of 256 KiB each, game/ at most
// 993 files and 48 MiB. Anything over those is refused here first, exactly
// as the scorer would refuse it.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
