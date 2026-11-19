# Tanjung Matahari

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/vyan0089-afk/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/vyan0089-afk/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**Tanjung Matahari** is an original 3D open-world crime game set in a sun-soaked Indonesian coastal city, built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). No Rockstar assets, no libraries, no network — the whole game is hand-written JavaScript and a from-scratch WebGL renderer.

## The story

Raka, a driver from the harbour district, is drawn into the Tanjung underworld. Across **8 staged story missions in 3 chapters** he steals cars, races the beach road, smuggles crates through the harbour, settles old debts, survives a 3-star manhunt, fights a gang war, and pulls off one last heist: a gold Panther GT from a hillside villa, escaping a 5-star dragnet to the boats.

## What is in the game

- **A living city** — grid streets, a night market, the harbour with pier and cranes, a beach, an old town and hillside villas, all built from low-poly boxes with a warm palette (sand, terracotta, teal sea).
- **On foot and by car** — walk, run, punch, shoot; enter any car with **E** (parked and traffic cars are stealable — stealing raises your wanted level).
- **Traffic and pedestrians** — cars follow the road network, pedestrians stroll the sidewalks and flee from gunfire and speeding cars.
- **Wanted level 1–5 stars** — police patrol cars chase on the road graph, named dispatch units radio in (Elang-1, Kancil-2, Garuda-3…), a helicopter joins at 4 stars, roadblocks close the city at 5.
- **Combat** — fists, pistol and shotgun, with a weapon wheel (hold **Q**, or **1/2/3**).
- **Progression** — money, respect ranks (Anak Baru → Sopir Handal → Juragan Jalanan → Legenda Tanjung), a garage with engine / armour / paint upgrades.
- **Side jobs** — taxi fares, courier deliveries and street races.
- **Save / load** — autosave after every mission, Continue / New Game on the title screen, localStorage only.
- **Radio** — three stations (Radio Matahari, Pantai FM, Kota FM) with synthesised tracks; **R** changes station.
- **HUD** — health, armour, money, wanted stars, live minimap with mission markers and a north arrow, objective text, speed, dispatch feed.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk / drive (gas, brake, steer) |
| Mouse (drag) | Orbit camera |
| E | Enter/exit car, take crates, start jobs, open garage |
| Shift | Run |
| F | Punch |
| Left click | Shoot |
| Q (hold) / 1 2 3 | Weapon wheel / switch weapon |
| R | Change radio station |
| Space | Handbrake |
| Esc | Pause |

## How to run

```sh
node serve.ts
# open http://localhost:8080
```

Just static files: `game/index.html` plus the ES modules under `game/src/`. No build step, no internet needed.

## How it is built

- `game/src/renderer.js` — from-scratch WebGL renderer (one shader, vertex-lit boxes; static city mesh + dynamic buffer).
- `game/src/city.js` — deterministic city generation (seeded RNG): streets, buildings, market, harbour, villas, palms, road graph.
- `game/src/vehicles.js` — arcade car physics, traffic AI on the road graph.
- `game/src/peds.js` — pedestrians and hostile gang members.
- `game/src/police.js` — wanted system, chases, helicopter, roadblocks, dispatch.
- `game/src/missions.js` — 8 story missions + side jobs, all staged.
- `game/src/hud.js` — HUD, minimap, menus.
- `game/src/audio.js` — synthesised sound: engine, sirens, gunshots, radio.
- `game/src/game.js` — world state, player, combat, garage, save.
- `game/src/main.js` — bootstrap, game loop, deterministic screenshot staging (`?shot=title|drive|mission|city`).
- `main.ts` — the grader entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
