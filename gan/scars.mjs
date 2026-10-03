// gan/scars.mjs — the sticky-scar registry (SPEC §2, I4, I6): append-only,
// content-addressed, sha256-chained from genesis. A scar is a permanent
// historical record: "at table state X, code Y fired". Scars describe
// HISTORY, not state — the registry is completely INDEPENDENT of any table
// snapshot/restore. Rewinding a UnitTable to an earlier snapshot deletes
// nothing here; the chain re-verifies after any rewind (SPEC I6, tested).
//
// Hash discipline mirrors core.mjs chainHash style:
//   id = sha256Hex(canonicalJSON([prev, { seq, kind, note, atTableHash, dieRoll? }]))
// with genesis prev = 64 × '0'. dieRoll, when present, is a receipt object
// ({roll, raw, nonce, ...}) produced by gan/die.mjs — no hidden randomness.
//
// REWIND IS NON-DESTRUCTIVE HERE — rewindIsNonDestructive() documents and
// asserts the invariant: this registry exposes no delete, no truncate, no
// rewrite. Never deletes data. Tampering a row (any field) breaks verify()
// at that row, fail-closed, with the offending seq localized.

import { canonicalJSON, sha256Hex } from '../core.mjs';

export const GENESIS64 = '0'.repeat(64);

function payloadOf(row) {
  // canonicalJSON drops undefined object keys, but we build the payload
  // explicitly so verify() re-derives byte-identical forms.
  const p = { seq: row.seq, kind: row.kind, note: row.note, atTableHash: row.atTableHash };
  if (row.dieRoll !== undefined) p.dieRoll = row.dieRoll;
  return p;
}

export class StickyScarRegistry {
  constructor() {
    this._rows = [];
    this._tip = GENESIS64;
  }

  // Append one scar; returns the sealed row. atTableHash ties the scar to the
  // table state it describes (usually hash() of the refused / crossed table).
  scar(kind, note, atTableHash, dieRoll) {
    const row = {
      seq: this._rows.length + 1,
      kind: String(kind),
      note: String(note),
      atTableHash: String(atTableHash),
      prev: this._tip,
    };
    if (dieRoll !== undefined) row.dieRoll = dieRoll;
    row.id = sha256Hex(canonicalJSON([row.prev, payloadOf(row)]));
    this._rows.push(row);
    this._tip = row.id;
    return row;
  }

  // Live view (treat as read-only). Returning the internal rows is what makes
  // tamper-testing honest: mutating a returned row mutates history, and
  // verify() must catch it.
  rows() {
    return this._rows;
  }

  size() {
    return this._rows.length;
  }

  tip() {
    return this._tip;
  }

  // Scars attached to a given table hash — how the validator (SPEC I4) checks
  // that a die-driven I2 boundary crossing was actually receipted.
  scarAt(tableHash) {
    return this._rows.filter((r) => r.atTableHash === tableHash);
  }

  // Re-derive the whole chain from genesis; localize any break.
  verify() {
    let prev = GENESIS64;
    for (const row of this._rows) {
      if (row.prev !== prev || row.id !== sha256Hex(canonicalJSON([prev, payloadOf(row)]))) {
        return { ok: false, at: row.seq ?? null };
      }
      prev = row.id;
    }
    return { ok: true, tip: prev, count: this._rows.length };
  }

  // SPEC I6 documentation-as-code: rewinding a table snapshot never touches
  // this registry — there is no operation here that can delete or rewrite a
  // scar. Scars survive every rewind, by construction and by test.
  rewindIsNonDestructive() {
    return true;
  }
}
