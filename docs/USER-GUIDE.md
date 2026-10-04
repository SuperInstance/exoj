# exoj — User Guide

## What you get

ExoJ is an **external, non-collapsing reasoning surface** for agents and
humans: a hex lattice of cells carrying soft amplitudes (γ crystallisation, η
possibility, Δ creativity) that you can write to in parallel without ever
forcing a decision. Think of it as spreadsheet logic for probabilities: ideas
spread out as a field, a JEV (judge/evaluator-verifier) emits soft
deformations into it, and only an explicit, recorded `observe()` call
collapses probability mass — locally. Everything written is content-addressed
into a sha256-chained chain, so the field is simultaneously your scratch-paper
AND your audit log. Two packaged capabilities ride on the same core:

- **The Atlas Kit** (`atlas.mjs`): decompose any collection of works into
  elementary parts across 5 layers, sweep them for gates and holes with
  pre-registered rules, and emit the whole thing as CSV for any spreadsheet.
- **The Unit Table GAN** (`gan/`): an adversarial generator/validator pair that
  pushes a vector table toward semantic-deviation boundaries while a
  fail-closed validator refuses anything that breaks conservation,
  non-homogeneity, or the sealed spec.

## Install

```bash
git clone https://github.com/SuperInstance/exoj
cd exoj
node --version          # >= 18 works; CI pins node 22
npm install             # OPTIONAL: installs nothing (zero dependencies); safe to skip
node smoke.mjs          # expect: SMOKE OK (3/3 checks)
```

There is no build step, no database, no service. Everything runs offline from
a bare node install. Live-oracle modes (see FAQ) additionally read
`TYPESAFEAI_KEY` / `MOTHQUANTUM_KEY` / `MOTHQUANTUM_BASE` from the environment
at call time; without them the system degrades to labelled mock/PRNG paths
instead of failing.

## First success in 5 minutes

Run the bundled demo of the wave-69 adversarial pair:

```bash
node gan/demo.mjs
```

Expected output shape (values deterministic; your run reproduces these):

```
step demo-0  proximity=0.999992  touched=2  COMPILED
...
die  demo-die  roll=6  drift=floor-lift  crossed=false  INDETERMINATE E_CONSERVATION,E_HOMOGENISED
final table   4c8ef9c177e83e94…  verdict COMPILED
scars         2 (chain verified: true)
envelope      0c35e363c215945a…  verified: true
receipt       .../exoj/experiments/outputs/w69_bridge3_demo.json
```

What you just saw: the generator nudges rows, the validator answers only
`COMPILED | INDETERMINATE` with named codes, a deadlock fired the deterministic
d20 (same seed ⇒ same roll), the scar chain survived, and an sxc1 envelope
verified. Then verify the wave-66 artifact of record still holds:

```bash
node atlas.mjs verify
# PASS corpus — 29 works, 6 families
# PASS decompositions — 528 parts, 145 ideas, 366 cells
# PASS referential integrity — 0 broken refs
# PASS artifact-of-record totals — aor parts=528 gated=401 vs recomputed 528/401
# PASS sweep field chain — links=606 tip=13463fd02be3ac4f…
# PASS receipt ledgers parse — 106 rows across 7 files
```

## Everyday usage

### 1. Drive the field yourself (the core API)

```js
// scratch.mjs
import { ExoJ } from './core.mjs';
const exo = new ExoJ('my-field', 4, 'ledger');   // name, radius, policy
exo.attend('me');                                 // attending never collapses
exo.jevEmit(0, 0, 0.08, 0.92, 0.42, { tag: 'concept-A', backend: 'classical' });
exo.jevEmit(2, -1, 0.2, 0.8, 0.5,  { tag: 'concept-B', backend: 'jepa' });
console.log(exo.sense());
// { 'γ': …, 'η': …, 'Σ': ~1, prob_open: 1, … }  — wave still fully open
exo.observe(2, -1, 0.51);                         // the ONLY collapse, local, recorded
console.log(exo.sense().prob_open);               // dropped, only around the observed cell
exo.save('/tmp/my-field.json');                   // dunnable shell (exoj-shell-v1)
```

Policies: `'seed'` (reference, silent renorm — an instrumented honest
negative), `'deferred'` (normalise only in the view), `'ledger'`
(commutative α-weighted accumulation; the recommended policy), `'refuse'`
(writes past the per-cell boundary are refused, counted, chained).

### 2. Re-run the atlas gate sweep and read the map

```bash
node atlas.mjs sweep                       # writes atlas-out/sweep/{gate-map.json,sweep_field.json}
node atlas.mjs csv /tmp/atlas-csv          # parts.csv, gates.csv, ideas.csv, cells.csv, corpus.csv
node atlas.mjs protocol                    # the 7-move runbook, if you want to decompose your own corpus
```

Open `/tmp/atlas-csv/gates.csv` (401 rows) or `atlas-out/sweep/gate-map.json`;
rows with verdict `HOLE` (127 of 528 parts) are the unguarded-logic work queue.

### 3. Check a spec-sealed run before trusting it

```bash
node tools/spec_gate.mjs    # SPEC_GATE OK 9bf3eb90… — or a named E_SPEC_* failure
```

### 4. Run the full unit batteries

```bash
npm test                    # 28 tests across lab/*.test.mjs; green = all pass
```

### 5. Replay the kit end-to-end (the E-X8 experiment)

```bash
node experiments/e_x8_atlas_gatesweep.mjs
# E-X8 PASS (failures=0); regenerates experiments/outputs/{ex8_summary.json,receipts_ex8.jsonl,ex8_receipt_chain.json}
# and two replay dirs with a fresh run timestamp; the sweep itself is byte-deterministic.
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `npm test` fails with a test-runner error about `lab/` | You ran `node --test lab/` directly; directory mode is broken on node ≥ 22 | Use `npm test` (glob form `node --test lab/*.test.mjs`) |
| CI fails with `SPEC_GATE E_SPEC_TAMPERED` | `spec/SPEC.md` was edited after sealing | If intentional: `node tools/spec_seal.mjs` (this is a documented, receipted act). If not: revert the edit |
| `E_SXC_FIELD: … float/unsafe number` | An sxc1 envelope body contains a float | Convert to safe integers; floats are forbidden for JS↔Python hash parity |
| `E_SXC_HASH` on a received envelope | Payload/seal tamper, or a mirror re-canonicalised JSON differently | Check the producer's canonicalJSON matches (sorted keys, no whitespace); see `gan/envelope.mjs` header |
| Off-lattice emit lands at cell `0,0` | Seed-compat fold: coordinates outside the radius write to the origin | Check coordinates; radius is set in the `ExoJ` constructor |
| `sense().Σ` slightly ≠ 1 (e.g. 0.9999999999999999) | float64 accumulation under the `ledger` policy | Expected; receipted boundary integrity is max_cell_Σ ≤ 1 + 1e-9 |
| `node atlas.mjs sweep` says `missing decomposition: …` | Your `partsDir` has no matching `corpus.json` in its parent | Point at the parts dir whose parent holds corpus.json (or run with no args to use bundled `atlas-data/`) |
| Live emit returns `source: 'mock'`, `fallback_why: 'no_key'` | `EXOJ_LIVE!=1` or `TYPESAFEAI_KEY` unset | Export the env vars; without them you get the labelled mock, never a silent fake |

## FAQ

**Is this chain-of-thought?** No — that is the point of the repo. CoT forces
each intermediate step into a definite term (collapses the wave). ExoJ keeps
the intermediate possibilities open (chain-of-probabilities); only an explicit
`observe()` collapses, locally and with a receipt. The README's charter
grounds this in category theory: the sequential log is a derived right Kan
extension, the field is primary.

**Do I need an API key or network?** Not for anything packaged. The default
JEV backends (`experiments/jev_backends.mjs`) are deterministic offline
simulators; the atlas and GAN are pure node. Keys are only consulted when you
opt into `EXOJ_LIVE=1` (`live.mjs`, `selflocal.mjs`) — and even then every
result is labelled `live | mock | prng | fallback:<why>`, so an offline
fallback can never masquerade as a live verdict.

**What are the four conservation policies for?** They are the experiment
history, kept as a registry. E-X1 proved the seed's silent mean-renorm
violates the parallel-first axiom; `ledger` (commutative accumulation,
aggregate at sense time) fixed it; `refuse` mirrors quilt-dba's boundary
policy and makes over-writes loud. `seed` stays as the instrumented reference
so the comparison is always replayable.

**Can I use the atlas on my own corpus?** Yes — that is what
`node atlas.mjs protocol` is for. The 7 moves (REGISTRY → DECOMPOSE →
PREREGISTER → SWEEP → READ THE MAP → COMPILE → SEAL) bind you to the schema
(part_id, layer 0–4, gate, gate_kind, failure_mode, evidence) and to the
pre-registration discipline: rules before runs. `node atlas.mjs sweep
<partsDir> <outDir>` works on any directory laid out the same way.

**What breaks if I edit the constants in `gan/constants.mjs`?** Nothing
crashes — and that is the trap. They are pre-registered constants with
provenance receipts (quilt-murmur e40_summary.json), not knobs; SPEC §1 says
changing them requires re-sealing `spec/SPEC.md` and a new wave receipt.
