/**
 * Table sounds synthesised with Web Audio, so there are no assets to load. The context is
 * created lazily on first use (browsers only allow audio after a user gesture anyway) and
 * every node is disconnected when its sound ends.
 */
export type SoundName = 'card' | 'chip' | 'flip' | 'win' | 'lose' | 'push' | 'blackjack' | 'shuffle' | 'error';

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null;
  ctx ??= new window.AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noiseBurst(ac: AudioContext, at: number, duration: number, freq: number, gain: number): void {
  const frames = Math.max(1, Math.floor(ac.sampleRate * duration));
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 3;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 0.9;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ac.destination);
  src.onended = () => {
    src.disconnect();
    filter.disconnect();
    g.disconnect();
  };
  src.start(at);
}

function tone(ac: AudioContext, at: number, freq: number, duration: number, gain: number, type: OscillatorType = 'sine'): void {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(g).connect(ac.destination);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

export function playSound(name: SoundName): void {
  const ac = context();
  if (!ac) return;
  const t = ac.currentTime;
  switch (name) {
    case 'card':
      noiseBurst(ac, t, 0.06, 2800, 0.35);
      break;
    case 'flip':
      noiseBurst(ac, t, 0.05, 1800, 0.3);
      noiseBurst(ac, t + 0.05, 0.04, 3200, 0.2);
      break;
    case 'chip':
      tone(ac, t, 2400, 0.05, 0.08, 'triangle');
      tone(ac, t + 0.035, 3100, 0.05, 0.06, 'triangle');
      break;
    case 'shuffle':
      for (let i = 0; i < 8; i++) noiseBurst(ac, t + i * 0.045, 0.05, 2000 + i * 120, 0.18);
      break;
    case 'win':
      tone(ac, t, 660, 0.18, 0.12);
      tone(ac, t + 0.1, 880, 0.25, 0.12);
      break;
    case 'blackjack':
      [523, 659, 784, 1047].forEach((f, i) => {
        tone(ac, t + i * 0.08, f, 0.3, 0.1);
      });
      break;
    case 'push':
      tone(ac, t, 520, 0.18, 0.08);
      break;
    case 'lose':
      tone(ac, t, 300, 0.25, 0.08, 'triangle');
      tone(ac, t + 0.12, 220, 0.3, 0.07, 'triangle');
      break;
    case 'error':
      tone(ac, t, 180, 0.15, 0.08, 'square');
      break;
  }
}

/** A short vibration on devices that support it; silently ignored elsewhere. */
export function buzz(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
}
