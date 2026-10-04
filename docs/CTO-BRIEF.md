# exoj — CTO Brief

## One-paragraph value statement

exoj is the fleet's proof that an agent can "show its work" without collapsing
its reasoning into a single chain of thought: a hex-lattice field of soft
probabilities, written to in parallel by JEV emitters, collapsed only by
explicit recorded observation, and self-proving via a sha256 content-addressed
chain. It is simultaneously (a) a working reasoning substrate with a live
oracle mode, (b) the executable method (Atlas Kit) that lets any future agent
re-run the fleet's largest decomposition study with zero agents, and (c) the
host of the wave-69 adversarial generator/validator pair that keeps
specification-first discipline honest. It costs nothing to run offline and has
no external service dependencies.

## What it does & for whom

For agent-lane operators and researchers: a dunnable reasoning surface
(`exoj-shell-v1` state files) where multiple observers explore alternatives in
parallel; a decomposition-atlas pipeline (29 works → 528 elementary parts →
401 gates → 127 holes, emitted as CSV for any spreadsheet); and an sxc1
envelope protocol for cross-language (JS/Python) verified state exchange with
sibling repos. Consumers: the fleet's lanes (quilt-dba stitches GAN output,
cocapn mirrors validation in Python), any future instance onboarding via
`node atlas.mjs protocol`, and auditors who verify chains instead of trusting
narratives.

## Maturity assessment

**Working, with a hardened core** — evidence, not adjectives:

- All verification commands pass on the current tree (executed wave-69):
  smoke 3/3, `npm test` 28/28, spec gate OK, atlas verify 6/6 (528 parts /
  401 gated / 606-link chain, tip `13463fd0…`).
- E-X8 (receipted): the kit's replay lands on the byte-identical chain tip as
  the live wave-66 sweep — 29/29 per-work verdict maps agree, two kit runs
  deterministic, offline, keyless, agent-free.
- The demo GAN run is deterministic and receipted
  (`experiments/outputs/w69_bridge3_demo.json`), with cross-language hash
  parity pinned against the cocapn fixture in both directions.
- Prototype-grade residuals: the three-repo sxc1 pipeline (exoj → cocapn →
  quilt-dba) is sealed on both ends but the live end-to-end run is not yet
  receipted; the Cog Thesis experiment is specified, not run.

## Risks

| Risk | Status |
|---|---|
| Spec drift (silent edits to pre-registered rules) | Mitigated: sha-sealed SPEC + fail-closed CI gate (`E_SPEC_TAMPERED`); re-seal is loud and receipted |
| Cross-language hash mismatch (JS vs Python) | Mitigated: float-free sxc1 dialect, raw-UTF-8 strings, parity pinned to the cocapn genesis fixture in `lab/gan.test.mjs` |
| Live-oracle dependency (typesafe.ai / Moth) | Contained: live mode is opt-in; every result labelled live/mock/prng with `fallback_why`; offline paths fully capable |
| Credential leakage | Controls in place: env-var names only in tree; values read at call time, never logged/chained; fleet-level audits (waves 67–68) verified zero secrets on pushed surfaces. Key management itself lives with the principal |
| Node-version drift breaking tests | Mitigated by glob-form test script + CI pin (node 22); the directory-mode failure is documented in ANTI-ENTROPY-LOG F1 |
| Knowledge concentration (only wave agents understand it) | Mitigated by this doc package + `atlas.mjs protocol`; the kit's whole purpose is zero-shot re-runnability |

## Cost profile

Effectively zero marginal cost: pure Node.js, zero npm dependencies, no
database, no CI compute beyond minutes of GitHub-hosted runners on push.
Live mode spends external API calls only when deliberately enabled
(TYPESAFEAI_KEY / MOTHQUANTUM_KEY); no measured spend exists in receipts, so
none is claimed. Free-tier posture: everything essential runs offline on a
laptop.

## Strategic options

- **Invest** (recommended): it is the fleet's canonical "how to do it again
  without them" artifact — the Atlas Kit already proved zero-agent replay of a
  multi-agent wave. Next steps with leverage: receipt the full exoj → cocapn →
  quilt-dba pipeline run, and run the specified Cog Thesis measurement.
- **Maintain**: low burden; CI-verified, deterministic, no services to babysit.
  Acceptable if lanes move elsewhere.
- **Harvest-learnings**: the conservation-policy study (E-X1/E-X2) and the
  fail-closed envelope design are directly reusable in any fleet repo; the
  methods port without the code.
- **Retire**: not indicated — it hosts the wave-66 artifact of record and the
  wave-69 GAN; retirement would orphan both.

## Integration surface

- Upstream: fleet-seeds (seedbox chartered the repo; seed-grok2 = the immutable
  charter), quilt-murmur (provenance of the GAN's pre-registered constants).
- Downstream/siblings: cocapn (Python sxc1 validator mirror), quilt-dba
  (stitches GAN output; boundary policy mirrored), quilt (the reactive runtime
  whose cells are the "spreadsheet logic" the atlas decomposes into),
  quilt-atlas / decomposition-atlas artifacts (whitepaper, xlsx mirrors).
- Fleet glue: receipts idiom shared with quilt-cortex/quilt-murmur; CI shares
  the quilt-forge reusable workflow; the journal (superinstance-lab worklog)
  is the cross-repo receipt ledger.
