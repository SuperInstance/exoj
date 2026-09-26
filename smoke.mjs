// smoke.mjs — the repo's first receipt. Replace checks with real ones as the
// experiment grows; the count in the final line is the contract CI enforces.
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  \u2713 ' + name); } else { fail++; console.log('  \u2717 ' + name); } };

// 1. determinism: the hash of nothing is known
ok(createHash('sha256').update('').digest('hex').startsWith('e3b0c442'), 'sha256 of empty string is the known digest');
// 2. entropy source available (the experiment will need randomness)
ok(randomBytes(8).length === 8, 'randomBytes yields 8 bytes');
// 3. charter present (the seed is versioned)
ok(existsSync(new URL('./README.md', import.meta.url)), 'charter README.md exists');

console.log(fail === 0 ? `SMOKE OK (${pass}/${pass + fail} checks)` : `SMOKE FAILED (${fail} of ${pass + fail} checks)`);
process.exit(fail === 0 ? 0 : 1);
