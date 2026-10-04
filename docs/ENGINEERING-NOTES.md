# exoj — Engineering Notes

## Architecture

Five layers, matching the README's "Architecture (built)" section, plus the
wave-66/69 subsystems. Data flows downward; every arrow that mutates the field
also appends to the chain (the field is the proof object).

```
                ┌──────────────────────────────────────────────────────┐
                │                    exoj core (core.mjs)              │
                │   Field = hex lattice of Cells (γ, η, Δ, prob_mass)  │
                │   policies: seed | deferred | ledger | refuse        │
                └───▲──────────▲───────────────▲───────────────────────┘
                    │ attend   │ jevEmit       │ observe (ONLY collapse)
                    │ (chains) │ (soft write   │ (local prob_mass → 0,
                    │          │  + chain row) │  delta_override, chained)
        ┌───────────┴──┐  ┌────┴─────────┐  ┌──┴──────────┐   ┌──────────────┐
        │ Observer API │  │ JEV emitters │  │ Audit/chain │   │ Persistence  │
        │ attend/      │  │ jev_backends │  │ _push/      │   │ save/load    │
        │ project      │  │ (4 offline)  │  │ verifyChain │   │ exoj-shell-v1│
        │ (read-only)  │  │ live.mjs     │  │ sha256,cJSON│   │ (full chain) │
        └──────────────┘  └──────────────┘  └─────────────┘   └──────────────┘
                │                                            ▲
                │ programs: attachProgram/tick (every/at,     │
                │ fire → jevEmit with α=0.2, chained)        │
                ▼                                            │
   ┌───────────────────────────┐    ┌──────────────────────────┴────────────┐
   │ Atlas Kit (atlas.mjs)     │    │ Wave-69 GAN (gan/)                    │
   │ RULES → sweepDir → field  │    │ generator ⇄ unitTable ⇄ validator     │
   │ walks 29 works × 5 layers │    │      (die on deadlock/lag; scars;     │
   │ → gate-map.json + field   │    │       sxc1 envelopes → cocapn (Py)    │
   │ csv emit → atlas-out/csv  │    │       verify → quilt-dba stitch)      │
   └───────────────────────────┘    └───────────────────────────────────────┘
```

Component notes, from the code: `core.mjs` is the substrate (~418 lines, zero
deps). `receipts.mjs` re-exports the same canonical-JSON chain idiom used by
quilt-cortex and quilt-murmur, so receipt rows and cell events hash identically.
`live.mjs` and `selflocal.mjs` are strictly additive — they use the field's own
`_push` for provenance rows (`seed`, `localize`, `adversary`) and never edit
cell state except through the public emit/observe API. The atlas sweep instantiates
one `ExoJ('atlas-gatesweep', 6, 'ledger')` field and walks works sorted by
(family, work) at column `q=(i%7)-3`, layers 0–4 at rows `r=L-2`.

## Invariants

Where each is enforced:

- **I-conservation (Σ ≤ 1)** — `core.mjs` per policy: `seed` renorms the view
  after every emit; `ledger` aggregates α-weighted writes at sense time
  (`normalizeView`); `refuse` rejects writes with post-Σ > 1.0 + 1e-12
  (`jevEmit` boundary branch). Enforced/quantified in `lab/` tests; the readme
  battery asserts max_cell_Σ ≤ 1 + 1e-9 on the committed artifact.
- **I-non-collapse** — only `ExoJ.observe()` writes `prob_mass = 0` or sets
  `delta_override`. `attend`, `project`, `attendWeakest` are read-only or
  chain-only. Enforced socially + by `lab/live-fallback.test.mjs`
  ("nothing collapsed by wiring").
- **I-chain-integrity** — `verifyChain()` re-derives every `row_hash` from
  genesis `EXOJ-GENESIS`; `save()`/`load()` preserve the full chain so any
  shell re-verifies from disk. `atlas.mjs verify` runs it on the bundled
  sweep field (606 links, tip `13463fd0…`).
- **SPEC I1–I7** (wave-69, `gan/`) — conservation, boundary (MOTH_PROXIMITY
  0.798 unless die-driven), non-homogeneity, fail-closed verdicts, die
  determinism (same seed ⇒ same roll), scars-survive-rewind, envelope seal.
  Enforced by `gan/validator.mjs` + `gan/envelope.mjs`, pinned by
  `lab/gan.test.mjs`.
- **Spec seal** — `tools/spec_gate.mjs` compares live sha256 of SPEC.md against
  `spec/spec_sha.json`; mismatch ⇒ `E_SPEC_TAMPERED`, CI stops.
- **Pre-registration** — atlas `RULES` are module constants quoted into every
  gate-map; experiments define verdict rules before running (lane doctrine).

## Failure modes & blast radius

- **Spec tamper / drift** — spec gate fails closed (`E_SPEC_*`); blast radius:
  CI red, nothing else. Fix path is the documented re-seal.
- **Envelope mismatch** (`E_SXC_FIELD/SEQ/PREV/HASH/SPEC`) — receiver refuses;
  blast radius contained to one message. A naive tamper dies at layer 4
  (content-addressed id); a consistently re-sealed forgery with a malformed
  spec_sha dies at layer 5.
- **Live oracle outage** — `live.mjs` never throws; every result carries
  `source` ∈ {live, mock, prng, fallback:<why>} and the fallback reason is
  chained (`fallback_why`). Blast radius: a run quietly degrades — which is
  why the label is mandatory and pinned by tests.
- **Moth job lag/flake** — `selflocal.adjudicate` retries the draw twice
  before degrading to mulberry32; `mothIntegers` polls with a 90s timeout.
- **Node version drift** — directory-mode `node --test` breaks on node ≥ 22
  (ANTI-ENTROPY-LOG F1); glob form is the contract. Blast radius was: silent
  absence of tests; now CI runs the glob form.
- **Chain corruption** — any mutated row makes `verifyChain` report
  `{ok:false, at:seq, why:'hash mismatch'}`; the atlas sweep throws if its own
  chain fails. There is no repair path by design: chains are evidence.
- **Off-lattice writes** — fold to origin (seed compat). Silent by design;
  the `frag` hash still records the original intended coords in the event row.

## Performance & cost envelope

- All packaged paths are offline and free: no network calls, no LLM calls, no
  services. The atlas sweep over the full bundled corpus (29 works, 528 parts)
  completes in seconds on a laptop-class machine and produces a 606-link chain
  (measured during wave-69 verification: `sweep` ran alongside `verify` in the
  same command batch; individual timing not separately receipted — labeled
  estimate, not a measurement).
- `npm test`: 28 tests, ~200 ms (node's own duration output: 201.33 ms),
  receipted in this tree's wave-69 verification run.
- Memory: the field holds one chain row per event plus one cell per lattice
  point (radius 4 → 61 cells; radius 6 → 127). Experiments at radius 5–6 are
  the norm; nothing here is tuned for very long chains (10⁶+ rows untested).
- Live mode costs are external: one typesafe.ai call per JEV emit (30 s
  timeout, 1 retry with exponential backoff) and one async Moth job per draw
  (poll every 3 s, 90 s timeout). No measured dollar figures exist in receipts;
  do not invent any.

## Operations

- **Local**: the commands in USER-GUIDE; nothing else needed. Node ≥ 18; CI
  pins node 22.
- **CI**: `.github/workflows/smoke.yml` — spec gate → `npm test` → smoke, on
  push/workflow_dispatch. `forge.yml` delegates to the fleet's reusable forge
  workflow (`SuperInstance/quilt-forge`) with `test-cmd: node smoke.mjs`.
- **Credentials model**: `TYPESAFEAI_KEY` (or `TYPESAFE_KEY`) for the live JEV
  oracle; `MOTHQUANTUM_KEY` + `MOTHQUANTUM_BASE` for comet-qrng; optional
  `EXOJ_JEV_URL` override. Env var names only anywhere in the tree; values are
  read at call time and never logged, chained, or written (stated in the
  `live.mjs` header and honoured by `selflocal.mjs`, which chain only hex
  prefixes and job ids). The push history (journal Task 68-a) keeps keys hot on
  local disk in gitignored `.env*` files, unreachable by git.
- **Repos operated as**: clone → verify → extend → receipt → commit; push is
  the keeper's job (wave-68 push wave receipted the current remote state).

## Design decisions & why

1. **Four conservation policies instead of one** (E-X1/E-X2, journal Task 24-a
   and follow-ups). The seed's own `_norm()` violated the parallel-first axiom
   (divergence 0.600 across write orders); the commutative `ledger` policy
   reaches 2.2e-16 and `refuse` makes the boundary loud. Keeping the seed
   policy as an instrumented honest negative makes every claim replayable —
   deleting it would erase the evidence.
2. **The field is the proof object** (content-addressed chain in-core, not a
   side log). Trade-off: slightly heavier state files (`exoj-shell-v1` carries
   the full chain), in exchange for "state provable from its own chain", which
   the seed's silent renorm made impossible (E-X2: chain-replay divergence
   exactly 0 vs seed's 0.218).
3. **Atlas rules as module constants** (`RULES` in `atlas.mjs`), not config.
   Decision rules ride with the executable, so the pre-registration survives
   any clone; the AOR quotes them into every gate-map. Trade-off: changing
   rules means a code edit, which is exactly the friction the discipline wants.
4. **sxc1 forbids floats** (gan/envelope.mjs header, ANTI-ENTROPY-LOG F3).
   JS and Python float formatting differs; integers are parity-safe. The first
   guard over-reached (banned non-ASCII) and broke the cocapn fixture — it was
   narrowed to the pre-registered rule and the parity is now pinned both
   directions in `lab/gan.test.mjs`.
5. **Deterministic die instead of hidden randomness** (`gan/die.mjs`): deadlock
   or sensor lag fires an HMAC-SHA256 d20; same seed ⇒ same named drift, every
   roll receipted. Trade-off: adversarial predictability, accepted because the
   threat model is entropy in the experiment, not secrecy from an attacker.
6. **Fail-closed validators that answer only `COMPILED | INDETERMINATE`**
   (`gan/validator.mjs`): the generator's output never enters the pipeline when
   `compileRefused` is true. Trade-off: throughput sacrificed for the property
   that a validator can never be argued with after the fact.
