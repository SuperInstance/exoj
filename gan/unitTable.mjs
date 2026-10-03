// gan/unitTable.mjs — the Unit Table (SPEC §2): a dense, NON-homogeneous
// dynamic vector table. Rows carry an id (string), a Float64Array vector of
// width W, and a positive mass that is heterogeneous BY CONSTRUCTION (seeded
// via a deterministic fnv-ish mass seed — there is NO Math.random anywhere in
// this module or its dependents; all "entropy" is content-derived).
//
// The table is pure state: snapshot()/restore() round-trip byte-identically
// (the rewind substrate, SPEC I6), hash() is content-addressed over a rounded
// canonical form (stable under sub-1e-6 float noise), and proximity() is the
// cosine-similarity metric the validator's I2 boundary is written against.
// Consumers (generator, drifts) NEVER mutate an input table — they build NEW
// instances via clone().

import { canonicalJSON, sha256Hex } from '../core.mjs';

const MAGIC = 'UTBL1'; // snapshot dialect tag: 5 bytes

// Round to 6 decimals for the canonical hash form; normalise -0 → 0 so
// JSON.stringify output is stable across platforms.
const r6 = (x) => {
  const v = Math.round(x * 1e6) / 1e6;
  return v === 0 ? 0 : v;
};

// fnv-1a (32-bit): the deterministic entropy substitute for this lane.
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// Default deterministic mass seed: positive, heterogeneous by construction.
// Range [1, 5.99] is deliberate: it keeps a seeded table's dispersion ≤ ~6 so
// a single generator step (max mass factor 1 + MOTH_AMPLITUDE*0.1 ≈ 1.049 on
// the lightest row) cannot push the I3 dispersion drop past MOTH_AMPLITUDE —
// heterogeneity with headroom for the pre-registered slack (SPEC §1/§3 I3).
export const defaultMassSeed = (id) => 1 + (fnv1a('mass:' + id) % 500) / 100;

function cosine(va, vb) {
  let dot = 0, na = 0, nb = 0;
  for (let j = 0; j < va.length; j++) {
    dot += va[j] * vb[j];
    na += va[j] * va[j];
    nb += vb[j] * vb[j];
  }
  if (na === 0 || nb === 0) return 0;
  const c = dot / Math.sqrt(na * nb);
  return c > 1 ? 1 : c < -1 ? -1 : c; // clamp float drift
}

export class UnitTable {
  // rows: iterable of { id, vec (array-like), mass } — copied defensively.
  constructor(rows) {
    this.rows = (rows ?? []).map((r) => ({
      id: String(r.id),
      vec: Float64Array.from(r.vec),
      mass: r.mass,
    }));
    const w = this.rows.length ? this.rows[0].vec.length : 0;
    for (const r of this.rows) {
      if (typeof r.mass !== 'number' || !Number.isFinite(r.mass) || r.mass <= 0) {
        throw new Error(`UnitTable: row ${r.id} mass must be a positive finite number (got ${r.mass})`);
      }
      if (r.vec.length !== w) throw new Error('UnitTable: all rows must share vector width W');
    }
    this.W = w;
  }

  get length() {
    return this.rows.length;
  }

  // Deterministic constructor: rows is a list of ids (strings or {id}); every
  // vector component and every mass is derived from fnv1a of content — two
  // seeded builds with the same arguments hash identically (tested).
  static seeded({ rows, W = 16, massSeed } = {}) {
    const massFn = typeof massSeed === 'function' ? massSeed : defaultMassSeed;
    const built = (rows ?? []).map((r, i) => {
      const id = typeof r === 'string' ? r : String(r.id);
      const vec = new Float64Array(W);
      for (let j = 0; j < W; j++) {
        vec[j] = (fnv1a(`${id}|v|${j}`) / 4294967296) * 2 - 1; // [-1, 1)
      }
      const mass = massFn(id, i);
      if (typeof mass !== 'number' || !Number.isFinite(mass) || mass <= 0) {
        throw new Error(`UnitTable.seeded: massSeed(${id}) must return a positive finite number (got ${mass})`);
      }
      return { id, vec, mass };
    });
    return new UnitTable(built);
  }

  // Byte-exact snapshot: magic + W + rowCount, then per row (in row order):
  // idLen + id utf8 + mass float64-BE + W × float64-BE. restore() of a
  // snapshot reproduces the same bytes exactly (tested: Buffer.compare === 0).
  snapshot() {
    const W = this.W;
    const n = this.rows.length;
    const idBufs = this.rows.map((r) => Buffer.from(r.id, 'utf8'));
    let size = MAGIC.length + 4 + 4;
    for (const b of idBufs) size += 4 + b.length + 8 + 8 * W;
    const buf = Buffer.alloc(size);
    let o = 0;
    buf.write(MAGIC, o, 'utf8'); o += MAGIC.length;
    buf.writeUInt32BE(W, o); o += 4;
    buf.writeUInt32BE(n, o); o += 4;
    for (let i = 0; i < n; i++) {
      const r = this.rows[i];
      const b = idBufs[i];
      buf.writeUInt32BE(b.length, o); o += 4;
      b.copy(buf, o); o += b.length;
      buf.writeDoubleBE(r.mass, o); o += 8;
      for (let j = 0; j < W; j++) {
        buf.writeDoubleBE(r.vec[j], o); o += 8;
      }
    }
    return buf;
  }

  // Fail-closed inverse of snapshot(): bad magic, truncated payloads, or
  // trailing garbage all throw — a partial rewind must never masquerade as a
  // table.
  static restore(buf) {
    if (!Buffer.isBuffer(buf)) throw new Error('UnitTable.restore: payload must be a Buffer');
    if (buf.length < MAGIC.length + 8 || buf.toString('utf8', 0, MAGIC.length) !== MAGIC) {
      throw new Error('UnitTable.restore: bad snapshot magic');
    }
    let o = MAGIC.length;
    const W = buf.readUInt32BE(o); o += 4;
    const n = buf.readUInt32BE(o); o += 4;
    const rows = [];
    for (let i = 0; i < n; i++) {
      if (o + 4 > buf.length) throw new Error('UnitTable.restore: truncated snapshot (id length)');
      const idLen = buf.readUInt32BE(o); o += 4;
      if (o + idLen + 8 + 8 * W > buf.length) throw new Error('UnitTable.restore: truncated snapshot (row)');
      const id = buf.toString('utf8', o, o + idLen); o += idLen;
      const mass = buf.readDoubleBE(o); o += 8;
      const vec = new Float64Array(W);
      for (let j = 0; j < W; j++) {
        vec[j] = buf.readDoubleBE(o); o += 8;
      }
      rows.push({ id, vec, mass });
    }
    if (o !== buf.length) throw new Error('UnitTable.restore: trailing bytes after snapshot payload');
    return new UnitTable(rows);
  }

  // Content address over the rounded canonical form (SPEC §2). Row order is
  // significant. Sub-1e-6 float noise does not move the hash; a single byte
  // of semantic change does.
  hash() {
    return sha256Hex(canonicalJSON({
      rows: this.rows.map((r) => ({
        id: r.id,
        vecRounded6: Array.from(r.vec, r6),
        massRounded6: r6(r.mass),
      })),
    }));
  }

  // Mean cosine similarity over row vectors matched by id (SPEC I2 metric).
  // The denominator is the UNION of ids: a row missing in either table scores
  // similarity 0, so adding/removing rows moves proximity — presence is part
  // of the semantics. Two empty tables are vacuously identical (1.0).
  proximity(otherTable) {
    const a = new Map(this.rows.map((r) => [r.id, r.vec]));
    const b = new Map(otherTable.rows.map((r) => [r.id, r.vec]));
    const ids = new Set([...a.keys(), ...b.keys()]);
    if (ids.size === 0) return 1;
    let sum = 0;
    for (const id of ids) {
      const va = a.get(id);
      const vb = b.get(id);
      if (va === undefined || vb === undefined) continue; // counts as similarity 0
      sum += cosine(va, vb);
    }
    return sum / ids.size;
  }

  // Max/min row-mass ratio — the I3 non-homogeneity metric. Heterogeneous by
  // construction: a freshly seeded table always has dispersion > 1.
  dispersion() {
    if (this.rows.length === 0) return 0;
    let max = -Infinity, min = Infinity;
    for (const r of this.rows) {
      if (r.mass > max) max = r.mass;
      if (r.mass < min) min = r.mass;
    }
    return max / min;
  }

  totalMass() {
    let s = 0;
    for (const r of this.rows) s += r.mass;
    return s;
  }

  rowById(id) {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  ids() {
    return this.rows.map((r) => r.id);
  }

  // New instance, deep-copied vectors — the ONLY sanctioned base for
  // transformations, so a generator step can never mutate its input.
  clone() {
    return new UnitTable(this.rows.map((r) => ({ id: r.id, vec: Float64Array.from(r.vec), mass: r.mass })));
  }
}
