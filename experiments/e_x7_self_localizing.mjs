// experiments/e_x7_self_localizing.mjs — E-X7: the fold localizes ITSELF.
// Run:  EXOJ_LIVE=1 node experiments/e_x7_self_localizing.mjs    (live JEV + Moth)
//       node experiments/e_x7_self_localizing.mjs                (offline mock + PRNG; plumbing only)
// The demo only emits the claims and supplies decompositions. WHICH cell is attended and
// collapsed each step is chosen by the field's own noul amplitudes (selflocal.attendWeakest).
import { writeFileSync, mkdirSync } from 'node:fs';
import { ExoJ } from '../core.mjs';
import { liveOn, liveJevEmit, seedField } from '../live.mjs';
import { makeRegistry, register, emitClaim, foldToFixpoint, adjudicate, cellNoul } from '../selflocal.mjs';

const WHOLE = 'The human heart is a four-chambered muscular organ, it sits in the chest between the lungs, it pumps blood around the body, and it is located entirely on the left side of the chest.';
const LEAVES = [
  'The human heart is a four-chambered muscular organ.',
  'The heart sits in the chest between the lungs.',
  'The heart pumps blood around the body.',
  'The heart is located entirely on the left side of the chest.',
];
// Decompositions are offered for EVERY leaf; the field decides which one is ever used.
const SUBS = {
  [LEAVES[0]]: ['The human heart has two atria and two ventricles.', 'The heart wall is made mainly of cardiac muscle.'],
  [LEAVES[1]]: ['The heart lies within the mediastinum of the chest.', 'The lungs lie on either side of the heart.'],
  [LEAVES[2]]: ['The heart circulates blood through the systemic circuit.', 'The heart pumps blood to the lungs via the pulmonary circuit.'],
  [LEAVES[3]]: ['The apex of the human heart points toward the left side of the body.', 'Most of the heart\'s mass lies to the left of the body\'s midline.', 'No part of the heart lies to the right of the body\'s midline.'],
};
const decompose = (claim) => SUBS[claim] || null;
const TAU = 0.3, BUDGET = 6;

const out = [];
const P = (s = '') => { console.log(s); out.push(s); };
const exo = new ExoJ('self-localizing', 4, 'ledger');
exo.attend('self-localizer');
const reg = makeRegistry();

P(`EXOJ_LIVE=${liveOn() ? 1 : 0}   tau=${TAU}  budget=${BUDGET}`);
const { coords, draw } = await seedField(exo, 5);
P(`field draw: source=${draw.source}${draw.fallback_why ? ' (' + draw.fallback_why + ')' : ''} job=${draw.job_id ?? '-'} bell_S=${draw.S ?? '-'} hex=${draw.hex ? draw.hex.slice(0, 8) + '…' : '-'}`);

P('\nemit (soft deformations; nothing collapses; demo does NOT choose what to observe):');
const w = await liveJevEmit(exo, ...coords[0], WHOLE, { tag: 'whole', k: 0 }); register(reg, ...coords[0], WHOLE, 'whole', 0);
P(`  WHOLE  cell(${coords[0]})  noul=${w.noul?.toFixed(2) ?? '-'} [${w.source}]`);
const L = [];
for (let i = 0; i < LEAVES.length; i++) {
  const x = await emitClaim(exo, reg, coords[1 + i], LEAVES[i], { tag: `leaf${i}`, k: i + 1 }); L.push(x);
  P(`  leaf${i}  cell(${coords[1 + i]})  noul=${x.noul?.toFixed(2) ?? '-'} [${x.source}${x.fallback_why ? ':' + x.fallback_why : ''}]  ${LEAVES[i].slice(0, 56)}`);
}
const live = L.every((x) => x.noul != null);

P('\nfold to fixpoint — the field auto-attends its argmin-noul open cell each step:');
const fold = await foldToFixpoint(exo, reg, {
  tau: TAU, budget: BUDGET, decompose,
  onStep: (s, a) => {
    P(`  step ${s.step}: pool=${a.ranked.length} ranked=[${a.ranked.slice(0, 4).map((x) => `(${x.q},${x.r}):${x.noul.toFixed(2)}`).join(' ')}]`);
    P(`          ATTEND argmin -> cell(${s.q},${s.r}) noul=${s.noul.toFixed(3)} depth=${s.depth}  "${s.claim.slice(0, 60)}"`);
    for (const k of s.kids) P(`          decompose -> cell(${k.q},${k.r}) noul=${k.noul?.toFixed(2) ?? '-'} [${k.source}]  "${k.claim.slice(0, 52)}"`);
    P(`          OBSERVE (only collapse): prob_mass ${s.before.toFixed(3)} -> 0`);
  },
});
const openLeft = [...reg.entries()].filter(([k, e]) => e.role === 'leaf' && exo.cells.get(k).prob_mass > 0).map(([k, e]) => `${k}:${cellNoul(exo.cells.get(k)).toFixed(2)}`);
P(`  stop=${fold.stop} after ${fold.collapses.length} collapse(s); open leaves left (all clear |γ-0.5|>=${TAU} if fixpoint): [${openLeft}]`);
P(`  collapse sequence = located answer path: ${fold.collapses.map((c) => `(${c.q},${c.r})[${c.noul.toFixed(2)}]`).join(' -> ')}`);
if (live) P(`  WHOLE=${w.noul.toFixed(3)}  FOLD(min over leaves)=${Math.min(...L.map((x) => x.noul)).toFixed(3)}`);
else P('  (offline mock: emitted values are claim-independent; sequence is plumbing, not a located answer)');

P('\nun-gameable adversary at the located leaf (Moth-drawn bypasses, JEV choice adjudicates):');
// located leaf = the field's own weakest collapsed cell (argmin noul over its collapse sequence)
const last = fold.collapses.reduce((b, c) => (!b || c.noul < b.noul ? c : b), null);
let adv = null;
if (last) {
  adv = await adjudicate(exo, [last.q, last.r], last.claim);
  P(`  located leaf: cell(${last.q},${last.r}) "${last.claim}"`);
  P(`  draw: source=${adv.draw.source}${adv.draw.fallback_why ? ' (' + adv.draw.fallback_why + ')' : ''} job=${adv.draw.job_id ?? '-'} bell_S=${adv.draw.S ?? '-'} hex=${adv.draw.hex ? adv.draw.hex.slice(0, 8) + '…' : '-'}`);
  for (const x of adv.rulings) P(`  bypass#${x.pick} -> ${x.choice}${x.confidence != null ? ' (conf ' + x.confidence.toFixed(2) + ')' : ''} [${x.source}${x.fallback_why ? ':' + x.fallback_why : ''}]  ${adv.pool[x.pick].slice(0, 70)}…`);
  P(`  hit-rate ${adv.hits}/${adv.n}  => located leaf ${adv.verdict}`);
}

const v = exo.verifyChain();
const kinds = exo.chain.reduce((m, r) => (m[r.kind] = (m[r.kind] || 0) + 1, m), {});
P(`\nchain: ok=${v.ok} links=${v.links} tip=${String(v.tip).slice(0, 16)}… kinds=${JSON.stringify(kinds)}`);
const chosenByField = fold.collapses.length > 0 && exo.chain.filter((r) => r.kind === 'localize').length >= fold.collapses.length;
const collapsed = [...exo.cells.values()].filter((c) => c.touched > 0 && c.prob_mass === 0).length;
const ok = v.ok && chosenByField && collapsed === fold.collapses.length && exo.observations.length === fold.collapses.length && !!adv;
P(ok ? 'E-X7 OK' : 'FAIL');
mkdirSync(new URL('./outputs/', import.meta.url), { recursive: true });
writeFileSync(new URL(`./outputs/e_x7_self_localizing_run${liveOn() ? '' : '_offline'}.txt`, import.meta.url), out.join('\n') + '\n');
if (!ok) process.exit(1);
