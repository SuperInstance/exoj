# exoj — Knowledge Map
> The index of indexes. Everything deeper than this doc set, with one line each.

## In this repo

- `core.mjs` — the field model: Cell, ExoJ class, four conservation policies
  (`seed`/`deferred`/`ledger`/`refuse`), emit/observe/program/sense/project,
  content-addressed chain, save/load (`exoj-shell-v1`).
- `receipts.mjs` — the receipt idiom (mulberry32, canonicalJSON, seal/verify
  chain, genesis `EXOJ-RECEIPTS-GENESIS`), shared with quilt-cortex/quilt-murmur.
- `live.mjs` — additive live wiring: typesafe.ai JEV oracle + Moth comet-qrng
  draws with labelled mock/PRNG fallback; env keys read at call time.
- `selflocal.mjs` — self-localizing observer: claim registry, argmin-noul
  attention (`attendWeakest`), `foldToFixpoint`, bypass adversary
  (`bypassPool`/`adjudicate`).
- `atlas.mjs` — the wave-66 method executable: pre-registered `RULES`,
  7-move `PROTOCOL`, `sweepDir`, `verifyKit`, CSV emit.
- `atlas-data/` — the wave-66 artifact of record: `corpus.json` (29 works, 6
  families: substrate/garden/swarm/organ/labs/meta), `parts/<family>/<work>.json`
  (528 parts), `gate-map.json` (401 gates, 127 holes, 606-link chain),
  `sweep_field.json` (dunnable field), `receipts/` (7 ledgers, 106 rows).
- `atlas-out/csv/` — committed CSV emit (corpus/parts/gates/ideas/cells);
  `atlas-out/sweep/` is the default re-run output dir.
- `gan/` — wave-69 Unit Table GAN: `unitTable.mjs` (snapshots/rewind),
  `generator.mjs` (Cell 01), `validator.mjs` (Cell 02, fail-closed),
  `scars.mjs` (append-only scar chain), `die.mjs` (deterministic d20),
  `constants.mjs` (pre-registered MOTH_PROXIMITY 0.798, MOTH_AMPLITUDE 0.49,
  SENSOR_LAG_MS 3, DEADLOCK_STEPS 12), `envelope.mjs` (sxc1), `demo.mjs`.
- `spec/` — `SPEC.md` (wave-69 Track A: constants with provenance, invariants
  I1–I7, sxc1 pathway, fail-closed vocabulary) + `spec_sha.json` (seal).
- `tools/` — `spec_seal.mjs` (re-seal) + `spec_gate.mjs` (fail-closed gate).
- `lab/` — unit batteries: `gan.test.mjs` (incl. cocapn parity fixtures),
  `live-fallback.test.mjs`, `readme-pin.test.mjs` (README ↔ artifact pin).
- `experiments/` — e_x0 (POCs, 8/8) … e_x8 (kit replay), conserve-policy and
  naturality studies, live-JEV runs, challenge drivers, `jev_backends.mjs`
  (4 offline backends), `outputs/` (receipt JSONLs, summaries,
  `e40_scratch.json` = the README's artifact of record).
- `smoke.mjs` — the 3-check smoke; `package.json` — scripts: smoke, test,
  gate, atlas, atlas:sweep, atlas:csv, atlas:protocol, e_x8.
- `.github/workflows/` — `smoke.yml` (gate → tests → smoke) and `forge.yml`
  (reusable fleet workflow).
- `LICENSE` — MIT.

## Pre-existing docs (before wave-69)

- `README.md` — the immutable seed charter (category theory of the inverted
  field) + POC tables + lane doctrine + wave-69 GAN section + Atlas Kit
  section. The repo's constitution; never edit the quoted charter.
- `docs/COG-THESIS.md` — excerpt of the fleet-triage thesis: a cellular
  component is learnable from simulated data when its role is computable from
  its I/O contract; specifies the determinacy-vs-transfer-gap experiment.
  Status inside the doc: falsifiable hypothesis, nothing measured.
- `LEGIBILITY.md` — external read-only audit (fleet-legend census): lists what
  the repo does NOT do (no tests, no LICENSE at the time — both superseded by
  wave-69's `lab/` + LICENSE; kept as historical evidence).
- `ANTI-ENTROPY-LOG.md` — append-only fault/fix log: F1 (test script +
  directory-mode defect), F2 (spec-first layout added), F3 (sxc1 dialect
  mismatch vs cocapn mirror, fixed and pinned).
- `spec/SPEC.md` — the pre-registered wave-69 contract (detailed under "In
  this repo"; listed here because it is also load-bearing prose).

## In the fleet

- `fleet-seeds` — upstream: the seedbox chartered exoj; `seed-grok2.md` there
  is the charter's verbatim source (lineage verified by direct comparison in
  wave-66, Task 66-b).
- `quilt` (SuperInstance/quilt) — sibling concept source: the reactive cell
  runtime; exoj's "spreadsheet logic" vocabulary and cell kinds (value/sensor/
  formula/api/listener/program/router/io) derive from it.
- `quilt-dba` — downstream: stitches GAN output; its per-transaction boundary
  policy is mirrored by exoj's `refuse` policy; nine engine cells are the
  measurement target of the Cog Thesis.
- `cocapn` — downstream mirror: Python sxc1 validator; canonical JSON = 
  `json.dumps(sort_keys=True, separators=(",",":"), ensure_ascii=False)`;
  parity pinned via `lab/gan.test.mjs`.
- `quilt-murmur` — upstream provenance: e40_summary.json supplies the GAN's
  pre-registered constants; also the source of the fleet receipts idiom.
- `quilt-atlas` / `download/decomposition-atlas*` — siblings/outputs: the
  wave-66 study's other deliverables (whitepaper PDF, xlsx) built from the
  same corpus bundled here.
- `jev-quilt`, `jeviter`, `quilt-jev-toolkit`, `jev-garden` — the JEV family:
  doctrine, promote/discard, toolkit, and training garden respectively; exoj
  hosts the field substrate they emit into conceptually.
- `superinstance-lab` — the journal: every claim about waves/tasks lands there.

## In the journal (SuperInstance/superinstance-lab → worklog.md, grep 'exoj')

- **Task 24-a** (wave 24 lane) — built `core.mjs` (quilt-native JS port of the
  seed's `exoj_core.py`), `receipts.mjs`, offline JEV backends; found+fixed 3
  real bugs pre-commit (chain-row spec aliasing, canonicalJSON undefined-key
  rendering, ledger Δ-override masking).
- **Wave 24 follow-ups (unnumbered block around lines 601–611)** — POCs 8/8;
  E-X1 naturality finding (seed `_norm` violates parallel-first; ledger fix
  2.2e-16); E-X2 refusal policy beats silent renorm; E-X3 dog-food run
  (39 deformations, 1 observation, prob_open 0.9412); chartered via seedbox
  (commit b7e83f2).
- **Task 66-b** — decomposed exoj itself into 26 parts / 24 gates / 12 sheet
  cells for the wave-66 atlas (family: garden).
- **Task 66-g** — the JEV gate sweep over all 29 decompositions using the exoj
  field (pre-registered rules; 606-link chain).
- **Task 66-i** — leveled the atlas kit into this repo (`atlas.mjs`,
  `atlas-data/`, E-X8 with byte-identical replay, commit a993ed6).
- **Task 66-j** — final verification sweep (smoke 3/3, atlas verify 6/6,
  E-X8 PASS); honest residual: GitHub push pending at that time.
- **Tasks 67-c1 / 67-p** — push-readiness, secret purge and verified mirror
  work touching exoj's push path.
- **Task 68-a** — the push wave: exoj rebased (atlas-kit commit → c50575c on
  wave-69 tip bfbe461, README/package.json conflicts resolved keep-both).
- **Wave-69 lanes (this wave; entries not yet in the journal at doc time)** —
  GAN build, spec/seal/gate, ANTI-ENTROPY F1–F3, lane 69-4 cocapn parity.

## Receipts of record

- `atlas-data/gate-map.json` — the wave-66 artifact of record: 29 works, 528
  parts, 401 gated (75.9%), 127 holes, gate-kind histogram, per-work verdict
  maps, 606-link verified chain (tip `13463fd02be3ac4f…`).
- `atlas-data/receipts/*.jsonl` — 106 rows: decompositions, dog-food smoke
  verdicts (including honest NOT_RUNs), negative findings, the sweep.
- `experiments/outputs/e40_scratch.json` — the dog-food shell the README's
  final-state line is pinned to (39 deformations, 1 observation,
  prob_open 0.9412, Σ ≈ 1.0, observers agent/auditor/secondary).
- `experiments/outputs/ex8_summary.json` + `receipts_ex8.jsonl` +
  `ex8_receipt_chain.json` — E-X8: kit replay == artifact of record.
- `experiments/outputs/w69_bridge3_demo.json` — wave-69 GAN demo receipt
  (die roll, scars, envelope id).
- `experiments/outputs/x4_field_live-ledger.json` (and the refuse/replay
  siblings) — receipted live-JEV field runs with fallback provenance.
- `spec/spec_sha.json` — the seal binding SPEC.md's sha256
  (`9bf3eb905f9d2c84…`, initial seal 2026-10-03).

## How to search further

```bash
grep -rn "exoj" /home/z/my-project/worklog.md            # every journal mention (Task IDs above); the journal is public — clone https://github.com/SuperInstance/superinstance-lab and read worklog.md there (this /home/z path is the fleet checkout's copy)
grep -rln "gate_kind" atlas-data/parts/                   # decompositions carrying gate vocabulary
grep -rn "E_SXC" gan/ lab/                                # every fail-closed envelope code + its tests
grep -rn "policy" core.mjs | head                         # the four conservation policies
node atlas.mjs csv /tmp/atlas && grep -c HOLE /tmp/atlas/*.csv 2>/dev/null  # holes live in gate-map, not csv; use:
node -e "const m=require('./atlas-data/gate-map.json'); console.log(m.totals); console.log(m.works.filter(w=>w.verdicts.HOLE>0).map(w=>[w.work,w.verdicts.HOLE]))"
rg -n "e_x[0-9]" experiments/*.mjs                            # the experiment family index
```

Note: `atlas-out/csv/` carries the spreadsheet view; per-work HOLE verdicts are
in `atlas-data/gate-map.json` (`works[].verdicts.HOLE`), which is the queue the
README calls the principal's next decomposition queue.
