// Synthetische Soundeffekte (Web Audio, keine Dateien nötig)
(function () {
  let ctx = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem('gs-muted') === '1'; } catch (e) {}

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }

  function tone(freq, dur, opts = {}) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + (opts.at || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const v = opts.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise(dur, opts = {}) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + (opts.at || 0);
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = opts.filter || 'lowpass';
    f.frequency.setValueAtTime(opts.freq || 1200, t);
    if (opts.freqTo) f.frequency.exponentialRampToValueAtTime(opts.freqTo, t + dur);
    const g = ctx.createGain();
    const v = opts.vol ?? 0.4;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }

  const S = {
    move() { tone(420, 0.08, { type: 'triangle', to: 260, vol: 0.25 }); noise(0.05, { freq: 2500, vol: 0.15 }); },
    capture() { noise(0.18, { freq: 900, vol: 0.5 }); tone(160, 0.2, { type: 'square', to: 60, vol: 0.2 }); },
    explode() {
      noise(1.2, { freq: 1800, freqTo: 60, vol: 0.9 });
      tone(90, 0.9, { type: 'sine', to: 25, vol: 0.6 });
      tone(55, 1.1, { type: 'sawtooth', to: 20, vol: 0.2 });
    },
    zap() {
      tone(1800, 0.25, { type: 'sawtooth', to: 80, vol: 0.25 });
      noise(0.35, { filter: 'highpass', freq: 3000, vol: 0.4 });
      tone(60, 0.4, { type: 'square', to: 30, vol: 0.2, at: 0.05 });
    },
    coin() { tone(988, 0.08, { type: 'square', vol: 0.15 }); tone(1319, 0.25, { type: 'square', vol: 0.15, at: 0.08 }); },
    event() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'square', vol: 0.12, at: i * 0.08 }));
      tone(1047, 0.5, { type: 'triangle', vol: 0.2, at: 0.32 });
    },
    skip() { tone(600, 0.1, { type: 'square', vol: 0.15 }); tone(900, 0.15, { type: 'square', vol: 0.15, at: 0.1 }); },
    ice() { tone(2000, 0.4, { type: 'sine', to: 1200, vol: 0.12 }); noise(0.4, { filter: 'highpass', freq: 5000, vol: 0.15 }); },
    burn() { noise(0.7, { filter: 'bandpass', freq: 600, freqTo: 200, vol: 0.5 }); },
    mutate() { tone(300, 0.5, { type: 'sine', to: 900, vol: 0.2 }); tone(450, 0.5, { type: 'triangle', to: 150, vol: 0.15 }); },
    spawn() { tone(200, 0.15, { type: 'triangle', to: 500, vol: 0.2 }); },
    whoosh() { noise(0.9, { filter: 'bandpass', freq: 300, freqTo: 2500, vol: 0.5 }); },
    rumble() { noise(1.0, { freq: 200, vol: 0.8 }); tone(40, 1, { type: 'sine', vol: 0.5 }); },
    meteorFall() { tone(1200, 0.5, { type: 'sawtooth', to: 200, vol: 0.08 }); },
    check() { tone(880, 0.12, { type: 'square', vol: 0.15 }); tone(880, 0.12, { type: 'square', vol: 0.15, at: 0.18 }); },
    win() { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.25, at: i * 0.14 })); },
    fuse() { noise(0.6, { filter: 'highpass', freq: 4000, vol: 0.25 }); [0, .15, .3, .45].forEach((t) => tone(1400, 0.05, { type: 'square', vol: 0.08, at: t })); },
    lock() { tone(1200, 0.06, { type: 'square', vol: 0.1 }); tone(1200, 0.06, { type: 'square', vol: 0.1, at: 0.25 }); tone(1600, 0.12, { type: 'square', vol: 0.12, at: 0.5 }); },
    shot() { noise(0.25, { freq: 3000, freqTo: 300, vol: 0.7 }); tone(180, 0.2, { type: 'square', to: 50, vol: 0.25 }); },
    cast() { tone(520, 0.12, { type: 'triangle', to: 1040, vol: 0.15 }); },
    snore() { tone(140, 0.5, { type: 'sawtooth', to: 110, vol: 0.06 }); tone(150, 0.5, { type: 'sawtooth', to: 120, vol: 0.06, at: 0.6 }); },
    swish() { noise(0.4, { filter: 'bandpass', freq: 800, freqTo: 4000, vol: 0.3 }); },
    fanfare() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, { type: 'square', vol: 0.1, at: i * 0.09 })); },
    shield() { tone(400, 0.4, { type: 'sine', to: 800, vol: 0.2 }); tone(800, 0.5, { type: 'triangle', vol: 0.08, at: 0.1 }); },
    poison() { [0, .12, .24].forEach((t) => tone(300 + Math.random() * 200, 0.1, { type: 'sine', to: 600, vol: 0.12, at: t })); },
    warp() { tone(200, 0.35, { type: 'sine', to: 1600, vol: 0.18 }); tone(1600, 0.3, { type: 'sine', to: 300, vol: 0.12, at: 0.33 }); },
    clone() { tone(600, 0.12, { type: 'triangle', vol: 0.15 }); tone(600, 0.12, { type: 'triangle', vol: 0.15, at: 0.12 }); },
    revive() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, { type: 'sine', vol: 0.12, at: i * 0.07 })); },
    thud() { tone(120, 0.15, { type: 'sine', to: 50, vol: 0.3 }); noise(0.08, { freq: 400, vol: 0.2 }); },
    ult() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'sawtooth', vol: 0.09, at: i * 0.07 })); noise(0.6, { filter: 'bandpass', freq: 500, freqTo: 3000, vol: 0.25 }); },
    siren() { tone(600, 0.5, { type: 'sine', to: 1000, vol: 0.12 }); tone(1000, 0.5, { type: 'sine', to: 600, vol: 0.12, at: 0.5 }); },
    nuke() { noise(2.2, { freq: 2500, freqTo: 40, vol: 1 }); tone(60, 2, { type: 'sine', to: 18, vol: 0.7 }); tone(40, 2, { type: 'sawtooth', to: 15, vol: 0.25 }); },
    bosshit() { tone(220, 0.4, { type: 'square', to: 55, vol: 0.25 }); noise(0.5, { freq: 1200, vol: 0.5 }); tone(330, 0.3, { type: 'sawtooth', to: 110, vol: 0.15, at: 0.1 }); },
    click() { tone(700, 0.04, { type: 'square', vol: 0.08 }); },
  };

  window.Sound = {
    init,
    play(name) { init(); if (S[name]) S[name](); },
    toggle() { muted = !muted; try { localStorage.setItem('gs-muted', muted ? '1' : '0'); } catch (e) {} return muted; },
    get muted() { return muted; },
  };
})();
