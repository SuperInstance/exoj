// gan/validator.mjs — Cell 02 (Validator) of the Unit Table GAN (SPEC §3, §4):
// cognitive profile "specification-first, meticulous" — it re-derives every
// metric, reads the pre-registered law, and answers ONLY in the verdict
// vocabulary (`COMPILED | INDETERMINATE`) with named fail-closed codes.
//
//   (a) SPEC I4 gate  — specSha present + 64-hex, else E_SXC_SPEC and the
//       validator stops reading: an unverified law verifies nothing.
//   (b) SPEC I1       — conservation: every next-table row mass > 0 and
//                       totalMass(next) <= totalMass(prev) * 1.0001 (mass not
//                       created), else E_CONSERVATION.
//   (c) SPEC I2       — boundary: proximity(prev, next) >= MOTH_PROXIMITY
//                       UNLESS the step was die-driven; a die-driven crossing
//                       is allowed but MUST be scarred (a scar row whose
//                       atTableHash is the next table's hash) — an unscarred
//                       die-driven crossing is E_BOUNDARY too.
//   (d) SPEC I3       — non-homogeneity: dispersion(next) >=
//                       dispersion(prev) - MOTH_AMPLITUDE, else E_HOMOGENISED.
//
// I4: ANY code ⇒ verdict INDETERMINATE + compileRefused: true. THE GENERATOR'S
// OUTPUT NEVER ENTERS THE PIPELINE WHEN compileRefused IS TRUE — the caller
// must discard nextTable and keep prevTable. enforce() additionally appends
// one sticky scar per code (the refusal is counted and chained, never silent).
// The two cells share no tuning state: the only channel between them is the
// table and the verdict — the adversarial boundary (SPEC §4).

import { MOTH_PROXIMITY, MOTH_AMPLITUDE } from './constants.mjs';

const HEX64 = /^[0-9a-f]{64}$/;
// float guard on the conservation sum — the exact line needs headroom, same
// discipline as core.mjs's refuse policy (1e-12 there, pre-registered 1.0001 here)
const MASS_CREATED_TOLERANCE = 1.0001;

export function validate(prevTable, nextTable, ctx = {}) {
  // (a) the spec gate comes first and short-circuits: fail-closed
  if (typeof ctx.specSha !== 'string' || !HEX64.test(ctx.specSha)) {
    return { verdict: 'INDETERMINATE', codes: ['E_SXC_SPEC'], compileRefused: true };
  }

  const codes = [];

  // (b) SPEC I1 conservation
  let massesPositive = true;
  for (const r of nextTable.rows) {
    if (!(r.mass > 0)) { massesPositive = false; break; }
  }
  if (!massesPositive || nextTable.totalMass() > prevTable.totalMass() * MASS_CREATED_TOLERANCE) {
    codes.push('E_CONSERVATION');
  }

  // (c) SPEC I2 boundary (die-driven crossings must be scarred)
  if (prevTable.proximity(nextTable) < MOTH_PROXIMITY) {
    const scarred = ctx.dieDriven === true && !!ctx.scars &&
      ctx.scars.rows().some((r) => r.atTableHash === nextTable.hash());
    if (!scarred) codes.push('E_BOUNDARY');
  }

  // (d) SPEC I3 non-homogeneity (no die exemption — the die is not a licence
  // to homogenise; only I2 crossings are scarred-and-allowed)
  if (nextTable.dispersion() < prevTable.dispersion() - MOTH_AMPLITUDE) {
    codes.push('E_HOMOGENISED');
  }

  return codes.length === 0
    ? { verdict: 'COMPILED', codes: [], compileRefused: false }
    : { verdict: 'INDETERMINATE', codes, compileRefused: true };
}

// validate + scar: appends one sticky scar per code to ctx.scars, keyed to the
// refused table's hash, and returns the verdict unchanged. Callers MUST treat
// compileRefused === true as "nextTable never entered the pipeline".
export function enforce(prevTable, nextTable, ctx = {}) {
  const verdict = validate(prevTable, nextTable, ctx);
  if (verdict.compileRefused && ctx.scars) {
    for (const code of verdict.codes) {
      ctx.scars.scar(code, `validator refused compilation (${code})`, nextTable.hash());
    }
  }
  return verdict;
}
