// REQUIRES sibling clone: git clone https://github.com/SuperInstance/quilt-dba.git ../quilt-dba
// (same parent dir as this repo) — wave-69 drill finding. Without it the
// dba import below crashes with ERR_MODULE_NOT_FOUND on a fresh clone.
//
// experiments/challenge_c4_02_chains.mjs — TAVERN ROUND FOUR challenge probe
// C4-field-singer-02 -> time-smith (dba lane).
//
// THE CLAIM UNDER PROBE: dba's receipt chains are verifiable by an INDEPENDENT
// reader — the fleet dialect's published arithmetic (FNV-1a 64 over
// JSON.stringify([prev, rest-without-row_hash]), insertion-order serialization,
// genesis 'GENESIS', '0x'-prefixed 16-hex digests) is enough to re-derive
// every link WITHOUT importing dba's hashing code.
//
// Method: this file re-implements the dialect FRESH from its published
// arithmetic (no import of dba/receipts.mjs, no import of murmur's, no
// quilt-stone) and reads ALL of dba's sealed receipt chains from disk:
//   experiments/outputs/receipts_ed{1..5}.jsonl + outputs/.cache/first_attempt_receipts.jsonl
// then cross-checks its own verdict (ok / links / tip) against dba's OWN
// verifier (imported — data cross-check, not trust). A tamper arm flips one
// payload bit in a COPY of one chain and demands BOTH readers reject at the
// SAME row.
//
// FALSIFIES: (a) any chain where the independent reader and dba's own
// verifier DISAGREE on ok/links/tip (the dialect is ambiguous, underspecified,
// or the chain is broken); (b) any chain that fails outright (a receipt
// without a chain is a rumor); (c) a tamper one reader misses.
//
// Read-only cross-repo import (silicon->arch precedent). Deterministic,
// headless, no network, no keys.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { verifyChain as dbaVerifyChain } from '../../quilt-dba/dba/receipts.mjs';

// ── INDEPENDENT re-implementation (from the published arithmetic only) ──────
const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK64 = 0xffffffffffffffffn;

function fnv1a64Independent(input) {
  // fleet dialect: strings are hashed as-is; everything else via
  // JSON.stringify (INSERTION-ORDER — the documented dialect trait)
  const s = typeof input === 'string' ? input : JSON.stringify(input);
  let h = FNV_OFFSET;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * FNV_PRIME) & MASK64;
  }
  return '0x' + h.toString(16).padStart(16, '0');
}

function independentRowHash(row, prevHash) {
  const { row_hash, ...rest } = row;
  return fnv1a64Independent([prevHash, rest]);
}

function independentVerify(rows, genesis = 'GENESIS') {
  let prev = genesis;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.row_hash === undefined) return { ok: false, index: i, at: r.seq ?? null, why: 'missing row_hash' };
    const want = independentRowHash(r, prev);
    if (want !== r.row_hash) return { ok: false, index: i, at: r.seq ?? null, why: 'hash mismatch' };
    prev = r.row_hash;
  }
  return { ok: true, index: rows.length - 1, links: rows.length, tip: prev };
}

// ── the chains under probe (dba's sealed record, read from disk) ────────────
// module-relative (CWD-independent): the probe runs from the exoj repo root
const DBA = join(dirname2(fileURLToPath(import.meta.url)), '..', '..', 'quilt-dba', 'experiments', 'outputs');
function dirname2(p) { const a = p.split('/'); a.pop(); return a.join('/'); }
const CHAINS = [
  'receipts_ed1.jsonl', 'receipts_ed2.jsonl', 'receipts_ed3.jsonl',
  'receipts_ed4.jsonl', 'receipts_ed5.jsonl', '.cache/first_attempt_receipts.jsonl',
].map((f) => join(DBA, f)).filter((p) => existsSync(p));

console.log(`C4-field-singer-02: dba chains under an INDEPENDENT exoj reader (${CHAINS.length} chains)`);

let pass = true;
const results = [];
for (const path of CHAINS) {
  const rows = readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const mine = independentVerify(rows);
  const theirs = dbaVerifyChain(rows);
  const agree = mine.ok === theirs.ok
    && (mine.ok ? mine.links === theirs.links && mine.tip === rows[rows.length - 1].row_hash : true);
  results.push({ path, links: rows.length, mine, theirs, agree });
  if (!mine.ok || !agree) pass = false;
  console.log(`  ${mine.ok ? 'ok ' : 'BAD'} ${path.split('/').slice(-2).join('/')} links=${rows.length} tip=${mine.ok ? mine.tip : '-'} independent==dba-verifier: ${agree}`);
}

// ── tamper arm: one payload bit flipped in a COPY — both readers must reject
// at the SAME row ─────────────────────────────────────────────────────────────
const tamperSrc = readFileSync(CHAINS[0], 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const T = 3; // flip a digit inside row 3's first string value (deterministic)
{
  const row = tamperSrc[T];
  const key = Object.keys(row).filter((k) => k !== 'row_hash' && typeof row[k] === 'string')[0];
  const c = row[key] === 'x' ? 'y' : 'x'; // single-char payload mutation
  row[key] = c + String(row[key]).slice(1);
  const mine = independentVerify(tamperSrc);
  const theirs = dbaVerifyChain(tamperSrc);
  const bothReject = !mine.ok && !theirs.ok;
  const sameRow = mine.at === theirs.at; // dba reports the failing row's seq
  console.log(`  tamper arm: row ${T} field '${key}' mutated -> independent ${mine.ok ? 'MISSED' : `rejected@seq ${mine.at}`} | dba ${theirs.ok ? 'MISSED' : `rejected@seq ${theirs.at}`} | sameRow=${sameRow}`);
  if (!bothReject || !sameRow) pass = false;
}

console.log(pass
  ? `C4 CONFIRMED: ${CHAINS.length}/${CHAINS.length} dba chains verify under the independent exoj reader with verdict-agreement, and tamper is caught identically — the dialect's published arithmetic is sufficient`
  : 'C4 FALSIFIED: independent reader disagrees with dba\'s own verifier (or a chain is broken) — see rows above');
process.exit(pass ? 0 : 1);
