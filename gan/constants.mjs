// gan/constants.mjs — pre-registered constants (SPEC §1). These are constants,
// NOT knobs: changing any of them requires a re-seal of spec/SPEC.md and a new
// wave receipt. Provenance receipts are quoted inline and in SPEC.md.

// quilt-murmur e40_summary.json `a2 = 0.798023` — the semantic-deviation
// boundary: table proximity below this in a single step is an I2 violation
// unless the step was die-driven (and then it is scarred, not refused).
export const MOTH_PROXIMITY = 0.798;

// quilt-murmur e40_summary.json `min = -0.493824` / `rho = 0.495421` — the
// per-step amplitude budget. The generator's per-component vector delta is
// clamped to MOTH_AMPLITUDE * 0.1; the I3 dispersion slack is MOTH_AMPLITUDE.
export const MOTH_AMPLITUDE = 0.49;

// Directive: sensor lag above 3 ms trips the die (deadlock / lag → the
// deterministic d20 fires and a named structural drift is applied).
export const SENSOR_LAG_MS = 3;

// Directive: 12 consecutive generator iterations without a table-hash change
// is a deadlock → the die fires.
export const DEADLOCK_STEPS = 12;
