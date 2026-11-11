const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const menuEl = document.getElementById('menu');
const hudEl = document.getElementById('hud');
const gameOverEl = document.getElementById('gameOver');
const scoreEl = document.getElementById('score');
const waveEl = document.getElementById('wave');
const healthFillEl = document.getElementById('healthFill');
const finalScoreEl = document.getElementById('finalScore');
const joystickEl = document.getElementById('joystick');
const stickThumb = document.getElementById('stickThumb');
const fireBtn = document.getElementById('fireBtn');
const characterGridEl = document.getElementById('characterGrid');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

const characters = {
  Rex: { name: 'Rex', emoji: '🦾', speed: 260, fireRate: 0.25, damage: 15, health: 100 },
  Nova: { name: 'Nova', emoji: '⚡', speed: 300, fireRate: 0.18, damage: 20, health: 88 },
  Brute: { name: 'Brute', emoji: '🛡️', speed: 200, fireRate: 0.8, damage: 30, health: 120 },
};

const state = {
  selected: 'Rex', running: false, score: 0, wave: 1, time: 0,
  spawnTimer: 0, lastTimestamp: 0, pointerAim: { x: 0, y: 0 }, keys: {},
  mouseDown: false, enemies: [], bullets: [], pickups: [], particles: [], player: null,
  gameOver: false,
};
const joystick = { active: false, baseX: 0, baseY: 0, dx: 0, dy: 0, radius: 52, pointerId: null };
let mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;

function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  state.pointerAim.x = state.width / 2;
  state.pointerAim.y = state.height / 2;
  if (state.player) {
    state.player.x = clamp(state.player.x, state.player.radius, state.width - state.player.radius);
    state.player.y = clamp(state.player.y, state.player.radius, state.height - state.player.radius);
  }
}

function createCharacterCards() {
  characterGridEl.replaceChildren();
  Object.entries(characters).forEach(([key, info]) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `character-card${state.selected === key ? ' selected' : ''}`;
    card.setAttribute('aria-pressed', String(state.selected === key));
    card.innerHTML = `<div class="character-avatar">${info.emoji}</div><h3>${info.name}</h3><p>Speed ${info.speed}<br>Damage ${info.damage}<br>HP ${info.health}</p>`;
    card.addEventListener('click', () => { state.selected = key; createCharacterCards(); });
    characterGridEl.appendChild(card);
  });
}

function resetGame() {
  const config = characters[state.selected];
  state.player = {
    x: state.width / 2, y: state.height / 2, radius: 18,
    hp: config.health, maxHp: config.health, speed: config.speed,
    fireRate: config.fireRate, damage: config.damage, color: '#7ae582',
    facing: { x: 1, y: 0 }, cooldown: 0, invuln: 0,
  };
  state.enemies = []; state.bullets = []; state.pickups = []; state.particles = [];
  state.score = 0; state.wave = 1; state.time = 0; state.spawnTimer = 0.8;
  state.gameOver = false;
  state.keys = {}; state.mouseDown = false;
  scoreEl.textContent = '0'; waveEl.textContent = '1'; healthFillEl.style.width = '100%';
}

function showMobileControls(show) {
  mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
  joystickEl.classList.toggle('hidden', !(show && mobile));
  fireBtn.classList.toggle('hidden', !(show && mobile));
}
function startMatch() {
  resetGame();
  menuEl.classList.add('hidden'); gameOverEl.classList.add('hidden'); hudEl.classList.remove('hidden');
  showMobileControls(true);
  state.running = true;
  state.lastTimestamp = 0;
}
function endMatch() {
  if (!state.running) return;
  state.running = false; state.gameOver = true;
  finalScoreEl.textContent = `Score: ${state.score}`;
  gameOverEl.classList.remove('hidden'); hudEl.classList.add('hidden');
  showMobileControls(false);
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = Math.random() * state.width; y = -24; }
  else if (side === 1) { x = state.width + 24; y = Math.random() * state.height; }
  else if (side === 2) { x = Math.random() * state.width; y = state.height + 24; }
  else { x = -24; y = Math.random() * state.height; }
  const hp = 24 + state.wave * 8;
  state.enemies.push({ x, y, radius: 16, hp, maxHp: hp, speed: 58 + state.wave * 9,
    damage: 7 + state.wave * 1.5, cooldown: 0.8 + Math.random() * 0.8, color: '#ff7a90' });
}
function shootBullet(from, target, damage, owner) {
  const angle = Math.atan2(target.y - from.y, target.x - from.x);
  const speed = owner === 'player' ? 440 : 260;
  state.bullets.push({ x: from.x, y: from.y, radius: owner === 'player' ? 5 : 4,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage,
    life: 1.8, owner, color: owner === 'player' ? '#53d7ff' : '#ffd166' });
}
function spawnParticles(x, y, count, color) {
  for (let i = 0; i < count; i++) state.particles.push({ x, y,
    vx: (Math.random() - 0.5) * 150, vy: (Math.random() - 0.5) * 150,
    life: 0.35 + Math.random() * 0.45, color, radius: 2 + Math.random() * 3 });
}
function maybeDropPickup(x, y) {
  if (Math.random() < 0.18) state.pickups.push({ x, y, radius: 10, type: Math.random() < 0.55 ? 'heal' : 'boost' });
}

function handlePlayerInput(dt) {
  const player = state.player;
  let moveX = 0, moveY = 0;
  if (state.keys.w || state.keys.arrowup) moveY -= 1;
  if (state.keys.s || state.keys.arrowdown) moveY += 1;
  if (state.keys.a || state.keys.arrowleft) moveX -= 1;
  if (state.keys.d || state.keys.arrowright) moveX += 1;
  if (joystick.active) { moveX += joystick.dx; moveY += joystick.dy; }
  const length = Math.hypot(moveX, moveY) || 1;
  moveX /= length; moveY /= length;
  player.x = clamp(player.x + moveX * player.speed * dt, player.radius, state.width - player.radius);
  player.y = clamp(player.y + moveY * player.speed * dt, player.radius, state.height - player.radius);

  const aimX = state.pointerAim.x - player.x, aimY = state.pointerAim.y - player.y;
  if (Math.hypot(aimX, aimY) > 0.1) {
    const aimLength = Math.hypot(aimX, aimY);
    player.facing.x = aimX / aimLength; player.facing.y = aimY / aimLength;
  }
  if (player.cooldown > 0) player.cooldown -= dt;
  if (player.invuln > 0) player.invuln -= dt;
  const firing = state.mouseDown || fireBtn.dataset.pressed === 'true';
  if (firing && player.cooldown <= 0) {
    shootBullet(player, state.pointerAim, player.damage, 'player');
    player.cooldown = player.fireRate;
  }
}

function updateBullets(dt) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i];
    bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt; bullet.life -= dt;
    if (bullet.x < -24 || bullet.x > state.width + 24 || bullet.y < -24 || bullet.y > state.height + 24 || bullet.life <= 0) {
      state.bullets.splice(i, 1); continue;
    }
    if (bullet.owner === 'player') {
      for (let j = state.enemies.length - 1; j >= 0; j--) {
        const enemy = state.enemies[j];
        if (distance(bullet, enemy) < bullet.radius + enemy.radius) {
          enemy.hp -= bullet.damage; state.bullets.splice(i, 1);
          if (enemy.hp <= 0) {
            maybeDropPickup(enemy.x, enemy.y); spawnParticles(enemy.x, enemy.y, 18, '#ff6b6b');
            state.enemies.splice(j, 1); state.score += 10;
          }
          break;
        }
      }
    } else {
      const player = state.player;
      if (distance(bullet, player) < bullet.radius + player.radius) {
        state.bullets.splice(i, 1);
        if (player.invuln <= 0) {
          player.hp -= bullet.damage; player.invuln = 0.55;
          spawnParticles(player.x, player.y, 12, '#ffffff');
          if (player.hp <= 0) endMatch();
        }
      }
    }
  }
}
function updateEnemies(dt) {
  const player = state.player;
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    const dx = player.x - enemy.x, dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / dist) * enemy.speed * dt;
    enemy.y += (dy / dist) * enemy.speed * dt;
    enemy.cooldown -= dt;
    if (enemy.cooldown <= 0 && dist < 300) {
      shootBullet(enemy, player, enemy.damage, 'enemy'); enemy.cooldown = 1.2 + Math.random() * 0.7;
    }
    if (dist < enemy.radius + player.radius + 2 && player.invuln <= 0) {
      player.hp -= enemy.damage * dt * 2.5; player.invuln = 0.16;
      if (player.hp <= 0) { endMatch(); return; }
    }
  }
}
function updatePickups(dt) {
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pickup = state.pickups[i];
    if (distance(pickup, state.player) < pickup.radius + state.player.radius + 2) {
      if (pickup.type === 'heal') state.player.hp = Math.min(state.player.maxHp, state.player.hp + 25);
      else { state.player.damage += 2; state.player.fireRate = Math.max(0.12, state.player.fireRate - 0.02); }
      state.pickups.splice(i, 1);
    } else pickup.y += Math.sin((state.time + i) * 3) * 0.25;
  }
}
function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const particle = state.particles[i];
    particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt;
    if (particle.life <= 0) state.particles.splice(i, 1);
  }
}
function updateWave(dt) {
  state.time += dt; state.spawnTimer -= dt;
  const nextWave = 1 + Math.floor(state.score / 80);
  if (nextWave > state.wave) state.wave = nextWave;
  if (state.spawnTimer <= 0) {
    const count = Math.min(2 + state.wave, 6);
    for (let i = 0; i < count; i++) spawnEnemy();
    state.spawnTimer = Math.max(0.7, 2.4 - state.wave * 0.12);
  }
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  waveEl.textContent = String(state.wave);
  healthFillEl.style.width = `${clamp((state.player.hp / state.player.maxHp) * 100, 0, 100)}%`;
}
function update(dt) {
  handlePlayerInput(dt); updateWave(dt); updateBullets(dt); updateEnemies(dt); updatePickups(dt); updateParticles(dt); updateHud();
}

function drawArena() {
  ctx.clearRect(0, 0, state.width, state.height);
  const gradient = ctx.createLinearGradient(0, 0, state.width, state.height);
  gradient.addColorStop(0, '#0b1120'); gradient.addColorStop(0.5, '#1f2937'); gradient.addColorStop(1, '#0b1120');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, state.width, state.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.045)'; ctx.lineWidth = 1;
  for (let x = 0; x < state.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, state.height); ctx.stroke(); }
  for (let y = 0; y < state.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(state.width, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(148,163,184,0.35)'; ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, state.width - 24, state.height - 24);
}
function drawPlayer() {
  const player = state.player; if (!player) return;
  ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(Math.atan2(player.facing.y, player.facing.x));
  ctx.globalAlpha = player.invuln > 0 && Math.floor(state.time * 18) % 2 ? 0.45 : 1;
  ctx.fillStyle = '#7ae582'; ctx.beginPath(); ctx.arc(0, 0, player.radius, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d5f9d0'; ctx.fillRect(8, -4, 20, 8);
  ctx.restore(); ctx.globalAlpha = 1;
}
function drawEnemy(enemy) {
  ctx.fillStyle = enemy.color; ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2); ctx.fill();
  const ratio = clamp(enemy.hp / enemy.maxHp, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(enemy.x - 18, enemy.y - 28, 36, 5);
  ctx.fillStyle = '#7ae582'; ctx.fillRect(enemy.x - 18, enemy.y - 28, 36 * ratio, 5);
}
function drawWorld() {
  for (const pickup of state.pickups) {
    ctx.fillStyle = pickup.type === 'heal' ? '#80ffbf' : '#ffd166';
    ctx.beginPath(); ctx.arc(pickup.x, pickup.y, pickup.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
    ctx.fillText(pickup.type === 'heal' ? '+' : '⚡', pickup.x, pickup.y + 4);
  }
  for (const bullet of state.bullets) {
    ctx.fillStyle = bullet.color; ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2); ctx.fill();
  }
  for (const p of state.particles) {
    ctx.globalAlpha = clamp(p.life * 3, 0, 1); ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  state.enemies.forEach(drawEnemy);
  drawPlayer();
}
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - (state.lastTimestamp || timestamp)) / 1000 || 0.016, 0.035);
  state.lastTimestamp = timestamp;
  if (state.running) update(dt);
  drawArena(); drawWorld();
  requestAnimationFrame(gameLoop);
}

function updateAim(event) {
  const rect = canvas.getBoundingClientRect();
  state.pointerAim.x = event.clientX - rect.left;
  state.pointerAim.y = event.clientY - rect.top;
}
canvas.addEventListener('pointerdown', (event) => {
  if (!state.running || event.target === fireBtn || joystickEl.contains(event.target)) return;
  updateAim(event); state.mouseDown = true;
});
canvas.addEventListener('pointermove', (event) => { if (state.running) updateAim(event); });
window.addEventListener('pointerup', () => { state.mouseDown = false; });
window.addEventListener('pointercancel', () => { state.mouseDown = false; });
window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase(); state.keys[key] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
});
window.addEventListener('keyup', (event) => { state.keys[event.key.toLowerCase()] = false; });

function updateJoystickPosition(x, y) {
  const dist = Math.hypot(x, y), scale = dist > joystick.radius ? joystick.radius / dist : 1;
  const offsetX = x * scale, offsetY = y * scale;
  stickThumb.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  joystick.dx = offsetX / joystick.radius; joystick.dy = offsetY / joystick.radius;
}
joystickEl.addEventListener('pointerdown', (event) => {
  event.preventDefault(); event.stopPropagation();
  const rect = joystickEl.getBoundingClientRect();
  joystick.active = true; joystick.pointerId = event.pointerId;
  joystick.baseX = rect.left + rect.width / 2; joystick.baseY = rect.top + rect.height / 2;
  joystickEl.setPointerCapture(event.pointerId);
  updateJoystickPosition(event.clientX - joystick.baseX, event.clientY - joystick.baseY);
});
joystickEl.addEventListener('pointermove', (event) => {
  if (joystick.active && event.pointerId === joystick.pointerId) updateJoystickPosition(event.clientX - joystick.baseX, event.clientY - joystick.baseY);
});
function releaseJoystick() {
  joystick.active = false; joystick.pointerId = null; joystick.dx = 0; joystick.dy = 0;
  stickThumb.style.transform = 'translate(0px, 0px)';
}
joystickEl.addEventListener('pointerup', releaseJoystick);
joystickEl.addEventListener('pointercancel', releaseJoystick);
fireBtn.addEventListener('pointerdown', (event) => {
  event.preventDefault(); event.stopPropagation(); fireBtn.dataset.pressed = 'true';
  // Aim toward the nearest enemy when using the touchscreen fire button.
  const target = state.enemies.reduce((nearest, enemy) => !nearest || distance(state.player, enemy) < distance(state.player, nearest) ? enemy : nearest, null);
  if (target) state.pointerAim = { x: target.x, y: target.y };
  else state.pointerAim = { x: state.player.x + state.player.facing.x * 200, y: state.player.y + state.player.facing.y * 200 };
  fireBtn.setPointerCapture(event.pointerId);
});
function releaseFire() { fireBtn.dataset.pressed = 'false'; }
fireBtn.addEventListener('pointerup', releaseFire);
fireBtn.addEventListener('pointercancel', releaseFire);
fireBtn.addEventListener('pointerleave', releaseFire);
startBtn.addEventListener('click', startMatch);
restartBtn.addEventListener('click', () => {
  gameOverEl.classList.add('hidden'); hudEl.classList.add('hidden'); menuEl.classList.remove('hidden');
  state.gameOver = false; state.player = null; createCharacterCards();
});
window.addEventListener('resize', () => { resizeCanvas(); showMobileControls(state.running); });
window.addEventListener('blur', () => { state.keys = {}; state.mouseDown = false; releaseFire(); releaseJoystick(); });

resizeCanvas(); createCharacterCards(); showMobileControls(false); requestAnimationFrame(gameLoop);
