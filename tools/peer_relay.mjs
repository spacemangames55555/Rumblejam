// Dev tool: minimal PeerServer-compatible signaling relay with zero deps.
// Implements just enough of the peerjs-server protocol for two local browsers
// to exchange WebRTC offers/answers/candidates:
//   GET  …/id            → plain-text random peer id
//   WS   …/peerjs?id=X   → {"type":"OPEN"}, then forwards OFFER/ANSWER/
//                          CANDIDATE/LEAVE frames by dst, stamping src.
// The actual game traffic never touches this process (WebRTC is p2p).
// Usage: node tools/peer_relay.mjs [port]   (default 9500)

import http from 'http';
import crypto from 'crypto';

const PORT = parseInt(process.argv[2] || '9500', 10);
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const peers = new Map(); // id -> {socket, send}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url.includes('/id')) {
    res.setHeader('Content-Type', 'text/plain');
    res.end('relay-' + crypto.randomBytes(8).toString('hex'));
  } else if (req.url.includes('/peers')) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify([...peers.keys()]));
  } else {
    res.end('undervault peer relay up');
  }
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const q = new URLSearchParams((req.url.split('?')[1] || ''));
  const id = q.get('id');
  const send = obj => {
    try { socket.write(encodeFrame(JSON.stringify(obj))); } catch { /* gone */ }
  };
  if (!id) { send({ type: 'ERROR', payload: { msg: 'no id' } }); socket.destroy(); return; }
  if (peers.has(id)) { send({ type: 'ID-TAKEN', payload: { msg: 'ID is taken' } }); socket.end(); return; }
  peers.set(id, { socket, send });
  console.log(`+ ${id} (${peers.size} connected)`);
  send({ type: 'OPEN' });

  let buf = Buffer.alloc(0);
  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      const frame = decodeFrame(buf);
      if (!frame) break;
      buf = buf.slice(frame.total);
      if (frame.opcode === 8) { socket.end(); return; }
      if (frame.opcode === 9) { socket.write(encodeFrame(frame.payload, 10)); continue; } // ping→pong
      if (frame.opcode !== 1) continue;
      let msg;
      try { msg = JSON.parse(frame.payload.toString('utf8')); } catch { continue; }
      if (msg.type === 'HEARTBEAT') continue;
      const dst = msg.dst;
      const target = dst && peers.get(dst);
      if (target) target.send({ ...msg, src: id });
      else if (dst) send({ type: 'EXPIRE', src: dst, dst: id });
    }
  });
  const drop = () => {
    if (peers.get(id) && peers.get(id).socket === socket) {
      peers.delete(id);
      console.log(`- ${id} (${peers.size} connected)`);
      // tell everyone (cheap): peers listen for LEAVE of their partners
      for (const p of peers.values()) p.send({ type: 'LEAVE', src: id });
    }
  };
  socket.on('close', drop);
  socket.on('error', drop);
});

function encodeFrame(data, opcode = 1) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode; header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode; header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function decodeFrame(buf) {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let off = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); off = 4; }
  else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); off = 10; }
  const maskLen = masked ? 4 : 0;
  if (buf.length < off + maskLen + len) return null;
  let payload = buf.slice(off + maskLen, off + maskLen + len);
  if (masked) {
    const mask = buf.slice(off, off + 4);
    payload = Buffer.from(payload);
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
  }
  return { opcode, payload, total: off + maskLen + len };
}

server.listen(PORT, () => console.log(`peer relay listening on :${PORT}`));
