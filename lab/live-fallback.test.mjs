// Offline fallback contract for live.mjs: with EXOJ_LIVE unset or keys absent,
// nothing touches the network and exoj behaves exactly as its offline path.
import { ExoJ } from '../core.mjs';
import { liveJevEmit, mothIntegers, seedField, liveOn } from '../live.mjs';
let bad = 0; const ok = (c, n) => { console.log((c ? '  ok ' : '  FAIL ') + n); if (!c) bad++; };
delete process.env.EXOJ_LIVE;
ok(!liveOn(), 'EXOJ_LIVE unset -> live off');
const a = new ExoJ('t', 3, 'ledger');
const r = await liveJevEmit(a, 0, 0, 'x', { k: 1 });
ok(r.source === 'mock' && r.ev.backend === 'classical-mock' && Math.abs(r.emit.g + r.emit.e - 1) < 1e-9, 'mock emit fallback, γ+η=1');
const d = await mothIntegers({ min: 0, max: 9, count: 5, seed: 7 }), d2 = await mothIntegers({ min: 0, max: 9, count: 5, seed: 7 });
ok(d.source === 'prng' && JSON.stringify(d.values) === JSON.stringify(d2.values), 'PRNG fallback deterministic under seed');
process.env.EXOJ_LIVE = '1'; const k1 = process.env.TYPESAFEAI_KEY, k2 = process.env.TYPESAFE_KEY, m = process.env.MOTHQUANTUM_KEY;
delete process.env.TYPESAFEAI_KEY; delete process.env.TYPESAFE_KEY; delete process.env.MOTHQUANTUM_KEY;
const r2 = await liveJevEmit(a, 1, 0, 'x'); const s = await seedField(a, 3, { seed: 1 });
ok(r2.source === 'mock' && r2.fallback_why === 'no_key', 'EXOJ_LIVE=1 but no key -> mock');
ok(s.draw.source === 'prng' && s.coords.length === 3 && new Set(s.coords.map(String)).size === 3, 'no Moth key -> PRNG seed, 3 distinct cells');
ok(a.verifyChain().ok && a.observations.length === 0, 'chain verifies; nothing collapsed by wiring');
if (k1) process.env.TYPESAFEAI_KEY = k1; if (k2) process.env.TYPESAFE_KEY = k2; if (m) process.env.MOTHQUANTUM_KEY = m;
process.exit(bad ? 1 : 0);
