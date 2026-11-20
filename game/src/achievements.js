// achievements.js — 26 achievements for Tanjung Matahari.
// Each has an id, a name, a description and a trigger: a mission count, a
// keris count, a speed, a wanted level, a garage count and more. Unlocking
// one shows a toast in the HUD and plays the mission chime; the map screen
// lists all 26 with their locked/unlocked state. Achievements are checked
// from the places that know the numbers — missions, combat, races, garage —
// through the single check(kind, value) entry point.

/** All 26 achievements. kind + value describe the unlock condition. */
export const ACHIEVEMENTS = [
  { id: 'first-steps', name: 'Selamat Datang', desc: 'Mulai permainan baru di Tanjung Matahari', kind: 'start', value: 1 },
  { id: 'first-car', name: 'Pencuri Pertama', desc: 'Curi mobil pertamamu', kind: 'cars', value: 1 },
  { id: 'car-10', name: 'Tangan Panjang', desc: 'Curi 10 mobil', kind: 'cars', value: 10 },
  { id: 'car-30', name: 'Raja Jalanan', desc: 'Curi 30 mobil', kind: 'cars', value: 30 },
  { id: 'mission-1', name: 'Kurir Pasar', desc: 'Selesaikan misi pertama', kind: 'mission', value: 1 },
  { id: 'mission-4', name: 'Setengah Jalan', desc: 'Selesaikan 4 misi cerita', kind: 'mission', value: 4 },
  { id: 'mission-8', name: 'Legenda Tanjung', desc: 'Selesaikan semua 8 misi', kind: 'mission', value: 8 },
  { id: 'keris-1', name: 'Penjaga Warisan', desc: 'Temukan keris emas pertama', kind: 'keris', value: 1 },
  { id: 'keris-6', name: 'Kolektor Keris', desc: 'Temukan 6 keris emas', kind: 'keris', value: 6 },
  { id: 'keris-12', name: 'Mahakarya Emas', desc: 'Temukan semua 12 keris emas', kind: 'keris', value: 12 },
  { id: 'wanted-3', name: 'Buronan', desc: 'Capai wanted level 3', kind: 'wanted', value: 3 },
  { id: 'wanted-5', name: 'Musuh Negara', desc: 'Capai wanted level 5', kind: 'wanted', value: 5 },
  { id: 'escape', name: 'Hilang Jejak', desc: 'Lepas dari kejaran polisi', kind: 'escape', value: 1 },
  { id: 'race-1', name: 'Pembalap Pantai', desc: 'Menangkan balapan pertamamu', kind: 'race', value: 1 },
  { id: 'race-3', name: 'Juara Sirkuit', desc: 'Menangkan 3 balapan', kind: 'race', value: 3 },
  { id: 'speed-150', name: 'Kilometer Per Jam', desc: 'Menyetir di atas 150 km/jam', kind: 'speed', value: 150 },
  { id: 'speed-180', name: 'Petir Aspal', desc: 'Menyetir di atas 180 km/jam', kind: 'speed', value: 180 },
  { id: 'job-1', name: 'Pekerja Keras', desc: 'Selesaikan pekerjaan sampingan pertama', kind: 'job', value: 1 },
  { id: 'job-3', name: 'Tangan Kanan Kota', desc: 'Selesaikan 3 pekerjaan sampingan', kind: 'job', value: 3 },
  { id: 'garage-1', name: 'Punya Garasi', desc: 'Simpan mobil pertama di garasi Sari', kind: 'garage', value: 1 },
  { id: 'garage-5', name: 'Kolektor Mobil', desc: 'Simpan 5 mobil di garasi', kind: 'garage', value: 5 },
  { id: 'kills-5', name: 'Tangan Dingin', desc: 'Kalahkan 5 lawan', kind: 'kills', value: 5 },
  { id: 'kills-20', name: 'Penjaga Kota', desc: 'Kalahkan 20 lawan', kind: 'kills', value: 20 },
  { id: 'tour-10', name: 'Turis Lokal', desc: 'Kunjungi 10 tempat wisata', kind: 'tour', value: 10 },
  { id: 'tour-20', name: 'Duta Tanjung', desc: 'Kunjungi semua 20 tempat wisata', kind: 'tour', value: 20 },
  { id: 'rich', name: 'Sultan Sanca', desc: 'Miliki Rp 1.000.000', kind: 'money', value: 1000000 },
];

/** The achievement tracker. */
export class Achievements {
  constructor() {
    this.unlocked = new Set();
    this.toast = null;
    this.toastTimer = 0;
    this.total = ACHIEVEMENTS.length;
    // A queue so two unlocks at once both get their moment on screen.
    this.queue = [];
  }

  /** Check a trigger kind against a value; unlocks anything it satisfies. */
  check(kind, value) {
    for (const a of ACHIEVEMENTS) {
      if (a.kind !== kind) continue;
      if (value >= a.value && !this.unlocked.has(a.id)) {
        this.unlocked.add(a.id);
        this.queue.push(a);
        this.pumpQueue();
        return a;
      }
    }
    return null;
  }

  /** Show the next queued achievement as a toast. */
  pumpQueue() {
    if (this.toast) return;
    const next = this.queue.shift();
    if (!next) return;
    this.toast = next;
    this.toastTimer = 4;
  }

  /** True when the achievement is unlocked. */
  has(id) {
    return this.unlocked.has(id);
  }

  /** Count of unlocked achievements. */
  count() {
    return this.unlocked.size;
  }

  /** Step the toast timer. */
  step(dt) {
    this.toastTimer = Math.max(0, this.toastTimer - dt);
    if (this.toastTimer <= 0) {
      this.toast = null;
      this.pumpQueue();
    }
  }

  /** All achievements with their state, for the map screen. */
  list() {
    return ACHIEVEMENTS.map((a) => ({ ...a, unlocked: this.unlocked.has(a.id) }));
  }

  /** Progress to the next unlock of a kind, as a fraction. */
  progressToNext(kind, value) {
    const pending = ACHIEVEMENTS.filter((a) => a.kind === kind && !this.unlocked.has(a.id));
    if (pending.length === 0) return 1;
    const next = pending.sort((a, b) => a.value - b.value)[0];
    return Math.min(1, value / next.value);
  }
}
