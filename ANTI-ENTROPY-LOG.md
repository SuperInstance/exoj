# ANTI-ENTROPY LOG — exoj

Append-only. Every fault found is recorded when found and again when fixed.
The log IS the repair receipt. (Wave-69 standing rule: anti-entropy logging.)

## F1 — test script absent / broken directory mode (found wave-69)

- Fault: package.json had only `smoke`; the two test batteries in `lab/`
  (`live-fallback.test.mjs`, `readme-pin.test.mjs`) ran only if someone
  remembered the invocation. Additionally `node --test lab/` (directory
  mode) fails on node ≥ 22 (treats the directory as a single test entry) —
  the same defect the wave-67 verification found in three other repos.
- Fix: `"test": "node --test lab/*.test.mjs"` (glob form — the form that
  actually works), wired into CI after the spec gate.

## F2 — no specification-first layout (found wave-69)

- Fault: no spec/; the field's invariants lived in prose (README) without a
  sealed, gate-checked contract.
- Fix: `spec/SPEC.md` pre-registering Wave-69 Track A (Unit Table GAN:
  constants with provenance, module layout, invariants I1–I7, sxc1 pathway,
  fail-closed vocabulary), sealed + gated; gate is the first CI step.

## F3 — sxc1 dialect mismatch vs the Python mirror (found wave-69, task 69-2)

- Fault: the first `gan/envelope.mjs` dialect guard rejected non-ASCII strings
  in `body`/`cell` (a defensive extra beyond the pre-registered float ban).
  Verifying the cocapn mirror's genesis fixture (lane 69-4,
  `from-fleet/sxc1/fixture-genesis.json`, unicode note, sealed
  e232b8a6cbfb4af1…) failed E_SXC_FIELD — the guard was INCOMPATIBLE with the
  deployed mirror, whose canonical JSON is `json.dumps(..., ensure_ascii=False)`
  (pinned by its own byte-form regression).
- Fix: guard narrowed to the pre-registered rule (floats/unsafe integers
  refused; raw-UTF-8 strings accepted — JS JSON.stringify and Python
  ensure_ascii=False emit identical bytes). Cross-language hash parity then
  CONFIRMED in both directions: exoj's verifyEnvelope accepts the cocapn
  fixture with the exact receipted id, and an independent Python derivation of
  a unicode-body envelope reproduces exoj's id (98e99afd…). Both pinned as
  regressions in lab/gan.test.mjs. The fixture check the 69-4 lane asked for
  ("cheapest next seal") is now committed on this side.
