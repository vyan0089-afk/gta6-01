// config.js — Every tuning number and name in Tanjung Matahari lives here.
//
// The city is a grid of named streets on a 900 x 900 metre island, sea to the
// west, a harbour to the south, a lighthouse on the north-west point. Changing
// a number here changes the whole game, because world.js, player.js, police.js
// and missions.js all read from this one module instead of keeping their own
// copies.

/** The city square, in metres, centred on (0, 0). */
export const WORLD_HALF = 450;
/** The sea starts west of this x. */
export const SEA_X = -430;
/** The harbour apron starts south of this z. */
export const HARBOUR_Z = 400;
/** Width of every road, in metres. */
export const ROAD_WIDTH = 14;
/** Half-width of a road lane, used by traffic. */
export const LANE_OFFSET = 3.4;

/** Vertical avenues (run north-south, constant x) with their names. */
export const AVENUES = [
  { x: -360, name: 'Jalan Pantai Barat' },
  { x: -240, name: 'Jalan Merdeka' },
  { x: -120, name: 'Jalan Kenanga' },
  { x: 0, name: 'Jalan Tanjung Raya' },
  { x: 120, name: 'Jalan Seroja' },
  { x: 240, name: 'Jalan Melati' },
  { x: 360, name: 'Jalan Pelabuhan' },
];

/** Horizontal streets (run east-west, constant z) with their names. */
export const STREETS = [
  { z: -360, name: 'Jalan Mercusuar' },
  { z: -240, name: 'Jalan Senja' },
  { z: -120, name: 'Jalan Anggrek' },
  { z: 0, name: 'Jalan Pasar' },
  { z: 120, name: 'Jalan Cempaka' },
  { z: 240, name: 'Jalan Nelayan' },
  { z: 360, name: 'Jalan Dermaga' },
];

/** Named places the missions and the map screen point at. */
export const LANDMARKS = {
  pasarMalam: { x: 0, z: 0, label: 'Pasar Malam' },
  gangSanca: { x: -180, z: -60, label: 'Gang Sanca' },
  lighthouse: { x: -418, z: -360, label: 'Mercusuar Tanjung' },
  harbour: { x: 120, z: 415, label: 'Pelabuhan Tanjung' },
  hospital: { x: 240, z: -240, label: 'Rumah Sakit Harapan' },
  garage: { x: -60, z: 180, label: 'Bengkel Raka' },
  markas: { x: 300, z: 300, label: 'Markas Gang Sanca' },
  pantai: { x: -400, z: 60, label: 'Pantai Matahari' },
  stasiun: { x: 180, z: -180, label: 'Stasiun Tanjung' },
  alunAlun: { x: 60, z: 60, label: 'Alun-Alun Matahari' },
};

/** Vehicle models. topSpeed is m/s, accel is m/s^2, grip is a 0..1 cornering factor. */
export const CAR_DEFS = {
  sedan: {
    id: 'sedan', name: 'Sedan Kota', topSpeed: 34, accel: 11, brake: 26, grip: 0.9,
    length: 4.6, width: 1.9, height: 1.35, colours: [
      [0.72, 0.12, 0.10], [0.10, 0.25, 0.55], [0.85, 0.82, 0.75],
      [0.15, 0.15, 0.17], [0.55, 0.75, 0.25], [0.80, 0.55, 0.10],
    ],
  },
  hatchback: {
    id: 'hatchback', name: 'City Car', topSpeed: 30, accel: 12, brake: 26, grip: 1.0,
    length: 3.9, width: 1.8, height: 1.45, colours: [
      [0.90, 0.75, 0.15], [0.20, 0.60, 0.65], [0.85, 0.30, 0.45],
      [0.75, 0.75, 0.78], [0.30, 0.45, 0.90],
    ],
  },
  pickup: {
    id: 'pickup', name: 'Pikap Muatan', topSpeed: 28, accel: 9, brake: 22, grip: 0.8,
    length: 5.2, width: 2.0, height: 1.7, colours: [
      [0.35, 0.45, 0.20], [0.70, 0.35, 0.15], [0.25, 0.30, 0.45],
      [0.60, 0.60, 0.55],
    ],
  },
  truck: {
    id: 'truck', name: 'Truk Es', topSpeed: 24, accel: 7, brake: 18, grip: 0.65,
    length: 7.5, width: 2.4, height: 2.9, colours: [
      [0.85, 0.85, 0.88], [0.20, 0.50, 0.70], [0.75, 0.60, 0.25],
    ],
  },
  taxi: {
    id: 'taxi', name: 'Taksi Senja', topSpeed: 32, accel: 11, brake: 25, grip: 0.9,
    length: 4.5, width: 1.9, height: 1.45, colours: [[0.95, 0.80, 0.10]],
  },
  sport: {
    id: 'sport', name: 'Sport Merah', topSpeed: 44, accel: 16, brake: 30, grip: 1.15,
    length: 4.4, width: 2.0, height: 1.15, colours: [[0.85, 0.08, 0.08]],
  },
  police: {
    id: 'police', name: 'Mobil Patroli', topSpeed: 40, accel: 14, brake: 30, grip: 1.05,
    length: 4.8, width: 2.0, height: 1.45, colours: [[0.92, 0.92, 0.94]],
  },
  van: {
    id: 'van', name: 'Van Pengantar', topSpeed: 27, accel: 8, brake: 20, grip: 0.75,
    length: 5.4, width: 2.1, height: 2.1, colours: [
      [0.80, 0.80, 0.82], [0.30, 0.55, 0.35], [0.65, 0.45, 0.20],
    ],
  },
};

/** How many of each crowd the city holds. */
export const CROWD = {
  trafficCars: 32,
  parkedCars: 20,
  pedestrians: 60,
  policePatrol: 3,
};

/** Weapons. damage is hit points, range is metres, rate is shots per second. */
export const WEAPONS = {
  fists: { id: 'fists', name: 'Tinju', damage: 25, range: 2.4, rate: 2.2, ammo: Infinity, slot: 0 },
  pistol: { id: 'pistol', name: 'Pistol', damage: 34, range: 42, rate: 3.0, ammo: 24, slot: 1 },
  shotgun: { id: 'shotgun', name: 'Shotgun', damage: 90, range: 16, rate: 0.9, ammo: 8, slot: 2 },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'shotgun'];

/** Wanted level labels, shown under the stars. */
export const WANTED_LABELS = [
  'Bersih',
  'Dicari Polisi',
  'Buronan Kota',
  'Bahaya — Kabur!',
  'Siaga Satu',
  'Paling Dicari',
];

/** Named police units, one per wanted level, used in the HUD distance list. */
export const POLICE_UNITS = [
  { name: 'Unit Elang 1', kind: 'patrol' },
  { name: 'Unit Garuda 2', kind: 'patrol' },
  { name: 'Unit Sanca 3', kind: 'patrol' },
  { name: 'Unit Badai 4', kind: 'chase' },
  { name: 'Helikopter Elang', kind: 'heli' },
];

/** How many police cars chase at each wanted level (index = wanted). */
export const POLICE_COUNT = [0, 1, 2, 3, 4, 5];
/** Seconds a busted timer runs when police corner the player on foot. */
export const BUST_SECONDS = 3.0;
/** Wanted decays this much per second while no police can see the player. */
export const WANTED_DECAY = 0.05;

/** Respect ranks, earned from missions completed. */
export const RESPECT_RANKS = [
  { at: 0, name: 'Anak Baru', blurb: 'Baru turun ke jalanan Tanjung.' },
  { at: 2, name: 'Tukang Ojek', blurb: 'Orang pasar mulai kenal nama Raka.' },
  { at: 4, name: 'Preman Pasar', blurb: 'Gang Sanca mulai waspada.' },
  { at: 6, name: 'Bos Gang', blurb: 'Satu kota bicara soal Raka.' },
  { at: 8, name: 'Legenda Tanjung', blurb: 'Nama Raka abadi di Tanjung Matahari.' },
];

/** The three radio stations, with their sequencer settings. */
export const RADIO_STATIONS = [
  {
    name: 'Dangdut Pantura FM', freq: '98.4 FM', bpm: 132, root: 57,
    scale: [0, 3, 5, 7, 10], style: 'dangdut',
    blurb: 'Goyang pantura, koplo nonstop!',
  },
  {
    name: 'Radio Senja FM', freq: '101.2 FM', bpm: 96, root: 60,
    scale: [0, 2, 4, 7, 9], style: 'pop',
    blurb: 'Lagu senja untuk jalanan sore.',
  },
  {
    name: 'Rock Tanjung FM', freq: '104.7 FM', bpm: 148, root: 52,
    scale: [0, 3, 5, 6, 7, 10], style: 'rock',
    blurb: 'Distorsi keras dari tepi pelabuhan.',
  },
];

/** Lines Raka mutters while wandering free-roam (picked at random). */
export const MUTTERINGS = [
  'Tanjung Matahari… kota ini tidak pernah tidur.',
  'Nanti sore mampir Pasar Malam, lapar juga.',
  'Gang Sanca masih berutang padaku. Akan kutagih.',
  'Angin laut sore ini enak. Cocok buat ngebut.',
  'Sari pasti sudah menunggu di pasar.',
  'Kalau ada mobil bagus parkir, sayang dilewatkan.',
  'Mercusuar itu saksi semua rahasiaku.',
  'Suatu hari, kota ini akan kenal nama Raka.',
  'Bensin mahal, tapi jalanan tetap memanggil.',
  'Dangdut di radio itu… lumayan juga.',
  'Awas, polisi suka nongkrong di Jalan Merdeka.',
  'Pelabuhan malam ini ramai. Ada peluang.',
];

/** Lines bystanders say when Raka bumps into them. */
export const PED_LINES = [
  'Awas, mas!',
  'Hei, hati-hati dong!',
  'Mau ke mana, mas?',
  'Jangan ganggu saya!',
  'Waduh, hampir saja!',
  'Tolong, jangan sakiti saya!',
];

/** Controls shown on the title screen and the pause help. */
export const CONTROLS = [
  ['W A S D', 'Jalan / mengemudi'],
  ['Shift', 'Lari (saat jalan kaki)'],
  ['E', 'Masuk / keluar mobil'],
  ['F / Klik kiri', 'Pukul / tembak'],
  ['Q', 'Roda senjata'],
  ['1 / 2 / 3', 'Tinju / Pistol / Shotgun'],
  ['R', 'Ganti stasiun radio'],
  ['H', 'Klakson'],
  ['M', 'Peta Tanjung Matahari'],
  ['J', 'Mulai kerja sampingan'],
  ['Esc / P', 'Jeda'],
];

/** The clock the game starts at (06:30) and how fast it runs. */
export const CLOCK_START_SECONDS = 6 * 3600 + 30 * 60;
export const CLOCK_RATE = 24; // one game minute per 2.5 real seconds

/** Snapshot of a fresh player, used by New Game and by the shot stager. */
export function freshPlayerState() {
  return {
    x: 24, z: 24, angle: -Math.PI / 2, speed: 0,
    health: 100, armour: 0, money: 300,
    weapon: 'fists', ammo: { pistol: 24, shotgun: 8 },
    onFoot: true, wanted: 0,
  };
}
