# Kopi Kala Swara

Aplikasi pemesanan coffee shop (Pelanggan ↔ Waiter/Kasir) dengan **database
SQLite asli di server** — bukan localStorage. Semua pesanan tersimpan di file
database di server, sehingga dashboard Pelanggan dan dashboard Waiter/Kasir
tetap sinkron meskipun dibuka dari **perangkat yang berbeda** (asal terhubung
ke server/jaringan yang sama).

## Struktur folder

```
Kopi kala swara/
├── server/
│   ├── server.js        ← server HTTP + database (jalankan file ini)
│   ├── package.json
│   └── data/             ← otomatis dibuat — berisi file database .db
└── public/                ← frontend (dilayani otomatis oleh server.js)
    ├── index.html
    ├── css/style.css
    └── js/app.js
```

## Cara menjalankan

1. Pastikan **Node.js versi 22.5 atau lebih baru** terpasang di komputer
   kamu (cek dengan `node -v`). Tidak perlu `npm install` — server ini
   sengaja dibuat tanpa dependency eksternal, memakai modul database SQLite
   bawaan Node.js (`node:sqlite`).
2. Buka terminal, masuk ke folder `server`:
   ```bash
   cd "Kopi kala swara/server"
   node server.js
   ```
3. Akan muncul pesan bahwa server berjalan di `http://localhost:3000`.
   Buka alamat tersebut di browser — itu sudah menyalakan seluruh aplikasi
   (frontend + API + database) dalam satu proses.

## Mengakses dari perangkat lain (simulasi meja pelanggan + kasir sungguhan)

Selama komputer server dan perangkat lain (HP/laptop) terhubung ke **WiFi
yang sama**:

1. Cari alamat IP lokal komputer yang menjalankan server:
   - Windows: `ipconfig` → lihat "IPv4 Address"
   - Mac/Linux: `ifconfig` atau `ip addr` → lihat "inet"
2. Di perangkat lain, buka `http://<IP-tadi>:3000` — misalnya
   `http://192.168.1.5:3000`.
3. Sekarang kamu bisa buka dashboard Pelanggan di satu perangkat dan
   dashboard Waiter di perangkat lain — keduanya membaca/menulis ke
   database yang sama di server, jadi otomatis sinkron (polling setiap
   2,5 detik).

## Tentang datanya

- Semua pesanan disimpan permanen di `server/data/kopi-kala-swara.db`
  (file database SQLite). Data **tidak hilang** walau server dimatikan
  lalu dinyalakan ulang.
- Kalau ingin mengosongkan semua data pesanan (reset demo), tinggal hapus
  file `server/data/kopi-kala-swara.db` lalu jalankan ulang servernya —
  file itu akan dibuat lagi dari nol secara otomatis.

## Catatan teknis

- Frontend: Vue 3 (Composition API) + Tailwind CSS + Lucide Icons — dimuat
  lewat CDN, jadi komputer yang mengaksesnya tetap butuh koneksi internet
  (walau data pesanannya sendiri sudah tersimpan lokal di server, bukan di
  internet).
- Backend: modul inti Node.js saja (`node:http`, `node:sqlite`, `node:fs`) —
  tanpa Express, tanpa dependency dari npm, supaya tidak perlu proses
  instalasi apa pun.
- API yang tersedia:
  - `GET /api/orders` — daftar semua pesanan
  - `POST /api/orders` — membuat pesanan baru
  - `PATCH /api/orders/:id` — mengubah status pesanan
