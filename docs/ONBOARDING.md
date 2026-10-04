# exoj — Agent Onboarding
> Zero-shot entry point. Clone → competent in ~10 minutes.

## Identity (2 sentences)

exoj is the fleet's **ExoJ** implementation: a non-collapsing, spreadsheet-native
reasoning surface — cells on a hex lattice carrying soft amplitudes (γ
crystallisation, η possibility, Δ creativity) — that an agent treats as
external vectorized scratch-paper. A JEV emits soft deformations into the
field; observation (collapse) is an explicit, recorded, LOCAL act; every
deformation is content-addressed into a sha256-chained proof object, so the
field itself is the receipt.

## Why it exists (the fleet problem it solves)

The seed charter (quoted verbatim at the top of README.md and immutable) asks a
category-theoretic question: what if the primary object of reasoning is a
parallel relational field, and every sequential log ("chain of thought") is a
derived right Kan extension? Chain-of-thought forces every intermediate into a
definite term; ExoJ records a chain-of-probabilities that stays open until the
agent deliberately observes. Built in wave-24 lane (Task ID 24-a, JS port of
the seed's `exoj_core.py`), extended in wave-66 with the **Atlas Kit**
(`atlas.mjs`, Task IDs 66-b/66-g/66-i): the decomposition method that turned 29
fleet works into 528 elementary parts, 401 gates, and 127 holes — executed by
jevs walking the layers, and re-runnable by a fresh instance with zero agents
(E-X8). Wave-69 added the adversarial pair (`gan/`) that keeps the field
honest: a Generator pushing the table to the edge of semantic deviation and a
specification-first Validator that refuses anything past it.

## Verify it works (exact commands)

All commands below were executed against this tree during wave-69 and pass.
Node ≥ 18 (CI uses node 22); **no npm dependencies, no network, no keys** for
anything except `live.mjs`/`selflocal.mjs` live modes.

```bash
node smoke.mjs                 # SMOKE OK (3/3 checks) — the repo's first receipt
npm test                       # node --test lab/*.test.mjs → 28 pass, 0 fail
node tools/spec_gate.mjs       # SPEC_GATE OK 9bf3eb90… — spec is sealed + untampered
node atlas.mjs verify          # 6/6 PASS — the wave-66 artifact of record re-verifies
node atlas.mjs protocol        # prints the 7-move decomposition runbook (free)
```

Live-oracle modes are OPTIONAL and need credentials you will not have:

```bash
# Requires TYPESAFEAI_KEY (or TYPESAFE_KEY) in env; Moth quantum draws also need
# MOTHQUANTUM_KEY + MOTHQUANTUM_BASE. With EXOJ_LIVE=1 and no keys, live.mjs
# DEGRADES to labelled mock/PRNG paths (source: 'mock' | 'prng') — it never
# throws and never presents a mock as live. Proof it ran live is in the journal
# and in experiments/outputs/x4_field_live-ledger.json (receipted wave runs).
EXOJ_LIVE=1 node experiments/e_x4_livejev.mjs
```

Two more env vars exist, both optional — keyless runs degrade gracefully
(wave-69 drill finding): `EXOJ_JEV_URL` (JEV oracle endpoint override, read by
`live.mjs` and `selflocal.mjs`) and `MOTH_KEY` (read by
`experiments/moth_bits.mjs`).

## Reading order (paths, not vibes)

1. `README.md` — the immutable seed charter (category theory), the POC tables,
   the lane doctrine (decision rules before the run), the wave-69 GAN section,
   and the Atlas Kit section. Long, but everything else keys off it.
2. `core.mjs` — the whole field model in ~420 lines: Cell, four conservation
   policies (`seed`/`deferred`/`ledger`/`refuse`), `jevEmit`, `observe`,
   programs, `sense`, `project`, save/load, the chain.
3. `atlas.mjs` — the wave-66 method as an executable (`RULES` = pre-registered
   sweep rules; `PROTOCOL` = the 7-move runbook).
4. `spec/SPEC.md` + `spec/spec_sha.json` — the wave-69 pre-registered contract
   (constants with provenance, invariants I1–I7, sxc1 envelopes, fail-closed
   vocabulary). `tools/spec_gate.mjs` enforces the seal.
5. `gan/` — the Unit Table GAN (generator/validator/scars/die/envelope).
6. `ANTI-ENTROPY-LOG.md` — faults found and fixed, with the receipts (read
   this before you "improve" anything; several traps are already documented).
7. `experiments/` — the receipted runs; `atlas-data/` — the bundled artifact
   of record.

## The things that will bite you (gotchas)

- **`node --test lab/` (directory mode) fails on node ≥ 22** — it treats the
  directory as a single test entry. Use the package script (`npm test`), which
  is the glob form `node --test lab/*.test.mjs`. This exact defect is receipted
  in ANTI-ENTROPY-LOG.md F1.
- **The spec is sealed.** Edit `spec/SPEC.md` and `tools/spec_gate.mjs` will
  fail CI with `E_SPEC_TAMPERED` until you intentionally re-seal via
  `node tools/spec_seal.mjs`. Silent spec drift is designed to be loud.
- **Off-lattice writes fold to the origin, silently by design** (seed compat):
  `jevEmit(q, r, ...)` on a coordinate outside the radius writes to cell
  `0,0`. Check your coordinates.
- **The `seed` policy is an honest negative, kept deliberately.** Its
  `_norm()` mutates OTHER cells after every emit (collateral mutations are
  counted in `stats`). Do not "fix" it — it is the instrumented reference that
  E-X1/E-X2 measured the `ledger`/`refuse` policies against.
- **sxc1 envelopes forbid floats.** JS and Python format floats differently;
  a single float breaks cross-repo hash parity with the cocapn mirror. Numbers
  must be safe integers (fail-closed `E_SXC_FIELD`). Non-ASCII strings are fine
  (raw UTF-8 is parity-safe) — the guard was narrowed to exactly this rule in
  wave-69 after F3.
- **`atlas.mjs` CLI is import-guarded** — `experiments/e_x8_*.mjs` imports
  functions from it; the CLI block only runs when invoked as the main module.
- **Running `experiments/e_x8_atlas_gatesweep.mjs` or `gan/demo.mjs`
  regenerates their receipt files** in `experiments/outputs/` (with a fresh
  timestamp). The sweep/demo outputs are deterministic; the receipt `ts` fields
  are not.
- **`observe()` is the ONLY collapse.** Nothing else may zero a `prob_mass`.
  If your code collapses anything else, it violates the one law the repo
  exists to demonstrate.
- **The C4 challenge probes are cross-repo**: `challenge_c4_01_rewind.mjs` and
  `challenge_c4_02_chains.mjs` hard-import `../../quilt-dba/dba/…`. A fresh
  clone needs the sibling checkout — `git clone
  https://github.com/SuperInstance/quilt-dba.git ../quilt-dba` (same parent
  dir as this repo) — or they crash with `ERR_MODULE_NOT_FOUND` (wave-69
  drill finding).

## Where deeper knowledge lives

- Knowledge map: [docs/KNOWLEDGE-MAP.md](./KNOWLEDGE-MAP.md)
- Fleet journal (public): clone https://github.com/SuperInstance/superinstance-lab
  and read worklog.md there (grep 'exoj';
  Task IDs 24-a, 66-b, 66-g, 66-i, 66-j, 67-c1, 67-p, 68-a touch this repo).
- `atlas-data/receipts/` — 7 wave-66 receipt ledgers (106 rows: decompositions,
  smokes, honest negatives, the gate sweep).
- `experiments/outputs/` — receipt JSONL + summaries per experiment (e_x0 …
  e_x8), including the pinned artifact of record `e40_scratch.json`.
- `docs/COG-THESIS.md` — the falsifiable hypothesis that pairs this repo's
  formalism with quilt-dba's nine cells for a transfer-learning measurement.
- `LEGIBILITY.md` — an external read-only audit pass (what this repo does NOT
  do; partially superseded by wave-69's spec/test/CI additions).

## Current frontier (what is open right now)

- **Bridge 3 pathway**: exoj emits sxc1 envelopes → cocapn (Python mirror)
  verifies → quilt-dba stitches. The exoj side and the cross-language parity
  fixtures are sealed and pinned (lab/gan.test.mjs); the live three-repo
  pipeline run is the open next step.
- **The Cog Thesis experiment** (docs/COG-THESIS.md) is specified, not run:
  determinacy(c) vs transfer gap over quilt-dba's nine cells. Nothing measured.
- **Meta family holes**: the wave-66 gate map leaves 127 holes across the
  corpus (79 of them in the meta family) — the principal's next decomposition
  queue, not defects to hide. Read `atlas-data/gate-map.json` → `works[]` rows
  with `HOLE` verdicts (`gates.csv` holds the 401 gated parts only — no
  verdict column, no holes there).
- **Cognitive heterogeneity in the GAN** (SPEC §4): Cell 01/Cell 02 are
  currently deterministic modules; wiring them to genuinely different model
  backends is unstarted.
