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
      ? { type: 'banner', icon: '🔥', title: 'Chaos-Schach!', sub: 'Schlag einen König, um seine Armee zu übernehmen', sound: 'event' }
      : { type: 'banner', icon: '♟️', title: 'Los geht\'s!', sub: state.players.length === 2 ? 'Klassisches Schach' : 'Schlag die Könige deiner Gegner', sound: 'event' };
  }

  // ---------- Host ----------
  function broadcastLobby() {
    const names = lobby.map((p) => p.name);
    lobby.forEach((p, i) => p.conn && Net.sendTo(p.conn, { t: 'lobby', names, you: i, code: roomCode, mode: opts.mode, teams: opts.teams }));
    renderRoom(names, 0, opts.mode, opts.teams);
  }
  function broadcastState(fx) {
    lobby.forEach((p, i) => p.conn && Net.sendTo(p.conn, { t: 'state', s: state, fx, you: i }));
  }

  Net.onGuestOpen = () => {};
  Net.onGuestData = (c, d) => {
    if (!d || typeof d !== 'object') return;
    if (d.t === 'join') {
      if (state || lobby.length >= 4) {
        Net.sendTo(c, { t: 'full', started: !!state });
        setTimeout(() => c.close(), 400);
        return;
      }
      lobby.push({ name: String(d.name || 'Spieler').slice(0, 14), conn: c });
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
      const fx = E.setOffline(state, idx, true) || [];
      fx.push({ type: 'banner', icon: '📴', title: `${state.players[idx].name} ist weg`, sub: 'Seine Züge werden übersprungen' });
      broadcastState(fx);
      render(fx);
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
  Net.onOpen = () => Net.send({ t: 'join', name: myName() });
  Net.onMessage = (d) => {
    if (!d || typeof d !== 'object') return;
    if (d.t === 'lobby') {
      myIdx = d.you;
      roomCode = d.code;
      showRoom();
      renderRoom(d.names, d.you, d.mode, d.teams);
    } else if (d.t === 'state') {
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
    if (state) queueBanner({ icon: '🔌', title: 'Verbindung weg', sub: 'Der Host hat das Spiel verlassen' });
    else { lobbyStatus('Verbindung zum Raum verloren.', true); $('#btnJoin').disabled = false; }
  };
  Net.onError = (e) => {
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
      fx = [{ type: 'banner', icon: '🔁', title: 'Revanche!', sub: 'Neues Spiel, neues Chaos', sound: 'event' }];
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
    const delayed = {};
    for (const f of fx) if (f.type === 'capture' && f.delay) delayed[f.r + ',' + f.c] = f.delay;
    renderBoard();
    renderPieces(delayed);
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

  function renderPieces(delayed) {
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
        if (!el) {
          el = document.createElement('div');
          el.className = 'piece';
          el.innerHTML = '<span></span><i></i>';
          el.style.transition = 'none';
          el.style.transform = tf;
          layer.appendChild(el);
          void el.offsetWidth;
          el.style.transition = '';
          pieceEls.set(p.id, el);
          if (!firstRender) restartAnim(el.firstChild, 'spawn');
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
      setTimeout(() => {
        el.classList.add('dying');
        setTimeout(() => el.remove(), 600);
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
    }
    $('#infoChips').innerHTML = info.join('');

    const pass = $('#btnPass');
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
          b.innerHTML = `<span class="aicon">${ab.icon}</span><span class="aname">${ab.name}</span><span class="acost">${ab.cost}</span>`;
          b.addEventListener('click', () => onAbility(ab));
          b.addEventListener('mouseenter', () => showDesc(ab));
          b.addEventListener('mouseleave', () => renderHint());
          list.appendChild(b);
        }
      }
      for (const b of list.children) {
        const ab = E.ABILITIES.find((a) => a.id === b.dataset.id);
        b.disabled = !canAct() || state.abilityUsed || pts < ab.cost || !!E.abilityBlocked(state, mine, ab.id);
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
      ov.classList.remove('hidden');
    } else ov.classList.add('hidden');
  }

  function showDesc(ab) {
    $('#shopHint').innerHTML = `<b>${ab.icon} ${ab.name} · ${ab.cost} 🪙</b><br>${esc(ab.desc)}`;
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
      hint = `<b>${ab.icon} ${ab.name}</b><br>Wähle ${what}${ab.id === 'swap' && targeting.step === 2 ? ' zum Tauschen' : ''}.`;
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

  function runFx(f) {
    const pos = f.r !== undefined ? center(f.r, f.c) : null;
    const big = state && state.n === 14 ? 0.7 : 1;
    switch (f.type) {
      case 'move': Sound.play('move'); break;
      case 'capture':
        if (f.kind === 'boom' || f.kind === 'poison') {
          FX.burst(pos[0], pos[1], { n: 25, colors: f.kind === 'poison' ? ['#7ee35b', '#3a9d23', '#c8ff9e'] : PCOL[f.color], speed: 6 * big, size: 6 * big });
          if (f.kind === 'poison') Sound.play('burn');
        } else {
          FX.burst(pos[0], pos[1], { n: 45, colors: PCOL[f.color].concat(['#ff5a36', '#f4c430']), speed: 8 * big, size: 7 * big, glow: true });
          FX.ring(pos[0], pos[1], 'rgba(255,255,255,', 70 * big);
          if (f.kind !== 'zap') Sound.play('capture');
          shake(false);
        }
        break;
      case 'explode':
        FX.explosion(pos[0], pos[1], f.big);
        FX.flash('#ffb703');
        Sound.play('explode');
        shake(true);
        break;
      case 'blitz':
        FX.lightning(pos[0], pos[1]);
        Sound.play('zap');
        shake(true);
        break;
      case 'snipe':
        FX.ring(pos[0], pos[1], 'rgba(230,57,70,', 140);
        FX.ring(pos[0], pos[1], 'rgba(255,255,255,', 60);
        Sound.play('zap');
        break;
      case 'meteor':
        Sound.play('meteorFall');
        FX.meteor(pos[0], pos[1], () => { Sound.play('explode'); shake(true); });
        break;
      case 'banner': queueBanner(f); break;
      case 'ability':
        toast(`${f.icon} ${state.players[f.who].name}: ${f.name}`);
        Sound.play('coin');
        break;
      case 'pass':
        toast(`💤 ${state.players[f.who].name} passt`);
        Sound.play('coin');
        break;
      case 'mutate':
        FX.burst(pos[0], pos[1], { n: 40, colors: ['#c77dff', '#7b2cbf', '#e0aaff', '#80ffdb'], speed: 5, size: 6, glow: true, grav: -0.05 });
        Sound.play('mutate');
        break;
      case 'promote':
        FX.burst(pos[0], pos[1], { n: 50, colors: ['#ffd60a', '#fff3b0', '#ffc300'], speed: 6, size: 6, glow: true, grav: -0.08 });
        Sound.play('coin');
        break;
      case 'burn':
        FX.burst(pos[0], pos[1], { n: 50, colors: ['#ff4800', '#ff9e00', '#ffd000'], speed: 4, size: 8, glow: true, grav: -0.15 });
        Sound.play('burn');
        break;
      case 'slide':
        FX.burst(pos[0], pos[1], { n: 25, colors: ['#caf0f8', '#90e0ef', '#ffffff'], speed: 4, size: 4, glow: true });
        Sound.play('ice');
        break;
      case 'freeze':
        FX.burst(pos[0], pos[1], { n: 30, colors: ['#caf0f8', '#90e0ef', '#ffffff', '#48cae4'], speed: 4, size: 5, glow: true, grav: 0.02 });
        Sound.play('ice');
        break;
      case 'shield':
        FX.ring(pos[0], pos[1], 'rgba(127,212,255,', 80);
        FX.burst(pos[0], pos[1], { n: 20, colors: ['#7fd4ff', '#ffffff'], speed: 3, size: 4, glow: true, grav: 0 });
        Sound.play('spawn');
        break;
      case 'poison':
        FX.burst(pos[0], pos[1], { n: 30, colors: ['#7ee35b', '#3a9d23', '#c8ff9e'], speed: 3, size: 6, glow: true, grav: -0.1 });
        Sound.play('mutate');
        break;
      case 'teleport': {
        const p2 = center(f.r2, f.c2);
        FX.burst(pos[0], pos[1], { n: 30, colors: ['#b388ff', '#7df9ff', '#ffffff'], speed: 5, size: 5, glow: true, grav: 0 });
        FX.burst(p2[0], p2[1], { n: 30, colors: ['#b388ff', '#7df9ff', '#ffffff'], speed: 5, size: 5, glow: true, grav: 0 });
        FX.ring(p2[0], p2[1], 'rgba(179,136,255,', 70);
        Sound.play('mutate');
        break;
      }
      case 'takeover':
        FX.burst(pos[0], pos[1], { n: 12, colors: PCOL[f.color], speed: 3, size: 5, glow: true, grav: -0.05 });
        break;
      case 'spawn':
        FX.burst(pos[0], pos[1], { n: 25, colors: ['#06d6a0', '#b7efc5', '#ffffff'], speed: 4, size: 5, glow: true, grav: -0.05 });
        Sound.play('spawn');
        break;
      case 'tornado':
        Sound.play('whoosh');
        restartAnim($('#board'), 'spin');
        break;
      case 'shake': Sound.play('rumble'); shake(true); break;
      case 'coins': Sound.play('coin'); break;
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
    el.innerHTML = `<div class="bicon">${f.icon || ''}</div><div class="btitle">${esc(f.title)}</div><div class="bsub">${esc(f.sub || '')}</div>`;
    restartAnim(el, 'show');
    if (f.sound) Sound.play(f.sound);
    setTimeout(nextBanner, 1700);
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    restartAnim(el, 'show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  document.addEventListener('pointerdown', () => Sound.init(), { once: true });

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
