// dialogue.js — The words of Tanjung Matahari.
// Every mission briefing, every street line and every radio jingle is written
// here in Indonesian, in Raka's voice and the voices around him. The dialogue
// system shows one line at a time in the HUD's dialogue box, with the speaker
// name and a typewriter-free instant show (readable at a glance in a shot).
// Lines are data: the missions module picks them, this module only holds them.

/** A dialogue line: who says it, and what they say. */
export class DialogueLine {
  constructor(who, text) {
    this.who = who;
    this.text = text;
  }
}

/** Mission briefings and mid-mission lines, keyed by mission id. */
export const MISSION_DIALOGUE = {
  m1: [
    ['Pakde Wiryo', 'Raka! Kamu pulang juga. Pasar malam butuh kurir malam ini.'],
    ['Raka', 'Paket apa, Pakde? Jangan yang aneh-aneh.'],
    ['Pakde Wiryo', 'Cuma soto dan kerupuk, nak. Antar ke Gang Sanca, warung Mak Ijah.'],
    ['Mak Ijah', 'Raka, anakku! Cepat, sotonya keburu dingin.'],
  ],
  m2: [
    ['Pakde Wiryo', 'Si Bowo ngutang tiga bulan, Raka. Tagih dia, baik-baik.'],
    ['Raka', 'Baik-baik itu relatif, Pakde.'],
    ['Bowo "Aspal"', 'Raka! Jangan di sini, banyak orang!'],
  ],
  m3: [
    ['Dimas "Petir"', 'Balapan di jalan pantai, Raka. Berani? Atau cuma omong?'],
    ['Raka', 'Siap-siap kalah di depan pacarmu, Dimas.'],
    ['Sari', 'Mesinmu sudah kubereskan, Raka. Jangan malu-maluin garasi.'],
  ],
  m4: [
    ['Kapten Budi', 'Keris emas kakekmu dicuri, Raka. Dua keping ada di dermaga.'],
    ['Raka', 'Yang berani nyentuh warisan keluarga, berurusan sama aku.'],
    ['Penjaga Dermaga', 'Berhenti! Dermaga ini wilayah kami sekarang!'],
  ],
  m5: [
    ['Pakde Wiryo', 'Muatan ini harus sampai pelabuhan sebelum tengah malam. Polisi di mana-mana.'],
    ['Raka', 'Kalau polisi ngejar, salahin jalannya, bukan aku.'],
    ['Sari', 'Nitro penuh. Kalau ketemu razia, jangan berhenti.'],
  ],
  m6: [
    ['Kapten Budi', 'Dermaga dikuasai preman, Raka. Lima orang jaga gudang.'],
    ['Raka', 'Lima orang? Aku hitung sampai tiga, mereka yang kabur.'],
  ],
  m7: [
    ['Sari', 'Garasi butuh tiga mobil malam ini. Yang bagus, Raka. Bukan bemo.'],
    ['Raka', 'Tiga mobil bagus. Polisi lima bintang. Gampang.'],
    ['Dimas "Petir"', 'Kamu gila, Raka. Tapi aku ikut. Jaga jalan keluar.'],
  ],
  m8: [
    ['Pakde Wiryo', 'Ini terakhir, Raka. Bos besarnya ada di bukit. Habisi, lalu kita bebas.'],
    ['Raka', 'Tanjung Matahari ini rumahku. Tidak ada yang mengambilnya.'],
    ['Dimas "Petir"', 'Menang hari ini, dan namamu jadi legenda, Raka.'],
  ],
};

/** Random street chatter from pedestrians. */
export const STREET_LINES = [
  ['Budi', 'Macet lagi di Jl. Sudirman...'],
  ['Siti', 'Sotonya Mak Ijah memang juara.'],
  ['Agus', 'Katanya ada balapan malam ini di pantai.'],
  ['Dewi', 'Panas sekali, padahal sudah sore.'],
  ['Joko', 'Lihat mobil merah itu! Pasti punya Dimas.'],
  ['Rina', 'Pasar malam makin rame tiap minggu.'],
  ['Eko', 'Kapal nelayan pulang jam lima pagi.'],
  ['Maya', 'Aku dengar Raka sudah pulang ke Sanca.'],
  ['Andi', 'Polisi lagi razia di pelabuhan, hati-hati.'],
  ['Lestari', 'Keris emas itu katanya peninggalan kakek.'],
  ['Fajar', 'Dangdut Pantai 88.4 lagi asyik, tuh.'],
  ['Nina', 'Bukit Senja paling bagus pas matahari terbenam.'],
  ['Rizky', 'Garasi Sari bisa bikin mobil terbang, katanya.'],
  ['Putri', 'Jangan parkir di Gang Sanca, nanti hilang.'],
  ['Wayan', 'Ombak besar hari ini. Perahu jangan keluar.'],
  ['Made', 'Harga ikan naik karena angin barat.'],
  ['Slamet', 'Tadi ada yang kejar-kejaran sama polisi di pantai!'],
  ['Tono', 'Mobil taksi biru itu langganan pasar.'],
  ['Wati', 'Anakku mau jadi pembalap seperti Dimas. Ya ampun.'],
  ['Sukma', 'Menara jam itu bunyinya kedengaran sampai pantai.'],
  ['Ratna', 'Keris emas? Aku pernah lihat kilauannya di dermaga.'],
  ['Bagus', 'Kalau mau cepat, lewat Gang Sanca. Tapi sempit.'],
  ['Dewi', 'Sore ini langitnya oranye sekali.'],
  ['Luh', 'Jangan lupa beli sate sebelum pulang.'],
];

/** Radio DJ jingles between songs. */
export const RADIO_JINGLES = {
  dangdut: [
    'Dangdut Pantai 88.4 — goyang terus, Tanjung Matahari!',
    'Koplo dari pinggir pantai, hanya di 88.4!',
  ],
  pop: [
    'Pop Tanjung 101.2 — lagu kota untuk jalan kotamu.',
    '101.2, menemani macetmu sejak 1998.',
  ],
  rock: [
    'Rock Senja 95.7 — keras, seperti aspal panas.',
    '95.7, untuk yang ngebut pulang tengah malam.',
  ],
};

/** Barks when the wanted level rises. */
export const WANTED_BARKS = [
  'Polisi melihatmu! Lari, Raka!',
  'Bintang naik! Sembunyi atau ngebut!',
  'Patroli Pantai mengejarmu!',
  'Satuan Sanca dikerahkan!',
  'Brimob Kota turun ke jalan!',
  'Helikopter Elang Udara di atasmu!',
  'Operasi Senja! Semua unit mengejarmu!',
];

/** Tips shown on the title screen, rotating. */
export const TIPS = [
  'Tekan E di dekat mobil untuk mencurinya. Polisi tidak suka itu.',
  'Keris emas tersembunyi di 12 tempat — kumpulkan semuanya.',
  'Tekan M untuk peta, R untuk ganti radio, Q untuk senjata.',
  'Nitro di garasi Sari bikin mobilmu 35% lebih cepat.',
  'Sembunyi dari polisi selama 26 detik untuk menurunkan bintang.',
  'Balapan jalanan: tiga sirkuit, tiga rival, satu legenda.',
  'Tekan C untuk foto? Tidak — nikmati saja pemandangannya.',
  'Simpan progresmu di menu jeda — ada 3 slot.',
];

/** The dialogue queue: shows lines one at a time in the HUD. */
export class Dialogue {
  constructor() {
    this.queue = [];
    this.current = null;
    this.timer = 0;
    this.lineTime = 4.5;
  }

  /** Queue a list of [who, text] lines. */
  say(lines) {
    for (const [who, text] of lines) this.queue.push(new DialogueLine(who, text));
    if (!this.current) this.next();
  }

  /** Show a single line right now, clearing the queue. */
  sayNow(who, text) {
    this.queue = [];
    this.current = new DialogueLine(who, text);
    this.timer = this.lineTime;
  }

  /** Advance to the next queued line. */
  next() {
    this.current = this.queue.shift() || null;
    this.timer = this.lineTime;
  }

  /** Step the timer; lines advance on their own. */
  step(dt) {
    if (!this.current) {
      if (this.queue.length > 0) this.next();
      return;
    }
    this.timer -= dt;
    if (this.timer <= 0) this.next();
  }

  /** The line currently on screen, or null. */
  line() {
    return this.current;
  }

  /** Skip the current line immediately. */
  skip() {
    this.next();
  }
}

/** Pick a random street line from the crowd. */
export function randomStreetLine(rng) {
  return rng.pick(STREET_LINES);
}

/** Pick a jingle for a radio station. */
export function randomJingle(rng, stationId) {
  const list = RADIO_JINGLES[stationId] || RADIO_JINGLES.pop;
  return rng.pick(list);
}

/** Mission completion lines, keyed by mission id. */
export const MISSION_COMPLETE_LINES = {
  m1: ['Mak Ijah', 'Sotonya masih panas, Raka. Kamu anak baik.'],
  m2: ['Pakde Wiryo', 'Uangnya kembali. Bowo kapok, katanya.'],
  m3: ['Sari', 'Dimas kalah! Aku yang bikin mesinnya, ingat itu.'],
  m4: ['Kapten Budi', 'Keris kakekmu kembali. Dia pasti bangga.'],
  m5: ['Pakde Wiryo', 'Muatan sampai. Polisi tidak tahu apa-apa.'],
  m6: ['Kapten Budi', 'Dermaga bebas lagi. Nelayan bisa kerja.'],
  m7: ['Sari', 'Tiga mobil bagus! Garasi penuh, dompet penuh.'],
  m8: ['Pakde Wiryo', 'Selesai, Raka. Tanjung Matahari milik kita lagi.'],
};

/** Mission failure / retry lines. */
export const MISSION_FAIL_LINES = [
  ['Raka', 'Gagal. Tapi Raka tidak menyerah semudah itu.'],
  ['Pakde Wiryo', 'Coba lagi, nak. Kota ini tidak sabar menunggu.'],
  ['Sari', 'Balik ke garasi dulu, perbaiki mobilmu.'],
];

/** DJ banter between songs, per station. */
export const DJ_BANTER = {
  dangdut: [
    'Ini dia, lagu koplo terbaru dari Pantai Matahari!',
    'Buat yang lagi di jalan pantai — goyang, jangan ngantuk!',
    'Tadi ada yang request lagu ini dari warung Mak Ijah!',
    'Selamat sore, Tanjung Matahari! Jangan lupa minum es kelapa, panasnya luar biasa.',
    'Lagu berikut buat yang lagi jatuh cinta... atau jatuh tempo!',
  ],
  pop: [
    'Lagu ini buat kamu yang lagi macet di Jl. Sudirman.',
    'Pop Tanjung, menemani sore harimu.',
    'Request lagu? Telepon saja, kami di studio pantai.',
    'Cuaca hari ini: cerah, panas, dan kemungkinan hujan sore. Seperti biasa.',
    'Untuk pendengar di Gang Sanca: tolong jangan parkir sembarangan.',
  ],
  rock: [
    'Ini keras. Ini Rock Senja. Ini Tanjung Matahari.',
    'Buat yang ngebut pulang — hati-hati, polisi di mana-mana.',
    'Gitar ini lebih panas dari aspal siang tadi.',
    'Balapan malam ini di Pantai Pasir — datang, tapi jangan bawa polisi.',
    'Lagu berikut untuk semua pembalap jalanan Tanjung Matahari.',
  ],
};

/** Pick DJ banter for a station. */
export function randomBanter(rng, stationId) {
  const list = DJ_BANTER[stationId] || DJ_BANTER.pop;
  return rng.pick(list);
}

/** District barks: short lines tied to where the player stands. */
export const DISTRICT_LINES = [
  ['Nelayan', 'Ombak tenang pagi ini. Ikan pasti banyak.'],
  ['Pedagang', 'Sate, sate! Masih panas, masih panas!'],
  ['Anak Pantai', 'Kak, lihat layang-layangku! Tinggi sekali!'],
  ['Satpam', 'Jangan parkir di sini, ya. Nanti diderek.'],
  ['Ibu-ibu', 'Harga cabai naik lagi, Nak.'],
  ['Tukang Ojek', 'Ojek, Bang? Ke mana saja, murah!'],
  ['Mahasiswa', 'Tugas numpuk, tapi pantai memanggil.'],
  ['Nenek', 'Dulu jalan ini masih tanah, Nak.'],
];

/** Pick a district line. */
export function randomDistrictLine(rng) {
  return rng.pick(DISTRICT_LINES);
}

/** Wanted-level barks from police loudspeakers. */
export const POLICE_BARKS = [
  'Berhenti! Ini polisi Tanjung Matahari!',
  'Kendaraan itu dicuri! Hentikan sekarang!',
  'Semua unit, tersangka menuju jalan pantai!',
  'Jangan lari! Kami sudah mengepung daerah ini!',
  'Helikopter sudah di atas. Menyerahlah!',
  'Sanca 12, tersangka kabur ke arah pantai!',
  'Unit 7 meminta bantuan di pelabuhan!',
  'Dia membawa senjata! Hati-hati!',
];

/** Pick a police bark. */
export function randomPoliceBark(rng) {
  return rng.pick(POLICE_BARKS);
}

/** Garage banter from Sari. */
export const GARAGE_LINES = [
  ['Sari', 'Mobil apa lagi yang kamu bawa, Raka?'],
  ['Sari', 'Nitro ini bikinannya sendiri. Jangan salahkan aku kalau terbang.'],
  ['Sari', 'Cat baru? Pilih yang mencolok, biar polisi gampang lihat.'],
  ['Sari', 'Mesinmu berisik. Biar kubereskan sebentar.'],
];

/** Pick a garage line. */
export function randomGarageLine(rng) {
  return rng.pick(GARAGE_LINES);
}

/** Race countdown and taunt lines. */
export const RACE_LINES = {
  start: ['Dimas "Petir"', 'Tiga... dua... satu... GAS!'],
  win: ['Dimas "Petir"', 'Oke, oke. Kamu menang kali ini.'],
  lose: ['Dimas "Petir"', 'Hah! Balapan itu soal nyali, Raka.'],
  rival: ['Sari "Kilau"', 'Jangan halangi jalanku, sayang.'],
};

/** Per-rival race lines, by rival id. */
export const RIVAL_LINES = {
  dimas: {
    start: ['Dimas "Petir"', 'Tiga... dua... satu... GAS!'],
    win: ['Dimas "Petir"', 'Oke, oke. Kamu menang kali ini, Raka.'],
    lose: ['Dimas "Petir"', 'Hah! Balapan itu soal nyali, bukan keberuntungan.'],
  },
  sari: {
    start: ['Sari "Kilau"', 'Jangan halangi jalanku, sayang.'],
    win: ['Sari "Kilau"', 'Mobilmu cepat juga. Lain kali aku yang menang.'],
    lose: ['Sari "Kilau"', 'Sudah kubilang, jangan halangi jalanku.'],
  },
  bowo: {
    start: ['Bowo "Banteng"', 'Aku tidak pernah kalah di Pantai Pasir!'],
    win: ['Bowo "Banteng"', 'Hmph. Sekali ini saja.'],
    lose: ['Bowo "Banteng"', 'Balapan itu soal otot, bukan keberuntungan.'],
  },
};

/** Pick a rival line for an event. */
export function rivalLine(rivalId, event, rng) {
  const lines = RIVAL_LINES[rivalId];
  if (!lines || !lines[event]) return null;
  return lines[event];
}
