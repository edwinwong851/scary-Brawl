const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const waveValue = document.getElementById("waveValue");
const healthValue = document.getElementById("healthValue");
const enemyValue = document.getElementById("enemyValue");
const superValue = document.getElementById("superValue");
const finalStats = document.getElementById("finalStats");

const selectScreen = document.getElementById("selectScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const joystick = document.getElementById("joystick");
const knob = document.getElementById("joystickKnob");
const attackBtn = document.getElementById("attackBtn");
const superBtn = document.getElementById("superBtn");

const keys = {};
const pointer = { x: 0, y: 0, down: false };
const joystickState = { active: false, x: 0, y: 0, pointerId: null };

let gameState = "menu";
let lastTime = 0;
let score = 0;
let wave = 1;

const characterData = {
  blaze: {
    name: "Blaze",
    color: "#f97316",
    speed: 320,
    health: 100,
    shotDamage: 18,
    superRadius: 180
  },
  nova: {
    name: "Nova",
    color: "#67e8f9",
    speed: 345,
    health: 95,
    shotDamage: 16,
    superRadius: 200
  },
  titan: {
    name: "Titan",
    color: "#a78bfa",
    speed: 260,
    health: 120,
    shotDamage: 22,
    superRadius: 170
  }
};

let selectedCharacter = "blaze";

const player = {
  x: 0,
  y: 0,
  radius: 22,
  speed: 280,
  health: 100,
  maxHealth: 100,
  attackCooldown: 0,
  shotDelay: 0.25,
  facingX: 1,
  facingY: 0,
  superCharge: 0,
  superMax: 100
};

const enemies = [];
const bullets = [];
const particles = [];
const pickups = [];

function resizeCanvas() {
  const parent = canvas.parentElement;
  const rect = parent.getBoundingClientRect();
  canvas.width = Math.max(720, Math.min(window.innerWidth, 1280));
  canvas.height = Math.max(520, Math.min(window.innerHeight, 720));
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  pointer.x = player.x;
  pointer.y = player.y;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function normalize(x, y) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function getDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createParticles(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = rand(20, 90);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.7 + Math.random() * 0.5,
      color,
      size: rand(4, 9)
    });
  }
}

function applyCharacter() {
  const stats = characterData[selectedCharacter];
  player.speed = stats.speed;
  player.maxHealth = stats.health;
  player.health = stats.health;
  player.superRadius = stats.superRadius;
  player.shotDamage = stats.shotDamage;
  player.color = stats.color;
}

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  if (edge === 0) {
    x = rand(-50, canvas.width + 50);
    y = -50;
  } else if (edge === 1) {
    x = canvas.width + 50;
    y = rand(-50, canvas.height + 50);
  } else if (edge === 2) {
    x = rand(-50, canvas.width + 50);
    y = canvas.height + 50;
  } else {
    x = -50;
    y = rand(-50, canvas.height + 50);
  }

  const typeRoll = Math.random();
  let radius = 22;
  let speed = 120;
  let health = 38;
  let color = "#f87171";

  if (typeRoll < 0.5) {
    radius = 20;
    speed = 135;
    health = 35;
    color = "#f87171";
  } else if (typeRoll < 0.8) {
    radius = 24;
    speed = 100;
    health = 55;
    color = "#fb7185";
  } else {
    radius = 30;
    speed = 80;
    health = 70;
    color = "#a78bfa";
  }

  enemies.push({
    x,
    y,
    radius,
    speed,
    health,
    maxHealth: health,
    color,
    damage: 18,
    attackCooldown: 0
  });
}

function spawnWave() {
  const count = 3 + wave * 2;
  for (let i = 0; i < count; i++) {
    spawnEnemy();
  }
  updateHud();
}

function spawnPickup(x, y) {
  pickups.push({
    x,
    y,
    radius: 12,
    life: 8
  });
}

function createPlayerShot(dirX, dirY) {
  if (player.attackCooldown > 0) return;
  player.attackCooldown = player.shotDelay;
  const bulletSpeed = 600;

  bullets.push({
    x: player.x + dirX * (player.radius + 14),
    y: player.y + dirY * (player.radius + 14),
    vx: dirX * bulletSpeed,
    vy: dirY * bulletSpeed,
    radius: 8,
    damage: player.shotDamage,
    life: 1.2
  });
}

function useSuper() {
  if (player.superCharge < 100) return;

  player.superCharge = 0;
  const radius = player.superRadius;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy);

    if (dist < radius) {
      enemy.health -= 38;
      enemy.x += (dx / dist) * 22;
      enemy.y += (dy / dist) * 22;

      if (enemy.health <= 0) {
        score += 25;
        enemies.splice(i, 1);
        createParticles(enemy.x, enemy.y, "#facc15", 25);
        spawnPickup(enemy.x, enemy.y);
      }
    }
  }

  createParticles(player.x, player.y, "#67e8f9", 35);
}

function resetGame() {
  enemies.length = 0;
  bullets.length = 0;
  particles.length = 0;
  pickups.length = 0;
  score = 0;
  wave = 1;

  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  player.health = player.maxHealth;
  player.superCharge = 0;
  player.attackCooldown = 0;

  spawnWave();
  gameState = "playing";
  selectScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  updateHud();
}

function updateHud() {
  waveValue.textContent = wave;
  healthValue.textContent = Math.max(0, Math.ceil(player.health));
  enemyValue.textContent = enemies.length;
  superValue.textContent = `${Math.min(100, Math.round(player.superCharge))}%`;
}

function updatePlayer(dt) {
  const keyboardX =
    (keys["ArrowRight"] || keys["d"] ? 1 : 0) -
    (keys["ArrowLeft"] || keys["a"] ? 1 : 0);

  const keyboardY =
    (keys["ArrowDown"] || keys["s"] ? 1 : 0) -
    (keys["ArrowUp"] || keys["w"] ? 1 : 0);

  const moveX = keyboardX + joystickState.x;
  const moveY = keyboardY + joystickState.y;

  let dirX = 0;
  let dirY = 0;

  if (moveX !== 0 || moveY !== 0) {
    const dir = normalize(moveX, moveY);
    dirX = dir.x;
    dirY = dir.y;
    player.x += dir.x * player.speed * dt;
    player.y += dir.y * player.speed * dt;
    player.facingX = dir.x;
    player.facingY = dir.y;
  } else if (pointer.down || pointer.x !== player.x || pointer.y !== player.y) {
    const dx = pointer.x - player.x;
    const dy = pointer.y - player.y;
    if (Math.hypot(dx, dy) > 0.01) {
      const dir = normalize(dx, dy);
      player.facingX = dir.x;
      player.facingY = dir.y;
    }
  }

  player.x = clamp(player.x, player.radius, canvas.width - player.radius);
  player.y = clamp(player.y, player.radius, canvas.height - player.radius);

  const aimingX = pointer.x - player.x;
  const aimingY = pointer.y - player.y;

  if (keys[" "] || pointer.down || joystickState.active) {
    const fireDirX = aimingX || (dirX || player.facingX);
    const fireDirY = aimingY || (dirY || player.facingY);

    if (Math.hypot(fireDirX, fireDirY) > 0) {
      const fdX = fireDirX / Math.hypot(fireDirX, fireDirY);
      const fdY = fireDirY / Math.hypot(fireDirX, fireDirY);
      createPlayerShot(fdX, fdY);
    }
  }

  if (player.attackCooldown > 0) {
    player.attackCooldown -= dt;
  }

  if (player.superCharge < 100) {
    player.superCharge += dt * 12;
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      if (getDistance(bullet, enemy) <= bullet.radius + enemy.radius) {
        enemy.health -= bullet.damage;
        bullets.splice(i, 1);

        if (enemy.health <= 0) {
          score += 10;
          enemies.splice(j, 1);
          createParticles(enemy.x, enemy.y, "#4ade80", 25);
          spawnPickup(enemy.x, enemy.y);
        }

        break;
      }
    }

    if (bullet.life <= 0 || bullet.x < -30 || bullet.x > canvas.width + 30 || bullet.y < -30 || bullet.y > canvas.height + 30) {
      bullets.splice(i, 1);
    }
  }
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0) {
      const dir = normalize(dx, dy);
      enemy.x += dir.x * enemy.speed * dt;
      enemy.y += dir.y * enemy.speed * dt;
    }

    enemy.attackCooldown -= dt;

    if (dist < enemy.radius + player.radius + 4) {
      if (enemy.attackCooldown <= 0) {
        enemy.attackCooldown = 1.1;
        player.health -= enemy.damage;
        createParticles(player.x, player.y, "#f87171", 12);
      }
    }
  }
}

function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pickup = pickups[i];
    pickup.life -= dt;

    if (getDistance(pickup, player) <= pickup.radius + player.radius + 4) {
      pickup.life = 0;
      player.health = Math.min(player.maxHealth, player.health + 18);
      createParticles(player.x, player.y, "#4ade80", 18);
    }

    if (pickup.life <= 0) {
      pickups.splice(i, 1);
    }
  }
}

function updateWaveProgress() {
  if (enemies.length === 0) {
    wave += 1;
    spawnWave();
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;

    if (particle.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function endGame() {
  gameState = "gameover";
  gameOverScreen.classList.remove("hidden");
  finalStats.textContent = `You survived ${wave - 1} waves.`;
}

function update(dt) {
  if (gameState !== "playing") return;

  updatePlayer(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updatePickups(dt);
  updateWaveProgress();
  updateParticles(dt);

  if (player.health <= 0) {
    endGame();
  }

  updateHud();
}

function drawArena() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bgGradient.addColorStop(0, "#0b1120");
  bgGradient.addColorStop(0.5, "#1f2937");
  bgGradient.addColorStop(1, "#0b1120");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.width, x);
    ctx.stroke();
  }

  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(y, 0);
    ctx.lineTo(0, y, canvas.height);
    ctx.stroke();
  }
}

function drawPlayer() {
  const p = player;

  ctx.beginPath();
  ctx.fillStyle = p.color;
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = "#ffffff";
  ctx.arc(p.x + 12, p.y - 6, 4, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = "#dbeafe";
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + p.facingX * 26, p.y + p.facingY * 26);
  ctx.stroke();
}

function drawEnemy(enemy) {
  ctx.beginPath();
  ctx.fillStyle = enemy.color;
  ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.rect(enemy.x - enemy.radius, enemy.y - enemy.radius - 12, enemy.radius * 2, 6);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 12, (enemy.health / enemy.maxHealth) * enemy.radius * 2, 6);
}

function drawPickup(pickup) {
  ctx.beginPath();
  ctx.fillStyle = "#facc15";
  ctx.arc(pickup.x, pickup.y, pickup.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = "#ffffff";
  ctx.arc(pickup.x, pickup.y, pickup.radius * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawBullets() {
  for (const bullet of bullets) {
    ctx.beginPath();
    ctx.fillStyle = "#facc15";
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  for (const particle of particles) {
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = particle.life;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    ctx.globalAlpha = 1;
  }
}

function drawSuperBurst() {
  if (player.superCharge < 100) return;

  const radius = player.superRadius;
  ctx.beginPath();
  ctx.strokeStyle = "rgba(103, 232, 249, 0.8)";
  ctx.lineWidth = 3;
  ctx.arc(player.x, player.y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function render() {
  drawArena();
  for (const pickup of pickups) {
    drawPickup(pickup);
  }
  for (const bullet of bullets) {
    drawBullets();
  }
  for (const enemy of enemies) {
    drawEnemy(enemy);
  }
  drawPlayer();
  drawSuperBurst();

  if (gameState === "gameover") {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function setupJoystick() {
  const maxDistance = 52;

  function updateJoystick(clientX, clientY) {
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);
    const limited = distance > maxDistance ? maxDistance / distance : 1;
    const x = dx * limited;
    const y = dy * limited;
    const normalizedX = Math.abs(x) > 0.08 ? x / maxDistance : 0;
    const normalizedY = Math.abs(y) > 0.08 ? y / maxDistance : 0;

    joystickState.x = normalizedX;
    joystickState.y = normalizedY;

    knob.style.left = `${50 + x * 1.2}px`;
    knob.style.top = `${50 + y * 1.2}px`;
  }

  joystick.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    joystickState.active = true;
    joystickState.pointerId = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    updateJoystick(event.clientX, event.clientY);
  });

  joystick.addEventListener("pointermove", (event) => {
    if (event.pointerId === joystickState.pointerId) {
      updateJoystick(event.clientX, event.clientY);
    }
  });

  joystick.addEventListener("pointerup", () => {
    joystickState.active = false;
    joystickState.pointerId = null;
    joystickState.x = 0;
    joystickState.y = 0;
    knob.style.left = "50%";
    knob.style.top = "50%";
  });

  joystick.addEventListener("pointercancel", () => {
    joystickState.active = false;
    joystickState.pointerId = false;
    joystickState.x = 0;
    joystickState.y = 0;
    knob.style.left = "50%";
    knob.style.top = "50%";
  });
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0.016, 0.033);
  lastTime = timestamp;

  if (gameState === "playing") {
    update(dt);
  }

  render();

  requestAnimationFrame(loop);
}

document.querySelectorAll(".character-card").forEach((button) => {
  button.addEventListener("click", () => {
    selectedCharacter = button.dataset.character;
    document.querySelectorAll(".character-card").forEach((card) => {
      card.classList.toggle("selected", card === button);
    });
  });
});

startBtn.addEventListener("click", () => {
  applyCharacter();
  resetGame();
});

restartBtn.addEventListener("click", () => {
  applyCharacter();
  resetGame();
});

document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    keys[" "] = true;
  } else {
    keys[event.key] = true;
  }
});

document.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    keys[" "] = false;
  } else {
    keys[event.key] = false;
  }
});

document.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = event.clientX - rect.left;
  pointer.y = event.clientY - rect.top;
});

document.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = event.clientX - rect.left;
  pointer.y = event.clientY - rect.top;
  pointer.down = true;
  if (gameState === "playing") {
    const dx = pointer.x - player.x;
    const dy = pointer.y - player.y;
    if (Math.hypot(dx, dy) > 0) {
      const dir = normalize(dx, dy);
      player.facingX = dir.x;
      player.facingY = dir.y;
    }
  }
});

document.addEventListener("pointerup", () => {
  pointer.down = false;
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Shift") {
    event.preventDefault();
    useSuper();
  }
});

attackBtn.addEventListener("click", () => {
  if (gameState === "playing") {
    pointer.down = true;
    pointer.x = player.x + 1000;
    pointer.y = player.y + 1000;
  }
});

superBtn.addEventListener("click", () => {
  if (gameState === "playing") {
    useSuper();
  }
});

setupJoystick();

applyCharacter();
resetGame();
requestAnimationFrame(loop);
function firePlayerShot() {
  if (player.shootCooldown > 0) return;

  const shotSpeed = 9;
  const angle = player.facing;

  bullets.push({
    x: player.x + Math.cos(angle) * 28,
    y: player.y + Math.sin(angle) * 28,
    vx: Math.cos(angle) * shotSpeed,
    vy: Math.sin(angle) * shotSpeed,
    radius: 6,
    damage: 12,
    from: "player"
  });

  player.shootCooldown = 1.28; // about 180ms between shots
}

function useSuper() {
  if (player.superCooldown > 0) return;

  // create a wider or stronger projectile burst
  for (let i = -2; i <= 2; i++) {
    const angle = player.facing + i * 0.22;
    bullets.push({
      x: player.x + Math.cos(angle) * 28,
      y: player.y + Math.sin(angle) * 28,
      vx: Math.cos(angle) * 11,
      vy: Math.sin(angle) * 11,
      radius: 8,
      damage: 28,
      from: "player"
    });
  }

  player.superCooldown = 2.2;
}
