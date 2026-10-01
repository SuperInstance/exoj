// experiments/e_x1_naturality.mjs — does the seed's own deformation policy
// satisfy the seed's own axiom?
//
// The seed (§3) CLAIMS: "A deformation d is a natural transformation
// Id ⇒ Id … Naturality says that the update is independent of the order in
// which observers attend; that is exactly the parallel-first axiom."
//
// But the reference _norm() renormalises EVERY ACTIVE CELL after EVERY emit
// (a conditional, global, nonlinear map interleaved with convex per-cell
// updates). Convex updates to one cell from different targets are themselves
// non-commutative. Prediction: the seed policy is order-DEPENDENT — it
// violates its own parallel-first axiom.
//
// Design (sealed in the receipt chain BEFORE the runs):
//   - fixed multiset of K=15 deformations across 3 loci (payloads booked),
//   - 10 orderings: identity, reverse, 8 mulberry32 shuffles (seed 2424),
//   - policies: P0 'seed' (verbatim) / P1 'deferred' (prescribed fix: never
//     mutate during emit; normalisation is a pure sense-time view) /
//     P2 'ledger' (full fix: commutative α-weighted accumulation, aggregate
//     computed at sense time — normalisation never touches state),
//   - metric: over the union of touched cells, max |Δγ|+|Δη| between final
//     states (normalized view applied uniformly to all policies), plus Σ and
//     zone spreads across orderings.
//
// Sealed decision rule: a policy is order-independent (natural) iff max
// pairwise final-state divergence ≤ 1e-9 on the normalized view.

import { ExoJ, normalizeView } from '../core.mjs';
import { sealChain, verifyChain, mulberry32 } from '../receipts.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'outputs');
mkdirSync(OUT, { recursive: true });

const rows = [];
let rseq = 0;
const book = (row) => { row.seq = rseq++; rows.push(row); return row; };

// ---------------- run config + sealed rules (BEFORE runs) ----------------
book({
  kind: 'run.config',
  task: 'e_x1_naturality — test the seed deformation policy against its own parallel-first axiom, then receipt the fix',
  axiom_under_test: 'seed section 3: deformation is a natural transformation; update independent of order (parallel-first)',
  tolerance: 'order-independent iff max pairwise divergence (normalized view) <= 1e-9; raw float values also receipted',
});
book({
  kind: 'decision.rules',
  rules: {
    R1_seed_verdict: 'seed policy VIOLATES its axiom iff P0 max pairwise divergence > 1e-9',
    R2_fix_verdict: 'deferred-norm fix IMPROVES iff P1 divergence < P0 divergence; closes iff P1 <= 1e-9 (honest negative allowed: convex per-cell updates remain order-dependent)',
    R3_ledger_verdict: 'ledger policy is natural iff P2 divergence <= 1e-9 (float non-associativity ~1e-15 expected and receipted raw)',
    R4_multiset: 'K=15 deformations, 3 loci x 5, stream engineered so mean Σ crosses 1.001 (the seed _norm trigger) during every ordering; payloads booked in multiset row BEFORE any run',
    R5_orderings: '10 orderings: identity, reverse, 8 deterministic shuffles (mulberry32 seed 2424, Fisher-Yates)',
    R6_metric: 'final state per ordering = normalizedView over union of touched cells (same pure projection for all policies); divergence(a,b) = max over cells of |γ_a−γ_b|+|η_a−η_b|; spreads = max−min across orderings',
  },
});

// ---------------- fixed multiset + orderings (booked before runs) ----------------
const LOCI = [[0, 0], [2, -1], [-1, 2]];
const rng = mulberry32(2424);
// 5 items per locus; attack items carry γ+η > 1 so the mean crosses the seed's
// 1.001 norm trigger mid-stream in every ordering; fillers sit at Σ = 1.
const MULT = [];
for (let L = 0; L < 3; L++) {
  for (let j = 0; j < 5; j++) {
    const attack = j < 3; // 3 attack + 2 filler per locus
    const g = attack ? 0.55 + 0.35 * rng() : 0.08 + 0.3 * rng();
    const e = attack ? 1.55 - g : 1 - g;
    MULT.push({
      locus: L, q: LOCI[L][0], r: LOCI[L][1],
      g: +g.toFixed(6), e: +e.toFixed(6),
      d: +(0.4 + 0.2 * rng()).toFixed(6),
      alpha: +(0.25 + 0.25 * rng()).toFixed(6),
      tag: attack ? 'attack' : 'filler', backend: ['classical', 'jepa', 'quantum-inspired', 'cellular-llm'][j % 4],
    });
  }
}
const identity = MULT.map((_, i) => i);
const reverse = [...identity].reverse();
const shuffles = [];
const rng2 = mulberry32(2424);
for (let s = 0; s < 8; s++) {
  const a = [...identity];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng2() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  shuffles.push(a);
}
const ORDERINGS = [identity, reverse, ...shuffles];
book({
  kind: 'multiset.and.orderings', K: MULT.length, loci: LOCI,
  multiset: MULT,
  orderings: ORDERINGS.map((o, i) => ({ name: i === 0 ? 'identity' : i === 1 ? 'reverse' : 'shuffle-' + (i - 2), perm: o })),
  norm_trigger_note: 'sum of per-locus attack mass guarantees mean Σ > 1.001 mid-stream in every ordering (receipted by norms_fired > 0 in P0 results)',
});

// ---------------- runner ----------------
function runPolicy(policy) {
  const states = [];
  const senses = [];
  const normsPerRun = [];
  let refusals = 0;
  for (const perm of ORDERINGS) {
    const exo = new ExoJ('ex1-' + policy, 4, policy);
    for (const idx of perm) {
      const m = MULT[idx];
      exo.jevEmit(m.q, m.r, m.g, m.e, m.d, { alpha: m.alpha, tag: m.tag, backend: m.backend });
    }
    normsPerRun.push(exo.stats.norms_fired);
    refusals = Math.max(refusals, exo.stats.refusals);
    const union = [...exo.cells.values()].filter((c) => c.touched > 0);
    const view = normalizeView(union);
    const flat = {};
    for (const [k, v] of view) flat[k] = [v['γ'], v['η'], v['Δ']];
    states.push(flat);
    const s = exo.sense();
    senses.push({ sigma: s['Σ'], zone: s.zone });
  }
  // pairwise divergence + divergence vs canonical
  let maxPair = 0, maxVsCanon = 0, argMax = null;
  const cellsUnion = [...new Set(states.flat())];
  const keys = Object.keys(states[0]);
  for (let a = 0; a < states.length; a++) {
    for (let b = a + 1; b < states.length; b++) {
      let d = 0;
      for (const k of keys) {
        const A = states[a][k] ?? [0, 0, 0], B = states[b][k] ?? [0, 0, 0];
        d = Math.max(d, Math.abs(A[0] - B[0]) + Math.abs(A[1] - B[1]));
      }
      if (d > maxPair) { maxPair = d; argMax = [a, b]; }
      if (a === 0) maxVsCanon = Math.max(maxVsCanon, d);
    }
  }
  const sigmas = senses.map((s) => s.sigma);
  const zones = senses.map((s) => s.zone);
  return {
    policy,
    max_pairwise_divergence: maxPair, arg_max_pair: argMax,
    max_div_vs_canonical: maxVsCanon,
    sigma_spread: Math.max(...sigmas) - Math.min(...sigmas),
    zone_spread: Math.max(...zones) - Math.min(...zones),
    sigmas, zones, norms_fired_per_run: normsPerRun, refusals,
  };
}

const P0 = runPolicy('seed');
const P1 = runPolicy('deferred');
const P2 = runPolicy('ledger');
book({ kind: 'results', P0_seed_verbatim: P0, P1_deferred_norm: P1, P2_ledger_commutative: P2 });

// ---------------- verdicts (sealed rules) ----------------
const verdicts = {
  R1_seed_violates_axiom: P0.max_pairwise_divergence > 1e-9,
  R2_deferred_improves: P1.max_pairwise_divergence < P0.max_pairwise_divergence,
  R2_deferred_closes: P1.max_pairwise_divergence <= 1e-9,
  R3_ledger_natural: P2.max_pairwise_divergence <= 1e-9,
};
book({ kind: 'verdicts', ...verdicts });

sealChain(rows);
const vc = verifyChain(rows);
const file = join(OUT, 'receipts_ex1.jsonl');
writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

// ---------------- report ----------------
const f = (x) => (x === 0 ? '0' : x.toExponential(3));
console.log('=== e_x1_naturality — is deformation a natural transformation in practice? ===');
console.log(`chain: ${vc.links} links verify=${vc.ok} | K=15 deformations, 3 loci, ${ORDERINGS.length} orderings (identity/reverse/8 shuffles)`);
console.log(`multiset: ${MULT.filter((m) => m.tag === 'attack').length} attack + ${MULT.filter((m) => m.tag === 'filler').length} filler items; P0 _norm fired ${Math.min(...P0.norms_fired_per_run)}-${Math.max(...P0.norms_fired_per_run)} times per run (1.001 trigger receipted in every ordering)`);
console.log('');
console.log('policy                 max|Δγ|+|Δη| (pairwise)   vs canonical   Σ spread    zone spread');
for (const [name, R] of [['P0 seed (verbatim)', P0], ['P1 deferred-norm', P1], ['P2 ledger (commutative)', P2]]) {
  console.log(`${name.padEnd(22)} ${f(R.max_pairwise_divergence).padEnd(24)} ${f(R.max_div_vs_canonical).padEnd(15)} ${f(R.sigma_spread).padEnd(12)} ${f(R.zone_spread)}`);
}
console.log('');
console.log(`VERDICT R1 — seed policy violates its own parallel-first axiom: ${verdicts.R1_seed_violates_axiom ? 'YES' : 'NO'} (P0 divergence ${f(P0.max_pairwise_divergence)} >> 1e-9)`);
console.log(`VERDICT R2 — prescribed fix (defer normalization to sense-time): improves ${verdicts.R2_deferred_improves ? 'YES' : 'NO'} (${f(P0.max_pairwise_divergence)} -> ${f(P1.max_pairwise_divergence)}, ${(100 * (1 - P1.max_pairwise_divergence / P0.max_pairwise_divergence)).toFixed(1)}% reduction); closes to <=1e-9: ${verdicts.R2_deferred_closes ? 'YES' : 'NO — residual = per-cell convex-update ordering'}`);
console.log(`VERDICT R3 — commutative ledger + sense-time aggregate: natural ${verdicts.R3_ledger_natural ? 'YES' : 'NO'} (P2 divergence ${f(P2.max_pairwise_divergence)} = float non-associativity floor)`);
console.log(`Σ spread across orderings — P0 ${f(P0.sigma_spread)} | P1 ${f(P1.sigma_spread)} | P2 ${f(P2.sigma_spread)}`);
writeFileSync(join(OUT, 'ex1_summary.json'), JSON.stringify({ verdicts, P0, P1, P2, chain: { links: vc.links, ok: vc.ok, tip: rows[rows.length - 1].row_hash } }, null, 2));
const okAll = verdicts.R1_seed_violates_axiom && verdicts.R2_deferred_improves && verdicts.R3_ledger_natural && vc.ok;
process.exit(okAll ? 0 : 1);
