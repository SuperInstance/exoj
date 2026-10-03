#!/usr/bin/env node
// gan/demo.mjs — Wave-69 Bridge 3 artifact receipt (task 69-2, item 10).
// Seeds a Unit Table, runs the Cell 01 moth for 5 steps under a fixed seed,
// validates EVERY step with Cell 02 (enforce — refusals are scarred and the
// refused output never enters the pipeline), then fires one explicit
// die-driven drift step (deterministic d20 → named structural drift), seals
// the whole result into one sxc1 envelope (seq 1, genesis prev), and writes
// experiments/outputs/w69_bridge3_demo.json.
//
// Deterministic: fixed seed, zero-lag virtual clock, no Math.random, offline.
// Per-step proximity values are rounded to 6 decimals for DISPLAY ONLY —
// rounding happens outside any sealed material (the envelope carries hashes,
// counts and verdicts, never floats).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { sha256Hex } from '../core.mjs';
import { MOTH_PROXIMITY } from './constants.mjs';
import { UnitTable } from './unitTable.mjs';
import { StickyScarRegistry } from './scars.mjs';
import { roll20, driftFor, sensorLag } from './die.mjs';
import { step, applyDrift } from './generator.mjs';
import { enforce } from './validator.mjs';
import { emit, verifyEnvelope, GENESIS_PREV } from './envelope.mjs';

const specSha = JSON.parse(readFileSync(new URL('../spec/spec_sha.json', import.meta.url), 'utf8')).spec_sha;
const SEED = sha256Hex('w69-bridge3-demo-seed'); // fixed, 64-hex, deterministic

// --- the field: a non-homogeneous unit table (heterogeneous masses by seed) ---
const ROWS = Array.from({ length: 12 }, (_, i) => `u${String(i).padStart(2, '0')}`);
let table = UnitTable.seeded({ rows: ROWS, W: 16 });
const initialTableHash = table.hash();
const scars = new StickyScarRegistry();
const dieReceipts = [];
const stepRecords = [];

// --- Cell 01 walks; Cell 02 judges; the boundary holds ---
for (let i = 0; i < 5; i++) {
  const nonce = `demo-${i}`;
  const lag = sensorLag(() => 0); // deterministic zero-lag virtual clock metering
  const out = step(table, { seed: SEED, nonce });
  const verdict = enforce(table, out.table, { dieDriven: false, scars, specSha });
  stepRecords.push({
    nonce,
    proximity: table.proximity(out.table).toFixed(6), // display rounding only
    touched: out.touched.length,
    step_hash: out.stepHash,
    verdict: verdict.verdict,
    codes: verdict.codes,
    entered_pipeline: !verdict.compileRefused,
  });
  if (!verdict.compileRefused) table = out.table; // refused output NEVER enters the pipeline
}

// --- the die, fired explicitly: one deterministic d20 → named structural drift ---
const dieRoll = roll20(SEED, 'demo-die');
const drift = driftFor(SEED, 'demo-die');
const preDrift = table;
const drifted = applyDrift(table, drift.name, SEED);
const crossed = preDrift.proximity(drifted) < MOTH_PROXIMITY;
const dieVerdict = enforce(preDrift, drifted, { dieDriven: true, scars, specSha });
if (!dieVerdict.compileRefused && crossed) {
  // a die-driven drift that CROSSED the I2 boundary and compiled MUST be
  // scarred — otherwise any later die-driven validation of this state would
  // (correctly) answer E_BOUNDARY (SPEC I2/I4)
  scars.scar('boundary-cross', `die drift ${drift.name} crossed the I2 boundary`, drifted.hash(), { roll: dieRoll.roll, raw: dieRoll.raw, nonce: 'demo-die', drift: drift.name });
}
dieReceipts.push({
  nonce: 'demo-die',
  roll: dieRoll.roll,
  raw: dieRoll.raw,
  drift: drift.name,
  crossed_boundary: crossed,
  proximity: preDrift.proximity(drifted).toFixed(6), // display rounding only
  verdict: dieVerdict.verdict,
  codes: dieVerdict.codes,
  entered_pipeline: !dieVerdict.compileRefused,
});
if (!dieVerdict.compileRefused) table = drifted;

const chain = scars.verify();
if (!chain.ok) throw new Error('demo: scar chain failed to verify');

// --- seal the result into one sxc1 envelope (seq 1, genesis prev) ---
const envelope = emit({
  seq: 1,
  prev: GENESIS_PREV,
  cell: { id: 'exoj-cell01-generator', kind: 'generator', repo: '@superinstance/exoj', topology: 'unit-table' },
  body: {
    demo: 'w69-bridge3',
    step_count: stepRecords.length,
    die_rolls: dieReceipts.length,
    final_table_hash: table.hash(),
    final_verdict: stepRecords[stepRecords.length - 1].verdict,
    boundary_crossed: crossed,
    scar_count: scars.size(),
  },
  seal: { spec_sha: specSha, die_seed: SEED },
});
const envelopeCheck = verifyEnvelope(envelope, { expectedSeq: 1, expectedPrev: GENESIS_PREV });
if (!envelopeCheck.ok) throw new Error(`demo: envelope failed verification (${envelopeCheck.code})`);

const receipt = {
  spec_sha: specSha,
  die_seed: SEED,
  initial_table_hash: initialTableHash,
  final_table_hash: table.hash(),
  steps: stepRecords,
  die_receipts: dieReceipts,
  final_verdict: stepRecords[stepRecords.length - 1].verdict,
  scars: { count: scars.size(), tip: scars.tip(), verified: chain.ok, kinds: scars.rows().map((r) => r.kind) },
  envelope,
  envelope_verified: envelopeCheck.ok,
};

mkdirSync(new URL('../experiments/outputs/', import.meta.url), { recursive: true });
const outPath = new URL('../experiments/outputs/w69_bridge3_demo.json', import.meta.url);
writeFileSync(outPath, JSON.stringify(receipt, null, 2) + '\n');

console.log(`spec_sha      ${specSha}`);
for (const s of stepRecords) {
  console.log(`step ${s.nonce}  proximity=${s.proximity}  touched=${s.touched}  ${s.verdict}${s.codes.length ? ' ' + s.codes.join(',') : ''}`);
}
for (const d of dieReceipts) {
  console.log(`die  ${d.nonce}  roll=${d.roll}  drift=${d.drift}  crossed=${d.crossed_boundary}  ${d.verdict}${d.codes.length ? ' ' + d.codes.join(',') : ''}`);
}
console.log(`final table   ${table.hash().slice(0, 16)}…  verdict ${receipt.final_verdict}`);
console.log(`scars         ${scars.size()} (chain verified: ${chain.ok})`);
console.log(`envelope      ${envelope.seal.id.slice(0, 16)}…  verified: ${envelopeCheck.ok}`);
console.log(`receipt       ${outPath.pathname}`);
