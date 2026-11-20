// config.js — Static data for Tanjung Matahari: the city, its people, its cars,
// its radio and its story. No logic lives here, only the facts every system
// reads: district names, street names, car models, colours, keris spots,
// tour spots, radio stations and the respect ranks. All original names.

/** World size in metres. The city is a square; the sea lies to the south. */
export const WORLD = {
  size: 640,
  half: 320,
  block: 64,
  roadWidth: 14,
  seaZ: 300,
  beachZ: 272,
  seed: 20261120,
};

/** Game clock: one game hour passes every 150 real seconds. */
export const CLOCK = {
  secondsPerHour: 150,
  startHour: 16.4,
  sunrise: 5.5,
  sunset: 18.2,
};

/** The six districts of Tanjung Matahari, each with its own flavour. */
export const DISTRICTS = [
  { id: 'pantai', name: 'Pantai Matahari', desc: 'Golden beach, food stalls and sunset crowds', cx: -120, cz: 240, r: 130, colour: '#e8c37a' },
  { id: 'pasar', name: 'Pasar Malam', desc: 'Night market lanes, dangdut speakers and satay smoke', cx: 40, cz: 150, r: 110, colour: '#ff9a3d' },
  { id: 'sanca', name: 'Gang Sanca', desc: 'Tight alleys, motorbikes and Raka\u2019s home turf', cx: -180, cz: 40, r: 110, colour: '#c96f4a' },
  { id: 'kotatua', name: 'Kota Tua', desc: 'Old shophouses, the mosque square and the clock tower', cx: 60, cz: -40, r: 130, colour: '#d8c9a3' },
  { id: 'pelabuhan', name: 'Pelabuhan', desc: 'Fishing harbour, containers and night boats', cx: 200, cz: 170, r: 110, colour: '#5f8fa8' },
  { id: 'bukit', name: 'Bukit Senja', desc: 'Hill villas above the bay, the rich side of town', cx: -40, cz: -210, r: 130, colour: '#7fae7a' },
];

/** Street names, grouped by direction so the HUD can name where you are. */
export const STREETS_NS = [
  'Jl. Merdeka', 'Jl. Pantai Indah', 'Jl. Kenanga', 'Jl. Sinar Bulan',
  'Jl. Melati', 'Jl. Cendrawasih', 'Jl. Bambu Kuning', 'Jl. Teratai',
];
export const STREETS_EW = [
  'Jl. Sudirman', 'Jl. Diponegoro', 'Jl. Gajah Mada', 'Jl. Kartini',
  'Jl. Pahlawan', 'Jl. Veteran', 'Jl. Anggrek', 'Jl. Flamboyan',
];

/** Car models that spawn in the city. weight = how common it is. */
export const CAR_MODELS = [
  { name: 'Kijang Kota', kind: 'mpv', top: 26, accel: 7, colour: ['#c8ccd2', '#7a1f1f', '#2e5d8a', '#d8b13c'], weight: 10 },
  { name: 'Bemo Kuning', kind: 'van', top: 22, accel: 6, colour: ['#e8b73c', '#3c7a3c'], weight: 6 },
  { name: 'Sedan Senja', kind: 'sedan', top: 32, accel: 9, colour: ['#22242a', '#8a8f96', '#5d2a6e', '#a33b2e'], weight: 9 },
  { name: 'Pickup Sawah', kind: 'pickup', top: 28, accel: 8, colour: ['#4a6b3a', '#8a6b3a', '#c8ccd2'], weight: 7 },
  { name: 'Sport Merah', kind: 'sport', top: 46, accel: 14, colour: ['#c81e1e', '#e8a13c', '#1e5dc8'], weight: 4 },
  { name: 'Taksi Biru', kind: 'taxi', top: 30, accel: 9, colour: ['#2e6fc8'], weight: 5 },
  { name: 'Angkot Hijau', kind: 'van', top: 24, accel: 6, colour: ['#2e8a4a', '#e8e8e8'], weight: 6 },
  { name: 'Coupe Malam', kind: 'sport', top: 44, accel: 13, colour: ['#1a1a22', '#6e1a5d', '#c8c8c8'], weight: 3 },
  { name: 'Truk Kontainer', kind: 'truck', top: 20, accel: 5, colour: ['#7a7f86', '#a33b2e'], weight: 3 },
  { name: 'Motor Bebek', kind: 'bike', top: 30, accel: 11, colour: ['#c81e1e', '#22242a', '#2e8a4a'], weight: 5 },
];

/** Police unit names by wanted level. */
export const POLICE_UNITS = [
  { level: 1, name: 'Patroli Pantai', cars: 1 },
  { level: 2, name: 'Satuan Sanca', cars: 2 },
  { level: 3, name: 'Brimob Kota', cars: 3 },
  { level: 4, name: 'Elang Udara', cars: 4 },
  { level: 5, name: 'Operasi Senja', cars: 6 },
];

/** Respect ranks earned by story progress, money and chaos. */
export const RESPECT_RANKS = [
  { min: 0, name: 'Anak Baru', desc: 'Nobody knows your name yet.' },
  { min: 120, name: 'Anak Pantai', desc: 'The beach stalls nod when you pass.' },
  { min: 300, name: 'Jagoan Sanca', desc: 'Gang Sanca has your back.' },
  { min: 600, name: 'Raja Pasar', desc: 'The night market pays you respect.' },
  { min: 1000, name: 'Legenda Tanjung', desc: 'Every street in Tanjung Matahari knows Raka.' },
];

/** The twelve golden keris collectibles and where they hide. */
export const KERIS_SPOTS = [
  { id: 'k1', name: 'Keris Pantai', x: -210, z: 255, hint: 'Behind the lifeguard hut on Pantai Matahari' },
  { id: 'k2', name: 'Keris Pasar', x: 96, z: 196, hint: 'Between the satay stalls of Pasar Malam' },
  { id: 'k3', name: 'Keris Gang', x: -238, z: 88, hint: 'Down the narrowest alley of Gang Sanca' },
  { id: 'k4', name: 'Keris Menara', x: 8, z: -92, hint: 'At the foot of the old clock tower' },
  { id: 'k5', name: 'Keris Dermaga', x: 252, z: 228, hint: 'On the far pier of Pelabuhan' },
  { id: 'k6', name: 'Keris Bukit', x: -96, z: -258, hint: 'Beside the hill villa viewpoint' },
  { id: 'k7', name: 'Keris Masjid', x: 118, z: -8, hint: 'In the mosque square garden' },
  { id: 'k8', name: 'Keris Taman', x: -40, z: 60, hint: 'Under the big banyan tree in the park' },
  { id: 'k9', name: 'Keris Stasiun', x: 168, z: -140, hint: 'Behind the old train station wall' },
  { id: 'k10', name: 'Keris Warung', x: -160, z: 170, hint: 'Behind Mak Ijah\u2019s warung on the beach road' },
  { id: 'k11', name: 'Keris Pelabuhan', x: 150, z: 260, hint: 'Inside the container yard, blue stack' },
  { id: 'k12', name: 'Keris Senja', x: 40, z: -252, hint: 'At the sunset lookout on Bukit Senja' },
];

/** Twenty tour spots: viewpoints and landmarks for the map screen. */
export const TOUR_SPOTS = [
  { name: 'Pantai Matahari', x: -120, z: 262, desc: 'Sunset beach, the postcard of Tanjung Matahari' },
  { name: 'Menara Jam Tua', x: 8, z: -92, desc: 'The 1924 clock tower of Kota Tua' },
  { name: 'Masjid Agung', x: 118, z: -8, desc: 'White domes over the old square' },
  { name: 'Pasar Malam', x: 40, z: 150, desc: 'A hundred stalls, one long smell of satay' },
  { name: 'Dermaga Nelayan', x: 252, z: 228, desc: 'Fishing boats and gulls at dawn' },
  { name: 'Bukit Senja', x: -40, z: -252, desc: 'The whole bay from one hill' },
  { name: 'Taman Banyan', x: -40, z: 60, desc: 'A banyan older than the city' },
  { name: 'Stasiun Tua', x: 168, z: -140, desc: 'Trains stopped in 1998; the wall stayed' },
  { name: 'Warung Mak Ijah', x: -160, z: 170, desc: 'The best soto in the city, say the fishermen' },
  { name: 'Gang Sanca', x: -180, z: 40, desc: 'Where Raka grew up, motorbikes and murals' },
  { name: 'Kontainer Biru', x: 150, z: 260, desc: 'The harbour\u2019s painted container yard' },
  { name: 'Jembatan Pelangi', x: 200, z: 40, desc: 'Rainbow bridge over the Kali Sanca' },
  { name: 'Pura Pesisir', x: -250, z: 210, desc: 'Small seaside temple, incense at dusk' },
  { name: 'Kantor Walikota', x: 60, z: -40, desc: 'Colonial offices, still whitewashed' },
  { name: 'Alun-alun', x: 60, z: -110, desc: 'Kites, food carts and evening football' },
  { name: 'Pelabuhan Ikan', x: 210, z: 200, desc: 'Ice, nets and shouting before sunrise' },
  { name: 'Vila Bukit', x: -96, z: -258, desc: 'Glass villas the rich built for the view' },
  { name: 'Pantai Karang', x: 240, z: 260, desc: 'Rock pools at the harbour mouth' },
  { name: 'Kali Sanca', x: 120, z: 60, desc: 'The river that cuts the city in two' },
  { name: 'Gerbang Kota', x: 0, z: -300, desc: 'The north gate, where the highway begins' },
];

/** The three radio stations, with their vibe and tempo. */
export const RADIO_STATIONS = [
  { id: 'dangdut', name: 'Dangdut Pantai 88.4', desc: 'Koplo beats from the beach stalls', tempo: 128, scale: [0, 3, 5, 7, 10], base: 55 },
  { id: 'pop', name: 'Pop Tanjung 101.2', desc: 'Bright city pop, all day', tempo: 104, scale: [0, 2, 4, 7, 9], base: 62 },
  { id: 'rock', name: 'Rock Senja 95.7', desc: 'Guitars for the night drive', tempo: 140, scale: [0, 3, 5, 6, 10], base: 48 },
];

/** Weapon definitions: fists, pistol and shotgun with real ammo. */
export const WEAPONS = [
  { id: 'fists', name: 'Tinju', damage: 12, range: 2.2, rate: 0.45, ammo: Infinity, auto: false, spread: 0 },
  { id: 'pistol', name: 'Pistol Pindad', damage: 34, range: 46, rate: 0.28, ammo: 120, auto: false, spread: 0.02 },
  { id: 'shotgun', name: 'Senapan Laras', damage: 22, range: 22, rate: 0.9, ammo: 40, auto: false, spread: 0.09, pellets: 6 },
];

/** Pedestrian first names and outfits for crowd variety. */
export const PED_NAMES = [
  'Budi', 'Siti', 'Agus', 'Dewi', 'Joko', 'Rina', 'Eko', 'Maya', 'Andi', 'Lestari',
  'Fajar', 'Nina', 'Rizky', 'Putri', 'Dedi', 'Ayu', 'Yoga', 'Sari', 'Hendra', 'Tari',
];
export const PED_SHIRTS = ['#d84a4a', '#4a7ad8', '#4ad87a', '#d8c84a', '#d84ad0', '#4ad8c8', '#e8e8e8', '#2a2a2a', '#e89a4a', '#7a4ad8'];
export const PED_SKINS = ['#c89a6a', '#a87a4a', '#e0b184', '#8a5f3a'];

/** Rival racers for the street races. */
export const RIVALS = [
  { name: 'Dimas "Petir"', car: 'Sport Merah', colour: '#c81e1e', skill: 0.92 },
  { name: 'Sari "Kilau"', car: 'Coupe Malam', colour: '#6e1a5d', skill: 0.88 },
  { name: 'Bowo "Aspal"', car: 'Sedan Senja', colour: '#22242a', skill: 0.85 },
];

/** Starting state for a new game. */
export const NEW_GAME = {
  money: 300000,
  health: 100,
  armour: 0,
  respect: 0,
  carsStolen: 0,
  keris: 0,
  sideJobsDone: 0,
  racesWon: 0,
  startX: -150,
  startZ: 200,
  startAngle: Math.PI * 0.15,
};

/** Save slots and storage keys. */
export const SAVE = {
  prefix: 'tanjung-matahari-save-v1-slot-',
  slots: 3,
  autosaveSeconds: 60,
};

/** The story's people. */
export const CHARACTERS = {
  raka: { name: 'Raka', role: 'Anak Gang Sanca yang baru pulang', colour: '#e8b73c' },
  makIjah: { name: 'Mak Ijah', role: 'Pemilik warung di jalan pantai', colour: '#d84a4a' },
  dimas: { name: 'Dimas "Petir"', role: 'Pembalap jalanan, rival Raka', colour: '#c81e1e' },
  sari: { name: 'Sari', role: 'Mekanik garasi Pelabuhan', colour: '#4a7ad8' },
  pakde: { name: 'Pakde Wiryo', role: 'Bos pasar malam, pemberi misi', colour: '#4ad87a' },
  kapten: { name: 'Kapten Budi', role: 'Nelayan tua, penjaga dermaga', colour: '#5f8fa8' },
};

/** Food stalls of Pasar Malam, with their smells and prices. */
export const STALLS = [
  { name: 'Soto Mak Ijah', food: 'Soto ayam + kerupuk', price: 15000, colour: '#d84a4a' },
  { name: 'Satay Bang Dul', food: 'Sate ayam 10 tusuk', price: 20000, colour: '#e8b73c' },
  { name: 'Es Teh Manis', food: 'Es teh + es kelapa', price: 5000, colour: '#4a7ad8' },
  { name: 'Gorengan Mbak Sari', food: 'Bakwan, tahu isi, pisang goreng', price: 8000, colour: '#4ad87a' },
  { name: 'Nasi Padang Uni', food: 'Rendang + nasi + sayur', price: 25000, colour: '#c81e1e' },
  { name: 'Martabak Manis', food: 'Martabak coklat keju', price: 30000, colour: '#7a4ad8' },
  { name: 'Bakso Pakde', food: 'Bakso urat + mie', price: 18000, colour: '#2e8a4a' },
  { name: 'Kopi Tubruk', food: 'Kopi tubruk + pisang goreng', price: 10000, colour: '#5a3a2a' },
];

/** Billboards around the city, with their (original) slogans. */
export const BILLBOARDS = [
  { text: 'TANJUNG MATAHARI', sub: 'Kota pesisir, hati pun senang', x: -64, z: 192, colour: '#e8b73c' },
  { text: 'DANGDUT PANTAI 88.4', sub: 'Goyang terus!', x: 128, z: 64, colour: '#d84a4a' },
  { text: 'GARASI SARI', sub: 'Nitro • Servis • Cat baru', x: 192, z: 128, colour: '#4a7ad8' },
  { text: 'PASAR MALAM', sub: 'Buka tiap malam, soto tak pernah habis', x: 0, z: 128, colour: '#4ad87a' },
  { text: 'SOTO MAK IJAH', sub: 'Juara sejak 1998', x: -192, z: 128, colour: '#c81e1e' },
];

/** Song titles the radio DJs announce (original, invented for the game). */
export const SONGS = {
  dangdut: ['Goyang Pantai', 'Koplo Senja', 'Cinta di Dermaga', 'Rindu Pasar Malam', 'Ombak Asmara'],
  pop: ['Langit Tanjung', 'Jalan Pulang', 'Senja di Bukit', 'Kota Kita', 'Hujan di Pelabuhan'],
  rock: ['Aspal Panas', 'Gas Terus', 'Malam Tanpa Rem', 'Petir Jalanan', 'Bukit Berapi'],
};

/** Boat names in the harbour. */
export const BOAT_NAMES = [
  'Sinar Pagi', 'Nelayan Jaya', 'Ombak Biru', 'Bintang Laut', 'Matahari Terbit',
  'Kurnia Samudra', 'Pelangi Pesisir', 'Harapan Baru',
  'KM Bahari Jaya', 'KM Ombak Tenang', 'KM Nelayan Sejahtera', 'KM Cahaya Fajar',
  'KM Samudra Biru', 'KM Gelombang Rindu',
];

/** More pedestrian names for crowd variety. */
export const PED_NAMES_EXTRA = [
  'Wayan', 'Made', 'Ketut', 'Nyoman', 'Komang', 'Gede', 'Ayu', 'Kadek',
  'Slamet', 'Tono', 'Wati', 'Sukma', 'Ratna', 'Bagus', 'Dewi', 'Luh',
];

/** District barks: what people say about each district. */
export const DISTRICT_BARKS = {
  pantai: 'Pantai Matahari: pasirnya panas, sotonya juara.',
  pasar: 'Pasar Malam: seratus warung, satu aroma.',
  sanca: 'Gang Sanca: sempit, tapi rumah.',
  kotatua: 'Kota Tua: jamnya berdentang tiap jam.',
  pelabuhan: 'Pelabuhan: ikan segar sebelum matahari naik.',
  bukit: 'Bukit Senja: pemandangan untuk orang kaya.',
};

/** Weapon paint names for the garage paint shop. */
export const PAINT_JOBS = [
  { name: 'Kuning Sanca', colour: '#e8b73c', price: 30000 },
  { name: 'Merah Petir', colour: '#c81e1e', price: 30000 },
  { name: 'Biru Pelabuhan', colour: '#2e6fc8', price: 30000 },
  { name: 'Hijau Sawah', colour: '#2e8a4a', price: 30000 },
  { name: 'Ungu Senja', colour: '#6e1a5d', price: 45000 },
  { name: 'Emas Keris', colour: '#d8b13c', price: 90000 },
  { name: 'Putih Mutiara', colour: '#f0f0e8', price: 30000 },
  { name: 'Hitam Tengah Malam', colour: '#1a1a22', price: 30000 },
  { name: 'Oranye Senja', colour: '#e88030', price: 30000 },
];

/** Performance upgrades sold at the garage. */
export const UPGRADES = [
  { id: 'engine1', name: 'Mesin Stage 1', desc: '+12% akselerasi', price: 80000, accel: 1.12, top: 1.0 },
  { id: 'engine2', name: 'Mesin Stage 2', desc: '+25% akselerasi, +8% top speed', price: 180000, accel: 1.25, top: 1.08 },
  { id: 'turbo', name: 'Turbo Pantai', desc: '+18% top speed', price: 220000, accel: 1.1, top: 1.18 },
  { id: 'brakes', name: 'Rem Balap', desc: 'Rem 40% lebih kuat', price: 60000, accel: 1.0, top: 1.0 },
  { id: 'armour', name: 'Bodi Baja', desc: 'Mobil tahan tabrakan', price: 150000, accel: 1.0, top: 1.0 },
];
