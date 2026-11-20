# Tanjung Matahari — Make GTA 6

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/vyan0089-afk/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/vyan0089-afk/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game in a sun-soaked Indonesian coastal city,
built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01).
Play it offline in a desktop browser: open `game/index.html` or run
`node serve.ts` and visit http://localhost:8080.

## The game

You are **Raka**, back home in Gang Sanca after years away. Tanjung Matahari
is a living city: 32 traffic cars, 20 parked cars to steal, 60+ pedestrians,
a night market, a fishing harbour, a hill district and a golden beach.

- **8 story missions in 3 chapters** — from delivering soto in Pasar Malam
  to the final showdown on Bukit Senja, with dialogue in Indonesian.
- **Wanted 1–5** — named police units chase you, a helicopter circles from
  4 stars, roadblocks appear at 5, and a bust timer runs when you are caught
  on foot.
- **Carjacking (E), combat** — fists, pistol and shotgun with real ammo,
  weapon wheel (Q / 1-2-3), reload (T).
- **Garage** — store up to 8 cars, fit nitro, full service.
- **3 side jobs** (taxi, courier, night guard), **3 street races** with
  rivals, **12 golden keris** collectibles, **20 tour spots**,
  **26 achievements**, **3 save slots + autosave**, **3 radio stations**
  (Dangdut Pantai 88.4, Pop Tanjung 101.2, Rock Senja 95.7), gamepad support,
  rain and lightning, traffic lights, boats and a day/night cycle.
- **HUD** — health/armour, money, wanted stars, mission stage, objective
  counters, dialogue, police distances, speedometer, radio, clock, street
  name, and a live minimap plus a map screen with career stats.

## Controls

WASD move/drive · mouse drag camera · E steal/enter car · left click shoot ·
Q weapon · R radio · M map · Esc pause · Space jump/handbrake · Shift sprint/nitro.

## Tech

A custom WebGL2 engine written from scratch (no libraries, no assets, no
network): plain ES modules under `game/src/`, seeded RNG throughout, and a
`main.ts` (Node 22 stdlib only) that hands the game in via the vendored
`vendor/makefun-game.ts`.

## License

MIT — see [LICENSE](LICENSE).
