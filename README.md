# Tanjung Matahari

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/vyan0089-afk/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/vyan0089-afk/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

An open-world crime game in the spirit of GTA 6, built from scratch for the
[make.fun](https://make.fun) **gta6-01** bounty. Raka comes home broke to
Tanjung Matahari, an original Indonesian coastal city — and the whole city is
about to learn his name.

## The game

- **A living city**: a 900 × 900 m grid of named streets (Jalan Merdeka, Jalan
  Pantai Barat, Jalan Tanjung Raya…), ~32 traffic cars, ~60 pedestrians,
  ~20 parked cars, a night market (Pasar Malam), a harbour full of containers,
  a beach, and a lighthouse on the north-west point.
- **Eight story missions in three chapters**: from meeting Sari at the market,
  through collecting the Gang Sanca's debt and a beach chase, to storming the
  gang's stronghold and a five-star escape to the lighthouse.
- **Wanted 1–5**: named police units chase Raka, a helicopter joins at 4★,
  roadblocks go up at 5★, and a bust timer runs when the police corner him on
  foot. Getting caught costs a fine and a trip to Rumah Sakit Harapan.
- **Stealable cars**: press E near any parked or traffic car. Theft raises
  the wanted level. Eight vehicle models, from the City Car to the red Sport.
- **Combat**: fists, pistol and shotgun with real ammo counts, a weapon wheel
  (Q), and enemies who chase and fight back.
- **Progression**: respect ranks from Anak Baru to Legenda Tanjung, three
  side jobs (Ojek Kilat, Antar Paket, Taksi Senja), 12 golden keris to find,
  and career stats on the map screen.
- **Presentation**: a custom WebGL2 engine (no libraries), day / golden-hour /
  night lighting, a rich HUD with health and armour numbers, money, mission
  stage and objective counters, dialogue lines, police-unit distances, speed
  and the radio station, a live minimap, and a full map screen
  (**PETA TANJUNG MATAHARI**). Three synthesised radio stations — Dangdut
  Pantura FM, Radio Senja FM, Rock Tanjung FM — plus engine hum, a horn, a
  mission-complete jingle and gunshots, all generated with WebAudio.
- **Save**: three localStorage slots from the pause menu; New Game clears them.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Walk / drive |
| Shift | Sprint |
| E | Enter / exit a car (steal it) |
| F / left click | Punch / shoot |
| Q | Weapon wheel |
| 1 / 2 / 3 | Fists / pistol / shotgun |
| R | Change radio station |
| H | Horn |
| M | Map of Tanjung Matahari |
| J | Start a side job nearby |
| Esc / P | Pause & save |

Drag the mouse to orbit the camera.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/` is plain static files and plays offline in
desktop Chrome.

## Screenshots

The four screenshots in `screenshots/` are real renders of the game, staged
by `game/src/shots.js` through `?shot=chase|mission|drive-night|map`:

1. `1-chase.jpg` — golden-hour chase: the red sport car, police helicopter,
   traffic, 4 wanted stars, HUD, minimap and radio.
2. `2-mission.jpg` — on foot at Gang Sanca, small yellow diamond marker,
   objective counter "Usir 2/5".
3. `3-drive-night.jpg` — night drive down Jalan Merdeka, 2 stars.
4. `4-map.jpg` — the PETA TANJUNG MATAHARI screen.

## Layout

- `game/index.html` — page, HUD and menus
- `game/src/main.js` — game object, loop, input, camera, screens
- `game/src/render.js` — custom WebGL2 renderer
- `game/src/world.js` — seeded city, traffic and pedestrians
- `game/src/player.js` — walking, driving, stealing, combat
- `game/src/police.js` — wanted system, chases, helicopter, roadblocks
- `game/src/missions.js` — 8 story missions, side jobs, dialogue
- `game/src/hud.js` — HUD, minimap, map screen
- `game/src/audio.js` — WebAudio synth: radio, engine, jingle, gunshots
- `game/src/save.js` — localStorage save slots and career stats
- `game/src/shots.js` — the four screenshot scenes
- `game/src/config.js` — streets, vehicles, weapons, radio, ranks
- `game/src/rng.js` — seeded RNG
- `main.ts` — the entry program (copies game/ + screenshots/ to /output)
- `serve.ts` — local static server

## License

MIT — see `LICENSE`.
