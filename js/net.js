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

  send(peerKey, msg) {
    const c = this.conns.get(peerKey);
    if (c && c.open) { try { c.send(msg); } catch { /* peer racing a close */ } }
  }

  broadcast(msg) {
    for (const c of this.conns.values()) {
      if (c.open) { try { c.send(msg); } catch { /* ignore */ } }
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
        else if (this.onDisconnect && !this.closed) { this.closed = true; this.onDisconnect(); }
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

  send(msg) {
    if (this.conn && this.conn.open) { try { this.conn.send(msg); } catch { /* ignore */ } }
  }

  close() {
    this.closed = true;
    if (this.peer) { try { this.peer.destroy(); } catch { /* ignore */ } }
    this.peer = null;
    this.conn = null;
  }
}
