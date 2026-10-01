// exoj/receipts.mjs — local receipt idiom for the exoj lane.
// Same append-only hash-chain discipline as the fleet toolkit
// (quilt-cortex/cortex/receipts.mjs, quilt-murmur/murmur/receipts.mjs),
// but the digest is sha256 over canonical JSON — the SAME content
// addressing the exoj core uses for deformation events, so one idiom
// covers cells, events and receipt rows. No wall-clock inside hashes;
// chains replay byte-identically.

import { createHash } from 'node:crypto';

// Deterministic 32-bit PRNG (mulberry32) — the fleet's offline JEV/world
// driver. Experiments seed it with a fixed integer; no Math.random anywhere.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Canonical JSON: object keys sorted recursively so identical logical
// content always hashes identically regardless of insertion order.
// undefined-valued keys are SKIPPED (matching JSON.stringify round-trip
// semantics) so chains re-verify identically from disk.
export function canonicalJSON(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJSON(value[k])).join(',') + '}';
}

export function sha256Hex(s) {
  return createHash('sha256').update(s).digest('hex');
}

export function rowHash(row, prevHash) {
  const { row_hash, ...rest } = row;
  return sha256Hex(canonicalJSON([prevHash, rest]));
}

export function sealChain(rows, genesis = 'EXOJ-RECEIPTS-GENESIS') {
  let prev = genesis;
  for (const r of rows) { prev = rowHash(r, prev); r.row_hash = prev; }
  return rows;
}

// verifyChain strips the hash so re-derivation matches sealChain exactly.
export function verifyChain(rows, genesis = 'EXOJ-RECEIPTS-GENESIS') {
  let prev = genesis;
  for (const r of rows) {
    if (r.row_hash === undefined) return { ok: false, at: r.seq ?? null, why: 'missing row_hash' };
    const { row_hash, ...rest } = r;
    const want = rowHash(rest, prev);
    if (want !== r.row_hash) return { ok: false, at: r.seq ?? null, why: 'hash mismatch' };
    prev = r.row_hash;
  }
  return { ok: true, links: rows.length };
}
