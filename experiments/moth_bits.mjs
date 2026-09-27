// experiments/moth_bits.mjs — real MOTH quantum randomness for the exoj lane
// (E-X5). Fleet idiom ported from quilt-dba/dba/mothqrc.mjs (E-D3's receipted
// live QRC lane, which itself ports quilt-murmur/murmur/moth.mjs): submit ->
// poll -> result, token auth header, hard caps, honest live/mock labels.
// Copy, not cross-import: repos agree on discipline, not on module paths.
//
// ABSOLUTE KEY DOCTRINE (receipted E-D3): the key lives ONLY in
// process.env.MOTH_KEY or /home/z/my-project/.env (parsed at RUNTIME). It is
// NEVER written to any file, log, receipt, cache or console output.
//
// ENGINE SCOPE: graph-v1 only — 8-qubit aer jobs whose result carries
// measurements [{bitstring, count, probability}...]; every DISTINCT observed
// 8-bit key is a real quantum sample expanded by its count (canonical sorted
// order — bit VALUES are real measurements, bit ORDER is canonical; receipted
// E-D3). Known API caveat (receipted E-D3): measurements are truncated to the
// top-20 outcomes, so captured shots < requested shots.
//
// BUDGET DOCTRINE (E-X5 brief): <= 4 live MOTH jobs, <= 8192 bits total
// (hard-truncated with a receipt), fail-closed: an unreachable API yields a
// DETERMINISTIC LABELED MOCK stream (live:false / mock:true everywhere — a
// mock never pretends to be quantum) and the experiment continues as a
// plumbing test.

import { readFileSync, existsSync } from 'node:fs';

const ENV_PATH = '/home/z/my-project/.env';
const API = 'https://api.mothquantum.com/api/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const MAX_JOBS = 4;      // hard cap (E-X5 brief)
export const MAX_BITS = 8192;   // hard cap (E-X5 brief)
export const MIN_BITS = 4096;   // harvest target

export function loadKey(envPath = ENV_PATH) {
  if (process.env.MOTH_KEY) return process.env.MOTH_KEY;
  try {
    if (existsSync(envPath)) {
      const m = readFileSync(envPath, 'utf8').match(/^MOTH_KEY\s*=\s*(\S+)\s*$/m);
      if (m) return m[1];
    }
  } catch { /* fallthrough: stay null, caller fails closed */ }
  return null;
}

// ── raw HTTP (fleet pattern; never logs headers/body) ───────────────────────
export async function call(method, path, key, body, timeoutMs = 30000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(API + path, {
      method,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }
    return { status: res.status, ms: Date.now() - t0, data };
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, data: { error: String((e && e.message) || e) } };
  } finally { clearTimeout(t); }
}

// ── job runner (submit -> poll -> result; polite 429 backoff, fleet pattern) ─
export async function runJob(key, engine, params, { timeoutMs = 120000, pollMs = 1500 } = {}) {
  const submittedAt = new Date().toISOString();
  let sub = await call('POST', `/engines/${engine}/process`, key, { params });
  if (sub.status === 429) {
    await sleep(15000);
    sub = await call('POST', `/engines/${engine}/process`, key, { params });
    if (sub.status === 429) { await sleep(30000); sub = await call('POST', `/engines/${engine}/process`, key, { params }); }
  }
  if (sub.status === 0) return { ok: false, stage: 'submit', why: 'unreachable: ' + (sub.data.error || ''), submittedAt };
  if (sub.status === 401 || sub.status === 403) return { ok: false, stage: 'submit', why: `auth ${sub.status}`, submittedAt };
  if (sub.status !== 200 && sub.status !== 202) return { ok: false, stage: 'submit', why: `HTTP ${sub.status}`, submittedAt };
  const jobId = sub.data && sub.data.job_id;
  if (!jobId) return { ok: false, stage: 'submit', why: 'no job_id', submittedAt };
  const t0 = Date.now();
  let st = null;
  while (Date.now() - t0 < timeoutMs) {
    await sleep(pollMs);
    const s = await call('GET', `/jobs/${jobId}/status`, key, null, 15000);
    st = s.data && s.data.status;
    if (st === 'completed' || st === 'failed' || st === 'cancelled') break;
  }
  if (st !== 'completed') return { ok: false, stage: 'poll', why: `job ${jobId} status=${st}`, jobId, submittedAt };
  const r = await call('GET', `/jobs/${jobId}/result`, key, null, 30000);
  return { ok: true, jobId, submittedAt, completedAt: new Date().toISOString(), latencyMs: Date.now() - t0, result: r.data || {} };
}

// ── result normalization (shape-tolerant, live shapes receipted E-D3) ───────
export function normalizeResult(result) {
  const r = result || {};
  const inner = r.result && typeof r.result === 'object' ? r.result : {};
  const out = r.output && typeof r.output === 'object' ? r.output : (inner.output && typeof inner.output === 'object' ? inner.output : null);
  const measurements = out && Array.isArray(out.measurements) ? out.measurements : null;
  const backend = (out && out.backend) || r.backend || inner.backend || null;
  return { measurements, backend, topLevelKeys: Object.keys(r).sort() };
}

// graph-v1: the measurements multiset IS the sample; canonical sorted expansion.
export function extractBits(norm) {
  const bits = [];
  let ones = 0;
  if (norm.measurements) {
    const entries = norm.measurements
      .map((m) => ({ bs: String(m.bitstring || '').replace(/[^01]/g, ''), n: Math.max(0, Number(m.count) || 0) }))
      .filter((m) => m.bs.length > 0)
      .sort((a, b) => (a.bs < b.bs ? -1 : a.bs > b.bs ? 1 : 0));
    for (const { bs, n } of entries) {
      for (let r = 0; r < n; r++) for (const c of bs) { bits.push(c === '1' ? 1 : 0); if (c === '1') ones++; }
    }
  }
  return { bits, ones, distinct: norm.measurements ? norm.measurements.length : 0 };
}

export function graphParams(shots) {
  return { mode: 'emu', num_qubits: 8, shots, coupling_map: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0]] };
}

// one graph-v1 job as a cache row (same schema as the receipted E-D3 cache —
// proven-compatible layout; no key material anywhere in a row)
export async function graphJob(key, { shots = 1024, seq = 0 } = {}) {
  const j = await runJob(key, 'graph-v1', graphParams(shots), { timeoutMs: 120000 });
  const norm = normalizeResult(j.result);
  let bits = [], ones = 0, distinct = 0;
  if (j.ok) { const ex = extractBits(norm); bits = ex.bits; ones = ex.ones; distinct = ex.distinct; }
  return {
    seq, kind: 'harvest', engine: 'graph-v1',
    job_id: j.ok ? j.jobId : null, backend: norm.backend,
    shots, mode: 'emu', live: !!j.ok, mock: false,
    submitted_at: j.submittedAt, completed_at: j.completedAt || null, latency_ms: j.latencyMs || null,
    ok: !!j.ok, why: j.ok ? null : (j.why || null),
    measurements: norm.measurements || null, distinct_outcomes: distinct,
    result_shape: j.ok ? norm.topLevelKeys : null,
    bits: bits.join(''), bits_len: bits.length, ones,
  };
}

// ── Wilson score interval (H/T vs 0.5 receipt) ──────────────────────────────
export function wilsonCI(ones, n, z = 1.959963985) {
  if (n === 0) return [0, 1];
  const p = ones / n;
  const d = 1 + z * z / n;
  const c = p + z * z / (2 * n);
  const s = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - s) / d, (c + s) / d];
}

// ── deterministic Fisher-Yates shuffle of a bit ARRAY (arm C: the honest
// structure-matched control — SAME multiset, quantumness of ORDER removed;
// the shuffle key is a fixed seed, NOT derived from the stream) ──────────────
export function shuffledBits(bits, seed) {
  const a = bits.slice();
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

// ── stream consumers: identical read(k) interface for ALL arms ──────────────
// Bit reader over a bit array (MSB-first assembly, cycles with counters).
export class BitReader {
  constructor(bits, label = 'bitreader') {
    this.bits = bits;
    this.pos = 0;
    this.consumed = 0;
    this.cycles = 0;
    this.label = label;
  }
  read(k) {
    let v = 0;
    const offsets = [];
    for (let i = 0; i < k; i++) {
      offsets.push(this.pos);
      v = v * 2 + Number(this.bits[this.pos]);
      this.pos++;
      if (this.pos >= this.bits.length) { this.pos = 0; this.cycles++; }
    }
    this.consumed += k;
    return { v, offsets };
  }
}

// PRNG arm: mulberry32 low-bit reader behind the SAME read(k) interface
// (same schedule, same consumption — the paired source swap).
export class PrngReader {
  constructor(seed, label = 'prng') {
    this.a = seed >>> 0;
    this.consumed = 0;
    this.seq = 0;
    this.label = label;
  }
  read(k) {
    let v = 0;
    const offsets = [];
    for (let i = 0; i < k; i++) {
      this.a = (this.a + 0x6D2B79F5) | 0;
      let t = Math.imul(this.a ^ (this.a >>> 15), 1 | this.a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      const b = ((t ^ (t >>> 14)) >>> 0) & 1;
      offsets.push(this.seq++);
      v = v * 2 + b;
    }
    this.consumed += k;
    return { v, offsets };
  }
}

// Replay reader: replays a RECORDED bit sequence from the bit journal
// (byte-exact offline replay; asserts the journal is consumed in order).
export class JournalReader {
  constructor(values, label = 'journal') {
    this.values = values;
    this.i = 0;
    this.consumed = 0;
    this.label = label;
  }
  read(k) {
    if (this.i + k > this.values.length) throw new Error(`journal exhausted: need ${k} bits at ${this.i}, have ${this.values.length - this.i}`);
    let v = 0;
    const offsets = [];
    for (let i = 0; i < k; i++) { v = v * 2 + Number(this.values[this.i + i]); offsets.push(this.i + i); }
    this.i += k;
    this.consumed += k;
    return { v, offsets };
  }
}

// ── R no-key-leak scanner (runtime; prints verdicts, never the key) ─────────
export function noLeakScan(paths, key) {
  const out = { filesScanned: 0, keyMatches: [], patternMatches: [], clean: false };
  const patterns = [
    ['bearer-assign', /Bearer\s+[A-Za-z0-9_\-.]{16,}/],
    ['moth-key-assign', /MOTH_KEY\s*=\s*['"]?[A-Za-z0-9_\-.]{16,}/],
  ];
  for (const p of paths) {
    let text = null;
    try { text = readFileSync(p, 'utf8'); } catch { continue; }
    out.filesScanned++;
    if (key && key.length >= 8 && text.includes(key)) out.keyMatches.push(p);
    for (const [name, re] of patterns) {
      const n = (text.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || []).length;
      if (n > 0) out.patternMatches.push({ path: p, pattern: name, count: n });
    }
  }
  out.clean = out.keyMatches.length === 0;
  return out;
}
