const GAME_W = 640;
const GAME_H = 360;
const FPS_LIMIT = 90;
const GROUND_Y = GAME_H - 50;
const PLAYER_Y = GROUND_Y - 12;

const KITE_SPRING = 70;
const KITE_DRAG = 4.8;
const KITE_GRAVITY = 22;
const MAX_VEL = 255;
const BOOST_MULTI = 2.2;

const WIND_BASE_X = 24;
const WIND_BASE_Y = -4;
const WIND_GUST_AMP = 42;
const WIND_GUST_FREQ = 0.13;

const STRING_MAX_LENGTH = 220;
const STRING_MIN_LENGTH = 140;
const STRING_PULL_K = 14;
const STRING_REEL_IN_SPEED = 210;
const STRING_RELEASE_SPEED = 130;

const START_HP = 3;
const HIT_IFRAME_MS = 950;
const KITE_RETURN_PAUSE_MS = 650;
const KITE_RETURN_RISE_SPEED = 42;
const KITE_RETURN_TARGET_Y = GAME_H * 0.5;
const SCENERY_JITTLE_AMP = 0.8;
const SCENERY_JITTLE_FREQ = 0.8;
const CAT_BITE_COOLDOWN_MS = 900;
const CAT_BITE_CHANCE = 0.2;
const CAT_WANDER_SPEED = 7;
const CAT_WANDER_RADIUS = 44;
const PLAYER_WALK_SPEED = 60;

// Ground collision - tiles act as solid ground
// The tiles layer sits at a certain height, kite and tail must stay above
const TILES_GROUND_Y = GAME_H - 55;

function scaleHexColor(hex, rMul, gMul, bMul) {
    const r = (hex >> 16) & 0xff;
    const g = (hex >> 8) & 0xff;
    const b = hex & 0xff;
    const rr = Math.max(0, Math.min(255, Math.floor(r * rMul)));
    const gg = Math.max(0, Math.min(255, Math.floor(g * gMul)));
    const bb = Math.max(0, Math.min(255, Math.floor(b * bMul)));
    return (rr << 16) | (gg << 8) | bb;
}

function loadJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed ?? fallback;
    } catch (_err) {
        return fallback;
    }
}

// ── JSONBin.io Leaderboard ─────────────────────────────────────────
const JSONBIN_BIN_ID = '69915d27d0ea881f40bb93b3';
const JSONBIN_ACCESS_KEY = '$2a$10$OzNTc3wACLgI09DOkHRkP.cU0SWC9dEZys/IMg9jwlLRwEMIGGbfu';
const JSONBIN_BASE_URL = 'https://api.jsonbin.io/v3/b';
const LEADERBOARD_LIMIT = 5;

function normalizeLeaderboardEntries(entries) {
    const byPlayer = new Map();
    for (const entry of entries || []) {
        const name = String(entry.name || 'Anon').slice(0, 20);
        const score = Math.floor(Number(entry.score) || 0);
        const at = Number(entry.at) || 0;
        const key = name.toLowerCase();
        const prev = byPlayer.get(key);
        if (!prev || score > prev.score || (score === prev.score && at < prev.at)) {
            byPlayer.set(key, { name, score, at });
        }
    }

    return Array.from(byPlayer.values())
        .sort((a, b) => b.score - a.score || a.at - b.at)
        .slice(0, LEADERBOARD_LIMIT);
}

async function fetchLeaderboard() {
    try {
        const res = await fetch(`${JSONBIN_BASE_URL}/${JSONBIN_BIN_ID}/latest`, {
            headers: { 'X-Access-Key': JSONBIN_ACCESS_KEY }
        });
        if (!res.ok) return [];
        const payload = await res.json();
        const record = payload && typeof payload.record === 'object' ? payload.record : {};
        const entries = Array.isArray(record.entries) ? record.entries : [];
        return normalizeLeaderboardEntries(entries);
    } catch (_err) {
        return [];
    }
}

async function submitScore(name, score) {
    try {
        const current = await fetchLeaderboard();
        const next = normalizeLeaderboardEntries([
            ...current,
            { name: String(name).slice(0, 20), score: Math.floor(score), at: Date.now() }
        ]);
        await fetch(`${JSONBIN_BASE_URL}/${JSONBIN_BIN_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Access-Key': JSONBIN_ACCESS_KEY
            },
            body: JSON.stringify({ entries: next })
        });
        return next;
    } catch (_err) {
        return null;
    }
}

// Kite types with different stats
const KITE_TYPES = {
    classic: { name: 'Classic', spring: 70, drag: 4.8, gravity: 22, maxVel: 255, color: 0xff9a3d, tailLength: 5 },
    swift: { name: 'Swift', spring: 90, drag: 5.2, gravity: 18, maxVel: 290, color: 0x6ecfff, tailLength: 7 },
    heavy: { name: 'Heavy', spring: 55, drag: 4.2, gravity: 28, maxVel: 220, color: 0xff6e6e, tailLength: 4 },
    balanced: { name: 'Balanced', spring: 70, drag: 4.8, gravity: 22, maxVel: 255, color: 0x9fff6e, tailLength: 6 },
    night: { name: 'Night Owl', spring: 75, drag: 5.0, gravity: 20, maxVel: 270, color: 0xb46eff, tailLength: 8 }
};

// Weather states
const WEATHER = {
    clear: { name: 'Clear', rainIntensity: 0, lightningChance: 0, windMod: 1.0 },
    breezy: { name: 'Breezy', rainIntensity: 0, lightningChance: 0, windMod: 1.3 },
    rainy: { name: 'Rainy', rainIntensity: 0.6, lightningChance: 0, windMod: 0.7, gravityMod: 1.15 },
    storm: { name: 'Storm', rainIntensity: 1.0, lightningChance: 0.003, windMod: 1.8, gravityMod: 1.25 }
};

const KITE_UNLOCK_SCORE = {
    classic: 0,
    swift: 350,
    heavy: 700,
    balanced: 1100,
    night: 1600
};

const DAY_DURATION_SEC = 60;
const WEATHER_MIN_SEC = 12;
const WEATHER_MAX_SEC = 22;
const TAIL_SEG_LEN = 5.5;
const WIND_STAGES = [
    { name: 'calm', speed: 0.65, gust: 0.6, durationMin: 4, durationMax: 6 },
    { name: 'steady', speed: 1.0, gust: 1.0, durationMin: 4, durationMax: 7 },
    { name: 'strong', speed: 1.35, gust: 1.3, durationMin: 4, durationMax: 6 },
    { name: 'wild', speed: 1.7, gust: 1.7, durationMin: 3, durationMax: 5 }
];

class BootScene extends Phaser.Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        this.load.image('cloudsBackParallax', 'assets/CloudsBack.png');
        this.load.image('cloudsFrontParallax', 'assets/CloudsFront.png');
        this.load.image('background', 'assets/background.png');
        this.load.image('scenery', 'assets/scenery.png');
        this.load.image('tiles', 'assets/tiles.png');
        this.load.spritesheet('character', 'assets/character.png', {
            frameWidth: 32,
            frameHeight: 48
        });
        this.load.image('paper1', 'assets/paper1.png');
        this.load.image('paper2', 'assets/paper2.png');
        this.load.spritesheet('cat', 'assets/cat.png', {
            frameWidth: 64,
            frameHeight: 48
        });
        this.load.spritesheet('chicken1', 'assets/chicken1.png', {
            frameWidth: 32,
            frameHeight: 32
        });
        this.load.spritesheet('chicken2', 'assets/chicken2.png', {
            frameWidth: 32,
            frameHeight: 32
        });
    }

    create() {
        this.makeTextures();
        this.scene.start('Runner');
    }

    makeTextures() {
        const g = this.make.graphics({ x: 0, y: 0, add: false });

        // Player
        g.fillStyle(0x2a5f00);
        g.fillRect(6, 8, 12, 14);
        g.fillStyle(0x4a1c00);
        g.fillRect(7, 9, 10, 12);
        g.fillStyle(0x4a1c00);
        g.fillRect(8, 2, 8, 8);
        g.fillStyle(0x7a2d00);
        g.fillRect(9, 3, 6, 6);
        g.fillStyle(0xff9a3d);
        g.fillRect(10, 4, 2, 2);
        g.fillRect(12, 4, 2, 2);
        g.fillStyle(0x2a5f00);
        g.fillRect(7, 22, 3, 6);
        g.fillRect(14, 22, 3, 6);
        g.generateTexture('player', 24, 30);
        g.clear();

        // Kite textures for each type
        for (const [key, type] of Object.entries(KITE_TYPES)) {
            const baseColor = type.color;
            const darkColor = scaleHexColor(baseColor, 0.6, 0.4, 0.4);
            const crossColor = scaleHexColor(baseColor, 0.45, 0.25, 0.25);

            g.fillStyle(baseColor);
            g.beginPath();
            g.moveTo(16, 0);
            g.lineTo(32, 16);
            g.lineTo(16, 28);
            g.lineTo(0, 16);
            g.closePath();
            g.fillPath();
            g.fillStyle(darkColor);
            g.beginPath();
            g.moveTo(16, 4);
            g.lineTo(28, 16);
            g.lineTo(16, 24);
            g.lineTo(4, 16);
            g.closePath();
            g.fillPath();
            g.lineStyle(1, crossColor);
            g.beginPath();
            g.moveTo(16, 0);
            g.lineTo(16, 28);
            g.moveTo(0, 16);
            g.lineTo(32, 16);
            g.strokePath();
            g.generateTexture('kite_' + key, 32, 28);
            g.clear();
        }

        // Lightning bolt texture
        g.fillStyle(0xffffff, 1);
        g.beginPath();
        g.moveTo(8, 0);
        g.lineTo(4, 10);
        g.lineTo(9, 10);
        g.lineTo(2, 22);
        g.lineTo(10, 10);
        g.lineTo(5, 10);
        g.lineTo(10, 0);
        g.closePath();
        g.fillPath();
        g.generateTexture('lightning', 14, 24);
        g.clear();

        // Obstacles
        g.fillStyle(0x7a2d00);
        g.fillCircle(10, 10, 9);
        g.fillStyle(0xa54a00);
        g.fillCircle(8, 8, 3);
        g.fillCircle(13, 12, 2);
        g.generateTexture('rock', 20, 20);
        g.clear();

        g.fillStyle(0x334455);
        g.fillRect(0, 7, 28, 8);
        g.fillStyle(0x1a242e);
        g.fillRect(6, 3, 8, 4);
        g.fillRect(14, 15, 8, 4);
        g.generateTexture('bird', 28, 22);
        g.clear();

        g.fillStyle(0x9ad9ff, 0.95);
        g.fillRect(3, 0, 6, 20);
        g.fillRect(0, 6, 12, 6);
        g.generateTexture('gust', 12, 20);
        g.clear();

        g.fillStyle(0xffffff);
        g.fillRect(0, 0, 3, 3);
        g.generateTexture('particle', 3, 3);
        g.clear();

        // UI heart
        g.fillStyle(0xff5a5a);
        g.fillCircle(6, 5, 4);
        g.fillCircle(12, 5, 4);
        g.beginPath();
        g.moveTo(2, 7);
        g.lineTo(16, 7);
        g.lineTo(9, 16);
        g.closePath();
        g.fillPath();
        g.generateTexture('heart', 18, 18);
        g.clear();

        // Cat placeholder (only when cat spritesheet is not provided)
        if (!this.textures.exists('cat')) {
            g.fillStyle(0x2d2d2d);
            g.fillRect(4, 10, 20, 10); // body
            g.fillRect(18, 6, 8, 8); // head
            g.fillTriangle(19, 6, 22, 1, 24, 6); // ear
            g.fillTriangle(23, 6, 26, 1, 28, 6); // ear
            g.fillStyle(0x111111);
            g.fillRect(7, 19, 4, 5); // legs
            g.fillRect(15, 19, 4, 5);
            g.fillStyle(0xf7e27a);
            g.fillRect(23, 9, 2, 2); // eye
            g.generateTexture('cat', 32, 24);
        }

        g.destroy();
    }
}

class RunnerScene extends Phaser.Scene {
    constructor() {
        super('Runner');
    }

    create() {
        this.pointerX = GAME_W * 0.5;
        this.pointerY = GAME_H * 0.35;
        this.pointerDown = false;

        this.kiteVX = 0;
        this.kiteVY = 0;
        this.windX = 0;
        this.windY = 0;
        this.stringLength = STRING_MAX_LENGTH;

        this.hp = START_HP;
        this.lives = START_HP;
        this.best = Number(localStorage.getItem('storm_runner_best') || 0);
        this.score = 0;
        this.gameStarted = false;
        this.dead = false;
        this.hitUntil = 0;
        this.deathAnimating = false;
        this.deathRiseStartAt = 0;
        this.deathVX = 0;
        this.deathVY = 0;
        this.startTime = 0;
        this.elapsedMs = 0;

        this.spawnTimer = 0;
        this.spawnEvery = 0.9;
        this.sceneryBaseX = GAME_W * 0.5;
        this.sceneryLayer = null;
        this.sceneryGreenLayer = null;
        this.dayPhase = 0;
        this.weatherKeys = ['clear', 'breezy', 'rainy', 'storm'];
        this.currentWeatherKey = 'clear';
        this.currentWeather = WEATHER.clear;
        this.weatherTimer = Phaser.Math.Between(WEATHER_MIN_SEC, WEATHER_MAX_SEC);
        this.rainAlpha = 0;

        this.unlockedKites = loadJson('storm_runner_unlocked_kites', ['classic']);
        this.refreshKiteUnlocks();
        const preferred = localStorage.getItem('storm_runner_kite') || 'classic';
        this.currentKiteKey = this.unlockedKites.includes(preferred)
            ? preferred
            : this.unlockedKites[this.unlockedKites.length - 1];
        this.currentKite = KITE_TYPES[this.currentKiteKey];
        this.lastUnlockAt = 0;
        this.musicStarted = false;
        this.musicTimer = null;
        this.musicStep = 0;
        this.cloudBackVX = 0;
        this.cloudFrontVX = 0;
        this.cloudWindX = WIND_BASE_X;
        this.cloudDtSmooth = 1 / FPS_LIMIT;
        this.windStageIndex = 1;
        this.windStageTimer = Phaser.Math.FloatBetween(4, 7);
        this.windDirection = 1;
        this.windStageForce = 1;

        // Ground penalty: lose HP if kite stays on ground too long
        this.groundDamageThreshold = 2; // seconds before taking damage
        this.groundTimer = 0;
        this.lastGroundDamageTime = 0;
        this.kiteGroundY = TILES_GROUND_Y - 20;
        this.tailGroundTouch = false;
        this.tailGroundTouchPrev = false;
        this.tailGroundTouchX = GAME_W * 0.5;
        this.catNextBiteAt = 0;
        this.catAttackUntil = 0;
        this.catTargetX = GAME_W * 0.5;
        this.catWanderTimer = Phaser.Math.FloatBetween(0.8, 1.8);
        this.catRunUntil = 0;

        this.buildWorld();
        this.buildActors();
        this.setupAnimations();
        this.buildEffects();
        this.buildUI();
        this.setupInput();

        this.obstacles = this.physics.add.group();
        this.physics.add.overlap(this.kite, this.obstacles, this.onHit, null, this);
    }

    setupAnimations() {
        if (this.textures.exists('character')) {
            if (!this.anims.exists('player_idle')) {
                this.anims.create({
                    key: 'player_idle',
                    frames: this.anims.generateFrameNumbers('character', { start: 0, end: 3 }),
                    frameRate: 6,
                    repeat: -1
                });
            }
            if (!this.anims.exists('player_walk')) {
                this.anims.create({
                    key: 'player_walk',
                    frames: this.anims.generateFrameNumbers('character', { start: 4, end: 7 }),
                    frameRate: 10,
                    repeat: -1
                });
            }
        }

        if (this.textures.exists('chicken1') && !this.anims.exists('chicken1_fly')) {
            this.anims.create({
                key: 'chicken1_fly',
                frames: this.anims.generateFrameNumbers('chicken1', { start: 0, end: 7 }),
                frameRate: 12,
                repeat: -1
            });
        }
        if (this.textures.exists('chicken2') && !this.anims.exists('chicken2_fly')) {
            this.anims.create({
                key: 'chicken2_fly',
                frames: this.anims.generateFrameNumbers('chicken2', { start: 0, end: 7 }),
                frameRate: 12,
                repeat: -1
            });
        }

        const catFrames = this.textures.exists('cat')
            ? (this.textures.get('cat').frameTotal - 1)
            : 0;
        if (catFrames >= 17 && !this.anims.exists('cat_idle')) {
            this.anims.create({
                key: 'cat_idle',
                frames: this.anims.generateFrameNumbers('cat', { start: 0, end: 5 }),
                frameRate: 8,
                repeat: -1
            });
            this.anims.create({
                key: 'cat_walk',
                frames: this.anims.generateFrameNumbers('cat', { start: 6, end: 11 }),
                frameRate: 10,
                repeat: -1
            });
            this.anims.create({
                key: 'cat_run',
                frames: this.anims.generateFrameNumbers('cat', { start: 12, end: 17 }),
                frameRate: 14,
                repeat: -1
            });
        }
    }

    buildWorld() {
        const hasParallax = this.textures.exists('cloudsBackParallax')
            && this.textures.exists('cloudsFrontParallax');

        if (hasParallax) {
            this.textures.get('cloudsBackParallax')?.setFilter(Phaser.Textures.FilterMode.NEAREST);
            this.textures.get('cloudsFrontParallax')?.setFilter(Phaser.Textures.FilterMode.NEAREST);
            this.parallax = {
                cloudsBack: this.add.tileSprite(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 'cloudsBackParallax').setDepth(2),
                cloudsFront: this.add.tileSprite(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 'cloudsFrontParallax').setDepth(6)
            };
            if (this.textures.exists('scenery')) {
                this.sceneryLayer = this.add.image(GAME_W / 2, GAME_H / 2, 'scenery')
                    .setDisplaySize(GAME_W, GAME_H)
                    .setDepth(10);
                this.sceneryGreenLayer = this.add.image(GAME_W / 2, GAME_H / 2, 'scenery')
                    .setDisplaySize(GAME_W, GAME_H)
                    .setDepth(11)
                    .setTint(0x7fbf6e)
                    .setAlpha(0.16)
                    .setBlendMode(Phaser.BlendModes.ADD);
            }
            if (this.textures.exists('tiles')) {
                this.add.image(GAME_W / 2, GAME_H / 2, 'tiles').setDisplaySize(GAME_W, GAME_H).setDepth(20);
            }
            return;
        }

        if (this.textures.exists('background')) {
            this.add.image(GAME_W / 2, GAME_H / 2, 'background').setDisplaySize(GAME_W, GAME_H).setDepth(0);
        } else {
            const bg = this.add.graphics().setDepth(0);
            bg.fillStyle(0xeac368);
            bg.fillRect(0, 0, GAME_W, GAME_H);
        }

        if (this.textures.exists('scenery')) {
            this.sceneryLayer = this.add.image(GAME_W / 2, GAME_H / 2, 'scenery')
                .setDisplaySize(GAME_W, GAME_H)
                .setDepth(10);
            this.sceneryGreenLayer = this.add.image(GAME_W / 2, GAME_H / 2, 'scenery')
                .setDisplaySize(GAME_W, GAME_H)
                .setDepth(11)
                .setTint(0x7fbf6e)
                .setAlpha(0.16)
                .setBlendMode(Phaser.BlendModes.ADD);
        }
        if (this.textures.exists('tiles')) {
            this.add.image(GAME_W / 2, GAME_H / 2, 'tiles').setDisplaySize(GAME_W, GAME_H).setDepth(20);
        }
    }

    buildActors() {
        this.usingCharacterSprite = this.textures.exists('character');
        this.player = this.add.sprite(
            GAME_W * 0.35,
            PLAYER_Y,
            this.usingCharacterSprite ? 'character' : 'player'
        ).setOrigin(0.5, 1).setDepth(40);
        if (this.usingCharacterSprite) {
            this.player.play('player_idle');
        }
        this.cat = this.add.sprite(GAME_W * 0.5, TILES_GROUND_Y - 7, 'cat')
            .setY(TILES_GROUND_Y - 5)
            .setScale(0.5)
            .setOrigin(0.5, 1)
            .setDepth(42);
        if (this.anims.exists('cat_idle')) {
            this.cat.play('cat_idle');
        }

        this.kite = this.add.sprite(GAME_W * 0.35, 115, 'kite_' + this.currentKiteKey).setDepth(46);
        this.physics.add.existing(this.kite);
        this.kite.body.setAllowGravity(false);
        this.kite.body.setCollideWorldBounds(true);

        this.stringGfx = this.add.graphics().setDepth(45);
        this.trailGfx = this.add.graphics().setDepth(44);
        this.rebuildTail();
    }

    rebuildTail() {
        const segCount = this.currentKite.tailLength;
        this.tailNodes = [];
        for (let i = 0; i < segCount; i++) {
            this.tailNodes.push({
                x: this.kite.x,
                y: this.kite.y + 14 + i * TAIL_SEG_LEN,
                px: this.kite.x,
                py: this.kite.y + 14 + i * TAIL_SEG_LEN
            });
        }
    }

    buildUI() {
        this.heartIcons = [];
        for (let i = 0; i < this.lives; i++) {
            const heart = this.add.image(14 + i * 14, GAME_H - 12, 'heart')
                .setDepth(101)
                .setScale(0.52)
                .setTint(0xffffff);
            this.heartIcons.push(heart);
        }

        this.scoreText = this.add.text(GAME_W - 10, GAME_H - 12, '0', {
            fontFamily: 'ChipMug',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.45)'
        }).setOrigin(1, 0.5).setDepth(101);

        this.buildLeaderboardUI();
    }

    buildLeaderboardUI() {
        this.leaderboardText = this.add.text(GAME_W / 2, GAME_H - 12, '', {
            fontFamily: 'ChipMug',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.55)'
        }).setOrigin(0.5, 0.5).setDepth(102);

        this.lbEntries = [];
        this.lbLastFetch = 0;
        this.refreshLeaderboard();
    }

    async refreshLeaderboard() {
        const entries = await fetchLeaderboard();
        this.lbEntries = entries;
        this.renderLeaderboardEntries();
        this.lbLastFetch = Date.now();
    }

    renderLeaderboardEntries() {
        const top = this.lbEntries[0];
        if (!this.leaderboardText) return;
        if (top) {
            this.leaderboardText.setText(`${top.name} ${top.score}`);
        } else {
            this.leaderboardText.setText('');
        }
    }

    async submitScoreToLeaderboard(finalScore) {
        let playerName = localStorage.getItem('laga_layang_name');
        if (!playerName) {
            playerName = await this.showNameInput();
            if (playerName) localStorage.setItem('laga_layang_name', playerName);
        }
        if (!playerName) playerName = 'Anon';
        const entries = await submitScore(playerName, finalScore);
        if (entries) {
            this.lbEntries = entries;
            this.renderLeaderboardEntries();
        } else {
            this.refreshLeaderboard();
        }
    }

    showNameInput() {
        return new Promise((resolve) => {
            const container = document.getElementById('game-container');
            const overlay = document.createElement('div');
            overlay.id = 'name-input-overlay';
            overlay.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.6); z-index: 999;
      `;
            overlay.innerHTML = `
        <div style="text-align:center; font-family: ChipMug, monospace; color: #ffd700; font-size: 18px; margin-bottom: 12px;">Enter Your Name</div>
        <input id="player-name-input" type="text" maxlength="20" placeholder="Your name"
          style="font-family: ChipMug, monospace; font-size: 16px; padding: 8px 16px;
          background: #1a1a2e; color: #fff; border: 2px solid #ffd700; border-radius: 6px;
          outline: none; text-align: center; width: 200px;" />
        <button id="player-name-submit"
          style="font-family: ChipMug, monospace; font-size: 14px; margin-top: 10px;
          padding: 6px 24px; background: #ffd700; color: #000; border: none; border-radius: 6px;
          cursor: pointer;">OK</button>
      `;
            container.appendChild(overlay);

            const input = document.getElementById('player-name-input');
            const btn = document.getElementById('player-name-submit');
            input.focus();

            const finish = () => {
                const val = input.value.trim().slice(0, 20) || 'Anon';
                overlay.remove();
                resolve(val);
            };

            btn.addEventListener('click', finish);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finish();
            });
        });
    }

    formatTime(ms) {
        const totalSec = Math.floor(ms / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        const frac = Math.floor((ms % 1000) / 100);
        return `${min}:${String(sec).padStart(2, '0')}.${frac}`;
    }

    setupInput() {
        this.input.on('pointermove', (p) => {
            this.pointerX = p.x;
            this.pointerY = p.y;
        });
        this.input.on('pointerdown', () => {
            this.pointerDown = true;
            if (!this.gameStarted) {
                this.gameStarted = true;
                this.startTime = Date.now();
                this.elapsedMs = 0;
                this.score = 0;
            }
            this.startBgmOnce();
        });
        this.input.on('pointerup', () => { this.pointerDown = false; });
        this.input.mouse?.disableContextMenu();
    }

    playTone(freq, durationMs, gain = 0.025, type = 'square') {
        try {
            const ctx = this.sound?.context;
            if (!ctx || typeof ctx.createOscillator !== 'function') return;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            g.gain.value = gain;
            osc.connect(g);
            g.connect(ctx.destination);
            const now = ctx.currentTime;
            g.gain.setValueAtTime(gain, now);
            g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
            osc.start(now);
            osc.stop(now + durationMs / 1000);
        } catch (_err) {
            // Audio unsupported; continue silently.
        }
    }

    startBgmOnce() {
        if (this.musicStarted) return;
        const ctx = this.sound?.context;
        if (!ctx || typeof ctx.createOscillator !== 'function') return;
        this.musicStarted = true;

        const melody = [
            523.25, 659.25, 783.99, 659.25,
            587.33, 698.46, 783.99, 698.46,
            523.25, 659.25, 880.00, 783.99,
            698.46, 659.25, 587.33, 523.25
        ];
        const bass = [
            130.81, 130.81, 146.83, 146.83,
            164.81, 164.81, 146.83, 146.83
        ];

        this.musicTimer = this.time.addEvent({
            delay: 170,
            loop: true,
            callback: () => {
                if (this.dead) return;
                const i = this.musicStep++;
                const m = melody[i % melody.length];
                const b = bass[Math.floor(i / 2) % bass.length];
                this.playTone(m, 120, 0.0045, 'square');
                if (i % 2 === 0) this.playTone(b, 150, 0.0035, 'triangle');
            }
        });
    }

    refreshKiteUnlocks() {
        const unlocked = [];
        for (const key of Object.keys(KITE_TYPES)) {
            if (this.best >= KITE_UNLOCK_SCORE[key]) unlocked.push(key);
        }
        this.unlockedKites = unlocked.length ? unlocked : ['classic'];
        localStorage.setItem('storm_runner_unlocked_kites', JSON.stringify(this.unlockedKites));
    }

    cycleKiteType() {
        if (this.unlockedKites.length <= 1) return;
        const idx = this.unlockedKites.indexOf(this.currentKiteKey);
        const next = this.unlockedKites[(idx + 1) % this.unlockedKites.length];
        this.currentKiteKey = next;
        this.currentKite = KITE_TYPES[next];
        localStorage.setItem('storm_runner_kite', next);
        this.kite.setTexture('kite_' + next);
        this.rebuildTail();
    }

    setTransientStatus(text, ms) {
        void text;
        void ms;
    }

    buildEffects() {
        this.dayNightOverlay = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x0d1830, 0)
            .setDepth(30);
        this.lightningFlash = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0xffffff, 0)
            .setDepth(120);

        this.rainEmitter = this.add.particles(0, 0, 'particle', {
            x: { min: -20, max: GAME_W + 20 },
            y: { min: -20, max: -5 },
            speedX: { min: -20, max: 15 },
            speedY: { min: 160, max: 260 },
            scale: { start: 0.6, end: 0.2 },
            alpha: { start: 0, end: 0 },
            lifespan: { min: 700, max: 950 },
            frequency: 45,
            quantity: 1,
            tint: 0x9fd4ff
        }).setDepth(32);

        this.windEmitter = this.add.particles(0, 0, 'particle', {
            x: { min: -10, max: GAME_W + 10 },
            y: { min: 20, max: GROUND_Y - 30 },
            speedX: { min: -60, max: -25 },
            speedY: { min: -6, max: 6 },
            scale: { start: 0.8, end: 0 },
            alpha: { start: 0.3, end: 0 },
            lifespan: { min: 700, max: 1100 },
            frequency: 120,
            quantity: 1,
            tint: 0xd3efff
        }).setDepth(33);

        this.objectTrailEmitter = this.add.particles(0, 0, 'particle', {
            speed: { min: 8, max: 22 },
            scale: { start: 0.7, end: 0 },
            alpha: { start: 0.34, end: 0 },
            lifespan: { min: 180, max: 280 },
            frequency: -1,
            quantity: 1,
            tint: 0xffffff
        }).setDepth(42);
    }

    update(time, delta) {
        const dt = Math.min(delta / 1000, 0.033);
        const t = time / 1000;
        if (this.gameStarted && !this.dead) this.elapsedMs = Date.now() - this.startTime;

        this.updateWind(t, dt);
        this.updateParallax(dt);
        this.updatePlayer(dt, t);
        if (this.gameStarted || this.deathAnimating) {
            this.updateObstacles(dt);
        }
        if (this.gameStarted && !this.dead) {
            this.spawnLogic(dt);
        }

        if (!this.dead) {
            this.updateKite(dt, t);
            this.updateScoring(dt);
            this.updateGroundPenalty(dt);
        } else if (this.deathAnimating) {
            this.updateDeathAnimation(dt);
        }

        this.drawString();
        this.updateTailPhysics(dt);
        this.updateCatHazard(dt);
        this.drawTail();
        this.updateHUD();
    }

    updateWeather(dt, t) {
        this.dayPhase = (this.dayPhase + dt / DAY_DURATION_SEC) % 1;
        const dayLight = Math.sin(this.dayPhase * Math.PI);
        this.dayNightOverlay.fillAlpha = Phaser.Math.Clamp(0.62 - dayLight * 0.55, 0.05, 0.62);

        this.weatherTimer -= dt;
        if (this.weatherTimer <= 0) {
            const next = Phaser.Utils.Array.GetRandom(this.weatherKeys);
            this.currentWeatherKey = next;
            this.currentWeather = WEATHER[next];
            this.weatherTimer = Phaser.Math.FloatBetween(WEATHER_MIN_SEC, WEATHER_MAX_SEC);
            if (!this.dead) this.setTransientStatus(`Weather: ${this.currentWeather.name}`, 1100);
        }

        const targetRain = this.currentWeather.rainIntensity || 0;
        this.rainAlpha = Phaser.Math.Linear(this.rainAlpha, targetRain, Math.min(1, dt * 2.5));
        this.rainEmitter.setFrequency(Phaser.Math.Linear(140, 20, this.rainAlpha));
        this.rainEmitter.setAlpha({ start: 0.25 * this.rainAlpha, end: 0 });

        if (this.currentWeather.lightningChance && Math.random() < this.currentWeather.lightningChance) {
            this.triggerLightning();
        }

        if (this.windEmitter) {
            const windFx = Phaser.Math.Clamp(Math.abs(this.windX) / 80, 0.2, 1.8);
            this.windEmitter.setFrequency(Phaser.Math.Linear(180, 55, windFx));
            const minSx = -30 - windFx * 30;
            const maxSx = -10 - windFx * 10;
            if (typeof this.windEmitter.setSpeedX === 'function') {
                this.windEmitter.setSpeedX({ min: minSx, max: maxSx });
            } else if (typeof this.windEmitter.setSpeed === 'function') {
                this.windEmitter.setSpeed({ min: Math.abs(maxSx), max: Math.abs(minSx) });
                if (typeof this.windEmitter.setAngle === 'function') {
                    this.windEmitter.setAngle({ min: 170, max: 190 });
                }
            }
            this.windEmitter.setAlpha({ start: 0.15 + windFx * 0.08, end: 0 });
        }
    }

    triggerLightning() {
        this.lightningFlash.fillAlpha = 0.85;
        this.cameras.main.shake(120, 0.006);
        this.time.delayedCall(70, () => {
            this.lightningFlash.fillAlpha = 0.28;
            this.time.delayedCall(70, () => { this.lightningFlash.fillAlpha = 0; });
        });
    }

    updateWind(t, dt) {
        this.windStageTimer -= dt;
        if (this.windStageTimer <= 0) {
            this.windStageIndex = Phaser.Math.Between(0, WIND_STAGES.length - 1);
            if (Math.random() < 0.7) this.windDirection *= -1;
            const stageCfg = WIND_STAGES[this.windStageIndex];
            this.windStageTimer = Phaser.Math.FloatBetween(stageCfg.durationMin, stageCfg.durationMax);
        }

        const stage = WIND_STAGES[this.windStageIndex];
        this.windStageForce = stage.speed;

        const weatherWind = this.currentWeather.windMod || 1;
        const gust1 = Math.sin(t * WIND_GUST_FREQ * Math.PI * 2) * WIND_GUST_AMP * 0.45 * stage.gust;
        const gust2 = Math.sin(t * WIND_GUST_FREQ * 2.8 + 1.3) * WIND_GUST_AMP * 0.22 * stage.gust;
        const dirBase = 34 * stage.speed * this.windDirection;
        const targetWindX = (dirBase + gust1 + gust2) * weatherWind;
        const targetWindY = (WIND_BASE_Y * stage.speed) + Math.cos(t * WIND_GUST_FREQ * 1.5) * WIND_GUST_AMP * 0.2 * stage.gust;

        const windBlend = Math.min(1, dt * 1.6);
        this.windX = Phaser.Math.Linear(this.windX, targetWindX, windBlend);
        this.windY = Phaser.Math.Linear(this.windY, targetWindY, windBlend);
    }

    updateParallax(dt) {
        if (!this.parallax) return;
        const wind = this.windX || WIND_BASE_X;

        const dtBlend = Math.min(1, dt * 9);
        this.cloudDtSmooth = Phaser.Math.Linear(this.cloudDtSmooth, dt, dtBlend);

        const windBlend = Math.min(1, dt * 1.4);
        this.cloudWindX = Phaser.Math.Linear(this.cloudWindX, wind, windBlend);

        const backTargetVX = Phaser.Math.Clamp(this.cloudWindX * 0.11, -18, 18);
        const frontTargetVX = Phaser.Math.Clamp(this.cloudWindX * 0.17, -28, 28);
        const speedBlend = Math.min(1, dt * 2.2);
        this.cloudBackVX = Phaser.Math.Linear(this.cloudBackVX, backTargetVX, speedBlend);
        this.cloudFrontVX = Phaser.Math.Linear(this.cloudFrontVX, frontTargetVX, speedBlend);
        this.parallax.cloudsBack.tilePositionX += this.cloudBackVX * this.cloudDtSmooth;
        this.parallax.cloudsFront.tilePositionX += this.cloudFrontVX * this.cloudDtSmooth;

        if (this.sceneryGreenLayer) {
            const t = this.time.now * 0.001;
            const sway = Math.sin(t * Math.PI * 2 * SCENERY_JITTLE_FREQ) * SCENERY_JITTLE_AMP;
            this.sceneryGreenLayer.x = this.sceneryBaseX + sway;
        }
    }

    updatePlayer(dt, t) {
        const targetX = Phaser.Math.Clamp(this.pointerX, 30, GAME_W - 30);
        const prevX = this.player.x;
        const dx = targetX - this.player.x;
        const maxStep = PLAYER_WALK_SPEED * dt;
        if (Math.abs(dx) <= maxStep) this.player.x = targetX;
        else this.player.x += Math.sign(dx) * maxStep;
        this.player.y = PLAYER_Y;
        this.player.flipX = this.pointerX < this.player.x;

        if (this.usingCharacterSprite) {
            const moved = Math.abs(this.player.x - prevX);
            const animKey = moved > 0.08 ? 'player_walk' : 'player_idle';
            if (this.player.anims.currentAnim?.key !== animKey) {
                this.player.play(animKey, true);
            }
        }
    }

    updateKite(dt, t) {
        const aimX = this.pointerX;
        const aimY = this.pointerY;

        const dx = aimX - this.kite.x;
        const dy = aimY - this.kite.y;
        const springBase = this.currentKite.spring || KITE_SPRING;
        const spring = this.pointerDown ? springBase * BOOST_MULTI : springBase;

        this.kiteVX += dx * spring * dt * 0.05;
        this.kiteVY += dy * spring * dt * 0.05;

        const gravityMod = this.currentWeather.gravityMod || 1;
        this.kiteVY += (this.currentKite.gravity || KITE_GRAVITY) * gravityMod * dt;
        this.kiteVX += this.windX * dt;
        this.kiteVY += this.windY * dt;
        this.kiteVX += Math.sin(t * 7.8) * 3 * dt;

        this.kiteVX -= this.kiteVX * (this.currentKite.drag || KITE_DRAG) * dt;
        this.kiteVY -= this.kiteVY * (this.currentKite.drag || KITE_DRAG) * dt;

        const speed = Math.hypot(this.kiteVX, this.kiteVY);
        const maxVel = this.currentKite.maxVel || MAX_VEL;
        if (speed > maxVel) {
            const r = maxVel / speed;
            this.kiteVX *= r;
            this.kiteVY *= r;
        }

        const handX = this.player.x;
        const handY = this.player.y - 22;
        const targetLength = this.pointerDown ? STRING_MIN_LENGTH : STRING_MAX_LENGTH;
        const reelSpeed = this.pointerDown ? STRING_REEL_IN_SPEED : STRING_RELEASE_SPEED;
        const deltaLen = reelSpeed * dt;
        if (this.stringLength < targetLength) {
            this.stringLength = Math.min(targetLength, this.stringLength + deltaLen);
        } else if (this.stringLength > targetLength) {
            this.stringLength = Math.max(targetLength, this.stringLength - deltaLen);
        }
        const dist = Phaser.Math.Distance.Between(this.kite.x, this.kite.y, handX, handY);
        if (dist > this.stringLength) {
            const excess = dist - this.stringLength;
            const px = (handX - this.kite.x) / dist;
            const py = (handY - this.kite.y) / dist;
            this.kiteVX += px * excess * STRING_PULL_K * dt;
            this.kiteVY += py * excess * STRING_PULL_K * dt;
        }

        this.kite.x += this.kiteVX * dt;
        this.kite.y += this.kiteVY * dt;
        this.kite.x = Phaser.Math.Clamp(this.kite.x, 14, GAME_W - 14);
        // Keep kite above tiles layer (with margin for kite height ~14px from center)
        this.kite.y = Phaser.Math.Clamp(this.kite.y, 14, this.kiteGroundY);

        if (speed > 5) {
            const targetAngle = Math.atan2(this.kiteVY, this.kiteVX);
            this.kite.rotation = Phaser.Math.Linear(this.kite.rotation, Phaser.Math.Clamp(targetAngle, -0.65, 0.65), 0.08);
        }
    }

    spawnLogic(dt) {
        this.spawnTimer -= dt;
        if (this.spawnTimer > 0) return;

        const speedTier = Math.floor(this.score / 10);
        this.spawnEvery = Phaser.Math.Clamp(1.2 - speedTier * 0.06, 0.5, 1.2);
        this.spawnTimer = this.spawnEvery;
        this.spawnObstacle(speedTier);
    }

    spawnObstacle(speedTier) {
        const available = [];
        if (this.textures.exists('paper1')) available.push('paper1');
        if (this.textures.exists('paper2')) available.push('paper2');
        if (this.textures.exists('chicken1')) available.push('chicken1');
        if (this.textures.exists('chicken2')) available.push('chicken2');
        const key = available.length
            ? Phaser.Utils.Array.GetRandom(available)
            : 'rock';

        const y = Phaser.Math.Between(36, GROUND_Y - 48);
        const fromLeft = Math.random() < 0.5;
        const spawnX = fromLeft ? -26 : GAME_W + 26;
        const o = this.obstacles.create(spawnX, y, key);
        o.setDepth(43);
        o.body.setAllowGravity(false);

        const baseSpeed = 72 + speedTier * 13;
        const speed = Phaser.Math.Clamp(baseSpeed + Phaser.Math.Between(0, 24), 72, 260);
        const dir = fromLeft ? 1 : -1;
        const vx = speed * dir;
        const vy = Phaser.Math.Between(-18, 18);
        o.body.setVelocity(vx, vy);

        o.setData('passed', false);
        o.setData('kind', key);
        o.setData('dir', dir);
        o.setData('speed', speed);
        o.setData('turnTimer', Phaser.Math.FloatBetween(1.2, 2.8));
        o.setData('prevX', o.x);

        if (key === 'chicken1' || key === 'chicken2') {
            o.play(key + '_fly');
            o.setScale(0.5);
            o.body.setSize(14, 14, true);
        } else if (key === 'paper1' || key === 'paper2') {
            o.setScale(0.4);
            o.body.setSize(10, 10, true);
        }
    }

    updateObstacles(dt) {
        const children = this.obstacles.getChildren();
        for (let i = children.length - 1; i >= 0; i--) {
            const o = children[i];
            const crashed = o.getData('crashed') === true;
            const obstacleHalfH = (o.displayHeight || 20) * 0.5;
            const obstacleGroundY = TILES_GROUND_Y - obstacleHalfH - 1;

            if (crashed) {
                let fallVx = o.getData('fallVx') || 0;
                let fallVy = o.getData('fallVy') || 0;
                let spinV = o.getData('spinV') || 0;
                let groundedAt = o.getData('groundedAt') || 0;

                fallVy += 760 * dt;
                o.x += fallVx * dt;
                o.y += fallVy * dt;
                o.rotation += spinV * dt;

                if (o.y >= obstacleGroundY) {
                    o.y = obstacleGroundY;
                    if (!groundedAt) groundedAt = this.time.now;
                    fallVy = 0;
                    fallVx *= 0.8;
                    spinV *= 0.78;
                }

                o.setData('fallVx', fallVx);
                o.setData('fallVy', fallVy);
                o.setData('spinV', spinV);
                o.setData('groundedAt', groundedAt);
            } else if (o.body) {
                let dir = o.getData('dir') || -1;
                let turnTimer = o.getData('turnTimer') || 0;
                turnTimer -= dt;
                if (turnTimer <= 0) {
                    if (Math.random() < 0.4) dir *= -1;
                    turnTimer = Phaser.Math.FloatBetween(1.3, 3.1);
                    o.setData('dir', dir);
                }
                o.setData('turnTimer', turnTimer);

                const baseSpeed = o.getData('speed') || 140;
                const targetVx = dir * baseSpeed + this.windX * 0.55;
                const vx = Phaser.Math.Linear(o.body.velocity.x, targetVx, Math.min(1, dt * 2.3));
                o.body.setVelocityX(vx);

                if (o.y > obstacleGroundY) {
                    o.y = obstacleGroundY;
                    o.body.setVelocityY(-Math.max(8, o.body.velocity.y * 0.35));
                }
            }

            if (o.x < -70 || o.x > GAME_W + 70 || o.y < -40 || o.y > GAME_H + 40) {
                o.destroy();
                continue;
            }

            if (crashed) {
                const groundedAt = o.getData('groundedAt') || 0;
                if (groundedAt) {
                    const groundedAge = this.time.now - groundedAt;
                    if (groundedAge > 700) {
                        const blink = Math.floor((groundedAge - 700) / 80) % 2 === 0;
                        o.setVisible(blink);
                    } else {
                        o.setVisible(true);
                    }
                    if (groundedAge > 1250) {
                        o.destroy();
                        continue;
                    }
                }
            }

            if (crashed && o.y >= obstacleGroundY) {
                // Settled crashed objects are no longer interactive.
                o.setData('passed', true);
            }

            if (!crashed && (o.getData('kind') === 'chicken1' || o.getData('kind') === 'chicken2') && o.body) {
                if (Math.abs(o.body.velocity.x) > 2) {
                    o.flipX = o.body.velocity.x > 0;
                }
            } else if (!crashed && (o.getData('kind') === 'paper1' || o.getData('kind') === 'paper2') && o.body) {
                if (Math.abs(o.body.velocity.x) > 2) {
                    o.flipX = o.body.velocity.x < 0;
                }
            }

            if (!crashed && this.objectTrailEmitter && o.body && Math.random() < 0.55) {
                const vx = o.body.velocity.x || 0;
                const vy = o.body.velocity.y || 0;
                const mag = Math.max(1, Math.hypot(vx, vy));
                const tx = o.x - (vx / mag) * 8;
                const ty = o.y - (vy / mag) * 4;
                this.objectTrailEmitter.emitParticleAt(tx, ty, 1);
            }

            o.setData('prevX', o.x);
        }
    }

    updateScoring(dt) {
        void dt;
        if (this.gameStarted) {
            this.score = Math.floor(this.elapsedMs / 1000);
        }
        if (this.score > this.best) {
            this.best = this.score;
            localStorage.setItem('storm_runner_best', String(Math.floor(this.best)));
            const before = this.unlockedKites.length;
            this.refreshKiteUnlocks();
            if (this.unlockedKites.length > before && this.time.now - this.lastUnlockAt > 1200) {
                const newest = this.unlockedKites[this.unlockedKites.length - 1];
                this.lastUnlockAt = this.time.now;
            }
        }
    }

    updateGroundPenalty(dt) {
        // Check if kite is riding the ground clamp (with tiny tolerance).
        const isOnGround = this.kite.y >= this.kiteGroundY - 0.5;

        if (isOnGround) {
            this.groundTimer += dt;

            // Take damage after threshold
            if (this.groundTimer >= this.groundDamageThreshold) {
                const timeSinceLastDamage = this.time.now - this.lastGroundDamageTime;
                if (timeSinceLastDamage > 800) { // Don't damage every frame, add cooldown
                    this.hp -= 1;
                    this.lives = this.hp;
                    this.lastGroundDamageTime = this.time.now;
                    this.groundTimer = this.groundDamageThreshold - 0.5; // Keep near threshold for repeated damage

                    // Visual feedback
                    this.cameras.main.shake(100, 0.008);
                    this.playTone(150, 200, 0.035, 'sawtooth');
                    this.kite.setTint(0xff5a5a);
                    this.time.delayedCall(100, () => this.kite.setTint(0xffffff));

                    // Damage particles
                    const burst = this.add.particles(this.kite.x, this.kite.y, 'particle', {
                        speed: { min: 30, max: 80 },
                        scale: { start: 0.8, end: 0 },
                        lifespan: 400,
                        quantity: 10,
                        tint: 0xff6e6e,
                        emitting: false
                    });
                    burst.explode(10);
                    this.time.delayedCall(450, () => burst.destroy());

                    if (this.hp <= 0) {
                        this.triggerDeath();
                    }
                }
            }
        } else {
            this.groundTimer = Math.max(0, this.groundTimer - dt * 2); // Decay faster when off ground
        }
    }

    onHit(_kite, obstacle) {
        if (this.dead) return;
        if (this.time.now < this.hitUntil) return;
        if (obstacle.getData('crashed')) return;

        this.hitUntil = this.time.now + HIT_IFRAME_MS;
        this.hp -= 1;
        this.lives = this.hp;

        const crashVX = (obstacle.body?.velocity.x || 0) * 0.35;
        const crashVY = Math.min(-90, (obstacle.body?.velocity.y || 0) - 40);
        obstacle.setData('crashed', true);
        obstacle.setData('fallVx', crashVX);
        obstacle.setData('fallVy', crashVY);
        obstacle.setData('spinV', Phaser.Math.FloatBetween(-4.5, 4.5));
        obstacle.setData('groundedAt', 0);
        obstacle.setData('passed', true);
        if (obstacle.body) {
            obstacle.body.enable = false;
            obstacle.body.setVelocity(0, 0);
        }

        this.cameras.main.shake(140, 0.01);
        this.playTone(180, 120, 0.03, 'sawtooth');

        this.kite.setTint(0xff5a5a);
        this.time.delayedCall(120, () => this.kite.setTint(0xffffff));

        const burst = this.add.particles(this.kite.x, this.kite.y, 'particle', {
            speed: { min: 45, max: 120 },
            scale: { start: 1.1, end: 0 },
            lifespan: 500,
            quantity: 14,
            tint: 0xffd6a5,
            emitting: false
        });
        burst.explode(14);
        const sparks = this.add.particles(this.kite.x, this.kite.y, 'particle', {
            speed: { min: 80, max: 170 },
            scale: { start: 1.2, end: 0 },
            lifespan: 350,
            quantity: 10,
            tint: 0xfff1a8,
            emitting: false
        });
        sparks.explode(10);
        this.time.delayedCall(600, () => burst.destroy());
        this.time.delayedCall(420, () => sparks.destroy());

        if (this.hp <= 0) {
            this.triggerDeath();
        }
    }

    triggerDeath() {
        if (this.dead) return;
        const finalScore = this.score;
        this.gameStarted = false;
        this.score = 0;
        this.elapsedMs = 0;
        this.startTime = 0;
        this.dead = true;
        this.deathAnimating = true;
        this.kite.alpha = 1;
        this.deathVX = Phaser.Math.Between(-40, 40);
        this.deathVY = -60; // Initial pop upward
        this.deathPhase = 'fall'; // fall, ground, flat, rise
        this.deathRotationSpeed = Phaser.Math.Between(-3, 3);
        this.deathGroundY = TILES_GROUND_Y - 8; // Where kite lands
        this.deathRiseStartAt = 0;
        const children = this.obstacles.getChildren();
        for (let i = 0; i < children.length; i++) {
            const o = children[i];
            if (!o || !o.active || o.getData('crashed')) continue;
            const crashVX = (o.body?.velocity.x || 0) * 0.35;
            const crashVY = Math.min(-70, (o.body?.velocity.y || 0) - 30);
            o.setData('crashed', true);
            o.setData('fallVx', crashVX);
            o.setData('fallVy', crashVY);
            o.setData('spinV', Phaser.Math.FloatBetween(-4.2, 4.2));
            o.setData('groundedAt', 0);
            o.setData('passed', true);
            if (o.body) {
                o.body.enable = false;
                o.body.setVelocity(0, 0);
            }
        }
        this.playTone(110, 360, 0.04, 'triangle');

        // Submit score to leaderboard if > 0
        if (finalScore > 0) {
            this.submitScoreToLeaderboard(finalScore);
        }
    }

    respawnKite() {
        this.dead = false;
        this.deathAnimating = false;
        this.hp = START_HP;
        this.lives = START_HP;
        this.hitUntil = this.time.now + 900;
        this.groundTimer = 0;
        this.lastGroundDamageTime = this.time.now;

        this.kite.x = Phaser.Math.Clamp(this.kite.x, 14, GAME_W - 14);
        this.kite.y = Phaser.Math.Clamp(KITE_RETURN_TARGET_Y, 14, this.kiteGroundY - 12);
        this.kiteVX = 0;
        this.kiteVY = 0;
        this.kite.rotation = 0;
        this.kite.alpha = 1;
        this.kite.setTint(0xffffff);
        this.rebuildTail();
        this.tailGroundTouch = false;
        this.tailGroundTouchPrev = false;
    }

    biteByCat() {
        if (this.dead) return;
        if (this.time.now < this.hitUntil) return;

        this.hitUntil = this.time.now + HIT_IFRAME_MS;
        this.hp -= 1;
        this.lives = this.hp;
        this.cameras.main.shake(110, 0.009);
        this.playTone(165, 120, 0.032, 'sawtooth');

        this.kite.setTint(0xff6b6b);
        this.time.delayedCall(120, () => this.kite.setTint(0xffffff));

        const biteFx = this.add.particles(this.kite.x, this.kite.y, 'particle', {
            speed: { min: 40, max: 110 },
            scale: { start: 0.9, end: 0 },
            lifespan: 360,
            quantity: 10,
            tint: 0xffb3b3,
            emitting: false
        });
        biteFx.explode(10);
        this.time.delayedCall(380, () => biteFx.destroy());
        this.catRunUntil = this.time.now + 520;

        if (this.hp <= 0) {
            this.triggerDeath();
        }
    }

    drawString() {
        this.stringGfx.clear();
        const handX = this.player.x;
        const handY = this.player.y - 22;
        const kiteX = this.kite.x;
        const kiteY = this.kite.y;

        const midX = (kiteX + handX) / 2;
        const midY = (kiteY + handY) / 2 + 18;
        const dots = 24;
        for (let i = 0; i <= dots; i++) {
            const tt = i / dots;
            const inv = 1 - tt;
            const x = inv * inv * kiteX + 2 * inv * tt * midX + tt * tt * handX;
            const y = inv * inv * kiteY + 2 * inv * tt * midY + tt * tt * handY;
            const alpha = Phaser.Math.Linear(0.2, 0.95, tt);
            const r = Phaser.Math.Linear(1.5, 0.8, tt);
            this.stringGfx.fillStyle(0xffffff, alpha);
            this.stringGfx.fillCircle(x, y, r);
        }
    }

    updateTailPhysics(dt) {
        if (!this.tailNodes || this.tailNodes.length === 0) return;
        const rootX = this.kite.x;
        const rootY = this.kite.y + 13;
        this.tailNodes[0].x = rootX;
        this.tailNodes[0].y = rootY;
        this.tailNodes[0].px = rootX;
        this.tailNodes[0].py = rootY;

        let groundContacts = 0;
        let groundXSum = 0;
        for (let i = 1; i < this.tailNodes.length; i++) {
            const p = this.tailNodes[i];
            const vx = (p.x - p.px) * 0.9;
            const vy = (p.y - p.py) * 0.9 + 0.9;
            p.px = p.x;
            p.py = p.y;
            p.x += vx + this.windX * 0.01 * this.windStageForce * dt * 60;
            p.y += vy + this.windY * 0.007 * this.windStageForce * dt * 60;

            // Ground collision for tail - prevent passing through tiles
            if (p.y > TILES_GROUND_Y - 5) {
                p.y = TILES_GROUND_Y - 5;
                // Dampen velocity when hitting ground
                p.px = p.x - vx * 0.3;
                p.py = p.y;
                groundContacts += 1;
                groundXSum += p.x;
            }
        }

        for (let iter = 0; iter < 2; iter++) {
            this.tailNodes[0].x = rootX;
            this.tailNodes[0].y = rootY;
            for (let i = 1; i < this.tailNodes.length; i++) {
                const a = this.tailNodes[i - 1];
                const b = this.tailNodes[i];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const d = Math.max(0.001, Math.hypot(dx, dy));
                const diff = (d - TAIL_SEG_LEN) / d;
                b.x -= dx * diff;
                b.y -= dy * diff;

                // Enforce ground constraint after constraint solving
                if (b.y > TILES_GROUND_Y - 5) {
                    b.y = TILES_GROUND_Y - 5;
                    groundContacts += 1;
                    groundXSum += b.x;
                }
            }
        }

        this.tailGroundTouch = groundContacts > 0;
        if (groundContacts > 0) {
            this.tailGroundTouchX = groundXSum / groundContacts;
        }
    }

    updateCatHazard(dt) {
        if (!this.cat) return;

        this.catWanderTimer -= dt;
        if (this.catWanderTimer <= 0) {
            const localMin = Phaser.Math.Clamp(this.cat.x - CAT_WANDER_RADIUS, 18, GAME_W - 18);
            const localMax = Phaser.Math.Clamp(this.cat.x + CAT_WANDER_RADIUS, 18, GAME_W - 18);
            this.catTargetX = Phaser.Math.Between(localMin, localMax);
            this.catWanderTimer = Phaser.Math.FloatBetween(2.8, 5.2);
        }

        const running = this.time.now < this.catRunUntil;
        const catSpeed = running ? CAT_WANDER_SPEED * 1.8 : CAT_WANDER_SPEED;
        const maxStep = catSpeed * dt;
        const dx = this.catTargetX - this.cat.x;
        if (Math.abs(dx) <= maxStep) this.cat.x = this.catTargetX;
        else this.cat.x += Math.sign(dx) * maxStep;
        const catVx = this.catTargetX - this.cat.x;
        if (Math.abs(catVx) > 0.8) this.cat.flipX = catVx > 0;

        if (this.anims.exists('cat_idle')) {
            const moving = Math.abs(catVx) > 0.6;
            let animKey = 'cat_idle';
            if (running) animKey = 'cat_run';
            else if (moving) animKey = 'cat_walk';
            if (this.cat.anims.currentAnim?.key !== animKey) {
                this.cat.play(animKey, true);
            }
        }

        if (!this.dead) {
            const justTouchedGround = this.tailGroundTouch && !this.tailGroundTouchPrev;
            if (justTouchedGround && this.time.now >= this.catNextBiteAt) {
                this.catNextBiteAt = this.time.now + CAT_BITE_COOLDOWN_MS;
                if (Math.random() < CAT_BITE_CHANCE) {
                    this.biteByCat();
                }
            }
        }

        this.tailGroundTouchPrev = this.tailGroundTouch;
    }

    drawTail() {
        this.trailGfx.clear();
        if (!this.tailNodes || this.tailNodes.length < 2) return;

        const color = this.currentKite?.color || 0xff9a3d;
        this.trailGfx.lineStyle(2, color, 0.78);
        this.trailGfx.beginPath();
        this.trailGfx.moveTo(this.tailNodes[0].x, this.tailNodes[0].y);
        for (let i = 1; i < this.tailNodes.length; i++) {
            this.trailGfx.lineTo(this.tailNodes[i].x, this.tailNodes[i].y);
        }
        this.trailGfx.strokePath();

        for (let i = 2; i < this.tailNodes.length; i += 2) {
            this.trailGfx.fillStyle(color, 0.72);
            this.trailGfx.fillCircle(this.tailNodes[i].x, this.tailNodes[i].y, 1.6);
        }
    }

    updateDeathAnimation(dt) {
        const gravity = 800;

        if (this.deathPhase === 'fall') {
            // Apply gravity
            this.deathVY += gravity * dt;
            this.kite.x += this.deathVX * dt;
            this.kite.y += this.deathVY * dt;
            this.kite.rotation += this.deathRotationSpeed * dt;

            // Check if hit ground
            if (this.kite.y >= this.deathGroundY) {
                this.kite.y = this.deathGroundY;
                this.deathPhase = 'ground';
                this.deathVY = 0;
                this.deathVX = 0;
                // Small bounce effect
                this.cameras.main.shake(80, 0.008);
                this.playTone(80, 150, 0.03, 'sawtooth');
            }
        } else if (this.deathPhase === 'ground') {
            // Kite is on ground - slow down rotation to lay flat
            const targetRotation = Math.PI / 2; // Laying flat (90 degrees)
            const rotDiff = targetRotation - this.kite.rotation;
            this.kite.rotation += rotDiff * 3 * dt;

            // Apply friction to slide along ground
            this.kite.x += this.deathVX * dt;
            this.deathVX *= 0.9;

            // Check if nearly flat and stopped
            if (Math.abs(rotDiff) < 0.1 && Math.abs(this.deathVX) < 5) {
                this.deathPhase = 'flat';
                this.kite.rotation = targetRotation;
            }

            // Keep on ground
            this.kite.y = this.deathGroundY;
        } else if (this.deathPhase === 'flat') {
            // Pause briefly on the ground before returning to the sky.
            this.kite.y = this.deathGroundY;
            this.kite.rotation = Math.PI / 2;
            if (!this.deathRiseStartAt) {
                this.deathRiseStartAt = this.time.now + KITE_RETURN_PAUSE_MS;
            } else if (this.time.now >= this.deathRiseStartAt) {
                this.deathPhase = 'rise';
            }
        } else if (this.deathPhase === 'rise') {
            this.kite.rotation = Phaser.Math.Angle.RotateTo(this.kite.rotation, 0, dt * 1.7);
            this.kite.y -= KITE_RETURN_RISE_SPEED * dt;
            this.kite.x += this.windX * dt * 0.05;

            if (this.kite.y <= KITE_RETURN_TARGET_Y) {
                this.respawnKite();
            }
        }

    }

    updateHUD() {
        for (let i = 0; i < this.heartIcons.length; i++) {
            const alive = i < this.hp;
            this.heartIcons[i].setVisible(alive);
            this.heartIcons[i].setAlpha(alive ? 1 : 0.2);
        }
        this.scoreText.setText(`${this.score}`);
    }
}

const config = {
    type: Phaser.AUTO,
    width: GAME_W,
    height: GAME_H,
    parent: 'game-container',
    fps: {
        target: FPS_LIMIT,
        forceSetTimeOut: true
    },
    pixelArt: false,
    antialias: false,
    antialiasGL: false,
    roundPixels: false,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, RunnerScene]
};

new Phaser.Game(config);
