# 🪁 Laga Layang — Single-Player Kite Fighting Game

A competitive pixel-art kite fighting game built with **Phaser 3** and **Node.js**.

Fight through an endless roster of NPC kite fighters and push your score up the leaderboard.

---

## 📂 Project Structure

```
laga-layang/
├── package.json        # Dependencies (express)
├── server.js           # Static web server
├── README.md
└── public/
    ├── index.html      # Entry point (Phaser 3 + Socket.io CDN)
    └── game.js         # Game logic: physics, combat, HUD, NPC AI, leaderboard
```

## 🚀 Installation & Running

### Prerequisites
- [Node.js](https://nodejs.org) v16+ installed

### Steps

```bash
# 1. Navigate to the project folder
cd laga-layang

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

Open **http://localhost:3000** in your browser.

Runs fully in a single tab.

---

## 🎮 Controls

| Input | Desktop | Mobile |
|---|---|---|
| **Reel In (Tension)** | Hold `SPACE` | Hold Screen (Touch) |
| **Float (Lift)** | Release `SPACE` | Release Touch |

---

## ⚙️ Gameplay Mechanics

### Kite Physics
- **Lift (Passive):** Kite floats UP and drifts LEFT automatically.
- **Tension (Active):** Holding input reels the kite DOWN and RIGHT.
- **Snapping:** If the Tension bar hits 100%, your string snaps — **Game Over!**

### Combat
- When two kites overlap, the **faster** kite cuts the **slower** kite.
- The loser's kite explodes into particles with camera shake.
- If speeds are very close, kites bounce off harmlessly.

### Multiplayer
- Auto-matchmaking: Two players are placed into a room automatically.
- If an opponent disconnects, you'll see **"Opponent Flew Away! 🪁💨"**.
- After a match, press SPACE/tap to request a rematch.

---

## 🐛 Debug Mode

In `public/game.js`, toggle the constant at the top:

```js
const DEBUG_MODE = true;  // shows hitbox outlines
```

---

## 🎨 Custom Art

The game uses colored rectangles by default. To use custom pixel art:

1. Place `kite.png` and `bg.png` in the `public/` folder.
2. In `public/game.js`, find the `BootScene.preload()` method and **uncomment** the asset loading lines:

```js
this.load.image('kite', 'kite.png');
this.load.image('bg',   'bg.png');
```

---

## 📋 Tech Stack

- **Frontend:** HTML5, Phaser 3 (CDN), JavaScript ES6
- **Backend:** Node.js, Express, Socket.io
- **Resolution:** 320×180 (pixel-perfect scaling) for a 16-bit aesthetic
