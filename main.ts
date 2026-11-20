// main.ts — Tanjung Matahari for the make.fun bounty gta6-01.
// Node 22, standard library only. This program hands the game in: it copies
// game/ (the playable static game) and screenshots/ (four real renders of
// the game) from beside this file into /output — or MAKEFUN_OUTPUT_DIR
// outside the grader — and writes /output/dossier.json with the vendored
// make.fun library's buildDossier, so the scorer and the judge read exactly
// what the game is. The program is deterministic: same files in, same
// bytes out, every run.
//
// Run it locally:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The gate's own caps: at most 4 screenshots of 256 KiB, at most 993
// files and 48 MiB under game/, and the dossier text capped at 160 KiB.
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
