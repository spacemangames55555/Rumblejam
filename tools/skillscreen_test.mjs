// THE SKILL SCREEN, IN A REAL BROWSER.
//
//   node tools/skillscreen_test.mjs
//
// Every other check on the skill system asks the SIM. This one drives a page:
// starts a solo run through the real buttons, requires the §5.6 opening card to
// appear, opens the tree screen with its own button, and spends a point by
// clicking a node.
//
// It exists because the sim being right is not the same as the player seeing
// anything. D-32: the sim held a live `openingOffer` with the point unspent and
// the panel never rendered in solo, because the host never applies its own state
// block and the opening event fires before the handler is listening. Six
// sim-level assertions passed while the screen was dark (§13 rule 54).
const { Page, bootHttpd, loadPeerjs, sleep, startRun } = await import('./cdp_harness.mjs');

const PORT = 8990 + (process.pid % 77);
const peerjsB64 = loadPeerjs();
const httpd = bootHttpd(PORT);
const URL = `http://localhost:${PORT}/index.html`;
if (!peerjsB64) {
  console.warn('⚠ SKIPPED — no local peerjs (set PEERJS_LOCAL, default /tmp/peerjs.min.js).');
  process.exit(0);
}
const { SELECTABLE } = await import('../js/content/characters.js');
const SELECTABLE_IDS = SELECTABLE.map(c => c.id);
const P = await new Page('solo', 9755, peerjsB64).open();

let bad = 0;
const ok = m => console.log(`✓ ${m}`);
const no = m => { bad++; console.error(`✗ ${m}`); };

try {
  await P.goto(URL);
  await P.waitFor(`return !document.getElementById('screen-title').classList.contains('hidden') ? 1 : 0`, 10000, 'title');
  // solo run as a class with two trees
  await P.exec(`document.getElementById('name-input').value='SOLO'; document.getElementById('btn-host').click(); return 1;`);
  await P.waitFor(`return !document.getElementById('screen-lobby').classList.contains('hidden') ? 1 : 0`, 8000, 'lobby');
  await P.exec(`document.querySelector('.char-card[data-char="toh_samurai"]').click(); return 1;`);
  await sleep(300);
  await startRun(P);
  await P.waitFor(`return window.uv.mode==='run' && !!window.uv.sim ? 1 : 0`, 8000, 'run started');

  // the §5.6 card should be up first
  await sleep(1200);
  const opening = await P.exec(`return document.getElementById('overlay-opening').classList.contains('hidden') ? 0 : document.querySelectorAll('#overlay-opening .boon-card').length`);
  if (opening > 0) ok(`the opening-ability card is presented with ${opening} pick(s)`);
  else no(`the opening card did not appear (got ${opening})`);
  await P.exec(`const c=document.querySelector('#overlay-opening .boon-card'); if(c) c.click(); return 1;`);
  await sleep(400);

  // now the skill screen, through the real button
  await P.exec(`document.getElementById('skills-btn').click(); return 1;`);
  await sleep(400);
  const r = await P.exec(`
    const el = document.getElementById('overlay-skills');
    return {
      open: el.classList.contains('hidden') ? 0 : 1,
      trees: el.querySelectorAll('.tree-block').length,
      nodes: el.querySelectorAll('.skill-node').length,
      known: el.querySelectorAll('.skill-node.known').length,
      buyable: el.querySelectorAll('.skill-node.buyable').length,
      slots: el.querySelectorAll('.slot').length,
      slotOpen: el.querySelectorAll('.slot:not(.shut)').length,
      title: (el.querySelector('.ov-title')||{}).textContent || '',
      close: el.querySelector('#skills-close') ? 1 : 0,
      // THE BRANCH, AS DRAWN. Everything above counts cards, and a branching
      // tree drawn as a flat row of cards passes every one of those counts while
      // communicating the one thing branching does not mean — order. So this
      // reads GEOMETRY: how many prereq edges were drawn, and how many distinct
      // vertical lanes the nodes actually occupy.
      edges: el.querySelectorAll('.tree-edges .edge').length,
      lanes: new Set([...el.querySelectorAll('#overlay-skills .node-at')].map(n => n.style.top)).size,
      // A fork is two nodes sharing a column at different heights, COUNTED PER
      // TREE rather than per screen column. Grouping by offset across the whole
      // overlay collapses every tree's tier-4 column into one bucket, so the
      // total stayed at 4 whether one tree branched or all three did — a number
      // that cannot move is not measuring the thing it is named for.
      // (No backticks in this comment: it lives inside a template literal.)
      forks: [...el.querySelectorAll('.tree-block')].reduce((acc, blk) => {
        const by = {};
        for (const n of blk.querySelectorAll('.node-at')) (by[n.style.left] ||= new Set()).add(n.style.top);
        return acc + Object.values(by).filter(v => v.size > 1).length;
      }, 0),
    };`);
  console.log('  ', JSON.stringify(r));
  if (r.open && r.trees === 3 && r.nodes === 30 && r.slots === 8) {
    ok(`the screen renders: ${r.trees} trees, ${r.nodes} nodes, ${r.slots} slots (${r.slotOpen} open at level 1), title "${r.title.trim()}"`);
  } else no(`the screen did not render properly: ${JSON.stringify(r)}`);

  // §8.1: THE SHAPE IS NOT PROVEN UNTIL IT IS LEGIBLE. A correct render draws
  // one edge per non-root node (30 - 3 roots = 27) and puts each branching
  // tree's two paths on separate lanes, with four forked columns per branching
  // tree (tiers 4/6/8/10). The Samurai has TWO branching trees now — Agility,
  // which was the shape spec's proving ground, and Armor, converted — so eight
  // is the floor here and it rises to twelve when Tactics converts. The
  // threshold is stated as a minimum on purpose: this suite should not go red
  // for a conversion patch that has not reached this class yet.
  if (r.edges === 27 && r.lanes >= 2 && r.forks >= 8) {
    ok(`the branch is DRAWN, not implied: ${r.edges} prereq edges, ${r.lanes} lanes, ${r.forks} forked columns — two paths a player can see and choose between`);
  } else {
    no(`the tree rendered as a list rather than a graph: ${r.edges} edges, ${r.lanes} lanes, ${r.forks} forked columns `
      + `(want 27 / >=2 / >=8). A branching tree drawn in one lane communicates ORDER, which is the opposite of the ruling`);
  }
  if (r.known >= 1) ok(`the opening ability shows as KNOWN in the tree (${r.known} node)`);
  else no('the learned opening ability is not marked known');

  // spend a point through the real DOM: grant one, then click a buyable node
  await P.exec(`window.uv.sim.players[0].skillPoints += 1; window.uv.sim.players[0].metaDirty = true; return 1;`);
  await sleep(600);
  const before = await P.exec(`return {pts: window.uv.sim.players[0].skillPoints, ranks: Object.values(window.uv.sim.players[0].skillRanks).reduce((a,b)=>a+b,0), buyable: document.querySelectorAll('#overlay-skills .skill-node.buyable').length};`);
  await P.exec(`const n=document.querySelector('#overlay-skills .skill-node.buyable'); if(n) n.click(); return 1;`);
  await sleep(600);
  const after = await P.exec(`return {pts: window.uv.sim.players[0].skillPoints, ranks: Object.values(window.uv.sim.players[0].skillRanks).reduce((a,b)=>a+b,0)};`);
  if (before.buyable > 0 && after.pts === before.pts - 1 && after.ranks > before.ranks) {
    ok(`clicking a node SPENDS a point through the real path: ${before.pts} → ${after.pts} points, ${before.ranks} → ${after.ranks} learned`);
  } else no(`spending did not work: buyable ${before.buyable}, ${before.pts}→${after.pts} pts, ${before.ranks}→${after.ranks} ranks`);

  // ------------------------------------------------------------------------
  // IT HAS TO SCROLL, AND STAY SCROLLED (§13 rule 54).
  //
  // Reported from playtest: the screen snapped back to the top on every attempt
  // and the lower tiers of every tree were unreachable. `showSkills` replaces
  // the panel's whole innerHTML and `updateSkillsMeta` called it on every meta
  // update — many times a second in an arena — so the element the browser was
  // scrolling stopped existing before the thumb left the glass. Measured 578px
  // of panel against 817px of content: a third of every tree permanently off
  // screen, on a screen whose entire job is choosing between nodes.
  //
  // Three claims, because two of them can pass while the screen is still
  // broken: that it CAN scroll, that the scroll SURVIVES the re-render, and
  // that the node down there is CLICKABLE where it now sits. The third is the
  // check that caught the §5.6 card being visible and unreachable.
  await P.exec(`
    const p = window.uv.sim.players[0];
    p.level = 60; p.skillPoints = 40; p.metaDirty = true; return 1;`);
  await sleep(700);
  const deep = await P.exec(`
    const el = document.getElementById('overlay-skills');
    const panel = el.querySelector('.skills-panel');
    // the lowest node on the screen — whatever needs scrolling to reach
    let best = null, bestY = -1;
    for (const n of el.querySelectorAll('.node-at')) {
      const t = n.offsetTop + (n.offsetParent ? n.offsetParent.offsetTop : 0);
      if (t > bestY) { bestY = t; best = n; }
    }
    if (best) best.dataset.uvDeep = '1';
    const inner = best ? best.querySelector('.skill-node') : null;
    return { has: best ? 1 : 0, id: inner ? inner.dataset.id : (best ? '(card with no .skill-node)' : null),
             canScroll: Math.round(panel.scrollHeight - panel.clientHeight),
             clientH: Math.round(panel.clientHeight), scrollH: Math.round(panel.scrollHeight) };`);
  if (deep.has && deep.canScroll > 0) ok(`the panel has ${deep.canScroll}px to scroll (${deep.clientH} visible of ${deep.scrollH}) and a deepest node "${deep.id}"`);
  else no(`nothing to scroll or no node to reach: ${JSON.stringify(deep)} — if the content fits, this check is measuring the wrong layout`);

  await P.exec(`
    const el = document.getElementById('overlay-skills');
    const panel = el.querySelector('.skills-panel');
    const n = el.querySelector('.node-at[data-uv-deep="1"]');
    panel.scrollTop = panel.scrollHeight;   // all the way down, as a thumb would
    if (n) n.scrollIntoView({ block: 'center' });
    return 1;`);
  // long enough for several meta updates to land — the whole point of the bug
  await sleep(1500);
  const held = await P.exec(`
    const el = document.getElementById('overlay-skills');
    const panel = el.querySelector('.skills-panel');
    const n = el.querySelector('.node-at[data-uv-deep="1"]');
    if (!n) return { gone: 1, top: Math.round(panel.scrollTop) };
    const r = n.getBoundingClientRect(), pr = panel.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const hit = document.elementFromPoint(cx, cy);
    return {
      gone: 0,
      top: Math.round(panel.scrollTop),
      inView: (r.top >= pr.top - 1 && r.bottom <= pr.bottom + 1) ? 1 : 0,
      // clickable where it now sits: the point resolves to the node itself
      clickable: hit && (hit === n || n.contains(hit)) ? 1 : 0,
      hit: hit ? (hit.className || hit.tagName) : 'none',
    };`);
  console.log('  ', JSON.stringify(held));
  if (!held.gone && held.top > 0) ok(`the scroll SURVIVES the re-render — still at ${held.top}px after 1.5s of meta updates`);
  else no(`the panel scrolled back to ${held.top} — this is the reported defect: showSkills replaces the DOM and the scrolled element stops existing`);
  if (held.inView) ok('the deepest node is inside the panel viewport at that scroll position');
  else no('the deepest node scrolled out of view again');
  if (held.clickable) ok('and it is CLICKABLE there — elementFromPoint at its centre returns the node, not whatever is painted over it');
  else no(`the node is visible but unreachable: elementFromPoint returned "${held.hit}" — the §5.6 defect's shape on a different panel`);

  // AND IT MUST STILL SPEND FROM DOWN THERE. Visible and clickable is two of
  // three; the third is that the click reaches the host.
  const spend = await P.exec(`
    const before = window.uv.sim.players[0].skillPoints;
    const n = document.querySelector('#overlay-skills .node-at[data-uv-deep="1"] .skill-node[data-buy="1"]')
      || document.querySelector('#overlay-skills .skill-node[data-buy="1"]');
    if (n) n.click();
    return { before, clicked: n ? 1 : 0 };`);
  await sleep(500);
  const spent = await P.exec(`return window.uv.sim.players[0].skillPoints;`);
  if (spend.clicked && spent < spend.before) ok(`and a node clicked at that scroll position spends: ${spend.before} → ${spent}`);
  else no(`clicking from the scrolled position did not spend: ${JSON.stringify(spend)} → ${spent}`);

  // AND THE FAR TIERS HAVE TO BE REACHABLE SIDEWAYS TOO.
  //
  // Six tier columns at CELL_W 132 + GAP_X 38 is roughly 1020px of graph, and a
  // landscape phone is 740-844 wide. The vertical half of this bug was reported
  // from play; this is the same question on the other axis, asked because the
  // node cards are ABSOLUTELY POSITIONED — an absolutely-positioned child does
  // not contribute to its scroll container's scrollWidth, so a column can sit
  // outside the panel with the browser reporting nothing to scroll to. Visible
  // in the DOM, present in every count, and unreachable by any gesture.
  //
  // THE SCROLLER IS `.tree-scroll`, PER TREE — not the panel. The first draft of
  // this check measured `panel.scrollWidth` and reported a working screen as
  // broken, which is the same mistake this suite exists to catch one level up.
  const wide = await P.exec(`
    const el = document.getElementById('overlay-skills');
    const out = [];
    for (const sc of el.querySelectorAll('.tree-scroll')) {
      const graph = sc.querySelector('.tree-graph');
      const sr = sc.getBoundingClientRect();
      let worstOver = 0, worst = null;
      // measured against the SCROLLER's box, at its current scroll offset
      for (const n of sc.querySelectorAll('.node-at')) {
        const over = Math.round(n.offsetLeft + n.offsetWidth - sc.clientWidth);
        if (over > worstOver) { worstOver = over; worst = n; }
      }
      out.push({
        graphW: graph ? Math.round(graph.getBoundingClientRect().width) : 0,
        viewW: Math.round(sc.clientWidth),
        canScrollX: Math.round(sc.scrollWidth - sc.clientWidth),
        worstOver,
        id: worst ? ((worst.querySelector('.skill-node') || {}).dataset || {}).id || '?' : null,
      });
    }
    return out;`);
  console.log('  ', JSON.stringify(wide));
  const unreachable = wide.filter(r => r.worstOver > 0 && r.canScrollX < r.worstOver);
  if (!wide.length) no('no .tree-scroll containers — the horizontal scroller this check names does not exist');
  else if (!unreachable.length) {
    const widest = wide.reduce((a, b) => (b.worstOver > a.worstOver ? b : a));
    ok(`every tier is reachable sideways — widest tree overhangs its ${widest.viewW}px view by ${widest.worstOver}px `
      + `and .tree-scroll offers ${widest.canScrollX}px (the absolutely-positioned cards DO extend its scrollWidth)`);
  } else {
    no(`${unreachable.length} tree(s) have a column no gesture can reach, worst "${unreachable[0].id}" `
      + `${unreachable[0].worstOver}px past a scroller offering ${unreachable[0].canScrollX}px`);
  }

  await P.exec(`document.getElementById('skills-close').click(); return 1;`);
  await sleep(200);
  const closed = await P.exec(`return document.getElementById('overlay-skills').classList.contains('hidden')?1:0`);
  if (closed) ok('and it closes on its own button'); else no('the close button did not close it');

  // ------------------------------------------------------------------------
  // THE BADGE — unspent points, visible without opening anything (§5.5).
  //
  // Reported from play: level 7 after map 1 of region 1 with six unspent points
  // and no prompt anywhere. Every sim assertion about skill points passed the
  // whole time, because "the player has points" was never the claim in doubt.
  // This is the claim in doubt, so it is measured the only way it can be: by
  // reading the rendered page (§13 rule 54).
  //
  // Geometry, not just presence. The ◆ button had NO CSS rule at all — its
  // three neighbours on the corner rail are absolutely positioned and it was
  // never given a position, so the button that opens the build screen was the
  // one button not placed. A badge anchored to an unplaced button is a badge
  // nobody finds, so this asserts the button is ON the rail and the badge is ON
  // the button rather than merely in the DOM.
  await P.exec(`
    const p = window.uv.sim.players[0];
    p.skillPoints = 6; p.metaDirty = true; return 1;`);
  await sleep(700);
  const badge = await P.exec(`
    const b = document.getElementById('skills-pts'), btn = document.getElementById('skills-btn');
    const bb = b.getBoundingClientRect(), rb = btn.getBoundingClientRect();
    const sheet = document.getElementById('sheet-btn').getBoundingClientRect();
    return {
      shown: b.classList.contains('hidden') ? 0 : 1,
      text: b.textContent,
      lit: btn.classList.contains('has-points') ? 1 : 0,
      // visible pixels, not just a class
      area: Math.round(bb.width * bb.height),
      // the badge overlaps the button it belongs to
      onButton: (bb.left < rb.right + 12 && bb.right > rb.left - 12 && bb.top < rb.bottom + 12 && bb.bottom > rb.top - 12) ? 1 : 0,
      // and the button sits on the same bottom rail as its neighbour
      onRail: Math.abs(rb.bottom - sheet.bottom) < 14 ? 1 : 0,
      btnArea: Math.round(rb.width * rb.height),
    };`);
  console.log('  ', JSON.stringify(badge));
  if (badge.shown && badge.text === '6' && badge.lit && badge.area > 200) {
    ok(`the badge shows the COUNT without opening anything: "${badge.text}" over a lit ◆, ${badge.area}px of it`);
  } else no(`unspent points are not visible on the HUD: ${JSON.stringify(badge)}`);
  if (badge.onRail && badge.onButton) {
    ok(`the ◆ button is on the corner rail and the badge is on the button (${badge.btnArea}px button)`);
  } else no(`placement is wrong — onRail ${badge.onRail}, onButton ${badge.onButton}. A badge on an unplaced button is a badge nobody finds`);

  // and it goes away when the points are gone, or it becomes decoration
  await P.exec(`const p = window.uv.sim.players[0]; p.skillPoints = 0; p.metaDirty = true; return 1;`);
  await sleep(700);
  const gone = await P.exec(`
    return {shown: document.getElementById('skills-pts').classList.contains('hidden')?0:1,
            lit: document.getElementById('skills-btn').classList.contains('has-points')?1:0};`);
  if (!gone.shown && !gone.lit) ok('and it clears when there is nothing to spend — a badge that never goes out is decoration');
  else no(`the badge survived spending down to zero: ${JSON.stringify(gone)}`);

  // ------------------------------------------------------------------------
  // THE MAP-END SPEND STEP, DRIVEN (§5.5).
  //
  // The sim proves the offer is raised and raised before the shop. It cannot
  // prove the panel arrives on screen, and that is precisely the claim D-32
  // falsified once already: a live `openingOffer` with six sim assertions green
  // and nothing rendered, because the host never applies its own state block.
  // The spend step reaches the client by the same route, so it earns the same
  // check rather than inheriting confidence from the one next to it.
  //
  // ABOVE THE SHOP is half the ruling. "Points first, then items" is not a
  // host-side gate — the host opens both, deliberately, so a client that misses
  // this panel still gets the shop — which means the ORDER the player
  // experiences is entirely the stacking. `elementFromPoint` at the panel's own
  // centre is the check that catches a panel something else paints over; it is
  // what caught the §5.6 card behind the map screen's z-index.
  await P.exec(`
    const s = window.uv.sim, p = s.players[0];
    const fight = s.floor.nodes.find(n => n.kind === 'combat' && !s.visited.has(n.id));
    s._travelTo(fight.id);
    p.skillPoints = 5; p.metaDirty = true;
    return 1;`);
  await sleep(400);
  await P.exec(`
    const s = window.uv.sim;
    s.wave.done = true; s.spawnQueue.length = 0;
    for (const e of [...s.enemyPool]) s.enemyPool.release(e);
    s.players[0].skillPoints = 5;
    return 1;`);
  await sleep(1400);
  const step = await P.exec(`
    const sk = document.getElementById('overlay-skills'), sh = document.getElementById('overlay-shop');
    const open = !sk.classList.contains('hidden');
    const r = sk.getBoundingClientRect();
    const hit = open ? document.elementFromPoint(Math.round(r.left + r.width/2), Math.round(r.top + 24)) : null;
    return {
      cleared: window.uv.sim.cleared ? 1 : 0,
      offer: window.uv.sim.players[0].spendOffer || 0,
      skillsOpen: open ? 1 : 0,
      shopOpen: sh.classList.contains('hidden') ? 0 : 1,
      // both offered, and the one the player must answer first is on top
      zSkills: +getComputedStyle(sk).zIndex || 0,
      zShop: +getComputedStyle(sh).zIndex || 0,
      // nothing is painting over it
      onTop: hit ? (sk.contains(hit) ? 1 : 0) : 0,
      hit: hit ? (hit.id || hit.className || hit.tagName) : 'none',
    };`);
  console.log('  ', JSON.stringify(step));
  if (step.cleared && step.offer === 5 && step.skillsOpen) {
    ok(`the spend step OPENS ITSELF at the map end — ${step.offer} points, panel on screen without the player knowing the tree screen exists`);
  } else no(`the spend step did not appear at the clear: ${JSON.stringify(step)}`);
  if (step.shopOpen && step.zSkills > step.zShop && step.onTop) {
    ok(`points before items: the shop is open behind it (z ${step.zShop}) and the spend panel is on top (z ${step.zSkills}), unobstructed — elementFromPoint lands inside it`);
  } else no(`the ordering the player experiences is wrong: skills z${step.zSkills} shop z${step.zShop}, shopOpen ${step.shopOpen}, onTop ${step.onTop} (hit "${step.hit}")`);

  await P.exec(`document.getElementById('skills-close').click(); return 1;`);
  await sleep(600);
  const after2 = await P.exec(`
    return {offer: window.uv.sim.players[0].spendOffer || 0,
            skills: document.getElementById('overlay-skills').classList.contains('hidden')?0:1,
            shop: document.getElementById('overlay-shop').classList.contains('hidden')?0:1,
            badge: document.getElementById('skills-pts').classList.contains('hidden')?0:1};`);
  if (!after2.offer && !after2.skills && after2.shop) {
    ok('closing it answers the step and reveals the shop underneath — one panel dismissed, not two');
  } else no(`closing the spend step left the run in a bad state: ${JSON.stringify(after2)}`);
  if (after2.badge) ok('and the ◆ badge still says points are waiting — the moment can be dismissed, the state cannot');
  else no('the badge vanished when the step was dismissed, which is the original defect with extra steps');

  // ------------------------------------------------------------------------
  // EVERY CLASS, IN THE BROWSER — because one class is not coverage.
  //
  // This suite tested the Samurai and the Samurai only, and a playtest of the
  // MAGE is what reported the §5.6 card missing. The class turned out not to be
  // the variable (D-32 was), but the gap was real: a per-class client defect had
  // exactly one class watching for it, and the sim-side gate cannot see any of
  // them — `offence_test` asserts `p.openingOffer` on the SIM, which was green
  // throughout the defect.
  //
  // AND IT ASSERTS VISIBILITY, NOT CARD COUNT. Measured at the broken commit,
  // the panel read `{panel: "HIDDEN", cards: 2}` — the cards were built and put
  // into a hidden element. Any check that counted cards, or queried them at all,
  // would have passed while the player saw nothing. `offsetParent` is the
  // question that separates "the DOM has it" from "the player can see it".
  {
    const dead = [];
    for (const id of SELECTABLE_IDS) {
      await P.exec(`document.getElementById('leave-btn').click(); return 1;`);
      await P.waitFor(`return !document.getElementById('leave-confirm').classList.contains('hidden')?1:0`, 4000, 'confirm');
      await P.exec(`document.getElementById('leave-yes').click(); return 1;`);
      await P.waitFor(`return window.uv.mode==='lobby'?1:0`, 6000, 'lobby');
      await P.exec(`document.querySelector('.char-card[data-char="${id}"]').click(); return 1;`);
      await sleep(200);
      await startRun(P);
      await P.waitFor(`return window.uv.mode==='run' && !!window.uv.sim ?1:0`, 8000, 'run');
      await sleep(900);
      // REACHABLE BY A POINTER, not merely visible. `offsetParent` caught the
      // hidden-container case; it does NOT catch the one that shipped, where the
      // card rendered, was visible, had `pointer-events: auto` — and the MAP
      // SCREEN painted over it, because `.overlay` declares no z-index while
      // `#screen-map` declares 5. Measured, elementFromPoint at the card's own
      // centre returned `screen`, so every real click fell through to the map and
      // the anti-softlock floor granted the ability instead.
      //
      // `.click()` cannot see this — it dispatches straight at the node and
      // bypasses hit-testing entirely, which is why the previous sweep was green.
      const seen = await P.exec(`const el=document.getElementById('overlay-opening');
        const card = el.querySelector('.boon-card');
        if (!card) return {vis:0, reach:0, cards:0, top:'none', offer:(window.uv.sim.players[0].openingOffer||[]).length};
        const r = card.getBoundingClientRect();
        const at = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
        return {vis: card.offsetParent !== null ? 1 : 0,
                reach: (at === card || card.contains(at)) ? 1 : 0,
                top: at ? (at.id || at.className || at.tagName) : 'none',
                cards: el.querySelectorAll('.boon-card').length,
                offer: (window.uv.sim.players[0].openingOffer||[]).length};`);
      if (!seen.vis || !seen.reach) {
        dead.push(`${id.replace('toh_', '')}(offer ${seen.offer}, cards ${seen.cards}, visible ${seen.vis}, reachable ${seen.reach}, topmost "${seen.top}")`);
      }
      await P.exec(`const c=document.querySelector('#overlay-opening .boon-card'); if(c) c.click(); return 1;`);
      await sleep(250);
    }
    if (!dead.length) ok(`the §5.6 card is VISIBLE AND CLICKABLE for all ${SELECTABLE_IDS.length} classes — elementFromPoint at the card's own centre returns the card, which is the check that catches a panel the map screen paints over`);
    else no(`${dead.length}/${SELECTABLE_IDS.length} class(es) have an opening card a player cannot click: ${dead.join(', ')}`);

    // THE FLOOR IS THE OTHER HALF, and it is asserted here rather than trusted.
    // It fired on every run that shipped — the card was unreachable — and the
    // only symptom was a toast that read like a normal part of starting a run.
    // On a page where the card IS reachable it must never fire at all.
    const floored = await P.exec(`return window.uv.sim.openingFloored || 0;`);
    if (!floored) ok('and the anti-softlock floor never fired across the sweep — with a reachable card the net has nothing to catch, which is the only state in which it is not reporting a defect');
    else no(`the floor fired ${floored} time(s) during the sweep — every one means a card that was presented and not answered`);
  }
} catch (e) {
  no(`crashed: ${e.message}`);
} finally {
  try { await P.close(); } catch {}
  try { httpd.close && httpd.close(); } catch {}
}
console.log(bad ? `\n${bad} FAILURE(S)` : '\nthe skill screen works end to end in a browser');
process.exit(bad ? 1 : 0);
