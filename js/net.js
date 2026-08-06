// Networking. Everything goes through the small NetTransport interface so the
// PeerJS layer could be swapped for a websocket relay without touching game
// code: createRoom(), join(code), send(peerKey,msg), broadcast(msg),
// onMessage/onPeerJoin/onPeerLeave callbacks, close().
//
// Peer ids are `sg-dungeon-<CODE>` where CODE is 5 unambiguous uppercase
// letters. Host-authoritative star topology; no host migration.

import { NET_PREFIX } from './config.js';
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

  // Registers with the PeerJS cloud. Resolves with the room code, or rejects
  // (host can still play solo offline).
  createRoom() {
    return new Promise((resolve, reject) => {
      if (typeof Peer === 'undefined') { reject(new Error('PeerJS failed to load')); return; }
      const code = randomRoomCode();
      const peer = new Peer(NET_PREFIX + code, peerOptions());
      const timeout = setTimeout(() => { try { peer.destroy(); } catch { /* noop */ } reject(new Error('timeout')); }, 8000);
      peer.on('open', () => {
        clearTimeout(timeout);
        this.peer = peer;
        this.code = code;
        peer.on('connection', conn => this._accept(conn));
        peer.on('error', err => { if (this.onError) this.onError(err); });
        resolve(code);
      });
      peer.on('error', err => { clearTimeout(timeout); reject(err); });
    });
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
  // Nothing here is recoverable by a heartbeat either: the lobby heartbeat
  // repeats HOST state to clients. Client input has no repeating channel at all.
  send(msg) {
    const kind = (msg && msg.t) || (msg && msg.kind) || typeof msg;
    if (!this.conn) return this._drop(kind, 'no connection to the host');
    if (!this.conn.open) return this._drop(kind, 'channel to the host not open');
    try { this.conn.send(msg); } catch (err) { this._drop(kind, `send threw: ${err && err.message}`); }
  }

  _drop(kind, why) {
    this.drops = (this.drops || 0) + 1;
    const led = (typeof window !== 'undefined' && window.uvNet) || null;
    if (led) {
      led.drops = (led.drops || 0) + 1;
      (led.dropLog ||= []).push({ peer: 'host', kind, why });
      if (led.dropLog.length > 50) led.dropLog.shift();
    }
    console.warn(`[net] DROPPED ${kind} for peer host: ${why}. This is CLIENT INPUT — it has no repeating channel and no snapshot to heal from, so it is simply lost.`);
  }

  close() {
    this.closed = true;
    if (this.peer) { try { this.peer.destroy(); } catch { /* ignore */ } }
    this.peer = null;
    this.conn = null;
  }
}
