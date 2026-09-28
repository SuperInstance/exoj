// experiments/e_x6_live_fold.mjs — E-X6: a decomposing fold run THROUGH exoj's field.
// Run:  EXOJ_LIVE=1 node experiments/e_x6_live_fold.mjs     (live JEV + Moth)
//       node experiments/e_x6_live_fold.mjs                 (offline mock + PRNG fallback)
// Each claim is a soft deformation (noul -> γ/η/Δ) on a hex cell whose placement
// is drawn from Moth. All cells stay open (prob_mass>0) — the chain of
// probabilities — until ONE observe() at the argmin-noul leaf localizes it.
import { ExoJ, hexRing } from '../core.mjs';
import { liveOn, liveJevEmit, seedField } from '../live.mjs';

const WHOLE = 'The human heart is a four-chambered muscular organ, it sits in the chest between the lungs, it pumps blood around the body, and it is located entirely on the left side of the chest.';
const LEAVES = [
  'The human heart is a four-chambered muscular organ.',
  'The heart sits in the chest between the lungs.',
  'The heart pumps blood around the body.',
  'The heart is located entirely on the left side of the chest.',
];
const FALSE_LEAF = 3;
const SUBLEAVES = [
  'The apex of the human heart points toward the left side of the body.',
  'Most of the heart\'s mass lies to the left of the body\'s midline.',
  'No part of the heart lies to the right of the body\'s midline.',
];

const exo = new ExoJ('live-fold', 4, 'ledger');
exo.attend('fold-observer');
const log = [];
const openMass = () => { const a = [...exo.cells.values()].filter((c) => c.touched > 0); return { n: a.length, open: a.filter((c) => c.prob_mass > 0).length }; };
const show = (label, x, coord, claim) =>
  console.log(`  ${label.padEnd(9)} cell(${coord[0]},${coord[1]})  noul=${x.noul == null ? '  -  ' : x.noul.toFixed(2)}  γ=${x.emit.g} η=${x.emit.e} Δ=${x.emit.d}  [${x.source}${x.fallback_why ? ':' + x.fallback_why : ''}]  ${claim.slice(0, 52)}`);

console.log(`EXOJ_LIVE=${liveOn() ? 1 : 0}`);
const { coords, draw } = await seedField(exo, 5);
console.log(`field draw: source=${draw.source}${draw.fallback_why ? ' (' + draw.fallback_why + ')' : ''} job=${draw.job_id ?? '-'} bell_S=${draw.S ?? '-'} hex=${draw.hex ? draw.hex.slice(0, 8) + '…' : '-'} ints=[${draw.values.slice(0, 8)}…]`);

console.log('\nlevel 0 — the whole (one opaque verdict):');
const w = await liveJevEmit(exo, ...coords[0], WHOLE, { tag: 'whole', k: 0 }); show('WHOLE', w, coords[0], WHOLE);

console.log('\nlevel 1 — decompose into 4 leaves (each a soft deformation on its own cell):');
const L = [];
for (let i = 0; i < LEAVES.length; i++) { const x = await liveJevEmit(exo, ...coords[1 + i], LEAVES[i], { tag: `leaf${i}`, k: i + 1 }); L.push(x); show(`leaf${i}`, x, coords[1 + i], LEAVES[i]); }
let m = openMass(); console.log(`  field: ${m.open}/${m.n} touched cells fully open (prob_mass>0), observations=${exo.observations.length}`);

console.log('\nlevel 2 — decompose the least-true leaf again, onto its hex neighbours:');
const ai = L.reduce((b, x, i) => ((x.noul ?? 1) < (L[b].noul ?? 1) ? i : b), 0);
const ring = hexRing(...coords[1 + ai], 1).filter(([q, r]) => exo.cells.has(`${q},${r}`) && !coords.some(([a, b]) => a === q && b === r));
const S = [];
for (let i = 0; i < SUBLEAVES.length; i++) { const x = await liveJevEmit(exo, ...ring[i], SUBLEAVES[i], { tag: `sub${i}`, k: 5 + i }); S.push({ x, c: ring[i] }); show(`sub${i}`, x, ring[i], SUBLEAVES[i]); }
m = openMass(); console.log(`  field: ${m.open}/${m.n} touched cells fully open, observations=${exo.observations.length}  (chain of probabilities held open)`);

const live = L.every((x) => x.noul != null);
const noulOf = (x) => x.noul;
console.log('\nfold:');
if (live) {
  const ns = L.map(noulOf);
  console.log(`  WHOLE=${w.noul?.toFixed(3)}  FOLD(min)=${Math.min(...ns).toFixed(3)}  FOLD(product)=${ns.reduce((a, b) => a * b, 1).toFixed(3)}  divergence(whole-fold_min)=${((w.noul ?? 0) - Math.min(...ns)).toFixed(3)}`);
} else console.log('  (offline mock: values are claim-independent; no fold to localize — plumbing only)');

console.log('\nobservation — the ONLY collapse:');
const [oq, or_] = coords[1 + ai];
const before = exo.cells.get(`${oq},${or_}`).prob_mass;
const obs = exo.observe(oq, or_, live ? L[ai].emit.d : 0.5);
const collapsed = [...exo.cells.values()].filter((c) => c.touched > 0 && c.prob_mass === 0).length;
m = openMass();
console.log(`  observe cell(${oq},${or_}) [leaf${ai}]: prob_mass ${before.toFixed(3)} -> 0; collapsed cells=${collapsed}; still open=${m.open}/${m.n}`);
const v = exo.verifyChain();
console.log(`  chain: ok=${v.ok} links=${v.links} tip=${String(v.tip).slice(0, 16)}…  seed row=${exo.chain.find((r) => r.kind === 'seed').source}, deform backends=${[...new Set(exo.chain.filter((r) => r.kind === 'deform').map((r) => r.backend))]}`);
const proj = exo.project('fold-observer');
console.log(`  quilt projection (derived, Field primary): ${JSON.stringify(proj).length} bytes, observer=${proj.observer}`);
if (!(v.ok && collapsed === 1 && m.open === m.n - 1)) { console.log('FAIL'); process.exit(1); }
console.log('E-X6 OK');
