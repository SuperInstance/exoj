// live.mjs — additive live wiring for exoj (branch claude/live-fold).
//
//   EXOJ_LIVE=1  -> JEV emits come from the live typesafe.ai oracle and the
//                   field draw is seeded from a Moth comet-qrng integer draw.
//   unset / any failure -> the ORIGINAL offline paths (jev_backends.mjs mock
//                   emitter + mulberry32 PRNG). Nothing in core.mjs changes:
//                   Field stays primary, the quilt stays a projection, and
//                   observe() stays the only collapse.
//
// Env (values are read at runtime and NEVER logged / chained / written):
//   TYPESAFEAI_KEY (or TYPESAFE_KEY), MOTHQUANTUM_KEY, MOTHQUANTUM_BASE.
// Every result carries a `source` label: live | mock | prng | fallback:<why>.

import { randomBytes } from 'node:crypto';
import { mulberry32 } from './receipts.mjs';
import { makeBackend } from './experiments/jev_backends.mjs';

const JEV_URL = process.env.EXOJ_JEV_URL || 'https://api.typesafe.ai/v1/systemone';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const trim = (s) => (s == null ? null : String(s).replace(/\s+/g, '') || null);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const r4 = (x) => Math.round(x * 1e4) / 1e4;

export const liveOn = () => process.env.EXOJ_LIVE === '1';

async function fetchJson(url, opts, timeoutMs) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctl.signal });
    const text = await res.text();
    let data = null; try { data = JSON.parse(text); } catch { data = null; }
    return { status: res.status, data };
  } catch (e) { return { status: 0, data: null, err: String((e && e.name) || 'network') }; }
  finally { clearTimeout(t); }
}

// ---------------- JEV: live oracle with local-mock fallback ----------------

// One live noul. Returns {ok, noul, source:'live'} or {ok:false, why}.
export async function jevNoul(claim, question = 'Is the claim true?', { retries = 1, timeoutMs = 30000 } = {}) {
  const key = trim(process.env.TYPESAFEAI_KEY ?? process.env.TYPESAFE_KEY);
  if (!key) return { ok: false, why: 'no_key' };
  const body = JSON.stringify({
    model: 'jev-latest', state: claim,
    questions: { verdict: { type: 'noul', question, criteria: { true: 'the claim is true', false: 'the claim is false' } } },
  });
  let why = 'unknown';
  for (let a = 0; a <= retries; a++) {
    const r = await fetchJson(JEV_URL, {
      method: 'POST', body,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': UA },
    }, timeoutMs);
    const n = r.data && r.data.answers && r.data.answers.verdict && r.data.answers.verdict.noul;
    if (r.status === 200 && typeof n === 'number' && Number.isFinite(n)) return { ok: true, noul: clamp01(n), source: 'live' };
    why = r.status === 200 ? 'bad_shape' : `http_${r.status}`;
    if (a < retries) await sleep(800 * 2 ** a);
  }
  return { ok: false, why };
}

// noul -> soft deformation (the probability exoj keeps open). Same emit
// contract as every offline backend: γ+η=1, Δ in the creative band [0.4,0.6];
// an unsure verdict (noul near 0.5) is the most creative deformation.
export function noulToEmit(n) {
  const g = r4(n);
  return { g, e: r4(1 - g), d: r4(0.4 + 0.2 * (1 - Math.abs(2 * n - 1))) };
}

let _mock = null;
const mockEmit = (k) => { _mock ??= makeBackend(2401); return _mock('classical', k); };

// Drop-in live-backed jevEmit. Never throws on oracle failure: degrades to the
// local mock and says so in the chained row's `backend` + the return value.
export async function liveJevEmit(exo, q, r, claim, { tag = '', alpha = 0.4, question, k = 0 } = {}) {
  let src = 'mock', why = null, noul = null, v;
  if (liveOn()) {
    const j = await jevNoul(claim, question);
    if (j.ok) { src = 'live'; noul = j.noul; v = noulToEmit(j.noul); } else why = j.why;
  } else why = 'EXOJ_LIVE!=1';
  if (!v) v = mockEmit(k);
  const backend = src === 'live' ? 'jev-live' : 'classical-mock';
  const ev = exo.jevEmit(q, r, v.g, v.e, v.d, { tag, alpha, backend });
  return { ev, source: src, fallback_why: src === 'live' ? null : why, noul, emit: v };
}

// ---------------- Moth comet-qrng: field draw with PRNG fallback -----------

// Integers in [min,max]. Live: comet-qrng-v1 derive.integers (async job).
// Fallback: mulberry32 seeded from OS entropy (or `seed` for replay).
export async function mothIntegers({ min, max, count, seed = null, pollMs = 3000, timeoutMs = 90000 }) {
  const fb = (why) => {
    const s = seed ?? (randomBytes(4).readUInt32BE(0));
    const rng = mulberry32(s >>> 0);
    return { values: Array.from({ length: count }, () => min + Math.floor(rng() * (max - min + 1))),
             hex: null, S: null, job_id: null, source: 'prng', fallback_why: why, seed32: s >>> 0 };
  };
  if (!liveOn()) return fb('EXOJ_LIVE!=1');
  const key = trim(process.env.MOTHQUANTUM_KEY), base = trim(process.env.MOTHQUANTUM_BASE);
  if (!key || !base) return fb('no_key');
  const H = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': UA };
  const sub = await fetchJson(`${base}/engines/comet-qrng-v1/process`, {
    method: 'POST', headers: H, body: JSON.stringify({ params: { derive: { integers: { min, max, count } } } }),
  }, 30000);
  const id = sub.data && sub.data.job_id;
  if (![200, 202].includes(sub.status) || !id) return fb(`submit_http_${sub.status}`);
  const t0 = Date.now();
  let st = null;
  while (Date.now() - t0 < timeoutMs) {
    await sleep(pollMs);
    const s = await fetchJson(`${base}/jobs/${id}/status`, { headers: H }, 15000);
    st = s.data && s.data.status;
    if (st === 'completed' || st === 'failed' || st === 'cancelled') break;
  }
  if (st !== 'completed') return fb(`job_${st}`);
  let res = await fetchJson(`${base}/jobs/${id}/result`, { headers: H }, 30000);
  if (!(res.status === 200 && res.data)) { await sleep(2000); res = await fetchJson(`${base}/jobs/${id}/result`, { headers: H }, 30000); } // result can lag 'completed'
  const out = res.data && ((res.data.result && res.data.result.output) || res.data.output); // live shape: {result:{output:{random,bell_witness}}}
  const rnd = out && out.random;
  const vals = rnd && rnd.derived && rnd.derived.integers && rnd.derived.integers.values;
  if (!Array.isArray(vals) || vals.length < count) return fb('bad_shape');
  return { values: vals.slice(0, count).map(Number), hex: rnd.hex ?? null,
           S: (out.bell_witness && out.bell_witness.S) ?? rnd.bell_witness?.S ?? null, job_id: id, source: 'live', fallback_why: null };
}

// Seed the field's open state from one draw: chain a 'seed' row (provenance:
// source, job id, Bell S, seed-hex PREFIX only) and return distinct cell
// coordinates for `n` claims. Additive: uses the field's own _push chain, so
// verifyChain() keeps working; no cell amplitude is touched (nothing collapses).
export async function seedField(exo, n, { seed = null } = {}) {
  const cells = [...exo.cells.values()].map((c) => [c.q, c.r]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const draw = await mothIntegers({ min: 0, max: cells.length - 1, count: Math.max(24, n * 6), seed });
  const picked = [];
  for (const v of draw.values) { if (!picked.includes(v)) picked.push(v); if (picked.length === n) break; }
  for (let i = 0; picked.length < n; i++) if (!picked.includes(i)) picked.push(i); // vanishingly rare top-up
  exo.seq += 1;
  exo._push({ kind: 'seed', seq: exo.seq, source: draw.source, engine: draw.source === 'live' ? 'comet-qrng-v1' : 'mulberry32',
              job_id: draw.job_id, bell_S: draw.S, hex_prefix: draw.hex ? draw.hex.slice(0, 16) : null,
              fallback_why: draw.fallback_why, cells: picked.map((i) => cells[i]) });
  return { coords: picked.map((i) => cells[i]), draw };
}
