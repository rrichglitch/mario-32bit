/* =========================================================
   SUPER MARIO 32-BIT
   Smooth-vector, 32-bit aesthetic side-scroller.
   No pixel art, no assets — everything drawn at runtime
   with gradients, rounded shapes, soft shadows.
   ========================================================= */

(() => {
'use strict';

// ---------- canvas / scaling ----------
const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
ctx.imageSmoothingEnabled = true;

// logical ground level (top of grass)
const GROUND_Y = H - 80;
const GRAVITY  = 2000;        // px / s^2
const MAX_FALL = 700;

// ---------- input ----------
const keys = Object.create(null);
let pressed = Object.create(null);
const keyMap = {
  ArrowLeft: 'left',  ArrowRight: 'right',
  ArrowUp:   'jump',  ArrowDown:  'down',
  Space:     'jump',  KeyZ: 'run',  KeyX: 'run',  ShiftLeft: 'run', ShiftRight: 'run',
  Enter:     'start', KeyR: 'reset',
};
window.addEventListener('keydown', e => {
  const k = keyMap[e.code] || e.key.toLowerCase();
  if (!keys[k]) pressed[k] = true;
  keys[k] = true;
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => {
  const k = keyMap[e.code] || e.key.toLowerCase();
  keys[k] = false;
});
canvas.addEventListener('click', () => canvas.focus());

// touch buttons
const touchState = new Set();
document.querySelectorAll('.ctrl').forEach(b => {
  const k = b.dataset.key;
  const m = keyMap[k] || k.toLowerCase();
  const press = e => {
    e.preventDefault();
    if (touchState.has(m)) return;
    touchState.add(m);
    keys[m] = true; pressed[m] = true;
  };
  const rel = e => {
    e.preventDefault();
    touchState.delete(m);
    keys[m] = false;
  };
  b.addEventListener('touchstart', press, {passive:false});
  b.addEventListener('touchend',   rel,   {passive:false});
  b.addEventListener('touchcancel',rel,   {passive:false});
  b.addEventListener('mousedown',  press);
  b.addEventListener('mouseup',    rel);
  b.addEventListener('mouseleave', rel);
});
// Safety: if a touch is cancelled at the window level, clear all touch-held keys
window.addEventListener('touchcancel', () => {
  touchState.forEach(m => { keys[m] = false; });
  touchState.clear();
});
// Prevent default browser gestures on the canvas
canvas.addEventListener('touchstart', e => e.preventDefault(), {passive:false});
canvas.addEventListener('touchmove',  e => e.preventDefault(), {passive:false});

// ---------- helpers ----------
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const lerp  = (a,b,t) => a + (b-a)*t;
const sign  = v => v < 0 ? -1 : v > 0 ? 1 : 0;
const aabb  = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;

function roundRect(x,y,w,h,r) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function softShadow(x,y,w,h,r=8) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.filter = 'blur(4px)';
  roundRect(x+2, y+4, w, h, r);
  ctx.fill();
  ctx.restore();
}

// ---------- level (procedural classic 1-1) ----------
// tile types: '.' empty, 'G' ground, 'B' brick, '?' question, '|' pipe-top, '=' pipe-body, 'X' hard block
// height rows: row 0 is top of world, row 7 is ground row
const ROWS = 8;
const COLS = 220;
const TILE = 40;

function buildLevel() {
  const grid = [];
  for (let r=0; r<ROWS; r++) grid.push(new Array(COLS).fill('.'));

  // ground (rows 6-7) with gaps.
  // The staircase climbs up; under it the ground should be cleared so the player
  // doesn't get stuck on row 6 mid-jump.
  const gaps = new Set([
    18,19, 48,49,50,51, 78,79,80, 109,110, 130,131, 152,153, 175,176, 177,
    // descending staircase into pit 1
    134,135,136,137,138, 141,142,143,144,145,
    // ascending staircase to flag
    195,196,197,198,199,200,201,202, 203,204,205,206,207,208,209,210,
    211,212,213,214, 215,216, 217, 218, 219,
  ]);
  for (let c=0; c<COLS; c++) {
    if (gaps.has(c)) continue;
    grid[ROWS-1][c] = 'G';
    grid[ROWS-2][c] = 'G';
  }

  // pipe segments
  const placePipe = (c, h) => {
    for (let r=ROWS-2; r>ROWS-2-h; r--) grid[r][c] = '=';
    grid[ROWS-2-h][c] = '|';
  };
  placePipe(28, 2);
  placePipe(38, 3);
  placePipe(46, 4);
  placePipe(57, 4);
  placePipe(70, 2);
  placePipe(85, 2);

  // floating bricks / ? blocks
  const stripe = (c, r, ch) => { grid[r][c] = ch; };
  // classic first ? block row at y=4
  for (let i=0;i<6;i++) stripe(15+i, 4, i===2?'?':i===4?'?':'B');
  stripe(22, 4, '?'); stripe(23, 4, 'B'); stripe(24, 4, '?');
  // a second tier
  stripe(20, 3, 'B');
  stripe(22, 2, '?'); stripe(23, 2, 'B'); stripe(24, 2, '?');
  // mid-level structures
  for (let i=0;i<3;i++) stripe(62+i, 4, 'B');
  stripe(64, 3, '?');
  for (let i=0;i<4;i++) stripe(77+i, 5, i===1?'?':'B');
  for (let i=0;i<2;i++) stripe(91+i, 4, 'B');
  // sky bricks
  for (let i=0;i<3;i++) stripe(100+i, 3, 'B');
  for (let i=0;i<2;i++) stripe(101+i, 2, 'B');
  stripe(101, 1, '?');
  // staircase down (after a gap) — descending step pyramid into a pit
  for (let i=0; i<5; i++) for (let j=0; j<=i && j<ROWS-1; j++) grid[ROWS-1-j][134+i] = 'X';
  for (let i=0; i<5; i++) for (let j=0; j<=i && j<ROWS-1; j++) grid[ROWS-1-j][141+i] = 'X';
  // bricks
  for (let i=0;i<5;i++) stripe(158+i, 4, 'B');
  stripe(160, 3, '?'); stripe(161, 3, 'B'); stripe(162, 3, '?');
  // final staircase (the famous one) — ascending up to the flag
  for (let i=0; i<8; i++) for (let j=0; j<=i && j<ROWS-1; j++) grid[ROWS-1-j][195+i] = 'X';
  for (let i=0; i<8; i++) for (let j=0; j<=i && j<ROWS-1; j++) grid[ROWS-1-j][203+i] = 'X';
  for (let i=0; i<4; i++) for (let j=0; j<=i && j<ROWS-1; j++) grid[ROWS-1-j][211+i] = 'X';
  for (let i=0; i<2; i++) for (let j=0; j<=i && j<ROWS-1; j++) grid[ROWS-1-j][215+i] = 'X';
  // the flag pole at the end
  grid[ROWS-2][218] = 'F';
  grid[ROWS-3][218] = 'F';
  grid[ROWS-4][218] = 'F';
  grid[ROWS-5][218] = 'F';
  grid[ROWS-6][218] = 'F';

  return grid;
}

let level = buildLevel();
function tileAt(c, r) {
  if (c<0||c>=COLS||r<0||r>=ROWS) return null;
  return level[r][c];
}

// ---------- entities ----------
const player = {
  x: 80, y: 200, w: 28, h: 44,
  vx: 0, vy: 0,
  facing: 1,
  onGround: false,
  big: false,
  crouching: false,
  invuln: 0,
  dead: false,
  deadTimer: 0,
  win: false,
  walkAnim: 0,
};

const camera = { x: 0, y: 0 };

const coins      = [];   // {x,y,w,h,collected,floating?,vy}
const enemies    = [];   // {x,y,w,h,vx,type:'goomba',dead,deadTimer,stomped}
const particles  = [];   // visual fx
const bumpTiles  = [];   // {x,y,t,vy} for brick debris

function spawnCoinFromQuestion(tx, ty) {
  // animated coin floating up out of the block
  const wx = tx*TILE, wy = ty*TILE;
  coins.push({ x: wx+10, y: wy-10, w: 18, h: 18, collected:false, floating:true, vy:-200, life:0.6 });
}

function spawnEnemyAt(cx, cy, type='goomba') {
  enemies.push({ x: cx, y: cy, w: 32, h: 32, vx:-60, vy: 0, type, dead:false, deadTimer:0, stomped:false, walkAnim:0 });
}

// initial coins + goombas
function seedEntities() {
  coins.length = 0; enemies.length = 0; particles.length = 0; bumpTiles.length = 0;
  // place goombas near gaps and around mid-level
  const spots = [20, 32, 42, 55, 68, 82, 95, 115, 135, 160, 180, 200];
  for (const c of spots) {
    // find ground row
    let y = GROUND_Y - 32;
    spawnEnemyAt(c*TILE + 4, y, 'goomba');
  }
}
seedEntities();

// ---------- state ----------
let state = 'menu'; // menu | playing | dead | win
let score = 0, coinCount = 0, lives = 3;
let timeLeft = 400, timeAcc = 0;
let world = '1-1';
const overlay = document.getElementById('overlay');
const ovTitle = document.getElementById('ovTitle');
const ovSub   = document.getElementById('ovSub');
const ovHint  = document.getElementById('ovHint');
document.getElementById('startBtn').addEventListener('click', startGame);
// tap-to-dismiss the rotation hint
const rh = document.getElementById('rotate-hint');
if (rh) {
  const dismiss = e => { e.preventDefault(); rh.classList.add('fade'); };
  rh.addEventListener('click', dismiss);
  rh.addEventListener('touchstart', dismiss, {passive:false});
}

function startGame() {
  // reset everything
  player.x = 80; player.y = 200; player.vx = 0; player.vy = 0;
  player.facing = 1; player.onGround = false; player.big = false;
  player.dead = false; player.deadTimer = 0; player.invuln = 0; player.win = false;
  level = buildLevel();
  seedEntities();
  score = 0; coinCount = 0; timeLeft = 400; timeAcc = 0;
  camera.x = 0;
  state = 'playing';
  overlay.classList.remove('show');
  // dismiss the rotation hint if it's still up
  const rh = document.getElementById('rotate-hint');
  if (rh) rh.classList.add('fade');
  canvas.focus();
}

function gameOver(win) {
  state = win ? 'win' : 'dead';
  if (win) {
    score += timeLeft * 10;
    timeLeft = 0;
  }
  setTimeout(() => {
    ovTitle.textContent = win ? 'COURSE CLEAR!' : 'GAME OVER';
    ovSub.innerHTML = win
      ? `Final score: <b>${score}</b><br/>Coins: ${coinCount} · Time bonus: ${timeLeft*10}`
      : `Score: ${score} · Coins: ${coinCount}`;
    ovHint.textContent = 'Press START or hit R to play again';
    overlay.classList.add('show');
  }, win ? 1500 : 1200);
}

// ---------- physics & collision ----------
function tilePxRect(c, r) {
  return { x: c*TILE, y: r*TILE, w: TILE, h: TILE };
}

function solidAt(c, r) {
  const t = tileAt(c, r);
  if (!t) return false;
  return t === 'G' || t === 'B' || t === '?' || t === 'X' || t === '|' || t === '=' || t === 'F';
}

function stepAxis(e, dx, dy) {
  e.x += dx; e.y += dy;
  // collide with solid tiles (only axis that moved matters; full sweep via x/y separately)
}

function collideEntityWithWorld(e) {
  // only check tiles overlapping entity bounds
  const c0 = Math.floor(e.x / TILE);
  const c1 = Math.floor((e.x + e.w - 1) / TILE);
  const r0 = Math.floor(e.y / TILE);
  const r1 = Math.floor((e.y + e.h - 1) / TILE);
  for (let r=r0; r<=r1; r++) {
    for (let c=c0; c<=c1; c++) {
      if (!solidAt(c, r)) continue;
      const tr = tilePxRect(c, r);
      if (aabb(e, tr)) {
        // resolve: push out along smallest axis
        const ox = (e.x + e.w) - tr.x;             // overlap from left
        const ox2 = (tr.x + tr.w) - e.x;            // overlap from right
        const oy = (e.y + e.h) - tr.y;             // overlap from top
        const oy2 = (tr.y + tr.h) - e.y;           // overlap from bottom
        const m = Math.min(ox, ox2, oy, oy2);
        if (m === oy)  { e.y = tr.y - e.h; e.vy = 0; e._landed = true; }
        else if (m === oy2) { e.y = tr.y + tr.h; e.vy = 0; e._hitHead = true; e._hitTile = {c,r}; }
        else if (m === ox)  { e.x = tr.x - e.w; e._hitWall = -1; }
        else                { e.x = tr.x + tr.w; e._hitWall = +1; }
      }
    }
  }
}

function bumpQuestion(c, r, fromBelow=true) {
  const t = tileAt(c, r);
  if (!t) return;
  if (t === '?') {
    level[r][c] = 'B'; // spent
    spawnCoinFromQuestion(c, r);
    score += 200;
    if (fromBelow) bumpTiles.push({c,r,vy:-200});
    spawnSparkle(c*TILE + TILE/2, r*TILE, 6);
  } else if (t === 'B' && fromBelow) {
    bumpTiles.push({c,r,vy:-260});
    if (player.big) {
      level[r][c] = '.';
      spawnBrickShards(c, r);
      score += 50;
    } else {
      score += 50;
    }
  }
}

function spawnBrickShards(c, r) {
  const wx = c*TILE, wy = r*TILE;
  for (let i=0;i<4;i++) {
    particles.push({
      x: wx + 8 + (i%2)*16, y: wy + 8 + Math.floor(i/2)*16,
      vx: (i%2===0?-1:1) * (120 + Math.random()*60),
      vy: -260 - Math.random()*80,
      w: 12, h: 12, kind: 'brick', life: 0.9
    });
  }
}

function spawnSparkle(x, y, n=4) {
  for (let i=0;i<n;i++) {
    particles.push({
      x, y, vx: (Math.random()-0.5)*220, vy: -80 - Math.random()*120,
      w: 4, h: 4, kind: 'spark', life: 0.45
    });
  }
}

// ---------- update ----------
let last = performance.now();
function loop(now) {
  const dt = Math.max(0, Math.min(0.033, (now - last) / 1000));
  last = now;
  if (state === 'playing') update(dt);
  try { render(dt); }
  catch (e) { console.error('Render error:', e.message); }
  pressed = Object.create(null);
  requestAnimationFrame(loop);
}

function update(dt) {
  // ---- player input ----
  const accel = keys.run ? 1400 : 800;
  const maxSpd = keys.run ? 280 : 180;
  if (!player.dead && !player.win) {
    if (keys.left)  { player.vx -= accel * dt; player.facing = -1; }
    if (keys.right) { player.vx += accel * dt; player.facing = +1; }
    if (!keys.left && !keys.right) {
      // friction
      player.vx -= clamp(player.vx, -600, 600) * 8 * dt;
    }
    player.vx = clamp(player.vx, -maxSpd, maxSpd);
    player.crouching = keys.down;

    // jump
    if (pressed.jump && player.onGround) {
      player.vy = keys.run ? -720 : -620;
      player.onGround = false;
    }
    // variable jump height
    if (!keys.jump && player.vy < -200) player.vy = -200;
  }

  // gravity
  player.vy += GRAVITY * dt;
  if (player.vy > MAX_FALL) player.vy = MAX_FALL;

  // ---- sweep X then Y ----
  // X
  player._landed = false; player._hitHead = false; player._hitWall = 0; player._hitTile = null;
  player.x += player.vx * dt;
  collideEntityWithWorld(player);
  if (player._hitWall) { player.vx = 0; }
  // Y
  player.y += player.vy * dt;
  collideEntityWithWorld(player);
  if (player._landed) { player.vy = 0; player.onGround = true; }
  else player.onGround = false;
  if (player._hitHead) {
    const {c, r} = player._hitTile;
    if (player.vy < 0) bumpQuestion(c, r, true);
    player.vy = 60;
  }

  // walk anim
  if (Math.abs(player.vx) > 5 && player.onGround) player.walkAnim += Math.abs(player.vx) * dt * 0.05;

  // fall out of world
  if (player.y > H + 200) killPlayer('pit');

  // invuln tick
  if (player.invuln > 0) player.invuln -= dt;

  // ---- enemies ----
  for (const en of enemies) {
    if (en.dead) { en.deadTimer += dt; continue; }
    en.walkAnim += dt;
    // simple AI: walk, reverse on wall
    en.vy += GRAVITY * dt;
    if (en.vy > MAX_FALL) en.vy = MAX_FALL;
    en.x += en.vx * dt;
    en._landed=false; en._hitHead=false; en._hitWall=0;
    collideEntityWithWorld(en);
    if (en._hitWall) { en.vx = -en.vx; en.x += en._hitWall*2; }
    en.y += en.vy * dt;
    collideEntityWithWorld(en);
    if (en._landed) en.vy = 0;
    // safety: if the entity ended up with non-finite coords, kill it
    if (!Number.isFinite(en.x) || !Number.isFinite(en.y) || !Number.isFinite(en.vx) || !Number.isFinite(en.vy)) {
      en.dead = true; en.deadTimer = 99;
    }

    // interaction with player
    if (!player.dead && !en.dead && aabb(player, en)) {
      if (player.vy > 50 && (player.y + player.h - en.y) < 18) {
        // stomp
        en.dead = true; en.deadTimer = 0; en.vx = 0;
        player.vy = -380;
        score += 100;
        spawnSparkle(en.x + en.w/2, en.y + en.h/2, 6);
      } else if (player.invuln <= 0) {
        hurtPlayer();
      }
    }
  }
  enemies.splice(0, enemies.length, ...enemies.filter(e => !(e.dead && e.deadTimer > 1.2) && e.x > camera.x - 200 && e.x < camera.x + W + 400));

  // ---- coins ----
  for (const co of coins) {
    if (co.collected) continue;
    if (co.floating) { co.vy += GRAVITY * 0.5 * dt; co.y += co.vy * dt; co.life -= dt; if (co.life <= 0) co.collected = true; }
    if (!player.dead && aabb(player, co)) {
      co.collected = true;
      coinCount++;
      score += 100;
      if (coinCount % 20 === 0) { lives++; }
      spawnSparkle(co.x + co.w/2, co.y + co.h/2, 5);
    }
  }
  coins.splice(0, coins.length, ...coins.filter(c => !c.collected));

  // ---- bumpTiles (bouncing bricks) ----
  for (const b of bumpTiles) {
    b.vy += GRAVITY * dt;
    const r = b.r, c = b.c;
    const wy = r*TILE + b.vy * dt;
    // simple bounce: just animate within a small range by clamping y
    b.offset = (b.offset || 0) + b.vy * dt;
    if (b.offset < -8) b.vy = 80;
    if (b.offset > 0)  { b.offset = 0; b.vy = 0; }
  }

  // ---- particles ----
  for (const p of particles) {
    p.vy += GRAVITY * 0.6 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  particles.splice(0, particles.length, ...particles.filter(p => p.life > 0));

  // ---- camera ----
  const targetX = player.x - W*0.35;
  camera.x += (targetX - camera.x) * 0.12;
  camera.x = clamp(camera.x, 0, COLS*TILE - W);
  camera.y = 0;

  // ---- timer ----
  timeAcc += dt;
  if (timeAcc >= 0.4) { timeAcc = 0; if (timeLeft > 0) timeLeft--; if (timeLeft === 0) killPlayer('time'); }

  // ---- flag detection ----
  const fcol = 218;
  if (aabb(player, {x: fcol*TILE, y: 0, w: TILE, h: H})) {
    if (!player.win) { player.win = true; gameOver(true); }
  }

  // ---- update HUD ----
  document.getElementById('score').textContent = String(score).padStart(6,'0');
  document.getElementById('coins').textContent = String(coinCount).padStart(2,'0');
  document.getElementById('world').textContent = world;
  document.getElementById('time').textContent  = String(timeLeft).padStart(3,'0');
  document.getElementById('lives').textContent = lives;
}

function hurtPlayer() {
  if (player.big) {
    player.big = false;
    player.h = 44;
    player.invuln = 2.0;
    spawnSparkle(player.x + player.w/2, player.y + player.h/2, 8);
  } else {
    killPlayer('hit');
  }
}
function killPlayer(cause) {
  if (player.dead) return;
  player.dead = true;
  player.deadTimer = 0;
  player.vx = cause === 'pit' ? 0 : -80;
  player.vy = -460;
  lives--;
  setTimeout(() => {
    if (lives <= 0) gameOver(false);
    else {
      player.x = 80; player.y = 200; player.vx = 0; player.vy = 0;
      player.dead = false; player.invuln = 1.5;
    }
  }, 1800);
}

// ---------- rendering ----------
function drawSky() {
  const g = ctx.createLinearGradient(0,0,0,GROUND_Y);
  g.addColorStop(0, '#6ec6ff');
  g.addColorStop(1, '#cdebff');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,GROUND_Y);

  // parallax clouds
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (const c of clouds) {
    const cx = c.x - camera.x*0.4;
    if (cx < -200 || cx > W+200) continue;
    drawCloud(cx, c.y, c.s);
  }
  ctx.restore();

  // parallax hills
  for (const h of hills) {
    const hx = h.x - camera.x*0.6;
    if (hx < -400 || hx > W+400) continue;
    drawHill(hx, h.y, h.w, h.h, h.color);
  }
}
const clouds = [
  {x:120,  y:80,  s:1.1}, {x:420, y:120, s:0.9}, {x:760, y:60, s:1.3},
  {x:1100, y:140, s:1.0}, {x:1500, y:70, s:0.8}, {x:1900, y:130, s:1.1},
  {x:2300, y:90, s:1.2}, {x:2700, y:120, s:0.9},
];
const hills = [
  {x:0,    y:GROUND_Y-80, w:520, h:120, color:'#3aa055'},
  {x:600,  y:GROUND_Y-110, w:640, h:160, color:'#2f8c45'},
  {x:1300, y:GROUND_Y-90, w:560, h:140, color:'#3aa055'},
  {x:2000, y:GROUND_Y-120, w:700, h:180, color:'#2f8c45'},
  {x:2800, y:GROUND_Y-80, w:600, h:120, color:'#3aa055'},
  {x:3500, y:GROUND_Y-100, w:700, h:160, color:'#2f8c45'},
  {x:4300, y:GROUND_Y-90, w:560, h:140, color:'#3aa055'},
  {x:5000, y:GROUND_Y-120, w:700, h:180, color:'#2f8c45'},
];

function drawCloud(x,y,s) {
  ctx.save();
  ctx.translate(x,y); ctx.scale(s,s);
  const g = ctx.createRadialGradient(0,0,5,0,0,60);
  g.addColorStop(0,'#ffffff'); g.addColorStop(1,'#dceefd');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(-30, 0, 26, 0, Math.PI*2);
  ctx.arc(-5, -10, 30, 0, Math.PI*2);
  ctx.arc(25, -4, 24, 0, Math.PI*2);
  ctx.arc(40, 6, 20, 0, Math.PI*2);
  ctx.arc(10, 12, 22, 0, Math.PI*2);
  ctx.arc(-20, 10, 22, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}
function drawHill(x,y,w,h,color) {
  const g = ctx.createLinearGradient(0,y,0,y+h);
  g.addColorStop(0, color);
  g.addColorStop(1, shade(color, -0.25));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y+h);
  ctx.quadraticCurveTo(x + w*0.25, y-h*0.3, x + w*0.5, y);
  ctx.quadraticCurveTo(x + w*0.75, y-h*0.3, x + w, y+h);
  ctx.closePath(); ctx.fill();
  // grass highlight
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(x + w*0.15, y+h*0.2);
  ctx.quadraticCurveTo(x + w*0.25, y-h*0.1, x + w*0.5, y+h*0.05);
  ctx.quadraticCurveTo(x + w*0.75, y-h*0.1, x + w*0.85, y+h*0.2);
  ctx.quadraticCurveTo(x + w*0.5, y+h*0.4, x + w*0.15, y+h*0.2);
  ctx.fill();
}

function shade(hex, amt) {
  // amt in [-1..1]
  const c = hex.replace('#','');
  const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
  const f = v => clamp(Math.round(v + 255*amt), 0, 255);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function drawGround() {
  // grass strip
  const gy = GROUND_Y;
  const g1 = ctx.createLinearGradient(0, gy, 0, gy+20);
  g1.addColorStop(0, '#4cc26b'); g1.addColorStop(1, '#1f7a36');
  ctx.fillStyle = g1;
  ctx.fillRect(0, gy, W, 20);
  // dirt
  const g2 = ctx.createLinearGradient(0, gy+20, 0, H);
  g2.addColorStop(0, '#a05a2c'); g2.addColorStop(1, '#5a2f15');
  ctx.fillStyle = g2;
  ctx.fillRect(0, gy+20, W, H - (gy+20));
  // dirt specks
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i=0;i<40;i++) {
    const px = ((i*97 + 30) % W);
    const py = gy + 30 + ((i*53) % (H - gy - 30));
    ctx.fillRect(px, py, 2, 2);
  }
}

function drawTiles() {
  // visible columns
  const c0 = Math.max(0, Math.floor(camera.x / TILE) - 1);
  const c1 = Math.min(COLS-1, Math.floor((camera.x + W) / TILE) + 1);
  for (let r=0; r<ROWS; r++) {
    for (let c=c0; c<=c1; c++) {
      const t = tileAt(c, r);
      if (!t || t === '.') continue;
      const wx = c*TILE, wy = r*TILE;
      if (t === 'G') continue; // drawn as ground
      if (t === 'F') continue; // drawn separately
      const ox = wx - camera.x;
      const oy = wy;
      if (t === 'B') {
        const bump = (bumpTiles.find(b => b.c===c && b.r===r) || {}).offset || 0;
        drawBrick(ox, oy + bump);
      } else if (t === '?') {
        const bump = (bumpTiles.find(b => b.c===c && b.r===r) || {}).offset || 0;
        drawQuestion(ox, oy + bump, false);
      } else if (t === 'X') {
        drawHardBlock(ox, oy);
      } else if (t === '|' || t === '=') {
        drawPipe(ox, oy, t);
      }
    }
  }
  // flag
  drawFlag();
}

function drawBrick(x, y) {
  softShadow(x+2, y+4, TILE, TILE, 4);
  const g = ctx.createLinearGradient(x, y, x, y+TILE);
  g.addColorStop(0, '#d5691f'); g.addColorStop(1, '#8a3a0c');
  ctx.fillStyle = g; roundRect(x, y, TILE, TILE, 4); ctx.fill();
  // mortar lines
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + TILE/2); ctx.lineTo(x+TILE, y + TILE/2);
  ctx.moveTo(x + TILE/2, y); ctx.lineTo(x + TILE/2, y + TILE/2);
  ctx.moveTo(x + TILE/4, y + TILE/2); ctx.lineTo(x + TILE/4, y + TILE);
  ctx.moveTo(x + 3*TILE/4, y + TILE/2); ctx.lineTo(x + 3*TILE/4, y + TILE);
  ctx.stroke();
  // highlight
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x+2, y+2, TILE-4, 3);
}

function drawQuestion(x, y, hit) {
  softShadow(x+2, y+4, TILE, TILE, 6);
  const g = ctx.createLinearGradient(x, y, x, y+TILE);
  g.addColorStop(0, '#ffd84a'); g.addColorStop(1, '#d68f00');
  ctx.fillStyle = g; roundRect(x, y, TILE, TILE, 8); ctx.fill();
  // rivets
  ctx.fillStyle = '#a86a00';
  [[6,6],[TILE-10,6],[6,TILE-10],[TILE-10,TILE-10]].forEach(([dx,dy])=>{
    ctx.beginPath(); ctx.arc(x+dx+2, y+dy+2, 2.5, 0, Math.PI*2); ctx.fill();
  });
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  roundRect(x+4, y+4, TILE-8, 6, 4); ctx.fill();
  // question mark
  ctx.fillStyle = '#5a3300';
  ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('?', x + TILE/2, y + TILE/2 + 2);
}

function drawHardBlock(x, y) {
  softShadow(x+2, y+4, TILE, TILE, 4);
  const g = ctx.createLinearGradient(x, y, x, y+TILE);
  g.addColorStop(0, '#cfcfcf'); g.addColorStop(1, '#6f6f6f');
  ctx.fillStyle = g; roundRect(x, y, TILE, TILE, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + TILE/2); ctx.lineTo(x+TILE, y + TILE/2);
  ctx.moveTo(x + TILE/2, y); ctx.lineTo(x + TILE/2, y + TILE);
  ctx.moveTo(x + TILE/4, y + TILE/4); ctx.lineTo(x + 3*TILE/4, y + 3*TILE/4);
  ctx.moveTo(x + 3*TILE/4, y + TILE/4); ctx.lineTo(x + TILE/4, y + 3*TILE/4);
  ctx.stroke();
  // cross bolt centers
  ctx.fillStyle = '#444';
  [[TILE/4,TILE/4],[3*TILE/4,TILE/4],[TILE/4,3*TILE/4],[3*TILE/4,3*TILE/4]].forEach(([dx,dy])=>{
    ctx.beginPath(); ctx.arc(x+dx, y+dy, 3, 0, Math.PI*2); ctx.fill();
  });
}

function drawPipe(x, y, kind) {
  const w = TILE + 8, h = TILE;
  const r = 10;
  const body = ctx.createLinearGradient(x, y, x+w, y);
  body.addColorStop(0,   '#2db84b');
  body.addColorStop(0.5, '#86e09a');
  body.addColorStop(1,   '#1c6f30');
  if (kind === '|') {
    // lip
    softShadow(x+2, y+4, w, h, 6);
    ctx.fillStyle = body; roundRect(x, y, w, h, r); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x+w-6, y+2, 4, h-4);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x+4, y+4, 4, h-8);
  } else {
    softShadow(x+4, y+4, w-8, h, 4);
    ctx.fillStyle = body; roundRect(x+4, y, w-8, h, 4); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(x+w-10, y+2, 3, h-4);
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fillRect(x+8, y+4, 3, h-8);
  }
}

function drawFlag() {
  const c = 218;
  const wx = c*TILE + TILE/2;
  // pole
  ctx.fillStyle = '#dddddd';
  ctx.fillRect(wx - 3, 0, 6, H);
  // ball top
  const g = ctx.createRadialGradient(wx-2, 12, 2, wx, 14, 10);
  g.addColorStop(0,'#fff'); g.addColorStop(1,'#888');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(wx, 14, 10, 0, Math.PI*2); ctx.fill();
  // flag cloth
  const fy = GROUND_Y - 5*TILE;
  ctx.fillStyle = '#e52521';
  ctx.beginPath();
  ctx.moveTo(wx + 4, fy);
  ctx.lineTo(wx + 4 + 28, fy + 10);
  ctx.lineTo(wx + 4 + 16, fy + 20);
  ctx.lineTo(wx + 4 + 28, fy + 30);
  ctx.lineTo(wx + 4, fy + 40);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(wx+4, fy+2, 4, 38);
}

function drawCoin(x, y) {
  const g = ctx.createRadialGradient(x+3, y+3, 1, x+9, y+9, 12);
  g.addColorStop(0, '#fff7a8'); g.addColorStop(0.4, '#ffd84a'); g.addColorStop(1, '#b07900');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x+9, y+9, 9, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x+9, y+9, 9, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle = '#7a4d00';
  ctx.font = 'bold 11px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('¢', x+9, y+10);
}

function drawGoomba(e) {
  const x = e.x - camera.x, y = e.y;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return; // safety
  if (e.dead) { drawGoombaSplat(x, y); return; }
  softShadow(x+2, y+24, 32, 6, 6);
  // body
  const g = ctx.createLinearGradient(x, y, x, y+32);
  g.addColorStop(0, '#a05a2c'); g.addColorStop(1, '#5a2f15');
  ctx.fillStyle = g;
  roundRect(x+2, y+6, 28, 22, 12); ctx.fill();
  // head dome
  ctx.beginPath();
  ctx.ellipse(x+16, y+10, 14, 10, 0, 0, Math.PI*2);
  ctx.fillStyle = g; ctx.fill();
  // eyes
  ctx.fillStyle = '#fff';
  roundRect(x+6,  y+4, 8, 9, 3); ctx.fill();
  roundRect(x+18, y+4, 8, 9, 3); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(x+10, y+9, 2.2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+22, y+9, 2.2, 0, Math.PI*2); ctx.fill();
  // brow
  ctx.fillStyle = '#000';
  ctx.fillRect(x+6,  y+3, 8, 2);
  ctx.fillRect(x+18, y+3, 8, 2);
  // feet (alternates with walkAnim)
  const f = Math.sin(e.walkAnim * 8) * 3;
  ctx.fillStyle = '#3a1a08';
  roundRect(x+2 + f, y+24, 12, 8, 4); ctx.fill();
  roundRect(x+18 - f, y+24, 12, 8, 4); ctx.fill();
}

function drawGoombaSplat(x, y) {
  ctx.fillStyle = '#5a2f15';
  ctx.beginPath();
  ctx.ellipse(x+16, y+30, 14, 4, 0, 0, Math.PI*2);
  ctx.fill();
}

function drawPlayer() {
  const x = player.x - camera.x, y = player.y;
  if (player.dead) {
    // death hop animation
    ctx.save();
    ctx.translate(x + player.w/2, y + player.h/2);
    ctx.rotate(Math.sin(player.deadTimer*8) * 0.1);
    drawMario(0, 0, true, true, 1);
    ctx.restore();
    return;
  }
  // invuln flicker
  if (player.invuln > 0 && Math.floor(player.invuln*20) % 2 === 0) {
    ctx.save(); ctx.globalAlpha = 0.55;
    drawMario(x, y, player.facing === 1, player.onGround, player.facing, player.crouching);
    ctx.restore();
  } else {
    drawMario(x, y, player.facing === 1, player.onGround, player.facing, player.crouching);
  }
}

// Mario is drawn at center (0,0); pass ctx already translated to (x,y) being top-left
function drawMario(x, y, faceRight, onGround, facing, crouching) {
  ctx.save();
  ctx.translate(x, y);
  if (!faceRight) { ctx.scale(-1, 1); ctx.translate(-player.w, 0); }

  const h = crouching ? Math.floor(player.h * 0.75) : player.h;
  const big = player.big;
  const colors = {
    skin:  '#ffd09c',
    hair:  '#3a1a08',
    hat:   '#e52521',
    hatD:  '#a8160f',
    shirt: '#e52521',
    shirtD:'#a8160f',
    overalls:'#1d4ed8',
    overallsD:'#0f2f8a',
    shoes: '#3a1a08',
  };

  // soft shadow
  softShadow(2, h-2, player.w, 4, 4);

  // legs (swap walk frame)
  const walk = player.walkAnim;
  const legSwing = onGround ? Math.sin(walk) * 4 : 0;
  const bigScale = big ? 1.5 : 1;
  // body sizes
  const headR = big ? 16 : 12;
  const torsoH = big ? 18 : 12;
  const legH   = big ? 18 : 12;

  // legs
  drawLimb(8,  h-legH,  6, legH - Math.max(0, legSwing), colors.overalls, colors.overallsD);
  drawLimb(player.w-14, h-legH, 6, legH + Math.max(0, legSwing), colors.overalls, colors.overallsD);
  // shoes
  drawShoe(4,  h-6 - Math.max(0,legSwing), 12, 6, colors.shoes, legSwing < 0);
  drawShoe(player.w-16, h-6 + Math.max(0,legSwing), 12, 6, colors.shoes, legSwing > 0);

  // torso (overalls)
  const torsoY = h - legH - torsoH;
  const grd = ctx.createLinearGradient(0, torsoY, 0, torsoY+torsoH);
  grd.addColorStop(0, colors.overalls); grd.addColorStop(1, colors.overallsD);
  ctx.fillStyle = grd;
  roundRect(2, torsoY, player.w-4, torsoH, 4); ctx.fill();
  // overalls straps
  ctx.fillStyle = colors.overalls;
  ctx.fillRect(6, torsoY-4, 4, 6);
  ctx.fillRect(player.w-10, torsoY-4, 4, 6);
  // shirt sleeves
  ctx.fillStyle = colors.shirt;
  roundRect(0,  torsoY+2, 6, torsoH-4, 3); ctx.fill();
  roundRect(player.w-6, torsoY+2, 6, torsoH-4, 3); ctx.fill();
  // gold button
  ctx.fillStyle = '#ffd84a';
  ctx.beginPath(); ctx.arc(player.w/2, torsoY + 4, 2, 0, Math.PI*2); ctx.fill();

  // arms (slight swing)
  const armSwing = onGround ? Math.sin(walk + Math.PI) * 3 : -6;
  drawArm(-2, torsoY + 4, 6, 10, colors.shirt, colors.skin, armSwing);
  drawArm(player.w-4, torsoY + 4, 6, 10, colors.shirt, colors.skin, -armSwing);

  // head
  const headY = torsoY - headR*1.6;
  const hx = player.w/2, hy = headY + headR;
  // face
  ctx.fillStyle = colors.skin;
  ctx.beginPath(); ctx.arc(hx, hy, headR, 0, Math.PI*2); ctx.fill();
  // sideburn / hair
  ctx.fillStyle = colors.hair;
  ctx.beginPath();
  ctx.arc(hx - headR*0.7, hy + headR*0.2, headR*0.5, 0, Math.PI*2);
  ctx.arc(hx - headR*0.2, hy + headR*0.7, headR*0.3, 0, Math.PI*2);
  ctx.fill();
  // mustache
  ctx.fillStyle = colors.hair;
  roundRect(hx - 5, hy + 2, 10, 3, 1.5); ctx.fill();
  // eye
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(hx + 4, hy - 1, 2.6, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#001a8a';
  ctx.beginPath(); ctx.arc(hx + 4.5, hy - 1, 1.4, 0, Math.PI*2); ctx.fill();
  // nose
  ctx.fillStyle = shade(colors.skin, -0.15);
  ctx.beginPath(); ctx.arc(hx + 7, hy + 2, 2, 0, Math.PI*2); ctx.fill();

  // hat
  ctx.save();
  ctx.translate(hx, hy - headR*0.6);
  // brim
  ctx.fillStyle = colors.hatD;
  roundRect(-headR*0.3, 4, headR*1.6, 4, 2); ctx.fill();
  // dome
  const hg = ctx.createLinearGradient(0, -headR, 0, 6);
  hg.addColorStop(0, colors.hat); hg.addColorStop(1, colors.hatD);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0, 0, headR*1.05, Math.PI, 0);
  ctx.lineTo(headR*1.05, 4);
  ctx.lineTo(-headR*1.05, 4);
  ctx.closePath(); ctx.fill();
  // M
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(headR*1.1)}px "Trebuchet MS", sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('M', 0, 0);
  ctx.restore();

  ctx.restore();
}
function drawLimb(x, y, w, h, c, cd) {
  const g = ctx.createLinearGradient(x, y, x+w, y);
  g.addColorStop(0, c); g.addColorStop(1, cd);
  ctx.fillStyle = g; roundRect(x, y, w, h, 3); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x+w-1, y, 1, h);
}
function drawShoe(x, y, w, h, c, lifted) {
  const g = ctx.createLinearGradient(x, y, x, y+h);
  g.addColorStop(0, '#5a2f15'); g.addColorStop(1, c);
  ctx.fillStyle = g; roundRect(x, y - (lifted?2:0), w, h, 3); ctx.fill();
}
function drawArm(x, y, w, h, sleeve, skin, swing) {
  // sleeve
  const g = ctx.createLinearGradient(x, y, x+w, y);
  g.addColorStop(0, sleeve); g.addColorStop(1, '#a8160f');
  ctx.fillStyle = g; roundRect(x, y, w, h*0.5, 3); ctx.fill();
  // hand
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(x + w/2, y + h*0.7 + swing*0.2, 3.2, 0, Math.PI*2); ctx.fill();
}

function drawParticles() {
  for (const p of particles) {
    const x = p.x - camera.x, y = p.y;
    if (p.kind === 'spark') {
      ctx.fillStyle = `rgba(255, 230, 100, ${clamp(p.life*2,0,1)})`;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2); ctx.fill();
    } else if (p.kind === 'brick') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.life * 4);
      const g = ctx.createLinearGradient(0,0,12,12);
      g.addColorStop(0,'#d5691f'); g.addColorStop(1,'#8a3a0c');
      ctx.fillStyle = g; roundRect(-6,-6,12,12,2); ctx.fill();
      ctx.restore();
    }
  }
}

function drawCoins() {
  for (const co of coins) {
    if (co.collected) continue;
    const x = co.x - camera.x;
    if (x < -30 || x > W+30) continue;
    drawCoin(x, co.y);
  }
}

function drawEnemies() {
  for (const en of enemies) {
    const x = en.x - camera.x;
    if (x < -60 || x > W+60) continue;
    drawGoomba(en);
  }
}

function render() {
  ctx.clearRect(0,0,W,H);
  drawSky();
  drawGround();
  drawTiles();
  drawCoins();
  drawEnemies();
  drawParticles();
  drawPlayer();
}

// ---------- bootstrap ----------
document.getElementById('startBtn').textContent = 'START';
ovTitle.textContent = 'SUPER MARIO 32';
ovSub.innerHTML = 'Press <kbd>←</kbd> <kbd>→</kbd> to move, <kbd>Space</kbd>/<kbd>↑</kbd> to jump, <kbd>Z</kbd>/<kbd>Shift</kbd> to run, <kbd>R</kbd> to reset.';
ovHint.textContent = '';
requestAnimationFrame(loop);

})();
