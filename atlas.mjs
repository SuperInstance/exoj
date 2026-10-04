// atlas.mjs — THE ATLAS KIT: how to do wave-66 again WITHOUT the agents.
//
// Wave-66 decomposed 29 sibling works (everything SuperInstance pushed, plus
// the external research it leaned on) into elementary parts as spreadsheet
// logic, then let jevs walk the layers of logic: soft emits for concrete
// gates, explicit recorded collapse only at holes. Six lane agents + a keeper
// produced the corpus. This file is the exoj of that process: the METHOD,
// executable, so the next instance needs zero agents to re-run it.
//
//   node atlas.mjs verify                 re-verify the artifact of record
//   node atlas.mjs sweep [dir] [outDir]   re-run the gate sweep (pre-registered rules)
//   node atlas.mjs csv [dir] [outDir]     emit the spreadsheet logic as CSV
//   node atlas.mjs protocol               print the runbook (how to do it again)
//
// Zero dependencies beyond node:crypto/node:fs. No network. No keys. No LLM.
import { ExoJ, GENESIS } from './core.mjs';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, 'atlas-data');

const LAYER_NAMES = { 0: 'substrate', 1: 'mechanism', 2: 'policy', 3: 'interface', 4: 'evidence' };

// ---- the pre-registered decision rules (receipted BEFORE any sweep runs) ----
export const RULES = {
  R1_OPEN: 'gate non-empty AND gate_kind non-null -> emit(g=0.75, e=0.25, d=0.50)',
  R2_SOFT: 'gate non-empty AND gate_kind null -> emit(g=0.50, e=0.50, d=0.50)',
  R3_HOLE: 'gate empty/null -> observe(d=0.20): explicit, recorded, LOCAL collapse',
  R4_SEAL: 'gate_kind seal|conservation -> extra reinforcing emit(g=0.85, e=0.15, d=0.50)',
  R5_LAYERHOLE: 'work missing any layer 0-4 -> observe at that layer cell',
  R6_THIN: 'work with <5 gated parts -> warning emit(g=0.35, e=0.65, d=0.50)',
  geometry: 'work i (sorted family,work) -> q=(i%7)-3 ; layer L -> r=L-2 ; radius 6 ; exoj policy=ledger',
  backend: 'atlas-sweep: deterministic structural judgment; no LLM, no network',
};

// ---- the runbook: how to do it again without them ----
export const PROTOCOL = `THE DECOMPOSITION PROTOCOL (wave-66 method, agent-free edition)

You are a fresh instance with no subagent fleet. You can still do the whole
wave. The method is seven moves; every move leaves a timestamped receipt.

MOVE 1 — REGISTRY. Write corpus.json: every work worth studying (path,
family, one-line essence). Families are yours; wave-66 used six:
substrate, garden, swarm, organ, labs, meta. Include out-of-instance
influences (upstream repos, external research abstracts) as first-class works.

MOVE 2 — DECOMPOSE. For each work, write one JSON file of elementary parts
(spreadsheet logic: rows = parts, columns = attributes). The schema is
binding: part_id, layer (0 substrate / 1 mechanism / 2 policy / 3 interface /
4 evidence), name, essence, inputs, outputs, gate, gate_kind
(precondition|invariant|postcondition|budget|seal|admission|conservation),
failure_mode, elementary:true, evidence (file:L-L you actually read).
Add the work's 2-5 core ideas (each mapping to parts) and a sheet block
re-rendering the work as quilt cells (value/sensor/formula/api/listener/
program/router/io/ai). Dog-food first: run the work's smoke/selftest
headless and record the VERDICT, whatever it is. 8-30 parts per work.

MOVE 3 — PREREGISTER. Before any judgment, write the sweep rules into the
receipt chain (see RULES in atlas.mjs). Decision rules before the run,
never after.

MOVE 4 — SWEEP. \`node atlas.mjs sweep <partsDir> <outDir>\`. The exoj field
(policy 'ledger') walks every work layer 0->4: concrete gates get soft
deformations (never collapsed); holes get explicit observations. The field
is the proof object; its chain verifies itself.

MOVE 5 — READ THE MAP. gate-map.json: gated_pct is how much of a corpus is
actually guarded; HOLE rows are the work queue (unguarded logic), not
defects to hide. prob_open per work = how much of its logic remains open.

MOVE 6 — COMPILE. \`node atlas.mjs csv <partsDir> <outDir>\` emits the
spreadsheet logic (corpus/parts/gates/ideas/cells) for any spreadsheet
tool. Review = live cross-checks (row counts, histogram sums).

MOVE 7 — SEAL. Append-only ledgers everywhere (receipts JSONL, worklog).
Verify (this file, \`node atlas.mjs verify\`), commit, hand the bones to the
next instance. The kit IS the exoj of the wave: run it again without them.

HONESTY CLAUSES: a smoke you cannot run is NOT_RUN with a reason. A part you
cannot evidence does not enter the atlas. A negative finding is a crown
jewel. Nothing is ever rewritten; ledgers are append-only.`;

// ---------- helpers ----------
const ts = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

function loadCorpus(dir = DATA) {
  return JSON.parse(readFileSync(join(dir, 'corpus.json'), 'utf8'));
}

function loadParts(corpus, dir = DATA) {
  const out = [];
  for (const w of corpus.works) {
    const f = join(dir, 'parts', w.family, `${w.work}.json`);
    if (!existsSync(f)) throw new Error(`missing decomposition: ${f}`);
    out.push({ meta: w, doc: JSON.parse(readFileSync(f, 'utf8')) });
  }
  return out;
}

// ---------- the sweep (the jevs walk the layers) ----------
export function sweepDir(partsDir, outDir, { quiet = false } = {}) {
  // partsDir may be the parts dir itself or its parent; corpus.json lives in the parent
  const parent = partsDir.split('/').pop() === 'parts' ? dirname(partsDir) : partsDir;
  const corpus = loadCorpus(parent);
  const loaded = loadParts(corpus, parent);
  loaded.sort((a, b) => a.meta.family.localeCompare(b.meta.family) || a.meta.work.localeCompare(b.meta.work));

  const field = new ExoJ('atlas-gatesweep', 6, 'ledger');
  field.attend('keeper');
  field.attend('jev-sweep');
  const BACKEND = 'atlas-sweep';
  const gateKindHist = {}, layerHist = [0, 0, 0, 0, 0];
  const workReports = [];
  let totParts = 0, totGated = 0, totOpen = 0, totSoft = 0, totHole = 0;

  for (let i = 0; i < loaded.length; i++) {
    const { meta: w, doc: d } = loaded[i];
    const q = (i % 7) - 3;
    const v = { OPEN: 0, SOFT: 0, HOLE: 0, seal_reinforce: 0 };
    const layerSeen = [false, false, false, false, false];
    const verdicts = [];
    totParts += d.parts.length;
    for (const L of [0, 1, 2, 3, 4]) {
      const parts = d.parts.filter((p) => p.layer === L);
      if (parts.length) layerSeen[L] = true;
      for (const p of parts) {
        layerHist[L] += 1;
        const kk = p.gate_kind && String(p.gate_kind).trim();
        if (kk) gateKindHist[kk] = (gateKindHist[kk] || 0) + 1;
        const hasGate = p.gate && String(p.gate).trim().length > 0;
        let verdict;
        if (hasGate && kk) {
          verdict = 'OPEN'; v.OPEN += 1; totGated += 1; totOpen += 1;
          field.jevEmit(q, L - 2, 0.75, 0.25, 0.50, { tag: `gate:${p.part_id}`, backend: BACKEND });
          if (kk === 'seal' || kk === 'conservation') {
            v.seal_reinforce += 1;
            field.jevEmit(q, L - 2, 0.85, 0.15, 0.50, { tag: `seal:${p.part_id}`, backend: BACKEND });
          }
        } else if (hasGate && !kk) {
          verdict = 'SOFT'; v.SOFT += 1; totGated += 1; totSoft += 1;
          field.jevEmit(q, L - 2, 0.50, 0.50, 0.50, { tag: `soft:${p.part_id}`, backend: BACKEND });
        } else {
          verdict = 'HOLE'; v.HOLE += 1; totHole += 1;
          field.observe(q, L - 2, 0.20);
        }
        verdicts.push({ part_id: p.part_id, layer: L, verdict });
      }
    }
    const missingLayers = [];
    for (let L = 0; L < 5; L++) if (!layerSeen[L]) { missingLayers.push(L); field.observe(q, L - 2, 0.20); }
    if (v.OPEN + v.SOFT < 5) field.jevEmit(q, 0, 0.35, 0.65, 0.50, { tag: `thin:${w.work}`, backend: BACKEND });
    const s = field.sense();
    workReports.push({
      work: w.work, family: w.family, q, verdicts: v,
      layer_coverage: layerSeen.map((b) => (b ? 1 : 0)), missing_layers: missingLayers,
      failure_mode_parts: d.parts.filter((p) => p.failure_mode).length,
      smoke: d.smoke ? d.smoke.verdict : 'unknown',
      sense_at_close: { prob_open: Math.round(s.prob_open * 1e4) / 1e4, zone: Math.round(s.zone * 1e4) / 1e4, active: s.active },
    });
  }

  const sense = field.sense();
  const verify = field.verifyChain();
  mkdirSync(outDir, { recursive: true });
  field.save(join(outDir, 'sweep_field.json'));
  const gateMap = {
    format: 'atlas-gatesweep-v1', date: ts(), rules_pre_registered: RULES,
    field: { name: field.name, policy: field.policy, radius: field.radius, genesis: GENESIS },
    totals: {
      works: loaded.length, parts: totParts, gated: totGated, OPEN: totOpen, SOFT: totSoft, HOLE: totHole,
      gated_pct: Math.round((100 * totGated) / totParts * 10) / 10,
      gate_kind_histogram: gateKindHist, layer_histogram: layerHist,
      deformations: sense.deformations, observations: sense.observations,
      prob_open: Math.round(sense.prob_open * 1e4) / 1e4, zone: Math.round(sense.zone * 1e4) / 1e4,
      chain_tip: field.chain_tip, chain_verify: verify,
    },
    works: workReports,
  };
  writeFileSync(join(outDir, 'gate-map.json'), JSON.stringify(gateMap, null, 2));
  if (!quiet) {
    console.log(`sweep: works=${loaded.length} parts=${totParts} gated=${totGated} (${gateMap.totals.gated_pct}%) holes=${totHole} chain=${verify.ok}(${verify.links}) tip=${field.chain_tip.slice(0, 16)}…`);
    console.log(`wrote ${join(outDir, 'gate-map.json')}`);
  }
  if (!verify.ok) throw new Error('sweep chain verification FAILED');
  return gateMap;
}

// ---------- verify the artifact of record ----------
export function verifyKit() {
  const results = [];
  const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); return pass; };

  const corpus = loadCorpus();
  ok('corpus', corpus.works.length === 29, `${corpus.works.length} works, ${Object.keys(corpus.families).length} families`);

  const loaded = loadParts(corpus);
  let parts = 0, gated = 0, ideas = 0, cells = 0, badRefs = 0;
  for (const { meta: w, doc: d } of loaded) {
    parts += d.parts.length; ideas += d.ideas.length; cells += d.sheet.cells.length;
    const ids = new Set(d.parts.map((p) => p.part_id));
    for (const p of d.parts) if (p.gate && String(p.gate).trim()) gated += 1;
    for (const i of d.ideas) for (const pid of i.parts || []) if (!ids.has(pid)) badRefs += 1;
    for (const c of d.sheet.cells) if (c.maps_to_part && !ids.has(c.maps_to_part)) badRefs += 1;
  }
  ok('decompositions', loaded.length === 29, `${parts} parts, ${ideas} ideas, ${cells} cells`);
  ok('referential integrity', badRefs === 0, `${badRefs} broken refs`);

  const aor = JSON.parse(readFileSync(join(DATA, 'gate-map.json'), 'utf8'));
  ok('artifact-of-record totals', aor.totals.parts === parts && aor.totals.gated === gated,
    `aor parts=${aor.totals.parts} gated=${aor.totals.gated} vs recomputed ${parts}/${gated}`);

  const shell = ExoJ.load(join(DATA, 'sweep_field.json'));
  const v = shell.verifyChain();
  ok('sweep field chain', v.ok, `links=${v.links} tip=${String(v.tip).slice(0, 16)}…`);

  const recDir = join(DATA, 'receipts');
  let recRows = 0, recParse = true;
  for (const f of readdirSync(recDir)) {
    for (const line of readFileSync(join(recDir, f), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { JSON.parse(line); recRows += 1; } catch { recParse = false; }
    }
  }
  ok('receipt ledgers parse', recParse, `${recRows} rows across ${readdirSync(recDir).length} files`);

  return results.every((r) => r.pass);
}

// ---------- csv emit (spreadsheet logic without Excel) ----------
function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCsv(outDir, name, headers, rows) {
  const body = [headers.join(',')].concat(rows.map((r) => r.map(csvEscape).join(','))).join('\n') + '\n';
  writeFileSync(join(outDir, name), body);
  console.log(`wrote ${join(outDir, name)} (${rows.length} rows)`);
}
export function emitCsv(outDir, partsDir = join(DATA, 'parts')) {
  const corpus = loadCorpus();
  const loaded = loadParts(corpus);
  mkdirSync(outDir, { recursive: true });
  writeCsv(outDir, 'corpus.csv', ['work', 'family', 'path', 'essence'],
    corpus.works.map((w) => [w.work, w.family, w.path, w.essence]));
  writeCsv(outDir, 'parts.csv', ['work', 'family', 'part_id', 'layer', 'layer_name', 'name', 'essence', 'inputs', 'outputs', 'gate', 'gate_kind', 'failure_mode', 'elementary', 'evidence'],
    loaded.flatMap(({ meta: w, doc: d }) => d.parts.map((p) => [
      w.work, w.family, p.part_id, p.layer, LAYER_NAMES[p.layer] ?? p.layer, p.name, p.essence,
      (p.inputs || []).join('; '), (p.outputs || []).join('; '),
      p.gate || '', p.gate_kind || '', p.failure_mode || '', p.elementary ? 'yes' : 'no', p.evidence || ''])));
  writeCsv(outDir, 'gates.csv', ['work', 'part_id', 'layer', 'gate_kind', 'gate'],
    loaded.flatMap(({ meta: w, doc: d }) => d.parts.filter((p) => p.gate && String(p.gate).trim()).map((p) => [w.work, p.part_id, p.layer, p.gate_kind || '', p.gate])));
  writeCsv(outDir, 'ideas.csv', ['work', 'idea_id', 'name', 'statement', 'parts'],
    loaded.flatMap(({ meta: w, doc: d }) => d.ideas.map((i) => [w.work, i.id, i.name, i.statement, (i.parts || []).join('; ')])));
  writeCsv(outDir, 'cells.csv', ['work', 'cell_id', 'kind', 'expr', 'deps', 'maps_to_part'],
    loaded.flatMap(({ meta: w, doc: d }) => d.sheet.cells.map((c) => [w.work, c.id, c.kind || '', c.expr || '', (c.deps || []).join('; '), c.maps_to_part || ''])));
}

// ---------- cli (guarded: NEVER run on import — e_x8 imports this module) ----------
const [cmd, a1, a2] = process.argv.slice(2);
const isMain = process.argv[1] && (() => { try { return fileURLToPath(import.meta.url) === process.argv[1]; } catch { return false; } })();
if (isMain) {
if (cmd === 'verify') {
  process.exit(verifyKit() ? 0 : 1);
} else if (cmd === 'sweep') {
  const partsDir = a1 || join(DATA, 'parts');
  const outDir = a2 || join(HERE, 'atlas-out', 'sweep');
  sweepDir(partsDir, outDir);
} else if (cmd === 'csv') {
  emitCsv(a1 || join(HERE, 'atlas-out', 'csv'));
} else if (cmd === 'protocol') {
  console.log(PROTOCOL);
} else {
  console.log('usage: node atlas.mjs verify | sweep [partsDir] [outDir] | csv [outDir] | protocol');
  process.exit(cmd ? 1 : 0);
}
}
