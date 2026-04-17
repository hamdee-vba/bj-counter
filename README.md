# BJ Counter PWA

Aplikasi perhitungan fisik jaminan kredit — versi Progressive Web App.

## Cara Deploy ke GitHub Pages

### 1. Buat Repository Baru di GitHub
- Buka [github.com](https://github.com) → **New repository**
- Nama repo: `bj-counter` (atau sesuai keinginan)
- Set ke **Public**
- Klik **Create repository**

### 2. Upload File
Upload semua file berikut ke root repository:
```
bj-counter/
├── index.html
├── manifest.json
├── sw.js
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

### 3. Aktifkan GitHub Pages
- Buka tab **Settings** di repository
- Pilih menu **Pages** di sidebar kiri
- Source: **Deploy from a branch**
- Branch: **main** / **(root)**
- Klik **Save**

### 4. Akses & Install
Setelah beberapa menit, app tersedia di:
```
https://<username>.github.io/<nama-repo>/
```

**Install di Android:**
Buka URL di Chrome → ketuk ikon ⋮ → **"Add to Home Screen"**

**Install di iOS (Safari):**
Buka URL di Safari → ketuk ikon Share → **"Add to Home Screen"**

## Catatan
- App bekerja **offline** setelah pertama kali dibuka (Service Worker cache)
- Data sesi tersimpan di **localStorage** browser
- Tidak ada data yang dikirim ke server
