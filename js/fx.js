// Partikel, Blitze, Meteoriten, Bomben & Co. auf einer Canvas über allem
(function () {
  const cv = document.getElementById('fx');
  const g = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const parts = [], bolts = [], meteors = [], rings = [], lobs = [], cracks = [], beams = [];
  let running = false;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  const R = (a, b) => a + Math.random() * (b - a);
  const pickc = (a) => a[(Math.random() * a.length) | 0];

  function add(p) {
    parts.push(Object.assign({ life: 0, grav: 0.15, drag: 0.97, rot: R(0, 6), vr: R(-0.2, 0.2) }, p));
  }

  function burst(x, y, o = {}) {
    const n = o.n || 30;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = R(o.minSpeed || 1, o.speed || 6);
      add({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0),
        max: R(30, o.life || 60), size: R(2, o.size || 6), color: pickc(o.colors || ['#fff']),
        grav: o.grav ?? 0.15, drag: o.drag ?? 0.97, glow: o.glow, shape: o.shape,
      });
    }
    start();
  }

  function ring(x, y, color, max, o = {}) {
    rings.push({ x, y, r: o.from || 4, max: max || 120, life: 0, len: o.len || 30, color, width: o.width || 6, dash: o.dash });
    start();
  }

  function debris(x, y, colors, n) {
    for (let i = 0; i < (n || 18); i++) {
      const a = R(-Math.PI, 0);
      const sp = R(3, 10);
      add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, max: R(50, 90), size: R(4, 10), color: pickc(colors), grav: 0.35, drag: 0.98, shape: 'rect', vr: R(-0.4, 0.4) });
    }
    start();
  }

  function explosion(x, y, big) {
    const s = big ? 1.5 : 1;
    burst(x, y, { n: 80 * s, colors: ['#fff6a0', '#ffb703', '#fb5607', '#ff5a36', '#ffd60a'], speed: 11 * s, size: 9, life: 60, glow: true, grav: 0.06 });
    burst(x, y, { n: 30 * s, colors: ['#4a4a50', '#2e2e33', '#6a6a70'], speed: 3.5 * s, size: 18, life: 100, grav: -0.05, drag: 0.94 });
    debris(x, y, ['#b08560', '#ebdcc0', '#3a2414', '#222'], 22 * s);
    ring(x, y, 'rgba(255,214,10,', 170 * s, { width: 10 });
    ring(x, y, 'rgba(255,255,255,', 95 * s, { width: 5, len: 20 });
  }

  function boltPath(x0, y0, x, y, rough) {
    const pts = [[x0, y0]];
    const steps = Math.max(6, Math.round(Math.hypot(x - x0, y - y0) / 38));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      pts.push([x0 + (x - x0) * t + R(-rough, rough), y0 + (y - y0) * t + R(-rough * 0.4, rough * 0.4)]);
    }
    pts.push([x, y]);
    return pts;
  }

  function lightning(x, y) {
    const x0 = x + R(-120, 120);
    const main = boltPath(x0, -20, x, y, 40);
    const paths = [{ pts: main, w: 1 }];
    // Verzweigungen
    for (let k = 0; k < 3; k++) {
      const i = 2 + ((Math.random() * (main.length - 4)) | 0);
      const [bx, by] = main[i];
      paths.push({ pts: boltPath(bx, by, bx + R(-120, 120), by + R(40, 140), 22), w: 0.5 });
    }
    bolts.push({ paths, life: 0, max: 24 });
    burst(x, y, { n: 50, colors: ['#e0f7ff', '#7df9ff', '#ffffff', '#b388ff'], speed: 9, size: 5, life: 45, glow: true, grav: 0.05 });
    ring(x, y, 'rgba(125,249,255,', 110);
    flash('#bfefff');
  }

  function meteor(x, y, onHit) {
    meteors.push({ sx: x + R(250, 450), sy: -80, x: 0, y: 0, tx: x, ty: y, t: 0, onHit });
    start();
  }

  // Bombe im Wurfbogen
  function lob(x0, y0, x, y, dur, onLand) {
    lobs.push({ x0, y0, x, y, t: 0, dur: dur || 40, onLand });
    start();
  }

  function crack(x, y, len) {
    const lines = [];
    for (let k = 0; k < 6; k++) {
      let a = R(0, Math.PI * 2), px = x, py = y;
      const pts = [[px, py]];
      const segs = 4 + ((Math.random() * 4) | 0);
      for (let i = 0; i < segs; i++) {
        a += R(-0.6, 0.6);
        const l = R(len * 0.08, len * 0.2);
        px += Math.cos(a) * l; py += Math.sin(a) * l;
        pts.push([px, py]);
      }
      lines.push(pts);
    }
    cracks.push({ lines, life: 0, max: 90 });
    start();
  }

  function vortex(x, y, rad, colors) {
    for (let i = 0; i < 120; i++) {
      add({ orbit: true, cx: x, cy: y, ang: R(0, Math.PI * 2), rad: R(rad * 0.3, rad), va: R(0.12, 0.22), vrad: R(-1.6, -0.6), max: R(50, 80), size: R(2, 5), color: pickc(colors), grav: 0, glow: true });
    }
    start();
  }

  function implode(x, y, colors) {
    for (let i = 0; i < 40; i++) {
      const a = R(0, Math.PI * 2), d = R(40, 90);
      add({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, tx: x, ty: y, converge: true, max: 26, size: R(2, 5), color: pickc(colors), grav: 0, glow: true });
    }
    start();
  }

  function shards(x, y, colors) {
    for (let i = 0; i < 18; i++) {
      const a = R(0, Math.PI * 2), sp = R(2, 6);
      add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, max: R(30, 55), size: R(5, 11), color: pickc(colors), grav: 0.12, drag: 0.95, shape: 'tri', vr: R(-0.3, 0.3) });
    }
    start();
  }

  function beam(x, y, w, color) {
    beams.push({ x, y, w, color, life: 0, max: 50 });
    for (let i = 0; i < 30; i++) add({ x: x + R(-w / 2, w / 2), y: y + R(-10, 10), vx: 0, vy: R(-3, -1), max: R(30, 60), size: R(2, 4), color: '#fff3b0', grav: -0.02, drag: 0.99, glow: true });
    start();
  }

  function flash(color) {
    const f = document.getElementById('flash');
    if (!f) return;
    f.style.background = color || '#fff';
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
  }

  function confetti() {
    const colors = ['#ff5a36', '#f4c430', '#3a6ff7', '#2fb36a', '#e63946', '#f1f0ec'];
    for (let i = 0; i < 160; i++) {
      add({ x: R(0, W), y: R(-H * 0.5, -10), vx: R(-2, 2), vy: R(1, 4), max: R(120, 220), size: R(6, 11), color: pickc(colors), grav: 0.05, drag: 0.995, shape: 'rect' });
    }
    start();
  }

  function start() {
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  function drawPath(pts) {
    g.beginPath();
    pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  }

  function tick() {
    g.clearRect(0, 0, W, H);

    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      b.life++;
      const a = Math.sin((b.life / b.max) * Math.PI);
      if (b.life >= b.max) { beams.splice(i, 1); continue; }
      g.globalAlpha = a * 0.8;
      g.fillStyle = b.color;
      const w = b.w * (0.6 + a * 0.4);
      g.fillRect(b.x - w / 2, 0, w, b.y + b.w * 0.4);
      g.globalAlpha = a;
      g.fillStyle = '#fff';
      g.fillRect(b.x - w / 6, 0, w / 3, b.y + b.w * 0.4);
      g.globalAlpha = 1;
    }

    for (let i = cracks.length - 1; i >= 0; i--) {
      const c = cracks[i];
      c.life++;
      if (c.life >= c.max) { cracks.splice(i, 1); continue; }
      const grow = Math.min(1, c.life / 10);
      g.globalAlpha = 1 - c.life / c.max;
      g.strokeStyle = '#1a1208';
      g.lineWidth = 3;
      g.lineCap = 'round';
      for (const pts of c.lines) drawPath(pts.slice(0, Math.max(2, Math.ceil(pts.length * grow))));
      g.globalAlpha = 1;
    }

    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life++;
      r.r += (r.max - r.r) * 0.15;
      const a = 1 - r.life / r.len;
      if (a <= 0) { rings.splice(i, 1); continue; }
      g.strokeStyle = r.color + a + ')';
      g.lineWidth = r.width * a + 1;
      g.beginPath(); g.arc(r.x, r.y, r.r, 0, Math.PI * 2); g.stroke();
    }

    for (let i = lobs.length - 1; i >= 0; i--) {
      const l = lobs[i];
      l.t++;
      const t = Math.min(1, l.t / l.dur);
      const x = l.x0 + (l.x - l.x0) * t;
      const arc = Math.sin(t * Math.PI) * Math.max(120, Math.abs(l.x - l.x0) * 0.4);
      const y = l.y0 + (l.y - l.y0) * t - arc;
      // Schatten am Ziel
      g.globalAlpha = 0.25 + t * 0.35;
      g.fillStyle = '#000';
      g.beginPath(); g.ellipse(l.x, l.y + 6, 6 + t * 16, 3 + t * 6, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      // Bombe
      const sc = 1 + Math.sin(t * Math.PI) * 0.6;
      g.save();
      g.translate(x, y);
      g.rotate(t * 8);
      g.fillStyle = '#1d1d1f';
      g.beginPath(); g.arc(0, 0, 11 * sc, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.beginPath(); g.arc(-4 * sc, -4 * sc, 3 * sc, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#6a6a70';
      g.fillRect(-3 * sc, -15 * sc, 6 * sc, 5 * sc);
      g.restore();
      add({ x: x + R(-3, 3), y: y - 14 * sc, vx: R(-1, 1), vy: R(-2, 0), max: R(10, 20), size: R(1.5, 3.5), color: pickc(['#ffd60a', '#ff5a36', '#fff']), grav: 0.05, glow: true });
      if (t >= 1) { lobs.splice(i, 1); l.onLand && l.onLand(); }
    }

    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.t += 0.035;
      const t = Math.min(m.t, 1);
      m.x = m.sx + (m.tx - m.sx) * t * t;
      m.y = m.sy + (m.ty - m.sy) * t * t;
      for (let k = 0; k < 3; k++)
        add({ x: m.x + R(-6, 6), y: m.y + R(-6, 6), vx: R(0.5, 2), vy: R(-2, -0.5), max: R(15, 30), size: R(4, 10), color: pickc(['#ffb703', '#fb5607', '#ff5a36', '#ffd60a']), grav: 0, drag: 0.95, glow: true });
      g.save();
      g.shadowColor = '#ff9100'; g.shadowBlur = 30;
      g.fillStyle = '#fff3b0';
      g.beginPath(); g.arc(m.x, m.y, 12, 0, Math.PI * 2); g.fill();
      g.restore();
      if (m.t >= 1) {
        meteors.splice(i, 1);
        explosion(m.tx, m.ty, false);
        m.onHit && m.onHit();
      }
    }

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life++;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      if (p.orbit) {
        p.ang += p.va; p.rad = Math.max(2, p.rad + p.vrad);
        p.x = p.cx + Math.cos(p.ang) * p.rad;
        p.y = p.cy + Math.sin(p.ang) * p.rad * 0.55 - p.life * 0.6;
      } else if (p.converge) {
        p.x += (p.tx - p.x) * 0.16; p.y += (p.ty - p.y) * 0.16;
      } else {
        p.vx *= p.drag; p.vy *= p.drag; p.vy += p.grav;
        p.x += p.vx; p.y += p.vy;
      }
      p.rot += p.vr;
      const a = 1 - p.life / p.max;
      g.globalAlpha = a;
      g.fillStyle = p.color;
      if (p.glow) { g.shadowColor = p.color; g.shadowBlur = 10; } else g.shadowBlur = 0;
      if (p.shape === 'rect') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); g.restore();
      } else if (p.shape === 'tri') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        g.beginPath(); g.moveTo(0, -p.size); g.lineTo(p.size * 0.45, p.size * 0.6); g.lineTo(-p.size * 0.45, p.size * 0.6); g.closePath(); g.fill();
        g.restore();
      } else {
        g.beginPath(); g.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2); g.fill();
      }
    }
    g.globalAlpha = 1; g.shadowBlur = 0;

    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life++;
      if (b.life > b.max) { bolts.splice(i, 1); continue; }
      const a = 1 - b.life / b.max;
      const on = b.life < 4 || b.life % 4 !== 0; // Flackern
      if (!on) continue;
      g.save();
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.shadowColor = '#7df9ff'; g.shadowBlur = 22;
      for (const path of b.paths) {
        g.strokeStyle = 'rgba(125,249,255,' + a * 0.55 + ')'; g.lineWidth = 11 * a * path.w + 2;
        drawPath(path.pts);
        g.strokeStyle = 'rgba(255,255,255,' + a + ')'; g.lineWidth = 3 * path.w + 1;
        drawPath(path.pts);
      }
      g.restore();
    }

    if (parts.length || bolts.length || meteors.length || rings.length || lobs.length || cracks.length || beams.length) requestAnimationFrame(tick);
    else { running = false; g.clearRect(0, 0, W, H); }
  }

  window.FX = { burst, explosion, lightning, meteor, ring, flash, confetti, debris, lob, crack, vortex, implode, shards, beam };
})();
