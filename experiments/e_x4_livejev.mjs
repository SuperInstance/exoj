// experiments/e_x4_livejev.mjs — E-X4: THE LIVE GATE RUNS THE FIELD.
// ============================================================================
// The gap (fleet's better perspective): exoj's jev_emit/observe ran on FOUR
// OFFLINE SIMULATED backends (jev_backends.mjs, γ+η=1, Δ∈[0.4,0.6] by
// construction), while quilt-dba has the real thing: a live typesafe JEV
// gate with disk-cache replayability (E-D2: "live gate is REPLAYABLE — disk
// cache turns live decisions deterministic, bit-identical, zero new calls").
// This experiment wires exoj's jev_emit path to the LIVE gate under E-D2's
// discipline, on exoj's own content-addressing idiom.
//
// DESIGN (sealed rules below, house law — rules BEFORE runs):
//   Paired arms: the SAME field script runs on (a) the offline simulator
//   backend and (b) the live System One backend. The trajectories will NOT
//   be identical — different value distributions — and the HONEST claim is
//   structural: same chain integrity, same conservation-policy behavior,
//   refusal/ledger discipline preserved. That claim is what R1-R5 seal.
//
//   The emit contract is IDENTICAL for both arms (this is the load-bearing
//   choice): gamma = live noul | simulator draw; eta = 1 - gamma; delta =
//   band-mapped score | simulator draw. Because both arms conserve γ+η=1 per
//   write, the refuse boundary fires only on scripted violating payloads —
//   its behavior is backend-INVARIANT, which R4 seals as a structural
//   property, not a distributional one.
//
//   Session script (identical for every arm × policy):
//     attend → 4 seed cells → 4 gated emits → bridge + every-2 program +
//     tick(4) → 1 gated synthesis emit → 1 boundary-attacking write (Σ=1.4)
//     → EXACTLY ONE observation (highest displayed Δ, ties: γ desc, coord)
//     → digest + artifact.
//   Live sessions make 5 consults each; 2 policies × 5 = 10 = the WHOLE
//   budget; a post-cap probe exercises the exhaustion path.
//
import { ExoJ, Cell, normalizeView } from '../core.mjs';
import { sealChain, verifyChain, canonicalJSON, sha256Hex } from '../receipts.mjs';
import { makeBackend } from './jev_backends.mjs';
import { loadKey, LiveGate, buildState, buildQuestions, noLeakScan, textHasSecret } from './live_gate.mjs';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'outputs');
mkdirSync(OUT, { recursive: true });

const CAP_TOTAL = 10;            // HARD budget for the whole experiment (brief)
const GATED_PER_SESSION = 5;     // 4 exploration + 1 synthesis
const LOCI = [[0, 0], [1, -1], [-1, 1], [2, 0], [0, 1]];
const SEEDS = {
  align_cosine_E40: { q: 1, r: 2, g: 0.38, d: 0.42 },
  variance_ratio_E39: { q: -2, r: 1, g: 0.34, d: 0.44 },
  cascade_cotoxicity: { q: -1, r: -2, g: 0.30, d: 0.40 },
  provenance_coupled: { q: 0, r: 0, g: 0.10, d: 0.52 },
};
const ATTACK = { q: 0, r: 0, g: 0.9, e: 0.5, d: 0.5 }; // Σ_payload = 1.4 — boundary attack

const rows = [];
let rseq = 0;
const book = (row) => { row.seq = rseq++; rows.push(row); return row; };
const receiptsFile = join(OUT, 'receipts_ex4.jsonl');
const writeReceipts = () => { sealChain(rows); writeFileSync(receiptsFile, rows.map((r) => JSON.stringify(r)).join('\n') + '\n'); };

// ---------------- sealed rules (BEFORE any consult) ----------------
book({
  kind: 'run.config',
  task: 'e_x4_livejev — the LIVE typesafe gate runs the ExoJ field (E-D2 discipline on exoj idiom)',
  paired_arms: 'same field script on the offline simulator vs the live System One backend (jev-1.13.0); trajectories differ by construction (different value distributions) — the sealed claim is STRUCTURAL',
  emit_contract: 'gamma = noul | sim draw; eta = 1-gamma; delta = 0.4 + 0.2*clamp((score-1)/4,0,1) | sim draw — γ+η=1 and Δ∈[0.4,0.6] by construction on BOTH arms',
  session_script: 'attend → 4 seeds → 4 gated emits → bridge + every-2 program + tick(4) → 1 gated synthesis emit → 1 boundary attack (Σ=1.4) → 1 observation (max Δ, ties γ desc then coord) → digest+artifact',
  policies: ['ledger (naturality-fixed core, e_x1/e_x2 verdicts)', 'refuse (quilt-dba boundary mirror, e_x2 verdicts)'],
  live_sessions: '2 policies × 5 consults = 10 = the whole budget; post-cap probe exercises exhaustion',
  cache: 'experiments/outputs/x4_livejev_cache.json keyed by sha256 over canonical JSON of [ns, model, state, questions] — exoj\'s own content addressing',
});
book({
  kind: 'decision.rules',
  rules: {
    R1_budget: 'capTotal=10 HARD for the whole experiment, counted BEFORE use; every consult receipted with a source label (live|cache|negcache|budget_exhausted|fail_closed_*|replay_no_network) + budget snapshot; any failure fails CLOSED to the offline-simulator fallback (flagged fallback_used) — never a stall, never a silent pretend. PASS iff run-phase successful live calls <= 10 and the post-cap probe outcome is receipted',
    R2_replay: 'phase-2 replay from the DISK cache with mode=replay (cache-only BY CONSTRUCTION): 0 live calls, 0 network attempts; live-session field digests (sha256 over canonical JSON of chain+sense) byte-identical to phase 1; cached response summaries identical to phase-1 recorded summaries — live decisions are deterministic-on-record',
    R3_chain_from_disk: 'every session artifact reloads and verifyChain ok FROM DISK with the live decision rows embedded in the receipt chain (typed summaries + prompt hashes; no raw payloads, no key material)',
    R4_conservation_parity: 'under the SAME script, each policy invariant holds on BOTH backends: ledger → chain-replay divergence <= 1e-12 (naturality) offline AND live; refuse → final max cell Σ <= 1+1e-9 AND chain-replay divergence <= 1e-12 offline AND live; refusal disposition receipted per backend (expected: refusals fire only on violating payloads — the emit contract conserves γ+η=1, so the boundary is backend-invariant)',
    R5_no_key_leak: 'runtime scan of every file this experiment writes for the key value + token patterns (Bearer/TYPESAFE_KEY/MOTH_KEY assignments): CLEAN or offending PATHS (never the key)',
  },
});

// pre-run disk seal (idempotent; later rows extend the same prefix chain)
writeReceipts();
console.log(`rules sealed: ${rows.length} rows written to ${receiptsFile} (pre-run seal)`);

// ---------------- key (env-only) ----------------
const KEY = loadKey();
book({ kind: 'key.provision', present: !!KEY, source: process.env.TYPESAFE_KEY ? 'process.env.TYPESAFE_KEY' : (KEY ? '/home/z/my-project/.env (runtime parse)' : 'ABSENT — honest-null plumbing mode'), note: 'key held in client closure only; never echoed, logged, receipted or committed' });
if (!KEY) book({ kind: 'honest.null', what: 'TYPESAFE_KEY absent — all live consults will fail closed to the labeled offline fallback; the experiment still runs fully as a plumbing test', crown_note: 'an honest null is a crown jewel; a fabricated live row never is' });
const RUN_MODE = KEY ? 'live' : 'plumbing';

const ownedFiles = [join(OUT, 'x4_livejev_cache.json'), join(OUT, 'x4_livejev_journal.jsonl'), receiptsFile];
const scanPre = noLeakScan(ownedFiles.filter(existsSync), KEY);
book({ kind: 'nokeyleak.pre', ...scanPre });

// ---------------- shared field script ----------------
const sim = makeBackend(2454); // offline deterministic JEV (the paired arm's backend)
const round6 = (x) => Math.round(x * 1e6) / 1e6;

function fieldDigest(exo) {
  return sha256Hex(canonicalJSON({ chain: exo.chain, sense: exo.sense() }));
}

// replay executor: rebuild the field VIEW from the chain payloads alone.
// ledger policy -> commutative α-weighted accumulation (order-free aggregate);
// other policies -> naive convex soft writes. observe rows set the definite Δ.
function replayCells(exo) {
  const cells = new Map();
  const get = (q, r) => {
    const k = `${q},${r}`;
    if (!cells.has(k)) {
      const c = new Cell(q, r);
      c.gamma = 0; c.eta = 1; c.delta = 0.5; c.touched = 0; c.prob_mass = 1;
      cells.set(k, c);
    }
    return cells.get(k);
  };
  for (const row of exo.chain) {
    if (row.kind === 'deform') {
      const c = get(row.q, row.r);
      const a = row.alpha;
      if (exo.policy === 'ledger') {
        c.G += a * row['γ']; c.E += a * row['η']; c.D += a * row['Δ']; c.aSum += a; c.n += 1;
      } else {
        c.gamma = (1 - a) * c.gamma + a * row['γ'];
        c.eta = (1 - a) * c.eta + a * row['η'];
        c.delta = (1 - a) * c.delta + a * row['Δ'];
      }
      c.touched += 1;
    } else if (row.kind === 'observe') {
      const c = get(row.q, row.r);
      c.delta_override = row.definite_Δ;
      c.prob_mass = 0;
    }
    // attend / refuse / program_attach rows change no amplitude state
  }
  return [...cells.values()];
}

function viewDiff(cellsActual, cellsReplay) {
  const va = normalizeView(cellsActual), vr = normalizeView(cellsReplay);
  let d = 0, mass = 0;
  const keys = new Set([...va.keys(), ...vr.keys()]);
  for (const k of keys) {
    const A = va.get(k) ?? { 'γ': 0, 'η': 0 }, B = vr.get(k) ?? { 'γ': 0, 'η': 0 };
    const dd = Math.abs(A['γ'] - B['γ']) + Math.abs(A['η'] - B['η']);
    d = Math.max(d, dd);
    mass += dd;
  }
  return { max_divergence: d, mass };
}

async function runSession({ name, policy, backendKind, gate = null, artifactTag = null }) {
  const exo = new ExoJ(name, 4, policy);
  exo.attend('agent'); exo.attend('auditor');
  for (const [sname, c] of Object.entries(SEEDS)) {
    exo.jevEmit(c.q, c.r, c.g, 1 - c.g, c.d, { tag: `seed:${sname}`, backend: 'classical' });
  }

  const decisions = [];
  const gatedEmit = async (i, tag) => {
    const [q, r] = LOCI[i % LOCI.length];
    const cell = exo.cells.get(`${q},${r}`);
    const state = buildState({
      session: name, policy, emitIdx: i + 1, emitTotal: GATED_PER_SESSION,
      q, r, sense: exo.sense(), cellAmps: cell.amps(),
    });
    let values, usedFallback = false, decision = null;
    if (backendKind === 'live') {
      const fb = sim('classical', 100 + i); // deterministic offline fallback values
      const fallbackValues = { g: round6(fb.g), e: round6(fb.e), d: round6(fb.d) };
      const res = await gate.consult({ tag: `${tag}:emit${i}`, state, fallbackValues });
      values = res.ok ? res.emit.values : fallbackValues;
      usedFallback = !res.ok;
      decision = {
        tag: `${tag}:emit${i}`, prompt_hash: res.promptHash, source: res.source,
        cached: !!res.cached, attempts: res.attempts ?? 0,
        fallback_used: usedFallback,
        response_summary: res.ok ? (gate.rows[gate.rows.length - 1].response_summary ?? null) : null,
        values,
      };
    } else {
      const v = sim('classical', 100 + i);
      values = { g: round6(v.g), e: round6(v.e), d: round6(v.d) };
    }
    exo.jevEmit(q, r, values.g, values.e, values.d, {
      tag, backend: backendKind === 'live' ? 'systemone-live' : 'classical-sim',
    });
    if (decision) decisions.push(decision);
  };

  for (let i = 0; i < 4; i++) await gatedEmit(i, 'gated');

  // bridge + temporal program (scripted, offline values — not gated)
  exo.jevEmit(1, 0, 0.15, 0.85, 0.5, { tag: 'bridge', backend: 'cellular-llm' });
  exo.attachProgram(1, 0, { id: 'viability', kind: 'every', period: 2, start: 2 });
  const fired = exo.tick(4); // fires at 2, 4

  await gatedEmit(4, 'synthesis');

  // boundary attack (scripted payload Σ=1.4): refuse policy must refuse+chain it
  const attackRow = exo.jevEmit(ATTACK.q, ATTACK.r, ATTACK.g, ATTACK.e, ATTACK.d, { tag: 'attack', backend: 'classical' });

  // THE single observation: highest displayed Δ, ties γ desc then coord
  const candidates = [...exo.cells.values()].filter((c) => c.touched > 0)
    .map((c) => { const a = c.amps(); return { q: c.q, r: c.r, delta: a.delta, gamma: a.gamma }; })
    .sort((x, y) => y.delta - x.delta || y.gamma - x.gamma || `${x.q},${x.r}`.localeCompare(`${y.q},${y.r}`));
  const pick = candidates[0];
  const obs = exo.observe(pick.q, pick.r, Math.round(pick.delta * 1e4) / 1e4);

  const final = exo.sense();
  const replayDiff = viewDiff([...exo.cells.values()], replayCells(exo));

  const artifact = join(OUT, `x4_field_${artifactTag ?? name}.json`);
  exo.save(artifact);

  return {
    name, policy, backendKind, artifact,
    digest: fieldDigest(exo),
    sense: final,
    refusals: exo.stats.refusals,
    refused_mass: round6(exo.stats.refused_mass),
    attack_refused: attackRow.kind === 'refuse',
    chain_links: exo.chain.length,
    chain_tip: exo.chain_tip,
    replay_divergence: replayDiff.max_divergence,
    replay_mass: replayDiff.mass,
    observation: { picked: [pick.q, pick.r], definite_Δ: obs.definite_Δ, prev_prob: obs.prev_prob },
    program_fired_at: fired.map((f) => f.t),
    decisions,
  };
}

// ---------------- PHASE 1 — RUN ----------------
console.log(`\n=== PHASE 1 RUN (mode=${RUN_MODE}) ===`);
const gate1 = new LiveGate({
  key: KEY, cachePath: join(OUT, 'x4_livejev_cache.json'),
  journalPath: join(OUT, 'x4_livejev_journal.jsonl'),
  capTotal: CAP_TOTAL, mode: 'live',
});
const offlineLedger = await runSession({ name: 'offline-ledger', policy: 'ledger', backendKind: 'offline' });
const offlineRefuse = await runSession({ name: 'offline-refuse', policy: 'refuse', backendKind: 'offline' });
const liveLedger = await runSession({ name: 'live-ledger', policy: 'ledger', backendKind: 'live', gate: gate1 });
const liveRefuse = await runSession({ name: 'live-refuse', policy: 'refuse', backendKind: 'live', gate: gate1 });

// post-cap probe: exercises the budget exhaustion path (whatever the state is)
const probeRes = await gate1.consult({
  tag: 'post-cap-probe',
  state: 'ExoJ scratch-paper field session x4 post-cap probe: the experiment\'s gated emits are done; this consult exists to demonstrate the budget gate\'s hard-cap behavior.',
  fallbackValues: null,
});
book({ kind: 'budget.postcap_probe', outcome: probeRes.ok ? 'live (budget not yet exhausted at probe time — receipted honestly)' : `fail-closed: ${probeRes.source}`, why: probeRes.why ?? null, budget: gate1.stats() });

const sessionResults = { offlineLedger, offlineRefuse, liveLedger, liveRefuse };
book({
  kind: 'phase1.sessions',
  mode: RUN_MODE,
  offlineLedger: stripDecisions(offlineLedger), offlineRefuse: stripDecisions(offlineRefuse),
  liveLedger: stripDecisions(liveLedger), liveRefuse: stripDecisions(liveRefuse),
});
book({ kind: 'live.decisions', gate_stats: gate1.stats(), decisions: [...liveLedger.decisions, ...liveRefuse.decisions] });

function stripDecisions(s) {
  const { decisions, ...rest } = s;
  return rest;
}

// ---------------- PHASE 2 — REPLAY (disk cache, zero calls by construction) ----
console.log('\n=== PHASE 2 REPLAY (cache-only mode) ===');
const gate2 = new LiveGate({
  key: KEY, cachePath: join(OUT, 'x4_livejev_cache.json'),
  journalPath: join(OUT, 'x4_livejev_journal.jsonl'),
  capTotal: CAP_TOTAL, mode: 'replay',
});
const liveLedgerRe = await runSession({ name: 'live-ledger', policy: 'ledger', backendKind: 'live', gate: gate2, artifactTag: 'live-ledger-replay' });
const liveRefuseRe = await runSession({ name: 'live-refuse', policy: 'refuse', backendKind: 'live', gate: gate2, artifactTag: 'live-refuse-replay' });
const probeRe = await gate2.consult({ tag: 'post-cap-probe', state: 'ExoJ scratch-paper field session x4 post-cap probe: the experiment\'s gated emits are done; this consult exists to demonstrate the budget gate\'s hard-cap behavior.', fallbackValues: null });

const replayDigestOk = liveLedgerRe.digest === liveLedger.digest && liveRefuseRe.digest === liveRefuse.digest;
const summariesMatch =
  JSON.stringify(liveLedgerRe.decisions.map((d) => [d.tag, d.prompt_hash, d.response_summary, d.values])) ===
  JSON.stringify(liveLedger.decisions.map((d) => [d.tag, d.prompt_hash, d.response_summary, d.values])) &&
  JSON.stringify(liveRefuseRe.decisions.map((d) => [d.tag, d.prompt_hash, d.response_summary, d.values])) ===
  JSON.stringify(liveRefuse.decisions.map((d) => [d.tag, d.prompt_hash, d.response_summary, d.values]));
book({
  kind: 'phase2.replay',
  gate2_stats: gate2.stats(),
  live_calls_phase2: gate2.used, network_attempts_phase2: gate2.attemptCount,
  probe_phase2: probeRe.ok ? 'live' : probeRe.source,
  digest_liveLedger: { phase1: liveLedger.digest, phase2: liveLedgerRe.digest, equal: liveLedgerRe.digest === liveLedger.digest },
  digest_liveRefuse: { phase1: liveRefuse.digest, phase2: liveRefuseRe.digest, equal: liveRefuseRe.digest === liveRefuse.digest },
  decision_values_byte_identical: summariesMatch,
});

// ---------------- R3: artifacts verify from disk ----------------
const reload = {};
for (const s of [offlineLedger, offlineRefuse, liveLedger, liveRefuse]) {
  const exo2 = ExoJ.load(s.artifact);
  const v = exo2.verifyChain();
  reload[s.name] = { ok: v.ok, links: v.links, sense_active: exo2.sense().active };
}
book({ kind: 'artifacts.reload', reload });

// ---------------- R4: conservation parity table ----------------
const parity = {
  ledger_offline: { invariant: 'replay divergence <= 1e-12', value: offlineLedger.replay_divergence, ok: offlineLedger.replay_divergence <= 1e-12 },
  ledger_live: { invariant: 'replay divergence <= 1e-12', value: liveLedger.replay_divergence, ok: liveLedger.replay_divergence <= 1e-12 },
  refuse_offline: {
    invariant: 'max cell Σ <= 1+1e-9 AND replay divergence <= 1e-12',
    max_cell_Σ: offlineRefuse.sense.max_cell_Σ, replay: offlineRefuse.replay_divergence,
    refusals: offlineRefuse.refusals, attack_refused: offlineRefuse.attack_refused,
    ok: offlineRefuse.sense.max_cell_Σ <= 1 + 1e-9 && offlineRefuse.replay_divergence <= 1e-12,
  },
  refuse_live: {
    invariant: 'max cell Σ <= 1+1e-9 AND replay divergence <= 1e-12',
    max_cell_Σ: liveRefuse.sense.max_cell_Σ, replay: liveRefuse.replay_divergence,
    refusals: liveRefuse.refusals, attack_refused: liveRefuse.attack_refused,
    ok: liveRefuse.sense.max_cell_Σ <= 1 + 1e-9 && liveRefuse.replay_divergence <= 1e-12,
  },
};
book({
  kind: 'conservation.parity.R4', parity,
  honest_note: 'raw trajectories differ by construction (different value distributions); the sealed claim is the POLICY INVARIANTS holding identically across backends + the boundary being backend-invariant because both arms conserve γ+η=1 per write',
});
book({
  kind: 'pair.comparison',
  structural_table: {
    offline_ledger: { 'Σ': offlineLedger.sense['Σ'], 'Δ': offlineLedger.sense['Δ'], prob_open: offlineLedger.sense.prob_open, zone: offlineLedger.sense.zone, refusals: offlineLedger.refusals },
    live_ledger: { 'Σ': liveLedger.sense['Σ'], 'Δ': liveLedger.sense['Δ'], prob_open: liveLedger.sense.prob_open, zone: liveLedger.sense.zone, refusals: liveLedger.refusals },
    offline_refuse: { 'Σ': offlineRefuse.sense['Σ'], 'Δ': offlineRefuse.sense['Δ'], prob_open: offlineRefuse.sense.prob_open, zone: offlineRefuse.sense.zone, refusals: offlineRefuse.refusals },
    live_refuse: { 'Σ': liveRefuse.sense['Σ'], 'Δ': liveRefuse.sense['Δ'], prob_open: liveRefuse.sense.prob_open, zone: liveRefuse.sense.zone, refusals: liveRefuse.refusals },
  },
  observation_picks: {
    offlineLedger: offlineLedger.observation, liveLedger: liveLedger.observation,
    offlineRefuse: offlineRefuse.observation, liveRefuse: liveRefuse.observation,
  },
  trajectories_identical: liveLedger.digest === offlineLedger.digest,
  honest_claim: 'NOT identical (different Δ/γ distributions) — identical chain integrity + policy behavior is the sealed result',
});

// ---------------- verdicts ----------------
writeReceipts(); // seal the full chain BEFORE the verdict rows re-seal it again below
const allDecisionsLabeled = [...liveLedger.decisions, ...liveRefuse.decisions].every((d) => typeof d.source === 'string' && d.source.length > 0);
const R1 = gate1.used <= CAP_TOTAL && allDecisionsLabeled; // counted before use; every consult receipted with a source label
const R2 = gate2.used === 0 && gate2.attemptCount === 0 && replayDigestOk && summariesMatch;
const R3 = Object.values(reload).every((r) => r.ok) && verifyChain(rows).ok;
const R4 = parity.ledger_offline.ok && parity.ledger_live.ok && parity.refuse_offline.ok && parity.refuse_live.ok;
const scanPost = noLeakScan(ownedFiles.filter(existsSync), KEY);
const R5 = scanPre.clean && scanPost.clean;

book({ kind: 'nokeyleak.post', ...scanPost });
book({
  kind: 'verdicts',
  R1_budget_honored: R1,
  R2_replay_bit_identical_zero_calls: R2,
  R3_chains_verify_from_disk_with_live_rows: R3,
  R4_conservation_parity_across_backends: R4,
  R5_no_key_leak: R5,
  run_mode: RUN_MODE,
});

// ---------------- seal + report ----------------
writeReceipts();
const vc = verifyChain(rows);
writeFileSync(join(OUT, 'ex4_summary.json'), JSON.stringify({
  verdicts: { R1: R1, R2: R2, R3: R3, R4: R4, R5: R5 },
  run_mode: RUN_MODE,
  budget: gate1.stats(),
  parity, reload,
  digests: {
    offlineLedger: offlineLedger.digest, offlineRefuse: offlineRefuse.digest,
    liveLedger: liveLedger.digest, liveRefuse: liveRefuse.digest,
    replayEqual: replayDigestOk,
  },
  receipts: { links: vc.links, ok: vc.ok, tip: rows[rows.length - 1].row_hash },
}, null, 2));

const ok = (b) => (b ? 'PASS' : 'FAIL');
console.log('=== e_x4_livejev — the live gate runs the field ===');
console.log(`run mode: ${RUN_MODE} | receipt chain: ${vc.links} links verify=${vc.ok}`);
console.log(`budget: ${gate1.used}/${CAP_TOTAL} live calls (attempts ${gate1.attemptCount}), latency p50 ${gate1.stats().latency_ms.p50}ms p95 ${gate1.stats().latency_ms.p95}ms`);
for (const [n, s] of [['offline-ledger', offlineLedger], ['live-ledger   ', liveLedger], ['offline-refuse', offlineRefuse], ['live-refuse   ', liveRefuse]]) {
  console.log(`  ${n}: Σ=${s.sense['Σ'].toFixed(4)} Δ=${s.sense['Δ'].toFixed(4)} prob_open=${s.sense.prob_open.toFixed(4)} refusals=${s.refusals} replay_div=${s.replay_divergence.toExponential(2)} digest=${s.digest.slice(0, 12)} obs=(${s.observation.picked})Δ=${s.observation.definite_Δ}`);
}
console.log(`replay: live_calls=${gate2.used} attempts=${gate2.attemptCount} digests_equal=${replayDigestOk} decision_values_identical=${summariesMatch}`);
console.log(`probe: phase1=${probeRes.ok ? 'live' : probeRes.source} phase2=${probeRe.ok ? 'live' : probeRe.source}`);
for (const [r, v] of [['R1 budget honored', R1], ['R2 replay bit-identical, zero calls', R2], ['R3 chains verify from disk w/ live rows', R3], ['R4 conservation parity across backends', R4], ['R5 no key leak', R5]]) {
  console.log(`  ${ok(v)}  ${r}`);
}
const allPass = R1 && R2 && R3 && R4 && R5;
console.log(allPass ? '\nEX4 VERDICT: the live gate runs the field under the E-D2 discipline — live decisions are deterministic-on-record.' : '\nEX4 VERDICT: FAILURES above (honest failures are crown jewels — receipted, not hidden).');
process.exit(allPass && vc.ok ? 0 : 1);
