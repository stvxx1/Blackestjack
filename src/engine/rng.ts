/**
 * xoshiro128** — small, fast, statistically strong PRNG. State is a plain
 * immutable tuple so it can live inside the (serialisable) game state, which
 * keeps every engine transition a pure function and every shoe replayable
 * from its seed.
 */
export type RngState = readonly [number, number, number, number];

const rotl = (x: number, k: number): number => ((x << k) | (x >>> (32 - k))) >>> 0;

/** Expands a 32-bit seed into a full xoshiro state with splitmix32. */
export function seedRng(seed: number): RngState {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
  const state: [number, number, number, number] = [next(), next(), next(), next()];
  // An all-zero state would emit zeros forever.
  if (state.every((v) => v === 0)) state[0] = 1;
  return state;
}

/** A seed from the platform CSPRNG (Web Crypto, available in browsers and Node 19+). */
export function randomSeed(): number {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

export function nextUint32(state: RngState): { value: number; state: RngState } {
  const [s0, s1, s2, s3] = state;
  const value = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
  const t = (s1 << 9) >>> 0;
  let n2 = (s2 ^ s0) >>> 0;
  let n3 = (s3 ^ s1) >>> 0;
  const n1 = (s1 ^ n2) >>> 0;
  const n0 = (s0 ^ n3) >>> 0;
  n2 = (n2 ^ t) >>> 0;
  n3 = rotl(n3, 11);
  return { value, state: [n0, n1, n2, n3] };
}

const TWO_32 = 0x1_0000_0000;

/** Uniform integer in [0, maxExclusive) with rejection sampling, so no modulo bias. */
export function nextInt(state: RngState, maxExclusive: number): { value: number; state: RngState } {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > TWO_32) {
    throw new RangeError(`nextInt: bound must be an integer in 1..2^32, got ${maxExclusive}`);
  }
  const limit = TWO_32 - (TWO_32 % maxExclusive);
  let s = state;
  for (;;) {
    const r = nextUint32(s);
    s = r.state;
    if (r.value < limit) return { value: r.value % maxExclusive, state: s };
  }
}

/** Fisher–Yates. Returns a new array; the input is untouched. */
export function shuffle<T>(items: readonly T[], state: RngState): { items: T[]; state: RngState } {
  const out = items.slice();
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    const r = nextInt(s, i + 1);
    s = r.state;
    const j = r.value;
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return { items: out, state: s };
}
