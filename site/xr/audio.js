/* The Museum of Technophobia — procedural sound.
   Everything is synthesized on the spot; the museum owns no recordings.
   Nothing plays until the visitor's first gesture (the browser insists,
   and for once the museum agrees with the machine). */

let ctx = null;
let master = null;

export function ensureAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function audioLive() {
  return !!ctx && ctx.state === "running";
}

/* Duck (or restore) everything — the midnight cut. */
export function setMaster(level, seconds) {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(level, t + (seconds || 0.05));
}

/* One-shot tone: blips, clinks, creaks. */
export function tone({ freq = 440, slideTo = null, dur = 0.1, type = "sine",
                       gain = 0.05, attack = 0.005 } = {}) {
  if (!ensureAudio()) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/* One-shot filtered noise: static, thuds, rummage. */
export function noise({ dur = 0.2, gain = 0.05, freq = 1200, q = 1 } = {}) {
  if (!ensureAudio()) return;
  const t = ctx.currentTime;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t);
}

/* Sustained loop (room hum, risers). Returns { setLevel, stop }. */
export function loop({ freq = 50, type = "sawtooth", gain = 0.0,
                       noiseGain = 0.0, filterFreq = 300 } = {}) {
  if (!ensureAudio()) return { setLevel() {}, setNoise() {}, stop() {} };

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const oscGain = ctx.createGain();
  oscGain.gain.value = gain;

  /* looped brown-ish noise bed */
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + (Math.random() * 2 - 1) * 0.02) * 0.998;
    data[i] = last * 12;
  }
  const nsrc = ctx.createBufferSource();
  nsrc.buffer = buf;
  nsrc.loop = true;
  const nGain = ctx.createGain();
  nGain.gain.value = noiseGain;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;

  osc.connect(oscGain).connect(filter);
  nsrc.connect(nGain).connect(filter);
  filter.connect(master);
  osc.start();
  nsrc.start();

  return {
    setLevel(v, seconds) {
      const t = ctx.currentTime;
      oscGain.gain.cancelScheduledValues(t);
      oscGain.gain.setValueAtTime(oscGain.gain.value, t);
      oscGain.gain.linearRampToValueAtTime(v, t + (seconds || 0.1));
    },
    setNoise(v, seconds) {
      const t = ctx.currentTime;
      nGain.gain.cancelScheduledValues(t);
      nGain.gain.setValueAtTime(nGain.gain.value, t);
      nGain.gain.linearRampToValueAtTime(v, t + (seconds || 0.1));
    },
    stop() {
      try { osc.stop(); nsrc.stop(); } catch (e) { /* already stopped */ }
    },
  };
}
