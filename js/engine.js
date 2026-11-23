// GoofyASchach – Spiellogik für 2–4 Spieler (Regeln, Fähigkeiten, Chaos-Events)
// Läuft beim Host (bzw. lokal). Gäste bekommen nur den fertigen Zustand.
(function () {
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const NAMES = { p: 'Bauer', n: 'Springer', b: 'Läufer', r: 'Turm', q: 'Dame', k: 'König' };
  const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  const K8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // Sitzplätze: Richtung, in die die Bauern laufen
  const SEAT_DIR = { S: [-1, 0], N: [1, 0], W: [0, 1], E: [0, -1] };
  const SEATS_BY_COUNT = { 2: ['S', 'N'], 3: ['S', 'W', 'N'], 4: ['S', 'W', 'N', 'E'] };
  const COLORS_BY_COUNT = { 2: ['white', 'black'], 3: ['red', 'blue', 'yellow'], 4: ['red', 'blue', 'yellow', 'green'] };
  const COLOR_NAMES = { white: 'Weiß', black: 'Schwarz', red: 'Rot', blue: 'Blau', yellow: 'Gelb', green: 'Grün' };

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

  // target: square | piece (beliebig, kein König) | own (eigene, kein König) | ownAny (eigene inkl. König) | enemy (gegnerisch, kein König)
  const ABILITIES = [
    { id: 'skip', cat: 'ctrl', name: 'Zug-Skip', icon: '⏭️', cost: 6, desc: 'Der nächste Spieler setzt aus. Im Extra-Zug kann kein König geschlagen werden.' },
    { id: 'blitz', cat: 'atk', name: 'Blitz', icon: '⚡', cost: 5, desc: 'Trifft eine zufällige gegnerische Figur (kein König).' },
    { id: 'bomb', cat: 'atk', name: 'Bombe', icon: '💣', cost: 10, target: 'square', desc: 'Sprengt 3×3 Felder weg – auch deine eigenen Figuren!' },
    { id: 'kamikaze', cat: 'atk', name: 'Kamikaze', icon: '🧨', cost: 4, target: 'own', desc: 'Eine eigene Figur explodiert und reißt alles um sich mit.' },
    { id: 'teleport', cat: 'ctrl', name: 'Teleport', icon: '🌀', cost: 5, target: 'own', then: 'empty', desc: 'Beame eine eigene Figur auf ein beliebiges freies Feld.' },
    { id: 'shield', cat: 'sup', name: 'Schild', icon: '🛡️', cost: 6, target: 'ownAny', desc: 'Eine eigene Figur (auch König) ist eine Runde unverwundbar.' },
    { id: 'freeze', cat: 'ctrl', name: 'Freeze', icon: '❄️', cost: 4, target: 'enemy', desc: 'Friert eine gegnerische Figur für eine Runde ein.' },
    { id: 'clone', cat: 'sup', name: 'Klon', icon: '👯', cost: 7, target: 'own', desc: 'Kopiert eine eigene Figur auf ein Nachbarfeld.' },
    { id: 'mutate', cat: 'sup', name: 'Mutation', icon: '🧬', cost: 4, target: 'piece', desc: 'Verwandelt eine Figur (kein König) in eine zufällige andere.' },
    { id: 'steal', cat: 'eco', name: 'Taschendieb', icon: '🦝', cost: 4, desc: 'Klaut ein Viertel der Punkte des reichsten Gegners (max. 6).' },
    { id: 'quake', cat: 'ctrl', name: 'Erdbeben', icon: '🌋', cost: 7, desc: 'Alle Figuren wackeln in zufällige Richtungen.' },
    { id: 'tornado', cat: 'ctrl', name: 'Tornado', icon: '🌪️', cost: 8, desc: 'Wirbelt bis zu 10 Figuren durcheinander.' },
    { id: 'army', cat: 'sup', name: 'Bauern-Armee', icon: '🪖', cost: 6, desc: '3 neue eigene Bauern spawnen bei deiner Armee.' },
    { id: 'sniper', cat: 'atk', name: 'Sniper', icon: '🎯', cost: 9, target: 'enemy', desc: 'Schaltet eine gegnerische Figur deiner Wahl aus (kein König).' },
    { id: 'chain', cat: 'atk', name: 'Kettenblitz', icon: '🌩️', cost: 12, desc: 'Drei Blitze treffen zufällige gegnerische Figuren.' },
    { id: 'poison', cat: 'atk', name: 'Gift', icon: '🧪', cost: 5, target: 'enemy', desc: 'Vergiftet eine Figur – sie stirbt nach zwei Runden.' },
    { id: 'promote', cat: 'sup', name: 'Beförderung', icon: '👑', cost: 8, target: 'ownPawn', desc: 'Ein eigener Bauer wird sofort zur Dame.' },
    { id: 'revive', cat: 'sup', name: 'Wiederbelebung', icon: '💫', cost: 7, desc: 'Holt eine verlorene Figur zurück aufs Brett.' },
    { id: 'swap', cat: 'ctrl', name: 'Platztausch', icon: '🔁', cost: 6, target: 'own', then: 'enemy', desc: 'Eigene Figur tauscht den Platz mit einer gegnerischen.' },
  ];
  const PASS_POINTS = 3;

  const EVENTS = [
    { id: 'meteor', name: 'Meteoritenregen', icon: '☄️', desc: 'Meteoriten schlagen ein!' },
    { id: 'lava', name: 'Lava-Ausbruch', icon: '🔥', desc: 'Wer auf Lava landet, verbrennt!' },
    { id: 'ice', name: 'Eiszeit', icon: '🧊', desc: 'Auf Eis rutschen Figuren weiter!' },
    { id: 'rotate', name: 'Brett-Drehung', icon: '🔄', desc: 'Oben ist jetzt unten!' },
    { id: 'double', name: 'Doppelte Punkte', icon: '💰', desc: 'Eine Runde lang doppelte Punkte!' },
    { id: 'pawns', name: 'Bauern-Sturm', icon: '🏃', desc: 'Alle Bauern rennen ein Feld vor!' },
    { id: 'swap', name: 'Platztausch', icon: '🔀', desc: 'Zufällige Figuren tauschen die Plätze!' },
    { id: 'gift', name: 'Geschenk', icon: '🎁', desc: 'Alle bekommen 5 Punkte!' },
    { id: 'mutation', name: 'Mutations-Welle', icon: '🧪', desc: 'Je 2 Figuren pro Spieler mutieren!' },
    { id: 'quake', name: 'Erdbeben', icon: '🌋', desc: 'Alles wackelt!' },
    { id: 'frost', name: 'Frost', icon: '🥶', desc: 'Je 2 Figuren pro Spieler frieren ein!' },
  ];
  // Regel-Events: gelten für eine gewisse Zahl an Zügen
  const RULES = [
    { id: 'backpawns', name: 'Rückwärts-Bauern', icon: '🔙', desc: 'Bauern laufen rückwärts!' },
    { id: 'knights', name: 'Springer-Fieber', icon: '🐴', desc: 'Alle Figuren können zusätzlich wie Springer ziehen!' },
    { id: 'ghost', name: 'Geister-Modus', icon: '👻', desc: 'Figuren gleiten durch andere hindurch!' },
    { id: 'peace', name: 'Friedenszeit', icon: '🕊️', desc: 'Niemand kann Figuren schlagen!' },
    { id: 'sprint', name: 'Königs-Sprint', icon: '🏃', desc: 'Könige ziehen bis zu 2 Felder weit!' },
    { id: 'sale', name: 'Ausverkauf', icon: '🏷️', desc: 'Alle Fähigkeiten kosten die Hälfte!' },
  ];
  const rule = (s, id) => !!s.rules && s.rules.some((r) => r.id === id && r.until > s.ply);
  const pdir = (s, p) => (rule(s, 'backpawns') ? [-p.dir[0], -p.dir[1]] : p.dir);
  function abilityCost(s, id) {
    const ab = ABILITIES.find((a) => a.id === id);
    return ab ? (rule(s, 'sale') ? Math.ceil(ab.cost / 2) : ab.cost) : 0;
  }
  const newStats = () => ({ kills: 0, kings: 0, earned: 0, spent: 0, used: 0, fav: {}, lost: 0, moves: 0, passes: 0 });

  // ---------- Grundgerüst ----------
  function mk(s, type, owner, moved) {
    const pl = s.players[owner];
    return { id: s.nextId++, type, owner, moved: !!moved, dir: SEAT_DIR[pl.seat].slice(), shield: 0, frozen: 0, poison: 0 };
  }
  function log(s, msg) {
    s.log.push(msg);
    if (s.log.length > 100) s.log.shift();
  }
  const pname = (s, i) => s.players[i].name;
  const zum = (t) => (t === 'q' ? 'zur Dame' : 'zum ' + NAMES[t]);

  function valid(s, r, c) {
    if (r < 0 || c < 0 || r >= s.n || c >= s.n) return false;
    if (s.n === 14 && (r < 3 || r > 10) && (c < 3 || c > 10)) return false;
    return true;
  }
  const at = (s, r, c) => (valid(s, r, c) ? s.board[r][c] : null);
  const isLava = (s, r, c) => s.lava.some((x) => x.r === r && x.c === c);
  const isIce = (s, r, c) => s.ice.some((x) => x.r === r && x.c === c);
  const ally = (s, a, b) => s.players[a].team === s.players[b].team;
  const shielded = (s, p) => p && p.shield > s.ply;
  const frozen = (s, p) => p && p.frozen > s.ply;
  const aliveCount = (s) => s.players.filter((p) => p.alive).length;

  const BOT_NAMES = ['Bot Bernd', 'Bot Brigitte', 'Bot Kevin', 'Bot Uschi'];
  const ULTIMATES = [
    { id: 'nuke', name: 'Atombombe', target: 'square', desc: 'Löscht ein 5×5-Feld aus. Nur Könige überleben.' },
    { id: 'army2', name: 'Klon-Armee', desc: 'Bis zu 8 deiner Bauern bekommen einen Zwilling.' },
    { id: 'armor', name: 'Königs-Rüstung', desc: 'Dein König ist 3 Runden lang unverwundbar.' },
  ];
  const EVENT_RATE = { off: 0, rare: 4, normal: 2, often: 1 };

  // opts: { mode, names, bots[], teams, boss, startPoints, events, disabled[], clockMin }
  function newGame(opts) {
    const names = opts.names;
    const bots = opts.bots || [];
    const boss = !!opts.boss;
    let list; // in Zugreihenfolge S, W, N, E
    if (boss) {
      const hs = { 1: ['S'], 2: ['W', 'E'], 3: ['W', 'S', 'E'] }[Math.min(3, Math.max(1, names.length))];
      const hc = ['red', 'blue', 'green'];
      const people = names.slice(0, 3).map((n, i) => ({ name: n, bot: !!bots[i], seat: hs[i], color: hc[i], team: 0, src: i }));
      people.push({ name: 'BOSS', bot: true, boss: true, seat: 'N', color: 'purple', team: 1, src: -1 });
      const order = { S: 0, W: 1, N: 2, E: 3 };
      list = people.sort((x, y) => order[x.seat] - order[y.seat]);
    } else {
      const count = names.length;
      const teams = !!opts.teams && count === 4;
      list = names.map((n, i) => ({
        name: n, bot: !!bots[i], seat: SEATS_BY_COUNT[count][i], color: COLORS_BY_COUNT[count][i], src: i,
        team: teams ? (SEATS_BY_COUNT[count][i] === 'S' || SEATS_BY_COUNT[count][i] === 'N' ? 0 : 1) : i,
      }));
    }
    const count = list.length;
    const n = !boss && count === 2 ? 8 : 14;
    const evRate = EVENT_RATE[opts.events || 'normal'];
    const s = {
      mode: opts.mode, n, teams: boss || (!!opts.teams && count === 4), boss,
      players: list.map((p) => ({
        name: p.name || COLOR_NAMES[p.color], seat: p.seat, color: p.color, alive: true, offline: false,
        team: p.team, bot: !!p.bot, boss: !!p.boss, src: p.src, points: opts.startPoints || 0, ult: 0, lost: [], stats: newStats(),
      })),
      board: [], turn: 0, ep: null, ply: 0, lava: [], ice: [], doubleUntil: 0, rot: 0,
      skip: null, bonus: false, abilityUsed: false, ultUsed: false, winners: null, result: null, rules: [],
      log: [], nextId: 1, lastMove: null, check: [], eventEvery: count * evRate, bossTurns: 0,
      disabled: (opts.disabled || []).slice(), clock: null,
    };
    s.opts = JSON.parse(JSON.stringify(opts));
    if (opts.clockMin) s.clock = { left: s.players.map(() => opts.clockMin * 60000), since: null, total: opts.clockMin * 60000 };
    for (let r = 0; r < n; r++) s.board.push(Array(n).fill(null));
    if (n === 8) {
      const back = 'rnbqkbnr';
      for (let c = 0; c < 8; c++) {
        s.board[0][c] = mk(s, back[c], 1);
        s.board[1][c] = mk(s, 'p', 1);
        s.board[6][c] = mk(s, 'p', 0);
        s.board[7][c] = mk(s, back[c], 0);
      }
    } else {
      // Feld relativ zur Seite: d = Abstand vom Rand, k = Position entlang der Seite (0..7)
      const put = (seat, d, k, type, owner, moved) => {
        const x = 3 + k;
        const pos = { S: [13 - d, x], N: [d, x], W: [x, d], E: [x, 13 - d] }[seat];
        const pc = mk(s, type, owner, moved);
        s.board[pos[0]][pos[1]] = pc;
        return pc;
      };
      s.players.forEach((pl, i) => {
        const back = pl.seat === 'S' || pl.seat === 'E' ? 'rnbqkbnr' : 'rnbkqbnr';
        if (pl.boss) {
          // Boss wächst mit der Spielerzahl: Leben = Spieler + 1, ab 2 Spielern eine Extra-Reihe
          const humans = s.players.length - 1;
          const b0 = 'rnbqkbnr', b1 = 'rbnqqnbr';
          for (let k = 0; k < 8; k++) {
            const pc = put('N', 0, k, b0[k], i);
            if (pc.type === 'k') { pc.hp = humans + 1; pc.maxHp = humans + 1; }
            if (humans >= 2) { put('N', 1, k, b1[k], i, true); put('N', 2, k, 'p', i, true); }
            else put('N', 1, k, 'p', i);
          }
        } else {
          for (let k = 0; k < 8; k++) { put(pl.seat, 0, k, back[k], i); put(pl.seat, 1, k, 'p', i); }
        }
      });
    }
    const modeTxt = opts.mode === 'chaos' ? '🔥 CHAOS-MODUS' : '♟️ Klassisch';
    log(s, boss ? `${modeTxt}: BOSS-KAMPF! Besiegt den Boss-König (${count} Leben).` : `${modeTxt} mit ${count} Spielern${s.teams ? ' (2 gegen 2)' : ''} gestartet!`);
    return s;
  }

  function allPieces(s, filter) {
    const out = [];
    for (let r = 0; r < s.n; r++)
      for (let c = 0; c < s.n; c++) {
        const p = s.board[r][c];
        if (p && (!filter || filter(p))) out.push({ p, r, c });
      }
    return out;
  }
  function validSquares(s, filter) {
    const out = [];
    for (let r = 0; r < s.n; r++)
      for (let c = 0; c < s.n; c++) if (valid(s, r, c) && (!filter || filter(r, c))) out.push({ r, c });
    return out;
  }
  const emptySquares = (s, filter) => validSquares(s, (r, c) => !s.board[r][c] && !isLava(s, r, c) && (!filter || filter(r, c)));

  // ---------- Angriffe & Züge ----------
  function pawnDiags(s, p, r, c) {
    const [dr, dc] = pdir(s, p);
    return dr ? [[r + dr, c - 1], [r + dr, c + 1]] : [[r - 1, c + dc], [r + 1, c + dc]];
  }

  function attacksFrom(s, r, c) {
    const p = s.board[r][c];
    const out = [];
    if (!p) return out;
    const add = (rr, cc) => { if (valid(s, rr, cc)) out.push([rr, cc]); };
    const ghost = rule(s, 'ghost');
    if (p.type === 'p') for (const [rr, cc] of pawnDiags(s, p, r, c)) add(rr, cc);
    else if (p.type === 'n') for (const [a, b] of KN) add(r + a, c + b);
    else if (p.type === 'k') {
      const reach = rule(s, 'sprint') ? 2 : 1;
      for (const [a, b] of K8)
        for (let k = 1; k <= reach; k++) {
          const rr = r + a * k, cc = c + b * k;
          if (!valid(s, rr, cc)) break;
          out.push([rr, cc]);
          if (s.board[rr][cc] && !ghost) break;
        }
    } else {
      const dirs = p.type === 'b' ? DIAG : p.type === 'r' ? ORTH : K8;
      for (const [a, b] of dirs) {
        let rr = r + a, cc = c + b;
        while (valid(s, rr, cc)) {
          out.push([rr, cc]);
          if (s.board[rr][cc] && !ghost) break;
          rr += a; cc += b;
        }
      }
    }
    if (rule(s, 'knights') && p.type !== 'n' && p.type !== 'k')
      for (const [a, b] of KN) if (valid(s, r + a, c + b) && !out.some(([x, y]) => x === r + a && y === c + b)) out.push([r + a, c + b]);
    return out;
  }

  function attackedBy(s, r, c, victim) {
    for (const { p, r: pr, c: pc } of allPieces(s, (p) => !ally(s, p.owner, victim)))
      if (attacksFrom(s, pr, pc).some(([a, b]) => a === r && b === c)) return true;
    return false;
  }
  function kingPos(s, owner) {
    const k = allPieces(s, (p) => p.type === 'k' && p.owner === owner)[0];
    return k ? [k.r, k.c] : null;
  }
  function inCheck(s, owner) {
    const k = kingPos(s, owner);
    return k ? attackedBy(s, k[0], k[1], owner) : false;
  }

  function canLand(s, p, rr, cc) {
    if (!valid(s, rr, cc)) return false;
    const t = s.board[rr][cc];
    if (!t) return true;
    if (rule(s, 'peace')) return false;
    if (ally(s, t.owner, p.owner) || shielded(s, t)) return false;
    if (t.type === 'k' && s.bonus) return false; // Extra-Zug nach Skip: König tabu
    return true;
  }

  function pseudoMoves(s, r, c) {
    const p = s.board[r][c];
    if (!p || frozen(s, p)) return [];
    const out = [];
    if (p.type === 'p') {
      const [dr, dc] = pdir(s, p);
      const back = rule(s, 'backpawns');
      const f1 = [r + dr, c + dc], f2 = [r + 2 * dr, c + 2 * dc];
      if (valid(s, f1[0], f1[1]) && !s.board[f1[0]][f1[1]]) {
        out.push({ r: f1[0], c: f1[1] });
        if (!p.moved && !back && valid(s, f2[0], f2[1]) && !s.board[f2[0]][f2[1]]) out.push({ r: f2[0], c: f2[1], dbl: true });
      }
      if (rule(s, 'knights'))
        for (const [a, b] of KN) if (canLand(s, p, r + a, c + b)) out.push({ r: r + a, c: c + b });
      for (const [rr, cc] of pawnDiags(s, p, r, c)) {
        if (!valid(s, rr, cc)) continue;
        const t = s.board[rr][cc];
        if (t) { if (canLand(s, p, rr, cc)) out.push({ r: rr, c: cc }); }
        else if (s.ep && !rule(s, 'peace') && s.ep.r === rr && s.ep.c === cc && !ally(s, s.ep.owner, p.owner)) {
          const v = at(s, s.ep.vr, s.ep.vc);
          if (v && v.type === 'p' && !shielded(s, v)) out.push({ r: rr, c: cc, ep: true });
        }
      }
    } else {
      for (const [rr, cc] of attacksFrom(s, r, c)) if (canLand(s, p, rr, cc)) out.push({ r: rr, c: cc });
      // Rochade nur auf dem 8×8-Brett
      if (s.n === 8 && p.type === 'k' && !p.moved && c === 4 && !inCheck(s, p.owner)) {
        const sides = [
          { rc: 7, step: 1, between: [5, 6], pass: [5, 6] },
          { rc: 0, step: -1, between: [1, 2, 3], pass: [3, 2] },
        ];
        for (const sd of sides) {
          const rook = at(s, r, sd.rc);
          if (rook && rook.type === 'r' && rook.owner === p.owner && !rook.moved && !frozen(s, rook) &&
            sd.between.every((x) => !s.board[r][x]) &&
            sd.pass.every((x) => !attackedBy(s, r, x, p.owner) && !isLava(s, r, x)))
            out.push({ r, c: c + 2 * sd.step, castle: sd.rc });
        }
      }
    }
    return out.filter((m) => !(p.type === 'k' && isLava(s, m.r, m.c)));
  }

  const classicMate = (s) => s.mode === 'classic' && s.players.length === 2;

  function leavesKingSafe(s, fr, fc, m) {
    const p = s.board[fr][fc];
    const b = s.board.map((row) => row.slice());
    b[m.r][m.c] = p;
    b[fr][fc] = null;
    if (m.ep) b[s.ep.vr][s.ep.vc] = null;
    return !inCheck(Object.assign({}, s, { board: b }), p.owner);
  }

  function legalMoves(s, r, c) {
    const moves = pseudoMoves(s, r, c);
    if (!classicMate(s)) return moves; // sonst gilt: König schlagen gewinnt
    return moves.filter((m) => leavesKingSafe(s, r, c, m));
  }
  function hasAnyMove(s, owner) {
    return allPieces(s, (p) => p.owner === owner).some(({ r, c }) => legalMoves(s, r, c).length > 0);
  }

  // ---------- Hilfen ----------
  function gain(s, who, n) {
    if (s.mode !== 'chaos' || n <= 0) return;
    const amt = n * (s.ply < s.doubleUntil ? 2 : 1);
    s.players[who].points += amt;
    s.players[who].stats.earned += amt;
  }
  function charge(s, who, n) {
    if (s.mode !== 'chaos' || !s.players[who] || s.players[who].boss) return;
    s.players[who].ult = Math.min(100, (s.players[who].ult || 0) + n);
  }
  function delayFrom(fx, i, d) {
    for (; i < fx.length; i++) fx[i].delay = (fx[i].delay || 0) + d;
  }
  function lose(s, p) {
    if (p && p.type !== 'k' && s.players[p.owner]) { s.players[p.owner].lost.push(p.type); s.players[p.owner].stats.lost++; charge(s, p.owner, 8); }
  }
  function destroy(s, r, c, fx, kind, by) {
    const p = at(s, r, c);
    if (!p || p.type === 'k' || shielded(s, p)) return false;
    lose(s, p);
    s.board[r][c] = null;
    fx.push({ type: 'capture', r, c, color: s.players[p.owner].color, kind });
    if (by !== undefined && !ally(s, p.owner, by)) { gain(s, by, Math.ceil(VAL[p.type] / 2)); s.players[by].stats.kills++; charge(s, by, 10); }
    return true;
  }
  function atEdge(s, p, r, c) {
    return !valid(s, r + p.dir[0], c + p.dir[1]);
  }
  function mutatePiece(s, r, c, fx) {
    const p = s.board[r][c];
    if (!p || p.type === 'k') return;
    const old = p.type;
    const opts = ['q', 'r', 'b', 'n', 'p'].filter((x) => x !== old && (x !== 'p' || !atEdge(s, p, r, c)));
    p.type = pick(opts);
    if (p.type === 'p') p.moved = true;
    fx.push({ type: 'mutate', r, c });
    log(s, `🧬 ${NAMES[old]} von ${pname(s, p.owner)} wird ${zum(p.type)}!`);
  }
  // Nach Chaos aufräumen: Bauern am Rand befördern, Lava verbrennt
  function normalize(s, fx) {
    for (const { p, r, c } of allPieces(s)) {
      if (p.type === 'p' && !rule(s, 'backpawns') && atEdge(s, p, r, c)) {
        p.type = s.mode === 'chaos' ? pick(['q', 'q', 'r', 'b', 'n']) : 'q';
        fx.push({ type: 'promote', r, c });
        log(s, `✨ Bauer von ${pname(s, p.owner)} wird zur Figur: ${NAMES[p.type]}!`);
      }
      if (p.type !== 'k' && isLava(s, r, c) && !shielded(s, p)) {
        lose(s, p);
        s.board[r][c] = null;
        fx.push({ type: 'burn', r, c, color: s.players[p.owner].color });
        log(s, `🔥 ${NAMES[p.type]} von ${pname(s, p.owner)} verbrennt in der Lava!`);
      }
    }
  }
  function updateCheck(s) {
    s.check = s.winners ? [] : s.players.map((pl, i) => i).filter((i) => s.players[i].alive && inCheck(s, i));
  }
  function nextAlive(s, from) {
    const n = s.players.length;
    for (let k = 1; k <= n; k++) {
      const i = (from + k) % n;
      if (s.players[i].alive) return i;
    }
    return from;
  }

  // Spieler ausgeschieden: Armee geht an den Königs-Killer
  function eliminate(s, victim, killer, fx) {
    const v = s.players[victim];
    v.alive = false;
    let n = 0;
    for (const { p, r, c } of allPieces(s, (p) => p.owner === victim)) {
      p.owner = killer;
      p.shield = 0;
      p.frozen = 0;
      p.poison = 0;
      fx.push({ type: 'takeover', r, c, color: s.players[killer].color });
      n++;
    }
    const loot = Math.floor(v.points / 2);
    s.players[killer].points += loot;
    s.players[killer].stats.earned += loot;
    v.points = 0;
    if (s.skip === victim) s.skip = null;
    log(s, `💀 ${v.name} ist raus! ${pname(s, killer)} übernimmt ${n} Figuren${loot ? ` und ${loot} Punkte` : ''}.`);
    fx.push({ type: 'banner', ico: 'skull', title: `${v.name} ist raus!`, sub: `${pname(s, killer)} übernimmt die Armee`, sound: 'event' });

    checkWin(s, fx);
  }
  function checkWin(s, fx) {
    const teamsLeft = [...new Set(s.players.filter((p) => p.alive).map((p) => p.team))];
    if (teamsLeft.length > 1) return;
    s.winners = s.players.map((p, i) => i).filter((i) => s.players[i].team === teamsLeft[0]);
    if (s.boss) s.result = s.players[s.winners[0]] && s.players[s.winners[0]].boss ? 'Der Boss hat alle besiegt. 👾' : 'Der Boss ist besiegt! 🎉';
    else s.result = s.teams ? 'Das Team hat alle Könige erledigt! 👑' : 'Der letzte König steht! 👑';
    log(s, `🏆 ${s.winners.map((i) => pname(s, i)).join(' & ')} gewinnt!`);
    fx.push({ type: 'win' });
    s.check = [];
  }
  // Zeit abgelaufen: Spieler fliegt raus, seine Figuren verschwinden
  function timeOut(s, who) {
    const fx = [];
    if (s.winners || !s.players[who] || !s.players[who].alive) return fx;
    const pl = s.players[who];
    pl.alive = false;
    for (const { p, r, c } of allPieces(s, (p) => p.owner === who)) {
      s.board[r][c] = null;
      fx.push({ type: 'capture', r, c, color: pl.color, kind: 'boom' });
    }
    log(s, `⏰ Die Zeit von ${pl.name} ist abgelaufen!`);
    fx.push({ type: 'banner', ico: 'clock', title: `${pl.name}: Zeit um!`, sub: 'Die Armee löst sich auf', sound: 'event' });
    checkWin(s, fx);
    if (!s.winners && s.turn === who) {
      s.ply--;
      const m = s.mode;
      s.mode = 'classic-skip';
      endTurn(s, fx);
      s.mode = m;
    }
    return fx;
  }
  function tickClock(s, now) {
    if (!s.clock || s.winners) return;
    if (s.clock.since != null) s.clock.left[s.turn] = Math.max(0, s.clock.left[s.turn] - (now - s.clock.since));
    s.clock.since = now;
  }

  // ---------- Zug ausführen ----------
  function doMove(s, who, fr, fc, tr, tc) {
    const fx = [];
    if (s.winners || s.turn !== who) return null;
    const p = at(s, fr, fc);
    if (!p || p.owner !== who) return null;
    const m = legalMoves(s, fr, fc).find((x) => x.r === tr && x.c === tc);
    if (!m) return null;

    let captured = s.board[tr][tc];
    if (m.ep) { captured = s.board[s.ep.vr][s.ep.vc]; s.board[s.ep.vr][s.ep.vc] = null; }
    s.board[tr][tc] = p;
    s.board[fr][fc] = null;
    p.moved = true;
    if (m.castle !== undefined) {
      const rook = s.board[fr][m.castle];
      const rc = m.castle === 7 ? 5 : 3;
      s.board[fr][rc] = rook;
      s.board[fr][m.castle] = null;
      rook.moved = true;
      log(s, `🏰 ${pname(s, who)} rochiert.`);
    }
    s.ep = m.dbl ? { r: (fr + tr) / 2, c: (fc + tc) / 2, vr: tr, vc: tc, owner: who } : null;

    s.players[who].stats.moves++;
    if (captured) {
      lose(s, captured);
      s.players[who].stats.kills++;
      if (captured.type === 'k') s.players[who].stats.kings++;
      const mult = s.ply < s.doubleUntil ? 2 : 1;
      fx.push({ type: 'capture', r: tr, c: tc, color: s.players[captured.owner].color, kind: 'hit' });
      gain(s, who, VAL[captured.type]);
      log(s, `⚔️ ${NAMES[p.type]} von ${pname(s, who)} schlägt ${NAMES[captured.type]} von ${pname(s, captured.owner)}` +
        (s.mode === 'chaos' && VAL[captured.type] ? ` (+${VAL[captured.type] * mult})` : ''));
      if (captured.type === 'k' && captured.hp > 1) {
        // Boss-König verliert ein Leben und flieht
        captured.hp--;
        s.players[who].stats.kings--;
        const spots = emptySquares(s, (r, c) => r <= 4 && !attackedBy(s, r, c, captured.owner));
        const spot = spots.length ? pick(spots) : pick(emptySquares(s));
        s.board[spot.r][spot.c] = captured;
        charge(s, who, 30);
        fx.push({ type: 'bossHit', r: spot.r, c: spot.c, fr: tr, fc: tc, hp: captured.hp });
        fx.push({ type: 'banner', ico: 'boss', title: 'Boss getroffen!', sub: `Noch ${captured.hp} Leben`, sound: 'event' });
        log(s, `💥 ${pname(s, who)} trifft den Boss! Noch ${captured.hp} Leben.`);
      } else {
        charge(s, who, captured.type === 'k' ? 50 : 25);
        if (captured.type === 'k') eliminate(s, captured.owner, who, fx);
      }
    } else fx.push({ type: 'move' });

    // Eis: weiterrutschen
    let cr = tr, cc = tc;
    if (s.mode === 'chaos' && m.castle === undefined && isIce(s, tr, tc)) {
      const dr = sign(tr - fr), dc = sign(tc - fc);
      let steps = 0;
      while (steps < 4 && isIce(s, cr, cc) && valid(s, cr + dr, cc + dc) && !s.board[cr + dr][cc + dc] &&
        !(p.type === 'k' && isLava(s, cr + dr, cc + dc))) {
        s.board[cr + dr][cc + dc] = p;
        s.board[cr][cc] = null;
        cr += dr; cc += dc; steps++;
      }
      if (steps) { fx.push({ type: 'slide', r: cr, c: cc }); log(s, `🧊 Rutsch! ${NAMES[p.type]} schlittert ${steps} Feld(er) weiter.`); }
    }
    s.lastMove = { fr, fc, tr: cr, tc: cc };
    normalize(s, fx);
    if (s.winners) { s.ply++; return fx; }
    const humans = s.players.length - 1;
    gain(s, who, s.players[who].boss ? (humans >= 2 ? 3 : 1) : 1);
    if (s.players[who].boss && s.mode === 'chaos') {
      s.bossTurns++;
      if (s.bossTurns % (humans >= 2 ? 2 : 3) === 0) bossAttack(s, who, fx);
      if (s.winners) { s.ply++; return fx; }
    }
    endTurn(s, fx);
    return fx;
  }

  function endTurn(s, fx) {
    s.ply++;
    s.abilityUsed = false;
    s.ultUsed = false;
    s.bonus = false;
    s.lava = s.lava.filter((x) => x.until > s.ply);
    s.ice = s.ice.filter((x) => x.until > s.ply);
    for (const r of s.rules.filter((x) => x.until <= s.ply)) {
      const def = RULES.find((d) => d.id === r.id);
      log(s, `⌛ ${def.name} ist vorbei.`);
      fx.push({ type: 'ruleEnd', id: r.id });
    }
    s.rules = s.rules.filter((x) => x.until > s.ply);
    for (const { p, r, c } of allPieces(s, (p) => p.poison && p.poison <= s.ply)) {
      p.poison = 0;
      p.shield = 0;
      if (destroy(s, r, c, fx, 'poison')) log(s, `🧪 ${NAMES[p.type]} von ${pname(s, p.owner)} erliegt dem Gift!`);
    }
    if (s.mode === 'chaos' && s.eventEvery && s.ply % s.eventEvery === 0) randomEvent(s, fx);

    const cur = s.turn;
    let next = nextAlive(s, cur);
    if (s.skip === next) {
      s.skip = null;
      log(s, `⏭️ ${pname(s, next)} wird übersprungen!`);
      fx.push({ type: 'banner', ico: 'skip', title: `${pname(s, next)} setzt aus!`, sub: 'Zug übersprungen', sound: 'skip' });
      next = nextAlive(s, next);
      if (next === cur) { s.bonus = true; s.ep = null; }
    }
    s.turn = next;

    if (classicMate(s)) {
      const chk = inCheck(s, s.turn);
      if (!hasAnyMove(s, s.turn)) {
        if (chk) {
          s.winners = [1 - s.turn];
          s.result = 'Schachmatt! ♚';
          log(s, `🏆 Schachmatt – ${pname(s, s.winners[0])} gewinnt!`);
        } else {
          s.winners = [];
          s.result = 'Patt – Unentschieden.';
          log(s, '🤝 Patt!');
        }
        fx.push({ type: 'win' });
      }
    } else {
      // Wer offline ist oder nicht ziehen kann, passt automatisch
      let guard = 0;
      while ((s.players[s.turn].offline || !hasAnyMove(s, s.turn)) && guard++ < s.players.length) {
        log(s, s.players[s.turn].offline ? `📴 ${pname(s, s.turn)} ist offline und passt.` : `😵 ${pname(s, s.turn)} kann nicht ziehen und passt.`);
        s.turn = nextAlive(s, s.turn);
        s.bonus = false;
      }
      if (guard > s.players.length) {
        s.winners = [];
        s.result = 'Niemand kann mehr ziehen – Unentschieden.';
        fx.push({ type: 'win' });
      }
    }
    updateCheck(s);
    if (s.check.length) fx.push({ type: 'check' });
  }

  // Zug passen und dafür Punkte kassieren
  function doPass(s, who) {
    if (s.mode !== 'chaos' || s.winners || s.turn !== who) return null;
    const fx = [{ type: 'pass', who }];
    gain(s, who, PASS_POINTS);
    s.players[who].stats.passes++;
    log(s, `💤 ${pname(s, who)} passt und kassiert +${PASS_POINTS * (s.ply < s.doubleUntil ? 2 : 1)} Punkte.`);
    s.lastMove = null;
    s.ep = null;
    endTurn(s, fx);
    return fx;
  }

  // Für den Host: Spieler hat die Verbindung verloren
  function setOffline(s, who, off) {
    if (!s.players[who]) return null;
    s.players[who].offline = off;
    const fx = [];
    if (!off) log(s, `🔌 ${pname(s, who)} ist wieder da!`);
    if (off && s.turn === who && !s.winners) {
      log(s, `📴 ${pname(s, who)} hat das Spiel verlassen.`);
      s.ply--; // endTurn zählt wieder hoch, ohne Event doppelt auszulösen
      s.abilityUsed = false;
      const ev = s.mode;
      s.mode = 'classic-skip';
      endTurn(s, fx);
      s.mode = ev;
    }
    return fx;
  }

  // ---------- Fähigkeiten ----------
  function validTarget(s, who, id, r, c, step) {
    const ab = ABILITIES.find((a) => a.id === id);
    if (!ab || !valid(s, r, c)) return false;
    const kind = step === 2 ? ab.then : ab.target;
    const p = s.board[r][c];
    switch (kind) {
      case 'square': return true;
      case 'empty': return !p && !isLava(s, r, c);
      case 'piece': return !!p && p.type !== 'k' && !shielded(s, p);
      case 'own': return !!p && p.owner === who && p.type !== 'k';
      case 'ownAny': return !!p && p.owner === who;
      case 'ownPawn': return !!p && p.owner === who && p.type === 'p';
      case 'enemy': return !!p && !ally(s, p.owner, who) && p.type !== 'k' && !shielded(s, p);
    }
    return false;
  }

  function abilityBlocked(s, who, id) {
    if (s.disabled && s.disabled.includes(id)) return 'Deaktiviert';
    if (id === 'skip' && (s.bonus || aliveCount(s) < 2)) return 'Im Extra-Zug nicht erlaubt';
    if (id === 'revive' && !s.players[who].lost.length) return 'Keine verlorenen Figuren';
    if (id === 'steal' && !s.players.some((p, i) => p.alive && !ally(s, i, who) && p.points >= 4)) return 'Kein Gegner hat genug Punkte';
    return null;
  }

  function useAbility(s, who, id, target) {
    const fx = [];
    const ab = ABILITIES.find((a) => a.id === id);
    if (!ab || s.mode !== 'chaos' || s.winners || s.turn !== who || s.abilityUsed) return null;
    const me = s.players[who];
    const cost = abilityCost(s, id);
    if (me.points < cost || abilityBlocked(s, who, id)) return null;
    if (ab.target && (!target || !validTarget(s, who, id, target.r, target.c, 1))) return null;
    if (ab.then && (target.r2 === undefined || !validTarget(s, who, id, target.r2, target.c2, 2))) return null;
    const enemies = s.players.map((p, i) => i).filter((i) => s.players[i].alive && !ally(s, i, who));

    switch (id) {
      case 'skip': {
        const victim = nextAlive(s, who);
        s.skip = victim;
        fx.push({ type: 'banner', ico: 'skip', title: 'Zug-Skip!', sub: `${pname(s, victim)} muss gleich aussetzen`, sound: 'skip' });
        break;
      }
      case 'blitz': {
        const c = allPieces(s, (p) => enemies.includes(p.owner) && p.type !== 'k' && !shielded(s, p));
        if (!c.length) return null;
        const t = pick(c);
        fx.push({ type: 'blitz', r: t.r, c: t.c });
        log(s, `⚡ Blitz trifft ${NAMES[t.p.type]} von ${pname(s, t.p.owner)}!`);
        destroy(s, t.r, t.c, fx, 'zap', who);
        break;
      }
      case 'bomb': {
        fx.push({ type: 'bombDrop', r: target.r, c: target.c });
        const i0 = fx.length;
        fx.push({ type: 'explode', r: target.r, c: target.c, big: true });
        let n = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++)
            if (destroy(s, target.r + dr, target.c + dc, fx, 'boom', who)) n++;
        delayFrom(fx, i0, 700);
        log(s, `💣 BOOM! ${me.name} sprengt ${n} Figur(en) weg.`);
        break;
      }
      case 'kamikaze': {
        const p = s.board[target.r][target.c];
        lose(s, p);
        s.board[target.r][target.c] = null;
        fx.push({ type: 'fuse', r: target.r, c: target.c });
        const i0 = fx.length;
        fx.push({ type: 'capture', r: target.r, c: target.c, color: me.color, kind: 'boom' });
        fx.push({ type: 'explode', r: target.r, c: target.c, big: false });
        let n = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++)
            if ((dr || dc) && destroy(s, target.r + dr, target.c + dc, fx, 'boom', who)) n++;
        delayFrom(fx, i0, 650);
        log(s, `🧨 ${NAMES[p.type]} von ${me.name} geht hoch und nimmt ${n} Figur(en) mit!`);
        break;
      }
      case 'teleport': {
        const p = s.board[target.r][target.c];
        s.board[target.r][target.c] = null;
        s.board[target.r2][target.c2] = p;
        p.moved = true;
        fx.push({ type: 'teleport', r: target.r, c: target.c, r2: target.r2, c2: target.c2 });
        log(s, `🌀 ${NAMES[p.type]} von ${me.name} teleportiert sich!`);
        break;
      }
      case 'shield': {
        const p = s.board[target.r][target.c];
        p.shield = s.ply + aliveCount(s);
        fx.push({ type: 'shield', r: target.r, c: target.c });
        log(s, `🛡️ ${me.name} schützt ${p.type === 'k' ? 'den König' : 'einen ' + NAMES[p.type]} für eine Runde.`);
        break;
      }
      case 'freeze': {
        const p = s.board[target.r][target.c];
        p.frozen = s.ply + aliveCount(s) + 1;
        fx.push({ type: 'freeze', r: target.r, c: target.c });
        log(s, `❄️ ${NAMES[p.type]} von ${pname(s, p.owner)} ist eingefroren!`);
        break;
      }
      case 'clone': {
        const p = s.board[target.r][target.c];
        const spots = shuffle(K8.map(([a, b]) => ({ r: target.r + a, c: target.c + b }))
          .filter(({ r, c }) => valid(s, r, c) && !s.board[r][c] && !isLava(s, r, c)));
        if (!spots.length) return null;
        const { r, c } = spots[0];
        const cl = mk(s, p.type, who, true);
        cl.dir = p.dir.slice();
        if (cl.type === 'p' && atEdge(s, cl, r, c)) cl.type = 'q';
        s.board[r][c] = cl;
        fx.push({ type: 'clone', r, c, fr: target.r, fc: target.c });
        log(s, `👯 ${me.name} klont einen ${NAMES[p.type]}!`);
        break;
      }
      case 'mutate':
        mutatePiece(s, target.r, target.c, fx);
        break;
      case 'sniper': {
        const p = s.board[target.r][target.c];
        fx.push({ type: 'snipe', r: target.r, c: target.c });
        log(s, `🎯 ${me.name} schaltet ${NAMES[p.type]} von ${pname(s, p.owner)} aus!`);
        const i0 = fx.length;
        destroy(s, target.r, target.c, fx, 'shot', who);
        delayFrom(fx, i0, 750);
        break;
      }
      case 'chain': {
        const c = shuffle(allPieces(s, (p) => enemies.includes(p.owner) && p.type !== 'k' && !shielded(s, p))).slice(0, 3);
        if (!c.length) return null;
        c.forEach((t, i) => {
          const i0 = fx.length;
          fx.push({ type: 'blitz', r: t.r, c: t.c });
          destroy(s, t.r, t.c, fx, 'zap', who);
          delayFrom(fx, i0, i * 320);
        });
        log(s, `🌩️ Kettenblitz! ${c.length} Figuren gegrillt.`);
        break;
      }
      case 'poison': {
        const p = s.board[target.r][target.c];
        p.poison = s.ply + aliveCount(s) * 2;
        fx.push({ type: 'poison', r: target.r, c: target.c });
        log(s, `🧪 ${NAMES[p.type]} von ${pname(s, p.owner)} ist vergiftet!`);
        break;
      }
      case 'promote': {
        const p = s.board[target.r][target.c];
        p.type = 'q';
        fx.push({ type: 'promote', r: target.r, c: target.c });
        log(s, `👑 ${me.name} befördert einen Bauern zur Dame!`);
        break;
      }
      case 'revive': {
        if (!me.lost.length) return null;
        const mine = allPieces(s, (p) => p.owner === who);
        const near = shuffle(emptySquares(s, (r, c) => mine.some((m) => Math.abs(m.r - r) <= 1 && Math.abs(m.c - c) <= 1)));
        if (!near.length) return null;
        const li = rnd(me.lost.length);
        const type = me.lost.splice(li, 1)[0];
        const { r, c } = near[0];
        const np = mk(s, type, who, true);
        if (np.type === 'p' && atEdge(s, np, r, c)) np.type = 'q';
        s.board[r][c] = np;
        fx.push({ type: 'revive', r, c });
        log(s, `💫 ${me.name} holt einen ${NAMES[type]} zurück!`);
        break;
      }
      case 'swap': {
        const a = s.board[target.r][target.c], b = s.board[target.r2][target.c2];
        s.board[target.r][target.c] = b;
        s.board[target.r2][target.c2] = a;
        a.moved = b.moved = true;
        fx.push({ type: 'teleport', r: target.r, c: target.c, r2: target.r2, c2: target.c2 });
        log(s, `🔁 ${NAMES[a.type]} von ${me.name} tauscht mit ${NAMES[b.type]} von ${pname(s, b.owner)}!`);
        break;
      }
      case 'steal': {
        const rich = enemies.slice().sort((a, b) => s.players[b].points - s.players[a].points)[0];
        if (rich === undefined) return null;
        const amt = Math.min(6, Math.floor(s.players[rich].points / 4));
        s.players[rich].points -= amt;
        me.points += amt;
        me.stats.earned += amt;
        fx.push({ type: 'steal', from: rich, to: who, amt });
        log(s, `🦝 ${me.name} klaut ${amt} Punkte von ${pname(s, rich)}!`);
        break;
      }
      case 'quake':
        quake(s, fx);
        log(s, `🌋 ${me.name} löst ein Erdbeben aus!`);
        break;
      case 'tornado': {
        const list = shuffle(allPieces(s, (p) => p.type !== 'k' && !shielded(s, p))).slice(0, 10);
        const sq = shuffle(list.map(({ r, c }) => ({ r, c })));
        for (const { r, c } of list) s.board[r][c] = null;
        list.forEach(({ p }, i) => { s.board[sq[i].r][sq[i].c] = p; p.moved = true; });
        fx.push({ type: 'tornado' });
        log(s, `🌪️ Tornado! ${list.length} Figuren fliegen durcheinander.`);
        break;
      }
      case 'army': {
        // Felder nahe den eigenen Figuren
        const mine = allPieces(s, (p) => p.owner === who);
        const near = emptySquares(s, (r, c) => mine.some((m) => Math.abs(m.r - r) <= 2 && Math.abs(m.c - c) <= 2));
        const sq = shuffle(near).slice(0, 3);
        for (const { r, c } of sq) {
          const pawn = mk(s, 'p', who, true);
          if (atEdge(s, pawn, r, c)) pawn.type = 'n';
          s.board[r][c] = pawn;
          fx.push({ type: 'spawn', r, c, kind: 'drop' });
        }
        log(s, `🪖 ${sq.length} neue Bauern von ${me.name} melden sich zum Dienst!`);
        break;
      }
    }
    me.points -= cost;
    me.stats.spent += cost;
    me.stats.used++;
    me.stats.fav[id] = (me.stats.fav[id] || 0) + 1;
    s.abilityUsed = true;
    fx.unshift({ type: 'ability', id, cat: ab.cat, name: ab.name, who });
    normalize(s, fx);
    s.ep = null;
    updateCheck(s);
    return fx;
  }

  function quake(s, fx) {
    for (const { p, r, c } of shuffle(allPieces(s))) {
      if (s.board[r][c] !== p || shielded(s, p) || Math.random() < 0.35) continue;
      const [dr, dc] = pick(K8);
      const nr = r + dr, nc = c + dc;
      if (!valid(s, nr, nc) || s.board[nr][nc] || (p.type === 'k' && isLava(s, nr, nc))) continue;
      s.board[nr][nc] = p;
      s.board[r][c] = null;
      p.moved = true;
    }
    fx.push({ type: 'shake', strong: true });
  }

  // ---------- Chaos-Events ----------
  function randomEvent(s, fx) {
    const freeRules = RULES.filter((r) => !rule(s, r.id));
    if (freeRules.length && Math.random() < 0.45) {
      const rl = pick(freeRules);
      const dur = Math.max(4, s.players.length * 2);
      s.rules.push({ id: rl.id, until: s.ply + dur });
      fx.push({ type: 'banner', ico: 'rule-' + rl.id, title: rl.name, sub: `${rl.desc} (${dur} Züge)`, sound: 'event', rule: true });
      log(s, `${rl.icon} REGEL: ${rl.name} – ${dur} Züge lang!`);
      s.ep = null;
      return;
    }
    const ev = pick(EVENTS);
    const big = s.n === 14;
    fx.push({ type: 'banner', ico: ev.id, title: ev.name, sub: ev.desc, sound: 'event' });
    log(s, `${ev.icon} EVENT: ${ev.name}!`);
    const alive = s.players.map((p, i) => i).filter((i) => s.players[i].alive);
    switch (ev.id) {
      case 'meteor': {
        const sq = shuffle(validSquares(s)).slice(0, big ? 6 : 3);
        sq.forEach(({ r, c }, i) => {
          const d = 600 + i * 400;
          fx.push({ type: 'meteor', r, c, delay: d });
          const p = s.board[r][c];
          if (p && p.type !== 'k' && !shielded(s, p)) {
            lose(s, p);
            s.board[r][c] = null;
            fx.push({ type: 'capture', r, c, color: s.players[p.owner].color, kind: 'boom', delay: d + 400 });
            log(s, `☄️ Meteor zerstört ${NAMES[p.type]} von ${pname(s, p.owner)}!`);
          }
        });
        break;
      }
      case 'lava':
        for (const { r, c } of shuffle(emptySquares(s)).slice(0, big ? 9 : 4)) s.lava.push({ r, c, until: s.ply + s.eventEvery + 2 });
        break;
      case 'ice':
        for (const { r, c } of shuffle(emptySquares(s, (r, c) => !isIce(s, r, c))).slice(0, big ? 14 : 7)) s.ice.push({ r, c, until: s.ply + s.eventEvery * 2 });
        break;
      case 'rotate':
        s.rot = (s.rot + 2) % 4;
        break;
      case 'double':
        s.doubleUntil = s.ply + aliveCount(s);
        break;
      case 'pawns': {
        // Vorderste Bauern zuerst
        const pawns = allPieces(s, (p) => p.type === 'p');
        pawns.sort((a, b) => (b.r * a.p.dir[0] + b.c * a.p.dir[1]) - (a.r * a.p.dir[0] + a.c * a.p.dir[1]));
        for (const { p, r, c } of pawns) {
          const nr = r + p.dir[0], nc = c + p.dir[1];
          if (s.board[r][c] === p && valid(s, nr, nc) && !s.board[nr][nc] && !frozen(s, p)) {
            s.board[nr][nc] = p;
            s.board[r][c] = null;
            p.moved = true;
          }
        }
        break;
      }
      case 'swap': {
        const times = big ? 3 : 1;
        for (let k = 0; k < times; k++) {
          const c = shuffle(allPieces(s, (p) => p.type !== 'k' && !shielded(s, p))).slice(0, 2);
          if (c.length === 2) {
            s.board[c[0].r][c[0].c] = c[1].p;
            s.board[c[1].r][c[1].c] = c[0].p;
          }
        }
        break;
      }
      case 'gift':
        for (const i of alive) { s.players[i].points += 5; s.players[i].stats.earned += 5; }
        fx.push({ type: 'coins' });
        break;
      case 'mutation':
        for (const i of alive)
          for (const t of shuffle(allPieces(s, (p) => p.owner === i && p.type !== 'k')).slice(0, 2)) mutatePiece(s, t.r, t.c, fx);
        break;
      case 'frost':
        for (const i of alive)
          for (const t of shuffle(allPieces(s, (p) => p.owner === i && p.type !== 'k')).slice(0, 2)) {
            t.p.frozen = s.ply + aliveCount(s) + 1;
            fx.push({ type: 'freeze', r: t.r, c: t.c });
          }
        break;
      case 'quake':
        quake(s, fx);
        break;
    }
    normalize(s, fx);
    s.ep = null;
  }

  // ---------- Ultimates ----------
  function useUltimate(s, who, id, target) {
    const fx = [];
    const me = s.players[who];
    if (s.mode !== 'chaos' || s.winners || s.turn !== who || s.ultUsed || (me.ult || 0) < 100) return null;
    const u = ULTIMATES.find((x) => x.id === id);
    if (!u) return null;
    if (u.target && (!target || !valid(s, target.r, target.c))) return null;
    switch (id) {
      case 'nuke': {
        fx.push({ type: 'nukeDrop', r: target.r, c: target.c, who });
        const i0 = fx.length;
        fx.push({ type: 'nuke', r: target.r, c: target.c });
        let n = 0;
        for (let dr = -2; dr <= 2; dr++)
          for (let dc = -2; dc <= 2; dc++) if (destroy(s, target.r + dr, target.c + dc, fx, 'boom', who)) n++;
        delayFrom(fx, i0, 1100);
        log(s, `☢️ ${me.name} zündet die ATOMBOMBE! ${n} Figuren verdampft.`);
        break;
      }
      case 'army2': {
        let n = 0;
        for (const { p, r, c } of shuffle(allPieces(s, (p) => p.owner === who && p.type === 'p'))) {
          if (n >= 8) break;
          const spot = shuffle(K8.map(([a, b]) => ({ r: r + a, c: c + b }))).find(({ r: rr, c: cc }) => valid(s, rr, cc) && !s.board[rr][cc] && !isLava(s, rr, cc));
          if (!spot) continue;
          const cl = mk(s, 'p', who, true);
          cl.dir = p.dir.slice();
          if (atEdge(s, cl, spot.r, spot.c)) cl.type = 'q';
          s.board[spot.r][spot.c] = cl;
          fx.push({ type: 'clone', r: spot.r, c: spot.c, fr: r, fc: c });
          n++;
        }
        log(s, `👥 ${me.name} ruft die KLON-ARMEE! ${n} neue Bauern.`);
        break;
      }
      case 'armor': {
        const k = kingPos(s, who);
        if (!k) return null;
        s.board[k[0]][k[1]].shield = s.ply + aliveCount(s) * 3;
        fx.push({ type: 'armor', r: k[0], c: k[1] });
        log(s, `🛡️ ${me.name} legt die KÖNIGS-RÜSTUNG an!`);
        break;
      }
    }
    me.ult = 0;
    s.ultUsed = true;
    fx.unshift({ type: 'banner', ico: 'ult-' + id, title: u.name.toUpperCase() + '!', sub: me.name, sound: 'ult', ult: true });
    normalize(s, fx);
    updateCheck(s);
    return fx;
  }

  // ---------- Boss-Angriffe ----------
  function bossAttack(s, boss, fx) {
    const humans = allPieces(s, (p) => !ally(s, p.owner, boss) && p.type !== 'k' && !shielded(s, p));
    const kind = pick(['meteor', 'summon', 'curse']);
    if (kind === 'meteor' && humans.length) {
      fx.push({ type: 'banner', ico: 'boss', title: 'Boss-Angriff!', sub: 'Feuerregen auf eure Figuren', sound: 'event' });
      shuffle(humans).slice(0, Math.min(3, s.players.length)).forEach(({ p, r, c }, i) => {
        const d = 600 + i * 400;
        fx.push({ type: 'meteor', r, c, delay: d });
        lose(s, p);
        s.board[r][c] = null;
        fx.push({ type: 'capture', r, c, color: s.players[p.owner].color, kind: 'boom', delay: d + 400 });
      });
      log(s, '👾 Der Boss lässt Feuer regnen!');
    } else if (kind === 'curse' && humans.length) {
      fx.push({ type: 'banner', ico: 'boss', title: 'Boss-Fluch!', sub: 'Vier eurer Figuren frieren ein', sound: 'event' });
      for (const { p, r, c } of shuffle(humans).slice(0, 4)) {
        p.frozen = s.ply + aliveCount(s) + 1;
        fx.push({ type: 'freeze', r, c });
      }
      log(s, '👾 Der Boss verflucht eure Figuren!');
    } else {
      const k = kingPos(s, boss);
      const near = k ? shuffle(emptySquares(s, (r, c) => Math.abs(r - k[0]) <= 2 && Math.abs(c - k[1]) <= 2)) : [];
      const sq = near.slice(0, 3);
      for (const { r, c } of sq) {
        s.board[r][c] = mk(s, pick(['n', 'b', 'p', 'p']), boss, true);
        fx.push({ type: 'spawn', r, c, kind: 'drop' });
      }
      fx.push({ type: 'banner', ico: 'boss', title: 'Boss ruft Diener!', sub: `${sq.length} neue Figuren`, sound: 'event' });
      log(s, `👾 Der Boss beschwört ${sq.length} Diener!`);
    }
    normalize(s, fx);
  }

  // ---------- Computergegner ----------
  function simAttacked(s, board, r, c, owner) {
    return attackedBy(Object.assign({}, s, { board }), r, c, owner);
  }
  function scoreMove(s, who, fr, fc, m) {
    const p = s.board[fr][fc];
    const t = s.board[m.r][m.c];
    let sc = 0;
    if (t) sc += t.type === 'k' ? (t.hp > 1 ? 60 : 1000) : VAL[t.type] * 10;
    const b = s.board.map((row) => row.slice());
    b[m.r][m.c] = p;
    b[fr][fc] = null;
    if (m.ep) b[s.ep.vr][s.ep.vc] = null;
    const v = p.type === 'k' ? 40 : VAL[p.type];
    if (simAttacked(s, b, m.r, m.c, who) && !shielded(s, p)) sc -= v * 9;
    else if (simAttacked(s, s.board, fr, fc, who)) sc += v * 4; // Figur gerettet
    if (p.type !== 'k') {
      const k = kingPos(s, who);
      if (k && simAttacked(s, b, k[0], k[1], who)) sc -= 300;
    }
    if (isLava(s, m.r, m.c) && p.type !== 'k') sc -= v * 10;
    const mid = (s.n - 1) / 2;
    sc -= (Math.abs(m.r - mid) + Math.abs(m.c - mid)) * 0.15;
    if (p.type === 'p') sc += 0.4;
    if (p.type === 'k' && !t) sc -= 1.5;
    return sc + Math.random() * 1.2;
  }
  function enemyValueAround(s, who, r, c, rad) {
    let v = 0;
    for (let dr = -rad; dr <= rad; dr++)
      for (let dc = -rad; dc <= rad; dc++) {
        const p = at(s, r + dr, c + dc);
        if (!p || p.type === 'k' || shielded(s, p)) continue;
        v += ally(s, p.owner, who) ? -VAL[p.type] * 1.3 : VAL[p.type];
      }
    return v;
  }
  function botAbility(s, who) {
    if (s.mode !== 'chaos' || s.abilityUsed) return null;
    const me = s.players[who];
    const can = (id) => !abilityBlocked(s, who, id) && me.points >= abilityCost(s, id);
    const cands = [];
    const enemiesP = allPieces(s, (p) => !ally(s, p.owner, who) && p.type !== 'k' && !shielded(s, p));
    const k = kingPos(s, who);
    if (k && inCheck(s, who) && can('shield')) cands.push({ sc: 50, a: { type: 'ability', id: 'shield', target: { r: k[0], c: k[1] } } });
    if (can('sniper') && enemiesP.length) {
      const t = enemiesP.sort((x, y) => VAL[y.p.type] - VAL[x.p.type])[0];
      if (VAL[t.p.type] >= 5) cands.push({ sc: VAL[t.p.type] - abilityCost(s, 'sniper') * 0.5, a: { type: 'ability', id: 'sniper', target: { r: t.r, c: t.c } } });
    }
    if (can('bomb')) {
      let best = null;
      for (const sq of validSquares(s)) {
        const v = enemyValueAround(s, who, sq.r, sq.c, 1);
        if (!best || v > best.v) best = { v, sq };
      }
      if (best && best.v >= 7) cands.push({ sc: best.v - abilityCost(s, 'bomb') * 0.5, a: { type: 'ability', id: 'bomb', target: best.sq } });
    }
    if (can('promote')) {
      const pw = allPieces(s, (p) => p.owner === who && p.type === 'p');
      if (pw.length) cands.push({ sc: 6 - abilityCost(s, 'promote') * 0.4, a: { type: 'ability', id: 'promote', target: { r: pw[0].r, c: pw[0].c } } });
    }
    if (can('chain') && enemiesP.length >= 3) cands.push({ sc: 4, a: { type: 'ability', id: 'chain' } });
    if (can('blitz') && enemiesP.length) cands.push({ sc: 2, a: { type: 'ability', id: 'blitz' } });
    if (can('army')) cands.push({ sc: 1.5, a: { type: 'ability', id: 'army' } });
    if (can('revive') && me.lost.some((t) => VAL[t] >= 5)) cands.push({ sc: 3, a: { type: 'ability', id: 'revive' } });
    cands.forEach((c) => (c.sc += Math.random() * 2));
    cands.sort((x, y) => y.sc - x.sc);
    return cands.length && cands[0].sc > 2 ? cands[0].a : null;
  }
  function botAction(s, who, plain) {
    const me = s.players[who];
    if (s.winners || s.turn !== who) return null;
    // Ultimate
    if (!plain && s.mode === 'chaos' && !s.ultUsed && (me.ult || 0) >= 100) {
      const k = kingPos(s, who);
      if (k && inCheck(s, who)) return { type: 'ult', id: 'armor' };
      let best = null;
      for (const sq of validSquares(s)) {
        const v = enemyValueAround(s, who, sq.r, sq.c, 2);
        if (!best || v > best.v) best = { v, sq };
      }
      if (best && best.v >= 8) return { type: 'ult', id: 'nuke', target: best.sq };
      return { type: 'ult', id: allPieces(s, (p) => p.owner === who && p.type === 'p').length >= 3 ? 'army2' : 'armor' };
    }
    if (!plain && Math.random() < 0.7) {
      const ab = botAbility(s, who);
      if (ab) return ab;
    }
    let best = null;
    for (const { r, c } of allPieces(s, (p) => p.owner === who))
      for (const m of legalMoves(s, r, c)) {
        const sc = scoreMove(s, who, r, c, m);
        if (!best || sc > best.sc) best = { sc, a: { type: 'move', fr: r, fc: c, tr: m.r, tc: m.c } };
      }
    if (s.mode === 'chaos' && (!best || (best.sc < -6 && Math.random() < 0.4))) return { type: 'pass' };
    return best ? best.a : { type: 'pass' };
  }

  window.Engine = {
    ULTIMATES, BOT_NAMES, useUltimate, botAction, timeOut, tickClock,
    newGame, legalMoves, RULES, rule, abilityCost, doMove, doPass, PASS_POINTS, useAbility, validTarget, abilityBlocked, setOffline, valid,
    ABILITIES, EVENTS, NAMES, VAL, COLOR_NAMES, isLava, isIce, shielded, frozen,
  };
})();
