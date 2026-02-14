# 🪁 Laga Layang — Kite Fighting Game

A single-player pixel-art kite survival game built with **Phaser 3** and **Node.js**.  
Dodge obstacles, ride the wind, and survive dynamic weather — how long can you keep your kite in the sky?

---

## 🎬 Gameplay

You control a kite tethered to a player on the ground. Drag your cursor/finger to steer the kite through the sky while avoiding **rocks**, **birds**, and **wind gusts** that fly toward you. Keep the kite airborne — letting it sit on the ground drains your HP!

Your score climbs as you dodge obstacles. Beat your best to **unlock new kite types**, each with unique physics.

---

## 📂 Project Structure

```
laga-layang/
├── package.json
├── server.js              # Express static server
├── README.md
└── public/
    ├── index.html          # Entry point (loads Phaser 3 via CDN)
    ├── game.js             # All game logic (~1000 lines)
    └── assets/
        ├── BGBack.png      # Far parallax clouds
        ├── BGFront.png     # Near parallax clouds
        ├── CloudsBack.png  # Cloud layer (back)
        ├── CloudsFront.png # Cloud layer (front)
        ├── background.png  # Sky background
        ├── scenery.png     # Foreground scenery
        ├── tiles.png       # Ground tiles
        └── ChipMug.ttf     # Pixel font
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) v16+

### Run Locally

```bash
cd laga-layang
npm install
npm start
```

Open **http://localhost:3000** in your browser.

---

## 🎮 Controls

| Action | Desktop | Mobile |
|---|---|---|
| **Steer kite** | Move cursor | Drag finger |
| **Reel in (boost)** | Hold click | Hold touch |
| **Float** | Release click | Release touch |

---

## ⚙️ Features

### 🪁 Kite Types
Five kites with unique stats — unlock them by beating high scores:

| Kite | Unlock At | Trait |
|---|---|---|
| **Classic** | 0 | Default balanced kite |
| **Swift** | 350 | Faster, lighter |
| **Heavy** | 700 | Slow but tough |
| **Balanced** | 1,100 | Refined handling |
| **Night Owl** | 1,600 | Best all-rounder |

### 🌦️ Dynamic Weather
Weather changes every 12–22 seconds, affecting wind and gravity:

- **Clear** — Calm skies
- **Breezy** — Stronger wind gusts
- **Rainy** — Heavier kite, rain particles
- **Storm** — Intense wind, lightning strikes, camera shake

### 🌗 Day-Night Cycle
A full day-night cycle runs every 60 seconds, dimming the sky with a smooth overlay.

### 🪨 Obstacles
Three obstacle types spawn from the right, increasing in speed as your score climbs:

- **Rocks** — Solid and direct
- **Birds** — Mid-air threats
- **Gusts** — Shimmering wind columns

### ❤️ HP & Ground Penalty
- Start with **3 HP** (hearts)
- Colliding with obstacles costs 1 HP (with brief invincibility frames)
- Staying on the ground too long also drains HP — keep flying!
- Losing all HP triggers a death animation where the kite tumbles and lands flat

### 🎵 Procedural Chiptune BGM
An auto-generated chiptune melody plays using the Web Audio API — no audio files needed.

### 🎨 Visual Effects
- **Parallax scrolling** cloud layers
- **Verlet-integrated** kite tail physics
- **Particle effects** for rain, wind, hits, and death
- **Camera shake** on impacts and lightning
- **Pixel-art textures** generated at runtime (player, kites, obstacles, hearts)

---

## 📋 Tech Stack

- **Frontend:** HTML5, Phaser 3 (CDN), JavaScript ES6
- **Backend:** Node.js, Express
- **Resolution:** 640×360 with `Phaser.Scale.FIT`
- **Font:** ChipMug (custom pixel TTF)

---

## 📄 License

MIT
