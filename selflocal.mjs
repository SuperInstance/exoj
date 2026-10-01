// selflocal.mjs — additive: a SELF-LOCALIZING observer for exoj (branch claude/self-localizing).
//
// The field, not the demo, decides what to look at next:
//   attend()  RANKS the open cells by their own displayed noul amplitude (γ under the
//             'ledger' policy) and surfaces the argmin. It mutates nothing but the chain
//             (a 'localize' row) — attending is NOT collapsing.
//   observe() (core, untouched) remains the ONLY collapse; foldToFixpoint calls it explicitly.
//   adjudicate() draws bypass hypotheses at the located leaf from Moth comet-qrng and lets
//             live JEV `choice` rule on each (fallback: mulberry32 + a labelled mock ruling).
// Nothing here edits core.mjs. Never throws on oracle failure; every result carries `source`.
// Secrets are read from env at call time and never logged/chained.

import { hexRing } from './core.mjs';
import { mulberry32 } from './receipts.mjs';
import { liveOn, liveJevEmit, mothIntegers } from './live.mjs';

const r4 = (x) => Math.round(x * 1e4) / 1e4;
const k2 = (q, r) => `${q},${r}`;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const JEV_URL = process.env.EXOJ_JEV_URL || 'https://api.typesafe.ai/v1/systemone';

// ---- claim registry: which cell carries which claim (extension-side; the field stays primary)
export const makeRegistry = () => new Map(); // key -> { q, r, claim, role: 'whole'|'leaf', depth, fresh }
export function register(reg, q, r, claim, role = 'leaf', depth = 1) {
  reg.set(k2(q, r), { q, r, claim, role, depth, fresh: true, decomposed: false });
}
// emit one claim as a soft deformation (live JEV or mock) on a cell, and register it.
export async function emitClaim(exo, reg, [q, r], claim, { role = 'leaf', depth = 1, tag = '', k = 0 } = {}) {
  const x = await liveJevEmit(exo, q, r, claim, { tag, k });
  register(reg, q, r, claim, role, depth);
  return x;
}

// the field's OWN noul for a cell: its displayed γ amplitude (ledger: α-weighted mean of emitted noul)
export const cellNoul = (cell) => cell.amps().gamma;
const isOpen = (c) => c.touched > 0 && c.prob_mass > 0;

// ---- self-localizing attention: rank, never collapse ----
// Pool = registered leaf cells that are open AND unresolved (inside the band |γ-0.5|<τ, or still
// fresh = not yet ranked once by the observer). Choice = argmin noul (ties: nearer 0.5, then key).
export function attendWeakest(exo, reg, { tau = 0.3, observer = 'self-localizer', step = 0 } = {}) {
  const rows = [];
  for (const [key, e] of reg) {
    if (e.role !== 'leaf') continue;
    const c = exo.cells.get(key); if (!c || !isOpen(c)) continue;
    const n = cellNoul(c);
    if (e.fresh || Math.abs(n - 0.5) < tau) rows.push({ key, q: e.q, r: e.r, noul: n, band: Math.abs(n - 0.5), fresh: e.fresh });
  }
  rows.sort((a, b) => a.noul - b.noul || a.band - b.band || (a.key < b.key ? -1 : 1));
  const chosen = rows[0] || null;
  exo.seq += 1;
  exo._push({ kind: 'localize', seq: exo.seq, observer, step, rule: 'argmin-noul', tau, pool: rows.length,
              ranked: rows.slice(0, 5).map((x) => [x.q, x.r, r4(x.noul)]), chosen: chosen ? [chosen.q, chosen.r, r4(chosen.noul)] : null });
  for (const x of rows) reg.get(x.key).fresh = false; // ranked once -> siblings that clear the band settle
  return { chosen, ranked: rows };
}

function freeNeighbours(exo, reg, q, r, n) {
  const out = [];
  for (const rad of [1, 2, 3]) {
    for (const [a, b] of hexRing(q, r, rad)) {
      if (out.length >= n) return out;
      const c = exo.cells.get(k2(a, b));
      if (c && c.touched === 0 && !reg.has(k2(a, b)) && !out.some(([x, y]) => x === a && y === b)) out.push([a, b]);
    }
  }
  return out;
}

// ---- fold to fixpoint: attend -> (decompose) -> observe -> repeat ----
// decompose(claim, depth) -> string[] | null. Stops when no unresolved open leaf remains
// (every open leaf clears |γ-0.5| >= τ and has been ranked) or the collapse budget is hit.
export async function foldToFixpoint(exo, reg, { tau = 0.3, budget = 6, maxDepth = 2, decompose = null, onStep = null } = {}) {
  const collapses = [];
  let stop = 'budget';
  for (let step = 1; step <= budget; step++) {
    const a = attendWeakest(exo, reg, { tau, step });
    if (!a.chosen) { stop = 'fixpoint'; break; }
    const e = reg.get(a.chosen.key);
    let kids = [];
    if (decompose && !e.decomposed && e.depth < maxDepth) {
      e.decomposed = true;
      const subs = (await Promise.resolve().then(() => decompose(e.claim, e.depth)).catch(() => null)) || [];
      const spots = freeNeighbours(exo, reg, e.q, e.r, subs.length);
      for (let i = 0; i < Math.min(subs.length, spots.length); i++) {
        const x = await emitClaim(exo, reg, spots[i], subs[i], { depth: e.depth + 1, tag: `d${e.depth + 1}s${step}.${i}`, k: 10 * step + i });
        kids.push({ q: spots[i][0], r: spots[i][1], noul: x.noul, g: x.emit.g, source: x.source, claim: subs[i] });
      }
    }
    const cell = exo.cells.get(a.chosen.key);
    const before = cell.prob_mass;
    const obs = exo.observe(e.q, e.r, r4(cell.amps().delta)); // the ONLY collapse; explicit
    const rec = { step, q: e.q, r: e.r, claim: e.claim, noul: a.chosen.noul, depth: e.depth, pool: a.ranked.length, before, kids, obs_seq: obs.seq };
    collapses.push(rec);
    if (onStep) onStep(rec, a);
  }
  return { collapses, stop, tau };
}

// ---- un-gameable adversary at the located leaf ----
// Leaf-specific bypass hypotheses (templated from the located claim text — S17.1).
export const bypassPool = (claim) => [
  `The claim rests on an unstated assumption that fails in a realistic case: "${claim}"`,
  `A quantifier or absolute word in the claim ("all", "entirely", "no", "only", "always") admits a counterexample: "${claim}"`,
  `The claim conflates two distinct things, and only one of them is true: "${claim}"`,
  `The claim is true only under a narrow definition of its key term, and false under the ordinary one: "${claim}"`,
  `A well-known exception or edge case directly contradicts the claim: "${claim}"`,
  `The claim was true historically or in one context but is false now or elsewhere: "${claim}"`,
  `The claim states a boundary or number precisely, and the precise value is wrong: "${claim}"`,
  `The claim's causal or logical link is only correlational, so it fails as stated: "${claim}"`,
  `Measurement or observation of the claim's subject contradicts it: "${claim}"`,
];

async function jevChoice(state, question, criteria, { timeoutMs = 30000 } = {}) {
  const key = (process.env.TYPESAFEAI_KEY ?? process.env.TYPESAFE_KEY ?? '').replace(/\s+/g, '');
  if (!key) return { ok: false, why: 'no_key' };
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(JEV_URL, { method: 'POST', signal: ctl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ model: 'jev-latest', state, questions: { verdict: { type: 'choice', question, criteria } } }) });
    const d = await res.json().catch(() => null);
    const a = d && d.answers && d.answers.verdict;
    const choice = a && (a.choice ?? a.value);
    if (res.status === 200 && typeof choice === 'string' && choice in criteria)
      return { ok: true, choice, confidence: typeof a.confidence === 'number' ? a.confidence : null };
    return { ok: false, why: res.status === 200 ? 'bad_shape' : `http_${res.status}` };
  } catch (e) { return { ok: false, why: String((e && e.name) || 'network') }; }
  finally { clearTimeout(t); }
}

// Draw `n` distinct bypasses via Moth comet-qrng (PRNG fallback), rule on each with JEV `choice`,
// chain ONE 'adversary' row (source, job id, Bell S, hex PREFIX only, picks, verdicts). Never throws.
export async function adjudicate(exo, [q, r], claim, { n = 3, seed = null } = {}) {
  const pool = bypassPool(claim);
  let draw = await mothIntegers({ min: 0, max: pool.length - 1, count: 12, seed });
  for (let t = 0; t < 2 && liveOn() && draw.source !== 'live'; t++) draw = await mothIntegers({ min: 0, max: pool.length - 1, count: 12, seed }); // Moth results can lag/flake: retry before degrading
  const picks = [];
  for (const v of draw.values) { if (!picks.includes(v)) picks.push(v); if (picks.length === n) break; }
  for (let i = 0; picks.length < n; i++) if (!picks.includes(i)) picks.push(i);
  const criteria = { defeats: 'the bypass succeeds: the claim is false or unsound as stated', survives: 'the bypass fails: the claim stands' };
  const mock = mulberry32((draw.seed32 ?? 12345) >>> 0);
  const rulings = [];
  for (const i of picks) {
    let src = 'mock', why = 'EXOJ_LIVE!=1', ch = null, conf = null;
    if (liveOn()) {
      const j = await jevChoice(`Claim under audit: ${claim}\nProposed bypass hypothesis: ${pool[i]}`, 'Does this bypass hypothesis defeat the claim?', criteria);
      if (j.ok) { src = 'live'; why = null; ch = j.choice; conf = j.confidence; } else why = j.why;
    }
    if (!ch) ch = mock() < 0.5 ? 'defeats' : 'survives'; // labelled mock ruling; never presented as live
    rulings.push({ pick: i, choice: ch, confidence: conf, source: src, fallback_why: why });
  }
  const hits = rulings.filter((x) => x.choice === 'defeats').length;
  const verdict = hits * 2 > n ? 'BROKEN' : 'SURVIVES'; // majority of un-steered bypasses land => the leaf does not survive
  exo.seq += 1;
  const row = exo._push({ kind: 'adversary', seq: exo.seq, q, r, draw_source: draw.source, engine: draw.source === 'live' ? 'comet-qrng-v1' : 'mulberry32',
    job_id: draw.job_id, bell_S: draw.S, hex_prefix: draw.hex ? draw.hex.slice(0, 16) : null, seed32: draw.seed32 ?? null, fallback_why: draw.fallback_why,
    picks, rulings: rulings.map((x) => [x.pick, x.choice, x.source]), hits, n, verdict });
  return { picks, pool, rulings, hits, n, verdict, draw, row };
}
