// GoofyASchach – Oberfläche, Rendering, Effekte und Ablauf
(function () {
  const E = Engine;
  const $ = (s) => document.querySelector(s);
  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

  let state = null;
  let role = null; // 'local' | 'host' | 'guest'
  let myColor = null; // 'w' | 'b' | null (lokal)
  let selected = null;
  let targeting = null;
  let chosenMode = 'chaos';
  const pieceEls = new Map();
  const squares = [];

  // ---------- Lobby ----------
  document.querySelectorAll('.mode-btn').forEach((b) =>
    b.addEventListener('click', () => {
      chosenMode = b.dataset.mode;
      document.querySelectorAll('.mode-btn').forEach((x) => x.classList.toggle('active', x === b));
      Sound.play('click');
    })
  );

  function lobbyStatus(msg, isErr) {
    const el = $('#lobbyStatus');
    el.textContent = msg || '';
    el.classList.toggle('err', !!isErr);
  }

  $('#btnCreate').addEventListener('click', () => {
    Sound.play('click');
    if (typeof Peer === 'undefined') return lobbyStatus('Online-Bibliothek konnte nicht geladen werden. Internet prüfen!', true);
    role = 'host';
    myColor = 'w';
    $('#lobbyMain').classList.add('hidden');
    $('#roomInfo').classList.remove('hidden');
    $('#roomCode').textContent = '…';
    lobbyStatus('Erstelle Raum…');
    Net.host((code) => {
      $('#roomCode').textContent = code;
      const link = location.origin + location.pathname + '?room=' + code;
      $('#roomLink').value = link;
      lobbyStatus('Warte auf deinen Freund… Schick ihm den Link oder Code!');
    });
  });

  $('#btnCopy').addEventListener('click', () => {
    const v = $('#roomLink').value;
    (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(
      () => { $('#btnCopy').textContent = 'Kopiert! ✅'; },
      () => { $('#roomLink').select(); document.execCommand('copy'); $('#btnCopy').textContent = 'Kopiert! ✅'; }
    );
    setTimeout(() => ($('#btnCopy').textContent = 'Link kopieren'), 1800);
  });

  function join(code) {
    if (!code) return lobbyStatus('Bitte einen Raum-Code eingeben.', true);
    if (typeof Peer === 'undefined') return lobbyStatus('Online-Bibliothek konnte nicht geladen werden. Internet prüfen!', true);
    role = 'guest';
    myColor = 'b';
    lobbyStatus('Verbinde mit Raum ' + code.toUpperCase() + '…');
    $('#btnJoin').disabled = true;
    Net.join(code);
  }
  $('#btnJoin').addEventListener('click', () => { Sound.play('click'); join($('#joinCode').value); });
  $('#joinCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') join($('#joinCode').value); });

  $('#btnLocal').addEventListener('click', () => {
    Sound.play('click');
    role = 'local';
    myColor = null;
    state = E.newGame(chosenMode);
    startGame();
    render([startBanner()]);
  });

  $('#btnCancelRoom').addEventListener('click', () => (location.href = location.pathname));

  function startBanner() {
    return state.mode === 'chaos'
      ? { type: 'banner', icon: '🔥', title: 'CHAOS-SCHACH!', sub: 'Schlag den König, um zu gewinnen', sound: 'event' }
      : { type: 'banner', icon: '♟️', title: 'Los geht\'s!', sub: 'Klassisches Schach', sound: 'event' };
  }

  // ---------- Netzwerk ----------
  Net.onOpen = () => {
    if (role === 'host') {
      state = E.newGame(chosenMode);
      startGame();
      const fx = [startBanner()];
      Net.send({ t: 'state', s: state, fx });
      render(fx);
    } else {
      lobbyStatus('Verbunden! Warte auf Spielstart…');
    }
  };
  Net.onMessage = (d) => {
    if (!d || typeof d !== 'object') return;
    if (role === 'host' && d.t === 'action') handleAction(d.a, 'b');
    else if (role === 'guest' && d.t === 'state') {
      state = d.s;
      if ($('#game').classList.contains('hidden')) startGame();
      if (selected && !(state.board[selected.r][selected.c] && state.board[selected.r][selected.c].color === myColor)) selected = null;
      if (state.turn !== myColor) { selected = null; targeting = null; }
      render(d.fx || []);
    } else if (d.t === 'full') {
      lobbyStatus('Dieser Raum ist schon voll.', true);
      $('#btnJoin').disabled = false;
    }
  };
  Net.onClose = () => {
    if (state && !$('#game').classList.contains('hidden'))
      queueBanner({ icon: '🔌', title: 'Verbindung weg!', sub: 'Dein Freund hat das Spiel verlassen' });
  };
  Net.onError = (e) => {
    const map = {
      'peer-unavailable': 'Raum nicht gefunden. Code richtig?',
      network: 'Netzwerkfehler – Internetverbindung prüfen.',
      'server-error': 'Verbindungsserver nicht erreichbar.',
      'browser-incompatible': 'Dein Browser unterstützt das leider nicht.',
    };
    lobbyStatus(map[e.type] || 'Fehler: ' + (e.type || e), true);
    $('#btnJoin').disabled = false;
  };

  // ---------- Aktionen ----------
  const me = () => (role === 'local' ? state.turn : myColor);
  const canAct = () => state && !state.winner && state.turn === me();

  function dispatch(a) {
    selected = null;
    targeting = null;
    if (role === 'guest') {
      Net.send({ t: 'action', a });
      render([]);
    } else handleAction(a, role === 'local' ? state.turn : 'w');
  }

  function handleAction(a, color) {
    if (!a || !state) return;
    let fx = null;
    if (a.type === 'move') fx = E.doMove(state, color, a.fr, a.fc, a.tr, a.tc);
    else if (a.type === 'ability') fx = E.useAbility(state, color, a.id, a.target);
    else if (a.type === 'rematch') {
      if (!state.winner) return;
      state = E.newGame(state.mode);
      fx = [{ type: 'banner', icon: '🔁', title: 'Revanche!', sub: 'Neues Spiel, neues Chaos', sound: 'event' }];
    }
    if (!fx) return;
    if (role === 'host') Net.send({ t: 'state', s: state, fx });
    render(fx);
  }

  // ---------- Spielbildschirm ----------
  function startGame() {
    $('#lobby').classList.add('hidden');
    $('#game').classList.remove('hidden');
    document.body.classList.toggle('chaos', state.mode === 'chaos');
    $('#modeTag').textContent = state.mode === 'chaos' ? '🔥 CHAOS' : '♟️ KLASSISCH';
    $('#modeTag').classList.remove('hidden');
    if (!squares.length) buildBoard();
  }

  function buildBoard() {
    const host = $('#squares');
    for (let i = 0; i < 64; i++) {
      const el = document.createElement('div');
      el.className = 'sq';
      el.innerHTML = '<i class="mk"></i>';
      el.addEventListener('click', () => onSquare(+el.dataset.r, +el.dataset.c));
      host.appendChild(el);
      squares.push(el);
    }
  }

  function viewFlip() {
    let f = myColor === 'b';
    if (state.flipped) f = !f;
    return f;
  }
  function toView(r, c) {
    return viewFlip() ? [7 - r, 7 - c] : [r, c];
  }

  function onSquare(r, c) {
    Sound.init();
    if (!canAct()) return;
    if (targeting) {
      if (validTarget(targeting, r, c)) dispatch({ type: 'ability', id: targeting, target: { r, c } });
      return;
    }
    const p = state.board[r][c];
    if (selected) {
      const ms = E.legalMoves(state, selected.r, selected.c);
      if (ms.some((m) => m.r === r && m.c === c)) {
        dispatch({ type: 'move', fr: selected.r, fc: selected.c, tr: r, tc: c });
        return;
      }
    }
    if (p && p.color === me()) {
      selected = selected && selected.r === r && selected.c === c ? null : { r, c };
      Sound.play('click');
    } else selected = null;
    render([]);
  }

  function validTarget(id, r, c) {
    if (id === 'bomb') return true;
    if (id === 'mutate') { const p = state.board[r][c]; return !!p && p.type !== 'k'; }
    return false;
  }

  // ---------- Rendern ----------
  function render(fx) {
    if (!state) return;
    const delayed = {};
    for (const f of fx) if (f.type === 'capture' && f.delay) delayed[f.r + ',' + f.c] = f.delay;
    renderBoard();
    renderPieces(delayed);
    renderPanels();
    processFx(fx);
  }

  function renderBoard() {
    const f = viewFlip();
    const moves = selected ? E.legalMoves(state, selected.r, selected.c) : [];
    const lm = state.lastMove;
    let kingSq = null;
    if (state.check) {
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = state.board[r][c];
        if (p && p.type === 'k' && p.color === state.check) kingSq = [r, c];
      }
    }
    squares.forEach((el, i) => {
      const vr = (i / 8) | 0, vc = i % 8;
      const r = f ? 7 - vr : vr, c = f ? 7 - vc : vc;
      el.dataset.r = r;
      el.dataset.c = c;
      el.dataset.rank = vc === 0 ? String(8 - r) : '';
      el.dataset.file = vr === 7 ? 'abcdefgh'[c] : '';
      let cls = 'sq ' + ((r + c) % 2 ? 'dark' : 'light');
      if (E.isLava(state, r, c)) cls += ' lava';
      if (E.isIce(state, r, c)) cls += ' ice';
      if (lm && ((lm.fr === r && lm.fc === c) || (lm.tr === r && lm.tc === c))) cls += ' last';
      if (selected && selected.r === r && selected.c === c) cls += ' sel';
      if (moves.some((m) => m.r === r && m.c === c)) cls += state.board[r][c] ? ' move cap' : ' move';
      if (kingSq && kingSq[0] === r && kingSq[1] === c) cls += ' check';
      if (targeting && validTarget(targeting, r, c)) cls += ' tgt';
      if (canAct() && !targeting && state.board[r][c] && state.board[r][c].color === me()) cls += ' own';
      el.className = cls;
    });
    $('#board').classList.toggle('targeting', !!targeting);
    $('#board').classList.toggle('bombing', targeting === 'bomb');
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
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = state.board[r][c];
        if (!p) continue;
        seen.add(p.id);
        let el = pieceEls.get(p.id);
        const [vr, vc] = toView(r, c);
        if (!el) {
          el = document.createElement('div');
          el.className = 'piece';
          el.innerHTML = '<span></span>';
          el.style.transition = 'none';
          el.style.transform = `translate(${vc * 100}%, ${vr * 100}%)`;
          layer.appendChild(el);
          void el.offsetWidth;
          el.style.transition = '';
          pieceEls.set(p.id, el);
          if (!firstRender) restartAnim(el.firstChild, 'spawn');
        }
        el.style.transform = `translate(${vc * 100}%, ${vr * 100}%)`;
        el.dataset.pos = r + ',' + c;
        if (el.dataset.type !== p.type) {
          if (el.dataset.type) restartAnim(el.firstChild, 'morph');
          el.dataset.type = p.type;
          el.firstChild.textContent = GLYPH[p.type] + '︎';
        }
        el.classList.toggle('w', p.color === 'w');
        el.classList.toggle('b', p.color === 'b');
        el.classList.toggle('king-danger', state.check === p.color && p.type === 'k');
      }
    for (const [id, el] of pieceEls) {
      if (seen.has(id)) continue;
      pieceEls.delete(id);
      const d = delayed[el.dataset.pos] || 0;
      setTimeout(() => {
        el.classList.add('dying');
        setTimeout(() => el.remove(), 650);
      }, d);
    }
  }

  function renderPanels() {
    const CN = E.CN;
    const chaos = state.mode === 'chaos';
    const bottom = viewFlip() ? 'b' : 'w';
    const top = E.opp(bottom);
    for (const [slot, col] of [['#pTop', top], ['#pBottom', bottom]]) {
      const el = $(slot);
      let name;
      if (role === 'local') name = CN[col];
      else name = col === myColor ? `Du (${CN[col]})` : `Freund (${CN[col]})`;
      el.querySelector('.pname').textContent = name;
      el.querySelector('.pdot').className = 'pdot ' + col;
      el.querySelector('.ppoints').textContent = chaos ? `🪙 ${state.points[col]}` : '';
      el.classList.toggle('active', !state.winner && state.turn === col);
      const badges = [];
      if (state.check === col) badges.push('<span class="badge red">SCHACH!</span>');
      if (state.skip === col) badges.push('<span class="badge">⏭️ setzt aus</span>');
      el.querySelector('.pbadges').innerHTML = badges.join('');
    }

    // Status
    let st;
    if (state.winner) st = state.winner === 'draw' ? 'Unentschieden' : `${CN[state.winner]} hat gewonnen!`;
    else if (role === 'local') st = `${CN[state.turn]} ist am Zug`;
    else st = state.turn === myColor ? '👉 Du bist am Zug!' : `⏳ ${CN[state.turn]} denkt nach…`;
    $('#status').textContent = st;
    $('#status').classList.toggle('mine', canAct() && role !== 'local');

    const info = [];
    if (chaos && !state.winner) {
      const left = state.eventEvery - (state.ply % state.eventEvery);
      info.push(`<span class="chip">🎲 Event in ${left} Zug${left === 1 ? '' : 'en'}</span>`);
      if (state.ply < state.doubleUntil) info.push('<span class="chip gold">💰 Doppelte Punkte!</span>');
      if (state.lava.length) info.push('<span class="chip orange">🔥 Lava</span>');
      if (state.ice.length) info.push('<span class="chip blue">🧊 Eis</span>');
    }
    $('#infoChips').innerHTML = info.join('');

    // Shop
    $('#shop').classList.toggle('hidden', !chaos);
    if (chaos) {
      const col = me();
      const pts = state.points[col];
      $('#shopPoints').textContent = role === 'local' ? `${CN[col]}: 🪙 ${pts}` : `🪙 ${state.points[myColor]}`;
      const list = $('#abilities');
      if (!list.children.length) {
        for (const ab of E.ABILITIES) {
          const b = document.createElement('button');
          b.className = 'ability';
          b.dataset.id = ab.id;
          b.innerHTML = `<span class="aicon">${ab.icon}</span><span class="atext"><b>${ab.name}</b><small>${ab.desc}</small></span><span class="acost">${ab.cost}</span>`;
          b.addEventListener('click', () => onAbility(ab));
          list.appendChild(b);
        }
      }
      for (const b of list.children) {
        const ab = E.ABILITIES.find((a) => a.id === b.dataset.id);
        const myPts = role === 'local' ? pts : state.points[myColor];
        b.disabled = !canAct() || state.abilityUsed || myPts < ab.cost;
        b.classList.toggle('armed', targeting === ab.id);
      }
      let hint = '';
      if (targeting === 'bomb') hint = '💣 Klicke auf ein Feld, um die Bombe zu werfen!';
      else if (targeting === 'mutate') hint = '🧬 Klicke auf eine Figur zum Mutieren!';
      else if (canAct() && state.abilityUsed) hint = 'Fähigkeit benutzt – jetzt noch ziehen.';
      else hint = 'Max. 1 Fähigkeit pro Zug. Fähigkeiten beenden den Zug nicht.';
      $('#shopHint').textContent = hint;
      $('#btnCancelTarget').classList.toggle('hidden', !targeting);
    }

    // Log
    $('#log').innerHTML = state.log.slice(-40).reverse().map((l) => `<li>${escapeHtml(l)}</li>`).join('');

    // Game over
    const ov = $('#overlay');
    if (state.winner) {
      let title;
      if (state.winner === 'draw') title = '🤝 Unentschieden';
      else if (role === 'local') title = `🏆 ${CN[state.winner]} gewinnt!`;
      else title = state.winner === myColor ? '🏆 DU HAST GEWONNEN!' : '💀 Du hast verloren';
      $('#ovTitle').textContent = title;
      $('#ovSub').textContent = state.result || '';
      ov.classList.remove('hidden');
    } else ov.classList.add('hidden');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function onAbility(ab) {
    Sound.init();
    if (!canAct()) return;
    selected = null;
    if (ab.target) {
      targeting = targeting === ab.id ? null : ab.id;
      Sound.play('click');
      render([]);
    } else dispatch({ type: 'ability', id: ab.id });
  }
  $('#btnCancelTarget').addEventListener('click', () => { targeting = null; render([]); });
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
    const rect = squares[vr * 8 + vc].getBoundingClientRect();
    return [rect.left + rect.width / 2, rect.top + rect.height / 2];
  }
  function shake(strong) {
    restartAnim($('#boardWrap'), strong ? 'shake-strong' : 'shake');
  }
  const PC = { w: ['#ffffff', '#ffe8a3', '#d9d9d9'], b: ['#2b2b2b', '#5a189a', '#111111'] };

  function processFx(fx) {
    for (const f of fx) {
      if (f.delay) setTimeout(() => runFx(f), f.delay);
      else runFx(f);
    }
  }

  function runFx(f) {
    const pos = f.r !== undefined ? center(f.r, f.c) : null;
    switch (f.type) {
      case 'move':
        Sound.play('move');
        break;
      case 'capture':
        if (f.kind === 'boom') {
          FX.burst(pos[0], pos[1], { n: 25, colors: PC[f.color], speed: 6, size: 6 });
        } else {
          FX.burst(pos[0], pos[1], { n: 45, colors: PC[f.color].concat(['#ff006e', '#ffbe0b']), speed: 8, size: 7, glow: true });
          FX.ring(pos[0], pos[1], 'rgba(255,255,255,', 70);
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
      case 'meteor':
        Sound.play('meteorFall');
        FX.meteor(pos[0], pos[1], () => { Sound.play('explode'); shake(true); });
        break;
      case 'banner':
        queueBanner(f);
        break;
      case 'ability':
        toast(`${f.icon} ${E.CN[f.color]} benutzt ${f.name}!`);
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
      case 'spawn':
        FX.burst(pos[0], pos[1], { n: 25, colors: ['#06d6a0', '#b7efc5', '#ffffff'], speed: 4, size: 5, glow: true, grav: -0.05 });
        Sound.play('spawn');
        break;
      case 'tornado':
        Sound.play('whoosh');
        restartAnim($('#board'), 'spin');
        break;
      case 'shake':
        Sound.play('rumble');
        shake(true);
        break;
      case 'coins':
        Sound.play('coin');
        break;
      case 'check':
        Sound.play('check');
        break;
      case 'win':
        setTimeout(() => { Sound.play('win'); FX.confetti(); }, 500);
        break;
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
    el.innerHTML = `<div class="bicon">${f.icon || ''}</div><div class="btitle">${escapeHtml(f.title)}</div><div class="bsub">${escapeHtml(f.sub || '')}</div>`;
    restartAnim(el, 'show');
    if (f.sound) Sound.play(f.sound);
    setTimeout(nextBanner, 1900);
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    restartAnim(el, 'show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // Erster Klick schaltet Audio frei
  document.addEventListener('pointerdown', () => Sound.init(), { once: true });

  // Direkt beitreten über ?room=CODE
  const room = new URLSearchParams(location.search).get('room');
  if (room) {
    $('#joinCode').value = room;
    window.addEventListener('load', () => join(room));
  }
})();
