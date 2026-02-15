const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID || '';
const JSONBIN_MASTER_KEY = process.env.JSONBIN_MASTER_KEY || '';
const JSONBIN_BASE_URL = 'https://api.jsonbin.io/v3/b';
const LEADERBOARD_LIMIT = 20;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function hasJsonBinConfig() {
  return Boolean(JSONBIN_BIN_ID && JSONBIN_MASTER_KEY);
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(Math.min(n, 999999));
}

function sanitizeName(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Anonymous';
  return raw.slice(0, 20);
}

async function readLeaderboardRecord() {
  const res = await fetch(`${JSONBIN_BASE_URL}/${JSONBIN_BIN_ID}/latest`, {
    headers: {
      'X-Master-Key': JSONBIN_MASTER_KEY
    }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`jsonbin read failed (${res.status}): ${body}`);
  }

  const payload = await res.json();
  const record = payload && typeof payload.record === 'object' && payload.record ? payload.record : {};
  if (!Array.isArray(record.entries)) record.entries = [];
  return record;
}

async function writeLeaderboardRecord(record) {
  const res = await fetch(`${JSONBIN_BASE_URL}/${JSONBIN_BIN_ID}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_MASTER_KEY,
      'X-Bin-Versioning': 'false'
    },
    body: JSON.stringify(record)
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`jsonbin write failed (${res.status}): ${body}`);
  }
}

function normalizeEntries(entries) {
  return entries
    .map((entry) => ({
      name: sanitizeName(entry.name),
      score: clampScore(entry.score),
      at: Number(entry.at) || Date.now()
    }))
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, LEADERBOARD_LIMIT);
}

app.get('/api/leaderboard', async (_req, res) => {
  if (!hasJsonBinConfig()) {
    return res.status(503).json({ error: 'Leaderboard not configured on server' });
  }

  try {
    const record = await readLeaderboardRecord();
    const entries = normalizeEntries(record.entries || []);
    return res.json({ entries });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to load leaderboard', detail: String(err.message || err) });
  }
});

app.post('/api/leaderboard', async (req, res) => {
  if (!hasJsonBinConfig()) {
    return res.status(503).json({ error: 'Leaderboard not configured on server' });
  }

  const name = sanitizeName(req.body && req.body.name);
  const score = clampScore(req.body && req.body.score);

  try {
    const record = await readLeaderboardRecord();
    const nextEntries = normalizeEntries([
      ...(record.entries || []),
      { name, score, at: Date.now() }
    ]);

    await writeLeaderboardRecord({ entries: nextEntries });
    return res.status(201).json({ ok: true, entries: nextEntries });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to save score', detail: String(err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`LAGA LAYANG server running on http://localhost:${PORT}`);
});
