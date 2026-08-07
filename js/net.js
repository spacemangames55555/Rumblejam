// Networking. Everything goes through the small NetTransport interface so the
// PeerJS layer could be swapped for a websocket relay without touching game
// code: createRoom(), join(code), send(peerKey,msg), broadcast(msg),
// onMessage/onPeerJoin/onPeerLeave callbacks, close().
//
// Peer ids are `sg-dungeon-<CODE>` where CODE is 5 unambiguous uppercase
// letters. Host-authoritative star topology; no host migration.

import { NET_PREFIX, CONFIG } from './config.js';

const ROOM_REGISTER_ATTEMPTS = CONFIG.ROOM_REGISTER_ATTEMPTS;
const ROOM_REGISTER_TIMEOUT_MS = CONFIG.ROOM_REGISTER_TIMEOUT_MS;
const ROOM_REGISTER_BACKOFF_MS = CONFIG.ROOM_REGISTER_BACKOFF_MS;
const ROOM_REGISTER_BUDGET_MS = CONFIG.ROOM_REGISTER_BUDGET_MS;
import { randomRoomCode } from './rng.js';

// Optional custom PeerServer via URL params (?peerhost=…&peerport=…&peerpath=…
// &peersecure=0|1). Default: the free PeerJS cloud. Lets you self-host
// signaling (peerjs --port 9000) if the cloud is down or blocked.
function peerOptions() {
  const q = new URLSearchParams(location.search);
  if (!q.get('peerhost')) return {};
  return {
    host: q.get('peerhost'),
    port: parseInt(q.get('peerport') || '443', 10),
    path: q.get('peerpath') || '/',
    secure: q.get('peersecure') !== '0',
  };
}

export class HostTransport {
  constructor() {
    this.peer = null;
    this.code = null;
    this.conns = new Map(); // peerKey -> DataConnection
    this.onMessage = null;  // (peerKey, msg)
    this.onPeerJoin = null;
    this.onPeerLeave = null;
    this.onReady = null;
    this.onError = null;
    this.closed = false;
  }

  // Registers with the signalling server. Resolves with the room code, or
  // rejects (host can still play solo offline).
  //
  // EVERY FAILURE CARRIES ITS REASON. Defect #9 — roughly one co-op run in
  // three or four never getting a code — sat "undiagnosed" for a patch because
  // this rejected with a bare Error and main.js logged it to a console nobody
  // read. That is the same shape as the silently swallowed send in send()/
  // broadcast(): a failure with no evidence attached cannot be fixed, only
  // re-encountered. `err.type` is PeerJS's own classification and is the single
  // most useful field — `unavailable-id` and `network` demand opposite fixes.
  //
  // ATTEMPTS ARE RETRIED ON A FRESH CODE. `unavailable-id` means this exact
  // room code is already registered; retrying the same one can never succeed,
  // and there was no retry at all. Each attempt draws a new code.
  //
  // AND THE SEQUENCE IS BOUNDED ON WALL CLOCK, not on attempt count alone.
  // Attempts x timeout is a number nothing was watching: adding retries
  // silently tripled how long the host could sit in `codePending`, past what
  // the co-op suite waits for, so the suite began reporting registration
  // failures for registrations that were still in flight. A collision fails
  // instantly and still gets all its retries; a relay that has gone quiet
  // stops costing attempts once the budget is spent.
  createRoom(attempts = ROOM_REGISTER_ATTEMPTS) {
    const started = Date.now();
    const tryOnce = n => new Promise((resolve, reject) => {
      if (typeof Peer === 'undefined') { reject(this._regErr('peerjs-missing', 'PeerJS failed to load', n)); return; }
      const code = randomRoomCode();
      const peer = new Peer(NET_PREFIX + code, peerOptions());
      let settled = false;
      const done = fn => { if (settled) return; settled = true; clearTimeout(timeout); fn(); };
      // never overrun the budget just because an attempt's own timeout is longer
      const left = Math.max(250, ROOM_REGISTER_BUDGET_MS - (Date.now() - started));
      const cap = Math.min(ROOM_REGISTER_TIMEOUT_MS, left);
      const timeout = setTimeout(() => done(() => {
        try { peer.destroy(); } catch { /* noop */ }
        reject(this._regErr('timeout', `no 'open' within ${cap}ms`, n, code));
      }), cap);
      peer.on('open', () => done(() => {
        this.peer = peer;
        this.code = code;
        peer.on('connection', conn => this._accept(conn));
        peer.on('error', err => { if (this.onError) this.onError(err); });
        resolve(code);
      }));
      peer.on('error', err => done(() => {
        try { peer.destroy(); } catch { /* noop */ }
        reject(this._regErr((err && err.type) || 'unknown', (err && err.message) || String(err), n, code));
      }));
    });

    const run = n => tryOnce(n).catch(err => {
      this.regFailures = (this.regFailures || []).concat(err.reg);
      // THE LEDGER IS WRITTEN HERE, PER ATTEMPT, not by whoever catches the
      // final rejection. main.js used to publish it only after every attempt
      // was exhausted, which made "still retrying" and "nothing has gone
      // wrong" the same reading — `[]` — and that reading is what the co-op
      // suite printed for a whole patch while calling defect #9 undiagnosed.
      if (typeof window !== 'undefined') {
        window.uvNet = window.uvNet || {};
        window.uvNet.regFailures = this.regFailures;
      }
      const spent = Date.now() - started;
      const outOfBudget = spent >= ROOM_REGISTER_BUDGET_MS;
      // A retry is only worth an attempt if the next one could plausibly differ.
      // A missing library will still be missing in 400ms; retrying it three
      // times bought nothing and put three identical lines in the log of every
      // page that isn't testing co-op, which is most of them.
      const terminal = err.reg.type === 'peerjs-missing';
      console.warn(`[net] room registration attempt ${n}/${attempts} failed: ${err.reg.type} — ${err.reg.detail}${err.reg.code ? ` (code ${err.reg.code})` : ''}${terminal ? ' (not retryable)' : ''}`);
      if (terminal || n >= attempts || outOfBudget) {
        if (outOfBudget && n < attempts) {
          err.reg.gaveUpEarly = `budget ${ROOM_REGISTER_BUDGET_MS}ms spent after ${n}/${attempts} attempts`;
          console.warn(`[net] room registration out of budget after ${spent}ms — skipping the remaining ${attempts - n} attempt(s)`);
        }
        throw err;
      }
      return new Promise(r => setTimeout(r, ROOM_REGISTER_BACKOFF_MS * n)).then(() => run(n + 1));
    });
    return run(1);
  }

  _regErr(type, detail, attempt, code) {
    const e = new Error(`room registration failed (${type}): ${detail}`);
    e.reg = { type, detail, attempt, code: code || null };
    return e;
  }

  _accept(conn) {
    const key = conn.peer;
    conn.on('open', () => {
      this.conns.set(key, conn);
      if (this.onPeerJoin) this.onPeerJoin(key);
    });
    conn.on('data', data => { if (this.onMessage) this.onMessage(key, data); });
    const drop = () => {
      if (this.conns.delete(key) && this.onPeerLeave) this.onPeerLeave(key);
    };
    conn.on('close', drop);
    conn.on('error', drop);
  }

  // EVERY DROP IS LOGGED. These two used to skip a not-open connection and
  // swallow a throwing send in silence, which meant a message could vanish for
  // one peer with a completely clean console on both ends. That is why a lost
  // `map` event took seven suite runs across two branches to find: the failure
  // presented as "the client just sits there", with nothing anywhere saying a
  // send had been skipped.
  //
  // Counters as well as console lines, because a console line scrolls and a
  // counter can be asserted. window.uvNet.drops is the ledger.
  _drop(peerKey, msg, why) {
    const kind = msg && msg.t === 'ev'
      ? `ev[${(msg.list || []).map(e => e.k).join(',') || 'empty'}]`
      : (msg && msg.t) || (msg && msg.k) || typeof msg;
    this.drops = (this.drops || 0) + 1;
    const led = (typeof window !== 'undefined' && window.uvNet) || null;
    if (led) {
      led.drops = (led.drops || 0) + 1;
      (led.dropLog ||= []).push({ peer: peerKey, kind, why });
      if (led.dropLog.length > 50) led.dropLog.shift();
    }
    console.warn(`[net] DROPPED ${kind} for peer ${peerKey}: ${why}. Anything load-bearing in it is now lost for that peer — state belongs in the snapshot, not in a one-shot event.`);
  }

  send(peerKey, msg) {
    const c = this.conns.get(peerKey);
    if (!c) return this._drop(peerKey, msg, 'no connection for this peer');
    if (!c.open) return this._drop(peerKey, msg, 'channel not open');
    try { c.send(msg); } catch (err) { this._drop(peerKey, msg, `send threw: ${err && err.message}`); }
  }

  broadcast(msg) {
    for (const [key, c] of this.conns) {
      if (!c.open) { this._drop(key, msg, 'channel not open'); continue; }
      try { c.send(msg); } catch (err) { this._drop(key, msg, `send threw: ${err && err.message}`); }
    }
  }

  kick(peerKey) {
    const c = this.conns.get(peerKey);
    if (c) { try { c.close(); } catch { /* ignore */ } this.conns.delete(peerKey); }
  }

  close() {
    this.closed = true;
    if (this.peer) { try { this.peer.destroy(); } catch { /* ignore */ } }
    this.peer = null;
    this.conns.clear();
  }
}

export class ClientTransport {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.onMessage = null;   // (msg)
    this.onDisconnect = null;
    this.closed = false;
  }

  join(code) {
    return new Promise((resolve, reject) => {
      if (typeof Peer === 'undefined') { reject(new Error('PeerJS failed to load — check your connection')); return; }
      const peer = new Peer(peerOptions());
      let settled = false;
      const fail = err => { if (!settled) { settled = true; try { peer.destroy(); } catch { /* noop */ } reject(err); } };
      const timeout = setTimeout(() => fail(new Error('Could not reach that room (timeout)')), 10000);
      peer.on('error', err => {
        if (err.type === 'peer-unavailable') fail(new Error('Room not found'));
        else if (!settled) fail(err);
        // Post-join: a 'network' error only means the signaling websocket
        // dropped — the established WebRTC channel to the host is unaffected.
        // Real host loss arrives via the connection's close/error handlers.
        else if (err.type !== 'network' && err.type !== 'disconnected' && this.onDisconnect && !this.closed) {
          this.closed = true;
          this.onDisconnect();
        }
      });
      peer.on('open', () => {
        const conn = peer.connect(NET_PREFIX + code.toUpperCase(), { reliable: true });
        conn.on('open', () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          this.peer = peer;
          this.conn = conn;
          conn.on('data', data => { if (this.onMessage) this.onMessage(data); });
          const drop = () => {
            if (!this.closed) { this.closed = true; if (this.onDisconnect) this.onDisconnect(); }
          };
          conn.on('close', drop);
          conn.on('error', drop);
          resolve();
        });
        conn.on('error', err => fail(err));
        conn.on('close', () => fail(new Error('Connection closed')));
      });
    });
  }

  // THE OTHER DIRECTION, AND THE ONE THAT ACTUALLY FAILED. Everything a client
  // does — picking a character, readying up, tapping a node, buying — leaves by
  // this method, and it swallowed exactly like the host's two did.
  //
  // Instrumenting only HostTransport produced a "zero drops" reading that was
  // true and useless: a co-op run failed at `client ready` with the counter
  // clean, because the client's ready never reached the host and nothing on
  // this path was counting. A drop ledger that covers one direction is a ledger
  // that will be trusted for both.
  //
  // The lobby heartbeat does not help here — it repeats HOST state to clients.
  // What covers this direction is the ack in main.js: `ui` messages carry a
  // sequence number and are resent until the host acknowledges them, so a drop
  // logged here for a `ui` is a delay, not a loss. `in` and `ping` are not
  // covered and do not need to be: movement resends itself at 30 Hz and the
  // keepalive's whole job is to be sent again shortly.
  send(msg) {
    const kind = (msg && msg.t) || (msg && msg.kind) || typeof msg;
    if (!this.conn) return this._drop(kind, 'no connection to the host');
    if (!this.conn.open) return this._drop(kind, 'channel to the host not open');
    try { this.conn.send(msg); } catch (err) { this._drop(kind, `send threw: ${err && err.message}`); }
  }

  // NAMED FOR WHAT IT ASSERTS. This used to say every dropped client message
  // "is simply lost", which stopped being true for `ui` the moment the ack
  // landed and would have sent the next reader hunting a fixed defect.
  _drop(kind, why) {
    this.drops = (this.drops || 0) + 1;
    const led = (typeof window !== 'undefined' && window.uvNet) || null;
    if (led) {
      led.drops = (led.drops || 0) + 1;
      (led.dropLog ||= []).push({ peer: 'host', kind, why });
      if (led.dropLog.length > 50) led.dropLog.shift();
    }
    const fate = kind === 'ui'
      ? 'It will be resent until the host acknowledges it, so this is a delay, not a loss'
      : (kind === 'in' || kind === 'ping'
        ? 'This stream repeats by nature; the next one covers it'
        : 'CLIENT INPUT with no repeating channel and no ack — this one is simply lost');
    console.warn(`[net] DROPPED ${kind} for peer host: ${why}. ${fate}.`);
  }

  close() {
    this.closed = true;
    if (this.peer) { try { this.peer.destroy(); } catch { /* ignore */ } }
    this.peer = null;
    this.conn = null;
  }
}
