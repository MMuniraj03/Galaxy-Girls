(() => {
  "use strict";

  /* ==========================================================
     GALAXY GIRLS — GAME CONFIGURATION
     ========================================================== */

  const CONFIG = {
    heroine: {
      maxHealth: 350,          // Heroine health = 350%
      startingLives: 5,
      enemyContactDamage: 50,  // Every normal enemy = 50 damage
      bossContactDamage: 100,  // Every boss = 100 damage
      bossShotDamage: 150      // Boss projectile = 150 damage
    },

    guns: {
      1: { damage: 50,  image: "Gun 1.png", fireEffect: "Gun 1 bullet firing effect.png", hitEffect: "Gun 1 enemy hit effect.png" },
      2: { damage: 75,  image: "Gun 2.png", fireEffect: "Gun 2 bullet firing effect.png", hitEffect: "Gun 2 enemy hit effect.png" },
      3: { damage: 100, image: "Gun 3.png", fireEffect: "Gun 3 bullet firing effect.png", hitEffect: "Gun 3 enemy hit effect.png" },
      4: { damage: 125, image: "Gun 4.png", fireEffect: "Gun 4 bullet firing effect.png", hitEffect: "Gun 4 enemy hit effect.png" }
    },

    enemies: {
      1: { hp: 100, speed: 78, image: "Enemy level 1.png", score: 100 },
      2: { hp: 150, speed: 68, image: "Enemy level 2.png", score: 150 },
      3: { hp: 200, speed: 58, image: "Enemy level 3.png", score: 200 }
    },

    bosses: {
      1: { hp: 5000, image: "Boss level 1.png", score: 1000 },
      2: { hp: 10000, image: "Boss level 2.png", score: 2000 },
      3: { hp: 20000, image: "Boss level 3.png", score: 4000 }
    },

    progression: {
      bossKillThresholds: {
        1: 100,
        2: 500,
        3: 1000
      }
    },

    loot: {
      healthPercent: 0.30,     // +30% of max health = +105 HP
      healthImage: "+30% health increase loot.png",
      gunImage: "+1 level Gun loot.png",
      lifeImage: "+1 life loot.png",
      /* One guaranteed loot drop every 5 defeated enemies. */
      dropEveryKills: 5,
      gunUpgradeChance: 0.34,
      lifeChance: 0.33
    },

    timing: {
      enemySpawn: 1.35,
      bossWarning: 1.6,
      bossShotInterval: 2.6,
      bossShotSpeed: 360,
      bulletSpeed: 900
    }
  };

  /* ==========================================================
     DOM
     ========================================================== */

  const game = document.getElementById("game");
  const entities = document.getElementById("entities");
  const player = document.getElementById("player");
  const heroineSprite = document.getElementById("heroineSprite");
  const weaponHud = document.getElementById("weaponHud");

  const healthText = document.getElementById("healthText");
  const healthFill = document.getElementById("healthFill");
  const bossText = document.getElementById("bossText");
  const progressFill = document.getElementById("progressFill");
  const scoreText = document.getElementById("score");
  const killsText = document.getElementById("kills");
  const gunText = document.getElementById("gunText");
  const message = document.getElementById("message");
  const bossWarning = document.getElementById("bossWarning");

  const startScreen = document.getElementById("startScreen");
  const gameOverScreen = document.getElementById("gameOver");
  const victoryScreen = document.getElementById("victory");

  const finalStats = document.getElementById("finalStats");
  const victoryStats = document.getElementById("victoryStats");

  /* ==========================================================
     STATE
     ========================================================== */

  const state = {
    running: false,
    ended: false,
    victory: false,

    health: CONFIG.heroine.maxHealth,
    lives: CONFIG.heroine.startingLives,
    score: 0,
    kills: 0,
    gunLevel: 1,

    playerX: 70,
    playerY: 0,
    velocityY: 0,
    jumpsRemaining: 2,
    facing: "right",

    moveLeft: false,
    moveRight: false,

    enemies: [],
    bullets: [],
    bossBullets: [],
    loots: [],

    enemySpawnTimer: 0,
    bossShotTimer: 0,

    bossLevel: 0,
    boss: null,
    bossSpawning: false,
    bossWarningTimer: null,

    firingUntil: 0,
    messageTimer: null
  };

  let lastTime = 0;
  let soundEnabled = localStorage.getItem("galaxyGirlsSound") !== "off";
  const sounds = {
    firing: new Audio("audio/firing.wav"),
    enemyDeath: new Audio("audio/enemy-death.wav"),
    bossDeath: new Audio("audio/boss-death.wav"),
    jump: new Audio("audio/jump.wav"),
    background: new Audio("audio/background.wav")
  };
  sounds.background.loop = true;
  sounds.background.preload = "auto";
  Object.values(sounds).forEach(a => { a.preload = "auto"; a.playsInline = true; });
  sounds.background.volume = 0.10;

  function safePlay(name, volume = 1) {
    if (!soundEnabled) return;
    const src = sounds[name];
    if (!src) return;
    try {
      const a = src.cloneNode(true);
      a.volume = Math.max(0, Math.min(1, volume));
      a.play().catch(() => {});
    } catch (_) {}
  }

  function initAudio() {
    if (!soundEnabled) return;
    try {
      const p = sounds.background.play();
      if (p && p.catch) p.catch(() => {});
    } catch (_) {}
  }

  function stopAmbientSound() {
    try { sounds.background.pause(); sounds.background.currentTime = 0; } catch (_) {}
  }

  function playShootSound() { safePlay("firing", .9); }
  function playJumpSound() { safePlay("jump", .8); }
  function playHitSound() { safePlay("firing", .18); }
  function playEnemyDeathSound() { safePlay("enemyDeath", .9); }
  function playBossDeathSound() { safePlay("bossDeath", 1); }
  function playBossSpawnSound() { safePlay("bossDeath", .25); }

  function updateSoundButton() {
    const button = document.getElementById("soundToggle");
    if (!button) return;
    button.textContent = soundEnabled ? "🔊" : "🔇";
    button.classList.toggle("off", !soundEnabled);
    button.setAttribute("aria-pressed", String(soundEnabled));
    button.setAttribute("aria-label", soundEnabled ? "Turn sound off" : "Turn sound on");
    button.title = soundEnabled ? "Sound ON" : "Sound OFF";
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem("galaxyGirlsSound", soundEnabled ? "on" : "off");
    updateSoundButton();
    if (soundEnabled) {
      initAudio();
      safePlay("jump", .45);
    } else {
      stopAmbientSound();
    }
  }

  /* ==========================================================
     HELPERS
     ========================================================== */

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  function getPlayerRect() {
    return {
      x: state.playerX + 16,
      y: state.playerY + 20,
      width: Math.max(20, player.offsetWidth - 32),
      height: Math.max(25, player.offsetHeight - 30)
    };
  }

  function getElementRect(x, y, el) {
    return {
      x,
      y,
      width: el.offsetWidth,
      height: el.offsetHeight
    };
  }

  function setMessage(text, duration = 1500) {
    message.textContent = text;
    message.classList.add("show");

    clearTimeout(state.messageTimer);
    state.messageTimer = setTimeout(() => {
      message.classList.remove("show");
    }, duration);
  }

  function assetUrl(src) {
    // Encode special filename characters such as + and % so GitHub Pages
    // serves the health-loot asset instead of showing a broken-image ?.
    return "./" + encodeURIComponent(src);
  }

  function createImage(src, className = "") {
    const img = document.createElement("img");
    img.src = assetUrl(src);
    img.alt = "";
    img.className = className;
    return img;
  }

  function spawnEffect(x, y, className, image, duration = 350) {
    const effect = document.createElement("div");
    effect.className = `effect ${className}`;
    effect.style.left = `${x}px`;
    effect.style.top = `${y}px`;
    effect.style.backgroundImage = `url("${image}")`;
    entities.appendChild(effect);

    setTimeout(() => effect.remove(), duration);
    return effect;
  }

  function removeObject(obj) {
    if (obj?.el?.parentNode) obj.el.remove();
  }

  /* ==========================================================
     UI
     ========================================================== */

  function updateUI() {
    healthText.textContent =
      `${"❤️".repeat(state.lives)} HEALTH ${Math.ceil(state.health)}/${CONFIG.heroine.maxHealth}`;

    healthFill.style.width =
      `${(state.health / CONFIG.heroine.maxHealth) * 100}%`;

    scoreText.textContent = `SCORE: ${state.score}`;
    killsText.textContent = `KILLS: ${state.kills}`;

    const gun = CONFIG.guns[state.gunLevel];
    gunText.textContent = `GUN ${state.gunLevel} • DAMAGE ${gun.damage}`;

    if (state.bossLevel >= 3 && state.boss) {
      bossText.textContent = "BOSS 3: FINAL FIGHT";
      progressFill.style.width = "100%";
      return;
    }

    const nextBoss = Math.min(state.bossLevel + 1, 3);
    const threshold = CONFIG.progression.bossKillThresholds[nextBoss];

    if (state.boss) {
      bossText.textContent = `BOSS ${state.bossLevel}: ${Math.ceil(state.boss.hp)}/${state.boss.maxHp}`;
      progressFill.style.width =
        `${(1 - state.boss.hp / state.boss.maxHp) * 100}%`;
    } else if (state.bossSpawning) {
      bossText.textContent = `BOSS ${nextBoss}: INCOMING`;
      progressFill.style.width = "100%";
    } else {
      bossText.textContent = `BOSS ${nextBoss}: ${state.kills}/${threshold} KILLS`;
      progressFill.style.width =
        `${clamp((state.kills / threshold) * 100, 0, 100)}%`;
    }
  }

  /* ==========================================================
     PLAYER
     ========================================================== */

  function updatePlayerSprite() {
    const now = performance.now();

    let image = "Heroine standing effect.png";

    if (state.velocityY < -30) {
      image = "Heroine jumping effect.png";
    } else if (Math.abs(state.velocityY) > 30) {
      image = "Heroine jumping effect.png";
    } else if (state.firingUntil > now) {
      image = "Heroine firing effect.png";
    } else if (state.moveLeft || state.moveRight) {
      image = "Heroine running effect.png";
    }

    if (!heroineSprite.src.endsWith(image)) {
      heroineSprite.src = image;
    }

    player.style.transform =
      state.facing === "left" ? "scaleX(-1)" : "scaleX(1)";

    weaponHud.src = CONFIG.guns[state.gunLevel].image;
    weaponHud.alt = `Gun level ${state.gunLevel}`;
  }

  function groundY() {
    return game.clientHeight - 105 - player.offsetHeight;
  }

  function updatePlayer(dt) {
    const speed = 280;

    if (state.moveLeft) {
      state.playerX -= speed * dt;
      state.facing = "left";
    }

    if (state.moveRight) {
      state.playerX += speed * dt;
      state.facing = "right";
    }

    state.playerX = clamp(
      state.playerX,
      0,
      game.clientWidth - player.offsetWidth
    );

    const ground = groundY();

    state.velocityY += 1250 * dt;
    state.playerY += state.velocityY * dt;

    if (state.playerY > ground) {
      state.playerY = ground;
      state.velocityY = 0;
      state.jumpsRemaining = 2;
    }

    player.style.left = `${state.playerX}px`;
    player.style.top = `${state.playerY}px`;

    updatePlayerSprite();
  }

  function jump() {
    if (!state.running || state.ended) return;

    // Double-jump: the heroine gets two jumps before touching the ground.
    if (state.jumpsRemaining > 0) {
      state.velocityY = -520;
      state.jumpsRemaining -= 1;
      playJumpSound();
    }
  }

  /* ==========================================================
     SHOOTING
     ========================================================== */

  function shoot() {
    if (!state.running || state.ended) return;

    initAudio();
    playShootSound();

    state.firingUntil = performance.now() + 140;

    const gun = CONFIG.guns[state.gunLevel];
    const playerRect = getPlayerRect();

    const direction = state.facing === "right" ? 1 : -1;
    const bulletX =
      direction === 1
        ? state.playerX + player.offsetWidth - 5
        : state.playerX - 20;

    /* Fire at the centre line of ground enemies so every shot has a
       reliable collision path on mobile and desktop. */
    const bulletY =
      state.playerY + player.offsetHeight * .48;

    const bullet = document.createElement("div");
    bullet.className = "bullet";
    bullet.style.left = `${bulletX}px`;
    bullet.style.top = `${bulletY}px`;

    entities.appendChild(bullet);

    state.bullets.push({
      el: bullet,
      x: bulletX,
      previousX: bulletX,
      y: bulletY,
      direction,
      damage: gun.damage
    });

    const muzzleX = direction === 1
      ? playerRect.x + playerRect.width - 5
      : playerRect.x - 30;

    const muzzle = spawnEffect(
      muzzleX,
      bulletY - 32,
      "muzzle",
      gun.fireEffect,
      110
    );

    if (direction === -1) muzzle.style.transform = "scaleX(-1)";
  }

  function damageEnemy(enemy, damage) {
    enemy.hp -= damage;
    playHitSound();

    const gun = CONFIG.guns[state.gunLevel];
    const hitX = enemy.x + enemy.el.offsetWidth * .5;
    const hitY = enemy.y + enemy.el.offsetHeight * .45;

    spawnEffect(hitX, hitY, "hit-effect", gun.hitEffect, 170);

    updateEntityHealth(enemy);

    if (enemy.hp <= 0) {
      killEnemy(enemy);
    }
  }

  function damageBoss(damage) {
    if (!state.boss) return;

    state.boss.hp -= damage;
    playHitSound();

    const gun = CONFIG.guns[state.gunLevel];
    spawnEffect(
      state.boss.x + state.boss.el.offsetWidth * .5,
      state.boss.y + state.boss.el.offsetHeight * .45,
      "hit-effect",
      gun.hitEffect,
      180
    );

    updateEntityHealth(state.boss);

    if (state.boss.hp <= 0) {
      defeatBoss();
    }
  }

  /* ==========================================================
     ENEMIES
     ========================================================== */

  function chooseEnemyLevel() {
    const roll = Math.random();

    if (roll < .42) return 1;
    if (roll < .75) return 2;
    return 3;
  }

  function createEnemy() {
    if (!state.running || state.ended || state.boss || state.bossSpawning) return;

    const level = chooseEnemyLevel();
    const config = CONFIG.enemies[level];

    const el = document.createElement("div");
    el.className = `enemy level-${level}`;
    el.style.left = `${game.clientWidth + 25}px`;

    // Normal enemies stay on the ground. They never track the heroine's
    // vertical position, so jumping does NOT make enemies jump.
    const y = clamp(
      groundY() + player.offsetHeight - el.offsetHeight,
      70,
      game.clientHeight - el.offsetHeight - 120
    );

    el.style.top = `${y}px`;

    const sprite = createImage(config.image, "entity-sprite");
    const label = document.createElement("div");
    label.className = "health-label";

    el.append(sprite, label);
    entities.appendChild(el);

    const enemy = {
      el,
      level,
      x: game.clientWidth + 25,
      y,
      hp: config.hp,
      maxHp: config.hp,
      speed: config.speed * (0.9 + Math.random() * .2),
      contactDamage: CONFIG.heroine.enemyContactDamage
    };

    state.enemies.push(enemy);
    updateEntityHealth(enemy);
  }

  function updateEntityHealth(entity) {
    const label = entity.el.querySelector(".health-label");
    if (!label) return;

    const ratio = clamp(entity.hp / entity.maxHp, 0, 1);

    label.innerHTML =
      `${Math.max(0, Math.ceil(entity.hp))}/${entity.maxHp}` +
      `<div class="enemy-health-bar"><div class="enemy-health-fill" style="width:${ratio * 100}%"></div></div>`;
  }

  function killEnemy(enemy) {
    const index = state.enemies.indexOf(enemy);
    if (index !== -1) state.enemies.splice(index, 1);

    playEnemyDeathSound();

    spawnEffect(enemy.x, enemy.y, "death-effect", "Enemy level 1.png", 400);

    removeObject(enemy);

    state.kills += 1;
    state.score += CONFIG.enemies[enemy.level].score;

    /* Guaranteed loot every 5 enemy kills. */
    if (state.kills % CONFIG.loot.dropEveryKills === 0) {
      createLootDrop(
        enemy.x + enemy.el.offsetWidth * .2,
        enemy.y + enemy.el.offsetHeight * .25
      );
    }

    checkBossProgress();
    updateUI();
  }

  /* ==========================================================
     BOSS
     ========================================================== */

  function checkBossProgress() {
    if (state.boss || state.bossSpawning || state.bossLevel >= 3) return;

    const nextBoss = state.bossLevel + 1;
    const threshold = CONFIG.progression.bossKillThresholds[nextBoss];

    if (state.kills >= threshold) {
      startBossSequence(nextBoss);
    }
  }

  function startBossSequence(level) {
    state.bossSpawning = true;
    bossWarning.style.display = "block";
    setMessage(`BOSS ${level} INCOMING — DEFEAT ALL THREATS`, 1600);
    updateUI();

    clearTimeout(state.bossWarningTimer);

    state.bossWarningTimer = setTimeout(() => {
      state.bossWarningTimer = null;

      if (!state.running || state.ended) {
        state.bossSpawning = false;
        bossWarning.style.display = "none";
        return;
      }

      state.enemies.forEach(removeObject);
      state.enemies.length = 0;

      spawnBoss(level);
    }, CONFIG.timing.bossWarning * 1000);
  }

  function spawnBoss(level) {
    const config = CONFIG.bosses[level];

    const el = document.createElement("div");
    el.className = "boss";

    const sprite = createImage(config.image, "entity-sprite");
    const label = document.createElement("div");
    label.className = "health-label";

    el.append(sprite, label);
    entities.appendChild(el);

    const x = game.clientWidth - el.offsetWidth - 20;
    const y = Math.max(95, game.clientHeight * .28);

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    state.bossLevel = level;
    state.bossSpawning = false;
    state.bossShotTimer = 0;

    state.boss = {
      el,
      x,
      y,
      hp: config.hp,
      maxHp: config.hp,
      level,
      score: config.score,
      speed: 30,
      verticalCenter: y,
      verticalTime: Math.random() * Math.PI * 2,
      verticalAmplitude: Math.max(45, Math.min(105, game.clientHeight * 0.18)),
      verticalSpeed: 1.5 + level * 0.15
    };

    bossWarning.style.display = "none";
    playBossSpawnSound();
    setMessage(`BOSS ${level} — HP ${config.hp}`, 1800);
    updateEntityHealth(state.boss);
    updateUI();
  }

  function updateBoss(dt) {
    const boss = state.boss;
    if (!boss) return;

    const targetX = game.clientWidth * .60;
    if (boss.x > targetX) {
      boss.x = Math.max(targetX, boss.x - boss.speed * dt);
    }

    /* Boss movement: all bosses continuously patrol up/down while fighting. */
    boss.verticalTime += dt * boss.verticalSpeed;
    const minBossY = 75;
    const maxBossY = Math.max(80, game.clientHeight - boss.el.offsetHeight - 115);
    const center = clamp(boss.verticalCenter, minBossY, maxBossY);
    const amplitude = Math.min(boss.verticalAmplitude, Math.max(0, (maxBossY - minBossY) / 2));
    boss.y = clamp(
      center + Math.sin(boss.verticalTime) * amplitude,
      minBossY,
      maxBossY
    );

    boss.el.style.left = `${boss.x}px`;
    boss.el.style.top = `${boss.y}px`;

    const playerRect = getPlayerRect();
    const bossRect = getElementRect(boss.x, boss.y, boss.el);

    if (rectsOverlap(playerRect, bossRect)) {
      damagePlayer(CONFIG.heroine.bossContactDamage);
    }

    /* Bosses shoot slowly; normal enemies never shoot. */
    state.bossShotTimer += dt;

    if (state.bossShotTimer >= CONFIG.timing.bossShotInterval) {
      state.bossShotTimer = 0;
      fireBossProjectile();
    }

    updateUI();
  }

  function fireBossProjectile() {
    const boss = state.boss;
    if (!boss) return;

    const direction = -1;

    const x = boss.x + 15;
    const y = boss.y + boss.el.offsetHeight * .52;

    const el = document.createElement("div");
    el.className = "boss-bullet";
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    entities.appendChild(el);

    state.bossBullets.push({
      el,
      x,
      y,
      direction,
      damage: CONFIG.heroine.bossShotDamage
    });
  }

  function defeatBoss() {
    const boss = state.boss;
    if (!boss) return;

    playBossDeathSound();

    spawnEffect(
      boss.x,
      boss.y,
      "death-effect",
      boss.level === 1 ? "Boss level 1.png" :
      boss.level === 2 ? "Boss level 2.png" :
      "Boss level 3.png",
      700
    );

    removeObject(boss);

    state.boss = null;
    state.score += boss.score;

    if (boss.level === 3) {
      winGame();
      return;
    }

    setMessage(
      `BOSS ${boss.level} DEFEATED — NEXT TARGET: BOSS ${boss.level + 1}`,
      2200
    );

    /* Keep the same cumulative kill count:
       Boss 2 triggers at 50 kills, Boss 3 at 100. */
    updateUI();
  }

  /* ==========================================================
     LOOT
     ========================================================== */

  function createLootDrop(x, y) {
    const roll = Math.random();
    let type;

    if (roll < CONFIG.loot.gunUpgradeChance && state.gunLevel < 4) {
      type = "gun";
    } else if (roll < CONFIG.loot.gunUpgradeChance + CONFIG.loot.lifeChance) {
      type = "life";
    } else {
      type = "health";
    }

    /* If the gun is already maxed, use a useful health/life reward. */
    if (type === "gun" && state.gunLevel >= 4) {
      type = Math.random() < 0.5 ? "health" : "life";
    }

    const images = {
      gun: CONFIG.loot.gunImage,
      life: CONFIG.loot.lifeImage,
      health: CONFIG.loot.healthImage
    };

    const el = createImage(images[type], "loot");
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    entities.appendChild(el);

    state.loots.push({
      el,
      x,
      y,
      type,
      vy: 20
    });

    const labels = {
      gun: "🔫 GUN UPGRADE DROP",
      life: "❤️ +1 LIFE DROP",
      health: "💚 +30% HEALTH DROP"
    };
    setMessage(labels[type], 1200);
  }

  function collectLoot(loot) {
    if (loot.type === "gun") {
      state.gunLevel = Math.min(4, state.gunLevel + 1);
      setMessage(`GUN UPGRADED → LEVEL ${state.gunLevel} • DAMAGE ${CONFIG.guns[state.gunLevel].damage}`, 1800);
    }

    if (loot.type === "life") {
      state.lives += 1;
      setMessage(`+1 LIFE ❤️ — ${state.lives} LIVES`, 1500);
    }

    if (loot.type === "health") {
      const amount = CONFIG.heroine.maxHealth * CONFIG.loot.healthPercent;
      state.health = Math.min(
        CONFIG.heroine.maxHealth,
        state.health + amount
      );
      setMessage(`+30% HEALTH ❤️ +${amount}`, 1500);
    }

    removeObject(loot);
    const index = state.loots.indexOf(loot);
    if (index !== -1) state.loots.splice(index, 1);

    updateUI();
  }

  function updateLoot(dt) {
    const playerRect = getPlayerRect();

    for (let i = state.loots.length - 1; i >= 0; i--) {
      const loot = state.loots[i];

      loot.y += loot.vy * dt;
      loot.vy += 40 * dt;

      const maxY = game.clientHeight - 160;
      if (loot.y > maxY) {
        loot.y = maxY;
        loot.vy = -20;
      }

      loot.el.style.left = `${loot.x}px`;
      loot.el.style.top = `${loot.y}px`;

      const lootRect = {
        x: loot.x,
        y: loot.y,
        width: loot.el.offsetWidth,
        height: loot.el.offsetHeight
      };

      if (rectsOverlap(playerRect, lootRect)) {
        collectLoot(loot);
      }
    }
  }

  /* ==========================================================
     BULLETS
     ========================================================== */

  function updateBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const bullet = state.bullets[i];

      bullet.previousX = bullet.x;
      bullet.x += bullet.direction * CONFIG.timing.bulletSpeed * dt;
      bullet.el.style.left = `${bullet.x}px`;

      /* Swept horizontal hitbox prevents fast bullets from skipping
         through enemies between animation frames. */
      const bulletLeft = Math.min(bullet.previousX, bullet.x);
      const bulletRight = Math.max(
        bullet.previousX + bullet.el.offsetWidth,
        bullet.x + bullet.el.offsetWidth
      );

      const bulletRect = {
        x: bulletLeft,
        y: bullet.y,
        width: bulletRight - bulletLeft,
        height: bullet.el.offsetHeight
      };

      let consumed = false;

      for (let j = state.enemies.length - 1; j >= 0; j--) {
        const enemy = state.enemies[j];

        if (rectsOverlap(
          bulletRect,
          getElementRect(enemy.x, enemy.y, enemy.el)
        )) {
          damageEnemy(enemy, bullet.damage);
          consumed = true;
          break;
        }
      }

      if (!consumed && state.boss) {
        if (rectsOverlap(
          bulletRect,
          getElementRect(state.boss.x, state.boss.y, state.boss.el)
        )) {
          damageBoss(bullet.damage);
          consumed = true;
        }
      }

      if (
        consumed ||
        bullet.x < -80 ||
        bullet.x > game.clientWidth + 80
      ) {
        removeObject(bullet);
        state.bullets.splice(i, 1);
      }
    }
  }

  function updateBossBullets(dt) {
    const playerRect = getPlayerRect();

    for (let i = state.bossBullets.length - 1; i >= 0; i--) {
      const bullet = state.bossBullets[i];

      bullet.x += bullet.direction * CONFIG.timing.bossShotSpeed * dt;
      bullet.el.style.left = `${bullet.x}px`;

      const rect = {
        x: bullet.x,
        y: bullet.y,
        width: bullet.el.offsetWidth,
        height: bullet.el.offsetHeight
      };

      if (rectsOverlap(playerRect, rect)) {
        damagePlayer(bullet.damage);
        removeObject(bullet);
        state.bossBullets.splice(i, 1);
        continue;
      }

      if (bullet.x < -80) {
        removeObject(bullet);
        state.bossBullets.splice(i, 1);
      }
    }
  }

  /* ==========================================================
     ENEMY UPDATE
     ========================================================== */

  function updateEnemies(dt) {
    const playerRect = getPlayerRect();

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const enemy = state.enemies[i];

      /* Enemies actively advance toward the heroine.  They stay in the
         playable area instead of reversing at the left edge. */
      const targetX = state.playerX + player.offsetWidth * 0.15;
      // Keep every normal enemy locked to the ground lane. Their Y position
      // is independent of the heroine, including during either jump.
      enemy.y = clamp(
        groundY() + player.offsetHeight - enemy.el.offsetHeight,
        70,
        game.clientHeight - enemy.el.offsetHeight - 120
      );
      enemy.el.style.top = `${enemy.y}px`;
      const dx = targetX - enemy.x;
      const direction = dx >= 0 ? 1 : -1;
      const step = enemy.speed * dt;

      if (Math.abs(dx) > 2) {
        enemy.x += direction * Math.min(Math.abs(dx), step);
      }

      enemy.el.style.left = `${enemy.x}px`;

      const enemyRect = getElementRect(enemy.x, enemy.y, enemy.el);

      if (rectsOverlap(playerRect, enemyRect)) {
        damagePlayer(enemy.contactDamage);
        removeObject(enemy);
        state.enemies.splice(i, 1);

        if (state.ended) return;
        continue;
      }

      /* Enemies are never allowed to simply disappear from the level.
         If one reaches the left boundary, it turns around toward the heroine. */
      if (enemy.x < -5) {
        enemy.x = 0;
        enemy.speed *= -1;
      } else if (enemy.x > game.clientWidth + 20) {
        enemy.x = game.clientWidth + 20;
        enemy.speed = Math.abs(enemy.speed);
      }
    }
  }

  /* ==========================================================
     PLAYER DAMAGE / LIVES
     ========================================================== */

  function damagePlayer(amount) {
    if (!state.running || state.ended) return;

    state.health -= amount;

    if (state.health > 0) {
      updateUI();
      return;
    }

    state.lives -= 1;

    if (state.lives <= 0) {
      state.health = 0;
      updateUI();
      endGame();
      return;
    }

    state.health = CONFIG.heroine.maxHealth;
    state.playerX = 70;
    state.playerY = groundY();
    state.velocityY = 0;

    setMessage(
      `LIFE LOST ❤️ — ${state.lives} LIVES REMAIN`,
      1800
    );

    updateUI();
  }

  /* ==========================================================
     RESET / END STATES
     ========================================================== */

  function clearEntities() {
    [
      ...state.enemies,
      ...state.bullets,
      ...state.bossBullets,
      ...state.loots
    ].forEach(removeObject);

    state.enemies.length = 0;
    state.bullets.length = 0;
    state.bossBullets.length = 0;
    state.loots.length = 0;

    if (state.boss) removeObject(state.boss);
    state.boss = null;

    entities.querySelectorAll(".effect").forEach(el => el.remove());

    clearTimeout(state.bossWarningTimer);
    state.bossWarningTimer = null;

    bossWarning.style.display = "none";
  }

  function resetState() {
    clearEntities();

    state.running = true;
    state.ended = false;
    state.victory = false;

    state.health = CONFIG.heroine.maxHealth;
    state.lives = CONFIG.heroine.startingLives;
    state.score = 0;
    state.kills = 0;
    state.gunLevel = 1;

    state.playerX = 70;
    state.playerY = groundY();
    state.velocityY = 0;
    state.jumpsRemaining = 2;
    state.facing = "right";

    state.moveLeft = false;
    state.moveRight = false;

    state.enemySpawnTimer = 0;
    state.bossShotTimer = 0;

    state.bossLevel = 0;
    state.bossSpawning = false;
    state.firingUntil = 0;

    player.style.left = `${state.playerX}px`;
    player.style.top = `${state.playerY}px`;

    startScreen.classList.add("hidden");
    gameOverScreen.classList.add("hidden");
    victoryScreen.classList.add("hidden");

    updatePlayerSprite();
    updateUI();
  }

  function endGame() {
    if (state.ended) return;

    state.ended = true;
    state.running = false;
    state.moveLeft = false;
    state.moveRight = false;

    clearTimeout(state.bossWarningTimer);
    state.bossWarningTimer = null;
    bossWarning.style.display = "none";

    finalStats.textContent =
      `Score: ${state.score} • Enemies defeated: ${state.kills} • Gun: Level ${state.gunLevel}`;

    gameOverScreen.classList.remove("hidden");
    clearEntities();
  }

  function winGame() {
    state.ended = true;
    state.running = false;

    victoryStats.textContent =
      `Score: ${state.score} • Enemies defeated: ${state.kills} • Gun: Level ${state.gunLevel}`;

    victoryScreen.classList.remove("hidden");
    clearEntities();
  }

  /* ==========================================================
     MAIN LOOP
     ========================================================== */

  function update(dt) {
    if (!state.running || state.ended) return;

    updatePlayer(dt);
    updateBullets(dt);
    updateBossBullets(dt);
    updateEnemies(dt);
    updateLoot(dt);
    updateBoss(dt);

    if (!state.boss && !state.bossSpawning) {
      state.enemySpawnTimer += dt;

      if (state.enemySpawnTimer >= CONFIG.timing.enemySpawn) {
        state.enemySpawnTimer = 0;
        createEnemy();
      }

      checkBossProgress();
    }
  }

  function loop(time) {
    if (!lastTime) lastTime = time;

    const dt = Math.min((time - lastTime) / 1000, .033);
    lastTime = time;

    update(dt);
    requestAnimationFrame(loop);
  }

  /* ==========================================================
     INPUT
     ========================================================== */

  function bindHold(button, onDown, onUp) {
    const down = event => {
      event.preventDefault();
      initAudio();
      onDown();
    };

    const up = event => {
      event.preventDefault();
      onUp();
    };

    button.addEventListener("pointerdown", down);
    button.addEventListener("pointerup", up);
    button.addEventListener("pointercancel", up);
    button.addEventListener("pointerleave", up);
  }

  bindHold(
    document.getElementById("leftBtn"),
    () => state.moveLeft = true,
    () => state.moveLeft = false
  );

  bindHold(
    document.getElementById("rightBtn"),
    () => state.moveRight = true,
    () => state.moveRight = false
  );

  document.getElementById("jumpBtn").addEventListener("pointerdown", e => {
    e.preventDefault();
    jump();
  });

  document.getElementById("shootBtn").addEventListener("pointerdown", e => {
    e.preventDefault();
    shoot();
  });

  document.getElementById("soundToggle").addEventListener("pointerdown", e => {
    e.preventDefault();
    toggleSound();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
      state.moveLeft = true;
    }

    if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
      state.moveRight = true;
    }

    if (
      e.key === "ArrowUp" ||
      e.key.toLowerCase() === "w" ||
      e.key === " "
    ) {
      e.preventDefault();
      jump();
    }

    if (e.key === "Enter") {
      shoot();
    }
  });

  document.addEventListener("keyup", e => {
    if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
      state.moveLeft = false;
    }

    if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
      state.moveRight = false;
    }
  });

  window.addEventListener("blur", () => {
    state.moveLeft = false;
    state.moveRight = false;
  });

  /* Prevent iOS Safari from turning gameplay gestures into page zoom. */
  ["gesturestart", "gesturechange", "gestureend"].forEach(type => {
    document.addEventListener(type, e => e.preventDefault(), { passive: false });
  });

  document.addEventListener("dblclick", e => e.preventDefault(), { passive: false });

  document.getElementById("startBtn").addEventListener("click", () => {
    initAudio();
    resetState();
  });

  document.getElementById("restartBtn").addEventListener("click", () => {
    initAudio();
    resetState();
  });

  document.getElementById("victoryRestartBtn").addEventListener("click", () => {
    initAudio();
    resetState();
  });


  window.addEventListener("pointerup", () => {
    state.moveLeft = false;
    state.moveRight = false;
  });

  window.addEventListener("pointercancel", () => {
    state.moveLeft = false;
    state.moveRight = false;
  });

  window.addEventListener("resize", () => {
    if (!state.running || state.ended) return;
    state.playerX = clamp(state.playerX, 0, Math.max(0, game.clientWidth - player.offsetWidth));
    state.playerY = Math.min(state.playerY, groundY());
    player.style.left = `${state.playerX}px`;
    player.style.top = `${state.playerY}px`;
  });

  /* ==========================================================
     START LOOP
     ========================================================== */

  player.style.top = `${groundY()}px`;
  updateSoundButton();
  updateUI();
  requestAnimationFrame(loop);
})();
