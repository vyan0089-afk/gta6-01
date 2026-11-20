// audio.js — All sound in Tanjung Matahari is synthesised with WebAudio.
//
// No audio files, no network: every sound is an oscillator or a noise buffer
// built at runtime. The radio is a tiny step sequencer: each station has a
// tempo, a scale and a style, and the sequencer schedules a bass note, a drum
// hit and a melody note per step. The engine hum follows the car's speed, the
// mission jingle is a short pentatonic arpeggio, and the horn is a two-tone
// square blip. Everything is guarded so the game keeps running even when the
// browser refuses audio (headless Chrome, first load before any gesture).

import { RADIO_STATIONS } from './config.js';

/** Convert a MIDI note number to a frequency in Hz. */
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Create the audio system. Call `unlock()` from a user gesture once. */
export function createAudio() {
  let ctx = null;
  let master = null;
  let radioGain = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let noiseBuffer = null;
  let station = 0;
  let radioTimer = null;
  let stepIndex = 0;
  let muted = false;
  let unlocked = false;

  function ensureContext() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      radioGain = ctx.createGain();
      radioGain.gain.value = 0.16;
      radioGain.connect(master);
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc.connect(engineGain);
      engineOsc.start();
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 110;
      const g2 = ctx.createGain();
      g2.gain.value = 0.25;
      engineOsc2.connect(g2);
      g2.connect(engineGain);
      engineOsc2.start();
      const len = ctx.sampleRate * 0.5;
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    } catch (err) {
      ctx = null;
    }
    return ctx;
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    const c = ensureContext();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    startRadio();
  }

  function setMuted(value) {
    muted = value;
    if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.5, ctx.currentTime, 0.05);
  }

  /** A short filtered noise burst (gunshot, punch, crash). */
  function burst(duration, filterFreq, volume) {
    if (!ctx || muted) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
      src.stop(ctx.currentTime + duration + 0.02);
    } catch (err) { /* audio is best-effort */ }
  }

  /** A single oscillator note with a quick attack and a decay. */
  function note(freq, when, duration, type, volume, dest) {
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(volume, when + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
      osc.connect(gain);
      gain.connect(dest || master);
      osc.start(when);
      osc.stop(when + duration + 0.05);
    } catch (err) { /* audio is best-effort */ }
  }

  /** One radio step: bass, drum and melody, per the station's style. */
  function radioStep() {
    if (!ctx || muted) return;
    const st = RADIO_STATIONS[station];
    const stepDur = 60 / st.bpm / 2; // eighth notes
    const now = ctx.currentTime + 0.02;
    const scale = st.scale;
    const root = st.root;
    const step = stepIndex;
    // Bass: root on beats 0 and 4, fifth on beat 6 for dangdut bounce.
    if (step % 4 === 0) {
      note(midiToFreq(root - 12), now, stepDur * 1.8, 'triangle', 0.5, radioGain);
    } else if (step % 8 === 6) {
      note(midiToFreq(root - 5), now, stepDur * 1.4, 'triangle', 0.4, radioGain);
    }
    // Drums: a low thump on every beat, a brighter tick on the off-beats.
    if (step % 2 === 0) {
      burst(0.09, 220, 0.35);
    } else if (st.style === 'dangdut' && step % 4 === 3) {
      burst(0.06, 900, 0.22);
    } else if (st.style === 'rock' && step % 2 === 1) {
      burst(0.05, 1400, 0.18);
    }
    // Melody: a wandering line over the scale, denser for rock.
    const density = st.style === 'rock' ? 0.85 : st.style === 'dangdut' ? 0.7 : 0.55;
    const roll = ((step * 7919 + 13) % 100) / 100;
    if (roll < density) {
      const degree = (step * 5 + Math.floor(step / 4)) % scale.length;
      const octave = step % 16 < 8 ? 0 : 12;
      const midi = root + scale[degree] + octave;
      const wave = st.style === 'rock' ? 'sawtooth' : 'sine';
      note(midiToFreq(midi), now, stepDur * 1.6, wave, st.style === 'rock' ? 0.10 : 0.16, radioGain);
    }
    stepIndex = (stepIndex + 1) % 64;
  }

  function startRadio() {
    if (!ctx || radioTimer !== null) return;
    const st = RADIO_STATIONS[station];
    const stepMs = (60 / st.bpm / 2) * 1000;
    radioTimer = window.setInterval(radioStep, stepMs);
  }

  function stopRadio() {
    if (radioTimer !== null) {
      window.clearInterval(radioTimer);
      radioTimer = null;
    }
  }

  /** Switch to the next station, wrapping around. Returns the new index. */
  function nextStation() {
    stopRadio();
    station = (station + 1) % RADIO_STATIONS.length;
    stepIndex = 0;
    startRadio();
    return station;
  }

  /** Set the station directly (used by the shot stager and save loading). */
  function setStation(index) {
    stopRadio();
    station = ((index % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length;
    stepIndex = 0;
    startRadio();
    return station;
  }

  /** Follow the car's speed: pitch rises, volume fades in while driving. */
  function setEngine(speedRatio, driving) {
    if (!ctx || !engineOsc) return;
    try {
      const t = ctx.currentTime;
      const target = driving ? 0.05 + speedRatio * 0.10 : 0.0;
      engineGain.gain.setTargetAtTime(target, t, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + speedRatio * 130, t, 0.05);
      engineOsc2.frequency.setTargetAtTime(104 + speedRatio * 260, t, 0.05);
    } catch (err) { /* audio is best-effort */ }
  }

  /** Two-tone horn: a short square-wave honk. */
  function horn() {
    if (!ctx || muted) return;
    try {
      const now = ctx.currentTime;
      note(370, now, 0.28, 'square', 0.16);
      note(466, now, 0.28, 'square', 0.12);
    } catch (err) { /* audio is best-effort */ }
  }

  /** Gunshot: a loud crack plus a low thump. */
  function gunshot(big) {
    burst(big ? 0.28 : 0.16, big ? 900 : 1800, big ? 0.7 : 0.5);
    if (!ctx || muted) return;
    note(90, ctx.currentTime, 0.12, 'sine', 0.5);
  }

  /** Punch thud. */
  function punch() {
    burst(0.08, 320, 0.4);
  }

  /** Cash-register style coin chime. */
  function cash() {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    note(midiToFreq(88), now, 0.12, 'sine', 0.22);
    note(midiToFreq(93), now + 0.09, 0.2, 'sine', 0.22);
  }

  /** Mission-complete jingle: a rising pentatonic arpeggio, twice. */
  function missionJingle() {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const seq = [60, 64, 67, 72, 76, 79, 84];
    seq.forEach((midi, i) => {
      note(midiToFreq(midi), now + i * 0.09, 0.3, 'triangle', 0.28);
    });
    note(midiToFreq(84), now + 0.68, 0.55, 'triangle', 0.3);
    note(midiToFreq(79), now + 0.68, 0.55, 'sine', 0.18);
  }

  /** Mission-failed low descending line. */
  function failSting() {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    [55, 51, 48, 43].forEach((midi, i) => {
      note(midiToFreq(midi), now + i * 0.16, 0.3, 'sawtooth', 0.14);
    });
  }

  /** Police siren whoop, one cycle. */
  function siren() {
    if (!ctx || muted) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.35);
      osc.frequency.linearRampToValueAtTime(660, now + 0.7);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.8);
    } catch (err) { /* audio is best-effort */ }
  }

  /** A soft click for menus. */
  function click() {
    if (!ctx || muted) return;
    note(660, ctx.currentTime, 0.06, 'square', 0.08);
  }

  return {
    get station() { return station; },
    get unlocked() { return unlocked; },
    unlock, setMuted, nextStation, setStation, setEngine,
    horn, gunshot, punch, cash, missionJingle, failSting, siren, click,
    startRadio, stopRadio,
  };
}
