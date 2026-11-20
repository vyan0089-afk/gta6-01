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
- **Save / load** — autosave after every mission, Continue / New Game on the title screen, two save slots on the map screen, localStorage only.
- **Collectibles** — 12 golden Patung Tanjung statues hidden near the city's landmarks.
- **Radio** — four stations (Radio Matahari, Pantai FM, Kota FM, Senja FM for the golden hour) with synthesised tracks; **R** changes station.
- **HUD** — health/armour with numbers, money, respect rank, wanted stars, in-game clock, mission stage (e.g. "Misi 6/8 · Tahap 1/2"), objective counters ("Usir 2/5"), a spoken line from Raka during missions, vehicle name + speed + condition, chasing police units with distance, live minimap with mission markers and a north arrow, objective text, dispatch feed.
- **Map screen (M)** — a big map of Tanjung, all 8 story missions with progress, career stats, the 12 Patung Tanjung statues (X/12) and two save slots.
- **Lighting** — three deterministic presets: bright midday, golden hour (low warm sun, orange haze) and night (lamps and headlights carry the scene).

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
| M | Map, missions & saves |
| Esc | Pause |

## How to run

```sh
node serve.ts
# open http://localhost:8080
```

Just static files: `game/index.html` plus the ES modules under `game/src/`. No build step, no internet needed.

## Screenshots

Four staged, deterministic shots (`shots.json`, `?shot=` + `seed=1`):

1. `1-chase.jpg` — golden-hour chase on Jalan Pantai: wanted 4, helicopter, patrol cars and traffic on the road.
2. `2-mission.jpg` — golden-hour fight in Pasar Malam: Raka vs Gang Sanca, counter at "Usir 2/5".
3. `3-drive-night.jpg` — night drive on Jalan Merdeka in the gold Panther GT, wanted 2.
4. `4-map.jpg` — the map screen: big map, 8 missions with progress, career stats, statues 4/12, save slots.

## How it is built

- `game/src/renderer.js` — from-scratch WebGL renderer (one shader, vertex-lit boxes; static city mesh + dynamic buffer) with day / golden-hour / night lighting presets.
- `game/src/city.js` — deterministic city generation (seeded RNG): streets, buildings, market, harbour, villas, palms, warung carts on Jalan Pantai, road graph.
- `game/src/vehicles.js` — arcade car physics, traffic AI on the road graph.
- `game/src/peds.js` — pedestrians and hostile gang members.
- `game/src/police.js` — wanted system, chases, helicopter, roadblocks, dispatch.
- `game/src/missions.js` — 8 story missions + side jobs, all staged, with per-stage dialogue and objective counters.
- `game/src/hud.js` — HUD, minimap, map screen, menus.
- `game/src/audio.js` — synthesised sound: engine, sirens, gunshots, radio.
- `game/src/game.js` — world state, player, combat, garage, save, statues, map screen.
- `game/src/main.js` — bootstrap, game loop, deterministic screenshot staging (`?shot=chase|mission|drive|map`).
- `main.ts` — the grader entrypoint: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
