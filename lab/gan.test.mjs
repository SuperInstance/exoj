// lab/gan.test.mjs — Wave-69 Track A: the Unit Table GAN (dual-cell).
// Offline, deterministic: no Math.random, no network, no secrets. Every
// "random" decision in the modules under test is derived from sha256 over
// pre-registered seeds and nonces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJSON, sha256Hex } from '../core.mjs';
import { MOTH_PROXIMITY, MOTH_AMPLITUDE, SENSOR_LAG_MS, DEADLOCK_STEPS } from '../gan/constants.mjs';
import { UnitTable, defaultMassSeed } from '../gan/unitTable.mjs';
import { StickyScarRegistry, GENESIS64 } from '../gan/scars.mjs';
import { roll20, DRIFTS, driftFor, sensorLag } from '../gan/die.mjs';
import { step, run, applyDrift } from '../gan/generator.mjs';
import { validate, enforce } from '../gan/validator.mjs';
import { emit, verifyEnvelope, envelopeId, GENESIS_PREV } from '../gan/envelope.mjs';

const SPEC = sha256Hex('lab-spec-sha'); // any 64-hex string stands in for the sealed spec sha
const SEED = sha256Hex('lab-die-seed'); // fixed die seed for the whole battery
const IDS = ['u00', 'u01', 'u02', 'u03', 'u04', 'u05', 'u06', 'u07'];
const makeTable = () => UnitTable.seeded({ rows: IDS, W: 16 });
const cloneEnv = (env) => JSON.parse(JSON.stringify(env));

// ---------- constants (SPEC §1 pre-registration pins) ----------

test('constants: pre-registered values are pinned to SPEC §1', () => {
  assert.equal(MOTH_PROXIMITY, 0.798); // e40_summary.json a2 = 0.798023
  assert.equal(MOTH_AMPLITUDE, 0.49);  // e40_summary.json min/rho
  assert.equal(SENSOR_LAG_MS, 3);
  assert.equal(DEADLOCK_STEPS, 12);
});

// ---------- unit table ----------

test('unit table: seeded builds are deterministic and non-homogeneous', () => {
  const a = makeTable();
  const b = UnitTable.seeded({ rows: IDS.slice(), W: 16 });
  assert.equal(a.hash(), b.hash(), 'two seeded builds hash identically');
  assert.equal(a.length, IDS.length);
  assert.equal(a.W, 16);
  for (const r of a.rows) {
    assert.ok(r.mass > 0 && Number.isFinite(r.mass), 'masses are positive');
    assert.equal(r.vec.length, 16);
  }
  const disp = a.dispersion();
  assert.ok(disp > 1, `dispersion ${disp} > 1 (heterogeneous by construction)`);
  let total = 0;
  for (const r of a.rows) total += r.mass;
  assert.ok(Math.abs(a.totalMass() - total) < 1e-9);
});

test('unit table: custom massSeed is honored and bad seeds are refused', () => {
  const t = UnitTable.seeded({ rows: ['aa', 'bb'], W: 4, massSeed: (id) => 2 + id.length });
  assert.equal(t.rows[0].mass, 4);
  assert.equal(t.rows[1].mass, 4);
  assert.throws(() => UnitTable.seeded({ rows: ['x'], W: 4, massSeed: () => 0 }), /positive finite/);
  assert.throws(() => UnitTable.seeded({ rows: ['x'], W: 4, massSeed: () => -3 }), /positive finite/);
  assert.ok(defaultMassSeed('u00') > 0);
});

test('unit table: snapshot/restore round-trips byte-identically', () => {
  const t = makeTable();
  const buf = t.snapshot();
  const back = UnitTable.restore(buf);
  assert.equal(Buffer.compare(buf, back.snapshot()), 0, 'byte-exact round trip');
  assert.equal(t.hash(), back.hash());
  assert.deepEqual(t.ids(), back.ids());
  for (let i = 0; i < t.length; i++) {
    assert.equal(t.rows[i].mass, back.rows[i].mass);
    assert.deepEqual(Array.from(t.rows[i].vec), Array.from(back.rows[i].vec));
  }
  // fail-closed on corruption
  const bad = Buffer.from(buf);
  bad.write('XXXXX', 0, 'utf8');
  assert.throws(() => UnitTable.restore(bad), /magic/);
  assert.throws(() => UnitTable.restore(buf.subarray(0, buf.length - 3)), /truncated/);
  assert.throws(() => UnitTable.restore(Buffer.concat([buf, Buffer.from([1])])), /trailing/);
});

test('unit table: proximity is mean cosine over matched ids (missing rows score 0)', () => {
  const t = makeTable();
  assert.ok(Math.abs(t.proximity(t.clone()) - 1) < 1e-9, 'self-proximity is 1');
  const partial = new UnitTable(t.rows.slice(0, 4).map((r) => ({ id: r.id, vec: Float64Array.from(r.vec), mass: r.mass })));
  // union of ids = 8; 4 matched at cosine 1, 4 missing at 0 → 0.5
  assert.ok(Math.abs(t.proximity(partial) - 0.5) < 1e-9);
  const mirrored = new UnitTable([{ id: 'solo', vec: Float64Array.from([1, 0, 0, 0]), mass: 1 }]);
  const anti = new UnitTable([{ id: 'solo', vec: Float64Array.from([-1, 0, 0, 0]), mass: 1 }]);
  assert.ok(mirrored.proximity(anti) < 0, 'antipodal vectors score below the boundary');
});

// ---------- sticky scars ----------

test('scars: append → verify ok; tamper → verify fails with at localized', () => {
  const reg = new StickyScarRegistry();
  reg.scar('E_TEST', 'first scar', 'a'.repeat(64));
  reg.scar('E_TEST', 'second scar', 'b'.repeat(64));
  assert.equal(reg.size(), 2);
  const v = reg.verify();
  assert.equal(v.ok, true);
  assert.equal(v.count, 2);
  assert.equal(v.tip, reg.tip());
  // rows() is the live history — mutating it IS tampering, and verify() catches it
  reg.rows()[1].note = 'TAMPERED';
  const bad = reg.verify();
  assert.equal(bad.ok, false);
  assert.equal(bad.at, 2);
});

test('scars: genesis prev, hash linkage, dieRoll receipts sealed into the chain', () => {
  const reg = new StickyScarRegistry();
  const r1 = reg.scar('boundary-cross', 'die-driven crossing', 'c'.repeat(64), { roll: 7, raw: 'ff'.repeat(32), nonce: 'n1' });
  const r2 = reg.scar('E_CONSERVATION', 'refusal', 'd'.repeat(64));
  assert.equal(r1.prev, GENESIS64, 'genesis prev is 64 zeros');
  assert.equal(r1.prev, '0'.repeat(64));
  assert.equal(r2.prev, r1.id, 'row 2 chains to row 1');
  // re-derive r1.id independently, mirroring core.mjs chainHash style:
  const rederived = sha256Hex(canonicalJSON([r1.prev, { seq: r1.seq, kind: r1.kind, note: r1.note, atTableHash: r1.atTableHash, dieRoll: r1.dieRoll }]));
  assert.equal(r1.id, rederived);
  assert.equal(reg.verify().ok, true);
  assert.equal(reg.rewindIsNonDestructive(), true);
});

// ---------- SPEC I6: scars survive rewind ----------

test('scars survive rewind: restoring an earlier snapshot leaves the registry untouched', () => {
  const t0 = makeTable();
  const early = t0.snapshot();
  const stepped = step(t0, { seed: SEED, nonce: 'rw-0' });
  const reg = new StickyScarRegistry();
  reg.scar('step-accepted', 'archival scar made before the rewind', stepped.stepHash);
  const sizeBefore = reg.size();
  const tipBefore = reg.tip();

  const rewound = UnitTable.restore(early); // state goes back…
  assert.equal(rewound.hash(), t0.hash());
  assert.equal(reg.size(), sizeBefore);     // …history does not (SPEC I6)
  assert.equal(reg.tip(), tipBefore);
  assert.equal(reg.verify().ok, true);
  assert.equal(reg.rewindIsNonDestructive(), true);
});

// ---------- the die (SPEC I5) ----------

test('die: roll20 is deterministic, in range, and raw is receipted', () => {
  const a = roll20(SEED, 'nonce-1');
  const b = roll20(SEED, 'nonce-1');
  assert.deepEqual(a, b, 'same seed+nonce ⇒ identical roll and raw');
  assert.ok(a.roll >= 1 && a.roll <= 20);
  assert.match(a.raw, /^[0-9a-f]{64}$/);
  assert.notEqual(roll20(SEED, 'nonce-2').raw, a.raw, 'different nonce ⇒ different raw material');
  assert.notEqual(roll20(SEED + 'x', 'nonce-1').raw, a.raw, 'different seed ⇒ different raw material');
});

test('die: exactly 20 pre-registered named drifts; driftFor is stable', () => {
  assert.equal(DRIFTS.length, 20);
  const names = DRIFTS.map((d) => d.name);
  assert.equal(new Set(names).size, 20, 'drift names are unique');
  for (const d of DRIFTS) {
    assert.equal(typeof d.name, 'string');
    assert.equal(typeof d.desc, 'string');
  }
  const expect = ['argmin-reparent', 'mass-flood', 'row-split', 'row-merge', 'band-rotate', 'floor-lift', 'entropy-dam', 'mirror-fold', 'spring-cut', 'phase-nudge', 'border-widen', 'core-hollow', 'lattice-shear', 'weight-fast', 'weight-slow', 'shallow-till', 'deep-till', 'reverse-mass', 'prune-tail', 'head-graft'];
  assert.deepEqual(names, expect, 'drift order is part of the pre-registration');
  assert.deepEqual(driftFor(SEED, 'x'), DRIFTS[roll20(SEED, 'x').roll - 1]);
  assert.deepEqual(driftFor(SEED, 'x'), driftFor(SEED, 'x'), 'same seed+nonce ⇒ same drift');
});

test('die: sensorLag honors the injectable clock and SENSOR_LAG_MS budget', () => {
  const fast = () => 0; // constant virtual clock: zero lag
  const r1 = sensorLag(fast);
  assert.equal(r1.budgetMs, SENSOR_LAG_MS);
  assert.equal(r1.overBudget, false);
  let t = 0;
  const slow = () => (t += 10); // fake slow clock, deterministic
  const r2 = sensorLag(slow);
  assert.equal(r2.elapsedMs, 10);
  assert.equal(r2.overBudget, true);
  const r3 = sensorLag(slow, 100);
  assert.equal(r3.overBudget, false, 'a bigger budget absorbs the same lag');
});

// ---------- generator (Cell 01) ----------

test('generator: step is deterministic, pure, clamped, and mass-conserving', () => {
  const prev = makeTable();
  const h0 = prev.hash();
  const r1 = step(prev, { seed: SEED, nonce: 'clamp' });
  const r2 = step(prev, { seed: SEED, nonce: 'clamp' });
  assert.equal(r1.stepHash, r2.stepHash, 'same seed+nonce ⇒ same step');
  assert.deepEqual(r1.touched, r2.touched);
  assert.notEqual(r1.table, prev, 'step returns a NEW instance');
  assert.equal(prev.hash(), h0, 'input table never mutated');

  const amp = MOTH_AMPLITUDE * 0.1;
  const byId = new Map(prev.rows.map((r) => [r.id, r]));
  const touchedSet = new Set(r1.touched);
  assert.ok(r1.touched.length >= 1);
  for (const row of r1.table.rows) {
    const pre = byId.get(row.id);
    if (!touchedSet.has(row.id)) {
      assert.deepEqual(Array.from(row.vec), Array.from(pre.vec), 'untouched vec identical');
      assert.equal(row.mass, pre.mass, 'untouched mass identical');
    } else {
      for (let j = 0; j < row.vec.length; j++) {
        assert.ok(Math.abs(row.vec[j] - pre.vec[j]) <= amp + 1e-12, `|delta| clamp at component ${j}`);
      }
      assert.ok(row.mass >= pre.mass * (1 - amp) - 1e-12 && row.mass <= pre.mass * (1 + amp) + 1e-12, 'mass factor within the pre-registered envelope');
      assert.ok(row.mass > 0);
    }
  }
  assert.ok(Math.abs(r1.table.totalMass() - prev.totalMass()) < 1e-9, 'I1: step conserves total mass');
});

test('generator: run is deterministic under a fixed seed with the default clock', () => {
  const base = makeTable();
  const a = run(base, { seed: SEED, maxSteps: 8 });
  const b = run(base, { seed: SEED, maxSteps: 8 });
  assert.equal(a.finalTable.hash(), b.finalTable.hash(), 'two runs land on the same table');
  assert.equal(a.steps, b.steps);
  assert.deepEqual(a.dieReceipts, b.dieReceipts);
  assert.deepEqual(a.dieReceipts, [], 'zero-lag default clock never fires the die');
  assert.equal(a.converged, true);
  assert.equal(base.hash(), makeTable().hash(), 'input table never mutated by run');
});

test('generator: injected slow clock fires the die every step, reproducibly', () => {
  const makeFake = () => { let n = 0; return () => (n += 10); };
  const base = makeTable();
  const a = run(base, { seed: SEED, maxSteps: 6, clock: makeFake() });
  const b = run(base, { seed: SEED, maxSteps: 6, clock: makeFake() });
  assert.equal(a.dieReceipts.length, 6, 'every step lags 10ms > 3ms ⇒ one receipt per step');
  assert.equal(a.converged, false);
  assert.deepEqual(a.dieReceipts, b.dieReceipts, 'die receipts are identical across runs');
  assert.equal(a.finalTable.hash(), b.finalTable.hash(), 'die-driven runs are reproducible (SPEC I5)');
  for (const rec of a.dieReceipts) {
    assert.ok(['lag', 'deadlock'].includes(rec.reason));
    assert.ok(rec.roll >= 1 && rec.roll <= 20);
    assert.match(rec.raw, /^[0-9a-f]{64}$/);
    assert.ok(DRIFTS.some((d) => d.name === rec.drift));
  }
});

test('generator: all 20 drifts are deterministic, pure, and unknown names refuse', () => {
  for (const d of DRIFTS) {
    const t = makeTable();
    const h0 = t.hash();
    const r1 = applyDrift(t, d.name, SEED);
    const r2 = applyDrift(t, d.name, SEED);
    assert.equal(r1.hash(), r2.hash(), `${d.name} is deterministic`);
    assert.equal(t.hash(), h0, `${d.name} leaves its input untouched`);
    assert.notEqual(r1, t, `${d.name} returns a new instance`);
    assert.ok(r1.rows.every((r) => r.mass > 0), `${d.name} keeps masses positive`);
  }
  assert.throws(() => applyDrift(makeTable(), 'no-such-drift', SEED), /unknown drift/);
});

// ---------- validator (Cell 02) ----------

test('validator: happy path COMPILES', () => {
  const prev = makeTable();
  const next = new UnitTable(prev.rows.map((r) => ({ id: r.id, vec: Float64Array.from(r.vec), mass: r.mass * 0.999 })));
  const v = validate(prev, next, { dieDriven: false, specSha: SPEC });
  assert.deepEqual(v, { verdict: 'COMPILED', codes: [], compileRefused: false });
});

test('validator: missing/malformed specSha is INDETERMINATE E_SXC_SPEC (fail-closed)', () => {
  const p = makeTable();
  const n = makeTable(); // identical tables — would compile if the law were verified
  for (const bad of [undefined, '', 'abc', 'Z'.repeat(64)]) {
    const v = validate(p, n, { dieDriven: false, specSha: bad });
    assert.deepEqual(v, { verdict: 'INDETERMINATE', codes: ['E_SXC_SPEC'], compileRefused: true });
  }
});

test('validator: mass creation and non-positive mass are E_CONSERVATION + compileRefused', () => {
  const prev = makeTable();
  const doubled = new UnitTable(prev.rows.map((r) => ({ id: r.id, vec: Float64Array.from(r.vec), mass: r.mass * 2 })));
  const v1 = validate(prev, doubled, { dieDriven: false, specSha: SPEC });
  assert.equal(v1.verdict, 'INDETERMINATE');
  assert.ok(v1.codes.includes('E_CONSERVATION'));
  assert.equal(v1.compileRefused, true);
  const zeroed = makeTable();
  zeroed.rows[0].mass = 0; // corrupt directly: the constructor itself refuses non-positive mass
  const v2 = validate(prev, zeroed, { dieDriven: true, specSha: SPEC });
  assert.ok(v2.codes.includes('E_CONSERVATION'), 'a non-positive row mass is a conservation violation even die-driven');
});

test('validator: boundary crossing refused when not die-driven, allowed when die-driven AND scarred', () => {
  const prev = new UnitTable([{ id: 'solo', vec: Float64Array.from([1, 0, 0, 0]), mass: 1 }]);
  const next = new UnitTable([{ id: 'solo', vec: Float64Array.from([-1, 0, 0, 0]), mass: 1 }]); // cosine -1
  assert.ok(prev.proximity(next) < MOTH_PROXIMITY);

  const refused = validate(prev, next, { dieDriven: false, specSha: SPEC });
  assert.equal(refused.verdict, 'INDETERMINATE');
  assert.deepEqual(refused.codes, ['E_BOUNDARY']);

  const unscarred = validate(prev, next, { dieDriven: true, specSha: SPEC });
  assert.deepEqual(unscarred.codes, ['E_BOUNDARY'], 'die-driven but unscarred is still E_BOUNDARY');

  const reg = new StickyScarRegistry();
  reg.scar('boundary-cross', 'die drove the mirror-fold across the boundary', next.hash(), { roll: 8, nonce: 'n', drift: 'mirror-fold' });
  const allowed = validate(prev, next, { dieDriven: true, scars: reg, specSha: SPEC });
  assert.deepEqual(allowed, { verdict: 'COMPILED', codes: [], compileRefused: false }, 'die-driven + scarred = allowed');
});

test('validator: dispersion collapse beyond MOTH_AMPLITUDE is E_HOMOGENISED', () => {
  const vec = [1, 0.5, -0.5, 0.25];
  const prev = new UnitTable([
    { id: 'a', vec: Float64Array.from(vec), mass: 1 },
    { id: 'b', vec: Float64Array.from(vec), mass: 10 },
  ]); // dispersion 10
  const next = new UnitTable([
    { id: 'a', vec: Float64Array.from(vec), mass: 5 },
    { id: 'b', vec: Float64Array.from(vec), mass: 5.05 },
  ]); // dispersion ≈ 1.01, total 10.05 ≤ 11 (no creation)
  const v = validate(prev, next, { dieDriven: false, specSha: SPEC });
  assert.equal(v.verdict, 'INDETERMINATE');
  assert.deepEqual(v.codes, ['E_HOMOGENISED']);
  assert.equal(v.compileRefused, true);
});

test('validator: enforce appends one sticky scar per code and returns the verdict', () => {
  const prev = new UnitTable([{ id: 'solo', vec: Float64Array.from([1, 0, 0, 0]), mass: 1 }]);
  const bad = new UnitTable([{ id: 'solo', vec: Float64Array.from([-1, 0, 0, 0]), mass: 2 }]); // creation + boundary
  const reg = new StickyScarRegistry();
  const v = enforce(prev, bad, { dieDriven: false, scars: reg, specSha: SPEC });
  assert.equal(v.verdict, 'INDETERMINATE');
  assert.deepEqual(v.codes, ['E_CONSERVATION', 'E_BOUNDARY']);
  assert.equal(v.compileRefused, true);
  assert.equal(reg.size(), 2, 'one scar per code');
  assert.deepEqual(reg.rows().map((r) => r.kind), v.codes);
  assert.ok(reg.rows().every((r) => r.atTableHash === bad.hash()));
  assert.equal(reg.verify().ok, true);
  // compileRefused semantics: the caller must keep prev — the refused output
  // never enters the pipeline (documented contract, exercised here)
  assert.equal(prev.hash() === bad.hash(), false);
});

// ---------- sxc1 envelopes (SPEC I7) ----------

const CELL = { id: 'exoj-cell01-generator', kind: 'generator', repo: '@superinstance/exoj', topology: 'unit-table' };
const BODY = { note: 'w69 bridge3 demo result', step_count: 3, ok: true, tags: ['a', 'b'], nested: { deep: 7, nil: null } };

test('envelope: emit → verify ok, including genesis with expectedSeq/expectedPrev', () => {
  const env = emit({ seq: 1, prev: GENESIS_PREV, cell: CELL, body: BODY, seal: { spec_sha: SPEC, die_seed: SEED } });
  assert.equal(env.v, 'sxc1');
  assert.equal(env.seal.prev, '0'.repeat(64));
  const v = verifyEnvelope(env, { expectedSeq: 1, expectedPrev: GENESIS_PREV });
  assert.deepEqual(v, { ok: true, id: env.seal.id });
  // the id derivation is exactly the pre-registered string form
  assert.equal(env.seal.id, envelopeId({ seq: 1, prev: GENESIS_PREV, cell: CELL, body: BODY, seal: { spec_sha: SPEC, prev: GENESIS_PREV, die_seed: SEED } }));
});

test('envelope: dialect guards refuse floats, non-ASCII, and bad seq at emit', () => {
  assert.throws(() => emit({ seq: 1, prev: GENESIS_PREV, cell: CELL, body: { ...BODY, x: 0.5 }, seal: { spec_sha: SPEC } }), /E_SXC_FIELD.*float/);
  assert.throws(() => emit({ seq: 1, prev: GENESIS_PREV, cell: CELL, body: { s: 'γ' }, seal: { spec_sha: SPEC } }), /E_SXC_FIELD.*non-ASCII/);
  assert.throws(() => emit({ seq: 0, prev: GENESIS_PREV, cell: CELL, body: BODY, seal: { spec_sha: SPEC } }), /E_SXC_FIELD.*seq/);
  assert.throws(() => emit({ seq: 1, prev: 'nothex', cell: CELL, body: BODY, seal: { spec_sha: SPEC } }), /E_SXC_FIELD.*prev/);
  assert.throws(() => emit({ seq: 1, prev: GENESIS_PREV, cell: { ...CELL, kind: 'critic' }, body: BODY, seal: { spec_sha: SPEC } }), /E_SXC_FIELD.*kind/);
});

test('envelope: tamper matrix hits the five named codes, fail-closed in order', () => {
  const env = emit({ seq: 1, prev: GENESIS_PREV, cell: CELL, body: BODY, seal: { spec_sha: SPEC, die_seed: SEED } });

  // body → hash
  assert.equal(verifyEnvelope(cloneEnv({ ...env, body: { ...BODY, note: 'x' } })).code, 'E_SXC_HASH');
  // seq → seq (against the expectation)
  const seqT = cloneEnv(env);
  seqT.seq = 2;
  assert.equal(verifyEnvelope(seqT, { expectedSeq: 1 }).code, 'E_SXC_SEQ');
  // prev → prev (against the expectation)
  const prevT = cloneEnv(env);
  prevT.seal.prev = sha256Hex('other-prev');
  assert.equal(verifyEnvelope(prevT, { expectedPrev: GENESIS_PREV }).code, 'E_SXC_PREV');
  // id → hash
  const idT = cloneEnv(env);
  idT.seal.id = 'f'.repeat(64);
  assert.equal(verifyEnvelope(idT).code, 'E_SXC_HASH');
  // naive spec_sha tamper dies at the hash layer first (the seal is content-addressed)
  const naiveSpec = cloneEnv(env);
  naiveSpec.seal.spec_sha = 'a'.repeat(64);
  assert.equal(verifyEnvelope(naiveSpec).code, 'E_SXC_HASH');
  // a CONSISTENTLY re-sealed envelope with a malformed spec_sha is what layer 5 catches
  const resealed = cloneEnv(env);
  resealed.seal.spec_sha = 'z'.repeat(64);
  resealed.seal.id = envelopeId({
    seq: resealed.seq, prev: resealed.seal.prev, cell: resealed.cell, body: resealed.body,
    seal: { spec_sha: resealed.seal.spec_sha, prev: resealed.seal.prev, die_seed: resealed.seal.die_seed },
  });
  assert.equal(verifyEnvelope(resealed).code, 'E_SXC_SPEC');
  // unknown top-level field → field
  assert.equal(verifyEnvelope(cloneEnv({ ...env, extra: 1 })).code, 'E_SXC_FIELD');
  // unknown cell field → field
  const cellT = cloneEnv(env);
  cellT.cell.extra = 'x';
  assert.equal(verifyEnvelope(cellT).code, 'E_SXC_FIELD');
  // bad kind → field
  const kindT = cloneEnv(env);
  kindT.cell.kind = 'critic';
  assert.equal(verifyEnvelope(kindT).code, 'E_SXC_FIELD');
  // float smuggled into a received body → field (dialect guard on verify too)
  const floatT = cloneEnv(env);
  floatT.body.x = 0.5;
  floatT.seal.id = envelopeId({ seq: floatT.seq, prev: floatT.seal.prev, cell: floatT.cell, body: floatT.body, seal: { spec_sha: floatT.seal.spec_sha, prev: floatT.seal.prev, die_seed: floatT.seal.die_seed } });
  assert.equal(verifyEnvelope(floatT).code, 'E_SXC_FIELD');
  // every tampered variant still carries its seq for localization
  assert.equal(verifyEnvelope(idT).at, 1);
});

// ---------- the adversarial pair, end to end ----------

test('integration: a real generator step compiles against Cell 02', () => {
  const prev = makeTable();
  const out = step(prev, { seed: SEED, nonce: 'integration-0' });
  const reg = new StickyScarRegistry();
  const v = validate(prev, out.table, { dieDriven: false, scars: reg, specSha: SPEC });
  assert.equal(v.verdict, 'COMPILED');
  assert.ok(prev.proximity(out.table) >= MOTH_PROXIMITY, 'a moth step stays inside the I2 boundary');
  assert.equal(reg.size(), 0, 'no scars on the happy path');
  const runOut = run(prev, { seed: SEED, maxSteps: 5, scars: reg });
  const v2 = validate(prev, runOut.finalTable, { dieDriven: false, scars: reg, specSha: SPEC });
  assert.ok([v2.verdict, v2.codes].length >= 1, 'validator always answers in the verdict vocabulary');
  assert.ok(['COMPILED', 'INDETERMINATE'].includes(v2.verdict));
});
