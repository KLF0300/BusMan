const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const passengersEl = document.getElementById('passengers');

const tile = 21;
const PASSENGER_POINTS = 100;
const PASSENGER_COUNT = 16;
const map = [
  '11111111111111111111',
  '10000000010000000001',
  '10111111010111111001',
  '10100001000100001001',
  '10101101111101101001',
  '10001000000000001001',
  '11101011100111001001',
  '10000010000001000001',
  '10111010111101011101',
  '10000010000001000001',
  '10111110111101111101',
  '10000000001000000001',
  '11101111101011111011',
  '10001000000000001001',
  '10111011111101111001',
  '10000000000000000001',
  '11111111111111111111'
];

const h = map.length;
const w = map[0].length;

function isWall(x, y) {
  if (x < 0 || y < 0 || x >= w || y >= h) return true;
  return map[y][x] === '1';
}

const roadTiles = [];
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    if (!isWall(x, y)) roadTiles.push({ x, y });
  }
}

function pickRandomRoadTiles(count, blocked = new Set()) {
  const options = roadTiles.filter(({ x, y }) => !blocked.has(`${x},${y}`));
  for (let i = options.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options.slice(0, Math.min(count, options.length));
}

const bus = { x: 1, y: 1, dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 } };
const ghosts = [
  { x: 18, y: 1, c: '#ff4d4d' },
  { x: 18, y: 15, c: '#ff99ff' }
];
const blockedSpawns = new Set([`${bus.x},${bus.y}`, ...ghosts.map(g => `${g.x},${g.y}`)]);
const passengers = new Set(pickRandomRoadTiles(PASSENGER_COUNT, blockedSpawns).map(p => `${p.x},${p.y}`));

let score = 0;
let gameOver = false;
let won = false;

let audioCtx;
let musicEnabled = true;
let noteTimer;
const C64_SCALE = [130.81, 164.81, 196.0, 246.94, 261.63, 329.63, 392.0, 493.88];

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSidNote(freq, duration = 0.12, type = 'square', volume = 0.045) {
  if (!musicEnabled) return;
  ensureAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.0, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playPickupJingle() {
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((n, i) => setTimeout(() => playSidNote(n, 0.09, 'square', 0.06), i * 70));
}

function playCrashTone() {
  [220, 196, 174.61].forEach((n, i) => setTimeout(() => playSidNote(n, 0.2, 'sawtooth', 0.05), i * 90));
}

function startBackgroundMusic() {
  if (noteTimer) return;
  let step = 0;
  noteTimer = setInterval(() => {
    const n1 = C64_SCALE[step % C64_SCALE.length];
    const n2 = C64_SCALE[(step + 2) % C64_SCALE.length];
    playSidNote(n1, 0.11, 'triangle', 0.03);
    setTimeout(() => playSidNote(n2, 0.08, 'square', 0.02), 40);
    step++;
  }, 180);
}


function drawBus() {
  const px = bus.x * tile;
  const py = bus.y * tile;

  ctx.fillStyle = '#f7d24c';
  ctx.fillRect(px + 2, py + 4, tile - 4, tile - 8);

  ctx.fillStyle = '#1f2937';
  ctx.fillRect(px + 4, py + 6, 6, 5);
  ctx.fillRect(px + 12, py + 6, 6, 5);

  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(px + 6, py + tile - 3, 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px + tile - 6, py + tile - 3, 2.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawPassenger(x, y) {
  const cx = x * tile + tile / 2;
  const cy = y * tile + tile / 2;
  ctx.fillStyle = '#7dd3fc';
  ctx.beginPath();
  ctx.arc(cx, cy - 3, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#22c55e';
  ctx.fillRect(cx - 3, cy, 6, 6);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (map[y][x] === '1') {
        ctx.fillStyle = '#0033cc';
        ctx.fillRect(x * tile, y * tile, tile, tile);
      }
    }
  }

  for (const key of passengers) {
    const [x, y] = key.split(',').map(Number);
    drawPassenger(x, y);
  }

  drawBus();

  for (const g of ghosts) {
    ctx.fillStyle = g.c;
    ctx.beginPath();
    ctx.arc(g.x * tile + tile / 2, g.y * tile + tile / 2, tile / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '26px Arial';
    ctx.fillText(won ? 'All Passengers Picked Up!' : 'Game Over', won ? 45 : 135, 200);
  }
}

function stepEntity(e, dir) {
  const nx = e.x + dir.x;
  const ny = e.y + dir.y;
  if (!isWall(nx, ny)) {
    e.x = nx;
    e.y = ny;
    return true;
  }
  return false;
}

function moveBus() {
  if (!isWall(bus.x + bus.nextDir.x, bus.y + bus.nextDir.y)) {
    bus.dir = bus.nextDir;
  }
  stepEntity(bus, bus.dir);

  const key = `${bus.x},${bus.y}`;
  if (passengers.has(key)) {
    passengers.delete(key);
    score += PASSENGER_POINTS;
    scoreEl.textContent = `Score: ${score}`;
    passengersEl.textContent = `Passengers left: ${passengers.size}`;
    playPickupJingle();
  }
}

function moveGhosts() {
  for (const g of ghosts) {
    const dirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ].filter(d => !isWall(g.x + d.x, g.y + d.y));

    dirs.sort((a, b) => {
      const da = Math.abs((g.x + a.x) - bus.x) + Math.abs((g.y + a.y) - bus.y);
      const db = Math.abs((g.x + b.x) - bus.x) + Math.abs((g.y + b.y) - bus.y);
      return da - db;
    });

    const pick = Math.random() < 0.7 ? dirs[0] : dirs[(Math.random() * dirs.length) | 0];
    stepEntity(g, pick);
  }
}

function checkCollision() {
  for (const g of ghosts) {
    if (g.x === bus.x && g.y === bus.y) {
      gameOver = true;
      won = false;
      playCrashTone();
    }
  }
}

function tick() {
  if (!gameOver) {
    moveBus();
    moveGhosts();
    checkCollision();
    if (passengers.size === 0) {
      gameOver = true;
      won = true;
    }
  }
  draw();
}

document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'arrowup' || key === 'w') { ensureAudio(); startBackgroundMusic(); bus.nextDir = { x: 0, y: -1 }; }
  if (key === 'arrowdown' || key === 's') { ensureAudio(); startBackgroundMusic(); bus.nextDir = { x: 0, y: 1 }; }
  if (key === 'arrowleft' || key === 'a') { ensureAudio(); startBackgroundMusic(); bus.nextDir = { x: -1, y: 0 }; }
  if (key === 'arrowright' || key === 'd') { ensureAudio(); startBackgroundMusic(); bus.nextDir = { x: 1, y: 0 }; }
  if (key === 'm') musicEnabled = !musicEnabled;
});

passengersEl.textContent = `Passengers left: ${passengers.size}`;
draw();
setInterval(tick, 170);
