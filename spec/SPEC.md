# exoj SPEC — Wave-69 Track A: Bridge 3, the Unit Table GAN (dual-cell)

Dialect: `exoj-spec/w69` · Seal: `spec/spec_sha.json` · Gate: `tools/spec_gate.mjs`
Status: PRE-REGISTERED before implementation. Any code that violates an invariant
here is refused at the validator, not argued with after the fact.

## 0. Role in the fleet

exoj is the field substrate: cells on a hex lattice carrying soft amplitudes
(γ crystallisation, η possibility, Δ creativity), JEV soft deformations,
content-addressed sha256-chained proof objects. Wave-69 adds the adversarial
pair that keeps the field honest: a Generator that pushes the table to the edge
of semantic deviation, and a Validator that refuses to compile anything past it.

## 1. Pre-registered constants (provenance receipts)

| Constant          | Value  | Provenance                                             |
|-------------------|--------|--------------------------------------------------------|
| MOTH_PROXIMITY    | 0.798  | quilt-murmur e40_summary.json `a2 = 0.798023`           |
| MOTH_AMPLITUDE    | 0.49   | quilt-murmur e40_summary.json `min = -0.493824` / `rho = 0.495421` |
| SENSOR_LAG_MS     | 3      | directive: deadlocks / 3ms sensor lag trigger the die   |
| DEADLOCK_STEPS    | 12     | generator iterations without table-hash change          |

These are constants, not knobs. Changing them requires a re-seal of this file
and a new wave receipt.

## 2. Module layout (the structural contract)

- `gan/unitTable.mjs` — the dynamic vector table: dense rows, per-row mass,
  non-homogeneous by construction; snapshot/restore (rewind) support.
- `gan/generator.mjs` — Cell 01 (Generator): fractal nudge + scale-down of
  dense regions; target the semantic-deviation boundary at MOTH_PROXIMITY
  with per-step amplitude budget MOTH_AMPLITUDE.
- `gan/validator.mjs` — Cell 02 (Validator): asserts the pre-registered
  invariants (§3) against the table + spec_sha; on violation forces
  status `INDETERMINATE`, registers a sticky scar, refuses compilation.
- `gan/scars.mjs` — the sticky-scar registry: append-only, content-addressed,
  survives rewinds (§3 I6).
- `gan/die.mjs` — deterministic stochasticity: pure-function cryptographic
  d20 roll (HMAC-SHA256 over seed+nonce); fired on deadlock or lag; selects
  a named structural drift from a 20-entry pre-registered table.
- `gan/envelope.mjs` — `sxc1` cell-exchange envelopes (§5).

## 3. Invariants (the validator's law)

- **I1 Conservation** — after any generator step, every touched cell obeys
  the field conservation policy (γ+η+Δ mass not created; policy `refuse`
  semantics: a write past the boundary is refused, counted, chained).
- **I2 Boundary** — table proximity to its pre-step snapshot (cosine
  similarity over the dense vector) must not cross below MOTH_PROXIMITY in
  a single step unless the step was die-driven (a structural drift is
  allowed to cross the boundary; it is then scarred, not refused).
- **I3 Non-homogeneity** — the table's mass dispersion (max/min row mass
  ratio) must not decrease below its pre-step value by more than the
  amplitude budget; homogenising writes are refused (anti-collapse).
- **I4 Fail-closed verdict** — any I1/I3 violation or spec_sha mismatch ⇒
  validator verdict `INDETERMINATE`, sticky scar appended, `compileRefused:
  true`; the generator output never enters the pipeline. I2 crossing is
  scarred-and-allowed only when die-driven; otherwise refused identically.
- **I5 Die determinism** — same seed ⇒ same roll ⇒ same named drift; every
  roll is receipted into the scar/chain (no hidden randomness anywhere).
- **I6 Scars survive rewind** — rewinding the table to any earlier snapshot
  preserves every scar; scars describe history, not state; the scar chain
  hash re-verifies after rewind.
- **I7 Envelope seal** — every emitted `sxc1` envelope binds cell id, kind,
  body, spec_sha, die seed, and prev-envelope id; id = sha256 over the
  canonical form; a receiver must fail closed on any mismatch.

## 4. Cognitive heterogeneity (multi-model cells)

- Cell 01 Generator: optimised for high-prefill, low-latency, concise
  decisions — small payloads, bounded iteration, no meta-commentary.
- Cell 02 Validator: specification-first, meticulous — it re-derives every
  hash, re-reads the spec, and answers only in the verdict vocabulary
  (`COMPILED | INDETERMINATE`) with named codes.
- The two never share tuning state; the only channel between them is the
  table and the verdict (the adversarial boundary).

## 5. State-exchange pathway (sxc1)

`{ v: "sxc1", cell: { id, kind: "generator"|"validator", repo, topology },
   body, seal: { spec_sha, die_seed?, prev, id } }`

- id = sha256("sxc1:" + seq + ":" + prev + ":" + canonicalJSON({cell, body, seal-minus-id}))
- genesis prev = 64×"0"; receivers fail closed: E_SXC_FIELD, E_SXC_SEQ,
  E_SXC_PREV, E_SXC_HASH, E_SXC_SPEC.
- Consumers: cocapn (Python validator mirror), quilt-dba (persistent stitch).

## 6. Fail-closed vocabulary

`E_SPEC_MISSING · E_SPEC_SHA_MISSING · E_SPEC_SHA_MALFORMED · E_SPEC_DIALECT ·
E_SPEC_TAMPERED · E_CONSERVATION · E_BOUNDARY · E_HOMOGENISED · E_DEADLOCK ·
E_LAG · E_SXC_FIELD · E_SXC_SEQ · E_SXC_PREV · E_SXC_HASH · E_SXC_SPEC`
