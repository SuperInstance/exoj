// experiments/live_gate.mjs — the LIVE typesafe "System One" gate wired to
// the ExoJ field (E-X4). Fleet idiom ported from quilt-dba/dba/jev_live.mjs
// (E-D2's receipted live gate) onto exoj's own content-addressing idiom:
// sha256 over canonical JSON (the SAME hashing the field's chain uses), so
// one idiom covers cells, events, receipt rows AND live decision cache keys.
// Copy, not cross-import: repos agree on discipline, not on module paths.
//
// WIRE PROTOCOL (live-verified by dba E-D2, jev-1.13.0; base .ai not .dev —
// the .dev host is NXDOMAIN, receipted there):
//   POST {base}/v1/systemone   Authorization: Bearer <key>
//   body: { model, state, questions: { name: { type, instructions, criteria? } } }
//     type: 'noul' (continuous p) | 'choice' (criteria dict -> distribution)
//           | 'score' (criteria plain LIST -> level-scale score + legend)
//   response: { model, answers: { name: { type, noul?|choice?|score?,
//     confidence?, ... } }, usage: { input, output } tokens }
//   ONE call answers N typed questions in one pass.
//
// SECURITY DOCTRINE (Task 22, absolute): the key lives ONLY in the
// environment (process.env.TYPESAFE_KEY, else parsed at runtime from
// /home/z/my-project/.env), held in the client closure, NEVER written to any
// file, log, receipt, cache, commit message or console output. Cache rows
// carry answers + failure markers only; journal rows carry the prompt HASH,
// never the prompt text or the key.
//
// BUDGET DOCTRINE (E-X4 brief): ONE hard cap for the whole experiment
// (capTotal), counted BEFORE use, fail-closed when exhausted. One retry with
// exponential backoff on 429/5xx/network/timeout, then FAIL CLOSED to the
// caller's offline-simulator fallback with the row flagged fallback_used.
// Every row carries a source label: live | cache | negcache | budget_exhausted
// | fail_closed_* | replay_no_network. Positive AND negative decisions are
// disk-cached keyed by canonical request hash, so a replay run is a
// zero-call, bit-identical replay (E-D2's crown: live decisions are
// deterministic-on-record).

import { sha256Hex, canonicalJSON } from '../receipts.mjs';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const ENV_PATH = '/home/z/my-project/.env';

// runtime-only key loading (process.env first, then the .env file). The value
// never leaves this module except into the Authorization header.
export function loadKey(envPath = ENV_PATH) {
  if (process.env.TYPESAFE_KEY) return process.env.TYPESAFE_KEY;
  try {
    const txt = readFileSync(envPath, 'utf8');
    const m = txt.match(/^\s*TYPESAFE_KEY\s*=\s*(\S+)\s*$/m);
    if (m) return m[1];
  } catch { /* no env file: stay null, callers fail closed */ }
  return null;
}

export const BASE = 'https://api.typesafe.ai';
export const MODEL = 'jev-1.13.0';

// ── the receipted question batch (phrased BEFORE any run) ───────────────────
// Three typed questions, ONE call — mirrors the E-D2 contract. The question
// SHAPE is state-INDEPENDENT (stable prompt structure across decision points
// => cache-comparable); the STATE string carries the situation. Receipted
// E-D2 pattern, reused verbatim here.
export const CREATIVE_LEVELS = [
  'flat routine refresh',
  'mild variation',
  'notable novelty',
  'strong divergence',
  'maximal creative divergence',
];

export function buildQuestions() {
  return {
    crystallise: {
      type: 'noul',
      instructions: 'Return p = the crystalline mass gamma (a number in [0,1]) this soft deformation should carry. The possibility mass eta is 1-p.',
    },
    creative_level: {
      type: 'score',
      instructions: 'Rate the creative intensity (delta) this soft deformation should carry.',
      criteria: CREATIVE_LEVELS.slice(), // plain level LIST (Task 22 contract)
    },
    mode_choice: {
      type: 'choice',
      instructions: 'Which deformation mode best fits the current field state?',
      criteria: {
        deepen: 'concentrate mass at the target cell',
        spread: 'bridge toward neighbouring cells',
        refresh: 'gentle refresh of the current pattern',
      },
    },
  };
}

// The situation string. Every number is rounded to 6dp so the prompt is
// engine-stable; the field's own sense values describe the state.
export function buildState({ session, policy, emitIdx, emitTotal, q, r, sense, cellAmps }) {
  const r6 = (x) => Math.round(x * 1e6) / 1e6;
  return 'ExoJ scratch-paper field session ' + session + ' (conservation policy ' + policy + ')' +
    '. Gated soft deformation ' + emitIdx + ' of ' + emitTotal + ' at hex cell (q=' + q + ', r=' + r + ')' +
    '. Field sense: mean gamma ' + r6(sense['γ']) + ', eta ' + r6(sense['η']) + ', delta ' + r6(sense['Δ']) +
    ', open probability ' + r6(sense.prob_open) + ', active cells ' + sense.active +
    ', max cell sigma ' + r6(sense.max_cell_Σ) +
    '. Target cell displays gamma ' + r6(cellAmps.gamma) + ', eta ' + r6(cellAmps.eta) + ', delta ' + r6(cellAmps.delta) +
    '. Answer for THIS soft write only; the field never receives a definite token from a deformation.';
}

// verdict mapping — the sealed emit contract:
//   gamma = noul('crystallise') in [0,1] (clamped)
//   delta = 0.4 + 0.2 * clamp((score('creative_level') - 1) / 4, 0, 1)
//           (5-level scale -> the creative band [0.4, 0.6], by construction)
//   eta   = 1 - gamma  (gamma+eta = 1 by construction, same contract as the
//           four offline simulators)
// mode_choice is TELEMETRY ONLY (gates nothing) — mirrors E-D2.
export function answersToEmit(answers) {
  const a = answers && answers.crystallise;
  const s = answers && answers.creative_level;
  const g = a && typeof a.noul === 'number' && Number.isFinite(a.noul) ? Math.min(1, Math.max(0, a.noul)) : null;
  const sc = s && typeof s.score === 'number' && Number.isFinite(s.score) ? s.score : null;
  if (g === null) return { ok: false, why: 'answers.crystallise.noul missing/non-numeric on HTTP 200' };
  const d = sc === null ? null : Math.round((0.4 + 0.2 * Math.min(1, Math.max(0, (sc - 1) / 4))) * 1e4) / 1e4;
  const mc = answers && answers.mode_choice;
  return {
    ok: d !== null,
    why: d === null ? 'answers.creative_level.score missing/non-numeric on HTTP 200' : null,
    values: { g: Math.round(g * 1e6) / 1e6, e: Math.round((1 - g) * 1e6) / 1e6, d },
    telemetry: { mode: mc ? mc.choice ?? null : null, mode_conf: mc ? mc.confidence ?? null : null },
  };
}

// typed-answer summary only — never raw payloads (E-D2 doctrine)
export function summarise(answers, model) {
  const m = answersToEmit(answers);
  const mc = answers && answers.mode_choice;
  return {
    model: model ?? null,
    gamma_noul: m.values ? m.values.g : null,
    delta_band: m.values ? m.values.d : null,
    mode: mc ? mc.choice ?? null : null,
    mode_conf: mc ? mc.confidence ?? null : null,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class LiveGate {
  constructor({
    key = null, base = BASE, model = MODEL,
    cachePath = null, journalPath = null, timeoutMs = 30000,
    capTotal = 10,           // THE hard budget for the whole experiment
    mode = 'live',           // 'live' | 'replay' (replay: cache-only, ZERO network)
    ns = 'EXOJ-X4',
  } = {}) {
    this.key = key;
    this.base = base.replace(/\/$/, '');
    this.model = model;
    this.cachePath = cachePath;
    this.journalPath = journalPath;
    this.timeoutMs = timeoutMs;
    this.capTotal = capTotal;
    this.mode = mode;
    this.ns = ns;
    this.used = 0;        // successful live answers consumed from the budget
    this.attemptCount = 0;
    this.latencies = [];
    this.rows = [];       // in-memory mirror of the journal
    this.cache = {};
    if (cachePath && existsSync(cachePath)) {
      try { this.cache = JSON.parse(readFileSync(cachePath, 'utf8')); } catch { this.cache = {}; }
    }
    if (journalPath) mkdirSync(dirname(journalPath), { recursive: true });
  }

  // canonical request hash — exoj's own content addressing over the request
  hashOf(state, questions) {
    return sha256Hex(canonicalJSON([this.ns, this.model, state, questions]));
  }

  budgetLeft() { return Math.max(0, this.capTotal - this.used); }

  #journal(row) {
    const r = { ts: new Date().toISOString(), ...row };
    this.rows.push(r);
    if (this.journalPath) appendFileSync(this.journalPath, JSON.stringify(r) + '\n');
    return r;
  }

  #writeCache() {
    if (!this.cachePath) return;
    // cache holds answers + failure markers only: no key, no prompt text
    mkdirSync(dirname(this.cachePath), { recursive: true });
    writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 1));
  }

  stats() {
    const ls = this.latencies.slice().sort((a, b) => a - b);
    const pick = (q) => (ls.length ? ls[Math.min(ls.length - 1, Math.ceil(q * ls.length) - 1)] : null);
    const mean = ls.length ? Math.round(ls.reduce((a, b) => a + b, 0) / ls.length) : null;
    return {
      live_answers: this.used, cap_total: this.capTotal, budget_left: this.budgetLeft(),
      attempts: this.attemptCount, mode: this.mode,
      latency_ms: { n: ls.length, mean, p50: pick(0.5), p95: pick(0.95), max: ls.length ? ls[ls.length - 1] : null },
      cache_entries: Object.keys(this.cache).length,
      journal_rows: this.rows.length,
    };
  }

  // THE one-pass batched decision. Returns
  //   { ok:true,  source:'live'|'cache', answers, emit, usage, cached, promptHash }
  //   { ok:false, source:'negcache'|'budget_exhausted'|'replay_no_network'|'fail_closed_*',
  //     emit:{ok:false}, fallback_used:true, why, promptHash }
  async consult({ tag = null, state, questions = buildQuestions(), fallbackValues = null }) {
    const promptHash = this.hashOf(state, questions);
    const qn = Object.keys(questions).length;

    // 1. positive cache: a previously ANSWERED identical call (zero-cost replay)
    const hit = this.cache[promptHash];
    if (hit && !hit.__failed) {
      this.#journal({ kind: 'consult', tag, prompt_hash: promptHash, n_questions: qn, source: 'cache', cached: true, attempts: 0, latency_ms: 0, fallback_used: false, response_summary: summarise(hit.answers, hit.model), budget: this.#budgetSnap() });
      return { ok: true, source: 'cache', cached: true, attempts: 0, answers: hit.answers, usage: hit.usage || null, emit: answersToEmit(hit.answers), promptHash };
    }
    // 2. negative cache: a previously FAILED identical call replays fail-closed
    //    (deterministic replay: the trajectory must not depend on network luck)
    if (hit && hit.__failed) {
      this.#journal({ kind: 'consult', tag, prompt_hash: promptHash, n_questions: qn, source: hit.why, cached: true, negcache: true, attempts: 0, latency_ms: 0, fallback_used: true, fallback_values: hit.fallback_values, budget: this.#budgetSnap() });
      return { ok: false, source: hit.why, cached: true, negcache: true, attempts: 0, why: hit.why, emit: { ok: false }, fallback_used: true, promptHash };
    }

    // 3. budget cap — counted BEFORE use, fail-closed (negative-cached so a
    //    replay reproduces the refusal deterministically)
    if (this.used >= this.capTotal) {
      this.cache[promptHash] = { __failed: true, why: 'budget_exhausted', fallback_values: fallbackValues ?? null, at: new Date().toISOString() };
      this.#writeCache();
      this.#journal({ kind: 'consult', tag, prompt_hash: promptHash, n_questions: qn, source: 'budget_exhausted', fallback_used: true, fallback_values: fallbackValues ?? null, why: 'cap_total', budget: this.#budgetSnap() });
      return { ok: false, source: 'budget_exhausted', why: 'cap_total', attempts: 0, emit: { ok: false }, fallback_used: true, promptHash };
    }

    // 4. replay mode: cache-only by construction — a cache miss NEVER hits the
    //    network (this is what makes a replay run provably zero-call)
    if (this.mode === 'replay') {
      this.#journal({ kind: 'consult', tag, prompt_hash: promptHash, n_questions: qn, source: 'replay_no_network', fallback_used: true, fallback_values: fallbackValues ?? null, why: 'replay mode: cache-only, no live calls permitted', budget: this.#budgetSnap() });
      return { ok: false, source: 'replay_no_network', why: 'replay_no_network', attempts: 0, emit: { ok: false }, fallback_used: true, promptHash };
    }

    // 5. attempts: one retry with exponential backoff on 429/5xx/network/timeout
    const payload = { model: this.model, state, questions };
    let msTotal = 0, attempts = 0, last = null;
    if (!this.key) {
      last = { ok: false, status: 0, json: null, ms: 0, error_class: 'no_key' };
    } else {
      for (let attempt = 1; attempt <= 2; attempt++) {
        attempts = attempt;
        this.attemptCount++;
        const r = await this.#transport(payload);
        msTotal += r.ms;
        last = r;
        if (r.ok && r.json) break;
        this.#journal({ kind: 'attempt_failed', tag, prompt_hash: promptHash, attempt, http_status: r.status ?? null, error_class: r.error_class ?? 'unknown', latency_ms: r.ms, fallback_used: false });
        const retryable = r.error_class === 'http_429' || r.error_class === 'http_5xx' || r.error_class === 'network' || r.error_class === 'timeout';
        if (attempt === 1 && retryable) { await sleep(400 * Math.pow(2, attempt - 1)); continue; }
        break;
      }
    }

    // 6. outcome
    if (last && last.ok && last.json && last.json.answers) {
      const answers = last.json.answers;
      const emit = answersToEmit(answers);
      if (!emit.ok) {
        // contract violation on a 200: fail closed (receipted E-D2 pattern)
        this.cache[promptHash] = { __failed: true, why: 'fail_closed_contract', fallback_values: fallbackValues ?? null, at: new Date().toISOString() };
        this.#writeCache();
        this.#journal({ kind: 'consult', tag, prompt_hash: promptHash, attempts, source: 'fail_closed_contract', latency_ms: msTotal, fallback_used: true, fallback_values: fallbackValues ?? null, why: emit.why, budget: this.#budgetSnap() });
        return { ok: false, source: 'fail_closed_contract', why: 'contract', attempts, emit: { ok: false }, fallback_used: true, promptHash };
      }
      this.used++;
      this.latencies.push(msTotal);
      const usage = last.json.usage || null;
      this.cache[promptHash] = { answers, model: last.json.model || this.model, usage, at: new Date().toISOString() };
      this.#writeCache();
      this.#journal({ kind: 'consult', tag, prompt_hash: promptHash, attempts, source: 'live', latency_ms: msTotal, fallback_used: false, response_summary: summarise(answers, last.json.model), usage, budget: this.#budgetSnap() });
      return { ok: true, source: 'live', cached: false, attempts, answers, usage, emit, promptHash };
    }

    const why = last ? (last.error_class === 'no_key' ? 'fail_closed_no_key' : last.error_class === 'network' || last.error_class === 'timeout' ? 'fail_closed_network' : last.error_class && last.error_class.startsWith('http') ? 'fail_closed_http' : 'fail_closed_unknown') : 'fail_closed_unknown';
    this.cache[promptHash] = { __failed: true, why, fallback_values: fallbackValues ?? null, at: new Date().toISOString() };
    this.#writeCache();
    this.#journal({ kind: 'consult', tag, prompt_hash: promptHash, attempts, source: why, latency_ms: msTotal, http_status: last?.status ?? null, error_class: last?.error_class ?? null, fallback_used: true, fallback_values: fallbackValues ?? null, budget: this.#budgetSnap() });
    return { ok: false, source: why, why, attempts, emit: { ok: false }, fallback_used: true, promptHash };
  }

  #budgetSnap() { return { used: this.used, cap_total: this.capTotal }; }

  async #transport(payload) {
    const t0 = Date.now();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.base}/v1/systemone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.key}` },
        body: JSON.stringify(payload),
        signal: ctl.signal,
      });
      const ms = Date.now() - t0;
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { json = null; }
      const error_class = res.ok ? null : res.status === 429 ? 'http_429' : res.status >= 500 ? 'http_5xx' : `http_${res.status}`;
      return { ok: res.ok, status: res.status, json, ms, error_class };
    } catch (e) {
      const name = (e && e.name) || '';
      return { ok: false, status: 0, json: null, ms: Date.now() - t0, error_class: name === 'AbortError' ? 'timeout' : 'network' };
    } finally { clearTimeout(timer); }
  }
}

// ── privacy self-scan: assert written text carries NO key material ──────────
export function textHasSecret(text, key) {
  if (key && String(key).length >= 8 && text.includes(key)) return true;
  if (text.includes('Bearer ')) return true;
  if (/apikey_[A-Za-z0-9_]{8,}/.test(text)) return true;
  if (/moth_[A-Za-z0-9]{8,}/.test(text)) return true;
  if (/sk-[A-Za-z0-9_]{8,}/.test(text)) return true;
  return false;
}

// scan the files this experiment owns: CLEAN or the offending PATHS (never the key)
export function noLeakScan(paths, key) {
  const out = { filesScanned: 0, keyMatches: [], patternMatches: [], clean: false };
  const patterns = [
    ['bearer-assign', /Bearer\s+[A-Za-z0-9_\-.]{16,}/],
    ['typesafe-key-assign', /TYPESAFE_KEY\s*=\s*['"]?[A-Za-z0-9_\-.]{16,}/],
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
