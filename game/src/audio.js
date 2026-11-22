// Ember Duel — audio.js
// All sound is synthesized with WebAudio: no audio files, no network.
// A short blip per event, pitched by element, plus a little win arpeggio.

const ELEMENT_FREQ = { flame: 220, tide: 330, stone: 165, gale: 440 };

let ctx = null;
let muted = false;

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

function audioContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq, startAt, duration, type, volume) {
  const ac = audioContext();
  if (!ac || muted) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + startAt);
  gain.gain.setValueAtTime(0.0001, ac.currentTime + startAt);
  gain.gain.exponentialRampToValueAtTime(volume, ac.currentTime + startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + startAt + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(ac.currentTime + startAt);
  osc.stop(ac.currentTime + startAt + duration + 0.05);
}

export function playDrawSound() {
  tone(520, 0, 0.08, 'sine', 0.08);
}

export function playCardSound(element) {
  const base = ELEMENT_FREQ[element] ?? 262;
  tone(base, 0, 0.12, 'triangle', 0.14);
  tone(base * 1.5, 0.05, 0.12, 'triangle', 0.1);
}

export function playHitSound(big) {
  tone(big ? 90 : 140, 0, big ? 0.25 : 0.15, 'sawtooth', big ? 0.2 : 0.12);
  tone(70, 0.02, 0.18, 'square', 0.08);
}

export function playGuardSound() {
  tone(180, 0, 0.18, 'sine', 0.12);
  tone(240, 0.06, 0.14, 'sine', 0.08);
}

export function playHealSound() {
  tone(523, 0, 0.14, 'sine', 0.1);
  tone(659, 0.08, 0.14, 'sine', 0.1);
  tone(784, 0.16, 0.2, 'sine', 0.1);
}

export function playSurgeSound() {
  tone(440, 0, 0.1, 'triangle', 0.14);
  tone(554, 0.07, 0.1, 'triangle', 0.14);
  tone(659, 0.14, 0.16, 'triangle', 0.14);
  tone(880, 0.21, 0.22, 'triangle', 0.12);
}

export function playTurnSound() {
  tone(392, 0, 0.1, 'sine', 0.08);
}

export function playWinSound() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.22, 'triangle', 0.14));
  tone(1319, 0.5, 0.4, 'triangle', 0.12);
}

export function playLossSound() {
  [392, 330, 262, 196].forEach((f, i) => tone(f, i * 0.16, 0.26, 'sine', 0.12));
}
