// GoofyASchach – Oberfläche, Lobby, Rendering, Effekte
(function () {
  const E = Engine;
  const $ = (s) => document.querySelector(s);
  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const SEAT_ROT = { S: 0, W: 1, N: 2, E: 3 };
  const PCOL = {
    white: ['#ffffff', '#e6e6e6', '#bdbdbd'], black: ['#1d1d1f', '#4a4a50', '#777'],
    red: ['#e63946', '#ff8a8a', '#ffd0d0'], blue: ['#3a6ff7', '#9db8ff', '#dbe5ff'],
    yellow: ['#f4c430', '#ffe58a', '#fff5cc'], green: ['#2fb36a', '#8fe3b0', '#d5f7e3'],
  };

  let state = null;
  let role = null; // 'local' | 'host' | 'guest'
  let myIdx = null;
  let selected = null;
  let targeting = null; // { id, step, first }
  const opts = { mode: 'chaos', teams: false, local: 2 };
  let roomCode = '';
  const lobby = []; // Host: [{ name, conn }]
  const pieceEls = new Map();
  let squares = [];
  let reconnecting = false, retries = 0, retryTimer = null;
  const CID = (() => {
    const mk = () => Math.random().toString(36).slice(2, 10);
    try {
      let c = sessionStorage.getItem('gs-cid');
      if (!c) { c = mk(); sessionStorage.setItem('gs-cid', c); }
      return c;
    } catch (e) { return mk(); }
  })();
  let builtN = 0;

  // ---------- Lobby-Bedienelemente ----------
  function seg(id, key, cast) {
    document.querySelectorAll(`#${id} button`).forEach((b) =>
      b.addEventListener('click', () => {
        opts[key] = cast(b.dataset.v);
        document.querySelectorAll(`#${id} button`).forEach((x) => x.classList.toggle('on', x === b));
        Sound.play('click');
      })
    );
  }
  seg('modeSeg', 'mode', (v) => v);
  seg('teamSeg', 'teams', (v) => v === 'teams');
  seg('localSeg', 'local', (v) => +v);

  const nameInput = $('#playerName');
  try { nameInput.value = localStorage.getItem('gs-name') || ''; } catch (e) {}
  function myName() {
    const n = nameInput.value.trim().slice(0, 14);
    try { localStorage.setItem('gs-name', n); } catch (e) {}
    return n || 'Spieler';
  }

  function lobbyStatus(msg, isErr) {
    const el = $('#lobbyStatus');
    el.textContent = msg || '';
    el.classList.toggle('err', !!isErr);
  }
  const peerMissing = () => typeof Peer === 'undefined';

  function showRoom() {
    $('#lobbyMain').classList.add('hidden');
    $('#roomPanel').classList.remove('hidden');
  }
  function summary(mode, teams) {
    return (mode === 'chaos' ? 'Chaos' : 'Klassisch') + ' · ' + (teams ? '2 gegen 2' : 'Jeder gegen jeden');
  }

  function renderRoom(names, you, mode, teams) {
    $('#roomCode').textContent = roomCode || '·····';
    $('#roomSummary').textContent = summary(mode, teams);
    $('#roomCount').textContent = `(${names.length}/4)`;
    const colors = { 2: ['white', 'black'], 3: ['red', 'blue', 'yellow'], 4: ['red', 'blue', 'yellow', 'green'] }[Math.max(2, names.length)];
    const rows = names.map((n, i) => `<li><span class="dot c-${colors[i] || 'white'}"></span>${esc(n)}${i === you ? ' <small>du</small>' : i === 0 ? ' <small>Host</small>' : ''}</li>`);
    for (let i = names.length; i < 4; i++) rows.push('<li class="empty">Freier Platz</li>');
    $('#roomPlayers').innerHTML = rows.join('');
    if (role === 'host') {
      $('#btnStart').classList.remove('hidden');
      $('#btnStart').disabled = names.length < 2;
      let hint = names.length < 2 ? 'Schick den Link an deine Freunde.' : `${names.length} Spieler bereit.`;
      if (teams && names.length !== 4) hint += ' 2 gegen 2 braucht 4 Spieler, sonst jeder gegen jeden.';
      $('#roomHint').textContent = hint;
    } else {
      $('#btnStart').classList.add('hidden');
      $('#linkRow').classList.add('hidden');
      $('#roomHint').textContent = 'Warte, bis der Host das Spiel startet…';
    }
  }

  $('#btnCreate').addEventListener('click', () => {
    Sound.play('click');
    if (peerMissing()) return lobbyStatus('Online-Bibliothek konnte nicht geladen werden. Internet prüfen!', true);
    role = 'host';
    myIdx = 0;
    lobby.length = 0;
    lobby.push({ name: myName(), conn: null });
    showRoom();
    renderRoom(lobby.map((p) => p.name), 0, opts.mode, opts.teams);
    $('#roomHint').textContent = 'Erstelle Raum…';
    Net.host((code) => {
      roomCode = code;
      $('#roomLink').value = location.origin + location.pathname + '?room=' + code;
      renderRoom(lobby.map((p) => p.name), 0, opts.mode, opts.teams);
    });
  });

  $('#btnCopy').addEventListener('click', () => {
    const v = $('#roomLink').value;
    const done = () => { $('#btnCopy').textContent = 'Kopiert'; setTimeout(() => ($('#btnCopy').textContent = 'Kopieren'), 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(v).then(done, () => { $('#roomLink').select(); document.execCommand('copy'); done(); });
    else { $('#roomLink').select(); document.execCommand('copy'); done(); }
  });

  function join(code) {
    code = (code || '').trim().toUpperCase();
    if (!code) return lobbyStatus('Bitte einen Raum-Code eingeben.', true);
    if (peerMissing()) return lobbyStatus('Online-Bibliothek konnte nicht geladen werden. Internet prüfen!', true);
    role = 'guest';
    roomCode = code;
    lobbyStatus('Verbinde mit Raum ' + code + '…');
    $('#btnJoin').disabled = true;
    Net.join(code);
  }
  $('#btnJoin').addEventListener('click', () => { Sound.play('click'); join($('#joinCode').value); });
  $('#joinCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') join($('#joinCode').value); });

  $('#btnLocal').addEventListener('click', () => {
    Sound.play('click');
    role = 'local';
    const colorNames = { 2: ['Weiß', 'Schwarz'], 3: ['Rot', 'Blau', 'Gelb'], 4: ['Rot', 'Blau', 'Gelb', 'Grün'] }[opts.local];
    state = E.newGame({ mode: opts.mode, teams: opts.teams, names: colorNames });
    myIdx = state.turn;
    startGame();
    render([startBanner()]);
  });

  $('#btnLeave').addEventListener('click', () => (location.href = location.pathname));

  function startBanner() {
    return state.mode === 'chaos'
      ? { type: 'banner', ico: 'fire', title: 'Chaos-Schach!', sub: 'Schlag einen König, um seine Armee zu übernehmen', sound: 'event' }
      : { type: 'banner', ico: 'knight', title: 'Los geht\'s!', sub: state.players.length === 2 ? 'Klassisches Schach' : 'Schlag die Könige deiner Gegner', sound: 'event' };
  }

  // ---------- Host ----------
  function broadcastLobby() {
    const names = lobby.map((p) => p.name);
    lobby.forEach((p, i) => p.conn && Net.sendTo(p.conn, { t: 'lobby', names, you: i, code: roomCode, mode: opts.mode, teams: opts.teams }));
    renderRoom(names, 0, opts.mode, opts.teams);
  }
  function broadcastState(fx) {
    lobby.forEach((p, i) => p.conn && Net.sendTo(p.conn, { t: 'state', s: state, fx, you: i }));
    saveHost();
  }
  // Host speichert das Spiel, um es nach Neuladen fortsetzen zu können
  function saveHost() {
    if (role !== 'host' || !state) return;
    try {
      if (state.winners) { localStorage.removeItem('gs-host'); return; }
      localStorage.setItem('gs-host', JSON.stringify({ code: roomCode, state, lobby: lobby.map((p) => ({ name: p.name, cid: p.cid || '' })), opts, t: Date.now() }));
    } catch (e) {}
  }
  function loadHostSave() {
    try {
      const sv = JSON.parse(localStorage.getItem('gs-host') || 'null');
      if (sv && sv.state && !sv.state.winners && Date.now() - sv.t < 3 * 3600 * 1000) return sv;
    } catch (e) {}
    return null;
  }
  function resumeHost(sv) {
    role = 'host';
    myIdx = 0;
    roomCode = sv.code;
    Object.assign(opts, sv.opts || {});
    lobby.length = 0;
    sv.lobby.forEach((p) => lobby.push({ name: p.name, cid: p.cid, conn: null }));
    lobbyStatus('Öffne Raum ' + sv.code + ' wieder… (kann bis zu 40 Sek. dauern)');
    Net.host(() => {
      state = sv.state;
      startGame();
      const fx = [{ type: 'banner', ico: 'plug', title: 'Spiel fortgesetzt', sub: 'Deine Freunde verbinden sich automatisch neu' }];
      render(fx);
      saveHost();
      // Wer nach 45 Sekunden nicht zurück ist, wird übersprungen
      setTimeout(() => {
        const out = [];
        lobby.forEach((p, i) => { if (i > 0 && !p.conn && !state.players[i].offline) out.push(...(E.setOffline(state, i, true) || [])); });
        if (out.length || lobby.some((p, i) => i > 0 && !p.conn)) { broadcastState(out); render(out); }
      }, 45000);
    }, sv.code);
  }
  const save = !new URLSearchParams(location.search).get('room') && loadHostSave();
  if (save) {
    const box = $('#resumeBox');
    box.classList.remove('hidden');
    $('#resumeInfo').textContent = `Raum ${save.code} · ${save.state.players.map((p) => p.name).join(', ')}`;
    $('#btnResume').addEventListener('click', () => { Sound.play('click'); box.classList.add('hidden'); resumeHost(save); });
    $('#btnDiscard').addEventListener('click', () => { try { localStorage.removeItem('gs-host'); } catch (e) {} box.classList.add('hidden'); });
  }

  Net.onGuestOpen = () => {};
  Net.onGuestData = (c, d) => {
    if (!d || typeof d !== 'object') return;
    if (d.t === 'join') {
      const cid = String(d.cid || '');
      const name = String(d.name || 'Spieler').slice(0, 14);
      const reject = () => { Net.sendTo(c, { t: 'full', started: !!state }); setTimeout(() => c.close(), 400); };
      if (state) {
        // Wiederverbinden: gleicher Browser-Tab oder gleicher Name auf freiem Platz
        let idx = lobby.findIndex((p, i) => i > 0 && cid && p.cid === cid);
        if (idx < 0) idx = lobby.findIndex((p, i) => i > 0 && (!p.conn || !p.conn.open) && p.name === name);
        if (idx > 0 && (!lobby[idx].conn || !lobby[idx].conn.open || lobby[idx].cid === cid)) {
          lobby[idx].conn = c;
          lobby[idx].cid = cid;
          const fx = E.setOffline(state, idx, false) || [];
          fx.push({ type: 'banner', ico: 'plug', title: `${state.players[idx].name} ist zurück!`, sub: 'Weiter geht\'s' });
          broadcastState(fx);
          render(fx);
          return;
        }
        return reject();
      }
      const ex = lobby.findIndex((p, i) => i > 0 && cid && p.cid === cid);
      if (ex > 0) { lobby[ex].conn = c; lobby[ex].name = name; }
      else if (lobby.length >= 4) return reject();
      else lobby.push({ name, conn: c, cid });
      Sound.play('spawn');
      broadcastLobby();
    } else if (d.t === 'action' && state) {
      const idx = lobby.findIndex((p) => p.conn === c);
      if (idx > 0) handleAction(d.a, idx);
    }
  };
  Net.onGuestClose = (c) => {
    const idx = lobby.findIndex((p) => p.conn === c);
    if (idx < 0) return;
    if (!state) {
      lobby.splice(idx, 1);
      broadcastLobby();
    } else {
      lobby[idx].conn = null;
      const name = state.players[idx].name;
      toast(`${name} hat die Verbindung verloren – warte 20 Sek.`, 'plug', 'atk');
      // Kurze Gnadenfrist zum Wiederverbinden, erst dann wird übersprungen
      setTimeout(() => {
        if (!state || lobby[idx].conn || state.players[idx].offline) return;
        const fx = E.setOffline(state, idx, true) || [];
        fx.push({ type: 'banner', ico: 'plug', title: `${name} ist weg`, sub: 'Seine Züge werden übersprungen, bis er zurück ist' });
        broadcastState(fx);
        render(fx);
      }, 20000);
    }
  };

  $('#btnStart').addEventListener('click', () => {
    if (role !== 'host' || lobby.length < 2) return;
    Sound.play('click');
    state = E.newGame({ mode: opts.mode, teams: opts.teams, names: lobby.map((p) => p.name) });
    startGame();
    const fx = [startBanner()];
    broadcastState(fx);
    render(fx);
  });

  // ---------- Gast ----------
  Net.onOpen = () => Net.send({ t: 'join', name: myName(), cid: CID });
  Net.onMessage = (d) => {
    if (!d || typeof d !== 'object') return;
    if (d.t === 'lobby') {
      myIdx = d.you;
      roomCode = d.code;
      showRoom();
      renderRoom(d.names, d.you, d.mode, d.teams);
    } else if (d.t === 'state') {
      if (reconnecting) {
        reconnecting = false;
        clearTimeout(retryTimer);
        toast('Wieder verbunden', 'plug', 'sup');
      }
      state = d.s;
      myIdx = d.you;
      if ($('#game').classList.contains('hidden')) startGame();
      if (state.turn !== myIdx) { selected = null; targeting = null; }
      if (selected) {
        const p = state.board[selected.r][selected.c];
        if (!p || p.owner !== myIdx) selected = null;
      }
      render(d.fx || []);
    } else if (d.t === 'full') {
      lobbyStatus(d.started ? 'Das Spiel in diesem Raum läuft schon.' : 'Dieser Raum ist voll (4/4).', true);
      $('#btnJoin').disabled = false;
    }
  };
  Net.onClose = () => {
    if (state && !state.winners) startReconnect();
    else if (!state) { lobbyStatus('Verbindung zum Raum verloren.', true); $('#btnJoin').disabled = false; }
  };
  function startReconnect() {
    if (reconnecting) return;
    reconnecting = true;
    retries = 0;
    queueBanner({ ico: 'plug', title: 'Verbindung weg', sub: 'Verbinde automatisch neu…' });
    tryReconnect();
  }
  function tryReconnect() {
    if (!reconnecting) return;
    if (++retries > 45) {
      reconnecting = false;
      queueBanner({ ico: 'plug', title: 'Keine Verbindung', sub: 'Öffne den Raum-Link neu, um wieder einzusteigen' });
      return;
    }
    renderConn();
    Net.join(roomCode);
    retryTimer = setTimeout(tryReconnect, 4000);
  }
  function renderConn() {
    const el = $('#connState');
    if (!el) return;
    el.classList.toggle('hidden', !reconnecting);
    el.textContent = `Verbinde neu… (Versuch ${retries})`;
  }
  Net.onError = (e) => {
    if (reconnecting) return; // nächster Versuch läuft automatisch
    const map = {
      'peer-unavailable': 'Raum nicht gefunden. Stimmt der Code?',
      network: 'Netzwerkfehler – Internetverbindung prüfen.',
      'server-error': 'Verbindungsserver nicht erreichbar.',
      'browser-incompatible': 'Dein Browser unterstützt das leider nicht.',
    };
    lobbyStatus(map[e.type] || 'Fehler: ' + (e.type || e), true);
    $('#btnJoin').disabled = false;
  };

  // ---------- Aktionen ----------
  const me = () => (role === 'local' ? state.turn : myIdx);
  const canAct = () => state && !state.winners && state.turn === me() && state.players[me()].alive;

  function dispatch(a) {
    selected = null;
    targeting = null;
    if (role === 'guest') { Net.send({ t: 'action', a }); render([]); }
    else handleAction(a, role === 'local' ? state.turn : 0);
  }

  function handleAction(a, who) {
    if (!a || !state) return;
    let fx = null;
    if (a.type === 'move') fx = E.doMove(state, who, a.fr, a.fc, a.tr, a.tc);
    else if (a.type === 'ability') fx = E.useAbility(state, who, a.id, a.target);
    else if (a.type === 'pass') fx = E.doPass(state, who);
    else if (a.type === 'rematch') {
      if (!state.winners) return;
      const offline = state.players.map((p) => p.offline);
      state = E.newGame({ mode: state.mode, teams: state.teams, names: state.players.map((p) => p.name) });
      offline.forEach((o, i) => { if (o) state.players[i].offline = true; });
      fx = [{ type: 'banner', ico: 'rematch', title: 'Revanche!', sub: 'Neues Spiel, neues Chaos', sound: 'event' }];
    }
    if (!fx) return;
    if (role === 'host') broadcastState(fx);
    if (role === 'local') myIdx = state.turn;
    render(fx);
  }

  // ---------- Spielbildschirm ----------
  function startGame() {
    $('#lobby').classList.add('hidden');
    $('#game').classList.remove('hidden');
    $('#modeTag').textContent = (state.mode === 'chaos' ? 'Chaos' : 'Klassisch') + ' · ' + state.players.length + ' Spieler' + (state.teams ? ' · Teams' : '');
    $('#modeTag').classList.remove('hidden');
  }

  function buildBoard() {
    const n = state.n;
    const host = $('#squares');
    host.innerHTML = '';
    $('#pieces').innerHTML = '';
    $('#decals').innerHTML = '';
    pieceEls.clear();
    squares = [];
    $('#board').style.setProperty('--n', n);
    $('#board').classList.toggle('cross', n === 14);
    for (let i = 0; i < n * n; i++) {
      const el = document.createElement('div');
      el.className = 'sq';
      el.innerHTML = '<i class="mk"></i>';
      el.addEventListener('click', () => { if (el.dataset.r !== undefined) onSquare(+el.dataset.r, +el.dataset.c); });
      host.appendChild(el);
      squares.push(el);
    }
    builtN = n;
  }

  function quarter() {
    const base = role === 'local' ? 0 : SEAT_ROT[state.players[myIdx].seat];
    return (base + state.rot) % 4;
  }
  function toView(r, c) {
    const n = state.n, k = quarter();
    if (k === 0) return [r, c];
    if (k === 1) return [n - 1 - c, r];
    if (k === 2) return [n - 1 - r, n - 1 - c];
    return [c, n - 1 - r];
  }
  function fromView(vr, vc) {
    const n = state.n, k = quarter();
    if (k === 0) return [vr, vc];
    if (k === 1) return [vc, n - 1 - vr];
    if (k === 2) return [n - 1 - vr, n - 1 - vc];
    return [n - 1 - vc, vr];
  }

  function onSquare(r, c) {
    Sound.init();
    if (!canAct()) return;
    if (targeting) {
      const t = targeting;
      if (!E.validTarget(state, me(), t.id, r, c, t.step)) return;
      const ab = E.ABILITIES.find((a) => a.id === t.id);
      if (ab.then && t.step === 1) {
        targeting = { id: t.id, step: 2, first: { r, c } };
        Sound.play('click');
        render([]);
        return;
      }
      const target = t.step === 2 ? { r: t.first.r, c: t.first.c, r2: r, c2: c } : { r, c };
      if (t.step === 2 && r === t.first.r && c === t.first.c) return;
      dispatch({ type: 'ability', id: t.id, target });
      return;
    }
    const p = state.board[r][c];
    if (selected) {
      if (E.legalMoves(state, selected.r, selected.c).some((m) => m.r === r && m.c === c)) {
        dispatch({ type: 'move', fr: selected.r, fc: selected.c, tr: r, tc: c });
        return;
      }
    }
    if (p && p.owner === me()) {
      selected = selected && selected.r === r && selected.c === c ? null : { r, c };
      Sound.play('click');
    } else selected = null;
    render([]);
  }

  // ---------- Rendern ----------
  function render(fx) {
    if (!state) return;
    if (builtN !== state.n) buildBoard();
    const hints = { delayed: {}, warp: new Set(), from: {}, drop: new Set(), kill: {} };
    let lastWho = null;
    for (const f of fx) {
      if (f.type === 'ability') lastWho = f.who;
      if (f.type === 'capture') {
        if (f.delay) hints.delayed[f.r + ',' + f.c] = f.delay;
        hints.kill[f.r + ',' + f.c] = f.kind;
      }
      if (f.type === 'teleport') { hints.warp.add(f.r + ',' + f.c); hints.warp.add(f.r2 + ',' + f.c2); }
      if (f.type === 'clone') hints.from[f.r + ',' + f.c] = [f.fr, f.fc];
      if (f.type === 'spawn' && f.kind === 'drop') hints.drop.add(f.r + ',' + f.c);
      if (f.type === 'bombDrop') f.who = lastWho;
    }
    renderBoard();
    renderPieces(hints);
    renderPanels();
    processFx(fx);
  }

  function renderBoard() {
    const n = state.n;
    const moves = selected ? E.legalMoves(state, selected.r, selected.c) : [];
    const lm = state.lastMove;
    const kings = new Set();
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const p = state.board[r][c];
      if (p && p.type === 'k' && state.check.includes(p.owner)) kings.add(r + ',' + c);
    }
    const mine = me();
    squares.forEach((el, i) => {
      const vr = (i / n) | 0, vc = i % n;
      const [r, c] = fromView(vr, vc);
      el.dataset.r = r;
      el.dataset.c = c;
      if (!E.valid(state, r, c)) { el.className = 'sq void'; el.dataset.lbl = ''; return; }
      el.dataset.lbl = n === 8 && vc === 0 ? String(8 - r) : '';
      let cls = 'sq ' + ((r + c) % 2 ? 'dark' : 'light');
      if (E.isLava(state, r, c)) cls += ' lava';
      if (E.isIce(state, r, c)) cls += ' ice';
      if (lm && ((lm.fr === r && lm.fc === c) || (lm.tr === r && lm.tc === c))) cls += ' last';
      if (selected && selected.r === r && selected.c === c) cls += ' sel';
      if (targeting && targeting.first && targeting.first.r === r && targeting.first.c === c) cls += ' sel';
      if (moves.some((m) => m.r === r && m.c === c)) cls += state.board[r][c] ? ' move cap' : ' move';
      if (kings.has(r + ',' + c)) cls += ' check';
      if (targeting && E.validTarget(state, mine, targeting.id, r, c, targeting.step)) cls += ' tgt';
      if (canAct() && !targeting && state.board[r][c] && state.board[r][c].owner === mine) cls += ' own';
      el.className = cls;
    });
    $('#board').classList.toggle('targeting', !!targeting);
  }

  function restartAnim(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function renderPieces(hints) {
    const delayed = hints.delayed;
    const layer = $('#pieces');
    const seen = new Set();
    const firstRender = pieceEls.size === 0;
    const n = state.n;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const p = state.board[r][c];
        if (!p) continue;
        seen.add(p.id);
        let el = pieceEls.get(p.id);
        const [vr, vc] = toView(r, c);
        const tf = `translate(${vc * 100}%, ${vr * 100}%)`;
        const key = r + ',' + c;
        if (!el) {
          el = document.createElement('div');
          el.className = 'piece';
          el.innerHTML = '<span></span><i></i>';
          el.style.transition = 'none';
          const src = hints.from[key];
          if (src) { const [fr, fc] = toView(src[0], src[1]); el.style.transform = `translate(${fc * 100}%, ${fr * 100}%)`; }
          else el.style.transform = tf;
          layer.appendChild(el);
          void el.offsetWidth;
          el.style.transition = '';
          pieceEls.set(p.id, el);
          if (!firstRender) restartAnim(el.firstChild, hints.drop.has(key) ? 'drop' : src ? 'ghost' : 'spawn');
        } else if (el.style.transform !== tf) {
          if (hints.warp.has(key)) {
            el.style.transition = 'none';
            el.style.transform = tf;
            void el.offsetWidth;
            el.style.transition = '';
            restartAnim(el.firstChild, 'warp');
          } else {
            el.style.transform = tf;
            restartAnim(el, 'landing');
          }
        }
        el.style.transform = tf;
        el.dataset.pos = r + ',' + c;
        if (el.dataset.type !== p.type) {
          if (el.dataset.type) restartAnim(el.firstChild, 'morph');
          el.dataset.type = p.type;
          el.firstChild.textContent = GLYPH[p.type] + '︎';
        }
        const col = 'c-' + state.players[p.owner].color;
        if (el.dataset.col !== col) {
          if (el.dataset.col) el.classList.remove(el.dataset.col);
          el.classList.add(col);
          el.dataset.col = col;
        }
        const isShield = E.shielded(state, p), isFrozen = E.frozen(state, p), isPoison = !!p.poison;
        el.classList.toggle('shielded', isShield);
        el.classList.toggle('frozen', isFrozen);
        el.lastChild.textContent = isPoison ? '🧪' : isFrozen ? '❄️' : '';
        el.classList.toggle('king-danger', p.type === 'k' && state.check.includes(p.owner));
      }
    for (const [id, el] of pieceEls) {
      if (seen.has(id)) continue;
      pieceEls.delete(id);
      const d = delayed[el.dataset.pos] || 0;
      const kind = hints.kill[el.dataset.pos];
      const ang = Math.random() * Math.PI * 2;
      const dist = kind === 'boom' ? 220 : 140;
      el.style.setProperty('--dx', Math.cos(ang) * dist + '%');
      el.style.setProperty('--dy', (Math.sin(ang) * dist * 0.5 - 160) + '%');
      el.style.setProperty('--rot', (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 300) + 'deg');
      el.style.zIndex = 5;
      setTimeout(() => {
        el.classList.add(kind === 'poison' || kind === 'burn' ? 'melting' : 'dying');
        setTimeout(() => el.remove(), 750);
      }, d);
    }
  }

  function renderPanels() {
    const chaos = state.mode === 'chaos';
    const mine = me();

    // Spielerleiste
    $('#players').innerHTML = state.players.map((pl, i) => {
      const badges = [];
      if (!pl.alive) badges.push('<span class="pb gray">raus</span>');
      else {
        if (state.check.includes(i)) badges.push('<span class="pb">Schach</span>');
        if (state.skip === i) badges.push('<span class="pb gray">setzt aus</span>');
        if (pl.offline) badges.push('<span class="pb gray">offline</span>');
      }
      const tag = role !== 'local' && i === myIdx ? ' <small>du</small>' : state.teams ? ` <small>T${pl.team + 1}</small>` : '';
      const cls = ['pl', 'c-' + pl.color];
      if (pl.alive && !state.winners && state.turn === i) cls.push('active');
      if (!pl.alive) cls.push('dead');
      return `<div class="${cls.join(' ')}"><span class="dot"></span><span class="pn">${esc(pl.name)}${tag}</span>${badges.join('')}${chaos ? `<span class="pp">${pl.points} 🪙</span>` : ''}</div>`;
    }).join('');

    // Status
    const cur = state.players[state.turn];
    let st;
    if (state.winners) st = state.winners.length ? `${state.winners.map((i) => state.players[i].name).join(' & ')} gewinnt!` : 'Unentschieden';
    else if (role === 'local') st = `${cur.name} ist dran`;
    else if (!state.players[myIdx].alive) st = `Du bist raus · ${cur.name} ist dran`;
    else st = state.turn === myIdx ? 'Du bist dran' : `${cur.name} ist dran`;
    $('#status').textContent = st;
    $('#status').classList.toggle('mine', canAct() && role !== 'local');

    const info = [];
    if (chaos && !state.winners) {
      const left = state.eventEvery - (state.ply % state.eventEvery);
      info.push(`<span class="chip">Event in ${left} Zug${left === 1 ? '' : 'en'}</span>`);
      if (state.ply < state.doubleUntil) info.push('<span class="chip gold">Doppelte Punkte</span>');
      if (state.bonus) info.push('<span class="chip gold">Extra-Zug · Könige tabu</span>');
      if (state.lava.length) info.push('<span class="chip orange">Lava</span>');
      if (state.ice.length) info.push('<span class="chip blue">Eis</span>');
      for (const r of state.rules || []) {
        const def = E.RULES.find((x) => x.id === r.id);
        const left = r.until - state.ply;
        if (def && left > 0) info.push(`<span class="chip rule" title="${esc(def.desc)}">${Icons.svg('rule-' + r.id)}${def.name} · noch ${left}</span>`);
      }
    }
    renderConn();
    $('#infoChips').innerHTML = info.join('');

    const pass = $('#btnPass');
    if (!pass.dataset.ico) { pass.insertAdjacentHTML('afterbegin', Icons.svg('pass', 'btn-ico')); pass.dataset.ico = 1; }
    pass.classList.toggle('hidden', !chaos);
    pass.disabled = !canAct();
    pass.querySelector('.cost').textContent = '+' + E.PASS_POINTS * (state.ply < state.doubleUntil ? 2 : 1);

    // Shop
    $('#shop').classList.toggle('hidden', !chaos);
    if (chaos) {
      const pts = state.players[mine].points;
      $('#shopPoints').textContent = `${pts} 🪙`;
      const list = $('#abilities');
      if (!list.children.length) {
        for (const ab of E.ABILITIES) {
          const b = document.createElement('button');
          b.className = 'ability';
          b.dataset.id = ab.id;
          b.title = ab.desc;
          b.innerHTML = `<span class="aicon cat-${ab.cat}">${Icons.svg(ab.id)}</span><span class="aname">${ab.name}</span><span class="acost">${ab.cost}</span>`;
          b.addEventListener('click', () => onAbility(ab));
          b.addEventListener('mouseenter', () => showDesc(ab));
          b.addEventListener('mouseleave', () => renderHint());
          list.appendChild(b);
        }
      }
      for (const b of list.children) {
        const ab = E.ABILITIES.find((a) => a.id === b.dataset.id);
        const cost = E.abilityCost(state, ab.id);
        b.querySelector('.acost').textContent = cost;
        b.classList.toggle('sale', cost < ab.cost);
        b.disabled = !canAct() || state.abilityUsed || pts < cost || !!E.abilityBlocked(state, mine, ab.id);
        b.classList.toggle('armed', !!targeting && targeting.id === ab.id);
      }
      renderHint();
      $('#btnCancelTarget').classList.toggle('hidden', !targeting);
    }

    // Verlauf
    $('#log').innerHTML = state.log.slice(-40).reverse().map((l) => `<li>${esc(l)}</li>`).join('');

    // Spielende
    const ov = $('#overlay');
    if (state.winners) {
      let title;
      if (!state.winners.length) title = 'Unentschieden';
      else if (role === 'local') title = `${state.winners.map((i) => state.players[i].name).join(' & ')} gewinnt!`;
      else title = state.winners.includes(myIdx) ? 'Du hast gewonnen!' : 'Verloren!';
      $('#ovTitle').textContent = title;
      $('#ovSub').textContent = state.result || '';
      $('#ovStats').innerHTML = statsHtml();
      ov.classList.remove('hidden');
    } else ov.classList.add('hidden');
  }

  function statsHtml() {
    const pl = state.players;
    const chaos = state.mode === 'chaos';
    const st = pl.map((p) => p.stats || {});
    const best = (key, min) => {
      const v = Math.max(...st.map((x) => x[key] || 0));
      return v >= (min || 1) ? st.map((x, i) => ((x[key] || 0) === v ? i : -1)).filter((i) => i >= 0) : [];
    };
    const awards = [];
    const aw = (ids, title, what) => { if (ids.length === 1) awards.push(`<li><b>${title}</b><span>${esc(pl[ids[0]].name)} · ${what(ids[0])}</span></li>`); };
    aw(best('kills'), 'Schlächter', (i) => `${st[i].kills} Figuren erledigt`);
    aw(best('kings'), 'Königsmörder', (i) => `${st[i].kings} König${st[i].kings > 1 ? 'e' : ''}`);
    if (chaos) {
      aw(best('spent'), 'Shopping-König', (i) => `${st[i].spent} 🪙 ausgegeben`);
      aw(best('passes', 2), 'Faultier', (i) => `${st[i].passes}× gepasst`);
      aw(best('used', 3), 'Zauberer', (i) => `${st[i].used} Fähigkeiten`);
    }
    aw(best('lost', 4), 'Pechvogel', (i) => `${st[i].lost} Figuren verloren`);
    const favAll = {};
    st.forEach((x) => Object.entries(x.fav || {}).forEach(([k, v]) => (favAll[k] = (favAll[k] || 0) + v)));
    const fav = Object.entries(favAll).sort((a, b) => b[1] - a[1])[0];
    let favHtml = '';
    if (fav) {
      const ab = E.ABILITIES.find((a) => a.id === fav[0]);
      favHtml = `<div class="fav"><span class="aicon cat-${ab.cat}">${Icons.svg(ab.id)}</span><span>Beliebteste Fähigkeit: <b>${ab.name}</b> (${fav[1]}×)</span></div>`;
    }
    const head = `<tr><th></th><th>Kills</th><th>Könige</th>${chaos ? '<th>Verdient</th><th>Ausgegeben</th>' : ''}<th>Verloren</th></tr>`;
    const rows = pl.map((p, i) => `<tr class="c-${p.color}"><td><span class="dot"></span>${esc(p.name)}</td><td>${st[i].kills || 0}</td><td>${st[i].kings || 0}</td>${chaos ? `<td>${st[i].earned || 0}</td><td>${st[i].spent || 0}</td>` : ''}<td>${st[i].lost || 0}</td></tr>`).join('');
    return `${awards.length ? `<ul class="awards">${awards.join('')}</ul>` : ''}<table class="stats">${head}${rows}</table>${favHtml}`;
  }

  function showDesc(ab) {
    $('#shopHint').innerHTML = `<b>${ab.name} · ${state ? E.abilityCost(state, ab.id) : ab.cost} 🪙</b><br>${esc(ab.desc)}`;
  }
  function renderHint() {
    if (!state) return;
    let hint;
    if (targeting) {
      const ab = E.ABILITIES.find((a) => a.id === targeting.id);
      const what = {
        square: 'ein Feld', own: 'eine eigene Figur', ownAny: 'eine eigene Figur', ownPawn: 'einen eigenen Bauern',
        enemy: 'eine gegnerische Figur', piece: 'eine Figur', empty: 'ein freies Feld',
      }[targeting.step === 2 ? ab.then : ab.target];
      hint = `<b>${ab.name}</b><br>Wähle ${what}${ab.id === 'swap' && targeting.step === 2 ? ' zum Tauschen' : ''}.`;
    } else if (canAct() && state.abilityUsed) hint = 'Fähigkeit benutzt – jetzt noch ziehen oder passen.';
    else hint = 'Eine Fähigkeit pro Zug. Sie beendet deinen Zug nicht.';
    $('#shopHint').innerHTML = hint;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function onAbility(ab) {
    Sound.init();
    if (!canAct()) return;
    selected = null;
    if (ab.target) {
      targeting = targeting && targeting.id === ab.id ? null : { id: ab.id, step: 1 };
      Sound.play('click');
      render([]);
    } else dispatch({ type: 'ability', id: ab.id });
  }
  $('#btnCancelTarget').addEventListener('click', () => { targeting = null; render([]); });
  $('#btnPass').addEventListener('click', () => { if (canAct()) dispatch({ type: 'pass' }); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (targeting || selected)) { targeting = null; selected = null; render([]); }
  });

  $('#btnRematch').addEventListener('click', () => dispatch({ type: 'rematch' }));
  $('#btnLobby').addEventListener('click', () => (location.href = location.pathname));
  $('#btnMute').addEventListener('click', () => {
    const m = Sound.toggle();
    $('#btnMute').textContent = m ? '🔇' : '🔊';
  });
  $('#btnMute').textContent = Sound.muted ? '🔇' : '🔊';

  // ---------- Effekte ----------
  function center(r, c) {
    const [vr, vc] = toView(r, c);
    const el = squares[vr * state.n + vc];
    const rect = el.getBoundingClientRect();
    return [rect.left + rect.width / 2, rect.top + rect.height / 2];
  }
  function shake(strong) {
    restartAnim($('#boardWrap'), strong ? 'shake-strong' : 'shake');
  }
  function processFx(fx) {
    for (const f of fx) {
      if (f.delay) setTimeout(() => runFx(f), f.delay);
      else runFx(f);
    }
  }

  const SKY = ['#e0f7ff', '#7df9ff', '#ffffff', '#b388ff'];
  const ICE = ['#e3f6fc', '#a5e3f5', '#ffffff', '#5fc4e8'];
  const TOX = ['#7ee35b', '#3a9d23', '#c8ff9e'];
  const GOLD = ['#ffd60a', '#fff3b0', '#ffc300', '#f4c430'];
  const VIOLET = ['#b388ff', '#7c4dff', '#e0d4ff', '#7df9ff'];

  function chipCenter(i) {
    const el = document.querySelectorAll('#players .pl')[i];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }
  function boardCenter() {
    const r = $('#board').getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2, r.width];
  }
  function sqSize() {
    return $('#board').getBoundingClientRect().width / state.n;
  }
  // Schwebendes Icon (DOM), z.B. Krone, Zzz
  function floatIcon(x, y, html, cls) {
    const el = document.createElement('div');
    el.className = 'float-ico ' + (cls || '');
    el.innerHTML = html;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }
  // Brandfleck auf dem Brett
  function scorch(r, c, size) {
    const [vr, vc] = toView(r, c);
    const el = document.createElement('div');
    el.className = 'scorch';
    const n = state.n, s = size || 1;
    el.style.left = ((vc + 0.5) / n) * 100 + '%';
    el.style.top = ((vr + 0.5) / n) * 100 + '%';
    el.style.width = el.style.height = (s / n) * 100 + '%';
    $('#decals').appendChild(el);
    setTimeout(() => el.remove(), 6000);
  }
  function coinsFly(fromIdx, toIdx, amt) {
    const a = chipCenter(fromIdx), b = chipCenter(toIdx);
    if (!a || !b) return;
    for (let i = 0; i < Math.max(1, Math.min(amt, 6)); i++) {
      const el = document.createElement('div');
      el.className = 'coin';
      document.body.appendChild(el);
      const mx = (a[0] + b[0]) / 2, my = Math.min(a[1], b[1]) - 60 - Math.random() * 40;
      el.animate([
        { transform: `translate(${a[0]}px, ${a[1]}px) scale(.6)`, opacity: 0 },
        { transform: `translate(${a[0]}px, ${a[1]}px) scale(1)`, opacity: 1, offset: 0.1 },
        { transform: `translate(${mx}px, ${my}px) scale(1.2)`, offset: 0.5 },
        { transform: `translate(${b[0]}px, ${b[1]}px) scale(.8)`, opacity: 1, offset: 0.95 },
        { transform: `translate(${b[0]}px, ${b[1]}px) scale(.4)`, opacity: 0 },
      ], { duration: 800, delay: i * 90, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'both' });
      setTimeout(() => { el.remove(); if (i === 0) Sound.play('coin'); }, 900 + i * 90);
    }
  }
  function pieceAt(r, c) {
    return document.querySelector(`#pieces .piece[data-pos="${r},${c}"]`);
  }

  function runFx(f) {
    if (!state) return;
    const pos = f.r !== undefined ? center(f.r, f.c) : null;
    const k = state.n === 14 ? 0.7 : 1;
    const sq = sqSize();
    switch (f.type) {
      case 'move': {
        Sound.play('move');
        const lm = state.lastMove;
        if (lm) setTimeout(() => {
          const [x, y] = center(lm.tr, lm.tc);
          FX.burst(x, y + sq * 0.3, { n: 10, colors: ['rgba(60,40,20,.5)', 'rgba(255,255,255,.6)'], speed: 2.2, size: 3, grav: -0.02, life: 25 });
        }, 330);
        break;
      }
      case 'capture':
        if (f.kind === 'poison') {
          FX.burst(pos[0], pos[1], { n: 30, colors: TOX, speed: 3, size: 6 * k, grav: -0.12, glow: true });
          Sound.play('burn');
        } else if (f.kind === 'boom') {
          FX.debris(pos[0], pos[1], PCOL[f.color], 8);
        } else {
          FX.burst(pos[0], pos[1], { n: 40, colors: PCOL[f.color].concat(['#ff5a36', '#f4c430']), speed: 8 * k, size: 7 * k, glow: true });
          FX.debris(pos[0], pos[1], PCOL[f.color], 8);
          FX.ring(pos[0], pos[1], 'rgba(255,255,255,', 70 * k);
          if (f.kind !== 'zap' && f.kind !== 'shot') Sound.play('capture');
          shake(false);
        }
        break;
      case 'bombDrop': {
        const from = (f.who !== null && f.who !== undefined && chipCenter(f.who)) || [pos[0], pos[1] - 300];
        Sound.play('whoosh');
        FX.lob(from[0], from[1], pos[0], pos[1], 40);
        break;
      }
      case 'explode':
        FX.explosion(pos[0], pos[1], f.big);
        FX.flash('#ffb703');
        scorch(f.r, f.c, f.big ? 3 : 2);
        Sound.play('explode');
        shake(true);
        break;
      case 'fuse': {
        const el = pieceAt(f.r, f.c);
        if (el) restartAnim(el, 'fusing');
        Sound.play('fuse');
        break;
      }
      case 'blitz':
        FX.lightning(pos[0], pos[1]);
        scorch(f.r, f.c, 1);
        Sound.play('zap');
        shake(true);
        break;
      case 'snipe': {
        const el = document.createElement('div');
        el.className = 'crosshair';
        el.innerHTML = Icons.svg('sniper');
        el.style.left = pos[0] + 'px';
        el.style.top = pos[1] + 'px';
        el.style.width = el.style.height = sq * 1.3 + 'px';
        document.body.appendChild(el);
        Sound.play('lock');
        setTimeout(() => {
          FX.ring(pos[0], pos[1], 'rgba(230,57,70,', sq * 1.6, { width: 8 });
          FX.burst(pos[0], pos[1], { n: 30, colors: ['#e63946', '#ffffff', '#ff8a8a'], speed: 9, size: 4, glow: true });
          FX.flash('#ffffff');
          Sound.play('shot');
          shake(false);
        }, 720);
        setTimeout(() => el.remove(), 1000);
        break;
      }
      case 'meteor':
        Sound.play('meteorFall');
        FX.meteor(pos[0], pos[1], () => { Sound.play('explode'); scorch(f.r, f.c, 1.5); shake(true); });
        break;
      case 'banner': queueBanner(f); break;
      case 'ability': {
        const ab = E.ABILITIES.find((a) => a.id === f.id);
        toast(`${state.players[f.who].name}: ${f.name}`, f.id, ab && ab.cat);
        const chip = document.querySelectorAll('#players .pl')[f.who];
        if (chip) restartAnim(chip, 'casting');
        Sound.play('cast');
        break;
      }
      case 'pass': {
        toast(`${state.players[f.who].name} passt`, 'pass', 'eco');
        const c = chipCenter(f.who);
        if (c) floatIcon(c[0], c[1] - 10, 'Zzz', 'zzz');
        Sound.play('snore');
        break;
      }
      case 'steal':
        coinsFly(f.from, f.to, f.amt);
        Sound.play('swish');
        break;
      case 'mutate':
        FX.burst(pos[0], pos[1], { n: 40, colors: ['#c77dff', '#7b2cbf', '#e0aaff', '#80ffdb'], speed: 5, size: 6 * k, glow: true, grav: -0.05 });
        FX.ring(pos[0], pos[1], 'rgba(199,125,255,', sq);
        Sound.play('mutate');
        break;
      case 'promote':
        FX.burst(pos[0], pos[1], { n: 50, colors: GOLD, speed: 6, size: 6 * k, glow: true, grav: -0.08 });
        floatIcon(pos[0], pos[1] - sq * 0.4, Icons.svg('crown'), 'crown');
        Sound.play('fanfare');
        break;
      case 'burn':
        FX.burst(pos[0], pos[1], { n: 50, colors: ['#ff4800', '#ff9e00', '#ffd000'], speed: 4, size: 8 * k, glow: true, grav: -0.15 });
        Sound.play('burn');
        break;
      case 'slide':
        FX.burst(pos[0], pos[1], { n: 25, colors: ICE, speed: 4, size: 4, glow: true });
        Sound.play('ice');
        break;
      case 'freeze':
        FX.shards(pos[0], pos[1], ICE);
        FX.ring(pos[0], pos[1], 'rgba(165,227,245,', sq * 1.2, { width: 8 });
        Sound.play('ice');
        break;
      case 'shield':
        FX.ring(pos[0], pos[1], 'rgba(127,212,255,', sq * 1.4, { width: 10, len: 40 });
        FX.ring(pos[0], pos[1], 'rgba(255,255,255,', sq * 0.8, { from: sq * 2, len: 20 });
        FX.burst(pos[0], pos[1], { n: 20, colors: ['#7fd4ff', '#ffffff'], speed: 3, size: 4, glow: true, grav: 0 });
        Sound.play('shield');
        break;
      case 'poison':
        FX.burst(pos[0], pos[1], { n: 30, colors: TOX, speed: 3, size: 6 * k, glow: true, grav: -0.1 });
        floatIcon(pos[0], pos[1] - sq * 0.3, Icons.svg('skull'), 'skull');
        Sound.play('poison');
        break;
      case 'teleport': {
        const p2 = center(f.r2, f.c2);
        FX.implode(pos[0], pos[1], VIOLET);
        Sound.play('warp');
        setTimeout(() => {
          FX.burst(p2[0], p2[1], { n: 34, colors: VIOLET, speed: 5, size: 5, glow: true, grav: 0 });
          FX.ring(p2[0], p2[1], 'rgba(179,136,255,', sq * 1.3, { width: 8 });
        }, 330);
        break;
      }
      case 'clone':
        FX.burst(pos[0], pos[1], { n: 24, colors: ['#2fb36a', '#b7efc5', '#ffffff'], speed: 4, size: 5, glow: true, grav: 0 });
        Sound.play('clone');
        break;
      case 'revive':
        FX.beam(pos[0], pos[1], sq * 0.9, 'rgba(255,243,176,.55)');
        Sound.play('revive');
        break;
      case 'takeover':
        FX.burst(pos[0], pos[1], { n: 12, colors: PCOL[f.color], speed: 3, size: 5, glow: true, grav: -0.05 });
        break;
      case 'spawn':
        if (f.kind === 'drop') setTimeout(() => { FX.burst(pos[0], pos[1] + sq * 0.3, { n: 14, colors: ['rgba(60,40,20,.5)', '#ffffff'], speed: 3, size: 4, grav: 0 }); Sound.play('thud'); }, 380);
        else { FX.burst(pos[0], pos[1], { n: 25, colors: ['#06d6a0', '#b7efc5', '#ffffff'], speed: 4, size: 5, glow: true, grav: -0.05 }); Sound.play('spawn'); }
        break;
      case 'tornado': {
        const [cx, cy, w] = boardCenter();
        FX.vortex(cx, cy, w * 0.45, ['#cfd8dc', '#90a4ae', '#ffffff', '#b0bec5']);
        Sound.play('whoosh');
        restartAnim($('#board'), 'spin');
        break;
      }
      case 'shake': {
        const [cx, cy, w] = boardCenter();
        for (let i = 0; i < 3; i++) FX.crack(cx + (Math.random() - 0.5) * w * 0.6, cy + (Math.random() - 0.5) * w * 0.6, w * 0.5);
        Sound.play('rumble');
        shake(true);
        break;
      }
      case 'coins': Sound.play('coin'); break;
      case 'ruleEnd': {
        const def = E.RULES.find((x) => x.id === f.id);
        if (def) toast(`${def.name} ist vorbei`, 'rule-' + f.id, 'ctrl');
        break;
      }
      case 'check': Sound.play('check'); break;
      case 'win': setTimeout(() => { Sound.play('win'); FX.confetti(); }, 500); break;
    }
  }

  // Banner-Warteschlange
  const bq = [];
  let bBusy = false;
  function queueBanner(f) {
    bq.push(f);
    if (!bBusy) nextBanner();
  }
  function nextBanner() {
    const f = bq.shift();
    if (!f) { bBusy = false; return; }
    bBusy = true;
    const el = $('#banner');
    el.classList.toggle('rule', !!f.rule);
    el.innerHTML = `<div class="bicon">${f.ico ? Icons.svg(f.ico) : esc(f.icon || '')}</div><div class="btitle">${esc(f.title)}</div><div class="bsub">${esc(f.sub || '')}</div>`;
    restartAnim(el, 'show');
    if (f.sound) Sound.play(f.sound);
    setTimeout(nextBanner, 1700);
  }

  let toastTimer = null;
  function toast(msg, ico, cat) {
    const el = $('#toast');
    el.innerHTML = (ico ? `<span class="aicon cat-${cat || 'ctrl'}">${Icons.svg(ico)}</span>` : '') + `<span>${esc(msg)}</span>`;
    restartAnim(el, 'show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  document.addEventListener('pointerdown', () => Sound.init(), { once: true });

  // Nur zum Testen: ?debug in der Adresse
  if (new URLSearchParams(location.search).has('debug'))
    window.GS = { get state() { return state; }, dispatch, render, me };

  // Direkt beitreten über ?room=CODE (Name vorher abfragen)
  const room = new URLSearchParams(location.search).get('room');
  if (room) {
    $('#joinCode').value = room.toUpperCase();
    $('#btnCreate').classList.add('hidden');
    $('#btnJoin').classList.add('primary');
    lobbyStatus('Gib deinen Namen ein und klick auf „Beitreten“.');
    nameInput.focus();
  }
})();
