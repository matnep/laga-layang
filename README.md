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
├── server.js              # Express static server + leaderboard API
├── README.md
└── public/
    ├── index.html          # Entry point (loads Phaser 3 via CDN)
    ├── game.js             # All game logic
    └── assets/
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) v18+

### Run Locally

```bash
cd laga-layang
npm install
npm start
```

Open **http://localhost:3000** in your browser.

---

## 🏆 Shared Leaderboard (jsonbin.io)

This project includes server endpoints that proxy to jsonbin:

- `GET /api/leaderboard`
- `POST /api/leaderboard` with JSON body: `{ "name": "Player", "score": 123 }`

### Environment Variables

Set these on your deployment/server:

- `JSONBIN_BIN_ID`
- `JSONBIN_MASTER_KEY`

Example (PowerShell):

```powershell
$env:JSONBIN_BIN_ID="<your_bin_id>"
$env:JSONBIN_MASTER_KEY="<your_master_key>"
npm start
```

Important:
- Do **not** put your JSONBin master key in frontend code.
- Keep all JSONBin calls server-side through `/api/leaderboard`.

---

## 🎮 Controls

| Action | Desktop | Mobile |
|---|---|---|
| **Steer kite** | Move cursor | Drag finger |
| **Reel in (boost)** | Hold click | Hold touch |
| **Float** | Release click | Release touch |

---

## 📋 Tech Stack

- **Frontend:** HTML5, Phaser 3 (CDN), JavaScript ES6
- **Backend:** Node.js, Express
- **Leaderboard:** jsonbin.io via server API

---

## 📄 License

MIT
