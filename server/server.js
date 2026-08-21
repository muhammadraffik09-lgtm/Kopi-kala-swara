/**
 * Kopi Kala Swara — Backend Server
 * -----------------------------------------------------------------------
 * Server HTTP polos (tanpa Express) + database SQLite bawaan Node.js
 * (modul inti `node:sqlite`, tersedia sejak Node.js v22.5+ — TIDAK perlu
 * `npm install` apa pun untuk menjalankan server ini).
 *
 * Cara pakai:
 *   node server.js
 *   lalu buka http://localhost:3000 di browser.
 *
 * Untuk diakses dari perangkat lain (HP pelanggan, laptop kasir) yang
 * berada di jaringan WiFi/LAN yang sama, buka:
 *   http://<IP-LOKAL-KOMPUTER-INI>:3000
 * (jalankan `ipconfig` di Windows atau `ifconfig`/`ip addr` di Mac/Linux
 * untuk melihat alamat IP lokal komputer kamu).
 * -----------------------------------------------------------------------
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DB_PATH = path.join(__dirname, 'data', 'kopi-kala-swara.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

/* ------------------------------------------------------------------ */
/*  DATABASE SETUP                                                     */
/* ------------------------------------------------------------------ */
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    table_number    TEXT    NOT NULL,
    customer_name   TEXT    NOT NULL,
    items_json      TEXT    NOT NULL,
    total           INTEGER NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'Menunggu Konfirmasi',
    reject_reason   TEXT,
    created_at      TEXT    NOT NULL,
    completed_at    TEXT
  );
`);

const stmt = {
  all: db.prepare('SELECT * FROM orders ORDER BY id DESC'),
  insert: db.prepare(`
    INSERT INTO orders (table_number, customer_name, items_json, total, status, created_at)
    VALUES (?, ?, ?, ?, 'Menunggu Konfirmasi', ?)
  `),
  getById: db.prepare('SELECT * FROM orders WHERE id = ?'),
  updateStatus: db.prepare(`
    UPDATE orders SET status = ?, reject_reason = ?, completed_at = ? WHERE id = ?
  `),
};

const rowToOrder = (row) => ({
  id: row.id,
  table: row.table_number,
  customerName: row.customer_name,
  items: JSON.parse(row.items_json),
  total: row.total,
  status: row.status,
  rejectReason: row.reject_reason || undefined,
  createdAt: row.created_at,
  completedAt: row.completed_at || undefined,
});

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */
function sendJSON(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res) {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, reqPath));

  // Cegah path traversal keluar dari folder public/
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

/* ------------------------------------------------------------------ */
/*  API ROUTES                                                         */
/* ------------------------------------------------------------------ */
const VALID_STATUS = ['Menunggu Konfirmasi', 'Sedang Diproses', 'Siap Diantar', 'Selesai', 'Dibatalkan'];

async function handleApi(req, res, urlObj) {
  const parts = urlObj.pathname.split('/').filter(Boolean); // ['api','orders', maybe ':id']

  // GET /api/orders — daftar semua pesanan
  if (req.method === 'GET' && parts.length === 2) {
    const rows = stmt.all.all();
    return sendJSON(res, 200, rows.map(rowToOrder));
  }

  // POST /api/orders — buat pesanan baru
  if (req.method === 'POST' && parts.length === 2) {
    try {
      const body = await readBody(req);
      const { table, customerName, items, total } = body;
      if (!table || !customerName || !Array.isArray(items) || items.length === 0 || typeof total !== 'number') {
        return sendJSON(res, 400, { error: 'Data pesanan tidak lengkap.' });
      }
      const createdAt = new Date().toISOString();
      const info = stmt.insert.run(table, customerName, JSON.stringify(items), total, createdAt);
      const row = stmt.getById.get(Number(info.lastInsertRowid));
      return sendJSON(res, 201, rowToOrder(row));
    } catch (e) {
      return sendJSON(res, 400, { error: 'Body request tidak valid.' });
    }
  }

  // PATCH /api/orders/:id — ubah status pesanan
  if (req.method === 'PATCH' && parts.length === 3) {
    const id = Number(parts[2]);
    const existing = stmt.getById.get(id);
    if (!existing) return sendJSON(res, 404, { error: 'Pesanan tidak ditemukan.' });

    try {
      const body = await readBody(req);
      const status = body.status;
      if (!VALID_STATUS.includes(status)) {
        return sendJSON(res, 400, { error: 'Status tidak valid.' });
      }
      const rejectReason = status === 'Dibatalkan' ? (body.rejectReason || null) : null;
      const completedAt = status === 'Selesai' ? new Date().toISOString() : existing.completed_at;
      stmt.updateStatus.run(status, rejectReason, completedAt, id);
      const row = stmt.getById.get(id);
      return sendJSON(res, 200, rowToOrder(row));
    } catch (e) {
      return sendJSON(res, 400, { error: 'Body request tidak valid.' });
    }
  }

  return sendJSON(res, 404, { error: 'Endpoint tidak ditemukan.' });
}

/* ------------------------------------------------------------------ */
/*  SERVER                                                             */
/* ------------------------------------------------------------------ */
const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  if (urlObj.pathname.startsWith('/api/')) {
    return handleApi(req, res, urlObj);
  }

  return serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ☕  Kopi Kala Swara — server berjalan');
  console.log('  ------------------------------------');
  console.log(`  Lokal   : http://localhost:${PORT}`);
  console.log(`  Database: ${DB_PATH}`);
  console.log('');
  console.log('  Untuk diakses dari HP/laptop lain di jaringan WiFi yang sama,');
  console.log('  gunakan alamat IP lokal komputer ini, contoh: http://192.168.1.5:' + PORT);
  console.log('');
});
