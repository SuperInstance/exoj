// gan/generator.mjs — Cell 01 (Generator) of the Unit Table GAN (SPEC §2, §4):
// cognitive profile "high-prefill, low-latency, concise decisions" — small
// payloads, bounded iteration, no meta-commentary. The moth: it nudges the
// lightest row (and a hash-chosen subset of its neighbours) toward a
// scaled-down copy of the densest row's direction, inside the pre-registered
// amplitude budget, then rescales the touched rows' masses.
//
// HARD CONTRACT: step()/run()/applyDrift() NEVER mutate the input table —
// every return carries a NEW UnitTable instance. All entropy is derived from
// (seed, nonce) via sha256 — no Math.random, no hidden state.
//
// I1 note (conservation): the mass draw is deterministic from the seed and
// every applied factor lies in [1 - MOTH_AMPLITUDE*0.1, 1 + MOTH_AMPLITUDE*0.1],
// but SPEC §3 I1 binds the generator directly ("after any generator step …
// mass not created"). Therefore the densest TOUCHED row absorbs the residual
// of the composite draw (the whole draw scaled inside the envelope when
// needed) so total mass is exactly conserved — mass is MOVED, never created.
// The validator's E_CONSERVATION stays the independent law and is exercised
// with hand-built violating tables (lab/gan.test.mjs).

import { createHash } from 'node:crypto';
import { MOTH_PROXIMITY, MOTH_AMPLITUDE, SENSOR_LAG_MS, DEADLOCK_STEPS } from './constants.mjs';
import { roll20, DRIFTS } from './die.mjs';

const AMP = MOTH_AMPLITUDE * 0.1; // per-component |delta| clamp == mass-factor half-width

// Deterministic fraction in [0, 1) derived from the run seed + step nonce.
function frac(seed, nonce, tag, ...parts) {
  const h = createHash('sha256').update(`${seed}:${nonce}:${tag}:${parts.join(':')}`).digest('hex');
  return parseInt(h.slice(0, 8), 16) / 0x100000000;
}

function meanVec(rows, W) {
  const m = new Float64Array(W);
  if (rows.length === 0) return m;
  for (const r of rows) for (let j = 0; j < W; j++) m[j] += r.vec[j];
  for (let j = 0; j < W; j++) m[j] /= rows.length;
  return m;
}

function argminDensest(rows) {
  let ai = 0, di = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].mass < rows[ai].mass) ai = i;
    if (rows[i].mass > rows[di].mass) di = i;
  }
  return [ai, di];
}

// One generator step. Returns { table (NEW instance), touched (ids), stepHash }.
export function step(table, { seed, nonce = '0' } = {}) {
  const rows = table.rows;
  const next = table.clone();
  if (rows.length === 0) return { table: next, touched: [], stepHash: next.hash() };

  // argmin-mass row (the moth's target) and densest row — ties break to the
  // first row in table order, so the choice is a pure function of the state.
  const [ai, di] = argminDensest(rows);
  const densest = rows[di];
  let n2 = 0;
  for (let j = 0; j < densest.vec.length; j++) n2 += densest.vec[j] * densest.vec[j];
  const dn = Math.sqrt(n2);
  const dir = dn > 0 ? Array.from(densest.vec, (x) => x / dn) : new Array(table.W).fill(0);

  // Neighbours = adjacent row indices; membership is hash-chosen from the
  // seed (a deterministic subset — the fractal footprint of this step).
  const nbrIdx = [ai - 1, ai + 1]
    .filter((i) => i >= 0 && i < rows.length)
    .filter((i) => frac(seed, nonce, 'nbr', rows[ai].id, rows[i].id) < 0.5);
  const touchedIdx = [ai, ...nbrIdx];

  // Fractal nudge: toward a scaled-down copy of the densest direction.
  // Target row gets the full per-component budget, neighbours half of it;
  // the per-component |delta| is hard-clamped to AMP (SPEC §1 amplitude).
  for (const i of touchedIdx) {
    const scale = i === ai ? 1 : 0.5;
    const v = next.rows[i].vec;
    for (let j = 0; j < v.length; j++) {
      let d = AMP * scale * dir[j] * (0.5 + 0.5 * frac(seed, nonce, 'vec', rows[i].id, String(j)));
      if (d > AMP) d = AMP;
      else if (d < -AMP) d = -AMP;
      v[j] += d;
    }
  }

  // Mass rescale: each touched row draws a factor in [1 - AMP, 1 + AMP],
  // deterministically from the seed. I1 conservation: the densest touched row
  // absorbs the residual so total mass is exactly conserved (mass is moved,
  // never created — SPEC §3 I1).
  const draws = new Map();
  for (const i of touchedIdx) draws.set(i, AMP * (2 * frac(seed, nonce, 'mass', rows[i].id) - 1));
  let densT = touchedIdx[0];
  for (const i of touchedIdx) if (rows[i].mass > rows[densT].mass) densT = i;
  let residual = 0;
  for (const i of touchedIdx) if (i !== densT) residual += rows[i].mass * draws.get(i);
  let dDens = -residual / rows[densT].mass;
  let shrink = 1;
  if (Math.abs(dDens) > AMP) {
    shrink = AMP / Math.abs(dDens);
    dDens = dDens > 0 ? AMP : -AMP;
  }
  for (const i of touchedIdx) {
    const d = i === densT ? dDens : draws.get(i) * shrink;
    next.rows[i].mass = rows[i].mass * (1 + d);
  }

  return {
    table: next,
    touched: touchedIdx.map((i) => rows[i].id),
    stepHash: next.hash(),
  };
}

// ---- the 20 named structural drifts (die-driven, scarred-not-refused) ----
//
// Every drift is a small deterministic pure transformation: it clones the
// table, applies ONE structural pivot, and returns the new instance. The
// `seed` parameter is part of the pre-registered signature and is reserved
// for future parameterised drifts; the current twenty are purely structural,
// so a drift name means the same move in every world. An unknown drift name
// is refused (fail-closed), never ignored.
export function applyDrift(table, driftName, _seed) {
  const rows = table.rows;
  const W = table.W;
  const next = table.clone();
  if (rows.length === 0) return next;
  const out = next.rows;
  const [ai, di] = argminDensest(rows);
  const mean = meanVec(rows, W);

  switch (driftName) {
    case 'argmin-reparent': { // lightest row pulled halfway to the densest vector
      const a = rows[ai].vec, b = rows[di].vec;
      for (let j = 0; j < W; j++) out[ai].vec[j] = (a[j] + b[j]) / 2;
      break;
    }
    case 'mass-flood': // floods the densest row (mass creation is legal ONLY die-driven → scarred)
      out[di].mass = rows[di].mass * 1.1;
      break;
    case 'row-split': { // densest row split into two equal-mass rows (mass conserved)
      const src = rows[di];
      const ids = new Set(rows.map((r) => r.id));
      let k = 0;
      let cand = `${src.id}~split`;
      while (ids.has(cand)) { k += 1; cand = `${src.id}~split${k}`; }
      out.splice(di, 1,
        { id: src.id, vec: Float64Array.from(src.vec), mass: src.mass / 2 },
        { id: cand, vec: Float64Array.from(src.vec), mass: src.mass / 2 });
      break;
    }
    case 'row-merge': { // two lightest rows merged (mass conserved)
      if (rows.length < 2) break;
      const order = rows.map((r, i) => i).sort((a, b) => rows[a].mass - rows[b].mass || a - b);
      const [x, y] = [order[0], order[1]];
      const lo = Math.min(x, y), hi = Math.max(x, y);
      const merged = {
        id: `${rows[x].id}+${rows[y].id}`,
        vec: Float64Array.from(rows[x].vec, (v, j) => (v + rows[y].vec[j]) / 2),
        mass: rows[x].mass + rows[y].mass,
      };
      out.splice(hi, 1);
      out.splice(lo, 1, merged);
      break;
    }
    case 'band-rotate': // rotate row order by one position
      out.unshift(out.pop());
      break;
    case 'floor-lift': // raise the lightest row mass by half
      out[ai].mass = rows[ai].mass * 1.5;
      break;
    case 'entropy-dam': // pull the densest vector halfway to the table mean
      for (let j = 0; j < W; j++) out[di].vec[j] = 0.5 * rows[di].vec[j] + 0.5 * mean[j];
      break;
    case 'mirror-fold': // negate every odd component
      for (let i = 0; i < rows.length; i++) {
        for (let j = 1; j < W; j += 2) out[i].vec[j] = -rows[i].vec[j];
      }
      break;
    case 'spring-cut': { // halve the non-densest vector most aligned with the densest
      if (rows.length < 2) break;
      let best = -1, bestC = -Infinity;
      for (let i = 0; i < rows.length; i++) {
        if (i === di) continue;
        let dot = 0, na = 0, nb = 0;
        for (let j = 0; j < W; j++) { dot += rows[i].vec[j] * rows[di].vec[j]; na += rows[i].vec[j] ** 2; nb += rows[di].vec[j] ** 2; }
        const c = na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : -Infinity;
        if (c > bestC) { bestC = c; best = i; }
      }
      if (best >= 0) for (let j = 0; j < W; j++) out[best].vec[j] = rows[best].vec[j] * 0.5;
      break;
    }
    case 'phase-nudge': // small deterministic sinusoidal phase term
      for (let i = 0; i < rows.length; i++) {
        for (let j = 0; j < W; j++) out[i].vec[j] = rows[i].vec[j] + 0.01 * Math.sin(j + i);
      }
      break;
    case 'border-widen': // widen the border components
      for (let i = 0; i < rows.length; i++) {
        out[i].vec[0] = rows[i].vec[0] * 1.2;
        if (W > 1) out[i].vec[W - 1] = rows[i].vec[W - 1] * 1.2;
      }
      break;
    case 'core-hollow': // subtract the table mean from the densest vector
      for (let j = 0; j < W; j++) out[di].vec[j] = rows[di].vec[j] - mean[j];
      break;
    case 'lattice-shear': // shear each component toward its neighbour component
      for (let i = 0; i < rows.length; i++) {
        for (let j = 0; j < W; j++) out[i].vec[j] = rows[i].vec[j] + 0.05 * rows[i].vec[(j + 1) % W];
      }
      break;
    case 'weight-fast': // double the lightest row mass
      out[ai].mass = rows[ai].mass * 2;
      break;
    case 'weight-slow': // halve the lightest row mass
      out[ai].mass = rows[ai].mass * 0.5;
      break;
    case 'shallow-till': // small constant added everywhere
      for (let i = 0; i < rows.length; i++) {
        for (let j = 0; j < W; j++) out[i].vec[j] = rows[i].vec[j] + 0.01;
      }
      break;
    case 'deep-till': // alternating-sign constant
      for (let i = 0; i < rows.length; i++) {
        for (let j = 0; j < W; j++) out[i].vec[j] = rows[i].vec[j] + 0.05 * (j % 2 === 0 ? 1 : -1);
      }
      break;
    case 'reverse-mass': // every row mass × 0.9
      for (let i = 0; i < rows.length; i++) out[i].mass = rows[i].mass * 0.9;
      break;
    case 'prune-tail': // last row mass halved
      out[rows.length - 1].mass = rows[rows.length - 1].mass * 0.5;
      break;
    case 'head-graft': { // graft the head row direction onto the lightest row
      const a = rows[ai].vec, b = rows[0].vec;
      for (let j = 0; j < W; j++) out[ai].vec[j] = (a[j] + b[j]) / 2;
      break;
    }
    default:
      throw new Error(`applyDrift: unknown drift ${JSON.stringify(driftName)} — the drift table is pre-registered (20 entries)`);
  }
  return next;
}

// Cell 01 run loop. Fires the die on (a) sensor lag above SENSOR_LAG_MS
// (measured per step with the injectable clock) and (b) deadlock: a run of
// DEADLOCK_STEPS consecutive unchanged stepHashes (SPEC I5). Every die roll
// is receipted. When a drift crosses the I2 proximity boundary and a scar
// registry is provided, the crossing is scarred (die-driven crossings are
// allowed-but-scarred, never silently accepted — SPEC I2/I4).
//
// Clock policy: the DEFAULT clock is a deterministic zero-lag virtual clock
// so runs are reproducible by default (receipts, tests, cross-machine
// replays). Pass die.mjs defaultClock to meter real wall time; pass a fake
// clock to exercise the lag pathway deterministically.
export function run(table, { seed, maxSteps = 16, clock = zeroClock, scars = null, noncePrefix = 'step' } = {}) {
  let t = table;
  let lastHash = t.hash();
  let stall = 0;
  const dieReceipts = [];
  let steps = 0;

  for (let i = 0; i < maxSteps; i++) {
    const nonce = `${noncePrefix}-${i}`;
    const t0 = clock();
    const stepped = step(t, { seed, nonce });
    const lagMs = Math.max(0, clock() - t0);
    let next = stepped.table;

    if (lagMs > SENSOR_LAG_MS) {
      const roll = roll20(seed, `lag:${nonce}`);
      const drift = DRIFTS[roll.roll - 1];
      const pre = next;
      next = applyDrift(next, drift.name, seed);
      dieReceipts.push({ reason: 'lag', nonce, roll: roll.roll, raw: roll.raw, drift: drift.name, lagMs });
      if (scars && pre.proximity(next) < MOTH_PROXIMITY) {
        scars.scar('boundary-cross', `die drift ${drift.name} crossed the I2 boundary (sensor lag)`, next.hash(), { roll: roll.roll, raw: roll.raw, nonce, drift: drift.name });
      }
    }

    steps += 1;
    const h = next.hash();
    if (h === lastHash) stall += 1;
    else stall = 0;
    lastHash = h;
    t = next;

    if (stall >= DEADLOCK_STEPS) {
      const roll = roll20(seed, `deadlock:${nonce}`);
      const drift = DRIFTS[roll.roll - 1];
      const pre = t;
      t = applyDrift(t, drift.name, seed);
      dieReceipts.push({ reason: 'deadlock', nonce, roll: roll.roll, raw: roll.raw, drift: drift.name });
      if (scars && pre.proximity(t) < MOTH_PROXIMITY) {
        scars.scar('boundary-cross', `die drift ${drift.name} crossed the I2 boundary (deadlock)`, t.hash(), { roll: roll.roll, raw: roll.raw, nonce, drift: drift.name });
      }
      stall = 0;
      lastHash = t.hash();
      steps += 1;
    }
  }

  // "converged" = the run completed without needing the die. The moth's walk
  // never fixpoints by design; convergence theatre is explicitly out of scope
  // (the validator's boundary is the point, not GAN convergence).
  return { finalTable: t, steps, dieReceipts, converged: dieReceipts.length === 0 };
}

// Deterministic default: lag is never fired unless metering is opted into.
function zeroClock() {
  return 0;
}
