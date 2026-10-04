# exoj — Developer Guide

## Code layout

| Path | What it is |
|---|---|
| `core.mjs` | The field model: `Cell`, `ExoJ` class, `canonicalJSON`/`sha256Hex`, `hexDist`/`hexRing`, `normalizeView`. Package main (`"main": "./core.mjs"`). Zero deps beyond `node:crypto`/`node:fs`. |
| `receipts.mjs` | The receipt idiom: `mulberry32` PRNG, `canonicalJSON`, `rowHash`, `sealChain`/`verifyChain` with genesis `EXOJ-RECEIPTS-GENESIS`. Same content addressing as core, so one idiom covers cells, events, and receipt rows. |
| `live.mjs` | Additive live wiring: `EXOJ_LIVE=1` routes JEV emits through the typesafe.ai oracle (`jevNoul` → `noulToEmit`) and field draws through Moth comet-qrng (`mothIntegers`, async job polling); every path degrades to labelled mock/PRNG, never throws. |
| `selflocal.mjs` | Self-localizing observer: claim registry, `attendWeakest` (argmin-noul ranking — attention, not collapse), `foldToFixpoint` (attend → decompose → observe loop), `bypassPool` + `adjudicate` (adversary at the located leaf). |
| `smoke.mjs` | The 3-check smoke CI enforces; the final count line is the contract. |
| `atlas.mjs` | The Atlas Kit CLI + library: `RULES` (pre-registered), `PROTOCOL` (7-move runbook), `sweepDir`, `verifyKit`, `emitCsv`. CLI is main-module-guarded. |
| `atlas-data/` | The wave-66 artifact of record: `corpus.json` (29 works, 6 families), `parts/<family>/<work>.json` (528 parts), `gate-map.json`, `sweep_field.json` (dunnable field shell), `receipts/*.jsonl` (7 ledgers, 106 rows). |
| `atlas-out/` | Committed `csv/` emit of the kit (corpus/parts/gates/ideas/cells). `sweep/` default output dir for re-runs. |
| `gan/` | Wave-69 Unit Table GAN: `unitTable.mjs` (dynamic vector table, snapshot/rewind), `generator.mjs` (Cell 01, moth-style nudges), `validator.mjs` (Cell 02, fail-closed), `scars.mjs` (append-only sha256 scar chain), `die.mjs` (deterministic d20 via HMAC-SHA256), `constants.mjs` (pre-registered, provenance-quoted), `envelope.mjs` (sxc1 envelopes), `demo.mjs` (end-to-end demo → `experiments/outputs/w69_bridge3_demo.json`). |
| `spec/` | `SPEC.md` (wave-69 Track A contract: constants, I1–I7, sxc1, fail-closed codes) + `spec_sha.json` (seal). |
| `tools/` | `spec_seal.mjs` (re-seal SPEC.md sha) and `spec_gate.mjs` (fail-closed gate: `E_SPEC_MISSING/_SHA_MISSING/_SHA_MALFORMED/_DIALECT/_TAMPERED`). |
| `lab/` | Unit batteries run by `npm test`: `gan.test.mjs` (449 lines: GAN, scars, die determinism, envelope parity incl. the cocapn genesis fixture), `live-fallback.test.mjs`, `readme-pin.test.mjs` (pins README's final-state line to the `e40_scratch.json` artifact). |
| `experiments/` | The receipted experiment suite `e_x0`–`e_x8`, POC/challenge drivers (`smoke_exoj.mjs`, `challenge_c4_*`), `jev_backends.mjs` (4 deterministic offline backends), plus `outputs/` holding per-run receipt JSONLs, summaries, and the pinned artifact `e40_scratch.json`. |
| `docs/` | `COG-THESIS.md` (pre-existing) + the wave-69 doc package (this set). |
| `.github/workflows/` | `smoke.yml` (spec gate → npm test → smoke) and `forge.yml` (reusable fleet workflow with `test-cmd: node smoke.mjs`). |

## Core concepts

- **Field / Cell** — the primary object. A hex lattice (axial coords, `hexDist`) of
  cells each carrying `(γ, η, Δ)`, `prob_mass`, `frags`, `programs`, `touched`.
  γ+η soft conservation Σ ≤ 1 is the standing invariant.
- **jevEmit / soft deformation** — a convex soft write `softWrite(g,e,d,α=0.4)` or,
  under `ledger`, a commutative `accumulate()` into `(G,E,D,aSum,n)`; displayed
  amplitudes are the pure aggregate `amps()`. Emits never decide anything definite.
- **observe() — the only collapse** — zeroes the target cell's `prob_mass` and sets a
  `delta_override` that outranks any aggregate. Explicit, recorded, LOCAL.
- **Conservation policy registry** — constructor arg `policy`: `seed` (silent mean
  renorm after every emit, instrumented with collateral stats), `deferred`
  (view-only normalisation via `normalizeView`), `ledger` (commutative; the fleet's
  naturality fix), `refuse` (per-cell boundary 1.0 + 1e-12; refusals counted and
  chained as `kind:'refuse'` rows).
- **Chain / proof object** — every event (`attend`, `deform`, `refuse`, `observe`,
  `program_attach`, plus live `seed`/`localize`/`adversary` rows) is `_push`ed
  through `chainHash(row, prevTip)` = sha256 over canonical JSON; `verifyChain()`
  re-derives from genesis `EXOJ-GENESIS`. `save()`/`load()` round-trip the full chain
  (`exoj-shell-v1`), so any state re-verifies from disk.
- **sxc1 envelope** — the cross-repo state-exchange dialect (`gan/envelope.mjs`):
  fail-closed verify order field → seq → prev → recomputed id → spec_sha; floats
  forbidden; raw-UTF-8 strings allowed; genesis prev = 64×"0".

## How to extend

### Add an experiment (the standard fleet move)

1. Copy the pattern from `experiments/e_x2_conserve_policy.mjs`: define your
   decision rules as constants at the TOP of the file, before any run — the
   lane doctrine is "decision rules before the run", enforced socially and by
   review.
2. Use `mulberry32(seed)` from `receipts.mjs` for any randomness; never
   `Math.random` (replayability is the law).
3. Write receipts to `experiments/outputs/receipts_<exp>.jsonl` (plain JSONL,
   one JSON object per line, `ts` ISO string) and a summary `<exp>_summary.json`.
   Note: `e_x8` additionally chains its receipt rows through an `ExoJ` field to
   produce `ex8_receipt_chain.json` — the strongest pattern.
4. If your experiment imports `atlas.mjs` functions, nothing special is needed;
   the CLI block is main-module-guarded.

### Add a gate kind or sweep rule

Rules live in exactly one place — `RULES` in `atlas.mjs` — and are quoted into
every `gate-map.json` as `rules_pre_registered`. To add R7: edit `RULES`,
implement the branch in `sweepDir`'s per-part loop (where `OPEN/SOFT/HOLE`
verdicts are assigned), then re-run `node atlas.mjs sweep` and reconcile the
new `gate-map.json` with the artifact of record in `atlas-data/gate-map.json`
— the bundled AOR is historical and only `e_x8`-style replays should claim to
match it. Changing rules does NOT retroactively change the wave-66 receipt.

### Add a unit test

Add `lab/<topic>.test.mjs` using `node:test` + `node:assert` (see
`lab/gan.test.mjs` for the house style: named checks, receipts asserted against
committed artifacts). The glob `lab/*.test.mjs` in the `test` script picks it
up automatically; no list to maintain. Green means: all `node --test` checks
pass AND the pinned-artifact checks (readme-pin) still agree with the committed
`experiments/outputs/` files.

### Add a validator invariant (GAN)

1. Write the invariant into `spec/SPEC.md` §3 first (I1–I7 exist; your new one
   becomes I8+), re-seal with `node tools/spec_seal.mjs`, and commit the
   re-seal — the gate makes silent drift loud by design.
2. Implement the check in `gan/validator.mjs` returning a named code from the
   fail-closed vocabulary (SPEC §6); add the code to the vocabulary in SPEC §6
   in the same edit.
3. Pin it with a regression in `lab/gan.test.mjs` (fail-closed direction:
   assert the refusal, not just the acceptance).

### Touch the sxc1 dialect

Do not, without reading `gan/envelope.mjs`'s header and ANTI-ENTROPY-LOG F3.
The dialect exists to keep JS and Python canonical JSON byte-identical with the
cocapn mirror (`json.dumps(sort_keys=True, separators=(",",":"), ensure_ascii=False)`).
Floats are refused; raw UTF-8 strings are the parity-safe way to carry text.
Any change must be cross-checked against the cocapn genesis fixture pinned in
`lab/gan.test.mjs`.

## Testing

```bash
node smoke.mjs              # 3 checks; the count line is CI's contract
npm test                    # node --test lab/*.test.mjs → 28 tests, expect 0 fail
node tools/spec_gate.mjs    # SPEC_GATE OK — run before committing spec-adjacent work
node atlas.mjs verify       # 6 checks over the bundled artifact of record
```

CI (`.github/workflows/smoke.yml`) runs exactly: spec gate → `npm test` →
`node smoke.mjs`, on every push. `forge.yml` delegates to the reusable fleet
workflow with `test-cmd: node smoke.mjs`. "Green" for this repo means all four
command groups above pass; the readme-pin battery additionally guarantees the
README's dog-food numbers never drift from the committed artifact
(`e40_scratch.json`: 39 deformations, 1 observation, prob_open 0.9412).

## Conventions

- **No new dependencies.** Both `core.mjs` and `atlas.mjs` state it in their
  headers; the whole repo runs on `node:crypto` + `node:fs` builtins. If you
  need a dependency for an experiment, isolate it in `experiments/` and say so.
- **Receipts before claims.** Every experiment writes JSONL receipts into
  `experiments/outputs/`; the README numbers cite their artifact of record
  explicitly ("pinned to artifact of record: experiments/outputs/e40_scratch.json").
- **Honest negatives are crown jewels.** The `seed` policy, the NOT_RUN smoke
  verdicts in `atlas-data/receipts/`, and the E-X1 finding all stay in the tree.
  Do not delete or "clean up" a negative.
- **Fail closed, with names.** New failure paths get named codes
  (`E_*`), never bare throws; see `tools/spec_gate.mjs` and `gan/envelope.mjs`.
- **Commit style** (from `git log`): short imperative subjects naming the
  module/bridge ("gan: Wave-69 Bridge 3 — the Unit Table GAN…", "ATLAS KIT:
  wave-66's decomposition method…"). One logical unit per commit; the ANTI-
  ENTROPY-LOG documents the fault and the fix as a pair.
- **Secrets**: env var NAMES only (`TYPESAFEAI_KEY`, `TYPESAFE_KEY`,
  `MOTHQUANTUM_KEY`, `MOTHQUANTUM_BASE`); read at call time; never logged,
  chained, or written. `live.mjs`/`selflocal.mjs` chain hex PREFIXES (16 chars)
  and job ids, never key material.

## Gotchas for editors

- **Editing `spec/SPEC.md`** breaks the seal (`E_SPEC_TAMPERED` in CI). Re-seal
  intentionally and record why (`spec_seal.mjs` writes `resealed_from`).
- **Editing `README.md`'s final-state line** breaks `lab/readme-pin.test.mjs`.
  The line is pinned to the committed artifact; change them together or not at all.
- **`core.mjs` `seed` policy semantics are verbatim-port territory.** The
  collateral-mutation telemetry (`_collateralSnapshot/_collateralDelta`) exists
  to quantify the seed's behaviour; refactoring it away destroys the E-X1/E-X2
  reproducibility.
- **`atlas-data/` is the artifact of record.** Do not regenerate or "tidy" it;
  `atlas.mjs verify` recomputes totals from it and `e_x8` replays against it.
  New sweeps belong in `atlas-out/sweep/` (the default) or an explicit outDir.
- **Chain rows are frozen at push time.** `attachProgram` snapshots the spec
  JSON because the live object's `next` cursor mutates; if you add a new
  mutable cursor to any chain row, snapshot it the same way (this exact bug is
  receipted in the journal, Task 24-a).
- **`canonicalJSON` skips undefined-valued keys.** That is deliberate (JSON
  round-trip semantics); "fixing" it to emit `null` breaks from-disk
  re-verification of saved chains (receipted bug, Task 24-a).
- **Node version**: `node --test` glob form works on node ≥ 18; directory-mode
  invocation does not work on node ≥ 22. CI pins node 22 with the glob form.
