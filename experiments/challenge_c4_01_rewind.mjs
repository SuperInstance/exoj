// REQUIRES sibling clone: git clone https://github.com/SuperInstance/quilt-dba.git ../quilt-dba
// (same parent dir as this repo) — wave-69 drill finding. Without it the
// imports below crash with ERR_MODULE_NOT_FOUND on a fresh clone.
//
// experiments/challenge_c4_01_rewind.mjs — TAVERN ROUND FOUR challenge probe
// C4-field-singer-01 -> time-smith (dba lane).
//
// THE CLAIM UNDER PROBE: dba's E-D4 "exact time travel" (dba/rewind.mjs —
// per-eval events with exact inverses, rewind = one deterministic fold) is a
// PROPERTY of the journal mechanism, not a property of the one receipted
// trajectory. E-D4's R1 swept ITS run: arm A, gain 1, 500 evals, seeds probed
// from {3,7,11,23,43,101}. This probe runs an UNRECEIPTED configuration —
// seed 271828, gain 3, arm 'A', 300 evals — and demands exactness at EVERY
// tick 0..300 (hash AND full-canon string equality), plus E-D4's own R2
// resume-equivalence at an unreceipted k=137.
//
// FALSIFIES: any single tick where rewind(k) != forward(k) (hash or canon),
// or resume-from-137 != never-interrupted terminal — E-D4's crown would then
// be trajectory-specific and the "exact time travel" claim must be re-scoped.
//
// Read-only cross-repo import (silicon->arch precedent): dba sources are NOT
// modified. Deterministic, headless, no network, no keys.
import { Driver, step as coreStep } from '../../quilt-dba/dba/core.mjs';
import {
  checkpoint, recordStep, rewind, seal, forkLog, verifyRewind,
  stateHash, stateCanon, sampleCanon,
} from '../../quilt-dba/dba/rewind.mjs';

const SEED = 271828;      // NOT in E-D4's receipted candidate set
const GAIN = 3;           // E-D4 receipted gain 1
const EVALS = 300;        // E-D4 receipted 500
const RESUME_K = 137;     // unreceipted resume point

console.log(`C4-field-singer-01: dba exact rewind GENERALIZES? seed=${SEED} gain=${GAIN} evals=${EVALS} (all unreceipted config)`);

// forward run with per-tick canon sampling (full sweep needs every tick)
const d = new Driver({ arm: 'A', seed: SEED, gain: GAIN });
const log = checkpoint(d, { challenge: 'C4-field-singer-01', seed: SEED, gain: GAIN });
for (let i = 0; i < EVALS; i++) {
  recordStep(d, log, {});
  sampleCanon(log, d);
  if (d.state.metrics.diverged) { console.error(`DIVERGED at eval ${d.state.eval}: ${d.state.metrics.divergenceWhy}`); break; }
}
seal(log, d);
console.log(`forward: ${log.events.length} events, terminal eval ${d.state.eval}, terminalHash ${log.terminalHash}`);
if (d.state.metrics.diverged) {
  console.log('VERDICT: probe INVALID as run (driver diverged on this config) — challenge re-issued with a fresh config; no claim either way');
  process.exit(2);
}

// full sweep: EVERY tick 0..300 must bit-equal (verifyRewind checks 64-bit
// hash vs the event's recorded postHash AND full-canon STRING vs sampleCanon)
const allKs = [];
for (let k = 0; k <= log.events.length; k++) allKs.push(k);
const v = verifyRewind(log, allKs, {});
const bad = v.checks.filter((c) => !c.bitEqual);
console.log(`full sweep: ${v.checks.length} ticks checked, mismatches ${bad.length}${bad.length ? ' first: ' + JSON.stringify(bad[0]) : ''}`);

// resume-equivalence at unreceipted k=137 (E-D4's R2 at a new point)
const fk = forkLog(log, RESUME_K, {});
const d2 = fk.driver;
for (let i = d2.state.eval; i < EVALS; i++) recordStep(d2, fk.log, {});
seal(fk.log, d2);
const resumeOk = fk.log.terminalHash === log.terminalHash && stateCanon(d2) === stateCanon(d);
console.log(`resume-from-${RESUME_K}: finalHash ${fk.log.terminalHash === log.terminalHash ? '==' : '!='} terminal, canon ${stateCanon(d2) === stateCanon(d) ? '==' : '!='} terminal`);

const pass = v.ok && bad.length === 0 && resumeOk;
console.log(pass
  ? `C4 CONFIRMED: rewind exact at ALL ${allKs.length}/${allKs.length} ticks on an unreceipted config + resume-from-${RESUME_K} bit-equal — the mechanism generalizes`
  : `C4 FALSIFIED: E-D4's exact rewind did NOT generalize (see above)`);
process.exit(pass ? 0 : 1);
