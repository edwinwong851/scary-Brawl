const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const healthValue = document.getElementById("healthValue");
const enemyValue = document.getElementById("enemyValue");
const superValue = document.getElementById("superValue");
const finalStats = document.getElementById("finalStats");

const selectScreen = document.getElementById("selectScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const moveStick = document.getElementById("moveStick");
const moveKnob = document.getElementById("moveStickKnob");
const attackStick = document.getElementById("attackStick");
const attackKnob = document.getElementById("attackStickKnob");
const superTapBtn = document.getElementById("superTapBtn");

const keys = {};
const pointer = { x: 0, y: 0, down: false };
const moveStickState = { active: false, x: 0, y: 0, pointerId: null };
const attackStickState = { active: false, x: 0, y: 0, pointerId: null };

let gameState = "menu";
let lastTime = 0;

const mapBounds = {
  x: 60,
  y: 60,
  width: 1160,
  height: 600
};

const obstacles = [
  { x: 390, y: 150, w: 170, h: 80 },
  { x: 700, y: 150, w: 170, h: 80 },
  { x: 420, y: 460, w: 180, h: 80 },
  { x: 700, y: 460, w: 180, h: 80 },
  { x: 560, y: 255, w: 160, h: 170 }
];

const characterData = {
  blaze: {
    name: "Blaze",
    color: "#f97316",
    speed: 320,
    health: 100,
    shotDamage: 18,
    superDamage: 60,
    superRadius: 0
  },
  nova: {
    name: "Nova",
    color: "#67e8f9",
    speed: 345,
    health: 95,
    shotDamage: 16,
    superDamage: 55,
    superRadius: 0
  },
  titan: {
    name: "Titan",
    color: "#a78bfa",
    speed: 260,
    health: 120,
    shotDamage: 22,
    superDamage: 75,
    superRadius: 0
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
  shotDelay: 0.22,
  facingX: 1,
  facingY: 0,
  superCharge: 0,
  superDamage: 60,
  shotDamage: 18,
  color: "#f97316"
};

let enemy = null;
const projectiles = [];
const particles = [];

function resizeCanvas() {
  const parent = canvas.parentElement;
  const rect = parent.getBoundingClientRect();
  canvas.width = Math.max(720, Math.min(window.innerWidth, 1280));
  canvas.height = Math.max(520, Math.min(window.innerHeight, 720));
  player.x = clamp(player.x || canvas.width / 2, mapBounds.x + 30, mapBounds.x + mapBounds.width - 30);
  player.y = clamp(player.y || canvas.height / 2, mapBounds.y + 30, mapBounds.y + mapBounds.height - 30);
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

function circleIntersectsRect(cx, cy, r, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= r * r;
}

function wallHit(x, y, radius) {
  if (x - radius < mapBounds.x || x + radius > mapBounds.x + mapBounds.width || y - radius < mapBounds.y || y + radius > mapBounds.y + mapBounds.height) {
    return true;
  }

  for (const obstacle of obstacles) {
    if (circleIntersectsRect(x, y, radius, obstacle)) return true;
  }
  return false;
}

function isBlocked(x, y, radius) {
  return wallHit(x, y, radius);
}

function moveEntity(entity, dx, dy, dt, speed) {
  const stepX = dx * speed * dt;
  const stepY = dy * speed * dt;

  const nextX = clamp(entity.x + stepX, mapBounds.x + entity.radius, mapBounds.x + mapBounds.width - entity.radius);
  if (!isBlocked(nextX, entity.y, entity.radius)) entity.x = nextX;

  const nextY = clamp(entity.y + stepY, mapBounds.y + entity.radius, mapBounds.y + mapBounds.height - entity.radius);
  if (!isBlocked(entity.x, nextY, entity.radius)) entity.y = nextY;
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
  player.shotDamage = stats.shotDamage;
  player.superDamage = stats.superDamage;
  player.color = stats.color;
}

function spawnEnemy() {
  enemy = {
    x: mapBounds.x + mapBounds.width - 120,
    y: mapBounds.y + mapBounds.height / 2,
    radius: 24,
    health: 150,
    maxHealth: 150,
    speed: 165,
    color: "#fb7185",
    damage: 12,
    fireCooldown: 0.7,
    facingX: -1,
    facingY: 0
  };
}

function createProjectile(owner, x, y, dirX, dirY, speed, damage, color, radius = 7, life = 1.8, burst = false) {
  projectiles.push({
    owner,
    x,
    y,
    vx: dirX * speed,
    vy: dirY * speed,
    radius,
    damage,
    color,
    life,
    burst
  });
}

function resetGame() {
  projectiles.length = 0;
  particles.length = 0;

  player.x = mapBounds.x + 120;
  player.y = mapBounds.y + mapBounds.height / 2;
  player.health = player.maxHealth;
  player.superCharge = 0;
  player.attackCooldown = 0;

  spawnEnemy();
  gameState = "playing";

  selectScreen.classList.add("hidden");
  selectScreen.style.display = "none";

  gameOverScreen.classList.add("hidden");
  gameOverScreen.style.display = "none";

  updateHud();
}

function updateHud() {
  healthValue.textContent = Math.max(0, Math.ceil(player.health));
  enemyValue.textContent = enemy ? Math.max(0, enemy.health) : 0;
  superValue.textContent = `${Math.min(100, Math.round(player.superCharge))}%`;
}

function useSuper() {
  if (player.superCharge < 100 || gameState !== "playing") return;
  player.superCharge = 0;

  const dirX = player.facingX || 1;
  const dirY = player.facingY || 0;
  const launchX = player.x + dirX * 32;
  const launchY = player.y + dirY * 32;

  createProjectile(
    "player",
    launchX,
    launchY,
    dirX,
    dirY,
    820,
    player.superDamage,
    "#c084fc",
    11,
    0.9,
    true
  );

  createParticles(player.x, player.y, "#c084fc", 18);
  updateHud();
}

function updatePlayer(dt) {
  const keyboardX =
    (keys["ArrowRight"] || keys["d"] ? 1 : 0) -
    (keys["ArrowLeft"] || keys["a"] ? 1 : 0);

  const keyboardY =
    (keys["ArrowDown"] || keys["s"] ? 1 : 0) -
    (keys["ArrowUp"] || keys["w"] ? 1 : 0);

  const moveX = keyboardX + moveStickState.x;
  const moveY = keyboardY + moveStickState.y;

  if (moveX !== 0 || moveY !== 0) {
    const dir = normalize(moveX, moveY);
    player.facingX = dir.x;
    player.facingY = dir.y;
    moveEntity(player, dir.x, dir.y, dt, player.speed);
  }

  const aimX = attackStickState.x;
  const aimY = attackStickState.y;

  if (Math.abs(aimX) > 0.08 || Math.abs(aimY) > 0.08) {
    const length = Math.hypot(aimX, aimY) || 1;
    player.facingX = aimX / length;
    player.facingY = aimY / length;

    if (player.attackCooldown <= 0) {
      player.attackCooldown = player.shotDelay;
      const shotX = player.x + player.facingX * 30;
      const shotY = player.y + player.facingY * 30;
      createProjectile("player", shotX, shotY, player.facingX, player.facingY, 620, player.shotDamage, "#facc15");
    }
  }

  if (keys[" "] || pointer.down) {
    const dx = pointer.x - player.x;
    const dy = pointer.y - player.y;
    if (Math.hypot(dx, dy) > 0) {
      const dir = normalize(dx, dy);
      player.facingX = dir.x;
      player.facingY = dir.y;
      if (player.attackCooldown <= 0) {
        player.attackCooldown = player.shotDelay;
        createProjectile("player", player.x + dir.x * 30, player.y + dir.y * 30, dir.x, dir.y, 620, player.shotDamage, "#facc15");
      }
    }
  }

  if (player.attackCooldown > 0) player.attackCooldown -= dt;
  if (player.superCharge < 100) player.superCharge += dt * 12;
}

function updateEnemyAI(dt) {
  if (!enemy) return;

  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;

  enemy.facingX = dx / dist;
  enemy.facingY = dy / dist;

  if (dist > 120) {
    moveEntity(enemy, enemy.facingX, enemy.facingY, dt, enemy.speed);
  }

  enemy.fireCooldown -= dt;

  if (dist < 420 && enemy.fireCooldown <= 0) {
    enemy.fireCooldown = 1.1;
    createProjectile("enemy", enemy.x + enemy.facingX * 30, enemy.y + enemy.facingY * 30, enemy.facingX, enemy.facingY, 420, enemy.damage, "#fb7185");
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const shot = projectiles[i];
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;

    if (wallHit(shot.x, shot.y, shot.radius)) {
      createParticles(shot.x, shot.y, shot.color, 8);
      projectiles.splice(i, 1);
      continue;
    }

    if (shot.owner === "player") {
      const hitEnemy = Math.hypot(shot.x - enemy.x, shot.y - enemy.y) <= shot.radius + enemy.radius;
      if (hitEnemy) {
        enemy.health -= shot.damage;
        projectiles.splice(i, 1);
        createParticles(shot.x, shot.y, "#facc15", 10);
        if (enemy.health <= 0) endGame(true);
        continue;
      }
    } else {
      const hitPlayer = Math.hypot(shot.x - player.x, shot.y - player.y) <= shot.radius + player.radius;
      if (hitPlayer) {
        player.health -= shot.damage;
        projectiles.splice(i, 1);
        createParticles(shot.x, shot.y, "#f87171", 10);
        if (player.health <= 0) endGame(false);
        continue;
      }
    }

    if (shot.life <= 0) {
      projectiles.splice(i, 1);
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
    if (particle.life <= 0) particles.splice(i, 1);
  }
}

function endGame(won) {
  if (gameState !== "playing") return;

  gameState = "gameover";
  gameOverScreen.classList.remove("hidden");
  gameOverScreen.style.display = "flex";

  finalStats.textContent = won ? "You won the arena!" : "Enemy wins this round.";
  updateHud();
}

function update(dt) {
  if (gameState !== "playing") return;

  updatePlayer(dt);
  updateEnemyAI(dt);
  updateProjectiles(dt);
  updateParticles(dt);

  if (player.health <= 0) endGame(false);
  if (enemy && enemy.health <= 0) endGame(true);

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
    ctx.moveTo(0, y);
    ctx.lineTo(0, y, canvas.height);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(148,163,184,0.5)";
  ctx.lineWidth = 4;
  ctx.strokeRect(mapBounds.x, mapBounds.y, mapBounds.width, mapBounds.height);

  for (const obstacle of obstacles) {
    ctx.fillStyle = "rgba(96,165,250,0.18)";
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
    ctx.strokeStyle = "rgba(103,232,249,0.5)";
    ctx.strokeRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
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

function drawEnemy() {
  if (!enemy) return;

  ctx.beginPath();
  ctx.fillStyle = enemy.color;
  ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 14, enemy.radius * 2, 6);

  ctx.beginPath();
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 14, (enemy.health / enemy.maxHealth) * enemy.radius * 2, 6);
}

function drawProjectiles() {
  for (const shot of projectiles) {
    ctx.beginPath();
    ctx.fillStyle = shot.color;
    ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2);
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

  ctx.beginPath();
  ctx.strokeStyle = "rgba(103, 232, 249, 0.8)";
  ctx.lineWidth = 3;
  ctx.arc(player.x, player.y, 26, 0, Math.PI * 2);
  ctx.stroke();
}

function render() {
  drawArena();
  drawProjectiles();
  drawParticles();
  drawEnemy();
  drawPlayer();
  drawSuperBurst();

  if (gameState === "gameover") {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function setupJoystick(target, knobEl, state, maxDistance = 52) {
  function updateJoystick(clientX, clientY) {
    const rect = target.getBoundingClientRect();
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

    state.x = normalizedX;
    state.y = normalizedY;

    knobEl.style.left = `${50 + x * 1.2}px`;
    knobEl.style.top = `${50 + y * 1.2}px`;
  }

  target.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    state.active = true;
    state.pointerId = event.pointerId;
    target.setPointerCapture(event.pointerId);
    updateJoystick(event.clientX, event.clientY);
  });

  target.addEventListener("pointermove", (event) => {
    if (event.pointerId === state.pointerId) updateJoystick(event.clientX, event.clientY);
  });

  target.addEventListener("pointerup", () => {
    state.active = false;
    state.pointerId = null;
    state.x = 0;
    state.y = 0;
    knobEl.style.left = "50%";
    knobEl.style.top = "50%";
  });

  target.addEventListener("pointercancel", () => {
    state.active = false;
    state.pointerId = null;
    state.x = 0;
    state.y = 0;
    knobEl.style.left = "50%";
    knobEl.style.top = "50%";
  });
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0.016, 0.033);
  lastTime = timestamp;

  if (gameState === "playing") update(dt);
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

superTapBtn.addEventListener("click", () => {
  if (gameState === "playing") {
    useSuper();
  }
});

setupJoystick(moveStick, moveKnob, moveStickState, 52);
setupJoystick(attackStick, attackKnob, attackStickState, 58);

applyCharacter();
render();
requestAnimationFrame(loop);
