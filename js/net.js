// Online-Verbindung Browser-zu-Browser über PeerJS
(function () {
  const PREFIX = 'goofyaschach-v1-';
  const Net = {
    peer: null, conn: null, role: null,
    onOpen: null, onMessage: null, onClose: null, onError: null,

    makeCode() {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let s = '';
      for (let i = 0; i < 5; i++) s += chars[(Math.random() * chars.length) | 0];
      return s;
    },

    host(onReady) {
      this.role = 'host';
      const code = this.makeCode();
      const peer = new Peer(PREFIX + code);
      this.peer = peer;
      peer.on('open', () => onReady(code));
      peer.on('connection', (c) => {
        if (this.conn && this.conn.open) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); }); return; }
        this.setup(c);
      });
      peer.on('error', (e) => {
        if (e.type === 'unavailable-id') { peer.destroy(); this.host(onReady); return; }
        this.onError && this.onError(e);
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
    },

    join(code) {
      this.role = 'guest';
      const peer = new Peer();
      this.peer = peer;
      peer.on('open', () => this.setup(peer.connect(PREFIX + code.toUpperCase().trim(), { reliable: true })));
      peer.on('error', (e) => this.onError && this.onError(e));
    },

    setup(c) {
      this.conn = c;
      c.on('open', () => this.onOpen && this.onOpen());
      c.on('data', (d) => this.onMessage && this.onMessage(d));
      c.on('close', () => { if (this.conn === c) this.conn = null; this.onClose && this.onClose(); });
      c.on('error', (e) => this.onError && this.onError(e));
    },

    send(d) {
      if (this.conn && this.conn.open) this.conn.send(d);
    },
  };
  window.Net = Net;
})();
