// Small synthesized sound kit. Everything is generated with WebAudio so the
// prototypes stay a few MB; real recorded SFX can replace these 1:1 later.
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
let ctx = null, master = null, muted = false, noiseBuffer = null;

export function setMuted(value) { muted = !!value; if (master) master.gain.value = muted ? 0 : 0.9; }
export const isMuted = () => muted;

function audio() {
  if (muted) return null;
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = 0.9;
      master.connect(comp); comp.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}
// iOS only starts audio inside a gesture; call this from the first pointerdown.
export function unlock() { const a = audio(); if (a) tone(a, {freq: 40, dur: 0.01, gain: 0.0001}); }

function env(a, gainNode, t, attack, decay, peak) {
  gainNode.gain.setValueAtTime(0.0001, t);
  gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}
function tone(a, {freq, to = freq, type = 'sine', dur = 0.2, attack = 0.005, gain = 0.2, at = 0, filter = null}) {
  const t = a.currentTime + at, osc = a.createOscillator(), g = a.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, t);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  env(a, g, t, attack, dur, gain);
  let node = osc;
  if (filter) { const f = a.createBiquadFilter(); f.type = filter.type || 'lowpass'; f.frequency.value = filter.freq; f.Q.value = filter.q || 0.7; osc.connect(f); node = f; }
  node.connect(g); g.connect(master); osc.start(t); osc.stop(t + attack + dur + 0.02);
}
function noise(a, {dur = 0.1, gain = 0.15, at = 0, type = 'bandpass', freq = 2000, to = freq, q = 1}) {
  const t = a.currentTime + at, src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = noiseBuffer; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t); if (to !== freq) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  env(a, g, t, 0.004, dur, gain);
  src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur + 0.05);
}
const note = (base, step) => base * 2 ** (PENTA[Math.max(0, Math.min(PENTA.length - 1, step))] / 12);

export const sfx = {
  tap() { const a = audio(); if (!a) return; tone(a, {freq: 1400, to: 900, dur: 0.04, gain: 0.06, type: 'triangle'}); },
  lift() { const a = audio(); if (!a) return; tone(a, {freq: 520, to: 780, dur: 0.07, gain: 0.07, type: 'triangle'}); },
  drop() { const a = audio(); if (!a) return; tone(a, {freq: 180, to: 90, dur: 0.12, gain: 0.16}); noise(a, {dur: 0.05, gain: 0.05, type: 'lowpass', freq: 500}); },
  // Merge pitch climbs a pentatonic ladder with the item level and chain depth.
  merge(level = 1, depth = 0) {
    const a = audio(); if (!a) return; const f = note(392, level - 1 + depth);
    tone(a, {freq: f * 0.82, to: f, dur: 0.05, gain: 0.16, type: 'triangle'});
    tone(a, {freq: f, dur: 0.22, gain: 0.18, at: 0.03});
    tone(a, {freq: f * 2, dur: 0.18, gain: 0.07, at: 0.06});
    noise(a, {dur: 0.03, gain: 0.08, freq: 3200, q: 2});
  },
  spawn(level = 1) { const a = audio(); if (!a) return; const f = note(523, level); tone(a, {freq: f * 1.3, to: f, dur: 0.09, gain: 0.12, type: 'triangle'}); noise(a, {dur: 0.04, gain: 0.05, freq: 1800}); },
  whoosh(at = 0) { const a = audio(); if (!a) return; noise(a, {dur: 0.28, gain: 0.12, freq: 500, to: 2400, q: 1.4, at}); },
  coin(at = 0) { const a = audio(); if (!a) return; tone(a, {freq: 988, dur: 0.06, gain: 0.08, type: 'square', at, filter: {freq: 3000}}); tone(a, {freq: 1319, dur: 0.16, gain: 0.08, type: 'square', at: at + 0.06, filter: {freq: 3000}}); },
  sparkle(at = 0) { const a = audio(); if (!a) return; for (let i = 0; i < 3; i++) tone(a, {freq: 1800 + i * 420, dur: 0.12, gain: 0.04, at: at + i * 0.035}); },
  error() { const a = audio(); if (!a) return; tone(a, {freq: 220, to: 180, dur: 0.12, gain: 0.12, type: 'triangle'}); tone(a, {freq: 165, to: 140, dur: 0.16, gain: 0.12, type: 'triangle', at: 0.1}); },
  clear(wave = 1) { const a = audio(); if (!a) return; const f = note(523, Math.min(wave + 1, 8)); tone(a, {freq: f, dur: 0.14, gain: 0.09}); tone(a, {freq: f * 1.5, dur: 0.12, gain: 0.05, at: 0.03}); noise(a, {dur: 0.05, gain: 0.05, freq: 2600, q: 1.2}); },
  swap() { const a = audio(); if (!a) return; tone(a, {freq: 380, to: 560, dur: 0.07, gain: 0.07, type: 'triangle'}); },
  power() { const a = audio(); if (!a) return; tone(a, {freq: 140, to: 55, dur: 0.32, gain: 0.22}); noise(a, {dur: 0.35, gain: 0.16, type: 'lowpass', freq: 1400, to: 200}); },
  chime(at = 0) {
    const a = audio(); if (!a) return;
    [523, 659, 784, 1047].forEach((f, i) => { tone(a, {freq: f, dur: 0.9, gain: 0.09, at: at + i * 0.09}); tone(a, {freq: f * 2.76, dur: 0.4, gain: 0.02, at: at + i * 0.09}); });
  },
  fanfare() {
    const a = audio(); if (!a) return;
    [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.32], [784, 0.46], [1047, 0.56]].forEach(([f, at]) => { tone(a, {freq: f, dur: 0.32, gain: 0.1, type: 'triangle', at}); tone(a, {freq: f / 2, dur: 0.3, gain: 0.05, at}); });
    noise(a, {dur: 0.5, gain: 0.03, freq: 6000, q: 0.5, at: 0.3});
  },
  build() { const a = audio(); if (!a) return; [0, 0.11, 0.22].forEach((at, i) => { tone(a, {freq: 200 - i * 20, to: 90, dur: 0.1, gain: 0.14, at}); noise(a, {dur: 0.06, gain: 0.07, type: 'lowpass', freq: 900, at}); }); this.chime(0.35); },
  energy() { const a = audio(); if (!a) return; tone(a, {freq: 660, to: 1320, dur: 0.18, gain: 0.07, type: 'triangle'}); }
};
