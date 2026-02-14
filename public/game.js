// ============================================================
//  LAGA LAYANG — Vibe-Coded Edition
//  Mouse controls · Player character · Practice NPC · Unique aesthetic
// ============================================================

const DEBUG_MODE = false;

const GAME_W = 640;
const GAME_H = 360;
const GROUND_Y = GAME_H - 50;
const CHARACTER_RISE_PCT = 0.7;
const CHARACTER_SPRITE_H = 30;
const CHARACTER_BASE_Y = GROUND_Y + 9 - Math.round(CHARACTER_SPRITE_H * CHARACTER_RISE_PCT);

// Terraria-style Spring Physics
const KITE_SPRING = 65;
const KITE_DRAG = 4.5;
const KITE_GRAVITY = 25;
const MAX_VEL = 250;
const SWAY_AMP = 5;
const SWAY_FREQ = 1.3;
const CURSOR_DEADZONE = 10;
const AIM_SMOOTH = 14;

// Wind
const WIND_BASE_X = -20;
const WIND_BASE_Y = -8;
const WIND_GUST_AMP = 45;
const WIND_GUST_FREQ = 0.12;

// String & Strain
const STRING_MAX_LENGTH = 240;
const STRING_MIN_LENGTH = 120;
const STRING_PULL_K = 12;
const STRING_HARD_PULL_K = 22;
const STRING_DAMPING_NEAR_LIMIT = 2.4;
const STRING_REEL_SPEED = 190;
const STRING_RELEASE_SPEED = 120;
const STRAIN_RATE = 30;
const STRAIN_DECAY = 22;
const STRAIN_THRESHOLD = 0.72;

// Boost (click/hold)
const BOOST_MULTI = 2.8;
const BOOST_STRAIN_COST = 6;

// Combat
const MAX_SPEED_FOR_CUT = 15;
const MAX_HEALTH = 100;
const MAX_LIVES = 3;
const STRING_SEGMENTS = 16;
const SLASH_COOLDOWN_MS = 280;
const SLASH_ADVANTAGE_MIN = 10;
const SLASH_DAMAGE_BASE = 16;
const SLASH_DAMAGE_SCALE = 0.12;

// Depth
const DEPTH_SCALE_MIN = 0.5;
const DEPTH_SCALE_MAX = 1.3;
const DEPTH_ALPHA_MIN = 0.6;
const DEPTH_ALPHA_MAX = 1.0;
const DEPTH_Y_TOP = 0;
const DEPTH_Y_BOT = GROUND_Y - 30;

// Vibe-coded palette
const C = {
    sky: '#0f0f1a',
    skyTop: '#0a0a12',
    ground: '#1a1a2e',
    groundTop: '#2a0f00',
    player1: '#ff9a3d',
    player1Dark: '#2a5f00',
    player2: '#b84300',
    player2Dark: '#7a2d00',
    tensionOk: '#f2600a',
    tensionWarn: '#f5a623',
    tensionCrit: '#ff2e63',
    string: '#ff9a3d',
    hudBg: '#0a0a12',
    text: '#ffe0c2',
    textDim: '#7a2a00',
    accent: '#b84300',
    npc: '#f2600a'
};

const LEADERBOARD_KEY = 'laga_layang_leaderboard_v1';
const PILOT_NAME_KEY = 'laga_layang_pilot_name_v1';
const LEADERBOARD_LIMIT = 7;

const NPC_ROSTER = [
    { name: 'SORA', aggression: 0.2, springMult: 0.9, maxVelMult: 0.9, strainMult: 0.85, tint: 0xffaa00 },
    { name: 'BAYU', aggression: 0.4, springMult: 1.0, maxVelMult: 1.0, strainMult: 1.0, tint: 0xff8a00 },
    { name: 'ARUNA', aggression: 0.6, springMult: 1.08, maxVelMult: 1.08, strainMult: 1.1, tint: 0xff6a00 },
    { name: 'RAKA', aggression: 0.8, springMult: 1.16, maxVelMult: 1.16, strainMult: 1.2, tint: 0xff4a00 },
    { name: 'GARUDA', aggression: 1.0, springMult: 1.24, maxVelMult: 1.24, strainMult: 1.3, tint: 0xff2e63 }
];

function mapRange(val, inMin, inMax, outMin, outMax) {
    const t = Phaser.Math.Clamp((val - inMin) / (inMax - inMin), 0, 1);
    return outMin + t * (outMax - outMin);
}

function hexToNum(hex) {
    return parseInt(hex.replace('#', ''), 16);
}

function moveToward(current, target, maxDelta) {
    const delta = target - current;
    if (Math.abs(delta) <= maxDelta) return target;
    return current + Math.sign(delta) * maxDelta;
}

function segmentOrientation(a, b, c) {
    const val = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
    if (Math.abs(val) < 1e-6) return 0;
    return val > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
    return (
        b.x <= Math.max(a.x, c.x) && b.x >= Math.min(a.x, c.x) &&
        b.y <= Math.max(a.y, c.y) && b.y >= Math.min(a.y, c.y)
    );
}

function segmentsIntersect(p1, q1, p2, q2) {
    const o1 = segmentOrientation(p1, q1, p2);
    const o2 = segmentOrientation(p1, q1, q2);
    const o3 = segmentOrientation(p2, q2, p1);
    const o4 = segmentOrientation(p2, q2, q1);

    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;
    return false;
}

function loadLeaderboard() {
    try {
        const raw = localStorage.getItem(LEADERBOARD_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
        return [];
    }
}

function saveLeaderboard(entries) {
    try {
        localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(entries));
    } catch (_err) {
        // Ignore storage errors; game remains playable.
    }
}

// ============================================================
//  BOOT SCENE
// ============================================================
class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }

    preload() {
        this.load.image('bgLayer', 'assets/background.png');
        this.load.image('sceneryLayer', 'assets/scenery.png');
        this.load.image('tilesLayer', 'assets/tiles.png');
    }

    create() {
        this.generateTextures();
        this.scene.start('Game');
    }

    generateTextures() {
        // Player sprite
        const playerGfx = this.make.graphics({ x: 0, y: 0, add: false });
        playerGfx.fillStyle(0x2a5f00);
        playerGfx.fillRect(6, 8, 12, 14);
        playerGfx.fillStyle(0x4a1c00);
        playerGfx.fillRect(7, 9, 10, 12);
        playerGfx.fillStyle(0x4a1c00);
        playerGfx.fillRect(8, 2, 8, 8);
        playerGfx.fillStyle(0x7a2d00);
        playerGfx.fillRect(9, 3, 6, 6);
        playerGfx.fillStyle(0xff9a3d);
        playerGfx.fillRect(10, 4, 2, 2);
        playerGfx.fillRect(12, 4, 2, 2);
        playerGfx.fillStyle(0x2a5f00);
        playerGfx.fillRect(7, 22, 3, 6);
        playerGfx.fillRect(14, 22, 3, 6);
        playerGfx.fillStyle(0xf2600a);
        playerGfx.fillRect(3, 10, 4, 3);
        playerGfx.fillRect(17, 8, 4, 3);
        playerGfx.generateTexture('player', 24, 30);
        playerGfx.destroy();

        // Kite texture
        const kiteGfx = this.make.graphics({ x: 0, y: 0, add: false });
        kiteGfx.fillStyle(0xff9a3d);
        kiteGfx.beginPath();
        kiteGfx.moveTo(16, 0);
        kiteGfx.lineTo(32, 16);
        kiteGfx.lineTo(16, 28);
        kiteGfx.lineTo(0, 16);
        kiteGfx.closePath();
        kiteGfx.fillPath();
        kiteGfx.fillStyle(0xb84300);
        kiteGfx.beginPath();
        kiteGfx.moveTo(16, 4);
        kiteGfx.lineTo(28, 16);
        kiteGfx.lineTo(16, 24);
        kiteGfx.lineTo(4, 16);
        kiteGfx.closePath();
        kiteGfx.fillPath();
        kiteGfx.fillStyle(0xff9a3d);
        kiteGfx.fillRect(14, 14, 4, 4);
        kiteGfx.lineStyle(1, 0xb84300);
        kiteGfx.beginPath();
        kiteGfx.moveTo(16, 0);
        kiteGfx.lineTo(16, 28);
        kiteGfx.moveTo(0, 16);
        kiteGfx.lineTo(32, 16);
        kiteGfx.strokePath();
        kiteGfx.generateTexture('kite', 32, 28);
        kiteGfx.destroy();

        // Kite shadow
        const shadowGfx = this.make.graphics({ x: 0, y: 0, add: false });
        shadowGfx.fillStyle(0x000000, 0.3);
        shadowGfx.beginPath();
        shadowGfx.moveTo(16, 0);
        shadowGfx.lineTo(32, 16);
        shadowGfx.lineTo(16, 28);
        shadowGfx.lineTo(0, 16);
        shadowGfx.closePath();
        shadowGfx.fillPath();
        shadowGfx.generateTexture('kiteShadow', 32, 28);
        shadowGfx.destroy();

        // Particle
        const partGfx = this.make.graphics({ x: 0, y: 0, add: false });
        partGfx.fillStyle(0xffffff);
        partGfx.fillRect(0, 0, 3, 3);
        partGfx.generateTexture('particle', 3, 3);
        partGfx.destroy();

        // Sparkle
        const sparkGfx = this.make.graphics({ x: 0, y: 0, add: false });
        sparkGfx.fillStyle(0xffffff);
        sparkGfx.fillRect(0, 0, 2, 2);
        sparkGfx.generateTexture('sparkle', 2, 2);
        sparkGfx.destroy();

        // Building
        const buildGfx = this.make.graphics({ x: 0, y: 0, add: false });
        buildGfx.fillStyle(0x1a1a2e);
        buildGfx.fillRect(0, 0, 40, 80);
        buildGfx.fillStyle(0x2a0f00);
        for (let y = 8; y < 70; y += 16) {
            for (let x = 6; x < 34; x += 10) {
                if (Math.random() > 0.3) {
                    buildGfx.fillStyle(0x4a1c00 + Math.floor(Math.random() * 0x101010));
                    buildGfx.fillRect(x, y, 5, 8);
                }
            }
        }
        buildGfx.generateTexture('building', 40, 80);
        buildGfx.destroy();

        // Tree
        const treeGfx = this.make.graphics({ x: 0, y: 0, add: false });
        treeGfx.fillStyle(0x1a2000);
        treeGfx.fillRect(12, 40, 6, 20);
        treeGfx.fillStyle(0x2a0f00);
        treeGfx.fillRect(0, 0, 30, 45);
        treeGfx.fillStyle(0x7a2d00);
        treeGfx.fillRect(2, 2, 26, 40);
        treeGfx.generateTexture('tree', 30, 60);
        treeGfx.destroy();

        // Grass
        const grassGfx = this.make.graphics({ x: 0, y: 0, add: false });
        grassGfx.fillStyle(0x7a2d00);
        grassGfx.fillRect(2, 6, 2, 4);
        grassGfx.fillRect(5, 4, 2, 6);
        grassGfx.fillRect(8, 5, 2, 5);
        grassGfx.generateTexture('grass', 12, 10);
        grassGfx.destroy();

        // Cloud
        const cloudGfx = this.make.graphics({ x: 0, y: 0, add: false });
        cloudGfx.fillStyle(0xb84300, 0.8);
        cloudGfx.fillRect(0, 8, 20, 8);
        cloudGfx.fillRect(8, 4, 16, 8);
        cloudGfx.fillRect(4, 0, 12, 8);
        cloudGfx.generateTexture('cloud', 30, 16);
        cloudGfx.destroy();

        // Star
        const starGfx = this.make.graphics({ x: 0, y: 0, add: false });
        starGfx.fillStyle(0xffffff, 0.8);
        starGfx.fillRect(0, 0, 2, 2);
        starGfx.generateTexture('star', 2, 2);
        starGfx.destroy();

        // Moon
        const moonGfx = this.make.graphics({ x: 0, y: 0, add: false });
        moonGfx.fillStyle(0xf2600a);
        moonGfx.fillCircle(20, 20, 18);
        moonGfx.fillStyle(0xb84300);
        moonGfx.fillCircle(15, 15, 4);
        moonGfx.fillCircle(25, 18, 3);
        moonGfx.fillCircle(18, 25, 3);
        moonGfx.fillStyle(0xf2600a);
        moonGfx.fillCircle(22, 24, 5);
        moonGfx.generateTexture('moon', 40, 40);
        moonGfx.destroy();

        // Cat sprite (ambient NPC)
        const catGfx = this.make.graphics({ x: 0, y: 0, add: false });
        catGfx.fillStyle(0x2a5f00);
        catGfx.fillRect(4, 8, 16, 10);
        catGfx.fillRect(6, 6, 3, 4);
        catGfx.fillRect(15, 6, 3, 4);
        catGfx.fillStyle(0x4a1c00);
        catGfx.fillRect(6, 10, 12, 6);
        catGfx.fillStyle(0xf2600a);
        catGfx.fillRect(8, 11, 2, 2);
        catGfx.fillRect(14, 11, 2, 2);
        catGfx.fillStyle(0x1a1a00);
        catGfx.fillRect(8, 15, 2, 3);
        catGfx.fillRect(14, 15, 2, 3);
        catGfx.fillRect(11, 14, 2, 4);
        catGfx.generateTexture('cat', 24, 18);
        catGfx.destroy();
    }
}

// ============================================================
//  PRACTICE NPC AI
// ============================================================
class PracticeNPC {
    constructor(scene) {
        this.scene = scene;
        this.active = false;
        this.state = 'idle';
        this.stateTimer = 0;
        this.kiteVX = 0;
        this.kiteVY = 0;
        this.strain = 0;
        this.sharpness = 0;
        this.speed = 0;
        this.boosting = false;
        this.stringLength = STRING_MAX_LENGTH;
        this.stringLengthTarget = STRING_MAX_LENGTH;
        this.profile = {
            name: 'SORA',
            aggression: 0.3,
            springMult: 1,
            maxVelMult: 1,
            strainMult: 1,
            tint: 0xffaa00
        };
        // Virtual cursor target (NPC "aims" here)
        this.targetX = GAME_W / 2;
        this.targetY = 100;
    }

    setProfile(profile) {
        this.profile = {
            ...this.profile,
            ...profile
        };
    }

    activate() {
        this.active = true;
        this.strain = 0;
        this.sharpness = 0;
        this.kiteVX = 0;
        this.kiteVY = 0;
        this.stringLength = STRING_MAX_LENGTH;
        this.stringLengthTarget = STRING_MAX_LENGTH;
        this.playerHealth = MAX_HEALTH;
        this.opponentHealth = MAX_HEALTH;
        this.lastSlashAt = 0;
        this.scene.opponentPlayer.setVisible(true);
        this.scene.opponentKite.setVisible(true);
        this.scene.opponentKite.setPosition(GAME_W / 2, 120);
        this.scene.opponentPlayer.setPosition(GAME_W / 2, CHARACTER_BASE_Y);
    }

    deactivate() {
        this.active = false;
        this.scene.opponentPlayer.setVisible(false);
        this.scene.opponentKite.setVisible(false);
        this.scene.opponentString.clear();
    }

    update(dt, time, playerKite) {
        if (!this.active) return;

        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
            this.makeDecision(playerKite);
        }
        this.executeState(dt, time, playerKite);

        // ── Same spring physics as player ──
        const kite = this.scene.opponentKite;
        const t = time / 1000;

        const dxToCursor = this.targetX - kite.x;
        const dyToCursor = this.targetY - kite.y;
        const springBase = this.boosting ? KITE_SPRING * BOOST_MULTI : KITE_SPRING;
        const spring = springBase * this.profile.springMult;
        const cursorDist = Math.sqrt(dxToCursor ** 2 + dyToCursor ** 2);
        const controlWeight = Phaser.Math.Clamp(
            (cursorDist - CURSOR_DEADZONE) / Math.max(cursorDist, 1),
            0,
            1
        );

        this.kiteVX += dxToCursor * controlWeight * spring * dt * 0.05;
        this.kiteVY += dyToCursor * controlWeight * spring * dt * 0.05;

        // Gravity + wind + sway
        this.kiteVY += KITE_GRAVITY * dt;
        this.kiteVX += (this.scene.windX || WIND_BASE_X) * dt;
        this.kiteVY += (this.scene.windY || WIND_BASE_Y) * dt;
        const sway = Math.sin(t * SWAY_FREQ * Math.PI * 2 + 2) * SWAY_AMP;
        this.kiteVX += sway * dt * 3;

        // Drag
        this.kiteVX -= this.kiteVX * KITE_DRAG * dt;
        this.kiteVY -= this.kiteVY * KITE_DRAG * dt;

        // Velocity cap
        const speed = Math.sqrt(this.kiteVX ** 2 + this.kiteVY ** 2);
        const npcMaxVel = MAX_VEL * this.profile.maxVelMult;
        if (speed > npcMaxVel) {
            const ratio = npcMaxVel / speed;
            this.kiteVX *= ratio;
            this.kiteVY *= ratio;
        }

        // String constraint
        this.stringLengthTarget = this.boosting ? STRING_MIN_LENGTH : STRING_MAX_LENGTH;
        const reelSpeed = this.boosting ? STRING_REEL_SPEED * 0.9 : STRING_RELEASE_SPEED * 0.9;
        this.stringLength = moveToward(this.stringLength, this.stringLengthTarget, reelSpeed * dt);

        const handX = this.scene.opponentPlayer.x;
        const handY = this.scene.opponentPlayer.y - 22;
        const stringDist = Phaser.Math.Distance.Between(kite.x, kite.y, handX, handY);
        if (stringDist > this.stringLength) {
            const excess = stringDist - this.stringLength;
            const pullDirX = (handX - kite.x) / stringDist;
            const pullDirY = (handY - kite.y) / stringDist;
            const pullK = STRING_PULL_K + Phaser.Math.Clamp(excess * 0.15, 0, STRING_HARD_PULL_K);
            this.kiteVX += pullDirX * excess * pullK * dt;
            this.kiteVY += pullDirY * excess * pullK * dt;

            const nearLimit = Phaser.Math.Clamp(excess / Math.max(this.stringLength, 1), 0, 1);
            this.kiteVX -= this.kiteVX * STRING_DAMPING_NEAR_LIMIT * nearLimit * dt;
            this.kiteVY -= this.kiteVY * STRING_DAMPING_NEAR_LIMIT * nearLimit * dt;
        }

        // Strain
        const strainFrac = stringDist / Math.max(this.stringLength, 1);
        if (strainFrac > STRAIN_THRESHOLD) {
            const intensity = (strainFrac - STRAIN_THRESHOLD) / (1 - STRAIN_THRESHOLD);
            this.strain = Math.min(100, this.strain + STRAIN_RATE * intensity * dt * 0.6 * this.profile.strainMult);
        } else {
            this.strain = Math.max(0, this.strain - STRAIN_DECAY * dt);
        }

        // Sharpness
        if (this.boosting) {
            this.sharpness = Math.min(100, this.sharpness + 10 * dt);
        } else if (speed > 40) {
            this.sharpness = Math.min(100, this.sharpness + 3 * dt);
        } else {
            this.sharpness = Math.max(0, this.sharpness - 6 * dt);
        }

        // Apply position
        kite.x += this.kiteVX * dt;
        kite.y += this.kiteVY * dt;
        kite.x = Phaser.Math.Clamp(kite.x, 15, GAME_W - 15);
        kite.y = Phaser.Math.Clamp(kite.y, 15, GROUND_Y - 30);

        // Tilt
        if (speed > 5) {
            const targetAngle = Math.atan2(this.kiteVY, this.kiteVX);
            const tiltAngle = Phaser.Math.Clamp(targetAngle, -0.6, 0.6);
            kite.rotation = Phaser.Math.Linear(kite.rotation, tiltAngle, 0.08);
        }

        this.speed = speed;

        // NPC player character follows kite X
        this.scene.opponentPlayer.x = Phaser.Math.Linear(
            this.scene.opponentPlayer.x,
            kite.x,
            0.05
        );
        this.scene.opponentPlayer.flipX = kite.x < this.scene.opponentPlayer.x;

        this.drawOpponentString();
    }

    makeDecision(playerKite) {
        const kite = this.scene.opponentKite;
        const dist = Phaser.Math.Distance.Between(kite.x, kite.y, playerKite.x, playerKite.y);
        const aggro = Phaser.Math.Clamp(this.profile.aggression, 0, 1);
        const playerThreat = this.scene.mySpeed + this.scene.sharpness * 0.4;
        const npcPower = this.speed + this.sharpness * 0.4;
        const playerBoosting = this.scene.mouseDown && playerThreat > npcPower - 8;
        const canAttack = dist < 95 - aggro * 20 && this.sharpness > 20 - aggro * 6;

        if (playerBoosting && dist < 140) {
            this.state = 'counter';
            this.stateTimer = 0.7 + Math.random() * 0.6;
        } else if (canAttack) {
            this.state = 'attacking';
            this.stateTimer = 1 + Math.random() * (1 - aggro * 0.4);
        } else if (this.strain > 65 - aggro * 10) {
            this.state = 'fleeing';
            this.stateTimer = 0.8 + Math.random();
        } else if (Math.random() < 0.22 + aggro * 0.35) {
            this.state = 'charging';
            this.stateTimer = 1 + Math.random() * 1.5;
        } else {
            this.state = 'roaming';
            this.stateTimer = 1.5 + Math.random() * 2;
        }
    }

    executeState(dt, time, playerKite) {
        const kite = this.scene.opponentKite;
        const aggro = Phaser.Math.Clamp(this.profile.aggression, 0, 1);
        const leadTime = 0.12 + aggro * 0.16;
        const predictedX = playerKite.x + (this.scene.kiteVX || 0) * leadTime;
        const predictedY = playerKite.y + (this.scene.kiteVY || 0) * leadTime;
        const px = Phaser.Math.Clamp(predictedX, 40, GAME_W - 40);
        const py = Phaser.Math.Clamp(predictedY, 40, GROUND_Y - 60);

        switch (this.state) {
            case 'roaming': {
                // Drift target around lazily
                this.targetX += (Math.sin(time / 1000 * 0.7) * 40 - (this.targetX - GAME_W / 2) * 0.3) * dt;
                this.targetY += (Math.cos(time / 1000 * 0.5) * 25 - (this.targetY - 100) * 0.2) * dt;
                this.boosting = false;
                break;
            }
            case 'charging': {
                // Move toward predicted player position
                this.targetX += (px - this.targetX) * (1.4 + aggro * 0.8) * dt;
                this.targetY += (py - this.targetY) * (1.4 + aggro * 0.8) * dt;
                this.boosting = false;
                break;
            }
            case 'attacking': {
                // Cross through predicted path for cleaner slash angle
                const offset = Math.sin(time / 1000 * 6) * (12 + aggro * 10);
                this.targetX = px + offset;
                this.targetY = py - 4 + Math.cos(time / 1000 * 5) * (8 + aggro * 6);
                this.boosting = true;
                break;
            }
            case 'counter': {
                // Sidestep then re-enter to punish boost commits
                const perp = Math.sign((this.scene.kiteVX || 0) + 0.001);
                this.targetX = px + perp * (30 + aggro * 20);
                this.targetY = py - (10 + aggro * 10);
                this.boosting = this.sharpness > 30;
                break;
            }
            case 'fleeing': {
                // Move target away from player kite, toward center
                const awayX = kite.x + (kite.x - playerKite.x) * 0.5;
                const awayY = 80 + Math.sin(time / 1000) * 30;
                this.targetX += (awayX - this.targetX) * 2 * dt;
                this.targetY += (awayY - this.targetY) * 2 * dt;
                this.boosting = false;
                break;
            }
        }

        // Keep target in bounds
        this.targetX = Phaser.Math.Clamp(this.targetX, 40, GAME_W - 40);
        this.targetY = Phaser.Math.Clamp(this.targetY, 40, GROUND_Y - 60);
    }

    drawOpponentString() {
        this.scene.opponentString.clear();
        if (!this.active) return;

        const kiteX = this.scene.opponentKite.x;
        const kiteY = this.scene.opponentKite.y;
        const playerX = this.scene.opponentPlayer.x;
        const playerY = this.scene.opponentPlayer.y - 22;

        const depth = mapRange(kiteY, DEPTH_Y_TOP, DEPTH_Y_BOT, 0, 1);

        let stringColor = C.string;
        if (this.strain > 60) stringColor = C.tensionCrit;

        this.scene.opponentString.lineStyle(1, hexToNum(stringColor), 0.15 + depth * 0.25);

        const midX = (kiteX + playerX) / 2;
        const midY = (kiteY + playerY) / 2 + 15 + (1 - depth) * 10;

        this.scene.opponentString.beginPath();
        this.scene.opponentString.moveTo(kiteX, kiteY);

        const steps = STRING_SEGMENTS;
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const invT = 1 - t;
            const x = invT * invT * kiteX + 2 * invT * t * midX + t * t * playerX;
            const y = invT * invT * kiteY + 2 * invT * t * midY + t * t * playerY;
            this.scene.opponentString.lineTo(x, y);
        }

        this.scene.opponentString.strokePath();
    }
}

// ============================================================
//  GAME SCENE
// ============================================================
class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    create() {
        this.isAlive = true;
        this.opponentAlive = true;
        this.matchStarted = false;
        this.strain = 0;
        this.mySpeed = 0;
        this.opponentSpeed = 0;
        this.playerNumber = 1;
        this.gameOver = false;
        this.sharpness = 0;
        this.opponentSharpness = 0;
        this.practiceMode = true;
        this.currentRound = 0;
        this.currentScore = 0;
        this.bestRound = 0;
        this.activeNpcProfile = null;
        this.leaderboard = loadLeaderboard();
        this.pilotName = localStorage.getItem(PILOT_NAME_KEY) || 'PILOT';
        this.playerHealth = MAX_HEALTH;
        this.opponentHealth = MAX_HEALTH;
        this.playerLives = MAX_LIVES;
        this.opponentLives = MAX_LIVES;
        this.lastSlashAt = 0;

        this.kiteVX = 0;
        this.kiteVY = 0;

        this.mouseX = GAME_W / 2;
        this.mouseY = GAME_H / 2;
        this.aimX = GAME_W / 2;
        this.aimY = GAME_H / 2;
        this.mouseDown = false;
        this.stringLength = STRING_MAX_LENGTH;
        this.stringLengthTarget = STRING_MAX_LENGTH;

        this.windX = 0;
        this.windY = 0;

        this.createBackground();

        this.clouds = [];
        this.cats = [];

        this.player = this.add.sprite(GAME_W / 2, CHARACTER_BASE_Y, 'player')
            .setOrigin(0.5, 1)
            .setDepth(50);

        this.kite = this.add.sprite(GAME_W / 2, 100, 'kite')
            .setOrigin(0.5, 0.5)
            .setDepth(46);
        this.physics.add.existing(this.kite);
        this.kite.body.setCollideWorldBounds(true);
        this.kite.body.setBounce(0.2);
        this.kite.body.setMaxVelocity(MAX_VEL, MAX_VEL);

        this.kiteShadow = this.add.sprite(GAME_W / 2, GROUND_Y + 5, 'kiteShadow')
            .setOrigin(0.5, 1)
            .setAlpha(0)
            .setDepth(49);

        this.stringGraphics = this.add.graphics().setDepth(48);
        this.tailGraphics = this.add.graphics().setDepth(47);

        this.opponentPlayer = this.add.sprite(-100, CHARACTER_BASE_Y, 'player')
            .setOrigin(0.5, 1)
            .setDepth(50)
            .setTint(0xffaa00)
            .setVisible(false);

        this.opponentKite = this.add.sprite(-100, -100, 'kite')
            .setOrigin(0.5, 0.5)
            .setTint(0xffaa00)
            .setDepth(46)
            .setVisible(false);
        this.physics.add.existing(this.opponentKite);
        this.opponentKite.body.setImmovable(true);
        this.opponentKite.body.setAllowGravity(false);

        this.opponentShadow = this.add.sprite(-100, GROUND_Y + 5, 'kiteShadow')
            .setOrigin(0.5, 1)
            .setAlpha(0)
            .setDepth(49);

        this.opponentString = this.add.graphics().setDepth(48);

        this.npc = new PracticeNPC(this);
        this.createHUD();
        this.setupInput();

        this.ambientParticles = this.add.particles(0, 0, 'star', {
            speed: { min: 2, max: 8 },
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.6, end: 0 },
            lifespan: 4000,
            frequency: 200,
            x: { min: 0, max: GAME_W },
            y: -10
        });

        this.windIndicator = this.add.graphics().setDepth(95);

        this.updateLeaderboardUI();
        this.startPracticeMode();
    }

    createBackground() {
        const hasBg = this.textures.exists('bgLayer');
        const hasScenery = this.textures.exists('sceneryLayer');
        const hasTiles = this.textures.exists('tilesLayer');

        if (hasBg && hasScenery && hasTiles) {
            this.add.image(GAME_W / 2, GAME_H / 2, 'bgLayer')
                .setDisplaySize(GAME_W, GAME_H)
                .setDepth(0);
            this.add.image(GAME_W / 2, GAME_H / 2, 'sceneryLayer')
                .setDisplaySize(GAME_W, GAME_H)
                .setDepth(5);
            this.add.image(GAME_W / 2, GAME_H / 2, 'tilesLayer')
                .setDisplaySize(GAME_W, GAME_H)
                .setDepth(20);
            return;
        }

        const bg = this.add.graphics();
        bg.fillStyle(hexToNum(C.skyTop));
        bg.fillRect(0, 0, GAME_W, GAME_H);
        bg.fillStyle(hexToNum(C.groundTop));
        bg.fillRect(0, GROUND_Y - 20, GAME_W, 20);
        bg.fillStyle(hexToNum(C.ground));
        bg.fillRect(0, GROUND_Y, GAME_W, GAME_H - GROUND_Y);
        bg.setDepth(0);
    }

    createParallaxLayers() {
        this.farBuildings = [];
        for (let i = 0; i < 8; i++) {
            const b = this.add.image(
                i * 90 - 20,
                GROUND_Y - 30,
                'building'
            ).setDepth(5).setOrigin(0, 1).setScale(1.2)
            b.setTint(0x1a1000);
            this.farBuildings.push(b);
        }

        this.nearBuildings = [];
        for (let i = 0; i < 6; i++) {
            const b = this.add.image(
                i * 120 - 30,
                GROUND_Y - 10,
                'building'
            ).setDepth(10).setOrigin(0, 1).setScale(1.5)
            b.setTint(0x1a1000);
            this.nearBuildings.push(b);
        }

        this.trees = [];
        for (let i = 0; i < 12; i++) {
            const t = this.add.image(
                Phaser.Math.Between(-20, GAME_W + 20),
                GROUND_Y,
                'tree'
            ).setDepth(15).setOrigin(0.5, 1);
            t.setScale(Phaser.Math.FloatBetween(0.6, 1));
            this.trees.push(t);
        }

        this.grass = [];
        for (let i = 0; i < 30; i++) {
            const g = this.add.image(
                Phaser.Math.Between(0, GAME_W),
                GROUND_Y + Phaser.Math.Between(-2, 4),
                'grass'
            ).setDepth(55).setOrigin(0.5, 1);
            g.setScale(Phaser.Math.FloatBetween(0.5, 0.8));
            this.grass.push(g);
        }

        this.clouds = [];
        for (let i = 0; i < 5; i++) {
            const c = this.add.image(
                Phaser.Math.Between(0, GAME_W),
                Phaser.Math.Between(20, 80),
                'cloud'
            ).setDepth(2).setOrigin(0, 0.5);
            c.setScale(Phaser.Math.FloatBetween(1, 2));
            c.setData('speed', Phaser.Math.FloatBetween(-5, -1));
            this.clouds.push(c);
        }
    }

    createAmbientNPCs() {
        this.cats = [];
        for (let i = 0; i < 2; i++) {
            const cat = this.add.image(
                Phaser.Math.Between(50, GAME_W - 50),
                GROUND_Y,
                'cat'
            ).setDepth(52).setOrigin(0.5, 1);
            cat.setData('speed', Phaser.Math.FloatBetween(10, 25));
            cat.setData('direction', Math.random() > 0.5 ? 1 : -1);
            cat.setData('waitTimer', Phaser.Math.FloatBetween(0, 3));
            this.cats.push(cat);
        }
    }

    updateAmbientNPCs(dt) {
        this.cats.forEach(cat => {
            let wait = cat.getData('waitTimer');
            if (wait > 0) {
                cat.setData('waitTimer', wait - dt);
                return;
            }

            const speed = cat.getData('speed');
            const dir = cat.getData('direction');
            cat.x += speed * dir * dt;
            cat.flipX = dir < 0;

            if (Math.random() < 0.005) {
                cat.setData('waitTimer', Phaser.Math.FloatBetween(1, 4));
            }

            if (cat.x < 20) {
                cat.x = 20;
                cat.setData('direction', 1);
                cat.setData('waitTimer', Phaser.Math.FloatBetween(0.5, 2));
            } else if (cat.x > GAME_W - 20) {
                cat.x = GAME_W - 20;
                cat.setData('direction', -1);
                cat.setData('waitTimer', Phaser.Math.FloatBetween(0.5, 2));
            }
        });
    }

    createHUD() {
        this.playerHpBg = this.add.rectangle(20, 54, 92, 6, hexToNum(C.textDim))
            .setOrigin(0, 0.5)
            .setDepth(92);
        this.playerHpBar = this.add.rectangle(20, 54, 92, 4, hexToNum(C.player1))
            .setOrigin(0, 0.5)
            .setDepth(93);
        this.playerLivesText = this.add.text(20, 59, 'YOU L3', {
            fontFamily: 'Geist Pixel, monospace',
            fontSize: '7px',
            color: C.text
        }).setDepth(93);

        this.opponentHpBg = this.add.rectangle(GAME_W - 20, 54, 92, 6, hexToNum(C.textDim))
            .setOrigin(1, 0.5)
            .setDepth(92);
        this.opponentHpBar = this.add.rectangle(GAME_W - 20, 54, 92, 4, hexToNum(C.player2))
            .setOrigin(1, 0.5)
            .setDepth(93);
        this.opponentLivesText = this.add.text(GAME_W - 20, 59, 'NPC L3', {
            fontFamily: 'Geist Pixel, monospace',
            fontSize: '7px',
            color: C.text
        }).setOrigin(1, 0).setDepth(93);

        this.statusText = this.add.text(GAME_W / 2, GAME_H / 2 - 40, '', {
            fontFamily: 'Geist Pixel, monospace',
            fontSize: '14px',
            color: C.player1,
            align: 'center',
            stroke: C.hudBg,
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(100);

        this.practiceButton = this.add.container(GAME_W / 2, GAME_H / 2 - 10).setDepth(101);
        const btnBg = this.add.rectangle(0, 0, 140, 40, hexToNum(C.hudBg), 0.95);
        btnBg.setStrokeStyle(2, hexToNum(C.player1));
        const btnText = this.add.text(0, 0, 'NEW RUN', {
            fontFamily: 'Geist Pixel, monospace',
            fontSize: '12px',
            color: C.player1
        }).setOrigin(0.5);
        this.practiceButton.add([btnBg, btnText]);
        this.practiceButton.setSize(140, 40);
        this.practiceButton.setInteractive({ cursor: 'pointer' });
        this.practiceButton.on('pointerdown', () => this.startPracticeMode());

        this.playerLabel = this.add.text(12, GAME_H - 28, '', {
            fontFamily: 'Geist Pixel, monospace',
            fontSize: '8px',
            color: C.player1
        }).setDepth(95);

        this.leaderboardText = this.add.text(GAME_W - 8, 8, 'LEADERBOARD\nNo runs yet', {
            fontFamily: 'Geist Pixel, monospace',
            fontSize: '7px',
            color: C.text,
            align: 'right',
            lineSpacing: 1
        }).setOrigin(1, 0).setDepth(95);

        this.mouseHint = this.add.text(GAME_W / 2, GAME_H - 12, 'Steer + reel. Cross strings to slash.', {
            fontFamily: 'Geist Pixel, monospace',
            fontSize: '7px',
            color: C.textDim,
            align: 'center'
        }).setOrigin(0.5).setDepth(95);

        this.gameOverBg = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, hexToNum(C.hudBg), 0)
            .setDepth(98);

        this.gameOverText = this.add.text(GAME_W / 2, GAME_H / 2 - 20, '', {
            fontFamily: 'Geist Pixel, monospace',
            fontSize: '20px',
            color: C.text,
            align: 'center',
            stroke: C.hudBg,
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(99);

        this.restartText = this.add.text(GAME_W / 2, GAME_H / 2 + 15, '', {
            fontFamily: 'Geist Pixel, monospace',
            fontSize: '10px',
            color: C.textDim,
            align: 'center'
        }).setOrigin(0.5).setDepth(99);
    }

    setupInput() {
        this.input.on('pointermove', (pointer) => {
            this.mouseX = pointer.x;
            this.mouseY = pointer.y;
        });

        this.input.on('pointerdown', () => {
            this.mouseDown = true;
        });

        this.input.on('pointerup', () => {
            this.mouseDown = false;
        });

        this.input.keyboard.on('keydown-SPACE', () => { this.mouseDown = true; });
        this.input.keyboard.on('keyup-SPACE', () => { this.mouseDown = false; });

        this.cursors = this.input.keyboard.createCursorKeys();
    }

    getNpcProfileForRound(round) {
        const base = NPC_ROSTER[(round - 1) % NPC_ROSTER.length];
        const tier = Math.floor((round - 1) / NPC_ROSTER.length);
        const tierScale = 1 + tier * 0.08;
        return {
            ...base,
            springMult: base.springMult * tierScale,
            maxVelMult: base.maxVelMult * tierScale,
            strainMult: base.strainMult * tierScale
        };
    }

    updateLeaderboardUI() {
        if (!this.leaderboardText) return;
        const lines = this.leaderboard.slice(0, LEADERBOARD_LIMIT).map((entry, i) =>
            `${i + 1}. ${entry.name}  R${entry.round}  ${entry.score}`
        );
        this.leaderboardText.setText([
            'LEADERBOARD',
            ...lines,
            lines.length === 0 ? 'No runs yet' : ''
        ]);
    }

    updateRunUI() {
        if (this.playerLabel) {
            this.playerLabel.setText(`${this.pilotName}  R${this.currentRound}  S${this.currentScore}`);
        }
    }

    submitLeaderboard() {
        const entry = {
            name: this.pilotName,
            round: this.currentRound,
            score: this.currentScore,
            ts: Date.now()
        };
        this.leaderboard = [...this.leaderboard, entry]
            .sort((a, b) => (b.score - a.score) || (b.round - a.round) || (a.ts - b.ts))
            .slice(0, LEADERBOARD_LIMIT);
        saveLeaderboard(this.leaderboard);
        this.updateLeaderboardUI();

        const rank = this.leaderboard.findIndex((x) =>
            x.ts === entry.ts && x.name === entry.name && x.score === entry.score
        );
        return rank >= 0 ? rank + 1 : null;
    }

    startNextRound() {
        this.currentRound += 1;
        this.activeNpcProfile = this.getNpcProfileForRound(this.currentRound);
        this.npc.setProfile(this.activeNpcProfile);
        this.playerLives = MAX_LIVES;
        this.opponentLives = MAX_LIVES;
        this.playerHealth = MAX_HEALTH;
        this.opponentHealth = MAX_HEALTH;
        this.restartMatch();

        this.opponentPlayer.setTint(this.activeNpcProfile.tint);
        this.opponentKite.setTint(this.activeNpcProfile.tint);
        this.npc.activate();

        this.statusText.setText(`ROUND ${this.currentRound} - ${this.activeNpcProfile.name}`);
        this.time.delayedCall(1300, () => {
            if (this.isAlive && this.opponentAlive && !this.gameOver) {
                this.statusText.setText('');
            }
        });
        this.updateRunUI();
    }

    getStringPoints(kiteX, kiteY, playerX, playerY) {
        const depth = mapRange(kiteY, DEPTH_Y_TOP, DEPTH_Y_BOT, 0, 1);
        const midX = (kiteX + playerX) / 2;
        const midY = (kiteY + playerY) / 2 + 15 + (1 - depth) * 10;
        const points = [{ x: kiteX, y: kiteY }];
        for (let i = 1; i <= STRING_SEGMENTS; i++) {
            const t = i / STRING_SEGMENTS;
            const invT = 1 - t;
            points.push({
                x: invT * invT * kiteX + 2 * invT * t * midX + t * t * playerX,
                y: invT * invT * kiteY + 2 * invT * t * midY + t * t * playerY
            });
        }
        return points;
    }

    tryResolveStringSlash(time) {
        if (!this.matchStarted || this.gameOver || !this.isAlive || !this.opponentAlive) return;
        if (time - this.lastSlashAt < SLASH_COOLDOWN_MS) return;

        const myPoints = this.getStringPoints(
            this.kite.x, this.kite.y, this.player.x, this.player.y - 22
        );
        const oppPoints = this.getStringPoints(
            this.opponentKite.x, this.opponentKite.y, this.opponentPlayer.x, this.opponentPlayer.y - 22
        );

        let crossed = false;
        for (let i = 0; i < myPoints.length - 1 && !crossed; i++) {
            for (let j = 0; j < oppPoints.length - 1; j++) {
                if (segmentsIntersect(myPoints[i], myPoints[i + 1], oppPoints[j], oppPoints[j + 1])) {
                    crossed = true;
                    break;
                }
            }
        }
        if (!crossed) return;

        const myPower = this.mySpeed + this.sharpness * 0.45 + (100 - this.strain) * 0.1;
        const oppPower = this.opponentSpeed + this.opponentSharpness * 0.45 + (100 - this.npc.strain) * 0.1;
        const delta = myPower - oppPower;
        if (Math.abs(delta) < SLASH_ADVANTAGE_MIN) return;

        const dmg = Math.round(SLASH_DAMAGE_BASE + Math.abs(delta) * SLASH_DAMAGE_SCALE);
        if (delta > 0) {
            this.applySlashDamage('opponent', dmg);
            this.statusText.setText(`SLASH! -${dmg}`);
        } else {
            this.applySlashDamage('player', dmg);
            this.statusText.setText(`YOU GOT SLASHED -${dmg}`);
        }

        this.lastSlashAt = time;
        this.cameras.main.shake(100, 0.004);
        this.time.delayedCall(350, () => {
            if (!this.gameOver && this.isAlive && this.opponentAlive) this.statusText.setText('');
        });
    }

    applySlashDamage(target, damage) {
        if (target === 'opponent') {
            this.opponentHealth = Math.max(0, this.opponentHealth - damage);
            if (this.opponentHealth <= 0) {
                this.handleLifeLoss('opponent');
            }
            return;
        }
        this.playerHealth = Math.max(0, this.playerHealth - damage);
        if (this.playerHealth <= 0) {
            this.handleLifeLoss('player');
        }
    }

    handleLifeLoss(target) {
        if (target === 'opponent') {
            this.opponentLives -= 1;
            this.spawnExplosion(this.opponentKite.x, this.opponentKite.y, C.player2);
            if (this.opponentLives <= 0) {
                this.opponentAlive = false;
                const tier = Math.floor((this.currentRound - 1) / NPC_ROSTER.length);
                this.currentScore += 150 + this.currentRound * 30 + tier * 40;
                this.updateRunUI();
                this.showGameOver('ROUND CLEAR!', 'Click for next NPC', 'next_round');
                return;
            }
            this.resetDuelStage();
            this.statusText.setText(`NPC DOWN! ${this.opponentLives} LIFE LEFT`);
        } else {
            this.playerLives -= 1;
            this.spawnExplosion(this.kite.x, this.kite.y, C.player1);
            if (this.playerLives <= 0) {
                this.onCut(false);
                return;
            }
            this.resetDuelStage();
            this.statusText.setText(`YOU DOWN! ${this.playerLives} LIFE LEFT`);
        }

        this.time.delayedCall(900, () => {
            if (!this.gameOver && this.isAlive && this.opponentAlive) this.statusText.setText('');
        });
    }

    resetDuelStage() {
        this.playerHealth = MAX_HEALTH;
        this.opponentHealth = MAX_HEALTH;
        this.strain = 0;
        this.npc.strain = 0;
        this.sharpness = 0;
        this.npc.sharpness = 0;
        this.lastSlashAt = this.time.now;

        this.player.x = GAME_W / 2 - 80;
        this.kite.setPosition(GAME_W / 2 - 80, 120);
        this.aimX = this.kite.x;
        this.aimY = this.kite.y;
        this.kiteVX = 0;
        this.kiteVY = 0;
        this.kite.body.setVelocity(0, 0);

        this.opponentPlayer.x = GAME_W / 2 + 80;
        this.opponentKite.setPosition(GAME_W / 2 + 80, 120);
        this.npc.kiteVX = 0;
        this.npc.kiteVY = 0;
        this.npc.targetX = this.opponentKite.x;
        this.npc.targetY = this.opponentKite.y;
        this.opponentKite.rotation = 0;
    }

    startPracticeMode() {
        const existing = (localStorage.getItem(PILOT_NAME_KEY) || '').trim();
        if (!existing) {
            const nameInput = window.prompt('Pilot name for leaderboard:', this.pilotName) || this.pilotName;
            this.pilotName = nameInput.trim().slice(0, 10) || 'PILOT';
            localStorage.setItem(PILOT_NAME_KEY, this.pilotName);
        } else {
            this.pilotName = existing.slice(0, 10);
        }

        this.practiceMode = true;
        this.matchStarted = true;
        this.gameOver = false;
        this.isAlive = true;
        this.opponentAlive = true;
        this.strain = 0;
        this.sharpness = 0;
        this.mySpeed = 0;
        this.kiteVX = 0;
        this.kiteVY = 0;
        this.stringLength = STRING_MAX_LENGTH;
        this.stringLengthTarget = STRING_MAX_LENGTH;
        this.currentRound = 0;
        this.currentScore = 0;
        this.playerLives = MAX_LIVES;
        this.opponentLives = MAX_LIVES;
        this.playerHealth = MAX_HEALTH;
        this.opponentHealth = MAX_HEALTH;
        this.lastSlashAt = 0;

        this.player.x = GAME_W / 2;
        this.kite.setPosition(GAME_W / 2, 120);
        this.aimX = this.kite.x;
        this.aimY = this.kite.y;
        this.kite.setVisible(true);
        this.kite.setScale(1);
        this.kite.setAlpha(1);
        this.kite.body.setVelocity(0, 0);

        this.player.setTint(0xffffff);
        this.kite.setTint(0xffffff);

        this.gameOverBg.fillAlpha = 0;
        this.gameOverText.setText('');
        this.restartText.setText('');
        this.statusText.setText('');
        this.practiceButton.setVisible(false);

        this.updateRunUI();
        this.startNextRound();
    }

    update(time, delta) {
        const dt = Math.min(delta / 1000, 0.033);
        const t = time / 1000;
        const aimLerp = Phaser.Math.Clamp(dt * AIM_SMOOTH, 0, 1);
        this.aimX = Phaser.Math.Linear(this.aimX, this.mouseX, aimLerp);
        this.aimY = Phaser.Math.Linear(this.aimY, this.mouseY, aimLerp);

        this.updateClouds(dt);
        this.updateAmbientNPCs(dt);
        this.updateDepth();

        if (this.gameOver) return;
        if (!this.isAlive) return;

        if (this.practiceMode) {
            this.npc.update(dt, time, this.kite);
            this.opponentSpeed = this.npc.speed;
            this.opponentSharpness = this.npc.sharpness;
        }

        // ── Player character follows mouse X on ground ──
        let walkTarget = this.mouseX;
        if (this.cursors.left.isDown) walkTarget = this.player.x - 50;
        if (this.cursors.right.isDown) walkTarget = this.player.x + 50;
        walkTarget = Phaser.Math.Clamp(walkTarget, 30, GAME_W - 30);

        const playerSpeed = 180;
        const pdx = walkTarget - this.player.x;
        if (Math.abs(pdx) > 2) {
            this.player.x += Math.sign(pdx) * Math.min(Math.abs(pdx), playerSpeed * dt);
            this.player.flipX = pdx < 0;
        }
        this.player.y = Math.abs(pdx) > 5
            ? CHARACTER_BASE_Y + Math.sin(t * 15) * 1.5
            : CHARACTER_BASE_Y;

        if (this.matchStarted) {
            // ── Wind (base + layered gusts) ──
            const gust1 = Math.sin(t * WIND_GUST_FREQ * Math.PI * 2) * WIND_GUST_AMP;
            const gust2 = Math.sin(t * WIND_GUST_FREQ * 2.7 + 1.3) * WIND_GUST_AMP * 0.4;
            this.windX = WIND_BASE_X + gust1 + gust2;
            this.windY = WIND_BASE_Y + Math.cos(t * WIND_GUST_FREQ * 1.6) * WIND_GUST_AMP * 0.25;

            // ── Spring force toward mouse cursor ──
            const dxToCursor = this.aimX - this.kite.x;
            const dyToCursor = this.aimY - this.kite.y;
            const spring = this.mouseDown ? KITE_SPRING * BOOST_MULTI : KITE_SPRING;
            const cursorDist = Math.sqrt(dxToCursor ** 2 + dyToCursor ** 2);
            const controlWeight = Phaser.Math.Clamp(
                (cursorDist - CURSOR_DEADZONE) / Math.max(cursorDist, 1),
                0,
                1
            );

            this.kiteVX += dxToCursor * controlWeight * spring * dt * 0.05;
            this.kiteVY += dyToCursor * controlWeight * spring * dt * 0.05;

            // ── Gravity ──
            this.kiteVY += KITE_GRAVITY * dt;

            // ── Wind ──
            this.kiteVX += this.windX * dt;
            this.kiteVY += this.windY * dt;

            // ── Sway ──
            const sway = Math.sin(t * SWAY_FREQ * Math.PI * 2) * SWAY_AMP;
            this.kiteVX += sway * dt * 3;

            // ── Drag ──
            this.kiteVX -= this.kiteVX * KITE_DRAG * dt;
            this.kiteVY -= this.kiteVY * KITE_DRAG * dt;

            // ── Velocity cap ──
            const speed = Math.sqrt(this.kiteVX ** 2 + this.kiteVY ** 2);
            if (speed > MAX_VEL) {
                const ratio = MAX_VEL / speed;
                this.kiteVX *= ratio;
                this.kiteVY *= ratio;
            }

            // ── String constraint ──
            this.stringLengthTarget = this.mouseDown ? STRING_MIN_LENGTH : STRING_MAX_LENGTH;
            const reelSpeed = this.mouseDown ? STRING_REEL_SPEED : STRING_RELEASE_SPEED;
            this.stringLength = moveToward(this.stringLength, this.stringLengthTarget, reelSpeed * dt);

            const handX = this.player.x;
            const handY = this.player.y - 22;
            const stringDist = Phaser.Math.Distance.Between(
                this.kite.x, this.kite.y, handX, handY
            );
            if (stringDist > this.stringLength) {
                const excess = stringDist - this.stringLength;
                const pullDirX = (handX - this.kite.x) / stringDist;
                const pullDirY = (handY - this.kite.y) / stringDist;
                const pullK = STRING_PULL_K + Phaser.Math.Clamp(excess * 0.15, 0, STRING_HARD_PULL_K);
                this.kiteVX += pullDirX * excess * pullK * dt;
                this.kiteVY += pullDirY * excess * pullK * dt;

                const nearLimit = Phaser.Math.Clamp(excess / Math.max(this.stringLength, 1), 0, 1);
                this.kiteVX -= this.kiteVX * STRING_DAMPING_NEAR_LIMIT * nearLimit * dt;
                this.kiteVY -= this.kiteVY * STRING_DAMPING_NEAR_LIMIT * nearLimit * dt;
            }

            // ── Strain from string distance ──
            const strainFrac = stringDist / Math.max(this.stringLength, 1);
            if (strainFrac > STRAIN_THRESHOLD) {
                const intensity = (strainFrac - STRAIN_THRESHOLD) / (1 - STRAIN_THRESHOLD);
                this.strain = Math.min(100, this.strain + STRAIN_RATE * intensity * dt);
            } else {
                this.strain = Math.max(0, this.strain - STRAIN_DECAY * dt);
            }

            // ── Boost strain cost ──
            if (this.mouseDown) {
                this.strain = Math.min(100, this.strain + BOOST_STRAIN_COST * dt);
                this.sharpness = Math.min(100, this.sharpness + 10 * dt);
            } else if (speed > 40) {
                this.sharpness = Math.min(100, this.sharpness + 3 * dt);
            } else {
                this.sharpness = Math.max(0, this.sharpness - 6 * dt);
            }

            // ── Apply velocity via physics body ──
            this.kite.body.setVelocity(this.kiteVX, this.kiteVY);

            // ── Tilt based on velocity ──
            if (speed > 5) {
                const targetAngle = Math.atan2(this.kiteVY, this.kiteVX);
                const tiltAngle = Phaser.Math.Clamp(targetAngle, -0.6, 0.6);
                this.kite.rotation = Phaser.Math.Linear(this.kite.rotation, tiltAngle, 0.08);
            }

            // ── Bounds ──
            if (this.kite.y > GROUND_Y - 30) {
                this.kite.y = GROUND_Y - 30;
                this.kiteVY = -Math.abs(this.kiteVY) * 0.3;
            }
            if (this.kite.y < 15) {
                this.kite.y = 15;
                this.kiteVY = Math.abs(this.kiteVY) * 0.2;
            }
            if (this.kite.x < 15) {
                this.kite.x = 15;
                this.kiteVX = Math.abs(this.kiteVX) * 0.4;
            }
            if (this.kite.x > GAME_W - 15) {
                this.kite.x = GAME_W - 15;
                this.kiteVX = -Math.abs(this.kiteVX) * 0.4;
            }

            this.mySpeed = speed;
        }

        if (this.strain >= 100) {
            this.strain = 0;
            this.handleLifeLoss('player');
            return;
        }

        this.tryResolveStringSlash(time);
        this.updateHUD();
        this.drawString();
        this.drawTail();
        this.updateShadow();
        this.drawWindIndicator();

    }

    updateClouds(dt) {
        this.clouds.forEach(c => {
            const speed = c.getData('speed');
            c.x += speed * dt;
            if (c.x < -50) {
                c.x = GAME_W + 50;
                c.y = Phaser.Math.Between(20, 80);
            }
        });
    }

    updateDepth() {
        if (this.isAlive) {
            const s = mapRange(this.kite.y, DEPTH_Y_TOP, DEPTH_Y_BOT, DEPTH_SCALE_MIN, DEPTH_SCALE_MAX);
            const a = mapRange(this.kite.y, DEPTH_Y_TOP, DEPTH_Y_BOT, DEPTH_ALPHA_MIN, DEPTH_ALPHA_MAX);
            this.kite.setScale(s);
            this.kite.setAlpha(a);
        }

        if (this.opponentAlive) {
            const s = mapRange(this.opponentKite.y, DEPTH_Y_TOP, DEPTH_Y_BOT, DEPTH_SCALE_MIN, DEPTH_SCALE_MAX);
            const a = mapRange(this.opponentKite.y, DEPTH_Y_TOP, DEPTH_Y_BOT, DEPTH_ALPHA_MIN, DEPTH_ALPHA_MAX);
            this.opponentKite.setScale(s);
            this.opponentKite.setAlpha(a);
        }
    }

    updateShadow() {
        if (this.isAlive) {
            const depth = mapRange(this.kite.y, DEPTH_Y_TOP, DEPTH_Y_BOT, 0, 1);
            this.kiteShadow.x = this.kite.x;
            this.kiteShadow.setScale(0.6 + depth * 0.4);
            this.kiteShadow.setAlpha(depth * 0.3 + 0.05);
        }

        if (this.opponentAlive) {
            const depth = mapRange(this.opponentKite.y, DEPTH_Y_TOP, DEPTH_Y_BOT, 0, 1);
            this.opponentShadow.x = this.opponentKite.x;
            this.opponentShadow.setScale(0.6 + depth * 0.4);
            this.opponentShadow.setAlpha(depth * 0.2 + 0.03);
        }
    }

    updateHUD() {
        const myHpW = (this.playerHealth / MAX_HEALTH) * 92;
        const oppHpW = (this.opponentHealth / MAX_HEALTH) * 92;
        this.playerHpBar.width = myHpW;
        this.opponentHpBar.width = oppHpW;
        this.playerLivesText.setText(`YOU L${this.playerLives}`);
        this.opponentLivesText.setText(`${this.activeNpcProfile ? this.activeNpcProfile.name : 'NPC'} L${this.opponentLives}`);
    }

    drawString() {
        this.stringGraphics.clear();
        if (!this.isAlive) return;

        const kiteX = this.kite.x;
        const kiteY = this.kite.y;
        const playerX = this.player.x;
        const playerY = this.player.y - 22;

        const depth = mapRange(this.kite.y, DEPTH_Y_TOP, DEPTH_Y_BOT, 0, 1);

        let stringAlpha = 0.2 + depth * 0.3;
        if (this.strain > 60) {
            this.stringGraphics.lineStyle(1, hexToNum(C.tensionCrit), stringAlpha);
        } else {
            this.stringGraphics.lineStyle(1, hexToNum(C.string), stringAlpha);
        }

        const midX = (kiteX + playerX) / 2;
        const midY = (kiteY + playerY) / 2 + 15 + (1 - depth) * 10;

        this.stringGraphics.beginPath();
        this.stringGraphics.moveTo(kiteX, kiteY);

        const steps = STRING_SEGMENTS;
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const invT = 1 - t;
            const x = invT * invT * kiteX + 2 * invT * t * midX + t * t * playerX;
            const y = invT * invT * kiteY + 2 * invT * t * midY + t * t * playerY;
            this.stringGraphics.lineTo(x, y);
        }

        this.stringGraphics.strokePath();
    }

    drawOpponentString() {
        this.opponentString.clear();
        if (!this.opponentAlive || this.opponentKite.x < -50) return;

        const kiteX = this.opponentKite.x;
        const kiteY = this.opponentKite.y;
        const playerX = this.opponentPlayer.x;
        const playerY = this.opponentPlayer.y - 22;

        const depth = mapRange(this.opponentKite.y, DEPTH_Y_TOP, DEPTH_Y_BOT, 0, 1);

        let stringColor = C.string;
        if (this.opponentKite.tintTopLeft === 0xff2e63) {
            stringColor = C.tensionCrit;
        }

        this.opponentString.lineStyle(1, hexToNum(stringColor), 0.15 + depth * 0.25);

        const midX = (kiteX + playerX) / 2;
        const midY = (kiteY + playerY) / 2 + 15 + (1 - depth) * 10;

        this.opponentString.beginPath();
        this.opponentString.moveTo(kiteX, kiteY);

        const steps = STRING_SEGMENTS;
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const invT = 1 - t;
            const x = invT * invT * kiteX + 2 * invT * t * midX + t * t * playerX;
            const y = invT * invT * kiteY + 2 * invT * t * midY + t * t * playerY;
            this.opponentString.lineTo(x, y);
        }

        this.opponentString.strokePath();
    }

    drawTail() {
        this.tailGraphics.clear();
        if (!this.isAlive) return;

        const tailColor = this.playerNumber === 1 ? C.player1 : (this.playerNumber === 2 ? C.player2 : C.player1);
        const kiteX = this.kite.x;
        const kiteY = this.kite.y + 14 * this.kite.scaleY;
        const scale = this.kite.scaleX;
        const segments = 8;

        this.tailGraphics.lineStyle(2, hexToNum(tailColor), 0.7);
        this.tailGraphics.beginPath();

        let px = kiteX;
        let py = kiteY;
        this.tailGraphics.moveTo(px, py);

        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const wave = Math.sin(this.time.now * 0.005 + i * 0.8) * (4 + i) * scale;
            px = kiteX + wave - this.kiteVX * t * 0.04;
            py = kiteY + i * 4 * scale;
            this.tailGraphics.lineTo(px, py);
        }

        this.tailGraphics.strokePath();

        for (let i = 2; i <= segments; i += 2) {
            const t = i / segments;
            const wave = Math.sin(this.time.now * 0.005 + i * 0.8) * (4 + i) * scale;
            const bx = kiteX + wave - this.kiteVX * t * 0.04;
            const by = kiteY + i * 4 * scale;

            this.tailGraphics.fillStyle(hexToNum(tailColor), 0.8);
            this.tailGraphics.fillCircle(bx, by, 2 * scale);
        }
    }

    drawWindIndicator() {
        this.windIndicator.clear();
        if (!this.isAlive) return;

        // Show wind arrow near top-left corner
        const wx = 20;
        const wy = GAME_H - 30;
        const windMag = Math.sqrt(this.windX * this.windX + this.windY * this.windY);
        const windAngle = Math.atan2(this.windY, this.windX);
        const arrowLen = Phaser.Math.Clamp(windMag * 0.25, 4, 18);
        const alpha = Phaser.Math.Clamp(windMag / 80, 0.2, 0.8);

        const endX = wx + Math.cos(windAngle) * arrowLen;
        const endY = wy + Math.sin(windAngle) * arrowLen;

        this.windIndicator.lineStyle(1.5, hexToNum(C.textDim), alpha);
        this.windIndicator.beginPath();
        this.windIndicator.moveTo(wx, wy);
        this.windIndicator.lineTo(endX, endY);
        // Arrowhead
        const headAngle = 0.5;
        this.windIndicator.lineTo(
            endX - Math.cos(windAngle - headAngle) * 5,
            endY - Math.sin(windAngle - headAngle) * 5
        );
        this.windIndicator.moveTo(endX, endY);
        this.windIndicator.lineTo(
            endX - Math.cos(windAngle + headAngle) * 5,
            endY - Math.sin(windAngle + headAngle) * 5
        );
        this.windIndicator.strokePath();
    }

    onKiteCollision() {
        // Disabled: combat now resolves via string slash intersections only.
    }

    onCut(selfSnap) {
        if (!this.isAlive) return;
        this.isAlive = false;

        const color = this.playerNumber === 1 ? C.player1 : C.player2;
        this.spawnExplosion(this.kite.x, this.kite.y, color);

        this.kite.setVisible(false);
        this.kite.body.setVelocity(0, 0);
        this.kiteShadow.setAlpha(0);
        this.stringGraphics.clear();
        this.tailGraphics.clear();

        this.cameras.main.shake(300, 0.012);

        const msg = selfSnap ? 'STRING SNAPPED!' : 'YOUR KITE WAS CUT!';
        const rank = this.submitLeaderboard();
        const rankText = rank ? `Rank #${rank} - ` : '';
        this.showGameOver(`${msg}\n${rankText}Score ${this.currentScore}`, 'Click to start new run', 'new_run');
    }

    spawnExplosion(x, y, colorHex) {
        const emitter = this.add.particles(x, y, 'particle', {
            speed: { min: 40, max: 120 },
            scale: { start: 1.5, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 1000,
            quantity: 30,
            tint: hexToNum(colorHex),
            gravityY: 50,
            emitting: false
        });
        emitter.explode(30);

        const sparkles = this.add.particles(x, y, 'sparkle', {
            speed: { min: 60, max: 150 },
            scale: { start: 1, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 700,
            quantity: 15,
            emitting: false
        });
        sparkles.explode(15);

        this.time.delayedCall(1500, () => {
            emitter.destroy();
            sparkles.destroy();
        });
    }

    showGameOver(msg, restartMsg, action = 'new_run') {
        this.gameOver = true;
        this.statusText.setText('');

        this.tweens.add({
            targets: this.gameOverBg,
            fillAlpha: 0.85,
            duration: 400,
            ease: 'Sine.easeOut'
        });

        this.gameOverText.setText(msg);
        this.restartText.setText(restartMsg || 'Click or press SPACE');

        this.time.delayedCall(1000, () => {
            const rematch = () => {
                if (action === 'next_round') {
                    this.startNextRound();
                } else {
                    this.startPracticeMode();
                }
                this.input.off('pointerdown', rematch);
                this.input.keyboard.off('keydown-SPACE', rematch);
            };

            this.input.on('pointerdown', rematch);
            this.input.keyboard.on('keydown-SPACE', rematch);
        });
    }

    restartMatch() {
        this.isAlive = true;
        this.opponentAlive = true;
        this.gameOver = false;
        this.strain = 0;
        this.mySpeed = 0;
        this.opponentSpeed = 0;
        this.sharpness = 0;
        this.kiteVX = 0;
        this.kiteVY = 0;
        this.stringLength = STRING_MAX_LENGTH;
        this.stringLengthTarget = STRING_MAX_LENGTH;

        const spawnX = this.playerNumber === 1 ? 120 : GAME_W - 120;
        this.player.x = spawnX;
        this.kite.setPosition(spawnX, 120);
        this.aimX = this.kite.x;
        this.aimY = this.kite.y;
        this.kite.setVisible(true);
        this.kite.setScale(1);
        this.kite.setAlpha(1);
        this.kite.body.setVelocity(0, 0);

        this.opponentKite.setPosition(-100, -100);
        this.opponentKite.setVisible(true);
        this.opponentPlayer.setPosition(-100, CHARACTER_BASE_Y);
        this.opponentPlayer.setVisible(true);

        this.gameOverBg.fillAlpha = 0;
        this.gameOverText.setText('');
        this.restartText.setText('');
        this.statusText.setText('FIGHT!');

        this.time.delayedCall(1500, () => {
            if (this.isAlive && this.opponentAlive) {
                this.statusText.setText('');
            }
        });
    }
}

// ============================================================
//  PHASER CONFIG
// ============================================================
const config = {
    type: Phaser.AUTO,
    width: GAME_W,
    height: GAME_H,
    parent: 'game-container',
    pixelArt: false,
    antialias: false,
    antialiasGL: false,
    roundPixels: true,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: DEBUG_MODE
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, GameScene]
};

const game = new Phaser.Game(config);
