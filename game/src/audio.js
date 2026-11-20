// audio.js — all sound is synthesised with WebAudio. No audio files, no
// network. Engine hum, sirens, gunshots, pickups, and three radio stations
// with their own little melodies and track names.

const STATIONS = [
  {
    id: 'matahari',
    name: 'Radio Matahari',
    genre: 'Dangdut Pantai',
    tracks: ['Ombak Rindu — Siti Tanjung', 'Goyang Pasar — Dangdut 88', 'Senja di Pelabuhan — Raka Band'],
    // A bouncy pentatonic line.
    notes: [0, 3, 5, 7, 10, 7, 5, 3, 0, 3, 5, 7, 12, 10, 7, 5],
    bpm: 132, wave: 'sawtooth', base: 220,
  },
  {
    id: 'pantai',
    name: 'Pantai FM',
    genre: 'Reggae Santai',
    tracks: ['Angin Laut — The Breezers', 'Santai Sore — Kelapa Band', 'Jalan Pelan — Ombak Band'],
    notes: [0, 0, 7, 0, 5, 0, 3, 0, 0, 7, 10, 7, 5, 3, 0, 0],
    bpm: 96, wave: 'triangle', base: 196,
  },
  {
    id: 'kota',
    name: 'Kota FM',
    genre: 'Rock Tanjung',
    tracks: ['Gaspol — Motor Band', 'Malam Panas — Jalanan', 'Bintang Lima — Raka & Co'],
    notes: [0, 0, 12, 0, 10, 0, 7, 0, 5, 7, 10, 12, 10, 7, 5, 3],
    bpm: 150, wave: 'square', base: 165,
  },
  {
    id: 'senja',
    name: 'Senja FM',
    genre: 'Dangdut Senja',
    tracks: ['Senja di Tanjung — Siti Tanjung', 'Ombak Pelan — Dangdut 88', 'Lampu Pasar — Raka Band'],
    // Slow, swaying line for the golden hour: long notes, low base.
    notes: [0, 7, 0, 5, 0, 3, 0, 0, 0, 7, 0, 10, 7, 5, 3, 0],
    bpm: 104, wave: 'sine', base: 185,
  },
];

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.radioGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.station = 0;
    this.radioOn = true;
    this.step = 0;
    this.nextNoteTime = 0;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.radioGain = this.ctx.createGain();
    this.radioGain.gain.value = 0.16;
    this.radioGain.connect(this.master);
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.nextNoteTime = this.ctx.currentTime + 0.1;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  setEngine(speed01, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.03 + speed01 * 0.05 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, t, 0.08);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (on) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.05;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 1.6;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      lfo.start();
      this._sirenLfo = lfo;
    } else if (this.sirenOsc) {
      try { this.sirenOsc.stop(); this._sirenLfo.stop(); } catch (e) { /* already stopped */ }
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  blip(freq = 880, dur = 0.12, type = 'sine', vol = 0.2) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur);
  }

  gunshot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.12);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.35;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1800;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  thud() { this.blip(120, 0.15, 'sine', 0.3); }

  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    this.step = 0;
    return this.currentStation();
  }

  currentStation() {
    const s = STATIONS[this.station];
    return { name: s.name, genre: s.genre, track: s.tracks[this.step % s.tracks.length] };
  }

  toggleRadio() {
    this.radioOn = !this.radioOn;
    return this.radioOn;
  }

  // Call every frame; schedules the next radio notes.
  update() {
    if (!this.ctx || !this.radioOn || this.muted) return;
    const s = STATIONS[this.station];
    const beat = 60 / s.bpm / 2;
    while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
      const note = s.notes[this.step % s.notes.length];
      if (note !== 0 || this.step % 4 === 0) {
        const freq = s.base * Math.pow(2, note / 12);
        const o = this.ctx.createOscillator();
        o.type = s.wave;
        o.frequency.value = freq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.9, this.nextNoteTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.nextNoteTime + beat * 0.9);
        o.connect(g);
        g.connect(this.radioGain);
        o.start(this.nextNoteTime);
        o.stop(this.nextNoteTime + beat);
      }
      this.nextNoteTime += beat;
      this.step++;
    }
  }
}
