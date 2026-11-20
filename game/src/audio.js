// audio.js — every sound in Tanjung Matahari is synthesised with WebAudio.
// No audio files, no network: engine hum, sirens, gunshots, pickup blips,
// and four radio stations, each with its own little melody and track list.
//
// The radio works like a step sequencer: every frame, update() schedules
// the next notes a quarter of a second ahead, so the music never stutters
// even when the frame rate wobbles.

const STATIONS = [
  {
    id: 'matahari',
    name: 'Radio Matahari',
    genre: 'Dangdut Pantai',
    tracks: ['Ombak Rindu — Siti Tanjung', 'Goyang Pasar — Dangdut 88', 'Senja di Pelabuhan — Raka Band', 'Pantun Cinta — Siti Tanjung'],
    // A bouncy pentatonic line, the sound of the night market.
    notes: [0, 3, 5, 7, 10, 7, 5, 3, 0, 3, 5, 7, 12, 10, 7, 5],
    bpm: 132,
    wave: 'sawtooth',
    base: 220,
  },
  {
    id: 'pantai',
    name: 'Pantai FM',
    genre: 'Reggae Santai',
    tracks: ['Angin Laut — The Breezers', 'Santai Sore — Kelapa Band', 'Jalan Pelan — Ombak Band', 'Ombak Tenang — Kelapa Band'],
    notes: [0, 0, 7, 0, 5, 0, 3, 0, 0, 7, 10, 7, 5, 3, 0, 0],
    bpm: 96,
    wave: 'triangle',
    base: 196,
  },
  {
    id: 'kota',
    name: 'Kota FM',
    genre: 'Rock Tanjung',
    tracks: ['Gaspol — Motor Band', 'Malam Panas — Jalanan', 'Bintang Lima — Raka & Co', 'Jalanan Panas — Motor Band'],
    notes: [0, 0, 12, 0, 10, 0, 7, 0, 5, 7, 10, 12, 10, 7, 5, 3],
    bpm: 150,
    wave: 'square',
    base: 165,
  },
  {
    id: 'senja',
    name: 'Senja FM',
    genre: 'Dangdut Senja',
    tracks: ['Senja di Tanjung — Siti Tanjung', 'Ombak Pelan — Dangdut 88', 'Lampu Pasar — Raka Band', 'Senja Terakhir — Dangdut 88'],
    // Slow, swaying line for the golden hour: long notes, low base.
    notes: [0, 7, 0, 5, 0, 3, 0, 0, 0, 7, 0, 10, 7, 5, 3, 0],
    bpm: 104,
    wave: 'sine',
    base: 185,
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
    this.sirenLfo = null;
    this.sirenOn = false;
    this.muted = false;
  }

  // Create the audio graph on the first user gesture (browsers block audio
  // before that). Safe to call repeatedly; later calls just resume.
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
    // The engine is one always-running sawtooth whose pitch and volume
    // follow the car's speed; silence is just gain 0.
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

  // The police siren is a sine whose pitch wobbles up and down on an LFO.
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
      this.sirenLfo = lfo;
    } else if (this.sirenOsc) {
      try {
        this.sirenOsc.stop();
        if (this.sirenLfo) this.sirenLfo.stop();
      } catch (e) {
        // Already stopped.
      }
      this.sirenOsc = null;
      this.sirenGain = null;
      this.sirenLfo = null;
    }
  }

  // A short decaying tone: pickups, UI clicks, punches.
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

  // A gunshot is a burst of filtered noise, not a tone.
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

  thud() {
    this.blip(120, 0.15, 'sine', 0.3);
  }

  // A two-note pickup chirp for crates and statues.
  pickup() {
    this.blip(1200, 0.12, 'sine', 0.2);
    setTimeout(() => this.blip(1600, 0.12, 'sine', 0.2), 80);
  }

  // A little rising fanfare for a finished mission: four notes, one after
  // the other, each a touch higher than the last.
  missionJingle() {
    if (!this.ctx) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.blip(freq, 0.22, 'triangle', 0.25), i * 110);
    });
  }

  // A two-note chirp when the radio station changes.
  stationJingle() {
    this.blip(660, 0.08, 'sine', 0.15);
    setTimeout(() => this.blip(880, 0.08, 'sine', 0.15), 90);
  }

  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    this.step = 0;
    return this.currentStation();
  }

  currentStation() {
    const s = STATIONS[this.station];
    return {
      name: s.name,
      genre: s.genre,
      track: s.tracks[this.step % s.tracks.length],
    };
  }

  toggleRadio() {
    this.radioOn = !this.radioOn;
    return this.radioOn;
  }

  // Call every frame; schedules the next radio notes a little ahead of
  // the playhead so the melody keeps flowing.
  update() {
    if (!this.ctx || !this.radioOn || this.muted) return;
    const s = STATIONS[this.station];
    const beat = 60 / s.bpm / 2;
    while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
      const note = s.notes[this.step % s.notes.length];
      // A 0 is a rest, except on the downbeat, where a soft root note
      // keeps the pulse.
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
