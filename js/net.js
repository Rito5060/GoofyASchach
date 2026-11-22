// Online-Verbindung Browser-zu-Browser über PeerJS (1 Host + bis zu 3 Gäste)
(function () {
  const PREFIX = 'goofyaschach-v2-';
  const Net = {
    peer: null, conn: null, role: null,
    // Host-Callbacks
    onGuestOpen: null, onGuestData: null, onGuestClose: null,
    // Gast-Callbacks
    onOpen: null, onMessage: null, onClose: null,
    onError: null,

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
        c.on('open', () => this.onGuestOpen && this.onGuestOpen(c));
        c.on('data', (d) => this.onGuestData && this.onGuestData(c, d));
        c.on('close', () => this.onGuestClose && this.onGuestClose(c));
        c.on('error', () => {});
      });
      peer.on('error', (e) => {
        if (e.type === 'unavailable-id') { peer.destroy(); this.host(onReady); return; }
        if (e.type === 'peer-unavailable') return;
        this.onError && this.onError(e);
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
    },

    join(code) {
      this.role = 'guest';
      const peer = new Peer();
      this.peer = peer;
      peer.on('open', () => {
        const c = peer.connect(PREFIX + code.toUpperCase().trim(), { reliable: true });
        this.conn = c;
        c.on('open', () => this.onOpen && this.onOpen());
        c.on('data', (d) => this.onMessage && this.onMessage(d));
        c.on('close', () => this.onClose && this.onClose());
        c.on('error', (e) => this.onError && this.onError(e));
      });
      peer.on('error', (e) => this.onError && this.onError(e));
    },

    send(d) {
      if (this.conn && this.conn.open) this.conn.send(d);
    },
    sendTo(c, d) {
      if (c && c.open) c.send(d);
    },
  };
  window.Net = Net;
})();
