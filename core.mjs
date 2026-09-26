// exoj/core.mjs — ExoJ core, JS port of the seed's exoj_core.py (quilt-native).
//
// Field is primary: cells on a hex lattice carrying soft amplitudes
// (γ crystallisation, η possibility, Δ creativity). Quilt is the projection.
// JEV emits soft deformations — never a definite token. Observation is an
// explicit, recorded, LOCAL collapse. Every deformation is content-addressed
// (sha256 over canonical JSON, chained prev-hash): the field itself is the
// objective proof object.
//
// Conservation policies (the seed's own _norm() vs two fixes — see
// experiments/e_x1_naturality.mjs and e_x2_conserve_policy.mjs):
//   'seed'     — verbatim port of the reference: convex soft write, then a
//                SILENT mean-based renorm after EVERY emit (fires when the
//                active-cell mean Σ exceeds 1.001, rescales every active cell).
//   'deferred' — prescribed fix: never mutate cell state during emit;
//                normalisation is a pure projection applied at sense time.
//   'ledger'   — full naturality fix: per-cell COMMUTATIVE α-weighted
//                accumulation; amplitudes are a pure aggregate computed at
//                sense time; normalisation never mutates the ledger.
//   'refuse'   — quilt-dba boundary policy (mirror of the 1585 line): a write
//                that would push the TARGET CELL's Σ_c past 1.0 is REFUSED —
//                ledger unchanged, refusal counted and chained (never silent).

import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const GENESIS = 'EXOJ-GENESIS';

// ---------- deterministic hashing (content addressing) ----------

export function canonicalJSON(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJSON(value[k])).join(',') + '}';
}

export function sha256Hex(s) {
  return createHash('sha256').update(s).digest('hex');
}

function chainHash(row, prevHash) {
  const { row_hash, ...rest } = row;
  return sha256Hex(canonicalJSON([prevHash, rest]));
}

// ---------- geometry ----------

export function hexDist(q1, r1, q2, r2) {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

export function hexRing(q, r, radius = 1) {
  const out = [];
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
      if (dq !== 0 || dr !== 0) out.push([q + dq, r + dr]);
    }
  }
  return out;
}

const r4 = (x) => Math.round(x * 1e4) / 1e4;
const key = (q, r) => `${q},${r}`;

// ---------- cell ----------

export class Cell {
  constructor(q, r) {
    this.q = q; this.r = r;
    this.gamma = 0.0; this.eta = 1.0; this.delta = 0.5;
    this.delta_override = null; // set by observe(): a definite Δ outranks any aggregate
    this.strength = 0.0;
    this.frags = []; this.programs = [];
    this.touched = 0; this.prob_mass = 1.0;
    // 'ledger' policy state: commutative α-weighted accumulation
    this.G = 0.0; this.E = 0.0; this.D = 0.0; this.aSum = 0.0; this.n = 0;
  }

  // Reference (seed) soft write: convex combination, order-DEPENDENT by design.
  softWrite(g, e, d, alpha = 0.4) {
    this.gamma = (1 - alpha) * this.gamma + alpha * g;
    this.eta = (1 - alpha) * this.eta + alpha * e;
    this.delta = (1 - alpha) * this.delta + alpha * d;
    this.strength = Math.max(this.strength, g);
    this.prob_mass = Math.min(1.0, this.prob_mass * 0.98 + 0.02);
    this.touched += 1;
  }

  // Commutative accumulation: multiset union of α-weighted targets. Any
  // permutation of the same write multiset lands bit-near-identically
  // (float addition is non-associative — residual ~1e-15, receipted in e_x1).
  accumulate(g, e, d, alpha = 0.4) {
    this.G += alpha * g; this.E += alpha * e; this.D += alpha * d; this.aSum += alpha;
    this.strength = Math.max(this.strength, g);
    this.prob_mass = Math.min(1.0, this.prob_mass * 0.98 + 0.02);
    this.touched += 1; this.n += 1;
  }

  // Displayed amplitudes — the only place 'ledger' aggregates.
  amps() {
    const delta = this.delta_override ?? (this.aSum > 0 ? this.D / this.aSum : this.delta);
    if (this.aSum > 0) return { gamma: this.G / this.aSum, eta: this.E / this.aSum, delta };
    return { gamma: this.gamma, eta: this.eta, delta };
  }

  toDict() {
    const a = this.amps();
    return {
      q: this.q, r: this.r,
      'γ': r4(a.gamma), 'η': r4(a.eta), 'Δ': r4(a.delta),
      str: r4(this.strength), prob: r4(this.prob_mass),
      frags: this.frags.slice(-4), programs: this.programs.slice(-3),
      touched: this.touched,
    };
  }
}

// Pure sense-time normalisation (never mutates): if the active-cell mean Σ
// exceeds 1, rescale γ,η in the VIEW only. Returns Map key -> {γ,η,Δ}.
export function normalizeView(cellList) {
  const amp = (c) => (typeof c.amps === 'function' ? c.amps() : { gamma: c.gamma, eta: c.eta, delta: c.delta });
  const active = cellList.filter((c) => c.touched > 0);
  const view = new Map();
  if (active.length === 0) return view;
  let g = 0, e = 0;
  for (const c of active) { const a = amp(c); g += a.gamma; e += a.eta; }
  const s = g / active.length + e / active.length;
  const f = s > 1 ? 1 / s : 1;
  for (const c of active) { const a = amp(c); view.set(key(c.q, c.r), { 'γ': a.gamma * f, 'η': a.eta * f, 'Δ': a.delta }); }
  return view;
}

// ---------- the field ----------

export class ExoJ {
  constructor(name = 'exoj', radius = 4, policy = 'seed') {
    this.name = name;
    this.radius = radius;
    this.policy = policy; // 'seed' | 'deferred' | 'ledger' | 'refuse'
    this.cells = new Map();
    for (let q = -radius; q <= radius; q++) {
      for (let r = -radius; r <= radius; r++) {
        if (hexDist(q, r, 0, 0) <= radius) this.cells.set(key(q, r), new Cell(q, r));
      }
    }
    this.seq = 0;
    this.deformations = [];
    this.observations = [];
    this.observers = {};
    this.chain = [];          // content-addressed event chain
    this._tip = GENESIS;
    this.stats = { norms_fired: 0, shaved_mass: 0, collateral_mutations: 0, collateral_mass: 0, refusals: 0, refused_mass: 0 };
  }

  // ---- chain ----
  get chain_tip() { return this._tip; }

  _push(row) {
    row.row_hash = chainHash(row, this._tip);
    this._tip = row.row_hash;
    this.chain.push(row);
    return row;
  }

  verifyChain() {
    let prev = GENESIS;
    for (const r of this.chain) {
      const { row_hash, ...rest } = r;
      if (row_hash === undefined) return { ok: false, at: r.seq ?? null, why: 'missing row_hash' };
      const want = chainHash(rest, prev);
      if (want !== row_hash) return { ok: false, at: r.seq ?? null, why: 'hash mismatch' };
      prev = row_hash;
    }
    return { ok: true, links: this.chain.length, tip: this._tip };
  }

  // ---- observers ----
  attend(observer) {
    this.observers[observer] = { seq: this.seq, wall: Date.now() };
    this._push({ kind: 'attend', seq: this.seq, observer, prev: this._tip });
    return Object.keys(this.observers);
  }

  // ---- the seed's silent norm (verbatim semantics) ----
  _norm() {
    const active = [...this.cells.values()].filter((c) => c.touched > 0);
    if (active.length === 0) return;
    let g = 0, e = 0;
    for (const c of active) { g += c.gamma; e += c.eta; }
    g /= active.length; e /= active.length;
    const s = g + e;
    if (s > 1.001) {
      const before = (g + e) * active.length;
      for (const c of active) { c.gamma /= s; c.eta /= s; }
      const after = (g / s + e / s) * active.length;
      this.stats.norms_fired += 1;
      this.stats.shaved_mass += before - after;
    }
  }

  // ---- JEV emit: a soft vectorized progression; never a definite token ----
  jevEmit(q, r, gamma, eta, delta, opts = {}) {
    const { tag = '', program = null, backend = 'classical', alpha = 0.4 } = opts;
    let k = key(q, r);
    if (!this.cells.has(k)) { q = 0; r = 0; k = key(q, r); } // seed compat: off-lattice folds to origin
    const cell = this.cells.get(k);
    const preSigma = cell.amps().gamma + cell.amps().eta;

    if (this.policy === 'refuse') {
      // quilt-dba mirror: per-transaction boundary on the cell ledger. The
      // reference boundary is exact (1585 ok / 1586 refuse); translated to
      // float64 amplitudes the exact line needs a 1e-12 float guard — receipted
      // in e_x2 as boundary integrity max_cell_Σ ≤ 1 + 1e-9.
      const postG = (1 - alpha) * cell.gamma + alpha * gamma;
      const postE = (1 - alpha) * cell.eta + alpha * eta;
      if (postG + postE > 1.0 + 1e-12) {
        this.seq += 1;
        this.stats.refusals += 1;
        this.stats.refused_mass += gamma + eta;
        return this._push({
          kind: 'refuse', seq: this.seq, q, r, 'γ': gamma, 'η': eta, 'Δ': delta,
          alpha, tag, backend, program,
          would_be_Σ: postG + postE, boundary: 1.0,
          note: 'write refused at the boundary; ledger unchanged; refusal counted',
        });
      }
    }

    if (this.policy === 'ledger') cell.accumulate(gamma, eta, delta, alpha);
    else cell.softWrite(gamma, eta, delta, alpha);

    this.seq += 1;
    cell.touched = Math.max(cell.touched, 1);
    const frag = sha256Hex(`${this.name}|${q}|${r}|${this.seq}|${backend}`).slice(0, 8);
    if (!cell.frags.includes(frag)) cell.frags.push(frag);
    if (program) cell.programs.push(program);

    const ev = {
      kind: 'deform', seq: this.seq, q, r,
      'γ': gamma, 'η': eta, 'Δ': delta, alpha, tag, backend, program,
      cell_Σ_pre: preSigma,
    };
    this.deformations.push(ev);
    this._push(ev);
    if (this.policy === 'seed') {
      // The reference renormalises AFTER EVERY emit, silently, field-wide.
      this._collateralSnapshot(k);
      this._norm();
      const { cells: cMut, mass: mMut } = this._collateralDelta();
      this.stats.collateral_mutations += cMut;
      this.stats.collateral_mass += mMut;
    }
    return ev;
  }

  _collateralSnapshot(targetK) {
    this._ctarget = targetK;
    this._cpre = new Map();
    for (const [k, c] of this.cells) if (c.touched > 0 && k !== targetK) this._cpre.set(k, [c.gamma, c.eta]);
  }
  _collateralDelta() {
    let cells = 0, mass = 0;
    for (const [k, c] of this.cells) {
      if (c.touched > 0 && k !== this._ctarget && this._cpre.has(k)) {
        const [g0, e0] = this._cpre.get(k);
        if (c.gamma !== g0 || c.eta !== e0) { cells += 1; mass += Math.abs(c.gamma - g0) + Math.abs(c.eta - e0); }
      }
    }
    return { cells, mass };
  }

  // ---- observation: the ONLY collapse, explicit and recorded ----
  observe(q, r, definite) {
    let k = key(q, r);
    if (!this.cells.has(k)) { q = 0; r = 0; k = key(q, r); }
    const cell = this.cells.get(k);
    const oldProb = cell.prob_mass;
    cell.prob_mass = 0.0;
    cell.delta = definite;
    cell.delta_override = definite; // definite Δ outranks ledger aggregates too
    this.seq += 1;
    const obs = { kind: 'observe', seq: this.seq, q, r, definite_Δ: definite, prev_prob: oldProb };
    this.observations.push(obs);
    return this._push(obs);
  }

  // ---- temporal programs (attach to cells, fire on schedule) ----
  attachProgram(q, r, spec) {
    let k = key(q, r);
    if (!this.cells.has(k)) { q = 0; r = 0; k = key(q, r); }
    const cell = this.cells.get(k);
    const full = spec.kind === 'every'
      ? { id: spec.id, kind: 'every', period: spec.period, next: spec.start ?? spec.period, action: spec.action ?? 'refresh' }
      : { id: spec.id, kind: 'at', at: spec.at, action: spec.action ?? 'refresh', done: false };
    cell.programs.push(full);
    this.seq += 1;
    // Snapshot the spec into the chain (the live object's `next` cursor
    // advances on every fire; the receipt freezes the schedule at attach time).
    return this._push({ kind: 'program_attach', seq: this.seq, q, r, program: spec.id, spec: JSON.parse(JSON.stringify(full)) });
  }

  tick(t) {
    const fired = [];
    for (const cell of this.cells.values()) {
      if (cell.touched === 0) continue;
      for (const p of cell.programs) {
        if (typeof p === 'string') continue;
        if (p.kind === 'every') {
          while (p.next <= t) {
            const a = cell.amps();
            this.jevEmit(cell.q, cell.r, a.gamma, a.eta, a.delta, { tag: `program:${p.id}`, backend: 'program', alpha: 0.2 });
            fired.push({ program: p.id, q: cell.q, r: cell.r, t: p.next });
            p.next += p.period;
          }
        } else if (p.kind === 'at' && !p.done && p.at <= t) {
          const a = cell.amps();
          this.jevEmit(cell.q, cell.r, a.gamma, a.eta, a.delta, { tag: `program:${p.id}`, backend: 'program', alpha: 0.2 });
          fired.push({ program: p.id, q: cell.q, r: cell.r, t: p.at });
          p.done = true;
        }
      }
    }
    return fired;
  }

  // ---- sensing (pure read) ----
  sense() {
    const active = [...this.cells.values()].filter((c) => c.touched > 0);
    if (active.length === 0) {
      return { 'γ': 0, 'η': 1, 'Δ': 0.5, 'Σ': 1, active: 0, zone: 0, prob_open: 1.0, observers: [], deformations: 0, observations: 0, policy: this.policy, chain_tip: this._tip };
    }
    let g = 0, e = 0, d = 0, zone = 0, po = 0, maxCellSigma = 0;
    for (const c of active) {
      const a = c.amps();
      g += a.gamma; e += a.eta; d += a.delta;
      if (a.delta >= 0.4 && a.delta <= 0.6) zone += 1;
      po += c.prob_mass;
      const s = a.gamma + a.eta;
      if (s > maxCellSigma) maxCellSigma = s;
    }
    const n = active.length;
    const meanΣ = g / n + e / n;
    const f = meanΣ > 1 ? 1 / meanΣ : 1; // normed VIEW (pure, state untouched)
    return {
      'γ': g / n, 'η': e / n, 'Δ': d / n, 'Σ': meanΣ,
      'Σ_normed': meanΣ * f, max_cell_Σ: maxCellSigma,
      active: n, zone: zone / n, prob_open: po / n,
      deformations: this.deformations.length, observations: this.observations.length,
      observers: Object.keys(this.observers), policy: this.policy, chain_tip: this._tip,
      norms_fired: this.stats.norms_fired, refusals: this.stats.refusals,
    };
  }

  // ---- dependent projection ("show your work"): a READ-ONLY slice ----
  project(observer) {
    if (!this.observers[observer]) this.attend(observer);
    return {
      format: 'exoj-projection-v1',
      field: this.name,
      observer,
      sense: this.sense(),
      recent_deformations: this.deformations.slice(-12),
      observations: this.observations.slice(-5),
      chain_tip: this._tip,
      note: 'Dependent linearisation of the parallel field. Wave-function remains open except at recorded observation events.',
    };
  }

  quiltSnapshot() {
    return [...this.cells.values()].filter((c) => c.touched > 0).map((c) => c.toDict());
  }

  // ---- persistence (dunnable shell) ----
  save(path) {
    const state = {
      format: 'exoj-shell-v1',
      name: this.name, radius: this.radius, policy: this.policy, seq: this.seq,
      sense: this.sense(),
      quilt: this.quiltSnapshot(),
      cells_raw: [...this.cells.values()].filter((c) => c.touched > 0).map((c) => ({
        q: c.q, r: c.r, gamma: c.gamma, eta: c.eta, delta: c.delta, strength: c.strength,
        frags: c.frags, programs: c.programs, touched: c.touched, prob_mass: c.prob_mass,
        delta_override: c.delta_override,
        G: c.G, E: c.E, D: c.D, aSum: c.aSum, n: c.n,
      })),
      deformations: this.deformations,
      observations: this.observations,
      observers: this.observers,
      stats: this.stats,
      chain: this.chain,
      chain_tip: this._tip,
    };
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(state, null, 2));
    return path;
  }

  static load(path) {
    const state = JSON.parse(readFileSync(path, 'utf8'));
    const exo = new ExoJ(state.name, state.radius, state.policy);
    exo.seq = state.seq;
    for (const raw of state.cells_raw ?? []) {
      const c = new Cell(raw.q, raw.r);
      Object.assign(c, raw);
      if (raw.delta_override === undefined) c.delta_override = null;
      exo.cells.set(key(raw.q, raw.r), c);
    }
    exo.deformations = state.deformations ?? [];
    exo.observations = state.observations ?? [];
    exo.observers = state.observers ?? {};
    exo.stats = state.stats ?? exo.stats;
    exo.chain = state.chain ?? [];
    exo._tip = state.chain_tip ?? GENESIS;
    return exo;
  }
}
