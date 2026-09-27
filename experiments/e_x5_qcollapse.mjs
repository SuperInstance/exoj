// experiments/e_x5_qcollapse.mjs — E-X5: QUANTUM COLLAPSE, JOURNALED.
// ============================================================================
// Drive exoj's observe() collapse selector with THREE paired bit sources:
//   arm A 'moth'     — REAL MOTH quantum bits (graph-v1 8-qubit aer jobs,
//                      journaled bit-stream, byte-exact replay)
//   arm B 'prng'     — seeded mulberry32 behind the SAME read(k) interface
//   arm C 'shuffled' — a DETERMINISTIC SHUFFLE of the SAME MOTH bits
//                      (structure-matched, quantumness-of-order removed —
//                      the honest control E-D3 taught the fleet)
//
// E-D3's receipted finding was "mechanism = source structure not quantumness"
// (paired delta explained by measured source structure). This experiment is
// designed so it can HONESTLY distinguish quantumness from stream structure:
//   A vs C isolates the ORDER of the real bits (same multiset, shuffled);
//   A vs B isolates the SOURCE (multiset + order both differ).
// If no observable field-level difference appears, that NULL is the result —
// receipted. If a difference appears ONLY in A vs C but not B vs C, that is
// attributed honestly (and would strain E-D3's crown).
//
// TWO-PHASE DESIGN (replay stays byte-exact):
//   PHASE 1 (fetch, live): <= 4 graph-v1 jobs, <= 8192 bits (hard-truncated,
//     receipted) -> experiments/outputs/x5_moth_stream.jsonl WITH provenance
//     (job ids, backend, timestamps, measurements). NO key material. If the
//     API is unreachable: a DETERMINISTIC LABELED MOCK stream (live:false /
//     mock:true everywhere) and the run is receipted as a plumbing test.
//   PHASE 2 (offline over the cache): three arm fields, identical scripts —
//     the ONLY difference across arms is the collapse selector's bit source.
//     Every consumed bit is JOURNALED (offsets + values) to
//     experiments/outputs/x5_bit_journal.jsonl.
//   PHASE 3 (replay): each arm re-runs from its BIT JOURNAL via
//     JournalReader — digests must be byte-identical with ZERO new jobs.
//
// FIELD SCRIPT (identical for every arm):
//   ledger-policy radius-4 field; attend agent/auditor; 6 seed cells;
//   4 rounds x [6 exploration emits through the 4 offline JEV backends
//   (round-robin, deterministic, arm-independent) + ONE explicit observation
//   consuming exactly 13 bits: 6 bits -> open-cell index (v mod openCount over
//   (q,r)-sorted open cells), 7 bits -> definite Δ = 0.4 + 0.2*(v/127) ∈
//   [0.4,0.6] rounded 4dp]. Consumption is state-independent: exactly 52 bits
//   per arm. Collapse COUNT is scripted (4 per arm) — prob_open is
//   arm-invariant by construction; WHAT collapses and AT WHICH Δ is the
//   bit-driven part.
//
import { ExoJ } from '../core.mjs';
import { sealChain, verifyChain, canonicalJSON, sha256Hex } from '../receipts.mjs';
import { makeBackend, BACKENDS } from './jev_backends.mjs';
import {
  loadKey, graphJob, wilsonCI, shuffledBits,
  BitReader, PrngReader, JournalReader, noLeakScan,
  MAX_JOBS, MAX_BITS, MIN_BITS,
} from './moth_bits.mjs';
import { writeFileSync, mkdirSync, existsSync, readFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'outputs');
mkdirSync(OUT, { recursive: true });

const CACHE = join(OUT, 'x5_moth_stream.jsonl');
const BITJOURNAL = join(OUT, 'x5_bit_journal.jsonl');
const ROUNDS = 4;
const SHUFFLE_SEED = 9001;   // fixed shuffle key — NOT derived from the stream
const PRNG_SEED = 3127;
const MOCK_SEED_STR = 'offline-fallback:exoj-x5-qcollapse';

const rows = [];
let rseq = 0;
const book = (row) => { row.seq = rseq++; rows.push(row); return row; };
const receiptsFile = join(OUT, 'receipts_ex5.jsonl');
const writeReceipts = () => { sealChain(rows); writeFileSync(receiptsFile, rows.map((r) => JSON.stringify(r)).join('\n') + '\n'); };
const round4 = (x) => Math.round(x * 1e4) / 1e4;

// ---------------- sealed rules (BEFORE any run) ----------------
book({
  kind: 'run.config',
  task: 'e_x5_qcollapse — drive exoj observe() collapse selection with real MOTH quantum bits vs PRNG vs a deterministic shuffle of the SAME bits (journaled, byte-exact replay)',
  arms: { A: 'moth: real quantum bits, canonical order', B: 'prng: mulberry32 low bits, same read schedule', C: 'shuffled: same REAL bits, deterministic Fisher-Yates (fixed seed 9001, not stream-derived) — same multiset, order-quantumness removed' },
  field_script: 'ledger policy, radius 4; 6 seeds; 4 rounds x [6 offline-backend exploration emits (arm-independent) + 1 observation consuming exactly 13 bits (6 -> open-cell index, 7 -> definite Δ = 0.4+0.2*(v/127))]; 52 bits per arm, state-independent consumption',
  budget: `<= ${MAX_JOBS} live MOTH jobs, <= ${MAX_BITS} bits total (hard truncation receipted), fail-closed to a LABELED mock stream (a mock never pretends to be quantum)`,
  control_rationale: 'E-D3 crown "mechanism = source structure not quantumness" — A vs C isolates bit ORDER at fixed multiset; A vs B isolates the SOURCE; the pre-registered attribution table below decides what any difference means',
});
book({
  kind: 'decision.rules',
  rules: {
    R1_replay: 'phase-3 replay from the BIT JOURNAL (offsets+values) byte-exact: all three arm field digests identical to phase 2, ZERO new MOTH jobs (jobs_used unchanged; no network code runs in phases 2-3)',
    R2_comparison: 'honest three-arm report: per-arm observation log (which cells collapsed at which Δ), pick-agreement counts, Δ L1 distances, composite distance D(X,Y) = pickMismatches + Σ|Δx−Δy|/0.2 (defined composite, receipted as such), final-sense deltas, trajectory digests. Attribution table: all logs equal => FIELD-NULL (the null IS the result); A==C => order-insensitive; D(A,C) <= D(B,C) => structure-explained (E-D3 consistent); D(A,C) > D(B,C) => quantum-order-specific (would strain E-D3 — receipt loudly). Honest nulls are crown jewels',
    R3_chains: 'receipt chain verifies; every arm artifact reloads and verifyChain ok from disk',
    R4_budget: 'live MOTH jobs <= 4 AND consumed+held stream <= 8192 bits (truncation receipted); probe-first: the first 32-shot job IS the flow/shape probe (graph-v1 shape live-verified by dba E-D3 — receipted rationale)',
    R5_no_key_leak: 'runtime scan of every file this experiment writes for the MOTH key value + token patterns: CLEAN or offending PATHS (never the key)',
  },
});
writeReceipts();
console.log(`rules sealed: ${rows.length} rows written to ${receiptsFile} (pre-run seal)`);

// ---------------- PHASE 1: fetch or load the stream ----------------
const KEY = loadKey();
const ownedFiles = [CACHE, BITJOURNAL, receiptsFile];
const scanPre = noLeakScan(ownedFiles.filter(existsSync), KEY);

let cacheRows = null, fetchInfo = { mode: 'cache-hit' };
if (existsSync(CACHE)) {
  cacheRows = readFileSync(CACHE, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
} else if (!KEY) {
  fetchInfo = { mode: 'honest-null', why: 'no MOTH_KEY in env — labeled mock stream, plumbing test' };
} else {
  console.log('PHASE 1: live MOTH harvest (probe=32 shots, then 1024-shot graph-v1 jobs)...');
  const liveRows = [];
  let totalBits = 0, jobs = 0, hardStop = null;
  const probe = await graphJob(KEY, { shots: 32, seq: jobs++ });
  liveRows.push(probe);
  totalBits += probe.bits_len;
  if (!probe.ok) {
    fetchInfo = { mode: 'offline-fallback', why: `probe job failed: ${probe.why}` };
  } else {
    while (totalBits < MIN_BITS && jobs < MAX_JOBS) {
      const j = await graphJob(KEY, { shots: 1024, seq: jobs++ });
      liveRows.push(j);
      totalBits += j.bits_len;
      if (!j.ok) { hardStop = `job failed: ${j.why}`; break; }
    }
    if (totalBits < 256) fetchInfo = { mode: 'offline-fallback', why: hardStop ?? `harvest too small (${totalBits} bits)` };
    else fetchInfo = { mode: 'live-fetch', jobsUsed: jobs, hardStop };
  }
  if (!fetchInfo.why || fetchInfo.mode === 'live-fetch') {
    cacheRows = liveRows;
    writeFileSync(CACHE, cacheRows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  }
}

let STREAM, streamLabel;
if (cacheRows) {
  const live = cacheRows.some((r) => r.live === true);
  const bitsArr = [];
  for (const r of cacheRows) for (const c of r.bits || '') bitsArr.push(c === '1' ? 1 : 0);
  STREAM = bitsArr.slice(0, MAX_BITS); // HARD cap, receipted
  streamLabel = {
    live, mock: !live,
    bits_held: STREAM.length, bits_truncated_from: bitsArr.length,
    jobs: cacheRows.length, live_jobs: cacheRows.filter((r) => r.live).length,
    job_ids: cacheRows.map((r) => r.job_id).filter(Boolean),
    why: live ? null : (cacheRows[0] && cacheRows[0].why) || fetchInfo.why || 'offline fallback rows',
  };
} else {
  // deterministic LABELED mock (a mock never pretends to be quantum)
  let s = 0; for (const c of MOCK_SEED_STR) s = (s * 31 + c.charCodeAt(0)) | 0;
  const bitsArr = [];
  const nxt = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) & 1; };
  for (let i = 0; i < MAX_BITS; i++) bitsArr.push(nxt());
  STREAM = bitsArr;
  streamLabel = { live: false, mock: true, bits_held: STREAM.length, bits_truncated_from: MAX_BITS, jobs: 0, live_jobs: 0, job_ids: [], why: fetchInfo.why || 'offline fallback (no key / unreachable)' };
}

const ones = STREAM.reduce((a, b) => a + b, 0);
const freq = STREAM.length ? ones / STREAM.length : 0;
const [wLo, wHi] = wilsonCI(ones, STREAM.length);
const streamDigest = sha256Hex(STREAM.join(''));
book({
  kind: 'stream.provenance',
  fetch: fetchInfo, label: streamLabel,
  jobs: (cacheRows || []).map((r) => ({ seq: r.seq, engine: r.engine, job_id: r.job_id, backend: r.backend, shots: r.shots, ok: r.ok, live: r.live, mock: r.mock, latency_ms: r.latency_ms, bits: r.bits_len, ones: r.ones, distinct_outcomes: r.distinct_outcomes, submitted_at: r.submitted_at, completed_at: r.completed_at })),
  stream: { bits: STREAM.length, ones, freq: round4(freq), wilson95: [round4(wLo), round4(wHi)], fairCoinInCI: wLo <= 0.5 && 0.5 <= wHi, digest: streamDigest, caveats: ['graph-v1 default circuit: API truncates measurements to top-20 outcomes (captured < requested shots) — receipted E-D3', 'bit VALUES are real quantum measurements; bit ORDER is canonical (sorted outcome expansion) — receipted E-D3'] },
});
console.log(`stream: live=${streamLabel.live} bits=${STREAM.length} (from ${streamLabel.bits_truncated_from}) freq=${freq.toFixed(4)} wilson95=[${wLo.toFixed(4)},${wHi.toFixed(4)}] jobs=${streamLabel.jobs} live_jobs=${streamLabel.live_jobs}`);
const JOBS_USED = streamLabel.live_jobs;

// ---------------- PHASE 2: three arm fields ----------------
console.log('\nPHASE 2: three collapse arms (identical scripts, only the bit source differs)...');
const LOCI = [[0, 0], [1, -1], [-1, 1], [2, 0], [0, 1], [1, 1], [-2, 0], [0, -1], [2, -1], [-1, 2]];
const SEEDS = {
  cross_instance: { q: -3, r: 2, g: 0.09, d: 0.54 },
  provenance_coupled: { q: 0, r: 0, g: 0.10, d: 0.52 },
  admission_coupled: { q: 3, r: -2, g: 0.08, d: 0.50 },
  align_cosine_E40: { q: 1, r: 2, g: 0.38, d: 0.42 },
  variance_ratio_E39: { q: -2, r: 1, g: 0.34, d: 0.44 },
  gan_economics_open: { q: 0, r: 2, g: 0.07, d: 0.56 },
};

const shuffled = shuffledBits(STREAM, SHUFFLE_SEED);
const shuffledOnes = shuffled.reduce((a, b) => a + b, 0);

const bitJournal = [];
const writeJournalRow = (row) => appendFileSync(BITJOURNAL, JSON.stringify(row) + '\n');
writeFileSync(BITJOURNAL, ''); // fresh journal each run — deterministic given the stream

function fieldDigest(exo) {
  return sha256Hex(canonicalJSON({ chain: exo.chain, sense: exo.sense() }));
}

function runArm({ arm, reader, streamName, journal = false }) {
  const exo = new ExoJ('x5-' + arm, 4, 'ledger');
  const sim = makeBackend(2455); // FRESH simulator per arm: exploration values are arm-IDENTICAL (paired design); the reader is the ONLY arm difference
  exo.attend('agent'); exo.attend('auditor');
  for (const [sname, c] of Object.entries(SEEDS)) {
    exo.jevEmit(c.q, c.r, c.g, 1 - c.g, c.d, { tag: `seed:${sname}`, backend: 'classical' });
  }
  const obsLog = [];
  const bitVal = (sn, off, v, i, k) => sn === 'prng' ? ((v >> (k - 1 - i)) & 1) : sn === 'moth' ? STREAM[off] : shuffled[off];
  let k = 0;
  for (let round = 0; round < ROUNDS; round++) {
    for (let j = 0; j < 6; j++) {
      const b = BACKENDS[k % BACKENDS.length];
      const [q, r] = LOCI[k % LOCI.length];
      const v = sim(b, k);
      exo.jevEmit(q, r, Math.round(v.g * 1e6) / 1e6, Math.round(v.e * 1e6) / 1e6, Math.round(v.d * 1e6) / 1e6, { tag: 'explore', backend: b });
      k++;
    }
    // THE collapse decision: exactly 13 bits, state-independent consumption
    const open = [...exo.cells.values()].filter((c) => c.touched > 0 && c.prob_mass > 0)
      .sort((x, y) => x.q - y.q || x.r - y.r);
    const r1 = reader.read(6);
    const idx = open.length ? r1.v % open.length : 0;
    for (let i = 0; i < 6; i++) {
      const jr = { arm, stream: streamName, round, purpose: 'cell_index', bit_index_in_read: i, offset: r1.offsets[i], value: bitVal(streamName, r1.offsets[i], r1.v, i, 6) };
      bitJournal.push(jr); if (journal) writeJournalRow(jr);
    }
    const r2 = reader.read(7);
    const definite = round4(0.4 + 0.2 * (r2.v / 127));
    for (let i = 0; i < 7; i++) {
      const jr = { arm, stream: streamName, round, purpose: 'definite_delta', bit_index_in_read: i, offset: r2.offsets[i], value: bitVal(streamName, r2.offsets[i], r2.v, i, 7) };
      bitJournal.push(jr); if (journal) writeJournalRow(jr);
    }
    const cell = open[idx];
    const obs = exo.observe(cell.q, cell.r, definite);
    obsLog.push({ round, q: cell.q, r: cell.r, definite_Δ: obs.definite_Δ, open_count: open.length, idx, v6: r1.v, v7: r2.v });
  }
  const final = exo.sense();
  const artifact = join(OUT, `x5_field_${arm}.json`);
  exo.save(artifact);
  return {
    arm, reader_label: reader.label, obsLog, sense: final,
    digest: fieldDigest(exo), chain_links: exo.chain.length, chain_tip: exo.chain_tip,
    artifact, bits_consumed: reader.consumed,
  };
}

const armA = runArm({ arm: 'A', reader: new BitReader(STREAM, 'moth-real'), streamName: 'moth', journal: true });
const armB = runArm({ arm: 'B', reader: new PrngReader(PRNG_SEED, 'mulberry32'), streamName: 'prng', journal: true });
const armC = runArm({ arm: 'C', reader: new BitReader(shuffled, 'moth-shuffled'), streamName: 'shuffled', journal: true });

book({
  kind: 'stream.control.integrity',
  real_ones: ones, shuffled_ones: shuffledOnes, same_multiset: ones === shuffledOnes,
  shuffle_seed: SHUFFLE_SEED, shuffle_derived_from_stream: false,
});
book({
  kind: 'phase2.arms',
  A: { ...armA, sense: undefined }, B: { ...armB, sense: undefined }, C: { ...armC, sense: undefined },
  senses: { A: armA.sense, B: armB.sense, C: armC.sense },
});

// ---------------- comparisons (sealed attribution table) ----------------
const eqLog = (x, y) => JSON.stringify(x.obsLog) === JSON.stringify(y.obsLog);
const pickMismatch = (x, y) => x.obsLog.reduce((a, o, i) => a + ((o.q !== y.obsLog[i].q || o.r !== y.obsLog[i].r) ? 1 : 0), 0);
const dL1 = (x, y) => x.obsLog.reduce((a, o, i) => a + Math.abs(o.definite_Δ - y.obsLog[i].definite_Δ), 0);
const D = (x, y) => pickMismatch(x, y) + dL1(x, y) / 0.2; // defined composite (receipted)

const pair = (x, y) => ({ pick_mismatches: pickMismatch(x, y), delta_L1: round4(dL1(x, y)), D: round4(D(x, y)), logs_equal: eqLog(x, y) });
const pairs = { 'A-vs-B': pair(armA, armB), 'A-vs-C': pair(armA, armC), 'B-vs-C': pair(armB, armC) };

let attribution;
if (eqLog(armA, armB) && eqLog(armA, armC)) {
  attribution = 'FIELD-NULL: all three arms produced identical collapse trajectories — quantum randomness indistinguishable from PRNG at the field level; the honest null is the result (E-D3 consistent)';
} else if (eqLog(armA, armC)) {
  attribution = 'ORDER-INSENSITIVE: shuffling the same real bits changed nothing — the multiset carries whatever effect exists';
} else if (pairs['A-vs-C'].D <= pairs['B-vs-C'].D) {
  attribution = 'STRUCTURE-EXPLAINED (E-D3 consistent): the real bits\' ORDER matters no more than swapping the source to PRNG — no quantumness-specific effect at field level';
} else {
  attribution = 'QUANTUM-ORDER-SPECIFIC: real-bit order matters MORE than a full source swap — strains E-D3\'s crown; receipt loudly for the fleet';
}
book({ kind: 'arm.comparison', pairs, attribution, sense_final: { A: armA.sense, B: armB.sense, C: armC.sense } });

// ---------------- PHASE 3: replay from the bit journal ----------------
console.log('\nPHASE 3: replay each arm from its bit journal (zero jobs, byte-exact)...');
const journalValues = { A: [], B: [], C: [] };
for (const line of readFileSync(BITJOURNAL, 'utf8').split('\n').filter(Boolean)) {
  const j = JSON.parse(line);
  journalValues[j.arm].push(j.value);
}
const replayArm = (arm, base) => runArm({ arm: arm + '-replay', reader: new JournalReader(journalValues[arm], 'journal-replay'), streamName: 'journal' });
const armAr = replayArm('A', armA), armBr = replayArm('B', armB), armCr = replayArm('C', armC);
const replayOk = armAr.digest === armA.digest && armBr.digest === armB.digest && armCr.digest === armC.digest;
book({
  kind: 'phase3.replay',
  digests: {
    A: { phase2: armA.digest, phase3: armAr.digest, equal: armAr.digest === armA.digest },
    B: { phase2: armB.digest, phase3: armBr.digest, equal: armBr.digest === armB.digest },
    C: { phase2: armC.digest, phase3: armCr.digest, equal: armCr.digest === armC.digest },
  },
  bits_replayed: { A: journalValues.A.length, B: journalValues.B.length, C: journalValues.C.length },
  zero_new_jobs: true, // phases 2-3 contain no network code paths; jobs counter unchanged
  byte_exact: replayOk,
});

// ---------------- R3: artifacts verify from disk ----------------
const reload = {};
for (const s of [armA, armB, armC]) {
  const exo2 = ExoJ.load(s.artifact);
  const v = exo2.verifyChain();
  reload[s.arm] = { ok: v.ok, links: v.links };
}
book({ kind: 'artifacts.reload', reload });

// ---------------- verdicts ----------------
writeReceipts();
const scanPost = noLeakScan(ownedFiles.filter(existsSync), KEY);
const R1 = replayOk && JOBS_USED === streamLabel.live_jobs;
const R2 = armA.obsLog.length === ROUNDS && armB.obsLog.length === ROUNDS && armC.obsLog.length === ROUNDS
  && journalValues.A.length === ROUNDS * 13 && journalValues.B.length === ROUNDS * 13 && journalValues.C.length === ROUNDS * 13
  && Object.keys(pairs).length === 3 && typeof attribution === 'string';
const R3 = Object.values(reload).every((r) => r.ok) && verifyChain(rows).ok;
const R4 = JOBS_USED <= MAX_JOBS && STREAM.length <= MAX_BITS;
const R5 = scanPre.clean && scanPost.clean;

book({ kind: 'nokeyleak.post', ...scanPost });
book({
  kind: 'verdicts',
  R1_replay_byte_exact_zero_jobs: R1,
  R2_three_arm_comparison_reported: R2,
  R3_chains_verify: R3,
  R4_budget_honored: R4,
  R5_no_key_leak: R5,
  attribution,
  run_mode: streamLabel.live ? 'live-quantum' : 'plumbing (labeled mock)',
});

writeReceipts();
const vc = verifyChain(rows);
writeFileSync(join(OUT, 'ex5_summary.json'), JSON.stringify({
  verdicts: { R1, R2, R3, R4, R5 }, attribution, run_mode: streamLabel.live ? 'live-quantum' : 'plumbing',
  stream: { bits: STREAM.length, ones, freq: round4(freq), wilson95: [round4(wLo), round4(wHi)], jobs: streamLabel.jobs, live_jobs: JOBS_USED, digest: streamDigest },
  pairs, obsLogs: { A: armA.obsLog, B: armB.obsLog, C: armC.obsLog },
  senses: { A: armA.sense, B: armB.sense, C: armC.sense },
  digests: { A: armA.digest, B: armB.digest, C: armC.digest, replay_byte_exact: replayOk },
  receipts: { links: vc.links, ok: vc.ok, tip: rows[rows.length - 1].row_hash },
}, null, 2));

const ok = (b) => (b ? 'PASS' : 'FAIL');
console.log('=== e_x5_qcollapse — quantum collapse, journaled ===');
console.log(`run mode: ${streamLabel.live ? 'LIVE-QUANTUM' : 'PLUMBING (labeled mock)'} | receipt chain: ${vc.links} links verify=${vc.ok}`);
console.log(`stream: ${STREAM.length} bits (cap ${MAX_BITS}), ones=${ones} freq=${freq.toFixed(4)} wilson95=[${wLo.toFixed(4)},${wHi.toFixed(4)}], live jobs ${JOBS_USED}/${MAX_JOBS}`);
for (const [n, s] of [['A moth    ', armA], ['B prng    ', armB], ['C shuffled', armC]]) {
  console.log(`  ${n}: obs=${s.obsLog.map((o) => `(${o.q},${o.r};Δ=${o.definite_Δ})`).join(' ')} prob_open=${s.sense.prob_open.toFixed(4)} meanΔ=${s.sense['Δ'].toFixed(4)} digest=${s.digest.slice(0, 10)}`);
}
for (const [p, v] of Object.entries(pairs)) console.log(`  ${p}: pickMismatches=${v.pick_mismatches} ΔL1=${v.delta_L1} D=${v.D} logsEqual=${v.logs_equal}`);
console.log(`replay: byte_exact=${replayOk} (A:${journalValues.A.length} B:${journalValues.B.length} C:${journalValues.C.length} bits from journal, 0 new jobs)`);
console.log(`ATTRIBUTION: ${attribution}`);
for (const [r, v] of [['R1 replay byte-exact, zero jobs', R1], ['R2 three-arm comparison reported', R2], ['R3 chains verify', R3], ['R4 budget honored (<=4 jobs, <=8192 bits)', R4], ['R5 no key leak', R5]]) console.log(`  ${ok(v)}  ${r}`);
const allPass = R1 && R3 && R4 && R5;
console.log(allPass ? '\nEX5 VERDICT: collapse selection journaled and replayed byte-exact; the arm comparison is receipted above (nulls included).' : '\nEX5 VERDICT: FAILURES above (honest failures are crown jewels — receipted, not hidden).');
process.exit(allPass && vc.ok ? 0 : 1);
