// Usage: node docs/architecture/tools/impact.js <node-id | module-id | keyword> [depth=3]
const g = require('../architecture.graph.json');
const q = process.argv[2], depth = +(process.argv[3] || 3);
if (!q) { console.log('usage: impact.js <file path | module id | keyword> [depth]'); process.exit(1); }
let start = g.nodes.filter(n => n.id === q).map(n => n.id);
if (!start.length) start = g.nodes.filter(n => n.module === q).map(n => n.id);
if (!start.length) { // keyword -> modules
  const mods = g.modules.filter(m => m.keywords.some(k => q.toLowerCase().includes(k) || k.includes(q.toLowerCase()))).map(m => m.id);
  start = g.nodes.filter(n => mods.includes(n.module)).map(n => n.id);
  console.log('keyword matched modules:', mods.join(', ') || 'none');
}
// reverse adjacency: who depends on X (imports X, or calls api X)
const rev = {};
g.edges.forEach(e => (rev[e.to] = rev[e.to] || []).push(e.from));
const seen = new Map(start.map(s => [s, 0]));
let frontier = start;
for (let d = 1; d <= depth; d++) {
  const next = [];
  for (const id of frontier) for (const p of rev[id] || []) if (!seen.has(p)) { seen.set(p, d); next.push(p); }
  frontier = next;
}
const byId = Object.fromEntries(g.nodes.map(n => [n.id, n]));
const affected = [...seen].filter(([id]) => !start.includes(id));
const mods = {};
affected.forEach(([id, d]) => { const m = byId[id]?.module; mods[m] = (mods[m] || 0) + 1; });
console.log('start nodes:', start.length, '| affected files:', affected.length);
console.log('affected modules:', mods);
console.log('direct (depth 1):', affected.filter(([, d]) => d === 1).slice(0, 40).map(([i]) => i));
const apis = g.edges.filter(e => start.includes(e.from) && e.kind === 'calls').map(e => e.to);
console.log('APIs used by start nodes:', [...new Set(apis)]);
