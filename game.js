'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Skins ─────────────────────────────────────────────────────────────────────
const SKINS = [
  {
    name: 'CLASICA',
    verts: [[20, 0], [-12, -9], [-7, 0], [-12, 9]],
    stroke: '#fff',
    flame: 'rgba(255, 130, 0, 0.85)',
    flameX: -8,
  },
  {
    name: 'FURIA',
    verts: [[22, 0], [-13, -9], [-5, -2], [-5, 2], [-13, 9]],
    stroke: '#c774ff',
    flame: 'rgba(199, 116, 255, 0.85)',
    flameX: -11,
  },
  {
    name: 'INTERCEPTOR',
    verts: [[18, 0], [4, -4], [-6, -13], [-11, -6], [-11, 6], [-6, 13], [4, 4]],
    stroke: '#3fd2ff',
    flame: 'rgba(63, 210, 255, 0.85)',
    flameX: -13,
  },
  {
    name: 'TITAN',
    verts: [[17, 0], [-3, -6], [-17, -11], [-17, 11], [-3, 6]],
    stroke: '#ffa040',
    flame: 'rgba(255, 160, 64, 0.85)',
    flameX: -15,
  },
];

const SKIN_SAVE_KEY   = 'asteroids.skin';
const SKIN_LABEL_TIME = 1.5;

let skinLabelTimer = 0;

const skinManager = {
  index: Math.max(
    0,
    SKINS.findIndex(s => s.name === localStorage.getItem(SKIN_SAVE_KEY))
  ),

  current() {
    return SKINS[this.index];
  },

  next() {
    this.index = (this.index + 1) % SKINS.length;
    try {
      localStorage.setItem(SKIN_SAVE_KEY, this.current().name);
    } catch { /* modo privado: se ignora la persistencia */ }
    skinLabelTimer = SKIN_LABEL_TIME;
  },
};

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular
    const n = randInt(8, 13);
    this.verts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Shooting star ────────────────────────────────────────────────────────────
const SHOOTING_STAR_POINTS  = 150;
const SHOOTING_STAR_SPEED   = [180, 260];
const SHOOTING_STAR_MARGIN  = 40; // margen fuera de pantalla donde nace/muere

class ShootingStar {
  constructor() {
    // Borde de entrada aleatorio y punto de salida cruzando la pantalla
    const edge  = randInt(0, 3);
    const M     = SHOOTING_STAR_MARGIN;
    const fromEdge = {
      0: { x: rand(0, W),  y: -M },          // arriba
      1: { x: rand(0, W),  y: H + M },       // abajo
      2: { x: -M,          y: rand(0, H) },  // izquierda
      3: { x: W + M,       y: rand(0, H) },  // derecha
    }[edge];

    const target = {
      0: { x: rand(W * 0.25, W), y: H + M },
      1: { x: rand(0, W * 0.75), y: -M },
      2: { x: W + M,             y: rand(0, H) },
      3: { x: -M,                y: rand(0, H) },
    }[edge];

    this.x = fromEdge.x;
    this.y = fromEdge.y;

    const angle = Math.atan2(target.y - fromEdge.y, target.x - fromEdge.x);
    const speed = rand(SHOOTING_STAR_SPEED[0], SHOOTING_STAR_SPEED[1]);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.angle = angle;
    this.radius = 10;
    this.tail = rand(60, 90);
    this.dead = false;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // Desaparece tras cruzar el límite
    if (this.x < -SHOOTING_STAR_MARGIN || this.x > W + SHOOTING_STAR_MARGIN ||
        this.y < -SHOOTING_STAR_MARGIN || this.y > H + SHOOTING_STAR_MARGIN)
      this.dead = true;
  }

  draw() {
    const len = this.tail;
    const tx  = this.x - Math.cos(this.angle) * len;
    const ty  = this.y - Math.sin(this.angle) * len;

    // Cola con gradiente decreciente
    const grad = ctx.createLinearGradient(this.x, this.y, tx, ty);
    grad.addColorStop(0, 'rgba(200, 230, 255, 0.9)');
    grad.addColorStop(1, 'rgba(200, 230, 255, 0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Cabeza brillante
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(160, 210, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
function drawShipShape(verts, stroke, lineWidth, scale = 1) {
  ctx.beginPath();
  ctx.moveTo(verts[0][0] * scale, verts[0][1] * scale);
  for (let i = 1; i < verts.length; i++)
    ctx.lineTo(verts[i][0] * scale, verts[i][1] * scale);
  ctx.closePath();
  ctx.strokeStyle = stroke;
  ctx.lineWidth   = lineWidth;
  ctx.lineJoin    = 'round';
  ctx.stroke();
}

class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.boostTimer    = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.boostTimer    > 0) this.boostTimer    -= dt;

    const ROT    = 3.5;  // rad/s
    const THRUST = this.boostTimer > 0 ? 520 : 260;  // px/s² (x2 con velocidad)
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    const skin = skinManager.current();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    drawShipShape(skin.verts, skin.stroke, 1.5);

    // Llama del propulsor (cian durante el boost)
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(skin.flameX, -4);
      ctx.lineTo(skin.flameX - rand(6, 14), 0);
      ctx.lineTo(skin.flameX,  4);
      ctx.strokeStyle = this.boostTimer > 0
        ? 'rgba(80, 220, 255, 0.9)'
        : skin.flame;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Power-up (velocidad) ─────────────────────────────────────────────────────
class PowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx     = Math.cos(angle) * speed;
    this.vy     = Math.sin(angle) * speed;
    this.ttl    = 12;
    this.radius = 10;
    this.dead   = false;
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Anillo pulsante con doble chevron
    const pulse  = 1 + 0.15 * Math.sin(this.ttl * 6);
    const r      = this.radius * pulse;
    const alpha  = this.ttl < 3 ? (Math.floor(this.ttl * 6) % 2 ? 0.35 : 1) : 1;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = `rgba(255, 212, 0, ${alpha})`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-2, -5);
    ctx.lineTo( 2, -5);
    ctx.lineTo(-1,  0);
    ctx.lineTo( 3,  0);
    ctx.lineTo(-2,  5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerUps, shootingStars;
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let powerUpTimer;
let shootingStarTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerUps  = [];
  shootingStars = [];
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  powerUpTimer = rand(10, 18);
  shootingStarTimer = rand(5, 12);
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerUps  = [];
  shootingStars = [];
  powerUpTimer = rand(10, 18);
  shootingStarTimer = rand(5, 12);
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  // Cambio de skin disponible en cualquier estado
  if (pressed('KeyC')) skinManager.next();
  skinLabelTimer = Math.max(0, skinLabelTimer - dt);

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    powerUps.forEach(u => u.update(dt));
    powerUps = powerUps.filter(u => !u.dead);
    shootingStars.forEach(s => s.update(dt));
    shootingStars = shootingStars.filter(s => !s.dead);
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Spawn de power-up (solo si no hay ninguno en pantalla)
  powerUpTimer -= dt;
  if (powerUpTimer <= 0 && powerUps.length === 0) {
    powerUps.push(new PowerUp(rand(0, W), rand(0, H)));
    powerUpTimer = rand(10, 18);
  }

  // Spawn de estrella fugaz (cruza la pantalla sin rebotar)
  shootingStarTimer -= dt;
  if (shootingStarTimer <= 0) {
    shootingStars.push(new ShootingStar());
    shootingStarTimer = rand(6, 14);
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  powerUps.forEach(u => u.update(dt));
  shootingStars.forEach(s => s.update(dt));

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerUps  = powerUps.filter(u => !u.dead);
  shootingStars = shootingStars.filter(s => !s.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5);
        newAsteroids.push(...a.split());
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Bala vs estrella fugaz
  for (const b of bullets) {
    for (const s of shootingStars) {
      if (!s.dead && !b.dead && dist(b, s) < s.radius) {
        b.dead = true;
        s.dead = true;
        score += SHOOTING_STAR_POINTS;
        explode(s.x, s.y, 6);
      }
    }
  }
  bullets   = bullets.filter(b => !b.dead);
  shootingStars = shootingStars.filter(s => !s.dead);

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        killShip();
        break;
      }
    }
    for (const s of shootingStars) {
      if (dist(ship, s) < ship.radius + s.radius) {
        killShip();
        break;
      }
    }
  }

  // Nave vs power-up
  for (const u of powerUps) {
    if (dist(ship, u) < ship.radius + u.radius) {
      u.dead = true;
      ship.boostTimer = 5;
      explode(u.x, u.y, 5);
    }
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  const skin = skinManager.current();
  drawShipShape(skin.verts, skin.stroke, 1.2, 0.5);
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  // Indicador de boost activo
  if (ship.boostTimer > 0) {
    ctx.fillStyle = '#ffd400';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`VELOCIDAD ${Math.ceil(ship.boostTimer)}s`, W / 2, H - 22);
  }

  // Nombre del skin activo tras cambiar (fade)
  if (skinLabelTimer > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, skinLabelTimer).toFixed(2)})`;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`NAVE ${skinManager.current().name}`, W / 2, H - 46);
  }

}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  shootingStars.forEach(s => s.draw());
  asteroids.forEach(a => a.draw());
  bullets.forEach(b => b.draw());
  powerUps.forEach(u => u.draw());
  ship.draw();

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
