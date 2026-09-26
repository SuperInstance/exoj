// experiments/e_x0_pocs.mjs — receipt the seed's own 8 POC claims against the
// JS port (exoj/core.mjs). House discipline: decision rules are sealed in the
// receipt chain BEFORE the numbers that judge them; every number is computed
// from telemetry, not asserted. Receipts BEFORE interpretation.
//
// Seed POC table (seed-grok2.md, verbatim claims):
//   1 Soft write + conservation norm          -> Σ = 1.0
//   2 Creative-band / zone fraction           -> 0.667
//   3 Observe collapses only locally          -> neighbour stays open
//   4 Parallel multi-observer attend          -> α β γ concurrent
//   5 JEV backends emit soft vectors only     -> all Δ in-band, 4 backends
//   6 Dependent projection ("show work")      -> valid slice
//   7 Temporal program on cell                -> fires on schedule
//   8 Content-addressed hash chain            -> chain intact

import { ExoJ } from '../core.mjs';
import { sealChain, verifyChain, mulberry32, canonicalJSON, sha256Hex } from '../receipts.mjs';
import { makeBackend, BACKENDS } from './jev_backends.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'outputs');
mkdirSync(OUT, { recursive: true });

const rows = [];
let rseq = 0;
const book = (row) => { row.seq = rseq++; rows.push(row); return row; };

// ---------------- 0. run config (before any run) ----------------
book({
  kind: 'run.config',
  task: 'e_x0_pocs — receipt the seed charter 8 granular POC claims against exoj/core.mjs (JS port)',
  seed_policy_fields: 'radius 4, policy per-POC as receipted',
  rng: 'mulberry32, fixed seeds, no Math.random, no network',
  note: 'decision rules follow in poc_rules rows BEFORE any result row',
});

// ---------------- 1. decision rules (SEALED BEFORE RESULTS) ----------------
book({
  kind: 'poc_rules', scope: 'all',
  rules: {
    p1_conservation: 'PASS iff after ≥10 balanced soft writes (γ+η=1 per emit) across ≥4 loci on a seed-policy field: |Σ − 1.0| ≤ 1e-9 AND max_cell_Σ ≤ 1 + 1e-9',
    p2_creative_band: 'PASS iff computed zone fraction (active cells with 0.4 ≤ Δ ≤ 0.6) equals 4/6 within 1e-6 when 4 of 6 touched cells are emitted in-band and 2 emitted far out-of-band (Δ_write 0.10 and 0.90 — note: the cell prior Δ=0.5 pulls one-shot α=0.4 writes toward band, so 0.30/0.72 would stay in-band; receipted port semantics) (seed claims 0.667)',
    p3_local_collapse: 'PASS iff after observe(0,0): attended cell prob_mass == 0 AND hex-neighbour (1,0) prob_mass ≥ 0.999 AND distant cell (0,3) prob_mass ≥ 0.999 (no global collapse)',
    p4_multi_observer: 'PASS iff attend(alpha,beta,gamma) leaves all three registered, and Σ/prob_open identical before vs after attends to 1e-15 (attending deforms nothing)',
    p5_soft_vectors: 'PASS iff all 100 emissions (4 backends x 25) satisfy Δ ∈ [0.4, 0.6] (inclusive, 1e-12 tol) AND |γ+η − 1| ≤ 1e-9, read from the chained event payloads',
    p6_projection: 'PASS iff project(auditor) returns format exoj-projection-v1 with sense + ≤12 recent deformations + observation history, appends ZERO chain rows (observer pre-registered) and leaves Σ/prob_open unchanged to 1e-15',
    p7_programs: 'PASS iff every-program (period 3) fires exactly at t ∈ {3,6,9} by t=10 and at-program fires exactly once at t=5, both receipted as chained deform rows tagged program:<id>',
    p8_chain: 'PASS iff verifyChain ok on the mixed session field (deforms+observe+attach+tick+refuse) AND the chain re-verifies from the SAVED file after ExoJ.load',
  },
});

// ---------------- 2. the POCs (numbers computed here) ----------------
const results = {};

// POC 1 — soft write + conservation
{
  const exo = new ExoJ('ex0-p1', 4, 'seed');
  const rng = mulberry32(2401);
  const loci = [[0, 0], [2, -1], [-1, 1], [3, 0]];
  for (let i = 0; i < 10; i++) {
    const g = 0.05 + 0.25 * rng();
    const [q, r] = loci[i % 4];
    exo.jevEmit(q, r, g, 1 - g, 0.42 + 0.14 * rng(), { backend: 'classical', tag: 'poc1' });
  }
  const s = exo.sense();
  results.p1 = { sigma: s['Σ'], max_cell_sigma: s.max_cell_Σ, active: s.active, deformations: s.deformations };
}

// POC 2 — creative-band zone fraction
{
  const exo = new ExoJ('ex0-p2', 4, 'deferred');
  const spec = [[0, 0, 0.42], [1, 0, 0.48], [0, 1, 0.52], [2, -1, 0.58], [0, 3, 0.10], [-2, 2, 0.90]];
  for (const [q, r, d] of spec) exo.jevEmit(q, r, 0.15, 0.85, d, { backend: 'classical', tag: 'poc2' });
  const s = exo.sense();
  results.p2 = { zone: s.zone, seed_claim: 0.667, target: 4 / 6, active: s.active };
}

// POC 3 — observe collapses only locally
{
  const exo = new ExoJ('ex0-p3', 4, 'seed');
  for (const [q, r] of [[0, 0], [1, 0], [0, 3]]) exo.jevEmit(q, r, 0.2, 0.8, 0.5, { tag: 'poc3' });
  const before = exo.sense().prob_open;
  exo.observe(0, 0, 0.55);
  const cT = exo.cells.get('0,0'), cN = exo.cells.get('1,0'), cD = exo.cells.get('0,3');
  results.p3 = {
    prob_open_before: before, prob_open_after: exo.sense().prob_open,
    target_prob: cT.prob_mass, neighbour_prob: cN.prob_mass, distant_prob: cD.prob_mass,
    neighbour_delta_unchanged: cN.delta,
  };
}

// POC 4 — parallel multi-observer attend
{
  const exo = new ExoJ('ex0-p4', 4, 'seed');
  for (const [q, r] of [[0, 0], [2, -1], [-1, 2], [3, -1]]) exo.jevEmit(q, r, 0.18, 0.82, 0.44 + 0.04 * (q + 2), { tag: 'poc4' });
  const s0 = exo.sense();
  const chainBefore = exo.chain.length;
  let list = [];
  for (const o of ['alpha', 'beta', 'gamma']) list = exo.attend(o);
  const s1 = exo.sense();
  results.p4 = {
    observers: list, sigma_before: s0['Σ'], sigma_after: s1['Σ'],
    prob_open_before: s0.prob_open, prob_open_after: s1.prob_open,
    chain_rows_added_by_attend: exo.chain.length - chainBefore,
  };
}

// POC 5 — JEV backends emit soft vectors only (offline deterministic sim)
{
  const emit = makeBackend(2401);
  const per = {};
  let all = true, total = 0;
  for (const b of BACKENDS) {
    const exo = new ExoJ('ex0-p5-' + b, 4, 'deferred');
    let inBand = 0, conserved = 0, n = 25, dMin = 1, dMax = 0, consMax = 0;
    for (let k = 0; k < n; k++) {
      const v = emit(b, k);
      const ev = exo.jevEmit((k % 5) - 2, (k % 3) - 1, v.g, v.e, v.d, { backend: b, tag: 'poc5' });
      if (ev['Δ'] >= 0.4 - 1e-12 && ev['Δ'] <= 0.6 + 1e-12) inBand++;
      const dev = Math.abs(ev['γ'] + ev['η'] - 1);
      if (dev <= 1e-9) conserved++;
      consMax = Math.max(consMax, dev);
      dMin = Math.min(dMin, ev['Δ']); dMax = Math.max(dMax, ev['Δ']);
    }
    per[b] = { n, in_band: inBand, conserved, d_min: dMin, d_max: dMax, max_g_plus_eta_deviation: consMax };
    if (inBand !== n || conserved !== n) all = false;
    total += inBand;
  }
  results.p5 = { backends: per, total_in_band: total, total_emissions: 100 };
}

// POC 6 — dependent projection (valid slice, read-only)
{
  const exo = new ExoJ('ex0-p6', 4, 'seed');
  for (let i = 0; i < 14; i++) exo.jevEmit((i % 4) - 1, i % 3, 0.1 + 0.03 * i, 0.9 - 0.03 * i, 0.44 + 0.02 * (i % 5), { tag: 'poc6', backend: BACKENDS[i % 4] });
  exo.observe(0, 1, 0.5);
  exo.attend('auditor'); // pre-register: projection itself must append ZERO rows
  const s0 = exo.sense(); const c0 = exo.chain.length;
  const p = exo.project('auditor');
  const s1 = exo.sense(); const c1 = exo.chain.length;
  results.p6 = {
    format: p.format, has_sense: !!p.sense, recent_deformations: p.recent_deformations.length,
    observations_listed: p.observations.length, note_present: typeof p.note === 'string' && p.note.length > 0,
    chain_rows_appended: c1 - c0,
    sigma_before: s0['Σ'], sigma_after: s1['Σ'],
    prob_open_before: s0.prob_open, prob_open_after: s1.prob_open,
  };
}

// POC 7 — temporal program fires on schedule
{
  const exo = new ExoJ('ex0-p7', 4, 'deferred');
  exo.jevEmit(0, 0, 0.2, 0.8, 0.5, { tag: 'poc7-seed' });
  exo.jevEmit(1, 0, 0.2, 0.8, 0.52, { tag: 'poc7-seed' });
  exo.attachProgram(0, 0, { id: 'zone-guard', kind: 'every', period: 3, start: 3 });
  exo.attachProgram(1, 0, { id: 'one-shot', kind: 'at', at: 5 });
  const fired = exo.tick(10);
  const every = fired.filter((f) => f.program === 'zone-guard').map((f) => f.t);
  const once = fired.filter((f) => f.program === 'one-shot').map((f) => f.t);
  const tagged = exo.chain.filter((r) => r.kind === 'deform' && String(r.tag).startsWith('program:')).length;
  results.p7 = { every_fired_at: every, at_fired_at: once, chained_program_deforms: tagged };
}

// POC 8 — content-addressed hash chain intact (mixed workload + save/load)
{
  const exo = new ExoJ('ex0-p8', 4, 'refuse');
  exo.attend('agent');
  for (let i = 0; i < 8; i++) exo.jevEmit(i % 3, -(i % 2), 0.15 + 0.05 * (i % 4), 0.85 - 0.05 * (i % 4), 0.42 + 0.04 * (i % 5), { backend: BACKENDS[i % 4], tag: 'poc8' });
  exo.jevEmit(0, 0, 0.95, 0.4, 0.5, { tag: 'poc8-attack' }); // breach → refused, chained
  exo.observe(2, -1, 0.51);
  exo.attachProgram(0, 0, { id: 'p8', kind: 'every', period: 4, start: 4 });
  exo.tick(8);
  const v1 = exo.verifyChain();
  const path = join(OUT, 'ex0_p8_state.json');
  exo.save(path);
  const exo2 = ExoJ.load(path);
  const v2 = exo2.verifyChain();
  const kinds = {};
  for (const r of exo.chain) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1;
  results.p8 = {
    links: exo.chain.length, kinds,
    verify_in_memory: v1, verify_from_file: v2,
    refusals: exo.stats.refusals,
    tip_hash: v1.tip,
  };
}

// ---------------- 3. verdicts (judged by the SEALED rules) ----------------
const v = {};
v.p1 = Math.abs(results.p1.sigma - 1) <= 1e-9 && results.p1.max_cell_sigma <= 1 + 1e-9;
v.p2 = Math.abs(results.p2.zone - results.p2.target) <= 1e-6;
v.p3 = results.p3.target_prob === 0 && results.p3.neighbour_prob >= 0.999 && results.p3.distant_prob >= 0.999;
v.p4 = results.p4.observers.length === 3
  && Math.abs(results.p4.sigma_before - results.p4.sigma_after) <= 1e-15
  && Math.abs(results.p4.prob_open_before - results.p4.prob_open_after) <= 1e-15;
v.p5 = results.p5.total_in_band === 100
  && Object.values(results.p5.backends).every((b) => b.conserved === b.n);
v.p6 = results.p6.format === 'exoj-projection-v1' && results.p6.has_sense
  && results.p6.recent_deformations > 0 && results.p6.recent_deformations <= 12
  && results.p6.observations_listed === 1 && results.p6.chain_rows_appended === 0
  && Math.abs(results.p6.sigma_before - results.p6.sigma_after) <= 1e-15
  && Math.abs(results.p6.prob_open_before - results.p6.prob_open_after) <= 1e-15;
v.p7 = JSON.stringify(results.p7.every_fired_at) === JSON.stringify([3, 6, 9])
  && JSON.stringify(results.p7.at_fired_at) === JSON.stringify([5])
  && results.p7.chained_program_deforms === 4;
v.p8 = results.p8.verify_in_memory.ok === true && results.p8.verify_from_file.ok === true
  && results.p8.refusals === 1;

// book result + verdict rows (chain: rules were booked BEFORE results)
book({ kind: 'poc.results', numbers: results });
book({ kind: 'poc.verdicts', pass: v, all_pass: Object.values(v).every(Boolean) });

// ---------------- 4. seal + verify + persist ----------------
sealChain(rows);
const vc = verifyChain(rows);
const file = join(OUT, 'receipts_ex0.jsonl');
writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
const vcFile = verifyChain(readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)));

// ---------------- 5. report (receipts first, interpretation second) ----------------
const P = (b) => (b ? 'PASS' : 'FAIL');
console.log('=== e_x0_pocs — seed POC table vs JS port ===');
console.log(`chain: ${vc.links} links, verify=${vc.ok} (file re-verify=${vcFile.ok}) tip=${rows[rows.length - 1].row_hash.slice(0, 16)}`);
const line = (n, name, claim, verdict, num) =>
  console.log(`  ${n} ${P(verdict)}  ${name.padEnd(38)} claim: ${claim.padEnd(24)} computed: ${num}`);
line('01', 'Soft write + conservation', 'Σ = 1.0', v.p1,
  `Σ=${results.p1.sigma.toFixed(12)} max_cell_Σ=${results.p1.max_cell_sigma.toFixed(12)} active=${results.p1.active}`);
line('02', 'Creative-band zone fraction', '0.667', v.p2,
  `zone=${results.p2.zone.toFixed(6)} (target ${results.p2.target.toFixed(6)}, 4/6 cells in band)`);
line('03', 'Observe collapses only locally', 'neighbour stays open', v.p3,
  `target prob=${results.p3.target_prob} neighbour=${results.p3.neighbour_prob} distant=${results.p3.distant_prob}`);
line('04', 'Parallel multi-observer attend', 'α β γ concurrent', v.p4,
  `observers=[${results.p4.observers.join(' ')}] ΔΣ=${Math.abs(results.p4.sigma_before - results.p4.sigma_after)}`);
line('05', 'JEV backends emit soft vectors', 'all Δ in-band, 4 backends', v.p5,
  `${results.p5.total_in_band}/100 in [0.4,0.6], 4/4 backends conserve γ+η=1 (max dev ${Math.max(...Object.values(results.p5.backends).map((b) => b.max_g_plus_eta_deviation)).toExponential(1)})`);
line('06', 'Dependent projection', 'valid slice', v.p6,
  `format=${results.p6.format} deformations=${results.p6.recent_deformations} chain rows appended=${results.p6.chain_rows_appended}`);
line('07', 'Temporal program on cell', 'fires on schedule', v.p7,
  `every@${results.p7.every_fired_at.join(',')} once@${results.p7.at_fired_at.join(',')} chained=${results.p7.chained_program_deforms}`);
line('08', 'Content-addressed hash chain', 'chain intact', v.p8,
  `links=${results.p8.links} kinds=${JSON.stringify(results.p8.kinds)} refusals=${results.p8.refusals} file-verify=${results.p8.verify_from_file.ok}`);

const allPass = Object.values(v).every(Boolean);
console.log(allPass ? `\nEX0 VERDICT: 8/8 PASS — the seed's POC table receipts against the JS port.` : `\nEX0 VERDICT: FAILURES — see rows above.`);
writeFileSync(join(OUT, 'ex0_summary.json'), JSON.stringify({ verdicts: v, all_pass: allPass, results, chain: { links: vc.links, ok: vc.ok, verify_from_file: vcFile.ok, tip: rows[rows.length - 1].row_hash } }, null, 2));
process.exit(allPass && vc.ok && vcFile.ok ? 0 : 1);
