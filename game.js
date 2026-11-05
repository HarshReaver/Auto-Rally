'use strict';
// ---------- Settings ----------
const LAPS = 3;
const HALF = 70; // half road width in world units
const $ = id => document.getElementById(id);

// ---------- Track: a closed loop built from control points ----------
const CTRL = [[300,200],[900,120],[1500,220],[1800,500],[1550,750],[1700,1050],
              [1200,1150],[800,900],[450,1100],[150,800],[250,500]];

function spline(c, per) { // closed Catmull-Rom curve
  const out = [];
  for (let i = 0; i < c.length; i++) {
    const a = c[(i + c.length - 1) % c.length], b = c[i], d = c[(i + 1) % c.length], e = c[(i + 2) % c.length];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t, p = {};
      [['x', 0], ['y', 1]].forEach(([n, j]) => {
        p[n] = 0.5 * (2 * b[j] + (d[j] - a[j]) * t + (2 * a[j] - 5 * b[j] + 4 * d[j] - e[j]) * t2 + (3 * b[j] - a[j] - 3 * d[j] + e[j]) * t3);
      });
      out.push(p);
    }
  }
  return out;
}
const pts = spline(CTRL, 36), N = pts.length;
const tan = pts.map((p, i) => { // direction of travel at each point
  const q = pts[(i + 1) % N], dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy);
  return { x: dx / l, y: dy / l };
});
const road = new Path2D();
pts.forEach((p, i) => i ? road.lineTo(p.x, p.y) : road.moveTo(p.x, p.y));
road.closePath();

// Checkpoints are point numbers on the road. The last one is the start/finish line.
const CP = [N / 4, N / 2, 3 * N / 4, 0].map(Math.round);
const cd = (a, b) => { const d = Math.abs(a - b); return Math.min(d, N - d); };

function nearest(x, y) {
  let bi = 0, bd = 1e12;
  for (let i = 0; i < N; i++) {
    const d = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2;
    if (d < bd) { bd = d; bi = i; }
  }
  return { i: bi, d: Math.sqrt(bd) };
}

// ---------- Items: coins, boosts, cones, barrels ----------
const place = (type, i, off) => {
  const p = pts[i % N], t = tan[i % N];
  return { type, on: true, x: p.x - t.y * off, y: p.y + t.x * off };
};
const items = [];
for (let i = 20, k = 0; i < N - 10; i += 24, k++) {
  if (CP.every(c => cd(i, c) > 8)) items.push(place(k % 2 ? 'barrel' : 'cone', i, k % 4 < 2 ? 32 : -32));
}
[50, 130, 210, 290].forEach(s => { for (let j = 0; j < 5; j++) items.push(place('coin', s + j * 3, 0)); });
[100, 240, 340].forEach(i => items.push(place('boost', i, 0)));

// ---------- Sound (Web Audio, no files) ----------
let ac, master, eng, engGain;
let muted = store('autoRally.mute') === '1';

function store(key, val) { // tiny localStorage helper that never throws
  try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { /* private mode */ }
  return null;
}
function initAudio() {
  if (ac) { ac.resume(); return; }
  const A = window.AudioContext || window.webkitAudioContext;
  if (!A) return;
  ac = new A();
  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ac.destination);
  eng = ac.createOscillator(); eng.type = 'sawtooth';
  const lp = ac.createBiquadFilter(); lp.frequency.value = 350;
  engGain = ac.createGain(); engGain.gain.value = 0;
  eng.connect(lp); lp.connect(engGain); engGain.connect(master); eng.start();
}
function tone(f, dur, type = 'square', vol = 0.2, f2) {
  if (!ac || muted) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
}
function showMute() { $('mute').textContent = muted ? 'Sound: Off' : 'Sound: On'; }
$('mute').onclick = () => {
  muted = !muted; store('autoRally.mute', muted ? '1' : '0'); showMute();
  if (master) master.gain.value = muted ? 0 : 0.5;
};

// ---------- Input: keyboard and touch buttons share one state ----------
const kb = {}, tc = {};
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
addEventListener('keydown', e => { const k = KEYMAP[e.code]; if (k) { kb[k] = true; e.preventDefault(); } });
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) kb[k] = false; });
addEventListener('blur', () => { for (const k in kb) kb[k] = false; for (const k in tc) tc[k] = false; });
document.querySelectorAll('#pad button').forEach(b => {
  const set = v => { tc[b.dataset.k] = v; b.classList.toggle('on', v); };
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); set(true); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, () => set(false)));
});
addEventListener('contextmenu', e => e.preventDefault());
const inp = k => kb[k] || tc[k];

// ---------- Game state ----------
let state = 'menu', car, cam, t, lap, cp, lapStart, coins, boost, hurt, shake, countT, shown, msgTimer;
let best = parseInt(store('autoRally.best'), 10) || 0;

const fmt = ms => { const s = ms / 1000; return Math.floor(s / 60) + ':' + (s % 60).toFixed(2).padStart(5, '0'); };
const bestText = () => best ? fmt(best) : '--';

function say(text, ms = 900, small = false) {
  const m = $('msg'); m.textContent = text; m.className = small ? 'small' : '';
  clearTimeout(msgTimer); msgTimer = setTimeout(() => { m.textContent = ''; }, ms);
}
function setState(s) {
  state = s; document.body.dataset.s = s;
  $('start').hidden = s !== 'menu'; $('end').hidden = s !== 'end';
  $('best').textContent = $('best-start').textContent = bestText();
  if (s === 'menu') $('go').focus();
  if (s === 'end') $('again').focus();
}
function reset() {
  const p = pts[N - 2], a = Math.atan2(tan[N - 2].y, tan[N - 2].x);
  car = { x: p.x, y: p.y, a, v: 0 };
  cam = { x: p.x, y: p.y };
  t = 0; lap = 1; cp = 0; lapStart = 0; coins = 0; boost = 0; hurt = 0; shake = 0;
  items.forEach(i => { i.on = true; });
}
function startRace() {
  initAudio(); reset(); countT = 3; shown = 4; setState('count');
}
$('go').onclick = $('again').onclick = startRace;

function finish() {
  const isBest = !best || t < best;
  if (isBest) { best = t; store('autoRally.best', String(Math.round(t))); }
  $('end-time').textContent = fmt(t); $('end-best').textContent = fmt(best);
  $('end-coins').textContent = coins; $('newbest').hidden = !isBest;
  tone(523, 0.15, 'triangle'); setTimeout(() => tone(659, 0.15, 'triangle'), 150); setTimeout(() => tone(784, 0.4, 'triangle'), 300);
  setState('end');
}

// ---------- Driving ----------
function drive(dt) {
  boost = Math.max(0, boost - dt); hurt = Math.max(0, hurt - dt); shake = Math.max(0, shake - dt);
  const off = nearest(car.x, car.y).d > HALF;
  const max = off ? (boost ? 160 : 110) : (boost ? 400 : 250);

  if (inp('up')) car.v += (boost ? 600 : 300) * dt;
  else if (inp('down')) car.v -= 450 * dt;
  else car.v -= Math.sign(car.v) * Math.min(Math.abs(car.v), 150 * dt);
  if (car.v > max) car.v = Math.max(max, car.v - 450 * dt); // grass drags you down quickly
  car.v = Math.max(car.v, -70);

  const steer = (inp('right') ? 1 : 0) - (inp('left') ? 1 : 0);
  car.a += steer * 2.6 * dt * Math.max(-1, Math.min(1, car.v / 90));
  car.x += Math.cos(car.a) * car.v * dt;
  car.y += Math.sin(car.a) * car.v * dt;

  const n = nearest(car.x, car.y);
  $('warn').hidden = !(car.v > 30 && Math.cos(car.a) * tan[n.i].x + Math.sin(car.a) * tan[n.i].y < -0.4);

  // checkpoints must be passed in order; the last one is the finish line
  if (cd(n.i, CP[cp]) < 8) {
    if (cp === 3) {
      const split = t - lapStart; lapStart = t;
      if (lap === LAPS) { finish(); return; }
      lap++; items.forEach(i => { i.on = true; });
      say('Lap ' + (lap - 1) + ' done  ' + fmt(split), 1600, true); tone(660, 0.12, 'triangle'); setTimeout(() => tone(880, 0.2, 'triangle'), 120);
    } else {
      say('Checkpoint ' + (cp + 1) + ' of 3', 800, true); tone(660, 0.1, 'triangle');
    }
    cp = (cp + 1) % 4;
  }

  for (const it of items) {
    if (!it.on) continue;
    const d = Math.hypot(it.x - car.x, it.y - car.y);
    if (it.type === 'coin' && d < 22) { it.on = false; coins++; tone(880, 0.12, 'square', 0.12, 1320); }
    else if (it.type === 'boost' && d < 24) { it.on = false; boost = 2.5; tone(300, 0.5, 'sawtooth', 0.2, 900); say('Boost', 700, true); }
    else if ((it.type === 'cone' || it.type === 'barrel') && !hurt && d < (it.type === 'barrel' ? 20 : 17)) {
      it.on = false; hurt = 0.9; shake = 0.25; car.v *= 0.35; // brief grace time so one crash is one penalty
      tone(120, 0.3, 'sawtooth', 0.3, 40);
    }
  }
}

function step(dt) {
  if (state === 'count') {
    countT -= dt;
    const m = Math.ceil(countT);
    if (m !== shown) {
      shown = m;
      if (m > 0) { say(m, 1000); tone(440, 0.15); }
      else { setState('race'); say('Go', 700); tone(880, 0.4); }
    }
  } else if (state === 'race') {
    t += dt * 1000;
    drive(dt);
  }
  const tx = car.x + Math.cos(car.a) * car.v * 0.3, ty = car.y + Math.sin(car.a) * car.v * 0.3;
  cam.x += (tx - cam.x) * Math.min(1, dt * 6); cam.y += (ty - cam.y) * Math.min(1, dt * 6);

  if (ac) {
    const on = state === 'race';
    engGain.gain.setTargetAtTime(on ? 0.05 + 0.04 * Math.abs(car.v) / 250 : 0, ac.currentTime, 0.05);
    eng.frequency.setTargetAtTime(45 + Math.abs(car.v) * 0.35 + (boost ? 25 : 0), ac.currentTime, 0.05);
  }
  $('lap').textContent = Math.min(lap, LAPS) + '/' + LAPS;
  $('time').textContent = fmt(t);
  $('coins').textContent = coins;
}

// ---------- Drawing ----------
const cv = $('c'), ctx = cv.getContext('2d');
if (!ctx.roundRect) ctx.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); }; // older phones
let W, H, dpr;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
}
addEventListener('resize', resize); resize();

const hash = (x, y) => { const r = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return r - Math.floor(r); };

function line(x, y, dx, dy, w, color, dash) {
  ctx.beginPath(); ctx.moveTo(x - dy * HALF, y + dx * HALF); ctx.lineTo(x + dy * HALF, y - dx * HALF);
  ctx.lineWidth = w; ctx.strokeStyle = color; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
}

function drawCar() {
  if (hurt > 0 && Math.floor(hurt * 12) % 2) return; // blink while protected
  ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.a);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-18, -12, 40, 26);
  if (boost > 0) { ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.moveTo(-18, -5); ctx.lineTo(-34 - Math.random() * 10, 0); ctx.lineTo(-18, 5); ctx.fill(); }
  ctx.fillStyle = '#17231c';
  ctx.fillRect(-18, -15, 12, 6); ctx.fillRect(-18, 9, 12, 6); ctx.fillRect(12, -3, 9, 6); // wheels
  ctx.fillStyle = '#ffc928'; ctx.beginPath(); ctx.roundRect(-18, -11, 28, 22, 6); ctx.fill(); // body
  ctx.fillRect(8, -6, 12, 12); // nose
  ctx.fillStyle = '#2f6b47'; ctx.beginPath(); ctx.roundRect(-15, -9, 22, 18, 5); ctx.fill(); // roof
  ctx.fillStyle = '#fff8e1'; ctx.beginPath(); ctx.arc(20, 0, 3, 0, 7); ctx.fill(); // headlight
  ctx.restore();
}

function drawItem(it, time) {
  ctx.save(); ctx.translate(it.x, it.y);
  if (it.type === 'coin') {
    ctx.scale(Math.abs(Math.cos(time * 4 + it.x)) * 0.7 + 0.3, 1);
    ctx.fillStyle = '#ffc928'; ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill(); ctx.stroke();
  } else if (it.type === 'boost') {
    ctx.fillStyle = '#2a7fff'; ctx.strokeStyle = '#fff8e1'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(3, 0); ctx.lineTo(-5, 6); ctx.moveTo(1, -6); ctx.lineTo(9, 0); ctx.lineTo(1, 6); ctx.stroke();
  } else {
    const barrel = it.type === 'barrel';
    ctx.fillStyle = barrel ? '#c0392b' : '#ff7a1a'; ctx.strokeStyle = '#fff8e1'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, barrel ? 11 : 8, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, barrel ? 5 : 3, 0, 7); ctx.stroke();
  }
  ctx.restore();
}

function draw(time) {
  const s = Math.min(W, H) / 520, k = dpr * s;
  const sx = shake ? (Math.random() - 0.5) * shake * 40 : 0, sy = shake ? (Math.random() - 0.5) * shake * 40 : 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#4c9f58'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(k, 0, 0, k, (W / 2 + sx) * dpr - cam.x * k, (H / 2 + sy) * dpr - cam.y * k);

  // grass tufts and bushes
  const hw = W / 2 / s + 60, hh = H / 2 / s + 60, G = 80;
  for (let gx = Math.floor((cam.x - hw) / G); gx <= Math.floor((cam.x + hw) / G); gx++) {
    for (let gy = Math.floor((cam.y - hh) / G); gy <= Math.floor((cam.y + hh) / G); gy++) {
      const h = hash(gx, gy), x = gx * G + hash(gy, gx) * G, y = gy * G + h * G;
      ctx.fillStyle = h > 0.8 ? '#2f7a40' : '#3f8f4f';
      ctx.beginPath(); ctx.arc(x, y, h > 0.8 ? 18 : 5, 0, 7); ctx.fill();
    }
  }

  // road: curb, tarmac, centre line
  ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
  ctx.lineWidth = HALF * 2 + 18; ctx.strokeStyle = '#fff8e1'; ctx.stroke(road);
  ctx.strokeStyle = '#c0392b'; ctx.setLineDash([26, 26]); ctx.stroke(road);
  ctx.setLineDash([]); ctx.lineWidth = HALF * 2; ctx.strokeStyle = '#4a4a52'; ctx.stroke(road);
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,201,40,.7)'; ctx.setLineDash([18, 24]); ctx.stroke(road); ctx.setLineDash([]);

  // direction chevrons
  ctx.strokeStyle = 'rgba(255,248,225,.35)'; ctx.lineWidth = 4;
  for (let i = 0; i < N; i += 18) {
    const p = pts[i], d = tan[i];
    if (Math.abs(p.x - cam.x) > hw || Math.abs(p.y - cam.y) > hh) continue;
    ctx.beginPath();
    ctx.moveTo(p.x - d.x * 8 - d.y * 22, p.y - d.y * 8 + d.x * 22); ctx.lineTo(p.x + d.x * 8, p.y + d.y * 8);
    ctx.lineTo(p.x - d.x * 8 + d.y * 22, p.y - d.y * 8 - d.x * 22); ctx.stroke();
  }

  // checkpoints (next one is bright) and start line
  CP.forEach((c, j) => {
    if (j === 3) return;
    const next = state !== 'menu' && j === cp;
    line(pts[c].x, pts[c].y, tan[c].x, tan[c].y, next ? 6 : 3, next ? '#ffc928' : 'rgba(255,248,225,.45)');
  });
  const f = tan[0];
  line(pts[0].x, pts[0].y, f.x, f.y, 14, '#fff8e1');
  line(pts[0].x, pts[0].y, f.x, f.y, 14, '#17231c', [14, 14]);
  if (cp === 3) line(pts[0].x, pts[0].y, f.x, f.y, 4, '#ffc928');

  items.forEach(it => { if (it.on) drawItem(it, time / 1000); });
  drawCar();
}

// ---------- Main loop ----------
let last = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  step(dt); draw(now);
  requestAnimationFrame(frame);
}

reset(); showMute(); setState('menu');
requestAnimationFrame(frame);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
