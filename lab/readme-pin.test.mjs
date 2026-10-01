// readme-pin.test.mjs — S6-R3 iteration: exoj README "Final state" must match the artifact of record.
// FAIL-FIRST: on first run this was RED (README: deformations=16, prob_open=0.917 vs artifact 39/0.9412).
import { readFileSync } from 'node:fs';
const ROOT = new URL('.', import.meta.url).pathname;
let pass = 0, fail = 0;
const t = (n, ok, d = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}  ${d}`); };

const readme = readFileSync(`${ROOT}../README.md`, 'utf8');
const art = JSON.parse(readFileSync(`${ROOT}../experiments/outputs/e40_scratch.json`, 'utf8')).sense;
// the README's "Final state" line: **Final state:** γ=… η=… Σ=… Δ=… zone=… prob_open=0.917 deformations=16 observations=1
const fsLine = readme.match(/\*\*Final state:\*\*.*$/m)?.[0] ?? '';
const num = k => { const m = fsLine.match(new RegExp(`${k}=([0-9.]+)`)); return m ? parseFloat(m[1]) : null; };
t('final-state line exists', fsLine.length > 0);
t('deformations pinned to artifact', num('deformations') === art.deformations, `readme=${num('deformations')} artifact=${art.deformations}`);
t('observations pinned to artifact', num('observations') === art.observations, `readme=${num('observations')} artifact=${art.observations}`);
t('prob_open pinned to artifact (±0.001)', Math.abs((num('prob_open') ?? -1) - art.prob_open) < 1e-3, `readme=${num('prob_open')} artifact=${art.prob_open.toFixed(4)}`);
t('conservation Σ ≤ 1 + 1e-9 in artifact', art['Σ'] <= 1 + 1e-9, `Σ=${art['Σ']}`);
t('README names its artifact of record', /artifact of record.*e40_scratch/.test(readme), '');
console.log(`\n${fail === 0 ? 'ALL GREEN' : 'RED'}: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
