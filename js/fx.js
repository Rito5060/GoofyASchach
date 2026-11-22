// Partikel, Blitze, Meteoriten & Co. auf einer Canvas über allem
(function () {
  const cv = document.getElementById('fx');
  const g = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const parts = [], bolts = [], meteors = [], rings = [];
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

  function burst(x, y, opts = {}) {
    const n = opts.n || 30;
    const colors = opts.colors || ['#fff'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = R(opts.minSpeed || 1, opts.speed || 6);
      parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up || 0),
        life: 0, max: R(30, opts.life || 60), size: R(2, opts.size || 6),
        color: colors[(Math.random() * colors.length) | 0], grav: opts.grav ?? 0.15,
        drag: opts.drag ?? 0.97, glow: opts.glow, shape: opts.shape,
      });
    }
    start();
  }

  function ring(x, y, color, max) {
    rings.push({ x, y, r: 4, max: max || 120, life: 0, color });
    start();
  }

  function explosion(x, y, big) {
    const s = big ? 1.6 : 1;
    burst(x, y, { n: 90 * s, colors: ['#fff6a0', '#ffb703', '#fb5607', '#ff006e', '#ffd60a'], speed: 11 * s, size: 9, life: 70, glow: true, grav: 0.08 });
    burst(x, y, { n: 40, colors: ['#555', '#333', '#777'], speed: 4 * s, size: 16, life: 90, grav: -0.04, drag: 0.95 });
    ring(x, y, 'rgba(255,200,80,', 160 * s);
    ring(x, y, 'rgba(255,255,255,', 90 * s);
  }

  function lightning(x, y) {
    const pts = [];
    let cx = x + R(-80, 80), cy = -20;
    pts.push([cx, cy]);
    while (cy < y) {
      cy += R(25, 55);
      cx += R(-40, 40) + (x - cx) * 0.18;
      pts.push([Math.min(cy, y) === y ? x : cx, Math.min(cy, y)]);
    }
    pts[pts.length - 1] = [x, y];
    bolts.push({ pts, life: 0, max: 22 });
    burst(x, y, { n: 50, colors: ['#e0f7ff', '#7df9ff', '#ffffff', '#b388ff'], speed: 9, size: 5, life: 45, glow: true, grav: 0.05 });
    ring(x, y, 'rgba(125,249,255,', 110);
    flash('#bfefff');
  }

  function meteor(x, y, onHit) {
    meteors.push({ sx: x + R(250, 450), sy: -80, x: 0, y: 0, tx: x, ty: y, t: 0, onHit });
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
    const colors = ['#ff006e', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0', '#fb5607'];
    for (let i = 0; i < 160; i++) {
      parts.push({
        x: R(0, W), y: R(-H * 0.5, -10), vx: R(-2, 2), vy: R(1, 4), life: 0, max: R(120, 220),
        size: R(5, 10), color: colors[(Math.random() * colors.length) | 0], grav: 0.05, drag: 0.995, shape: 'rect', rot: R(0, 6),
      });
    }
    start();
  }

  function start() {
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  function tick() {
    g.clearRect(0, 0, W, H);

    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life++;
      r.r += (r.max - r.r) * 0.15;
      const a = 1 - r.life / 30;
      if (a <= 0) { rings.splice(i, 1); continue; }
      g.strokeStyle = r.color + a + ')';
      g.lineWidth = 6 * a + 1;
      g.beginPath(); g.arc(r.x, r.y, r.r, 0, Math.PI * 2); g.stroke();
    }

    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.t += 0.035;
      const t = Math.min(m.t, 1);
      m.x = m.sx + (m.tx - m.sx) * t * t;
      m.y = m.sy + (m.ty - m.sy) * t * t;
      for (let k = 0; k < 3; k++)
        parts.push({ x: m.x + R(-6, 6), y: m.y + R(-6, 6), vx: R(0.5, 2), vy: R(-2, -0.5), life: 0, max: R(15, 30), size: R(4, 10), color: ['#ffb703', '#fb5607', '#ff006e', '#ffd60a'][(Math.random() * 4) | 0], grav: 0, drag: 0.95, glow: true });
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
      p.vx *= p.drag; p.vy *= p.drag; p.vy += p.grav;
      p.x += p.vx; p.y += p.vy;
      const a = 1 - p.life / p.max;
      g.globalAlpha = a;
      g.fillStyle = p.color;
      if (p.glow) { g.shadowColor = p.color; g.shadowBlur = 12; } else g.shadowBlur = 0;
      if (p.shape === 'rect') {
        p.rot += 0.1;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); g.restore();
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
      const jitter = b.life % 3 === 0;
      g.save();
      g.shadowColor = '#7df9ff'; g.shadowBlur = 25;
      for (const [w, col] of [[10 * a, 'rgba(125,249,255,' + a * 0.6 + ')'], [3, 'rgba(255,255,255,' + a + ')']]) {
        g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round';
        g.beginPath();
        b.pts.forEach(([x, y], k) => {
          const jx = jitter && k > 0 && k < b.pts.length - 1 ? R(-6, 6) : 0;
          k ? g.lineTo(x + jx, y) : g.moveTo(x, y);
        });
        g.stroke();
      }
      g.restore();
    }

    if (parts.length || bolts.length || meteors.length || rings.length) requestAnimationFrame(tick);
    else { running = false; g.clearRect(0, 0, W, H); }
  }

  window.FX = { burst, explosion, lightning, meteor, ring, flash, confetti };
})();
