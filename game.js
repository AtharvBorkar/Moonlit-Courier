(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const duckButton = document.querySelector('#touch-duck');
  const scoreNode = document.querySelector('#score');
  const bestNode = document.querySelector('#best');
  const screen = document.querySelector('#screen');
  const iconNode = document.querySelector('#screen-icon');
  const eyebrowNode = document.querySelector('#eyebrow');
  const titleNode = document.querySelector('#screen-title');
  const copyNode = document.querySelector('#screen-copy');
  const actionButton = document.querySelector('#action-button');

  const W = canvas.width;
  const H = canvas.height;
  const GROUND = 294;
  const BASE_SPEED = 310;
  const MAX_SPEED = 700;
  const PLAYER_W = 38;
  const PLAYER_H = 48;
  const FLYER_SCORE_THRESHOLD = 100;
  const FLYER_CHANCE = 0.55;
  const FLYER_SPEED = 1.16;
  const STORAGE_KEY = 'moonlit-courier-best-v1';
  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  let best = readBest();
  let running = false;
  let gameTime = 0;
  let distance = 0;
  let speed = BASE_SPEED;
  let spawnIn = 1.05;
  let clearPause = 0;
  let downHeld = false;
  let keyboardDuckHeld = false;
  let touchDuckHeld = false;
  let touchDuckPointerId = null;
  let lastFrame = 0;
  let groundScroll = 0;
  let obstacles = [];
  let particles = [];
  let stars = [];
  let player = makePlayer();

  for (let i = 0; i < 48; i++) {
    stars.push({ x: (i * 197 + 53) % W, y: 18 + ((i * 83) % 150), size: i % 9 === 0 ? 3 : 2, phase: i * 0.71 });
  }

  function readBest() {
    try { return Number(localStorage.getItem(STORAGE_KEY)) || 0; }
    catch { return 0; }
  }

  function saveBest() {
    try { localStorage.setItem(STORAGE_KEY, String(best)); }
    catch { /* Storage can be unavailable in private browsing. */ }
  }

  function makePlayer() {
    return { x: 132, y: GROUND - PLAYER_H, vy: 0, grounded: true, duck: false, blink: 0 };
  }

  function setScreen(mode) {
    if (mode === 'playing') {
      screen.classList.add('is-hidden');
      return;
    }
    screen.classList.remove('is-hidden');
    if (mode === 'ready') {
      iconNode.textContent = '✦';
      eyebrowNode.textContent = 'NIGHT SHIFT · ROUTE 07';
      titleNode.textContent = 'The long way home';
      copyNode.textContent = 'Guide Pip through the moon garden. The path gets quicker the farther you travel.';
      actionButton.innerHTML = 'Start the run <span aria-hidden="true">→</span>';
      actionButton.setAttribute('aria-label', 'Start the run');
    } else {
      iconNode.textContent = '☾';
      eyebrowNode.textContent = 'ROUTE INTERRUPTED';
      titleNode.textContent = 'Pip needs a recharge';
      copyNode.textContent = `You travelled ${formatScore(scoreValue())} units. Catch your breath and try the route again.`;
      actionButton.innerHTML = 'Run it back <span aria-hidden="true">↻</span>';
      actionButton.setAttribute('aria-label', 'Restart the run');
    }
  }

  function formatScore(value) {
    return String(value).padStart(5, '0');
  }

  function scoreValue() {
    return Math.floor(distance * 0.025);
  }

  function beginRun(jumpImmediately = false) {
    obstacles = [];
    particles = [];
    player = makePlayer();
    distance = 0;
    speed = BASE_SPEED;
    spawnIn = 1.1;
    clearPause = 0;
    downHeld = false;
    keyboardDuckHeld = false;
    touchDuckHeld = false;
    touchDuckPointerId = null;
    duckButton.classList.remove('is-pressed');
    groundScroll = 0;
    running = true;
    setScreen('playing');
    updateHud();
    if (jumpImmediately) jump();
  }

  function jump() {
    if (!running || !player.grounded) return;
    player.grounded = false;
    player.vy = -660;
    player.duck = false;
    downHeld = false;
    keyboardDuckHeld = false;
    touchDuckHeld = false;
    touchDuckPointerId = null;
    duckButton.classList.remove('is-pressed');
    emit(player.x + 12, GROUND - 2, 5, 'dust');
  }

  function quickDrop() {
    if (!running || player.grounded) return;
    player.vy = Math.max(player.vy, 470);
  }

  function setDuckInput(source, pressed) {
    if (source === 'touch') touchDuckHeld = pressed;
    else keyboardDuckHeld = pressed;
    downHeld = keyboardDuckHeld || touchDuckHeld;
    if (!running) return;
    if (player.grounded) player.duck = downHeld;
    else if (pressed) quickDrop();
  }

  function releaseAllDuckInputs() {
    keyboardDuckHeld = false;
    touchDuckHeld = false;
    downHeld = false;
    player.duck = false;
    touchDuckPointerId = null;
    duckButton.classList.remove('is-pressed');
  }

  function createObstacle() {
    const roll = Math.random();
    const kind = roll < 0.48 ? 'crystal' : roll < 0.78 ? 'spire' : 'cluster';
    if (kind === 'crystal') {
      const height = rand(29, 53);
      return { kind, x: W + 8, y: GROUND - height, w: rand(24, 33), h: height, tone: Math.random() < 0.5 ? 0 : 1 };
    }
    if (kind === 'spire') {
      const height = rand(46, 68);
      return { kind, x: W + 8, y: GROUND - height, w: rand(31, 42), h: height, tone: 2 };
    }
    const h1 = rand(25, 43);
    const h2 = rand(35, 52);
    return { kind, x: W + 8, y: GROUND - h2, w: 62, h: h2, h1, tone: 1 };
  }

  function createFlyer() {
    const heights = [GROUND - 36, GROUND - 60, GROUND - 96];
    const tiers = ['low', 'middle', 'high'];
    const index = Math.floor(Math.random() * heights.length);
    const baseY = heights[index];
    return {
      kind: 'flyer', x: W + 8, y: baseY, baseY, w: 56, h: 28,
      tier: tiers[index], phase: rand(0, Math.PI * 2),
    };
  }

  function update(dt) {
    if (!running) return;
    gameTime += dt;
    speed = Math.min(MAX_SPEED, speed + 8.5 * dt);
    distance += speed * dt;
    groundScroll = (groundScroll + speed * dt) % 48;
    if (player.grounded) player.duck = downHeld;

    if (!player.grounded) {
      player.vy += 1780 * dt;
      player.y += player.vy * dt;
      if (player.y + PLAYER_H >= GROUND) {
        player.y = GROUND - PLAYER_H;
        player.vy = 0;
        player.grounded = true;
        player.duck = downHeld;
        emit(player.x + 14, GROUND - 2, 7, 'dust');
      }
    }

    const hadObstacles = obstacles.length > 0;
    for (const obstacle of obstacles) {
      const obstacleSpeed = obstacle.kind === 'flyer' ? FLYER_SPEED : 1;
      obstacle.x -= speed * obstacleSpeed * dt;
      if (obstacle.kind === 'flyer') {
        obstacle.y = obstacle.baseY + Math.round(Math.sin(gameTime * 3.5 + obstacle.phase) * 2);
      }
    }
    obstacles = obstacles.filter(obstacle => obstacle.x + obstacle.w > -20);
    if (hadObstacles && obstacles.length === 0) clearPause = 0.72;
    if (clearPause > 0) clearPause = Math.max(0, clearPause - dt);

    spawnIn -= dt;
    // Keep hazards in distinct, readable beats: never put a flyer and a ground
    // obstacle on screen together, then leave a short clear runway before the next.
    if (spawnIn <= 0 && obstacles.length === 0 && clearPause === 0) {
      const canSpawnFlyer = scoreValue() >= FLYER_SCORE_THRESHOLD;
      const spawnFlyer = canSpawnFlyer && Math.random() < FLYER_CHANCE;
      obstacles.push(spawnFlyer ? createFlyer() : createObstacle());
      const pace = Math.pow(BASE_SPEED / speed, 0.28);
      spawnIn = Math.max(0.78, rand(1.18, 1.72) * pace);
    }

    updateParticles(dt);
    for (const obstacle of obstacles) {
      if (hits(player, obstacle)) {
        finishRun();
        break;
      }
    }
    updateHud();
  }

  function hits(actor, obstacle) {
    const ducking = actor.duck && actor.grounded;
    const playerBox = ducking
      ? { left: actor.x + 5, right: actor.x + PLAYER_W - 5, top: GROUND - 28, bottom: GROUND - 2 }
      : { left: actor.x + 7, right: actor.x + PLAYER_W - 7, top: actor.y + 6, bottom: actor.y + PLAYER_H - 3 };
    const hazardBox = obstacle.kind === 'flyer'
      ? { left: obstacle.x + 2, right: obstacle.x + obstacle.w - 2, top: obstacle.y + 1, bottom: obstacle.y + obstacle.h - 1 }
      : { left: obstacle.x + 5, right: obstacle.x + obstacle.w - 5, top: obstacle.y + 5, bottom: GROUND - 1 };
    return playerBox.left < hazardBox.right && playerBox.right > hazardBox.left &&
      playerBox.top < hazardBox.bottom && playerBox.bottom > hazardBox.top;
  }

  function finishRun() {
    running = false;
    emit(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, 18, 'spark');
    const score = scoreValue();
    if (score > best) {
      best = score;
      saveBest();
    }
    updateHud();
    setScreen('over');
  }

  function updateHud() {
    scoreNode.textContent = formatScore(scoreValue());
    bestNode.textContent = formatScore(best);
  }

  function emit(x, y, count, type) {
    for (let i = 0; i < count; i++) {
      const life = rand(0.25, 0.65);
      particles.push({ x, y, vx: rand(-115, 45), vy: rand(-160, -25), life, maxLife: life, size: type === 'spark' ? rand(3, 6) : rand(2, 5), type });
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 390 * dt;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function draw() {
    ctx.imageSmoothingEnabled = false;
    drawSky();
    drawLandscape();
    drawGround();
    for (const obstacle of obstacles) drawObstacle(obstacle);
    drawParticles();
    drawPlayer();
  }

  function drawSky() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#242546');
    gradient.addColorStop(0.64, '#51446f');
    gradient.addColorStop(1, '#b27076');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // Blocky moon and a few square-cut craters.
    ctx.fillStyle = '#f4d8a5';
    ctx.fillRect(742, 46, 38, 8); ctx.fillRect(734, 54, 54, 8);
    ctx.fillRect(730, 62, 62, 28); ctx.fillRect(738, 90, 46, 8); ctx.fillRect(750, 98, 22, 7);
    ctx.fillStyle = 'rgba(179, 131, 141, .42)';
    ctx.fillRect(746, 64, 8, 7); ctx.fillRect(770, 79, 10, 6); ctx.fillRect(758, 88, 6, 5);

    for (const star of stars) {
      const alpha = 0.38 + (Math.sin(gameTime * 1.7 + star.phase) + 1) * 0.25;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = star.size === 3 ? '#ffe5b6' : '#d5d8ff';
      ctx.fillRect(star.x, star.y, star.size, star.size);
      if (star.size === 3) {
        ctx.fillRect(star.x + 1, star.y - 2, 1, 7);
        ctx.fillRect(star.x - 2, star.y + 1, 7, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawLandscape() {
    // Distant mesa silhouettes with deliberately stepped pixel edges.
    ctx.fillStyle = '#51436d';
    ctx.beginPath();
    ctx.moveTo(0, 224); ctx.lineTo(0, 187); ctx.lineTo(68, 187); ctx.lineTo(68, 164);
    ctx.lineTo(104, 164); ctx.lineTo(104, 179); ctx.lineTo(152, 179); ctx.lineTo(152, 151);
    ctx.lineTo(204, 151); ctx.lineTo(204, 179); ctx.lineTo(260, 179); ctx.lineTo(260, 194);
    ctx.lineTo(328, 194); ctx.lineTo(328, 171); ctx.lineTo(378, 171); ctx.lineTo(378, 188);
    ctx.lineTo(446, 188); ctx.lineTo(446, 160); ctx.lineTo(506, 160); ctx.lineTo(506, 184);
    ctx.lineTo(574, 184); ctx.lineTo(574, 174); ctx.lineTo(644, 174); ctx.lineTo(644, 196);
    ctx.lineTo(720, 196); ctx.lineTo(720, 166); ctx.lineTo(780, 166); ctx.lineTo(780, 189);
    ctx.lineTo(852, 189); ctx.lineTo(852, 157); ctx.lineTo(916, 157); ctx.lineTo(916, 190);
    ctx.lineTo(960, 190); ctx.lineTo(960, 240); ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#675174';
    const drift = running ? (distance * 0.07) % 120 : (gameTime * 3) % 120;
    for (let i = -1; i < 10; i++) {
      const x = i * 120 - drift;
      ctx.fillRect(x + 18, 214, 36, 5); ctx.fillRect(x + 6, 219, 70, 6);
      ctx.fillRect(x + 52, 205, 10, 9);
    }
    // Distant glowing windows.
    ctx.fillStyle = 'rgba(255, 202, 146, .52)';
    for (let i = 0; i < 11; i++) {
      const x = (i * 97 + 26 - drift * .42 + W) % W;
      ctx.fillRect(x, 197 + (i % 3) * 10, 3, 4);
    }
  }

  function drawGround() {
    ctx.fillStyle = '#302c4c';
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#e2a17f';
    ctx.fillRect(0, GROUND, W, 3);
    ctx.fillStyle = '#8a5e72';
    for (let x = -48 - groundScroll; x < W + 48; x += 48) {
      ctx.fillRect(Math.floor(x), GROUND + 13, 27, 3);
      ctx.fillRect(Math.floor(x + 31), GROUND + 30, 9, 3);
      ctx.fillRect(Math.floor(x + 7), GROUND + 45, 14, 2);
    }
    ctx.fillStyle = '#493652';
    ctx.fillRect(0, GROUND + 56, W, H - GROUND - 56);
    ctx.fillStyle = '#d18a78';
    for (let x = -24 - groundScroll * .48; x < W; x += 97) {
      ctx.fillRect(Math.floor(x), GROUND + 8, 3, 3);
      ctx.fillRect(Math.floor(x + 45), GROUND + 37, 2, 2);
    }
  }

  function drawObstacle(o) {
    if (o.kind === 'flyer') {
      drawFlyer(o);
      return;
    }
    if (o.kind === 'spire') {
      // A weathered moon relay: stepped tower, glowing slit, and tiny cap.
      ctx.fillStyle = '#45334e';
      ctx.fillRect(o.x + 4, o.y + 9, o.w - 8, o.h - 9);
      ctx.fillRect(o.x + 9, o.y + 3, o.w - 18, 8);
      ctx.fillStyle = '#bd7790';
      ctx.fillRect(o.x + 8, o.y + 13, 5, o.h - 17);
      ctx.fillRect(o.x + o.w - 10, o.y + 17, 5, o.h - 20);
      ctx.fillStyle = '#ffd08f';
      ctx.fillRect(o.x + o.w / 2 - 2, o.y + 22, 4, 10);
      ctx.fillStyle = '#f2b88b';
      ctx.fillRect(o.x + 2, GROUND - 3, o.w - 4, 3);
      return;
    }

    const w = o.kind === 'cluster' ? 31 : o.w;
    drawCrystal(o.x, GROUND, w, o.kind === 'cluster' ? o.h1 : o.h, o.tone);
    if (o.kind === 'cluster') drawCrystal(o.x + 30, GROUND, 32, o.h, 0);
  }

  function drawFlyer(flyer) {
    const x = Math.round(flyer.x);
    const y = Math.round(flyer.y);
    const wingFrame = Math.floor(gameTime * 10 + flyer.phase) % 2;

    // Pip-sized moon moth drone: the two wing poses are original pixel art.
    ctx.fillStyle = '#39405f';
    if (wingFrame === 0) {
      ctx.fillRect(x + 3, y + 10, 13, 8); ctx.fillRect(x + 7, y + 6, 10, 5);
      ctx.fillRect(x + 40, y + 10, 13, 8); ctx.fillRect(x + 39, y + 6, 10, 5);
      ctx.fillStyle = '#7c6fa0';
      ctx.fillRect(x + 1, y + 15, 14, 5); ctx.fillRect(x + 41, y + 15, 14, 5);
    } else {
      ctx.fillRect(x + 5, y + 5, 12, 9); ctx.fillRect(x + 9, y + 2, 9, 5);
      ctx.fillRect(x + 39, y + 5, 12, 9); ctx.fillRect(x + 38, y + 2, 9, 5);
      ctx.fillStyle = '#7c6fa0';
      ctx.fillRect(x + 3, y + 8, 13, 5); ctx.fillRect(x + 40, y + 8, 13, 5);
    }

    ctx.fillStyle = '#29324e';
    ctx.fillRect(x + 13, y + 10, 31, 12);
    ctx.fillRect(x + 19, y + 7, 20, 5);
    ctx.fillStyle = '#65718e';
    ctx.fillRect(x + 17, y + 11, 23, 4);
    ctx.fillRect(x + 9, y + 14, 6, 5);
    ctx.fillRect(x + 43, y + 13, 6, 6);
    ctx.fillStyle = '#8af0d0';
    ctx.fillRect(x + 35, y + 15, 5, 4);
    ctx.fillStyle = '#f9d994';
    ctx.fillRect(x + 36, y + 15, 2, 2);
    ctx.fillStyle = '#e8a47e';
    ctx.fillRect(x + 23, y + 21, 11, 3);
    ctx.fillStyle = '#ffd17e';
    ctx.fillRect(x + 25, y + 4, 7, 3);
    ctx.fillRect(x + 27, y + (wingFrame ? 1 : 5), 3, 3);
  }

  function drawCrystal(x, base, width, height, tone) {
    const palette = tone === 2
      ? ['#ffbb83', '#db7691', '#8f537f']
      : tone === 1 ? ['#9cf3d5', '#53b9b4', '#39748c'] : ['#a5c3ff', '#657ed1', '#424d91'];
    const unit = 5;
    const left = Math.round(x / unit) * unit;
    const top = base - Math.round(height / unit) * unit;
    const w = Math.max(20, Math.round(width / unit) * unit);
    const h = base - top;
    ctx.fillStyle = palette[2];
    ctx.fillRect(left + 5, top + 10, w - 10, h - 10);
    ctx.fillRect(left + 10, top + 5, w - 20, 5);
    ctx.fillRect(left + 15, top, w - 30, 5);
    ctx.fillRect(left, base - 9, 5, 9); ctx.fillRect(left + w - 5, base - 9, 5, 9);
    ctx.fillStyle = palette[0];
    ctx.fillRect(left + 10, top + 10, 5, h - 20);
    ctx.fillRect(left + 15, top + 5, 5, 10);
    ctx.fillRect(left + 15, base - 10, Math.max(5, w / 2 - 15), 5);
    ctx.fillStyle = palette[1];
    ctx.fillRect(left + w - 15, top + 10, 5, h - 15);
    ctx.fillRect(left + 20, top + 10, 5, Math.min(18, h - 15));
    ctx.fillStyle = 'rgba(255, 240, 207, .9)';
    ctx.fillRect(left + 15, top + 5, 5, 5);
  }

  function drawPlayer() {
    const duck = player.duck && player.grounded;
    const x = Math.round(player.x);
    if (duck) {
      drawDuckedPlayer(x);
      return;
    }
    const y = Math.round(player.y);
    const step = running && player.grounded ? Math.floor(gameTime * 12) % 2 : 0;
    const bob = running && player.grounded ? (step ? -2 : 0) : 0;

    // Soft pixel shadow.
    ctx.fillStyle = 'rgba(20, 18, 39, .36)';
    ctx.fillRect(x + 5, GROUND - 2, 31, 4);
    ctx.fillRect(x + 10, GROUND + 2, 20, 2);

    // Pip's little amber antenna.
    ctx.fillStyle = '#4c3b53';
    ctx.fillRect(x + 19, y + 2 + bob, 5, 8);
    ctx.fillStyle = '#ffd17e';
    ctx.fillRect(x + 18, y + bob, 7, 5);
    ctx.fillStyle = '#fff0bb';
    ctx.fillRect(x + 20, y + 1 + bob, 3, 2);

    // Backpack, body, and square shoulders.
    ctx.fillStyle = '#d77e6d';
    ctx.fillRect(x + 2, y + 21 + bob, 10, 17);
    ctx.fillStyle = '#ffb278';
    ctx.fillRect(x + 4, y + 24 + bob, 5, 9);
    ctx.fillStyle = '#d8e8d0';
    ctx.fillRect(x + 10, y + 13 + bob, 23, 25);
    ctx.fillRect(x + 7, y + 18 + bob, 6, 15);
    ctx.fillStyle = '#f1f1cf';
    ctx.fillRect(x + 14, y + 11 + bob, 16, 5);
    ctx.fillRect(x + 13, y + 16 + bob, 19, 17);

    // Dark glass face and luminous eye.
    ctx.fillStyle = '#30364f';
    ctx.fillRect(x + 14, y + 17 + bob, 17, 10);
    ctx.fillStyle = '#7ef1d2';
    ctx.fillRect(x + 19, y + 20 + bob, 5, 4);
    ctx.fillStyle = '#d7fff0';
    ctx.fillRect(x + 20, y + 20 + bob, 2, 2);
    ctx.fillStyle = '#bbd4c2';
    ctx.fillRect(x + 16, y + 30 + bob, 11, 2);

    // Arms swing opposite the feet.
    ctx.fillStyle = '#f1f1cf';
    ctx.fillRect(x + 30, y + 21 + bob + (step ? 2 : 0), 6, 9);
    ctx.fillStyle = '#d8e8d0';
    ctx.fillRect(x + 31, y + 29 + bob + (step ? 2 : 0), 5, 5);

    // Two little boots, alternating while running.
    ctx.fillStyle = '#3c3b5b';
    ctx.fillRect(x + 13, y + 37 + bob, 7, step ? 8 : 10);
    ctx.fillRect(x + 26, y + 37 + bob, 7, step ? 10 : 8);
    ctx.fillStyle = '#f3a56f';
    ctx.fillRect(x + 11, y + (step ? 44 : 46) + bob, 10, 4);
    ctx.fillRect(x + 25, y + (step ? 46 : 44) + bob, 10, 4);
  }

  function drawDuckedPlayer(x) {
    const y = GROUND - 32;
    ctx.fillStyle = 'rgba(20, 18, 39, .36)';
    ctx.fillRect(x + 5, GROUND - 2, 31, 4);
    ctx.fillStyle = '#d77e6d';
    ctx.fillRect(x + 1, y + 13, 12, 13);
    ctx.fillStyle = '#ffb278';
    ctx.fillRect(x + 3, y + 16, 6, 7);
    ctx.fillStyle = '#d8e8d0';
    ctx.fillRect(x + 9, y + 8, 27, 20);
    ctx.fillRect(x + 13, y + 5, 18, 5);
    ctx.fillStyle = '#4c3b53';
    ctx.fillRect(x + 21, y + 2, 4, 5);
    ctx.fillStyle = '#ffd17e';
    ctx.fillRect(x + 19, y, 8, 4);
    ctx.fillStyle = '#30364f';
    ctx.fillRect(x + 20, y + 11, 15, 9);
    ctx.fillStyle = '#7ef1d2';
    ctx.fillRect(x + 26, y + 14, 5, 4);
    ctx.fillStyle = '#d7fff0';
    ctx.fillRect(x + 27, y + 14, 2, 2);
    ctx.fillStyle = '#bbd4c2';
    ctx.fillRect(x + 13, y + 24, 13, 2);
    ctx.fillStyle = '#3c3b5b';
    ctx.fillRect(x + 12, y + 27, 8, 4);
    ctx.fillRect(x + 27, y + 27, 8, 4);
    ctx.fillStyle = '#f3a56f';
    ctx.fillRect(x + 10, y + 29, 11, 3);
    ctx.fillRect(x + 26, y + 29, 11, 3);
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.type === 'spark' ? '#ffe29d' : '#f2b995';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.ceil(p.size), Math.ceil(p.size));
    }
    ctx.globalAlpha = 1;
  }

  function frame(timestamp) {
    const dt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, 0.04) : 0;
    lastFrame = timestamp;
    if (!running) gameTime += dt;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function startFromKeyboard() {
    if (!running) beginRun(true);
    else jump();
  }

  actionButton.addEventListener('click', () => beginRun(false));

  function isInteractiveTarget(target) {
    return target instanceof Element && Boolean(target.closest('button, a, input, select, textarea'));
  }

  window.addEventListener('pointerdown', event => {
    if (isInteractiveTarget(event.target)) return;
    if (event.pointerType === 'touch') {
      event.preventDefault();
      if (event.clientX >= window.innerWidth / 2) {
        startFromKeyboard();
      } else if (event.clientY >= window.innerHeight * 0.56 && running) {
        touchDuckPointerId = event.pointerId;
        setDuckInput('touch', true);
      }
    } else if (event.pointerType === 'mouse' && event.target instanceof Element && event.target.closest('#game')) {
      if (!running) beginRun(true);
      else jump();
    }
  }, { passive: false });

  duckButton.addEventListener('pointerdown', event => {
    event.preventDefault();
    touchDuckPointerId = event.pointerId;
    duckButton.classList.add('is-pressed');
    duckButton.setPointerCapture(event.pointerId);
    setDuckInput('touch', true);
  });

  function releaseTouchPointer(event) {
    if (event.pointerId !== touchDuckPointerId) return;
    touchDuckPointerId = null;
    duckButton.classList.remove('is-pressed');
    setDuckInput('touch', false);
  }
  window.addEventListener('pointerup', releaseTouchPointer);
  window.addEventListener('pointercancel', releaseTouchPointer);

  window.addEventListener('keydown', event => {
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
      event.preventDefault();
      if (!event.repeat) startFromKeyboard();
    } else if (event.code === 'ArrowDown' || event.code === 'KeyS') {
      event.preventDefault();
      if (!event.repeat) setDuckInput('keyboard', true);
    }
  });
  window.addEventListener('keyup', event => {
    if (event.code === 'ArrowDown' || event.code === 'KeyS') setDuckInput('keyboard', false);
  });
  window.addEventListener('blur', releaseAllDuckInputs);
  window.addEventListener('touchmove', event => event.preventDefault(), { passive: false });
  window.addEventListener('gesturestart', event => event.preventDefault(), { passive: false });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }

  setScreen('ready');
  updateHud();
  requestAnimationFrame(frame);
})();
