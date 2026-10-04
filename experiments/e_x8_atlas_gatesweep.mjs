// e_x8_atlas_gatesweep.mjs — E-X8: THE ATLAS KIT REPLAYS THE WAVE WITHOUT AGENTS.
//
// R1 (replay determinism): atlas.mjs sweepDir() over the bundled parts must
//    reproduce the artifact of record's totals and per-work verdict counts
//    exactly (order-independent assertions: totals + per-work verdict maps +
//    histograms). The shared field's chain tip is order-sensitive, so it is
//    printed, not asserted.
// R2 (self-verification): verifyKit() must PASS on the bundled artifact
//    (corpus 29, referential integrity, AOR consistency, sweep-field chain,
//    receipt ledgers parse).
// R3 (agent-freeness): the whole run is offline, keyless, and deterministic —
//    the sweep is structural judgment over decompositions-as-data; no LLM,
//    no subagent, no network. That is the point of the kit.
// R4 (receipts): every check lands in receipts_ex8.jsonl; chain verifies.
import { sweepDir, verifyKit, RULES } from '../atlas.mjs';
import { ExoJ } from '../core.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'outputs');
const ts = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const receipts = [];
const rec = (event, detail) => { receipts.push({ ts: ts(), exp: 'e_x8', event, detail }); console.log(`[receipt] ${event}: ${detail}`); };

let failures = 0;
const check = (name, pass, detail = '') => {
  if (!pass) failures += 1;
  rec(pass ? 'check_ok' : 'check_FAIL', `${name}${detail ? ' — ' + detail : ''}`);
  return pass;
};

// ---- R2: kit self-verification on the bundled artifact ----
rec('prerun', 'rules pre-registered in atlas.mjs RULES and re-receipted here');
rec('rules', JSON.stringify(RULES));
let verifyPass = false;
try { verifyPass = verifyKit(); } catch (e) { rec('negative', `verifyKit threw: ${e.message}`); }
check('R2 verifyKit', verifyPass === true);

// ---- R1: replay sweep over bundled parts ----
const aor = JSON.parse(readFileSync(join(HERE, '..', 'atlas-data', 'gate-map.json'), 'utf8'));
const replayDir = join(OUT, 'ex8_replay');
mkdirSync(replayDir, { recursive: true });
let replay = null;
try { replay = sweepDir(join(HERE, '..', 'atlas-data', 'parts'), replayDir, { quiet: true }); } catch (e) { rec('negative', `sweep threw: ${e.message}`); }
check('R1 replay produced gate-map', !!replay);

if (replay) {
  const tA = aor.totals, tB = replay.totals;
  check('R1 totals.works', tA.works === tB.works, `${tA.works} vs ${tB.works}`);
  check('R1 totals.parts', tA.parts === tB.parts, `${tA.parts} vs ${tB.parts}`);
  check('R1 totals.gated', tA.gated === tB.gated, `${tA.gated} vs ${tB.gated}`);
  check('R1 totals.OPEN/SOFT/HOLE', tA.OPEN === tB.OPEN && tA.SOFT === tB.SOFT && tA.HOLE === tB.HOLE,
    `O/S/H ${tA.OPEN}/${tA.SOFT}/${tA.HOLE} vs ${tB.OPEN}/${tB.SOFT}/${tB.HOLE}`);
  check('R1 gate_kind histogram', JSON.stringify(tA.gate_kind_histogram) === JSON.stringify(tB.gate_kind_histogram));
  check('R1 layer histogram', JSON.stringify(tA.layer_histogram) === JSON.stringify(tB.layer_histogram));

  const aw = Object.fromEntries(aor.works.map((w) => [w.work, w.verdicts]));
  const bw = Object.fromEntries(replay.works.map((w) => [w.work, w.verdicts]));
  let worksAgree = 0, worksDiffer = [];
  for (const [wk, v] of Object.entries(aw)) {
    const u = bw[wk];
    if (!u) { worksDiffer.push(`${wk}:missing`); continue; }
    if (v.OPEN === u.OPEN && v.SOFT === u.SOFT && v.HOLE === u.HOLE && v.seal_reinforce === u.seal_reinforce) worksAgree += 1;
    else worksDiffer.push(wk);
  }
  check('R1 per-work verdict counts', worksDiffer.length === 0, `${worksAgree}/${Object.keys(aw).length} agree${worksDiffer.length ? '; differ: ' + worksDiffer.join(',') : ''}`);

  console.log(`\nreplay chain tip ${tB.chain_tip.slice(0, 16)}… (aor ${tA.chain_tip.slice(0, 16)}… — order-sensitive, printed not asserted)`);
  check('R1 replay chain verifies', tB.chain_verify.ok === true, `links=${tB.chain_verify.links}`);

  // ---- R3: replay byte-determinism — a second run over the same inputs ----
  const replay2 = sweepDir(join(HERE, '..', 'atlas-data', 'parts'), join(OUT, 'ex8_replay2'), { quiet: true });
  check('R3 deterministic replay', replay2.totals.chain_tip === tB.chain_tip,
    'two kit runs over identical inputs land on the same chain tip');
}

// ---- seal ----
const summary = {
  exp: 'e_x8_atlas_gatesweep', date: ts(), failures,
  verdict: failures === 0 ? 'PASS' : 'FAIL',
  claim: failures === 0
    ? 'the atlas kit reproduces the wave-66 gate sweep from bundled decompositions with zero agents, offline, deterministically; the artifact of record re-verifies'
    : 'replay diverged from the artifact of record — see receipts',
};
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'ex8_summary.json'), JSON.stringify(summary, null, 2));
writeFileSync(join(OUT, 'receipts_ex8.jsonl'), receipts.map((r) => JSON.stringify(r)).join('\n') + '\n');
const chain = new ExoJ('e_x8_receipts', 2, 'ledger');
for (const r of receipts) chain.jevEmit(0, 0, 0.5, 0.5, 0.5, { tag: `${r.event}:${r.detail.slice(0, 40)}`, backend: 'e_x8' });
const cv = chain.verifyChain();
writeFileSync(join(OUT, 'ex8_receipt_chain.json'), JSON.stringify({ ok: cv.ok, links: cv.links, tip: cv.tip }, null, 2));
console.log(`\nE-X8 ${summary.verdict} (failures=${failures}); receipt chain ok=${cv.ok} links=${cv.links}`);
process.exit(failures === 0 ? 0 : 1);
