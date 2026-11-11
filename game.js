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
  Rex: { name: 'Rex', emoji: '🦾', speed: 230, fireRate: 0.24, damage: 16, health: 100 },
  Nova: { name: 'Nova', emoji: '⚡', speed: 260, fireRate: 0.18, damage: 13, health: 88 },
  Brute: { name: 'Brute', emoji: '🛡️', speed: 200, fireRate: 0.3, damage: 20, health: 120 }
};

const state = {
  selected: 'Rex',
  running: false,
  score: 0,
  wave: 1,
  time: 0,
  spawnTimer: 0,
  lastTimestamp: 0,
  pointerAim: { x: canvas.width / 2, y: canvas.height / 2 },
  keys: {},
  mouseDown: false,
  enemies: [],
  bullets: [],
  pickups: [],
  particles: [],
  player: null,
  gameOver: false,
};

const mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;

const joystick = {
  active: false,
  baseX: 0,
  baseY: 0,
  dx: 0,
  dy: 0,
  radius: 52,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createCharacterCards() {
  characterGridEl.innerHTML = '';

  Object.entries(characters).forEach(([key, info]) => {
    const card = document.createElement('button');
    card.className = 'character-card';
    if (state.selected === key) card.classList.add('selected');

    card.innerHTML = `
      <div class="character-avatar">${info.emoji}</div>
      <h3>${info.name}</h3>
      <p>Speed ${info.speed}<br>Damage ${info.damage}<br>HP ${info.health}</p>
    `;

    card.addEventListener('click', () => {
      state.selected = key;
      createCharacterCards();
    });

    characterGridEl.appendChild(card);
  });
}

function resetGame() {
  const config = characters[state.selected];
  state.player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 18,
    hp: config.health,
    maxHp: config.health,
    speed: config.speed,
    fireRate: config.fireRate,
    damage: config.damage,
    color: '#7ae582',
    facing: { x: 1, y: 0 },
    cooldown: 0,
    invuln: 0,
  };

  state.enemies = [];
  state.bullets = [];
  state.pickups = [];
  state.particles = [];
  state.score = 0;
  state.wave = 1;
  state.time = 0;
  state.spawnTimer = 0;
  state.gameOver = false;

  scoreEl.textContent = '0';
  waveEl.textContent = '1';
  healthFillEl.style.width = '100%';
}

function startMatch() {
  resetGame();
  menuEl.classList.add('hidden');
  gameOverEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  if (mobile) {
    joystickEl.classList.remove('hidden');
    fireBtn.classList.remove('hidden');
  }
  state.running = true;
}

function endMatch() {
  state.running = false;
  state.gameOver = true;
  finalScoreEl.textContent = `Score: ${state.score}`;
  gameOverEl.classList.remove('hidden');
  hudEl.classList.add('hidden');
  if (mobile) {
    joystickEl.classList.add('hidden');
    fireBtn.classList.add('hidden');
  }
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  if (side === 0) { x = Math.random() * canvas.width; y = -30; }
  if (side === 1) { x = canvas.width + 30; y = Math.random() * canvas.height; }
  if (side === 2) { x = Math.random() * canvas.width; y = canvas.height + 30; }
  if (side === 3) { x = -30; y = Math.random() * canvas.height; }

  const hp = 24 + state.wave * 8;
  state.enemies.push({
    x,
    y,
    radius: 16,
    hp,
    maxHp: hp,
    speed: 60 + state.wave * 12,
    damage: 7 + state.wave * 2,
    cooldown: 0.8 + Math.random() * 0.8,
    color: '#ff7a90',
  });
}

function shootBullet(from, target, damage, owner) {
  const angle = Math.atan2(target.y - from.y, target.x - from.x);
  const speed = owner === 'player' ? 420 : 260;
  state.bullets.push({
    x: from.x,
    y: from.y,
    radius: owner === 'player' ? 5 : 4,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage,
    life: 1.8,
    owner,
    color: owner === 'player' ? '#53d7ff' : '#ffd166',
  });
}

function maybeDropPickup(x, y) {
  if (Math.random() < 0.15) {
    state.pickups.push({
      x,
      y,
      radius: 10,
      type: Math.random() < 0.5 ? 'heal' : 'boost',
    });
  }
}

function handlePlayerInput(dt) {
  const player = state.player;
  if (!player) return;

  let moveX = 0;
  let moveY = 0;

  if (state.keys['w'] || state.keys['arrowup']) moveY -= 1;
  if (state.keys['s'] || state.keys['arrowdown']) moveY += 1;
  if (state.keys['a'] || state.keys['arrowleft']) moveX -= 1;
  if (state.keys['d'] || state.keys['arrowright']) moveX += 1;

  if (joystick.active) {
    moveX += joystick.dx;
    moveY += joystick.dy;
  }

  const length = Math.hypot(moveX, moveY) || 1;
  moveX /= length;
  moveY /= length;

  player.x += moveX * player.speed * dt;
  player.y += moveY * player.speed * dt;
  player.x = clamp(player.x, 20, canvas.width - 20);
  player.y = clamp(player.y, 20, canvas.height - 20);

  const aimX = state.pointerAim.x - player.x;
  const aimY = state.pointerAim.y - player.y;
  if (Math.hypot(aimX, aimY) > 0.1) {
    player.facing.x = aimX;
    player.facing.y = aimY;
  }

  if (player.cooldown > 0) player.cooldown -= dt;
  if (player.invuln > 0) player.invuln -= dt;

  const firePressed = state.mouseDown || fireBtn.dataset.pressed === 'true';
  if (firePressed && player.cooldown <= 0) {
    shootBullet(player, state.pointerAim, player.damage, 'player');
    player.cooldown = player.fireRate;
  }
}

function updateBullets(dt) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (
      bullet.x < -20 || bullet.x > canvas.width + 20 ||
      bullet.y < -20 || bullet.y > canvas.height + 20 ||
      bullet.life <= 0
    ) {
      state.bullets.splice(i, 1);
      continue;
    }

    if (bullet.owner === 'player') {
      for (let j = state.enemies.length - 1; j >= 0; j--) {
        const enemy = state.enemies[j];
        if (distance(bullet, enemy) < bullet.radius + enemy.radius) {
          enemy.hp -= bullet.damage;
          state.bullets.splice(i, 1);
          if (enemy.hp <= 0) {
            maybeDropPickup(enemy.x, enemy.y);
            spawnParticles(enemy.x, enemy.y, 18, '#ff6b6b');
            state.enemies.splice(j, 1);
            state.score += 10;
          }
          break;
        }
      }
    } else {
      const player = state.player;
      if (distance(bullet, player) < bullet.radius + player.radius) {
        state.bullets.splice(i, 1);
        if (player.invuln <= 0) {
          player.hp -= bullet.damage;
          player.invuln = 0.6;
          spawnParticles(player.x, player.y, 12, '#ffffff');
          if (player.hp <= 0) {
            endMatch();
          }
        }
      }
    }
  }
}

function spawnParticles(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 120,
      vy: (Math.random() - 0.5) * 120,
      life: 0.35 + Math.random() * 0.4,
      color,
      radius: 2 + Math.random() * 3,
    });
  }
}

function updateEnemies(dt) {
  const player = state.player;

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;

    enemy.x += (dx / dist) * enemy.speed * dt;
    enemy.y += (dy / dist) * enemy.speed * dt;

    enemy.cooldown -= dt;
    if (enemy.cooldown <= 0 && dist < 260) {
      shootBullet(enemy, player, enemy.damage, 'enemy');
      enemy.cooldown = 1.2 + Math.random() * 0.7;
    }

    if (dist < enemy.radius + player.radius + 2) {
      player.hp -= enemy.damage * dt * 2.5;
      player.invuln = Math.max(player.invuln, 0.12);
      if (player.hp <= 0) {
        endMatch();
        return;
      }
    }
  }
}

function updatePickups(dt) {
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pickup = state.pickups[i];
    const dist = distance(pickup, state.player);

    if (dist < pickup.radius + state.player.radius + 2) {
      if (pickup.type === 'heal') {
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + 25);
      } else {
        state.player.damage += 2;
        state.player.fireRate = Math.max(0.12, state.player.fireRate - 0.02);
      }
      state.pickups.splice(i, 1);
      continue;
    }

    pickup.y += Math.sin((state.time + i) * 3) * 0.25;
  }
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

function updateWave(dt) {
  state.time += dt;
  state.spawnTimer -= dt;
  const targetWave = 1 + Math.floor(state.score / 80);
  if (targetWave > state.wave) {
    state.wave = targetWave;
    waveEl.textContent = String(state.wave);
  }

  if (state.spawnTimer <= 0 && state.running) {
    const spawnCount = Math.min(2 + state.wave, 6);
    for (let i = 0; i < spawnCount; i++) {
      spawnEnemy();
    }
    state.spawnTimer = Math.max(0.7, 2.2 - state.wave * 0.12);
  }
}

function drawArena() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#0c1730';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let x = 0; x < canvas.width; x += 40) {
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.fillStyle = (x + y) % 80 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.02)';
      ctx.fillRect(x, y, 40, 40);
    }
  }

  // Arena boundaries
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
}

function drawPlayer() {
  const player = state.player;
  if (!player) return;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(Math.atan2(player.facing.y, player.facing.x));

  ctx.fillStyle = '#7ae582';
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#d5f9d0';
  ctx.fillRect(8, -4, 20, 8);

  ctx.restore();
}

function drawEnemy(enemy) {
  ctx.fillStyle = enemy.color;
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
  ctx.fill();

  const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(enemy.x - 18, enemy.y - 28, 36, 6);
  ctx.fillStyle = '#7ae582';
  ctx.fillRect(enemy.x - 18, enemy.y - 28, 36 * hpRatio, 6);
}

function drawBullets() {
  for (const bullet of state.bullets) {
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPickups() {
  for (const pickup of state.pickups) {
    ctx.fillStyle = pickup.type === 'heal' ? '#80ffbf' : '#ffd166';
    ctx.beginPath();
    ctx.arc(pickup.x, pickup.y, pickup.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(pickup.type === 'heal' ? '+' : '⚡', pickup.x, pickup.y + 4);
  }
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life * 3);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHudDetails() {
  if (!state.player) return;

  scoreEl.textContent = String(state.score);
  waveEl.textContent = String(state.wave);
  const hpPercent = clamp((state.player.hp / state.player.maxHp) * 100, 0, 100);
  healthFillEl.style.width = `${hpPercent}%`;
}

function gameLoop(ts) {
  const dt = Math.min((ts - (state.lastTimestamp || ts)) / 1000 || 0.016, 0.035);
  state.lastTimestamp = ts;

  if (state.running) {
    handlePlayerInput(dt);
    updateWave(dt);
    updateBullets(dt);
    updateEnemies(dt);
    updatePickups(dt);
    updateParticles(dt);
    drawHudDetails();
  }

  drawArena();
  drawPickups();
  drawBullets();
  drawParticles();
  drawPlayer();
  state.enemies.forEach(drawEnemy);

  requestAnimationFrame(gameLoop);
}

function handlePointerMove(event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  state.pointerAim.x = x;
  state.pointerAim.y = y;
}

canvas.addEventListener('pointerdown', (event) => {
  if (state.running) {
    handlePointerMove(event);
    state.mouseDown = true;
  }
});

canvas.addEventListener('pointermove', handlePointerMove);
canvas.addEventListener('pointerup', () => {
  state.mouseDown = false;
});
canvas.addEventListener('pointerleave', () => {
  state.mouseDown = false;
});

window.addEventListener('keydown', (event) => {
  state.keys[event.key.toLowerCase()] = true;
});

window.addEventListener('keyup', (event) => {
  state.keys[event.key.toLowerCase()] = false;
});

startBtn.addEventListener('click', startMatch);
restartBtn.addEventListener('click', () => {
  menuEl.classList.remove('hidden');
  gameOverEl.classList.add('hidden');
  createCharacterCards();
});

function updateJoystickPosition(x, y) {
  const max = joystick.radius;
  const dist = Math.hypot(x, y);
  const scale = dist > max ? max / dist : 1;
  const offsetX = x * scale;
  const offsetY = y * scale;

  stickThumb.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  joystick.dx = offsetX / max;
  joystick.dy = offsetY / max;
}

function bindJoystick() {
  joystickEl.addEventListener('pointerdown', (event) => {
    const rect = joystickEl.getBoundingClientRect();
    joystick.active = true;
    joystick.baseX = rect.left + rect.width / 2;
    joystick.baseY = rect.top + rect.height / 2;
    const x = event.clientX - joystick.baseX;
    const y = event.clientY - joystick.baseY;
    updateJoystickPosition(x, y);
  });

  window.addEventListener('pointermove', (event) => {
    if (!joystick.active) return;
    const x = event.clientX - joystick.baseX;
    const y = event.clientY - joystick.baseY;
    updateJoystickPosition(x, y);
  });

  window.addEventListener('pointerup', () => {
    joystick.active = false;
    stickThumb.style.transform = 'translate(0px, 0px)';
    joystick.dx = 0;
    joystick.dy = 0;
  });
}

fireBtn.addEventListener('pointerdown', (event) => {
  fireBtn.dataset.pressed = 'true';
  if (state.running) {
    const rect = canvas.getBoundingClientRect();
    state.pointerAim.x = rect.width * 0.68;
    state.pointerAim.y = rect.height * 0.5;
  }
  event.preventDefault();
});

fireBtn.addEventListener('pointerup', () => {
  fireBtn.dataset.pressed = 'false';
});
fireBtn.addEventListener('pointerleave', () => {
  fireBtn.dataset.pressed = 'false';
});

createCharacterCards();
bindJoystick();
requestAnimationFrame(gameLoop);

window.addEventListener('resize', () => {
  const newMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
  if (newMobile && state.running) {
    joystickEl.classList.remove('hidden');
    fireBtn.classList.remove('hidden');
  } else if (!newMobile && state.running) {
    joystickEl.classList.add('hidden');
    fireBtn.classList.add('hidden');
  }
});

window.addEventListener('blur', () => {
  state.keys = {};
  fireBtn.dataset.pressed = 'false';
  state.mouseDown = false;
  joystick.active = false;
  stickThumb.style.transform = 'translate(0px, 0px)';
  joystick.dx = 0;
  joystick.dy = 0;
});

if (mobile) {
  joystickEl.classList.remove('hidden');
  fireBtn.classList.remove('hidden');
}
