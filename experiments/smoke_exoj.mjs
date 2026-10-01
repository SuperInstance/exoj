// experiments/smoke_exoj.mjs — the lane's own checks (the generated
// repo-root smoke.mjs is never edited; both must pass).
import { ExoJ, hexDist, normalizeView } from '../core.mjs';
import { verifyChain, canonicalJSON, sha256Hex } from '../receipts.mjs';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  \u2713 ' + name); } else { fail++; console.log('  \u2717 ' + name); } };

// 1. hex geometry matches the seed formula
ok(hexDist(0, 0, 2, -1) === 2 && hexDist(1, 0, 0, 1) === 1 && hexDist(3, -2, 0, 0) === 3, 'hexDist matches axial cube formula');

// 2. lattice population: radius 4 hexagon = 1 + 3*4*5 = 61 cells
ok(new ExoJ('t', 4).cells.size === 61, 'radius-4 lattice holds 61 cells');

// 3. balanced soft writes keep Σ at 1.0 (POC-1 core claim)
{
  const exo = new ExoJ('t', 3, 'seed');
  exo.jevEmit(0, 0, 0.3, 0.7, 0.5, {});
  exo.jevEmit(1, 0, 0.1, 0.9, 0.45, {});
  const s = exo.sense();
  ok(Math.abs(s['Σ'] - 1) < 1e-9 && Math.abs(s.max_cell_Σ - 1) < 1e-9, `balanced writes keep Σ=1 (got Σ=${s['Σ'].toFixed(12)})`);
}

// 4. observation is local: neighbour untouched
{
  const exo = new ExoJ('t', 2, 'seed');
  exo.jevEmit(0, 0, 0.2, 0.8, 0.5, {});
  exo.jevEmit(1, 0, 0.2, 0.8, 0.5, {});
  exo.observe(0, 0, 0.55);
  const c0 = exo.cells.get('0,0'), c1 = exo.cells.get('1,0');
  ok(c0.prob_mass === 0 && c1.prob_mass === 1, 'observe collapses only the attended cell');
}

// 5. chain verifies and content-addresses: tamper is caught
{
  const exo = new ExoJ('t', 2, 'seed');
  for (let i = 0; i < 5; i++) exo.jevEmit(i % 2, 0, 0.2 + i * 0.05, 0.8 - i * 0.05, 0.5, { backend: 'classical' });
  const v = exo.verifyChain();
  ok(v.ok && v.links === 5, `chain verifies (${v.links} links)`);
  exo.chain[2]['γ'] = 0.999; // tamper
  ok(exo.verifyChain().ok === false, 'tampered chain fails verification');
}

// 6. refusal policy: breaching write leaves ledger untouched
{
  const exo = new ExoJ('t', 2, 'refuse');
  exo.jevEmit(0, 0, 0.9, 0.5, 0.5, {}); // cell starts (γ=0,η=1): post=(0.36,0.8) Σ_c=1.16 > 1 → refuse
  const c = exo.cells.get('0,0');
  ok(exo.stats.refusals === 1 && c.touched === 0 && c.gamma === 0 && c.eta === 1, 'breaching write refused, cell untouched');
}

// 7. save/load roundtrip: chain re-verifies from disk
{
  const exo = new ExoJ('t', 3, 'ledger');
  exo.attend('a'); exo.attend('b');
  for (let i = 0; i < 8; i++) exo.jevEmit(i % 3, -i % 2, 0.1 + i * 0.02, 0.9 - i * 0.02, 0.4 + (i % 5) * 0.04, { backend: 'jepa' });
  const p = join(mkdtempSync(join(tmpdir(), 'exoj-')), 'state.json');
  exo.save(p);
  const exo2 = ExoJ.load(p);
  ok(exo2.verifyChain().ok && exo2.sense().active === 6 && Math.abs(exo2.sense()['Δ'] - exo.sense()['Δ']) < 1e-12, 'save/load roundtrip preserves field + chain');
}

// 8. temporal program fires on schedule
{
  const exo = new ExoJ('t', 2, 'deferred');
  exo.jevEmit(0, 0, 0.2, 0.8, 0.5, {});
  exo.attachProgram(0, 0, { id: 'p1', kind: 'every', period: 3 });
  const f = exo.tick(9);
  ok(f.length === 3 && f.map((x) => x.t).join(',') === '3,6,9', `program fires at 3,6,9 (got ${f.map((x) => x.t).join(',')})`);
}

// 9. normalizeView is pure (never mutates)
{
  const exo = new ExoJ('t', 2, 'deferred');
  exo.jevEmit(0, 0, 0.9, 0.5, 0.5, {});
  const g0 = exo.cells.get('0,0').gamma;
  normalizeView([...exo.cells.values()]);
  ok(exo.cells.get('0,0').gamma === g0, 'normalizeView does not mutate state');
}

// 10. receipts idiom: canonical JSON is order-insensitive
ok(sha256Hex(canonicalJSON({ a: 1, b: [2, 3] })) === sha256Hex(canonicalJSON({ b: [2, 3], a: 1 })), 'canonicalJSON is key-order independent');

console.log(fail === 0 ? `SMOKE_EXOJ OK (${pass}/${pass + fail} checks)` : `SMOKE_EXOJ FAILED (${fail} of ${pass + fail} checks)`);
process.exit(fail === 0 ? 0 : 1);
