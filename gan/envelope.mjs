// gan/envelope.mjs — sxc1 cell-exchange envelopes (SPEC §5, I7).
//
// envelope = {
//   v: "sxc1", seq: <positive int>,
//   cell: { id: str, kind: "generator"|"validator", repo: str, topology: str },
//   body: <object>,
//   seal: { spec_sha: <64hex>, die_seed?: <64hex>, prev: <64hex>, id: <64hex> }
// }
//
// id = sha256Hex("sxc1:" + seq + ":" + prev + ":" + canonicalJSON({cell, body, seal: sealWithoutId}))
// canonicalJSON is core.mjs's (recursive key-sorted, no whitespace) — the
// exact same function the Python mirror in cocapn implements as
// json.dumps(sort_keys=True, separators=(",", ":"), ensure_ascii=False).
// genesis prev = "0".repeat(64).
//
// DIALECT RESTRICTION (cross-language hash parity — CRITICAL): body and cell
// carry strings, integers, booleans, null, arrays, and nested objects ONLY.
// NO FLOATS anywhere: JS JSON.stringify and Python json.dumps format floats
// differently (0.5 vs 0.5, but 1e21, trailing precision, repr strategies), so
// a single float would break cross-repo verification. Strings are restricted
// to printable ASCII for the same reason (JS does not \u-escape non-ASCII,
// Python's ensure_ascii does). Numbers must be safe integers. Envelopes carry
// table_hash (hex), counts, verdicts, named drifts — NOT raw float vectors.
// The guard is enforced fail-closed at BOTH emit and verify (E_SXC_FIELD).
//
// Verify order is fail-closed and pre-registered:
//   1. field lattice   → E_SXC_FIELD
//   2. seq             → E_SXC_SEQ
//   3. prev            → E_SXC_PREV
//   4. recomputed id   → E_SXC_HASH
//   5. spec_sha        → E_SXC_SPEC
// A NAIVE spec_sha tamper is caught at layer 4 (the seal is content-addressed);
// a consistently RE-SEALED envelope with a malformed spec_sha is what layer 5
// exists to catch. Receivers fail closed on any mismatch (SPEC I7).

import { canonicalJSON, sha256Hex } from '../core.mjs';

export const GENESIS_PREV = '0'.repeat(64);

const HEX64 = /^[0-9a-f]{64}$/;
const KINDS = ['generator', 'validator'];
const SEAL_KEYS = ['spec_sha', 'die_seed', 'prev', 'id'];
const SEAL_REQUIRED = ['spec_sha', 'prev', 'id'];

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Dialect guard: walk a value tree; collect violations of the sxc1 value
// grammar. Used at emit (throws) and verify (E_SXC_FIELD).
function guardDialect(value, path, errs) {
  if (value === null) return;
  const t = typeof value;
  if (t === 'string') {
    if (!/^[\x20-\x7E]*$/.test(value)) errs.push(`${path}: non-ASCII string (cross-language parity)`);
    return;
  }
  if (t === 'boolean') return;
  if (t === 'number') {
    if (!Number.isSafeInteger(value)) errs.push(`${path}: float/unsafe number (floats are forbidden in sxc1)`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => guardDialect(v, `${path}[${i}]`, errs));
    return;
  }
  if (t === 'object') {
    for (const [k, v] of Object.entries(value)) guardDialect(v, `${path}.${k}`, errs);
    return;
  }
  errs.push(`${path}: forbidden value of type ${t}`);
}

// The pre-registered id derivation, exported for mirrors and re-seal tests:
// id = sha256("sxc1:" + seq + ":" + prev + ":" + canonicalJSON({cell, body, seal}))
// where `seal` here is the seal WITHOUT its id field.
export function envelopeId({ seq, prev, cell, body, seal }) {
  return sha256Hex('sxc1:' + seq + ':' + prev + ':' + canonicalJSON({ cell, body, seal }));
}

function checkCellShape(cell, errs) {
  if (!isPlainObject(cell)) { errs.push('cell: must be an object'); return; }
  const keys = Object.keys(cell).sort();
  if (keys.join(',') !== 'id,kind,repo,topology') errs.push('cell: must have exactly id/kind/repo/topology');
  for (const k of ['id', 'kind', 'repo', 'topology']) {
    if (typeof cell[k] !== 'string') errs.push(`cell.${k}: must be a string`);
  }
  if (cell.kind !== undefined && !KINDS.includes(cell.kind)) errs.push(`cell.kind: ${JSON.stringify(cell.kind)} is not generator|validator`);
}

// Build + seal an envelope. Fail-closed at the producer: bad seq/prev/cell/
// spec_sha shapes, floats, or non-ASCII strings throw E_SXC_FIELD-named
// errors before anything is sealed.
export function emit({ seq, prev, cell, body, seal }) {
  const errs = [];
  if (!Number.isInteger(seq) || seq < 1) errs.push('seq: must be a positive integer');
  if (typeof prev !== 'string' || !HEX64.test(prev)) errs.push('prev: must be 64-hex');
  checkCellShape(cell, errs);
  if (!isPlainObject(body)) errs.push('body: must be an object');
  if (!isPlainObject(seal)) errs.push('seal: must be an object');
  else {
    if (typeof seal.spec_sha !== 'string' || !HEX64.test(seal.spec_sha)) errs.push('seal.spec_sha: must be 64-hex');
    if (seal.die_seed !== undefined && (typeof seal.die_seed !== 'string' || !HEX64.test(seal.die_seed))) {
      errs.push('seal.die_seed: must be 64-hex when present');
    }
  }
  if (isPlainObject(cell)) guardDialect(cell, 'cell', errs);
  if (isPlainObject(body)) guardDialect(body, 'body', errs);
  if (errs.length) throw new Error(`E_SXC_FIELD: ${errs.join('; ')}`);

  const sealWithoutId = { spec_sha: seal.spec_sha, prev };
  if (seal.die_seed !== undefined) sealWithoutId.die_seed = seal.die_seed;
  const id = envelopeId({ seq, prev, cell, body, seal: sealWithoutId });
  return { v: 'sxc1', seq, cell, body, seal: { ...sealWithoutId, id } };
}

// Fail-closed receiver, in the pre-registered order (see header). Returns
// { ok: true, id } or { ok: false, code, at: seq }.
export function verifyEnvelope(env, { expectedSeq, expectedPrev } = {}) {
  const fail = (code) => ({ ok: false, code, at: isPlainObject(env) && Number.isInteger(env.seq) ? env.seq : null });

  // 1. field lattice — unknown/missing keys, wrong shapes, bad kinds
  if (!isPlainObject(env)) return fail('E_SXC_FIELD');
  if (Object.keys(env).sort().join(',') !== 'body,cell,seal,seq,v') return fail('E_SXC_FIELD');
  if (env.v !== 'sxc1') return fail('E_SXC_FIELD');
  if (!isPlainObject(env.body)) return fail('E_SXC_FIELD');
  if (!isPlainObject(env.seal)) return fail('E_SXC_FIELD');
  const cellErrs = [];
  checkCellShape(env.cell, cellErrs);
  if (cellErrs.length) return fail('E_SXC_FIELD');
  for (const k of Object.keys(env.seal)) {
    if (!SEAL_KEYS.includes(k)) return fail('E_SXC_FIELD');
  }
  for (const k of SEAL_REQUIRED) {
    if (!Object.keys(env.seal).includes(k)) return fail('E_SXC_FIELD');
  }
  if (env.seal.die_seed !== undefined && (typeof env.seal.die_seed !== 'string' || !HEX64.test(env.seal.die_seed))) {
    return fail('E_SXC_FIELD');
  }
  const dialectErrs = [];
  guardDialect(env.cell, 'cell', dialectErrs);
  guardDialect(env.body, 'body', dialectErrs);
  if (dialectErrs.length) return fail('E_SXC_FIELD');

  // 2. seq — positive integer, and equal to the expectation when given
  if (!Number.isInteger(env.seq) || env.seq < 1) return fail('E_SXC_SEQ');
  if (expectedSeq !== undefined && env.seq !== expectedSeq) return fail('E_SXC_SEQ');

  // 3. prev — 64-hex chain link, equal to the expectation/tip when given
  if (typeof env.seal.prev !== 'string' || !HEX64.test(env.seal.prev)) return fail('E_SXC_PREV');
  if (expectedPrev !== undefined && env.seal.prev !== expectedPrev) return fail('E_SXC_PREV');

  // 4. recomputed id — the seal is content-addressed
  const sealWithoutId = { spec_sha: env.seal.spec_sha, prev: env.seal.prev };
  if (env.seal.die_seed !== undefined) sealWithoutId.die_seed = env.seal.die_seed;
  const want = envelopeId({ seq: env.seq, prev: env.seal.prev, cell: env.cell, body: env.body, seal: sealWithoutId });
  if (env.seal.id !== want) return fail('E_SXC_HASH');

  // 5. spec_sha — present and 64-hex (catches consistently re-sealed forgeries
  // with a malformed spec; a naive tamper already died at layer 4)
  if (typeof env.seal.spec_sha !== 'string' || !HEX64.test(env.seal.spec_sha)) return fail('E_SXC_SPEC');

  return { ok: true, id: env.seal.id };
}
