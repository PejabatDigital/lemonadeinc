/* Lemonade Inc. | render.js
   Everything drawn on the canvas: sky, locations, stand, customers, weather and effects. */
'use strict';

// ---------- canvas ----------
const cv = $('#cv'), ctx = cv.getContext('2d');
function resize(){
  const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  // "Cover" the box with the fixed W×H scene, cropping the overflow rather than letterboxing.
  // On the box's native 960:440 ratio this reduces to the old fit-exactly behaviour (no overflow).
  const scale = Math.max(r.width / W, r.height / H);
  const ox = (r.width - W * scale) / 2;
  const oy = -(H * scale - r.height) * 0.65; // bias the crop toward the lower half, where the stand sits
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr);
}
window.addEventListener('resize', resize);

function rr(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }

// ---------- colour + drawing helpers ----------
function hex2rgb(h){ const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, t){ const A = hex2rgb(a), B = hex2rgb(b); return '#' + A.map((v,i) => Math.round(v + (B[i]-v)*t).toString(16).padStart(2,'0')).join(''); }
const shade = (h, a) => mix(h, a < 0 ? '#000000' : '#ffffff', Math.abs(a));
const dayP = () => sim ? sim.min / DAY_MIN : 0.06;
const warmth = () => clamp((dayP() - 0.6) / 0.4, 0, 1);
const curWeather = () => sim ? sim.weather : S.forecast.type;
const isWet = () => { const w = curWeather(); return w === 'rain' || w === 'storm'; };
function shadowAt(x, y, rx, ry, a = 0.22){ ctx.fillStyle = `rgba(25,35,30,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); }
function circ(x, y, r, c){ ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }

const SKIES = { hot:['#4FB8EC','#CDEFFF'], sunny:['#74C6EC','#D6F1FF'], cloudy:['#98AEBD','#DAE3E8'], rain:['#6B8190','#AABBC5'], storm:['#414D57','#818E97'] };

// ---------- scenery (seeded so it's stable) ----------
const scenery = {};
function getScenery(id){
  if (scenery[id]) return scenery[id];
  const R = mulberry(id.length * 991 + id.charCodeAt(0) * 17), items = [];
  if (id === 'lane') {
    const cols = ['#F4C3B0','#BFE0CF','#F6E09E','#C7D3F0','#F0BFD6','#D9E8B8'];
    for (let x = 6; x < W; x += 150 + R()*40) {
      if (Math.abs(x + 55 - STAND_X) < 20) continue;
      items.push({ k:'house', x, w:100 + R()*30, h:62 + R()*24, c:cols[Math.floor(R()*cols.length)], chim:R() < .6, lit:R(), door:pick(['#7A4A32','#3F6E8C','#8C3B3B','#3F7A4E']) });
      items.push({ k:'tree', x:x + 135 + R()*10, s:0.8 + R()*0.4 });
    }
  } else if (id === 'park') {
    items.push({ k:'pond', x:210, w:190 });
    for (let i = 0; i < 16; i++) items.push({ k:'tree', x:R()*W, s:0.7 + R()*0.8, y:250 - R()*12 });
    items.push({ k:'bench', x:760 });
    items.sort((a,b) => (a.y || 250) - (b.y || 250));
  } else if (id === 'downtown') {
    const cols = ['#8FA3B3','#A7B4C2','#7D8FA3','#B7AFA3','#94A89A','#A99A8C'];
    for (let x = -10; x < W; ) { const w = 70 + R()*60; items.push({ k:'tower', x, w, h:80 + R()*140, c:cols[Math.floor(R()*cols.length)], lit:R(), seed:Math.floor(R()*1000), ant:R() < .3 }); x += w + 4; }
  } else {
    for (let i = 0; i < 4; i++) items.push({ k:'palm', x:60 + i*260 + R()*60, s:0.9 + R()*0.3 });
  }
  const far = [];
  for (let x = -20; x < W; ) { const w = 30 + R()*60; far.push({ x, w, h:20 + R()*60 }); x += w; }
  items.far = far;
  return scenery[id] = items;
}

// ---------- ambient life ----------
const amb = {
  cars: Array.from({length:4}, (_,i) => ({ x:i*270, dir:i % 2 ? 1 : -1, c:['#E8574A','#4C7FD1','#F0C23E','#2BA3A3'][i], v:70 + Math.random()*50 })),
  ducks: [0, 2.1, 3.9].map(a => ({ a })),
  boat: { x:140 },
  gulls: Array.from({length:3}, () => ({ x:Math.random()*W, y:50 + Math.random()*70, v:18 + Math.random()*16, ph:Math.random()*6 })),
  leaves: Array.from({length:26}, () => ({ x:Math.random()*W, y:Math.random()*H, r:Math.random()*6, v:0.8 + Math.random() })),
  fx: [],
};

function drawSky(t){
  const wt = curWeather(), wm = warmth() * (isWet() ? 0.3 : 0.65);
  const [a, b] = SKIES[wt];
  const g = ctx.createLinearGradient(0, 0, 0, 260);
  g.addColorStop(0, mix(a, '#E9885E', wm*0.55)); g.addColorStop(1, mix(b, '#FFD48A', wm));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 300);
  if (wt === 'hot' || wt === 'sunny' || wt === 'cloudy') {
    const p = dayP(), sx = 80 + p*800, sy = 125 - Math.sin(p*Math.PI)*85;
    const sc = mix('#FFE680', '#FF9B45', warmth());
    const glow = ctx.createRadialGradient(sx, sy, 8, sx, sy, 110);
    glow.addColorStop(0, wt === 'cloudy' ? 'rgba(255,240,200,.35)' : 'rgba(255,236,150,.6)'); glow.addColorStop(1, 'rgba(255,236,150,0)');
    ctx.fillStyle = glow; ctx.fillRect(sx-110, sy-110, 220, 220);
    circ(sx, sy, 28, wt === 'cloudy' ? mix(sc, '#DDE5EA', .5) : sc);
  }
  const n = { hot:1, sunny:3, cloudy:6, rain:7, storm:8 }[wt];
  const top = wt === 'storm' ? '#66727B' : wt === 'rain' ? '#96A4AE' : mix('#FFFFFF', '#FFE2C4', warmth()*0.6);
  const under = wt === 'storm' ? '#4C565E' : wt === 'rain' ? '#7D8B95' : mix('#DCE6EE', '#E9C2A8', warmth()*0.6);
  for (let i = 0; i < n; i++) {
    const cx = ((i*197 + t*0.008*(8+i)) % (W+220)) - 110, cy = 38 + (i*37) % 95, s = 0.8 + (i % 3)*0.2;
    ctx.fillStyle = under; ctx.beginPath();
    ctx.arc(cx, cy+6, 22*s, 0, 7); ctx.arc(cx+28*s, cy-4, 28*s, 0, 7); ctx.arc(cx+58*s, cy+6, 22*s, 0, 7); ctx.fill();
    ctx.fillStyle = top; ctx.beginPath();
    ctx.arc(cx, cy+2, 20*s, 0, 7); ctx.arc(cx+28*s, cy-9, 25*s, 0, 7); ctx.arc(cx+58*s, cy+2, 19*s, 0, 7); ctx.fill();
  }
}

function drawFar(id){
  const items = getScenery(id), hz = mix(SKIES[curWeather()][1], '#FFD48A', warmth()*0.4);
  if (id === 'downtown') {
    ctx.fillStyle = mix(hz, '#6F86A0', .45);
    for (const f of items.far) ctx.fillRect(f.x, 250 - f.h - 50, f.w - 3, f.h + 50);
  } else if (id === 'beach') {
    ctx.fillStyle = mix(hz, '#5F8F76', .5);
    ctx.beginPath(); ctx.moveTo(0, 196); ctx.quadraticCurveTo(90, 150, 230, 196); ctx.fill();
  } else {
    ctx.fillStyle = mix(hz, '#7FB27A', .45);
    ctx.beginPath(); ctx.moveTo(0, 255);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 222 - Math.sin(x/130 + (id === 'park' ? 1.5 : 0))*16 - Math.sin(x/47)*4);
    ctx.lineTo(W, 255); ctx.fill();
  }
}

function drawTree(x, s, base = 258){
  shadowAt(x + 6*s, base + 1, 26*s, 5*s, .18);
  ctx.fillStyle = '#7A5230'; ctx.fillRect(x-4*s, base-34*s, 8*s, 34*s);
  ctx.fillStyle = '#5E3E22'; ctx.fillRect(x+1*s, base-34*s, 3*s, 34*s);
  circ(x+6*s, base-42*s, 22*s, '#2E7B3A');
  circ(x, base-47*s, 24*s, '#3E9A4A');
  circ(x-10*s, base-54*s, 13*s, '#58B660');
  circ(x-13*s, base-58*s, 5*s, '#7BCB7B');
}

function drawBackground(id, t, dt){
  drawSky(t);
  const items = getScenery(id), wm = warmth();
  if (id === 'beach') {
    const sg = ctx.createLinearGradient(0, 195, 0, 252); sg.addColorStop(0, mix('#2A86BD', '#C77B5A', wm*0.35)); sg.addColorStop(1, '#6CC7E8');
    ctx.fillStyle = sg; ctx.fillRect(0, 195, W, 60);
    drawFar(id);
    ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) { const wx = (i*83 + t*0.02) % (W+60) - 30; ctx.beginPath(); ctx.arc(wx, 226 + (i%3)*8, 9, Math.PI, 0); ctx.stroke(); }
    // sailboat
    amb.boat.x = (amb.boat.x + dt*9) % (W + 80);
    const bx = amb.boat.x - 40, by = 210 + Math.sin(t/600)*1.5;
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by-30); ctx.lineTo(bx+20, by); ctx.fill();
    ctx.fillStyle = '#E8574A'; ctx.beginPath(); ctx.moveTo(bx-2, by-24); ctx.lineTo(bx-2, by); ctx.lineTo(bx-14, by); ctx.fill();
    ctx.fillStyle = '#6B4A30'; ctx.beginPath(); ctx.moveTo(bx-16, by+1); ctx.lineTo(bx+22, by+1); ctx.lineTo(bx+16, by+7); ctx.lineTo(bx-12, by+7); ctx.fill();
    // gulls
    ctx.strokeStyle = '#3A4650'; ctx.lineWidth = 2;
    for (const g of amb.gulls) {
      g.x = (g.x + g.v*dt) % (W + 40); g.ph += dt*6;
      const f = Math.sin(g.ph)*4, gx = g.x - 20;
      ctx.beginPath(); ctx.moveTo(gx-8, g.y - f); ctx.quadraticCurveTo(gx-4, g.y-4, gx, g.y); ctx.quadraticCurveTo(gx+4, g.y-4, gx+8, g.y - f); ctx.stroke();
    }
    const sand = ctx.createLinearGradient(0, 250, 0, 295); sand.addColorStop(0, '#F4DDA8'); sand.addColorStop(1, '#E6C88A');
    ctx.fillStyle = sand; ctx.fillRect(0, 250, W, 45);
  } else {
    drawFar(id);
    const gg = ctx.createLinearGradient(0, 250, 0, 295);
    if (id === 'downtown') { gg.addColorStop(0, '#9AA3A9'); gg.addColorStop(1, '#858E95'); }
    else { gg.addColorStop(0, '#8FCD6D'); gg.addColorStop(1, '#6FB555'); }
    ctx.fillStyle = gg; ctx.fillRect(0, 250, W, 45);
  }

  for (const it of items) {
    if (it.k === 'house') {
      const by = 258, x = it.x, w = it.w, h = it.h;
      shadowAt(x + w/2 + 6, by + 1, w*0.58, 5, .16);
      if (it.chim) { ctx.fillStyle = '#8A5A48'; ctx.fillRect(x + w*0.7, by-h-34, 12, 26); }
      ctx.fillStyle = it.c; ctx.fillRect(x, by-h, w, h);
      ctx.fillStyle = shade(it.c, -0.13); ctx.fillRect(x + w*0.8, by-h, w*0.2, h);
      ctx.fillStyle = 'rgba(0,0,0,.05)'; for (let yy = by-h+7; yy < by; yy += 8) ctx.fillRect(x, yy, w, 1);
      ctx.fillStyle = '#A5503F'; ctx.beginPath(); ctx.moveTo(x-8, by-h); ctx.lineTo(x+w/2, by-h-38); ctx.lineTo(x+w/2, by-h); ctx.fill();
      ctx.fillStyle = '#833E30'; ctx.beginPath(); ctx.moveTo(x+w/2, by-h-38); ctx.lineTo(x+w+8, by-h); ctx.lineTo(x+w/2, by-h); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(x, by-h, w, 4);
      const lit = wm > 0.35 && it.lit < 0.7, glass = lit ? '#FFD98A' : '#BFE3F5';
      for (const wx of [x+12, x+w-36]) {
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(wx-2, by-h+12, 26, 22);
        ctx.fillStyle = glass; ctx.fillRect(wx, by-h+14, 22, 18);
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(wx+10, by-h+14, 2, 18); ctx.fillRect(wx, by-h+22, 22, 2);
      }
      ctx.fillStyle = it.door; ctx.fillRect(x+w/2-10, by-32, 20, 32);
      circ(x+w/2+5, by-16, 1.8, '#F0C23E');
      ctx.fillStyle = '#CFC6B8'; ctx.fillRect(x+w/2-14, by-3, 28, 3);
    } else if (it.k === 'tree') drawTree(it.x, it.s, it.y || 258);
    else if (it.k === 'pond') {
      ctx.fillStyle = '#4C9F4A'; ctx.beginPath(); ctx.ellipse(it.x, 273, it.w/2 + 6, 20, 0, 0, 7); ctx.fill();
      const pg = ctx.createLinearGradient(0, 255, 0, 290); pg.addColorStop(0, '#4FA6CF'); pg.addColorStop(1, '#76C4E3');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(it.x, 273, it.w/2, 16, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(it.x - 40, 268, 30, 2); ctx.fillRect(it.x + 20, 276, 22, 2);
      for (const d of amb.ducks) {
        d.a += dt*0.18;
        const dx = it.x + Math.cos(d.a)*it.w*0.32, dy = 273 + Math.sin(d.a)*6, dir = -Math.sin(d.a) >= 0 ? 1 : -1;
        circ(dx, dy, 5, '#FFFFFF'); circ(dx + dir*5, dy-5, 3.2, '#FFFFFF');
        ctx.fillStyle = '#F0A030'; ctx.fillRect(dir > 0 ? dx+7 : dx-10, dy-6, 3, 2);
      }
      ctx.strokeStyle = '#3E7F3A'; ctx.lineWidth = 2;
      for (let r = 0; r < 5; r++) { const rx = it.x - it.w/2 + 4 + r*5; ctx.beginPath(); ctx.moveTo(rx, 272); ctx.lineTo(rx - 2 + r, 254 + r*2); ctx.stroke(); }
    } else if (it.k === 'bench') {
      shadowAt(it.x, 270, 28, 3, .18);
      ctx.fillStyle = '#8A5A34'; ctx.fillRect(it.x-26, 256, 52, 5); ctx.fillRect(it.x-26, 247, 52, 4);
      ctx.fillStyle = '#4A4F55'; ctx.fillRect(it.x-22, 261, 3, 9); ctx.fillRect(it.x+19, 261, 3, 9);
    } else if (it.k === 'tower') {
      const x = it.x, w = it.w, h = it.h, g = ctx.createLinearGradient(x, 0, x+w, 0);
      g.addColorStop(0, shade(it.c, 0.1)); g.addColorStop(1, shade(it.c, -0.18));
      ctx.fillStyle = g; ctx.fillRect(x, 258-h, w, h);
      ctx.fillStyle = shade(it.c, -0.3); ctx.fillRect(x-2, 258-h-5, w+4, 6);
      if (it.ant) { ctx.fillStyle = '#5B6670'; ctx.fillRect(x + w/2 - 1, 258-h-26, 2, 22); circ(x + w/2, 258-h-27, 2.5, wm > .3 ? '#FF5A4A' : '#9AA5AE'); }
      let k = it.seed;
      for (let wy = 258-h+10; wy < 246; wy += 18) for (let wx = x+8; wx < x+w-12; wx += 16) {
        k = (k * 9301 + 49297) % 233280;
        const on = k / 233280 < it.lit*0.35 + wm*0.45;
        ctx.fillStyle = on ? '#FFE3A0' : 'rgba(35,55,75,.38)'; ctx.fillRect(wx, wy, 9, 11);
        if (!on) { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(wx, wy, 3, 11); }
      }
    } else if (it.k === 'palm') {
      const x = it.x, s = it.s, base = 262;
      shadowAt(x + 14*s, base + 1, 30*s, 5*s, .18);
      ctx.strokeStyle = '#8A6238'; ctx.lineWidth = 9*s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x+12*s, base-50*s, x+4*s, base-95*s); ctx.stroke();
      ctx.strokeStyle = 'rgba(70,45,20,.45)'; ctx.lineWidth = 2;
      for (let k = 1; k < 8; k++) { const yy = base - k*12*s, xx = x + Math.sin(k/8*Math.PI)*9*s; ctx.beginPath(); ctx.moveTo(xx-4*s, yy); ctx.lineTo(xx+4*s, yy-2); ctx.stroke(); }
      const sway = Math.sin(t/900 + x)*0.06;
      for (let k = 0; k < 6; k++) {
        const ang = -Math.PI/2 + (k-2.5)*0.62 + sway;
        ctx.fillStyle = k % 2 ? '#2E9A4E' : '#23803F';
        ctx.beginPath(); ctx.ellipse(x+4*s + Math.cos(ang)*27*s, base-95*s + Math.sin(ang)*14*s + 9*s, 31*s, 7*s, ang, 0, 7); ctx.fill();
      }
      circ(x+1*s, base-90*s, 4*s, '#6B4A2A'); circ(x+8*s, base-89*s, 4*s, '#5A3C22');
    }
  }

  if (id === 'downtown') {
    ctx.fillStyle = '#5F666C'; ctx.fillRect(0, 262, W, 30);
    ctx.fillStyle = '#E8E2C8'; for (let x = 0; x < W; x += 50) ctx.fillRect(x, 276, 26, 2);
    for (const c of amb.cars) {
      c.x += c.dir * c.v * dt; if (c.x > W + 60) c.x = -60; if (c.x < -60) c.x = W + 60;
      const cy = c.dir > 0 ? 286 : 272;
      shadowAt(c.x, cy + 1, 24, 3, .25);
      ctx.fillStyle = c.c; rr(c.x-24, cy-12, 48, 11, 4); ctx.fill(); rr(c.x-13, cy-20, 26, 10, 4); ctx.fill();
      ctx.fillStyle = '#CDE8F5'; ctx.fillRect(c.x-10, cy-18, 9, 6); ctx.fillRect(c.x+1, cy-18, 9, 6);
      circ(c.x-14, cy-1, 4, '#2A2E33'); circ(c.x+14, cy-1, 4, '#2A2E33');
      circ(c.x + c.dir*23, cy-8, 2, wm > .3 ? '#FFF1B0' : '#F7F3E0');
    }
  }

  // sidewalk / boardwalk
  if (id === 'beach') {
    const bw = ctx.createLinearGradient(0, 295, 0, H); bw.addColorStop(0, '#CFA06A'); bw.addColorStop(1, '#B98A55');
    ctx.fillStyle = bw; ctx.fillRect(0, 295, W, H-295);
    ctx.strokeStyle = 'rgba(90,55,25,.3)'; ctx.lineWidth = 2;
    for (let y = 310; y < H; y += 18) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(90,55,25,.35)';
    for (let y = 301; y < H; y += 18) for (let x = (y % 36 ? 40 : 0); x < W; x += 80) ctx.fillRect(x, y, 2, 2);
  } else {
    const sw = ctx.createLinearGradient(0, 295, 0, H); sw.addColorStop(0, '#E4DFD4'); sw.addColorStop(1, '#CBC5B8');
    ctx.fillStyle = sw; ctx.fillRect(0, 295, W, H-295);
    ctx.fillStyle = '#B7B1A3'; ctx.fillRect(0, 291, W, 6); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(0, 291, W, 1.5);
    ctx.strokeStyle = 'rgba(120,110,95,.2)'; ctx.lineWidth = 1.5;
    for (let x = 0; x < W + 40; x += 64) { ctx.beginPath(); ctx.moveTo(x, 298); ctx.lineTo(x-24, H); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, 360); ctx.lineTo(W, 360); ctx.stroke();
  }
  if (isWet()) {
    for (const [px, py, pr] of [[150, 412, 44], [700, 424, 56], [880, 356, 30], [300, 350, 24]]) {
      ctx.fillStyle = 'rgba(110,140,165,.42)'; ctx.beginPath(); ctx.ellipse(px, py, pr, pr*0.22, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(px - pr*0.3, py - 2, pr*0.35, pr*0.05, 0, 0, 7); ctx.fill();
      const rp = ((t/700 + px) % 1);
      ctx.strokeStyle = `rgba(230,240,250,${0.5*(1-rp)})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(px + pr*0.2, py, 3 + rp*12, (3 + rp*12)*0.25, 0, 0, 7); ctx.stroke();
    }
  }
}

function drawStand(t){
  const x = STAND_X, ay = 146, aw = 184, ax = x - aw/2;
  shadowAt(x + 8, 302, 124, 9, .26);
  // posts
  ctx.fillStyle = '#7A4726'; ctx.fillRect(x-82, 160, 8, 140); ctx.fillRect(x+74, 160, 8, 140);
  ctx.fillStyle = '#5E361C'; ctx.fillRect(x-77, 160, 3, 140); ctx.fillRect(x+79, 160, 3, 140);
  // seller (bobs gently)
  const bob = Math.sin(t/420) * 1.3;
  ctx.fillStyle = '#4C7FD1'; rr(x+14, 206 + bob, 28, 34, 8); ctx.fill();
  ctx.fillStyle = '#3B67AE'; ctx.fillRect(x+34, 208 + bob, 7, 30);
  circ(x+28, 196 + bob, 12, '#F1C49A');
  circ(x+24, 197 + bob, 1.6, '#2B1D14'); circ(x+32, 197 + bob, 1.6, '#2B1D14');
  ctx.strokeStyle = '#8C4A30'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x+28, 200 + bob, 4, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.fillStyle = '#FFD93B'; ctx.beginPath(); ctx.arc(x+28, 190 + bob, 12.5, Math.PI, 0); ctx.fill(); ctx.fillRect(x+12, 188 + bob, 32, 4);
  // awning shadow on back
  ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.fillRect(x-74, 176, 148, 12);
  // counter
  ctx.fillStyle = '#B5763F'; ctx.fillRect(x-88, 232, 176, 68);
  for (let px = x-88; px < x+88; px += 22) {
    ctx.strokeStyle = 'rgba(80,40,15,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, 236); ctx.lineTo(px, 300); ctx.stroke();
    ctx.strokeStyle = 'rgba(80,40,15,.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px+7, 240); ctx.quadraticCurveTo(px+11, 262, px+7, 296); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px+15, 238); ctx.quadraticCurveTo(px+12, 270, px+16, 298); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x-88, 290, 176, 10);
  ctx.fillStyle = '#7A4726'; ctx.fillRect(x-94, 226, 188, 10);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x-94, 226, 188, 2);
  // hand-lettered sign
  ctx.save(); ctx.translate(x, 265); ctx.rotate(-0.025);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; rr(-62, -17, 128, 40, 7); ctx.fill();
  ctx.fillStyle = '#FFF6C9'; rr(-64, -20, 128, 40, 7); ctx.fill();
  ctx.strokeStyle = '#C9A15A'; ctx.lineWidth = 2; rr(-64, -20, 128, 40, 7); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#E5AE00'; ctx.font = '800 21px "Baloo 2", system-ui, sans-serif'; ctx.fillText('LEMONADE', 1, -4, 112);
  ctx.fillStyle = '#5A3A08'; ctx.fillText('LEMONADE', 0, -5, 112);
  ctx.font = '800 11px Nunito, system-ui, sans-serif'; ctx.fillStyle = '#8A6A30'; ctx.fillText('INC.  EST. DAY 1', 0, 12);
  ctx.restore();
  // counter-top items
  const fill = sim && (sim.pitcher > 0 || sim.stats.sold > 0) ? clamp(sim.pitcher / yieldCups(), 0, 1) : 1;
  if (S.upg.juicer) {
    ctx.fillStyle = '#9AA5AE'; rr(x-24, 212, 18, 14, 3); ctx.fill();
    ctx.fillStyle = '#C3CCD3'; ctx.fillRect(x-20, 200, 10, 12);
    ctx.fillStyle = '#7C8790'; ctx.fillRect(x-26, 196, 22, 4);
    circ(x-15, 224, 3, '#FFE14D');
  }
  ctx.fillStyle = 'rgba(220,240,250,.75)'; rr(x-62, 188, 32, 38, 5); ctx.fill();
  const lh = Math.max(0, 34*fill - 2);
  ctx.fillStyle = '#FFE14D'; ctx.fillRect(x-59, 223 - lh, 26, lh);
  if (fill > 0.3) { circ(x-50, 223 - lh + 6, 4, '#F5C400'); circ(x-41, 223 - lh + 10, 3.5, '#F5C400'); }
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x-58, 191, 3, 30);
  ctx.strokeStyle = 'rgba(80,110,130,.6)'; ctx.lineWidth = 2; rr(x-62, 188, 32, 38, 5); ctx.stroke();
  ctx.beginPath(); ctx.arc(x-28, 206, 7, -1.2, 1.2); ctx.stroke();
  for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? '#F4F4F4' : '#FFFFFF'; ctx.beginPath(); ctx.moveTo(x-2, 226 - i*6); ctx.lineTo(x+12, 226 - i*6); ctx.lineTo(x+13, 218 - i*6); ctx.lineTo(x-3, 218 - i*6); ctx.fill(); }
  ctx.fillStyle = '#FFD93B'; ctx.fillRect(x-3, 206, 16, 3);
  if (S.upg.register) {
    ctx.fillStyle = '#5B6670'; rr(x+48, 206, 34, 20, 3); ctx.fill();
    ctx.fillStyle = '#3F4850'; ctx.fillRect(x+52, 198, 26, 9);
    ctx.fillStyle = '#9BE39A'; ctx.fillRect(x+54, 200, 22, 5);
    ctx.fillStyle = '#C9D1D6'; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ctx.fillRect(x+53 + i*9, 211 + j*6, 6, 3);
  }
  // awning
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#FFFFFF' : '#FFD93B'; ctx.fillRect(ax + i*aw/8, ay, aw/8 + 0.5, 24); }
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#FFFFFF' : '#FFD93B'; ctx.beginPath(); ctx.arc(ax + i*aw/8 + aw/16, ay+24, aw/16, 0, Math.PI); ctx.fill(); }
  const ag = ctx.createLinearGradient(0, ay, 0, ay + 36); ag.addColorStop(0, 'rgba(255,255,255,.25)'); ag.addColorStop(1, 'rgba(120,80,0,.14)');
  ctx.fillStyle = ag; ctx.fillRect(ax, ay, aw, 36);
  ctx.fillStyle = '#E5AE00'; ctx.fillRect(ax-4, ay-8, aw+8, 10);
  ctx.fillStyle = '#C99600'; ctx.fillRect(ax-4, ay, aw+8, 2);
  // cooler (in front, right)
  if (S.upg.cooler) {
    const cx = x + 112;
    shadowAt(cx + 4, 302, 28, 4, .22);
    ctx.fillStyle = '#2F7FC4'; rr(cx-22, 272, 44, 30, 4); ctx.fill();
    ctx.fillStyle = '#26689F'; ctx.fillRect(cx+12, 274, 9, 27);
    ctx.fillStyle = '#F4F7FA'; rr(cx-24, 266, 48, 9, 3); ctx.fill();
    ctx.fillStyle = '#D5DEE5'; ctx.fillRect(cx-8, 262, 16, 4);
  }
  // parasol
  if (S.upg.parasol) {
    const px = x + 162;
    shadowAt(px, 302, 40, 5, .15);
    ctx.fillStyle = '#7A4726'; ctx.fillRect(px - 2, 150, 5, 150);
    ctx.fillStyle = '#E8574A'; ctx.beginPath(); ctx.moveTo(px-52, 172); ctx.quadraticCurveTo(px, 116, px+52, 172); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.moveTo(px-18, 168); ctx.quadraticCurveTo(px, 118, px+18, 168); ctx.fill();
    for (let i = -2; i <= 2; i++) circ(px + i*21, 172, 4, i % 2 ? '#FFFFFF' : '#E8574A');
  }
  // price board
  const bx = x - 150, big = !!S.upg.sign;
  shadowAt(bx, 302, 30, 4, .2);
  ctx.fillStyle = '#7A4726'; ctx.fillRect(bx-24, 250, 5, 52); ctx.fillRect(bx+19, 250, 5, 52);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; rr(bx-28, (big ? 196 : 214) + 3, 60, big ? 62 : 44, 6); ctx.fill();
  ctx.fillStyle = big ? '#E8574A' : '#2C3B33'; rr(bx-30, big ? 196 : 214, 60, big ? 62 : 44, 6); ctx.fill();
  ctx.strokeStyle = big ? '#FFD93B' : '#8A6238'; ctx.lineWidth = 3; rr(bx-30, big ? 196 : 214, 60, big ? 62 : 44, 6); ctx.stroke();
  ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (big) { ctx.font = '800 11px Nunito, system-ui, sans-serif'; ctx.fillText('ICE COLD', bx, 210); }
  ctx.font = `800 ${big ? 22 : 18}px "Baloo 2", system-ui, sans-serif`;
  ctx.fillText(money(S.recipe.price), bx, big ? 234 : 236);
}

const BODY = ['#E8574A','#4C7FD1','#2F8A3E','#8E5CC4','#F09A3E','#2BA3A3','#D65A9A','#5B6B73','#E0C341'];
const PANTS = ['#2F3E5A','#4A4F55','#6B5A45','#2D5C73','#3B3B3B','#8A7F6A'];
const SKIN = ['#F6D3B3','#E9B98F','#C98E63','#9C6644','#6E4A32'];
const HAIR = ['#2B1D14','#5A3A22','#C9A15A','#1E1E1E','#8C3B22','#B8B8B8'];
const ACC = ['none','none','none','hat','cap','bag','glasses'];
const UMB = ['#E8574A','#4C7FD1','#F0C23E','#2BA3A3','#8E5CC4'];

function drawWalker(w, t){
  const s = w.h, bw = w.bw, moving = w.state !== 'queue' || !w.arrived;
  let x = w.x, y = w.y;
  if (w.hop > 0) y -= Math.abs(Math.sin(w.hop * 11)) * 9;
  if (w.shiver > 0) x += Math.sin(t / 22) * 1.6;
  shadowAt(x, w.y + 1, 12*s*bw, 3.5, .22);
  const sw = moving ? Math.sin(w.phase) * 6 * s : 0;
  ctx.strokeStyle = w.pants; ctx.lineWidth = 5*s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x-2*s, y-18*s); ctx.lineTo(x-2*s + sw, y-1); ctx.moveTo(x+2*s, y-18*s); ctx.lineTo(x+2*s - sw, y-1); ctx.stroke();
  ctx.fillStyle = '#2D3A44'; ctx.fillRect(x-4*s + sw - 1, y-3, 6*s, 3); ctx.fillRect(x - sw - 1, y-3, 6*s, 3);
  const bx = x - 10*s*bw, bwid = 20*s*bw;
  ctx.fillStyle = w.body; rr(bx, y-45*s, bwid, 29*s, 7*s); ctx.fill();
  ctx.fillStyle = shade(w.body, -0.18); ctx.fillRect(bx + bwid*0.68, y-43*s, bwid*0.25, 26*s);
  ctx.strokeStyle = w.skin; ctx.lineWidth = 4*s;
  const arm = moving ? -Math.sin(w.phase) * 5 * s : 0;
  ctx.beginPath(); ctx.moveTo(x + w.dir*8*s*bw, y-40*s); ctx.lineTo(x + w.dir*(10*s*bw) + (w.cup ? w.dir*2 : arm), y-(w.cup ? 32 : 24)*s); ctx.stroke();
  if (w.acc === 'bag') { ctx.fillStyle = '#7A4A32'; rr(x - w.dir*14*s*bw, y-30*s, 9*s, 11*s, 2); ctx.fill(); ctx.strokeStyle = '#5A3622'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - w.dir*10*s, y-44*s); ctx.lineTo(x - w.dir*10*s*bw, y-30*s); ctx.stroke(); }
  const hy = y - 54*s;
  circ(x, hy, 9*s, w.skin);
  ctx.fillStyle = '#2B1D14'; ctx.fillRect(x + w.dir*3*s - 1, hy-1, 2, 2);
  if (w.acc === 'glasses') { ctx.strokeStyle = '#1E1E1E'; ctx.lineWidth = 1.5; ctx.strokeRect(x + w.dir*1*s - 2, hy-2.5, 6, 4); }
  if (w.acc === 'hat') {
    ctx.fillStyle = w.hatC; ctx.fillRect(x - 13*s, hy - 7*s, 26*s, 3*s); rr(x - 7*s, hy - 15*s, 14*s, 9*s, 3); ctx.fill();
  } else if (w.acc === 'cap') {
    ctx.fillStyle = w.hatC; ctx.beginPath(); ctx.arc(x, hy - 3*s, 9.5*s, Math.PI, 0); ctx.fill(); ctx.fillRect(x + (w.dir > 0 ? 0 : -14*s), hy - 5*s, 14*s, 3*s);
  } else {
    ctx.fillStyle = w.hair; ctx.beginPath(); ctx.arc(x, hy - 2*s, 9.5*s, Math.PI*1.02, Math.PI*1.98); ctx.fill();
    if (w.long) ctx.fillRect(w.dir > 0 ? x - 9.5*s : x + 5.5*s, hy - 3*s, 4*s, 13*s);
  }
  if (w.cup) {
    const cx = x + w.dir*(12*s*bw);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(cx - 4, y-38*s, 8, 11); ctx.fillStyle = '#FFE14D'; ctx.fillRect(cx - 4, y-38*s, 8, 4);
    ctx.strokeStyle = '#E8574A'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx+1, y-38*s); ctx.lineTo(cx+3, y-44*s); ctx.stroke();
  }
  if (w.umb && isWet()) {
    ctx.strokeStyle = '#3A3A3A'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + w.dir*6*s, y-36*s); ctx.lineTo(x + w.dir*6*s, y-80*s); ctx.stroke();
    ctx.fillStyle = w.umbC; ctx.beginPath(); ctx.moveTo(x + w.dir*6*s - 24*s, y-72*s); ctx.quadraticCurveTo(x + w.dir*6*s, y-100*s, x + w.dir*6*s + 24*s, y-72*s); ctx.fill();
    ctx.fillStyle = shade(w.umbC, -0.2); ctx.beginPath(); ctx.moveTo(x + w.dir*6*s, y-86*s); ctx.quadraticCurveTo(x + w.dir*6*s + 8*s, y-80*s, x + w.dir*6*s + 24*s, y-72*s); ctx.lineTo(x + w.dir*6*s, y-74*s); ctx.fill();
  }
  if (w.bubble) {
    ctx.font = '700 15px Nunito, system-ui, sans-serif';
    const tw = ctx.measureText(w.bubble).width + 18, bxx = clamp(x - tw/2, 4, W - tw - 4), by = y - (w.umb && isWet() ? 128 : 96)*s;
    ctx.globalAlpha = clamp(w.bt, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,.15)'; rr(bxx + 2, by + 3, tw, 26, 12); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; rr(bxx, by, tw, 26, 12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x-5, by+25); ctx.lineTo(x, by+33); ctx.lineTo(x+5, by+25); ctx.fill();
    ctx.fillStyle = '#1F2D35'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(w.bubble, bxx + 9, by + 13.5);
    ctx.globalAlpha = 1;
  }
}

function saleFx(price){
  amb.fx.push({ k:'txt', x:STAND_X + 44, y:190, vy:-38, life:1.3, txt:'+' + money(price) });
  for (let i = 0; i < 6; i++) amb.fx.push({ k:'sp', x:STAND_X + 28 + (Math.random()-0.5)*30, y:205, vx:(Math.random()-0.5)*80, vy:-40 - Math.random()*60, life:0.7 + Math.random()*0.4 });
}
function drawFx(dt){
  const sp = sim ? Math.max(1, sim.speed*0.7) : 1;
  for (const f of amb.fx) {
    f.life -= dt * sp; f.x += (f.vx || 0) * dt * sp; f.y += f.vy * dt * sp; if (f.k === 'sp') f.vy += 120 * dt * sp;
    ctx.globalAlpha = clamp(f.life, 0, 1);
    if (f.k === 'txt') {
      ctx.font = '800 18px "Baloo 2", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeText(f.txt, f.x, f.y);
      ctx.fillStyle = '#2F8A3E'; ctx.fillText(f.txt, f.x, f.y);
    } else {
      ctx.fillStyle = '#FFD93B'; ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.life * 6);
      ctx.fillRect(-3, -1, 6, 2); ctx.fillRect(-1, -3, 2, 6); ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  amb.fx = amb.fx.filter(f => f.life > 0);
}

const drops = Array.from({length:130}, () => ({ x:Math.random()*W, y:Math.random()*H, v:0.6 + Math.random()*0.6 }));
let flash = 0;
function drawWeatherFx(t, dt){
  const wt = curWeather();
  if (wt === 'hot') {
    ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const baseY = 290 - ((t/40 + i*40) % 120);
      ctx.beginPath();
      for (let x = 0; x <= W; x += 24) { const yy = baseY + Math.sin(x/40 + t/300 + i)*3; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
      ctx.stroke();
    }
  }
  if (wt === 'rain' || wt === 'storm') {
    ctx.strokeStyle = 'rgba(210,230,245,.55)'; ctx.lineWidth = 1.5; ctx.beginPath();
    const n = wt === 'storm' ? 130 : 75, slant = wt === 'storm' ? 6 : 3;
    for (let i = 0; i < n; i++) { const d = drops[i]; d.y += d.v*dt*620; d.x -= dt*(wt === 'storm' ? 160 : 80); if (d.y > H) { d.y = -10; d.x = Math.random()*(W+120); } if (d.x < -10) d.x += W + 20; ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - slant, d.y + 13); }
    ctx.stroke();
  }
  if (wt === 'storm') {
    for (const l of amb.leaves) {
      l.x -= l.v * dt * 230; l.y += Math.sin(t/300 + l.r) * dt * 40; l.r += dt * 4;
      if (l.x < -10) { l.x = W + 10; l.y = 100 + Math.random()*300; }
      ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.r); ctx.fillStyle = l.v > 1.3 ? '#B98A3E' : '#6FA84A';
      ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.5, 0, 0, 7); ctx.fill(); ctx.restore();
    }
    if (Math.random() < dt*0.25) flash = 0.5;
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, W, H); flash -= dt*2; }
  }
  const wm = warmth();
  if (wm > 0) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(255,150,70,${wm*0.16})`); g.addColorStop(1, `rgba(120,60,90,${wm*0.12})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const v = ctx.createRadialGradient(W/2, H/2, H*0.45, W/2, H/2, W*0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.16)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

function draw(t, dt){
  ctx.clearRect(0, 0, W, H);
  drawBackground(S.loc, t, dt);
  const ws = sim ? sim.walkers : [];
  for (const w of ws) if (w.y < 300) drawWalker(w, t);
  drawStand(t);
  const front = ws.filter(w => w.y >= 300).sort((a,b) => a.y - b.y);
  for (const w of front) drawWalker(w, t);
  drawFx(dt);
  drawWeatherFx(t, dt);
}
