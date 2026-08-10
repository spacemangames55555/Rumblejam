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
const { Page, bootHttpd, loadPeerjs, sleep } = await import('./cdp_harness.mjs');

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
  await P.exec(`document.getElementById('btn-start').click(); return 1;`);
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
    };`);
  console.log('  ', JSON.stringify(r));
  if (r.open && r.trees === 2 && r.nodes === 20 && r.slots === 8) {
    ok(`the screen renders: ${r.trees} trees, ${r.nodes} nodes, ${r.slots} slots (${r.slotOpen} open at level 1), title "${r.title.trim()}"`);
  } else no(`the screen did not render properly: ${JSON.stringify(r)}`);
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

  await P.exec(`document.getElementById('skills-close').click(); return 1;`);
  await sleep(200);
  const closed = await P.exec(`return document.getElementById('overlay-skills').classList.contains('hidden')?1:0`);
  if (closed) ok('and it closes on its own button'); else no('the close button did not close it');

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
      await P.exec(`document.getElementById('btn-start').click(); return 1;`);
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
