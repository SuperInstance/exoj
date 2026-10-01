// experiments/jev_backends.mjs — deterministic OFFLINE simulation of the four
// JEV backends (classical / jepa / quantum-inspired / cellular-llm).
// No network, no API: each backend is a fixed seeded generator over the soft
// output contract — γ+η = 1 (conservation by construction), Δ ∈ [0.4, 0.6]
// (creative band by construction). Same generators feed e_x0 (POC-5) and
// e_x3 (dogfood) so the sessions replay byte-identically.

import { mulberry32 } from '../receipts.mjs';

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export const BACKENDS = ['classical', 'jepa', 'quantum-inspired', 'cellular-llm'];

export function makeBackend(seed = 2401) {
  const rng = mulberry32(seed);
  const u = () => rng();
  const gen = {
    classical(k) {
      const g = 0.08 + 0.30 * u();
      return { g, e: 1 - g, d: clamp01(0.4 + 0.2 * u()) };
    },
    jepa(k) {
      // latent-phase smoothing: Δ glides along a deterministic latent clock
      const d = 0.4 + 0.2 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (u() + k / 7)));
      const g = 0.10 + 0.22 * u();
      return { g, e: 1 - g, d: clamp01(d) };
    },
    'quantum-inspired'(k) {
      // amplitude-rotation style: θ splits γ-mass, |cos θ| steers Δ
      const th = (Math.PI / 3) * u();
      const g = 0.32 * Math.sin(th) * Math.sin(th);
      return { g, e: 1 - g, d: clamp01(0.4 + 0.2 * Math.abs(Math.cos(th))) };
    },
    'cellular-llm'(k) {
      // neighborhood-majority style: Δ quantized over a 4-state lattice + jitter
      const d = 0.4 + 0.2 * ((k % 4) / 3) * 0.96 + 0.008 * u();
      const g = 0.12 + 0.20 * u();
      return { g, e: 1 - g, d: clamp01(d) };
    },
  };
  return (backend, k) => gen[backend](k);
}
