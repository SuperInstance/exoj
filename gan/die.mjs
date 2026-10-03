// gan/die.mjs — Deterministic Stochasticity: the Die Engine (SPEC I5).
// Pure functions only. Same seed ⇒ same roll ⇒ same named drift; every roll
// is receiptable ({roll, raw}) so no randomness is ever hidden. There is no
// Math.random anywhere in exoj — the die is the ONLY sanctioned source of
// surprise, and it is fully deterministic.

import { createHash } from 'node:crypto';
import { sha256Hex } from '../core.mjs';
import { SENSOR_LAG_MS } from './constants.mjs';

// Cryptographic d20: sha256 over "seedHex:d20:nonce", first 8 bytes read as
// an unsigned big-endian integer, folded mod 20 into [1, 20]. Uses the exact
// pre-registered construction; sha256Hex from core.mjs is the same digest.
// raw (the full 64-hex digest) is the receipt material.
export function roll20(seedHex, nonce) {
  const raw = sha256Hex(`${seedHex}:d20:${nonce}`);
  const uint = Buffer.from(raw, 'hex').readBigUInt64BE(0);
  const roll = Number(uint % 20n) + 1;
  return { roll, raw };
}

// The pre-registered drift table (SPEC §2): EXACTLY 20 named structural
// pivots. A drift MAY cross the I2 proximity boundary — it is then scarred,
// not refused (SPEC I2/I4). Ordering is part of the pre-registration: entry
// k is selected by roll k+1.
export const DRIFTS = [
  { name: 'argmin-reparent', desc: 'move the lightest row halfway to the densest row vector' },
  { name: 'mass-flood', desc: 'multiply the densest row mass by 1.1' },
  { name: 'row-split', desc: 'split the densest row into two equal-mass rows' },
  { name: 'row-merge', desc: 'merge the two lightest rows into one' },
  { name: 'band-rotate', desc: 'rotate row order by one position' },
  { name: 'floor-lift', desc: 'raise the lightest row mass by half' },
  { name: 'entropy-dam', desc: 'pull the densest vector halfway to the table mean' },
  { name: 'mirror-fold', desc: 'negate every odd vector component' },
  { name: 'spring-cut', desc: 'halve the vector most aligned with the densest row' },
  { name: 'phase-nudge', desc: 'add a small sinusoidal phase term to every component' },
  { name: 'border-widen', desc: 'widen the first and last vector components' },
  { name: 'core-hollow', desc: 'subtract the table mean from the densest vector' },
  { name: 'lattice-shear', desc: 'shear each component toward its neighbour component' },
  { name: 'weight-fast', desc: 'double the lightest row mass' },
  { name: 'weight-slow', desc: 'halve the lightest row mass' },
  { name: 'shallow-till', desc: 'add a small constant to every component' },
  { name: 'deep-till', desc: 'add an alternating-sign constant to every component' },
  { name: 'reverse-mass', desc: 'multiply every row mass by 0.9' },
  { name: 'prune-tail', desc: 'halve the last row mass' },
  { name: 'head-graft', desc: 'graft the head row direction onto the lightest row' },
];

// I5: same seed ⇒ same named drift. Returns the DRIFTS entry, not a copy —
// the table is pre-registered and frozen by convention.
export function driftFor(seedHex, nonce) {
  return DRIFTS[roll20(seedHex, nonce).roll - 1];
}

// Default metering clock: milliseconds as a Number (hrtime.bigint() is
// nanoseconds since process start — far inside Number precision). Tests
// inject fake clocks for determinism; SENSOR_LAG_MS stays the pre-registered
// budget — the clock is a parameter, the constant is not.
export const defaultClock = () => Number(process.hrtime.bigint()) / 1e6;

// Sensor-lag probe: reads clockFn twice and reports elapsed ms. A slow sensor
// (or a fake clock advancing per call) shows up as elapsedMs > budgetMs.
export function sensorLag(clockFn = defaultClock, budgetMs = SENSOR_LAG_MS) {
  const t0 = clockFn();
  const t1 = clockFn();
  const elapsedMs = Math.max(0, t1 - t0);
  return { elapsedMs, budgetMs, overBudget: elapsedMs > budgetMs };
}
