// ONE COMMAND FOR KNOWN-DEFECTS #27 AND #28.
//
//   node tools/fx_defect_repro.mjs
//
// Neither needs a browser: `_ingestSwing` touches nothing but `this.arcs`, and
// `_drawCast`'s sprite anchor is arithmetic on four numbers. This runs the real
// method for the first and the real expression for the second, so a fix to
// either shows up here rather than in a description of it.
//
// It PRINTS the two defects; it does not assert. Both are recorded as accepted
// in docs/KNOWN-DEFECTS.md, so a gate would be red on purpose — if either is
// fixed, delete its half of this file with the entry.
globalThis.window = { devicePixelRatio: 1, addEventListener() {} };
globalThis.document = { createElement: () => ({ getContext: () => null }) };
const { Renderer } = await import('../js/render.js');
const { fxSpec } = await import('../js/content/skillfx.js');
const { SKILL_BY_ID } = await import('../js/skills.js');

// ---- 1. _ingestSwing: a weapon swing recolours a live skill arc ----
const skill = Object.values(SKILL_BY_ID).find(s => { const f = fxSpec(s); return f && f.shape === 'slash'; });
const sp = fxSpec(skill.id);
const R = Renderer.prototype;
const self = { arcs: [], t: 0 };
R._ingestSwing.call(self, { x: 100, y: 100, a: 0, r: 90, arc: sp.arc, color: '#fff', sid: skill.id });
const before = { color: self.arcs[0].color, spec: self.arcs[0].spec.skillId, shape: self.arcs[0].shape, t: self.arcs[0].t };
self.arcs[0].t = 0.20;                                    // the skill arc is mid-life
R._ingestSwing.call(self, { x: 102, y: 101, a: 0.1, r: 90, arc: 1.5, color: '#ff5d6c' });  // a plain weapon swing, no sid
const after = { color: self.arcs[0].color, spec: self.arcs[0].spec.skillId, shape: self.arcs[0].shape, t: self.arcs[0].t };
console.log('arcs after two swings:', self.arcs.length, '(merged)');
console.log('  before:', JSON.stringify(before));
console.log('  after :', JSON.stringify(after));
console.log('  -> colour became the WEAPON\'s while spec/shape stayed the SKILL\'s:',
  after.color !== before.color && after.spec === before.spec);
console.log('  -> and the arc rewound from t=0.20 to t=' + after.t.toFixed(3));

// ---- 2. _drawCast: sprite anchors to the caster when tx === x ----
const cast = Object.values(SKILL_BY_ID).find(s => { const f = fxSpec(s); return f && f.shape === 'blight'; });
const cs = fxSpec(cast.id);
const seen = [];
const ctx = new Proxy({}, { get: (_, k) => (k === 'drawImage' ? () => {} : () => {}) });
// call the anchor arithmetic exactly as _drawCast does
for (const [label, x, y, tx, ty] of [['target east', 100, 100, 300, 100], ['target due north', 100, 100, 100, 40]]) {
  const shape = cs.shape;
  const atx = (shape === 'shockwave' || shape === 'ring' || shape === 'healPulse'
    || shape === 'wardShell' || shape === 'summonBurst') ? x : tx;
  const aty = atx === x ? y : ty;
  seen.push(`${label}: target (${tx},${ty}) -> sprite (${atx},${aty})${aty !== ty ? '   <- WRONG, that is the caster' : ''}`);
}
console.log('\n_drawCast sprite anchor, shape=' + cs.shape + ':');
for (const l of seen) console.log('  ' + l);
