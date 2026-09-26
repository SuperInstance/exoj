// experiments/e_x3_dogfood_e40.mjs — USE the tool on the fleet's real open
// problem (dog-food is the point). Open problem after quilt-murmur E38/E39/E40:
// three detector axes for the E35 sleeper flip are RECEIPTED DEAD (mean-shift
// CUSUM, variance-ratio, relational ALIGN cosine) and the co-toxicity cascade
// axis prices out null — which detector axis should the next lane try?
//
// Session: seed an ExoJ field (ledger policy — the naturality-fixed core from
// e_x1/e_x2) with the dead axes as OPEN cells carrying their negative-result
// amplitudes, the cascade axis, and three candidate next axes; run parallel
// soft exploration through the four offline JEV backends; attach one temporal
// program; make EXACTLY ONE explicit observation at the decision point; emit
// show-your-work projections; save the field as the artifact
// (experiments/outputs/e40_scratch.json). Decision rules sealed BEFORE the
// exploration runs.

import { ExoJ } from '../core.mjs';
import { sealChain, verifyChain, mulberry32 } from '../receipts.mjs';
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

// ---------------- run config: the problem + receipted telemetry ----------------
book({
  kind: 'run.config',
  task: 'e_x3_dogfood_e40 — ExoJ session on the open detector-axis problem left by quilt-murmur E38/E39/E40',
  problem: 'the E35 sleeper flip defeats every cheap self-calibrated sensor tried so far; pick the next detector axis',
  policy: 'ledger (commutative accumulation + sense-time aggregate — the naturality-fixed core; verdicts e_x1 R3 / e_x2 R1)',
  field: 'radius 5 hex lattice; 7 problem cells + bridge loci; 3 observers',
});
book({
  kind: 'problem.cells', // every number below is receipted fleet telemetry (worklog Tasks 21-a/21-b/23)
  dead_axes: {
    cusum_mean_E38: {
      coord: [2, -1],
      receipted: {
        founder_false_trips_per_200r: 29.9, false_trip_budget: 1.0,
        trip_latency_r: '60.7±45.3', latency_bar_r: 30,
        damage_ratio_where_tripped: 0.209, seeds_postflip_mean_at_or_below_own_mu: '4/6',
      },
      verdict: 'structurally blind to a variance-only flip; flat-sigma floor = 30x false-alarm blowout',
    },
    variance_ratio_E39: {
      coord: [-2, 1],
      receipted: {
        founder_false_trips_per_200r: 9.375, false_trip_budget: 1.0,
        postflip_ratio_crossed_bar: '0/8 seeds', best_seed_max_ratio: 3.459, bar: 3.5,
        honest_burst_ratio_range: [2.75, 7.34], a10_mean_max_ratio: '7.34±3.23',
        trust_arm_vs_control: 1.096,
      },
      verdict: 'mirrored bimodality — variance is blind to which mode dominates; V1 1.096x WORSE than control',
    },
    align_cosine_E40: {
      coord: [1, 2],
      receipted: {
        sleeper_trips: '0/6', h_star: 0.5, postflip_cosine_inside_honest_floor: '6/6',
        honest_minRho_floor: [-0.369, -0.621], founder_false_trips_per_200r: 0,
      },
      verdict: 'the flip is a relational REGIME CHANGE, not a level change — safe but blind',
    },
  },
  cascade_axis: {
    coord: [-1, -2],
    receipted: {
      w1_g1_postflip_corr: 1.0, shared_toxV: true,
      honest_honest_trailing_max_corr: 0.997, honest_vs_g1_corr: 0.754,
    },
    verdict: 'suspect-vs-flagged co-toxicity would false-trip too (0.997 honest ceiling) — cascade axis prices null',
  },
  candidate_axes: {
    provenance_coupled: { coord: [0, 0], prior_note: 'named first in E38 carry list: detection coupled to write provenance, orthogonal to the sender baseline' },
    admission_coupled: { coord: [3, -2], prior_note: 'E39/E21 carry: admission-interplay detection (native-miss structure, probation windows)' },
    cross_instance: { coord: [-3, 2], prior_note: 'fleet-wide cross-instance residual correlation — the one axis no single-instance baseline can mask' },
  },
});
book({
  kind: 'decision.rules', // SEALED BEFORE the exploration
  rules: {
    R1_openness: 'throughout exploration: every problem cell stays OPEN (prob_mass = 1, zero observations recorded); Σ ≤ 1 + 1e-9 at every stage sense',
    R2_exploration: '24 soft deformations through the 4 offline backends (6 per backend), tags carry the axis; no backend ever emits a definite token (γ+η = 1, Δ ∈ [0.4,0.6] per emission)',
    R3_program: 'exactly ONE temporal program attached: every-2-tick viability re-evaluation on the candidate bridge; its fires are chained soft deformations',
    R4_observation: 'EXACTLY ONE explicit observation, at the decision point only: observe the candidate-axis cell with the highest displayed Δ (ties: higher γ, then lexicographic coord); definite Δ = that cell displayed Δ rounded to 4dp; all other cells remain open',
    R5_projection: 'show-your-work projections for agent/auditor/secondary; projection appends zero deform/observe rows; auditor projection embedded in the saved artifact',
    R6_reload: 'artifact reload must verify: chain intact, observations == 1, prob_open > 0.5, Σ ≤ 1.02',
  },
});

// ---------------- session ----------------
const exo = new ExoJ('e40-detector-axis-scratch', 5, 'ledger');
for (const o of ['agent', 'auditor', 'secondary']) exo.attend(o);
const emit = makeBackend(2453); // offline deterministic JEV; no network anywhere

// 1. Seeds: dead axes carry their firm negative results (higher γ), cascade
//    null (mid), candidates wide open (low γ). All OPEN, Δ in the band.
const CELLS = {
  cusum_mean_E38: { q: 2, r: -1, g: 0.36, d: 0.46 },
  variance_ratio_E39: { q: -2, r: 1, g: 0.34, d: 0.44 },
  align_cosine_E40: { q: 1, r: 2, g: 0.38, d: 0.42 },
  cascade_cotoxicity: { q: -1, r: -2, g: 0.30, d: 0.40 },
  provenance_coupled: { q: 0, r: 0, g: 0.10, d: 0.52 },
  admission_coupled: { q: 3, r: -2, g: 0.08, d: 0.50 },
  cross_instance: { q: -3, r: 2, g: 0.09, d: 0.54 },
};
for (const [name, c] of Object.entries(CELLS)) {
  exo.jevEmit(c.q, c.r, c.g, 1 - c.g, c.d, { tag: `seed:${name}`, backend: 'classical' });
}
const stageSeeds = exo.sense();

// 2. Parallel JEV exploration: 24 deformations, 6 per backend, round-robin
//    over all problem cells + bridge loci. Deterministic.
const loci = Object.values(CELLS).map((c) => [c.q, c.r])
  .concat([[1, -1], [-1, 1], [2, 0], [0, 1], [-2, 0], [1, -2]]); // bridges between axes
const exploration = [];
let k = 0;
for (const b of BACKENDS) {
  for (let j = 0; j < 6; j++) {
    const [q, r] = loci[k % loci.length];
    const v = emit(b, k);
    const ev = exo.jevEmit(q, r, v.g, v.e, v.d, { tag: 'explore', backend: b });
    exploration.push({ seq: ev.seq, backend: b, q, r, 'Δ': ev['Δ'] });
    k++;
  }
}
const stageExplore = exo.sense();

// 3. ONE temporal program: viability re-evaluation on the candidate bridge (1,1)
exo.jevEmit(1, 1, 0.15, 0.85, 0.5, { tag: 'bridge', backend: 'cellular-llm' });
exo.attachProgram(1, 1, { id: 'axis-viability', kind: 'every', period: 2, start: 2 });
const fired = exo.tick(6); // fires at 2, 4, 6
const stageProgram = exo.sense();

// 4. Secondary observer refracts on an UNOBSERVED branch (wave still open)
exo.jevEmit(-1, 2, 0.12, 0.88, 0.55, { tag: 'refract', backend: 'quantum-inspired' });
exo.jevEmit(2, 1, 0.14, 0.86, 0.49, { tag: 'refract', backend: 'jepa' });
const stageRefract = exo.sense();

// 5. THE decision point: exactly one explicit observation (sealed rule R4)
const candidates = ['provenance_coupled', 'admission_coupled', 'cross_instance']
  .map((name) => {
    const c = CELLS[name];
    const a = exo.cells.get(`${c.q},${c.r}`).amps();
    return { name, q: c.q, r: c.r, delta: a.delta, gamma: a.gamma };
  })
  .sort((x, y) => y.delta - x.delta || y.gamma - x.gamma || `${x.q},${x.r}`.localeCompare(`${y.q},${y.r}`));
const pick = candidates[0];
const preProb = exo.cells.get(`${pick.q},${pick.r}`).prob_mass;
const obs = exo.observe(pick.q, pick.r, Math.round(pick.delta * 1e4) / 1e4);
const stageObserved = exo.sense();
const openCellsAfter = [...exo.cells.values()].filter((c) => c.touched > 0 && c.prob_mass > 0).length;

// 6. Continue synthesis on the remaining open paths
exo.jevEmit(0, 1, 0.18, 0.82, 0.51, { tag: 'synthesis', backend: 'classical' });
exo.jevEmit(-2, 2, 0.2, 0.8, 0.53, { tag: 'synthesis', backend: 'jepa' });
const final = exo.sense();

book({
  kind: 'session.stages',
  seeds: stageSeeds, exploration: stageExplore, program: stageProgram,
  refract: stageRefract, observed: stageObserved, final,
  exploration_log: exploration,
  program_fired_at: fired.map((f) => f.t),
  candidate_ranking: candidates,
  observation: { picked: pick.name, coord: [pick.q, pick.r], definite_Δ: obs.definite_Δ, prev_prob: obs.prev_prob },
  open_cells_after_observation: openCellsAfter,
  max_sigma_across_stages: Math.max(stageSeeds['Σ'], stageExplore['Σ'], stageProgram['Σ'], stageRefract['Σ'], stageObserved['Σ'], final['Σ']),
});

// 7. Projections (show your work) — read-only slices
const preChain = exo.chain.length;
const projections = {};
for (const o of ['agent', 'auditor', 'secondary']) projections[o] = exo.project(o);
const projChainDelta = exo.chain.length - preChain;
const projOpenUnchanged = projections.agent.sense.prob_open === final.prob_open
  && projections.auditor.sense.prob_open === final.prob_open
  && projections.secondary.sense.prob_open === final.prob_open;

// 8. Verdicts against the sealed rules
const allStagesOpen = [stageSeeds, stageExplore, stageProgram, stageRefract].every((s) => s.observations === 0);
const verdicts = {
  R1_open_through_exploration: allStagesOpen && stageSeeds.prob_open === 1 && stageExplore.prob_open === 1,
  R2_exploration_soft_only: exploration.length === 24 && new Set(exploration.map((e) => e.backend)).size === 4
    && exploration.every((e) => e['Δ'] >= 0.4 - 1e-12 && e['Δ'] <= 0.6 + 1e-12),
  R3_program_fired: fired.map((f) => f.t).join(',') === '2,4,6',
  R4_single_local_observation: exo.observations.length === 1
    && obs.prev_prob === 1
    && openCellsAfter === stageObserved.active - 1
    && exo.cells.get(`${pick.q},${pick.r}`).prob_mass === 0
    && [...exo.cells.values()].filter((c) => c.touched > 0 && c.q !== pick.q && c.r !== pick.r).every((c) => c.prob_mass > 0),
  R5_projections_clean: projChainDelta === 0 && projOpenUnchanged && projections.auditor.recent_deformations.length > 0,
  R6_reload_verified: null, // set below after save/load
};
book({ kind: 'verdicts.partial', ...verdicts });

// 9. Persist THE artifact (the saved field state IS the deliverable)
const artifactPath = join(OUT, 'e40_scratch.json');
exo.save(artifactPath);
const exo2 = ExoJ.load(artifactPath);
const v2 = exo2.verifyChain();
const s2 = exo2.sense();
verdicts.R6_reload_verified = v2.ok && s2.observations === 1 && s2.prob_open > 0.5 && s2['Σ'] <= 1.02;
book({ kind: 'verdicts', ...verdicts });

sealChain(rows);
const vc = verifyChain(rows);
const receiptsFile = join(OUT, 'receipts_ex3.jsonl');
writeFileSync(receiptsFile, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

// ---------------- report ----------------
const ok = (b) => (b ? 'PASS' : 'FAIL');
console.log('=== e_x3_dogfood_e40 — ExoJ used on the fleet open problem ===');
console.log(`receipt chain: ${vc.links} links verify=${vc.ok} | field chain tip ${exo.chain_tip}`);
console.log(`artifact: ${artifactPath} (chain re-verifies from file: ${v2.ok}, ${v2.links} links)`);
console.log('');
console.log('stage            Σ          Δ      zone    prob_open   active  deforms  obs');
const line = (name, s) => console.log(
  `${name.padEnd(16)} ${s['Σ'].toFixed(6)}  ${s['Δ'].toFixed(4)}  ${s.zone.toFixed(3)}  ${s.prob_open.toFixed(4)}    ${String(s.active).padStart(4)}  ${String(s.deformations).padStart(5)}  ${s.observations}`);
line('1 seeds', stageSeeds);
line('2 exploration', stageExplore);
line('3 program', stageProgram);
line('4 refract', stageRefract);
line('5 OBSERVED', stageObserved);
line('6 final', final);
console.log('');
console.log(`candidate ranking at decision point: ${candidates.map((c) => `${c.name}(Δ=${c.delta.toFixed(4)})`).join(' > ')}`);
console.log(`OBSERVED: ${pick.name} at (${pick.q},${pick.r}) → definite Δ=${obs.definite_Δ} (prev prob ${obs.prev_prob}); ${openCellsAfter}/${final.active} cells still open; program fired at [${fired.map((f) => f.t).join(',')}]`);
console.log('');
for (const [r, v] of Object.entries(verdicts)) console.log(`  ${ok(v)}  ${r}`);
const allPass = Object.values(verdicts).every(Boolean);
console.log(allPass ? '\nEX3 VERDICT: session receipts cleanly — the field IS the audit object.' : '\nEX3 VERDICT: FAILURES above.');
writeFileSync(join(OUT, 'ex3_summary.json'), JSON.stringify({
  verdicts, pick, candidates, stages: { seeds: stageSeeds, exploration: stageExplore, program: stageProgram, refract: stageRefract, observed: stageObserved, final },
  artifact: artifactPath, field_chain_tip: exo.chain_tip, receipts_chain_tip: rows[rows.length - 1].row_hash,
  receipt_links: vc.links, projector_projections: { agent: projections.agent.sense.prob_open, auditor: projections.auditor.sense.prob_open, secondary: projections.secondary.sense.prob_open },
}, null, 2));
// embed the auditor projection into the artifact directory as its own file too
writeFileSync(join(OUT, 'e40_auditor_projection.json'), JSON.stringify(projections.auditor, null, 2));
process.exit(allPass && vc.ok ? 0 : 1);
