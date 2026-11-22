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

    reset() {
      try { if (this.conn) this.conn.close(); } catch (e) {}
      try { if (this.peer) this.peer.destroy(); } catch (e) {}
      this.conn = null;
      this.peer = null;
    },

    // fixedCode: Raum nach Neuladen mit gleichem Code wieder öffnen
    host(onReady, fixedCode, tries) {
      this.role = 'host';
      const code = fixedCode || this.makeCode();
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
        if (e.type === 'unavailable-id') {
          peer.destroy();
          if (!fixedCode) { this.host(onReady); return; }
          // Alte Verbindung des Codes wird vom Server erst kurz danach freigegeben
          if ((tries || 0) < 20) { setTimeout(() => this.host(onReady, fixedCode, (tries || 0) + 1), 2000); return; }
        }
        if (e.type === 'peer-unavailable') return;
        this.onError && this.onError(e);
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
    },

    join(code) {
      this.role = 'guest';
      this.reset();
      const peer = new Peer();
      this.peer = peer;
      peer.on('open', () => {
        const c = peer.connect(PREFIX + code.toUpperCase().trim(), { reliable: true });
        this.conn = c;
        c.on('open', () => this.onOpen && this.onOpen());
        c.on('data', (d) => this.onMessage && this.onMessage(d));
        c.on('close', () => { if (this.conn === c) this.onClose && this.onClose(); });
        c.on('error', (e) => { if (this.conn === c) this.onError && this.onError(e); });
      });
      peer.on('error', (e) => { if (this.peer === peer) this.onError && this.onError(e); });
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
