// GoofyASchach – Spiellogik (Regeln, Fähigkeiten, Chaos-Events)
// Läuft beim Host (bzw. lokal). Der Gast bekommt nur den fertigen Zustand.
(function () {
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const NAMES = { p: 'Bauer', n: 'Springer', b: 'Läufer', r: 'Turm', q: 'Dame', k: 'König' };
  const CN = { w: 'Weiß', b: 'Schwarz' };
  const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  const K8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  const opp = (c) => (c === 'w' ? 'b' : 'w');
  const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rnd(a.length)];
  const sign = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const ABILITIES = [
    { id: 'skip', name: 'Zug-Skip', icon: '⏭️', cost: 6, desc: 'Gegner setzt aus – du ziehst zweimal hintereinander.' },
    { id: 'blitz', name: 'Blitz', icon: '⚡', cost: 5, desc: 'Ein Blitz trifft eine zufällige gegnerische Figur (kein König).' },
    { id: 'bomb', name: 'Bombe', icon: '💣', cost: 10, target: 'square', desc: 'Sprengt ein 3×3-Feld weg. Könige überleben – deine Figuren nicht!' },
    { id: 'mutate', name: 'Mutation', icon: '🧬', cost: 4, target: 'piece', desc: 'Verwandelt eine Figur (kein König) in eine zufällige andere.' },
    { id: 'quake', name: 'Erdbeben', icon: '🌋', cost: 7, desc: 'Alle Figuren wackeln in zufällige Richtungen.' },
    { id: 'tornado', name: 'Tornado', icon: '🌪️', cost: 8, desc: 'Wirbelt bis zu 8 zufällige Figuren durcheinander.' },
    { id: 'army', name: 'Bauern-Armee', icon: '🪖', cost: 6, desc: '3 neue eigene Bauern spawnen auf deiner Hälfte.' },
  ];

  const EVENTS = [
    { id: 'meteor', name: 'Meteoritenregen', icon: '☄️', desc: '3 Meteoriten schlagen ein!' },
    { id: 'lava', name: 'Lava-Ausbruch', icon: '🔥', desc: 'Wer auf Lava landet, verbrennt!' },
    { id: 'ice', name: 'Eiszeit', icon: '🧊', desc: 'Auf Eis rutschen Figuren weiter!' },
    { id: 'rotate', name: 'Brett-Drehung', icon: '🔄', desc: 'Oben ist jetzt unten!' },
    { id: 'double', name: 'Doppelte Punkte', icon: '💰', desc: '4 Züge lang gibt es doppelte Punkte!' },
    { id: 'pawns', name: 'Bauern-Sturm', icon: '🏃', desc: 'Alle Bauern rennen ein Feld vor!' },
    { id: 'swap', name: 'Platztausch', icon: '🔀', desc: 'Zwei zufällige Figuren tauschen die Plätze!' },
    { id: 'gift', name: 'Geschenk', icon: '🎁', desc: 'Beide bekommen 5 Punkte!' },
    { id: 'mutation', name: 'Mutations-Welle', icon: '🧪', desc: 'Je 2 Figuren pro Seite mutieren!' },
    { id: 'quake', name: 'Erdbeben', icon: '🌋', desc: 'Alles wackelt!' },
  ];

  // ---------- Grundgerüst ----------
  function mk(s, type, color, moved) {
    return { id: s.nextId++, type, color, moved: !!moved };
  }
  function log(s, msg) {
    s.log.push(msg);
    if (s.log.length > 80) s.log.shift();
  }

  function newGame(mode) {
    const s = {
      mode, board: [], turn: 'w', ep: null, points: { w: 0, b: 0 }, ply: 0,
      lava: [], ice: [], doubleUntil: 0, flipped: false, skip: null, abilityUsed: false,
      winner: null, result: null, log: [], nextId: 1, lastMove: null, check: null, eventEvery: 4,
    };
    const back = 'rnbqkbnr';
    for (let r = 0; r < 8; r++) s.board.push(Array(8).fill(null));
    for (let c = 0; c < 8; c++) {
      s.board[0][c] = mk(s, back[c], 'b');
      s.board[1][c] = mk(s, 'p', 'b');
      s.board[6][c] = mk(s, 'p', 'w');
      s.board[7][c] = mk(s, back[c], 'w');
    }
    log(s, mode === 'chaos' ? '🔥 CHAOS-MODUS gestartet. Viel Glück!' : '♟️ Klassisches Spiel gestartet.');
    return s;
  }

  const at = (s, r, c) => (inB(r, c) ? s.board[r][c] : null);
  const isLava = (s, r, c) => s.lava.some((x) => x.r === r && x.c === c);
  const isIce = (s, r, c) => s.ice.some((x) => x.r === r && x.c === c);

  function allPieces(s, filter) {
    const out = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = s.board[r][c];
        if (p && (!filter || filter(p))) out.push({ p, r, c });
      }
    return out;
  }
  function emptySquares(s, filter) {
    const out = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (!s.board[r][c] && !isLava(s, r, c) && (!filter || filter(r, c))) out.push({ r, c });
    return out;
  }

  // ---------- Angriffe & Züge ----------
  function attacksFrom(s, r, c) {
    const p = s.board[r][c];
    const out = [];
    if (!p) return out;
    const add = (rr, cc) => { if (inB(rr, cc)) out.push([rr, cc]); };
    if (p.type === 'p') {
      const d = p.color === 'w' ? -1 : 1;
      add(r + d, c - 1); add(r + d, c + 1);
    } else if (p.type === 'n') {
      for (const [a, b] of KN) add(r + a, c + b);
    } else if (p.type === 'k') {
      for (const [a, b] of K8) add(r + a, c + b);
    } else {
      const dirs = p.type === 'b' ? DIAG : p.type === 'r' ? ORTH : K8;
      for (const [a, b] of dirs) {
        let rr = r + a, cc = c + b;
        while (inB(rr, cc)) {
          out.push([rr, cc]);
          if (s.board[rr][cc]) break;
          rr += a; cc += b;
        }
      }
    }
    return out;
  }

  function attacked(s, r, c, by) {
    for (const { r: pr, c: pc } of allPieces(s, (p) => p.color === by))
      if (attacksFrom(s, pr, pc).some(([a, b]) => a === r && b === c)) return true;
    return false;
  }
  function kingPos(s, color) {
    const k = allPieces(s, (p) => p.type === 'k' && p.color === color)[0];
    return k ? [k.r, k.c] : null;
  }
  function inCheck(s, color) {
    const k = kingPos(s, color);
    return k ? attacked(s, k[0], k[1], opp(color)) : false;
  }

  function pseudoMoves(s, r, c) {
    const p = s.board[r][c];
    if (!p) return [];
    const out = [];
    if (p.type === 'p') {
      const d = p.color === 'w' ? -1 : 1;
      if (inB(r + d, c) && !s.board[r + d][c]) {
        out.push({ r: r + d, c });
        if (!p.moved && inB(r + 2 * d, c) && !s.board[r + 2 * d][c]) out.push({ r: r + 2 * d, c, dbl: true });
      }
      for (const dc of [-1, 1]) {
        const rr = r + d, cc = c + dc;
        if (!inB(rr, cc)) continue;
        const t = s.board[rr][cc];
        if (t && t.color !== p.color) out.push({ r: rr, c: cc });
        else if (!t && s.ep && s.ep.r === rr && s.ep.c === cc) {
          const vp = at(s, r, cc);
          if (vp && vp.type === 'p' && vp.color !== p.color) out.push({ r: rr, c: cc, ep: true });
        }
      }
    } else {
      for (const [rr, cc] of attacksFrom(s, r, c)) {
        const t = s.board[rr][cc];
        if (!t || t.color !== p.color) out.push({ r: rr, c: cc });
      }
      if (p.type === 'k' && !p.moved && c === 4 && !inCheck(s, p.color)) {
        const sides = [
          { rc: 7, step: 1, between: [5, 6], pass: [5, 6] },
          { rc: 0, step: -1, between: [1, 2, 3], pass: [3, 2] },
        ];
        for (const sd of sides) {
          const rook = at(s, r, sd.rc);
          if (rook && rook.type === 'r' && rook.color === p.color && !rook.moved &&
            sd.between.every((x) => !s.board[r][x]) &&
            sd.pass.every((x) => !attacked(s, r, x, opp(p.color)) && !isLava(s, r, x)))
            out.push({ r, c: c + 2 * sd.step, castle: sd.rc });
        }
      }
    }
    return out.filter((m) => !(p.type === 'k' && isLava(s, m.r, m.c)));
  }

  function leavesKingSafe(s, fr, fc, m) {
    const p = s.board[fr][fc];
    const b = s.board.map((row) => row.slice());
    b[m.r][m.c] = p;
    b[fr][fc] = null;
    if (m.ep) b[fr][m.c] = null;
    return !inCheck({ board: b, lava: s.lava, ep: null }, p.color);
  }

  function legalMoves(s, r, c) {
    const moves = pseudoMoves(s, r, c);
    if (s.mode === 'chaos') return moves; // Im Chaos: König kann geschlagen werden
    return moves.filter((m) => leavesKingSafe(s, r, c, m));
  }
  function hasAnyMove(s, color) {
    return allPieces(s, (p) => p.color === color).some(({ r, c }) => legalMoves(s, r, c).length > 0);
  }

  // ---------- Hilfen ----------
  function gain(s, color, n) {
    if (s.mode !== 'chaos' || n <= 0) return;
    const mult = s.ply < s.doubleUntil ? 2 : 1;
    s.points[color] += n * mult;
  }
  function destroy(s, r, c, fx, kind, by) {
    const p = at(s, r, c);
    if (!p || p.type === 'k') return false;
    s.board[r][c] = null;
    fx.push({ type: 'capture', r, c, color: p.color, kind });
    if (by && p.color !== by) gain(s, by, Math.ceil(VAL[p.type] / 2));
    return true;
  }
  function randomType(exclude, allowPawn) {
    const t = ['q', 'r', 'b', 'n', 'p'].filter((x) => x !== exclude && (allowPawn || x !== 'p'));
    return pick(t);
  }
  function mutatePiece(s, r, c, fx) {
    const p = s.board[r][c];
    if (!p || p.type === 'k') return;
    const old = p.type;
    p.type = randomType(old, r !== 0 && r !== 7);
    if (p.type === 'p') p.moved = true;
    fx.push({ type: 'mutate', r, c });
    log(s, `🧬 ${CN[p.color]}er ${NAMES[old]} wird zum ${NAMES[p.type]}!`);
  }
  // Nach Chaos aufräumen: Bauern auf letzter Reihe befördern, Lava verbrennt
  function normalize(s, fx) {
    for (const { p, r, c } of allPieces(s)) {
      if (p.type === 'p' && ((p.color === 'w' && r === 0) || (p.color === 'b' && r === 7))) {
        p.type = s.mode === 'chaos' ? pick(['q', 'q', 'r', 'b', 'n']) : 'q';
        fx.push({ type: 'promote', r, c });
        log(s, `✨ ${CN[p.color]}er Bauer wird zur Figur: ${NAMES[p.type]}!`);
      }
      if (p.type !== 'k' && isLava(s, r, c)) {
        s.board[r][c] = null;
        fx.push({ type: 'burn', r, c, color: p.color });
        log(s, `🔥 ${CN[p.color]}er ${NAMES[p.type]} verbrennt in der Lava!`);
      }
    }
  }
  function updateCheck(s) {
    s.check = !s.winner && inCheck(s, s.turn) ? s.turn : null;
  }

  // ---------- Zug ausführen ----------
  function doMove(s, color, fr, fc, tr, tc) {
    const fx = [];
    if (s.winner || s.turn !== color) return null;
    const p = at(s, fr, fc);
    if (!p || p.color !== color) return null;
    const m = legalMoves(s, fr, fc).find((x) => x.r === tr && x.c === tc);
    if (!m) return null;

    let captured = s.board[tr][tc];
    if (m.ep) { captured = s.board[fr][tc]; s.board[fr][tc] = null; }
    s.board[tr][tc] = p;
    s.board[fr][fc] = null;
    p.moved = true;
    if (m.castle !== undefined) {
      const rook = s.board[fr][m.castle];
      const rc = m.castle === 7 ? 5 : 3;
      s.board[fr][rc] = rook;
      s.board[fr][m.castle] = null;
      rook.moved = true;
      log(s, `🏰 ${CN[color]} rochiert.`);
    }
    s.ep = m.dbl ? { r: (fr + tr) / 2, c: fc } : null;

    if (captured) {
      fx.push({ type: 'capture', r: tr, c: tc, color: captured.color, kind: 'hit' });
      gain(s, color, VAL[captured.type]);
      log(s, `⚔️ ${CN[color]}er ${NAMES[p.type]} schlägt ${NAMES[captured.type]}` + (s.mode === 'chaos' && VAL[captured.type] ? ` (+${VAL[captured.type] * (s.ply < s.doubleUntil ? 2 : 1)})` : ''));
      if (captured.type === 'k') {
        s.winner = color;
        s.result = 'Der König wurde geschlagen! 👑💀';
        s.lastMove = { fr, fc, tr, tc };
        fx.push({ type: 'win' });
        log(s, `🏆 ${CN[color]} gewinnt!`);
        s.ply++;
        s.check = null;
        return fx;
      }
    } else {
      fx.push({ type: 'move' });
    }

    // Eis: weiterrutschen
    let cr = tr, cc = tc;
    if (s.mode === 'chaos' && m.castle === undefined && isIce(s, tr, tc)) {
      const dr = sign(tr - fr), dc = sign(tc - fc);
      let steps = 0;
      while (steps < 4 && isIce(s, cr, cc) && inB(cr + dr, cc + dc) && !s.board[cr + dr][cc + dc] &&
        !(p.type === 'k' && isLava(s, cr + dr, cc + dc))) {
        s.board[cr + dr][cc + dc] = p;
        s.board[cr][cc] = null;
        cr += dr; cc += dc; steps++;
      }
      if (steps) { fx.push({ type: 'slide', r: cr, c: cc }); log(s, `🧊 Rutsch! ${NAMES[p.type]} schlittert ${steps} Feld(er) weiter.`); }
    }
    s.lastMove = { fr, fc, tr: cr, tc: cc };
    normalize(s, fx);
    gain(s, color, 1);
    endTurn(s, fx);
    return fx;
  }

  function endTurn(s, fx) {
    s.ply++;
    s.abilityUsed = false;
    s.lava = s.lava.filter((x) => x.until > s.ply);
    s.ice = s.ice.filter((x) => x.until > s.ply);
    if (s.mode === 'chaos' && s.ply % s.eventEvery === 0) randomEvent(s, fx);

    let next = opp(s.turn);
    if (s.skip === next) {
      s.skip = null;
      log(s, `⏭️ ${CN[next]} wird übersprungen!`);
      fx.push({ type: 'banner', icon: '⏭️', title: `${CN[next]} setzt aus!`, sub: `${CN[s.turn]} ist nochmal dran`, sound: 'skip' });
      next = s.turn;
      s.ep = null;
    }
    s.turn = next;

    if (s.mode === 'classic') {
      const chk = inCheck(s, s.turn);
      if (!hasAnyMove(s, s.turn)) {
        if (chk) {
          s.winner = opp(s.turn);
          s.result = 'Schachmatt! ♚';
          log(s, `🏆 Schachmatt – ${CN[s.winner]} gewinnt!`);
        } else {
          s.winner = 'draw';
          s.result = 'Patt – Unentschieden.';
          log(s, '🤝 Patt!');
        }
        fx.push({ type: 'win' });
      }
    } else if (!hasAnyMove(s, s.turn)) {
      log(s, `😵 ${CN[s.turn]} hat keine Züge und muss passen.`);
      s.turn = opp(s.turn);
      if (!hasAnyMove(s, s.turn)) {
        s.winner = 'draw';
        s.result = 'Niemand kann mehr ziehen – Unentschieden.';
        fx.push({ type: 'win' });
      }
    }
    updateCheck(s);
    if (s.check) fx.push({ type: 'check' });
  }

  // ---------- Fähigkeiten ----------
  function useAbility(s, color, id, target) {
    const fx = [];
    const ab = ABILITIES.find((a) => a.id === id);
    if (!ab || s.mode !== 'chaos' || s.winner || s.turn !== color || s.abilityUsed) return null;
    if (s.points[color] < ab.cost) return null;
    if (ab.target && (!target || !inB(target.r, target.c))) return null;
    if (ab.target === 'piece') {
      const tp = at(s, target.r, target.c);
      if (!tp || tp.type === 'k') return null;
    }
    const enemy = opp(color);

    switch (id) {
      case 'skip':
        s.skip = enemy;
        fx.push({ type: 'banner', icon: '⏭️', title: 'ZUG-SKIP!', sub: `${CN[enemy]} muss gleich aussetzen`, sound: 'skip' });
        break;
      case 'blitz': {
        const c = allPieces(s, (p) => p.color === enemy && p.type !== 'k');
        if (!c.length) return null;
        const t = pick(c);
        fx.push({ type: 'blitz', r: t.r, c: t.c });
        log(s, `⚡ Blitz trifft ${CN[enemy]}en ${NAMES[t.p.type]}!`);
        destroy(s, t.r, t.c, fx, 'zap', color);
        break;
      }
      case 'bomb': {
        fx.push({ type: 'explode', r: target.r, c: target.c, big: true });
        let n = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++)
            if (destroy(s, target.r + dr, target.c + dc, fx, 'boom', color)) n++;
        log(s, `💣 BOOM! ${CN[color]} sprengt ${n} Figur(en) weg.`);
        break;
      }
      case 'mutate':
        mutatePiece(s, target.r, target.c, fx);
        break;
      case 'quake':
        quake(s, fx);
        log(s, `🌋 ${CN[color]} löst ein Erdbeben aus!`);
        break;
      case 'tornado': {
        const list = shuffle(allPieces(s, (p) => p.type !== 'k')).slice(0, 8);
        const squares = shuffle(list.map(({ r, c }) => ({ r, c })));
        for (const { r, c } of list) s.board[r][c] = null;
        list.forEach(({ p }, i) => { s.board[squares[i].r][squares[i].c] = p; p.moved = true; });
        fx.push({ type: 'tornado' });
        log(s, `🌪️ Tornado! ${list.length} Figuren fliegen durcheinander.`);
        break;
      }
      case 'army': {
        const rows = color === 'w' ? [4, 5, 6] : [1, 2, 3];
        const sq = shuffle(emptySquares(s, (r) => rows.includes(r))).slice(0, 3);
        for (const { r, c } of sq) {
          const start = color === 'w' ? 6 : 1;
          s.board[r][c] = mk(s, 'p', color, r !== start);
          fx.push({ type: 'spawn', r, c });
        }
        log(s, `🪖 ${sq.length} neue ${CN[color]}e Bauern melden sich zum Dienst!`);
        break;
      }
    }
    s.points[color] -= ab.cost;
    s.abilityUsed = true;
    fx.unshift({ type: 'ability', id, icon: ab.icon, name: ab.name, color });
    normalize(s, fx);
    s.ep = null;
    updateCheck(s);
    return fx;
  }

  function quake(s, fx) {
    for (const { p, r, c } of shuffle(allPieces(s))) {
      if (s.board[r][c] !== p) continue;
      const [dr, dc] = pick(K8);
      const nr = r + dr, nc = c + dc;
      if (!inB(nr, nc) || s.board[nr][nc] || (p.type === 'k' && isLava(s, nr, nc))) continue;
      if (Math.random() < 0.35) continue;
      s.board[nr][nc] = p;
      s.board[r][c] = null;
      p.moved = true;
    }
    fx.push({ type: 'shake', strong: true });
  }

  // ---------- Chaos-Events ----------
  function randomEvent(s, fx) {
    const ev = pick(EVENTS);
    fx.push({ type: 'banner', icon: ev.icon, title: ev.name, sub: ev.desc, sound: 'event' });
    log(s, `${ev.icon} EVENT: ${ev.name}!`);
    switch (ev.id) {
      case 'meteor': {
        const sq = [];
        while (sq.length < 3) {
          const r = rnd(8), c = rnd(8);
          if (!sq.some((x) => x.r === r && x.c === c)) sq.push({ r, c });
        }
        sq.forEach(({ r, c }, i) => {
          fx.push({ type: 'meteor', r, c, delay: 600 + i * 450 });
          const p = s.board[r][c];
          if (p && p.type !== 'k') {
            s.board[r][c] = null;
            fx.push({ type: 'capture', r, c, color: p.color, kind: 'boom', delay: 600 + i * 450 + 400 });
            log(s, `☄️ Meteor zerstört ${CN[p.color]}en ${NAMES[p.type]}!`);
          }
        });
        break;
      }
      case 'lava':
        for (const { r, c } of shuffle(emptySquares(s)).slice(0, 4)) s.lava.push({ r, c, until: s.ply + 6 });
        break;
      case 'ice':
        for (const { r, c } of shuffle(emptySquares(s, (r, c) => !isIce(s, r, c))).slice(0, 7)) s.ice.push({ r, c, until: s.ply + 8 });
        break;
      case 'rotate':
        s.flipped = !s.flipped;
        break;
      case 'double':
        s.doubleUntil = s.ply + 4;
        break;
      case 'pawns': {
        const pawns = allPieces(s, (p) => p.type === 'p');
        pawns.sort((a, b) => (a.p.color === 'w' ? a.r - b.r : b.r - a.r));
        for (const { p, r, c } of pawns) {
          const d = p.color === 'w' ? -1 : 1;
          if (inB(r + d, c) && !s.board[r + d][c]) {
            s.board[r + d][c] = p;
            s.board[r][c] = null;
            p.moved = true;
          }
        }
        break;
      }
      case 'swap': {
        const c = shuffle(allPieces(s, (p) => p.type !== 'k')).slice(0, 2);
        if (c.length === 2) {
          s.board[c[0].r][c[0].c] = c[1].p;
          s.board[c[1].r][c[1].c] = c[0].p;
          log(s, `🔀 ${NAMES[c[0].p.type]} und ${NAMES[c[1].p.type]} tauschen!`);
        }
        break;
      }
      case 'gift':
        s.points.w += 5;
        s.points.b += 5;
        fx.push({ type: 'coins' });
        break;
      case 'mutation':
        for (const col of ['w', 'b'])
          for (const t of shuffle(allPieces(s, (p) => p.color === col && p.type !== 'k')).slice(0, 2)) mutatePiece(s, t.r, t.c, fx);
        break;
      case 'quake':
        quake(s, fx);
        break;
    }
    normalize(s, fx);
    s.ep = null;
  }

  window.Engine = { newGame, legalMoves, doMove, useAbility, ABILITIES, EVENTS, NAMES, CN, VAL, opp, isLava, isIce };
})();
