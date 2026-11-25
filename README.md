# Buat Peta

Aplikasi web untuk membuat peta lokasi desa/kelurahan, kecamatan, atau kabupaten/kota di seluruh Indonesia, lalu mengunduhnya gratis sebagai PNG 300 dpi, PDF A4, atau SVG.

Cari wilayah, pilih layout dan basemap, atur zoom, lalu unduh. Semua peta dibuat di browser, tanpa akun dan tanpa server pemrosesan.

## Fitur

- **Pencarian wilayah** untuk 83.247 desa/kelurahan, 7.277 kecamatan, 514 kab/kota, dan 38 provinsi (Kepmendagri 2025). Satu peta bisa memuat sampai 5 lokasi.
- **Halaman langsung per wilayah** di `/desa/[kode]`, misalnya [`/desa/35.26.12.2011`](http://localhost:3000/desa/35.26.12.2011) untuk Desa Sendang Dajah, Kec. Labang, Kab. Bangkalan.
- **10 layout**: Klasik Kanan, Klasik Portrait, Navy Kiri, Atlas Bingkai Ganda, Header Bar, Floating Cards, Dark Neon, Pastel Aesthetic, Portrait Modern, dan Pop Brutal.
- **6 basemap**: tanpa basemap, Jalan (OpenStreetMap), Terang dan Gelap (Esri Canvas), Citra satelit (Esri World Imagery), dan Topografi (OpenTopoMap).
- **Isi peta**:
  - Desa, kecamatan, dan kab/kota di sekitar lokasi, termasuk dari kabupaten tetangga.
  - Grid koordinat (DMS), panah utara, skala grafis, dan legenda.
  - Peta inset bertingkat: Indonesia → provinsi → kab/kota → kecamatan.
- **Opsi tampilan**: peta penuh tanpa panel, menyembunyikan wilayah sekitar, dan menyalakan/mematikan peta inset.
- **Zoom & geser** di preview lewat tombol, scroll, atau drag. File unduhan mengikuti tampilan yang sedang aktif.
- **Unduh gratis**:
  - PNG 300 dpi ukuran A4.
  - PDF A4 (ditulis langsung tanpa library).
  - SVG yang bisa diedit di Inkscape atau Illustrator.
  - Tile basemap ikut di-embed ke dalam file.
- **Responsif**: di HP urutannya cari lokasi dulu, lalu preview.

## Teknologi

- [Next.js 16](https://nextjs.org) (App Router), React 19, dan TypeScript.
- Peta dirender sebagai SVG string, tanpa library peta. Proyeksi Web Mercator dipakai supaya batas wilayah pas dengan tile basemap.
- Data wilayah disajikan sebagai file JSON statis di `public/data`, tanpa database.

## Menjalankan secara lokal

Butuh Node.js 20 atau lebih baru.

```bash
npm install
npm run data   # sekali saja: membuat public/data dari folder sumber (lihat di bawah)
npm run dev    # http://localhost:3000
```

Perintah lain:

| Perintah | Fungsi |
|---|---|
| `npm run build` | Build produksi |
| `npm start` | Menjalankan hasil build |
| `npm run typecheck` | Pemeriksaan TypeScript |

## Data wilayah

Batas wilayah berasal dari [cahyadsn/wilayah_boundaries](https://github.com/cahyadsn/wilayah_boundaries) (versi 2025.7, lisensi MIT) sesuai Kepmendagri No 300.2.2-2138 Tahun 2025.

Langkah membangun ulang data:

1. Unduh atau clone repositori itu ke folder `wilayah_boundaries-2025.7/` di root proyek. Lokasi lain bisa diatur lewat env `WILAYAH_DIR`.
2. Jalankan `npm run data`. Skrip [`scripts/build-data.mjs`](scripts/build-data.mjs) membaca file SQL-nya, lalu menghasilkan:

| File | Isi |
|---|---|
| `public/data/index.json` (~2,3 MB) | Kode dan nama semua wilayah untuk pencarian, plus bbox kab/kota |
| `public/data/geo/<kode-kab>.json` (514 file, terbesar ~2,2 MB) | Batas kab/kota, kecamatan, dan desa dalam satu kab/kota. Dimuat hanya saat dibutuhkan. |
| `public/data/inset/*.json` (~1,3 MB total) | Geometri yang disederhanakan untuk peta inset |

Catatan data:
- Kolom `path` di sumber memakai urutan `[lat, lng]`. Skrip membaliknya menjadi `[lng, lat]`.
- Menurut README sumber, data beberapa desa belum lengkap.
- Batas kecamatan dan desa di sumber tidak selalu persis berimpit.

## Basemap & atribusi

Tile basemap diambil langsung dari penyedianya. Atribusi wajib ditampilkan otomatis di pojok peta dan di blok "Sumber data".

| Basemap | Penyedia | Catatan |
|---|---|---|
| Jalan (OSM) | tile.openstreetmap.org | Ikuti [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/). Tidak untuk trafik besar. |
| Terang / Gelap | Esri World Light/Dark Gray Base | Maksimum zoom 16 |
| Citra satelit | Esri World Imagery | |
| Topografi | OpenTopoMap | CC-BY-SA, maksimum zoom 17 |

CARTO basemaps tidak dipakai karena sekarang mewajibkan API key. Untuk trafik besar, sebaiknya pindah ke penyedia tile berkunci API, misalnya MapTiler atau Stadia. Daftar penyedia ada di [`src/lib/config.ts`](src/lib/config.ts).

## Struktur proyek

```
scripts/build-data.mjs        SQL wilayah_boundaries -> public/data/*.json
src/app/page.tsx              halaman utama (pencarian bebas, ?q= untuk isi awal)
src/app/desa/[kode]/page.tsx  halaman langsung per kode wilayah
src/components/Builder.tsx    UI: lokasi, layout, basemap, tampilan, preview, unduh
src/lib/wilayah.ts            indeks pencarian, pemuatan geometri, susunan adegan peta
src/lib/render-map.ts         render SVG: proyeksi, tile, grid, legenda, inset, layout
src/lib/export.ts             ekspor SVG / PNG 300 dpi / PDF A4 di browser
src/lib/config.ts             layout, basemap, batas-batas
```

## Deploy

Aplikasi ini perlu runtime Node.js, karena halaman `/desa/[kode]` dirender di server untuk validasi kode dan metadata. Folder `public/data` berisi sekitar 554 file dengan total ~184 MB. Cek batas ukuran deployment di layanan hosting yang dipakai.

## Lisensi

- Kode aplikasi: _belum ditentukan_.
- Data batas wilayah: MIT © Cahya DSN ([wilayah_boundaries](https://github.com/cahyadsn/wilayah_boundaries)).
- Tile basemap: mengikuti ketentuan masing-masing penyedia (lihat tabel di atas).
