// audio.js — Sound for Tanjung Matahari, made entirely with WebAudio.
// No audio files exist in the game: the three radio stations are sequenced
// live from their scales (dangdut koplo, city pop, night rock), the engine
// hums from an oscillator that follows the car's speed, and every effect —
// gunshots, pickup chimes, sirens, the keris sparkle — is a small synth
// patch. Everything is guarded: in a headless browser or before the first
// user gesture the context may not exist, and the game must never crash.

import { RADIO_STATIONS } from './config.js';

/** Convert a scale degree to a frequency from a base MIDI note. */
export function noteFreq(baseMidi, scale, degree) {
  const oct = Math.floor(degree / scale.length);
  const step = scale[((degree % scale.length) + scale.length) % scale.length];
  const midi = baseMidi + oct * 12 + step;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** The audio system: radio sequencer, engine drone and sound effects. */
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.station = 0;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.seqStep = 0;
    this.nextNoteTime = 0;
    this.enabled = true;
    this.muted = false;
    this.jingleTimer = 0;
    this.onJingle = null; // callback(text) when the DJ speaks
  }

  /** Create the context on first user gesture; safe to call repeatedly. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.6;
      this.sfxGain.connect(this.master);
      // Engine drone: a low sawtooth through a low-pass filter.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.nextNoteTime = this.ctx.currentTime + 0.1;
      return true;
    } catch (e) {
      this.ctx = null;
      return false;
    }
  }

  /** The station currently playing. */
  get stationDef() {
    return RADIO_STATIONS[this.station];
  }

  /** Switch to the next station (R key). */
  nextStation() {
    this.station = (this.station + 1) % RADIO_STATIONS.length;
    this.seqStep = 0;
    return this.station;
  }

  /** Mute or unmute everything. */
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  /** Schedule one sequencer step: bass, lead and a hat tick. */
  scheduleStep(time, station, step) {
    const beat = 60 / station.tempo / 2; // eighth notes
    const bassNotes = [0, 0, 7, 0, 5, 0, 7, 3];
    const leadNotes = [0, 2, 4, 2, 7, 4, 2, 0, 5, 7, 9, 7, 4, 2, 0, -2];
    const bassDeg = bassNotes[step % bassNotes.length];
    const leadDeg = leadNotes[step % leadNotes.length];
    this.tone(noteFreq(station.base - 12, station.scale, bassDeg), time, beat * 0.9, 'triangle', 0.5, this.musicGain);
    if (step % 2 === 0) {
      this.tone(noteFreq(station.base + 12, station.scale, leadDeg), time, beat * 0.7, 'square', 0.16, this.musicGain);
    }
    // Hat: a short noise burst through a high-pass filter.
    if (this.ctx) {
      const dur = 0.03;
      const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6000;
      const g = this.ctx.createGain();
      g.gain.value = step % 4 === 0 ? 0.12 : 0.05;
      src.connect(hp);
      hp.connect(g);
      g.connect(this.musicGain);
      src.start(time);
    }
  }

  /** A single oscillator tone. */
  tone(freq, time, dur, type, vol, dest) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(g);
    g.connect(dest || this.sfxGain);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  /** Step the sequencer and the engine drone. */
  step(dt, player, wanted) {
    if (!this.ctx || this.muted) return;
    const station = this.stationDef;
    const beat = 60 / station.tempo / 2;
    while (this.nextNoteTime < this.ctx.currentTime + 0.15) {
      this.scheduleStep(this.nextNoteTime, station, this.seqStep);
      this.seqStep += 1;
      this.nextNoteTime += beat;
    }
    // Engine follows speed; sirens wail when wanted.
    if (this.engineGain) {
      const target = player.car ? 0.05 + Math.min(0.16, Math.abs(player.carSpeed) * 0.004) : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      this.engineOsc.frequency.setTargetAtTime(45 + Math.abs(player.carSpeed || 0) * 2.4, this.ctx.currentTime, 0.1);
    }
    this.jingleTimer -= dt;
    if (this.jingleTimer <= 0) {
      this.jingleTimer = 24 + Math.random() * 10;
      if (this.onJingle) this.onJingle(station.id);
    }
  }

  /** Play a named sound effect. */
  playSfx(name) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'pistol':
        this.noiseBurst(t, 0.12, 1800, 0.5);
        this.tone(180, t, 0.08, 'square', 0.3);
        break;
      case 'shotgun':
        this.noiseBurst(t, 0.28, 900, 0.7);
        this.tone(90, t, 0.18, 'square', 0.4);
        break;
      case 'punch':
        this.noiseBurst(t, 0.08, 500, 0.4);
        break;
      case 'pickup':
        this.tone(660, t, 0.12, 'sine', 0.35);
        this.tone(990, t + 0.1, 0.18, 'sine', 0.35);
        break;
      case 'keris':
        this.tone(880, t, 0.2, 'sine', 0.3);
        this.tone(1320, t + 0.12, 0.3, 'sine', 0.3);
        this.tone(1760, t + 0.24, 0.4, 'sine', 0.25);
        break;
      case 'mission':
        this.tone(523, t, 0.15, 'triangle', 0.4);
        this.tone(659, t + 0.14, 0.15, 'triangle', 0.4);
        this.tone(784, t + 0.28, 0.3, 'triangle', 0.4);
        break;
      case 'siren':
        this.tone(700, t, 0.4, 'sine', 0.12);
        this.tone(950, t + 0.4, 0.4, 'sine', 0.12);
        break;
      case 'click':
        this.tone(1200, t, 0.05, 'square', 0.15);
        break;
      case 'busted':
        this.tone(220, t, 0.3, 'sawtooth', 0.3);
        this.tone(165, t + 0.3, 0.5, 'sawtooth', 0.3);
        break;
      case 'crash':
        this.noiseBurst(t, 0.25, 400, 0.6);
        break;
      case 'horn':
        this.tone(370, t, 0.18, 'square', 0.2);
        this.tone(466, t, 0.18, 'square', 0.15);
        break;
      case 'screech':
        this.noiseBurst(t, 0.4, 2400, 0.25);
        this.tone(1400, t, 0.35, 'sawtooth', 0.06);
        break;
      case 'door':
        this.noiseBurst(t, 0.1, 300, 0.4);
        this.tone(120, t, 0.08, 'square', 0.2);
        break;
      case 'rain':
        this.noiseBurst(t, 1.2, 1200, 0.08);
        break;
      case 'splash':
        this.noiseBurst(t, 0.3, 800, 0.3);
        this.tone(300, t, 0.2, 'sine', 0.15);
        break;
      case 'checkpoint':
        this.tone(784, t, 0.1, 'sine', 0.35);
        this.tone(1046, t + 0.09, 0.2, 'sine', 0.35);
        break;
      case 'wasted':
        this.tone(196, t, 0.4, 'sawtooth', 0.3);
        this.tone(147, t + 0.4, 0.4, 'sawtooth', 0.3);
        this.tone(98, t + 0.8, 0.8, 'sawtooth', 0.3);
        break;
      case 'levelup':
        this.tone(523, t, 0.12, 'triangle', 0.35);
        this.tone(659, t + 0.11, 0.12, 'triangle', 0.35);
        this.tone(784, t + 0.22, 0.12, 'triangle', 0.35);
        this.tone(1046, t + 0.33, 0.3, 'triangle', 0.35);
        break;
      case 'thunder':
        this.noiseBurst(t, 1.4, 120, 0.7);
        this.tone(55, t, 1.2, 'sine', 0.4);
        this.tone(40, t + 0.3, 1.0, 'sine', 0.3);
        break;
      default:
        break;
    }
  }

  /** A filtered noise burst (shots, crashes, hats). */
  noiseBurst(time, dur, cutoff, vol) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(time);
  }
}
