# Buat Peta

Aplikasi web untuk membuat peta lokasi desa/kelurahan, kecamatan, atau kabupaten/kota di seluruh Indonesia, lalu mengunduhnya gratis sebagai PNG 300 dpi, PDF A4, atau SVG.

Cari wilayah, pilih gaya dan basemap, atur zoom, lalu unduh. Peta dibuat di browser, tanpa akun.

## Fitur

- **Pencarian wilayah** untuk 83.247 desa/kelurahan, 7.277 kecamatan, 514 kab/kota, dan 38 provinsi (Kepmendagri 2025). Satu peta bisa memuat sampai 5 lokasi.
- **Halaman langsung per wilayah** di `/desa/[kode]`, misalnya `/desa/35.26.12.2011` untuk Desa Sendang Dajah, Kec. Labang, Kab. Bangkalan.
- **14 gaya peta**: dari Klasik Kanan sampai Marun Modern. Setiap gaya mengatur warna, posisi panel, orientasi, dan ciri visualnya.
- **6 basemap**: tanpa basemap, Jalan (OpenStreetMap), Terang dan Gelap (Esri), Citra satelit (Esri), dan Topografi (OpenTopoMap).
- **Isi peta**: wilayah sekitar beserta namanya, grid koordinat, panah utara, skala grafis, legenda, dan peta inset (Indonesia, provinsi, kab/kota, kecamatan).
- **Opsi tampilan**: peta penuh tanpa panel, menyembunyikan wilayah sekitar, dan menyalakan atau mematikan peta inset.
- **Zoom dan geser** di preview lewat tombol, scroll, atau drag. File unduhan mengikuti tampilan yang sedang aktif.
- **Unduh gratis**: PNG 300 dpi, PDF A4, atau SVG yang bisa diedit di Inkscape atau Illustrator.
- **Pencarian terakhir** disimpan di browser selama 1 menit, termasuk lokasi yang dipilih.
- **Responsif**: di HP, urutannya cari lokasi, lalu preview, lalu pengaturan.

## Teknologi

- [Next.js](https://nextjs.org) (App Router), React, dan TypeScript.
- Peta dirender sebagai SVG, tanpa library peta. Proyeksi Web Mercator dipakai supaya batas wilayah pas dengan tile basemap.
- Data wilayah disimpan di folder `data/` dan dilayani lewat API route. Folder itu tidak bisa diakses langsung dari URL.

## Menjalankan secara lokal

Butuh Node.js 20 atau lebih baru.

```bash
npm install
npm run dev    # http://localhost:3000
```

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Mode pengembangan |
| `npm run build` | Build produksi |
| `npm start` | Menjalankan hasil build |
| `npm run typecheck` | Pemeriksaan TypeScript |

Salin `.env.example` ke `.env.local` dan isi domain situsnya:

```
NEXT_PUBLIC_SITE_URL=https://buat-peta.ahmadsayadi.com
```

Variabel ini dipakai untuk canonical, sitemap, robots, dan URL gambar OG. Di hosting, isi juga di pengaturan environment.

## Data wilayah

Batas wilayah berasal dari [cahyadsn/wilayah_boundaries](https://github.com/cahyadsn/wilayah_boundaries) (versi 2025.7, lisensi MIT) sesuai Kepmendagri No 300.2.2-2138 Tahun 2025.

Data sudah berada di folder `data/`:

| Path | Isi |
|---|---|
| `data/index.json` | Kode dan nama semua wilayah untuk pencarian, plus bbox kab/kota. Hanya dibaca di server. |
| `data/geo/<kode-kab>.json` | Batas kab/kota, kecamatan, dan desa dalam satu kab/kota. Dimuat lewat `/api/geo/[kab]` saat dibutuhkan. |
| `data/inset/*.json` | Geometri yang disederhanakan untuk peta inset. |

Catatan:
- Skrip pembuat data (`scripts/build-data.mjs`) tidak ada lagi di repositori. Jika data perlu dibuat ulang, skrip itu harus ditambahkan kembali dari sumber SQL-nya.
- Menurut README sumber, data beberapa desa belum lengkap.
- Batas kecamatan dan desa di sumber tidak selalu persis berimpit.

## Basemap dan atribusi

Tile basemap diambil langsung dari penyedianya. Atribusi wajib ditampilkan di pojok peta dan di blok "Sumber data".

| Basemap | Penyedia | Catatan |
|---|---|---|
| Jalan (OSM) | tile.openstreetmap.org | Ikuti [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/). Tidak untuk trafik besar. |
| Terang / Gelap | Esri World Light/Dark Gray Base | Maksimum zoom 16 |
| Citra satelit | Esri World Imagery | |
| Topografi | OpenTopoMap | CC-BY-SA, maksimum zoom 17 |

CARTO tidak dipakai karena sekarang mewajibkan API key. Untuk trafik besar, pertimbangkan penyedia tile berkunci API. Daftar penyedia ada di [`src/lib/config.ts`](src/lib/config.ts).

## Struktur proyek

```
data/                         data wilayah (index, geo per kab, inset)
src/app/page.tsx              halaman utama
src/app/desa/[kode]/page.tsx  halaman langsung per kode wilayah
src/app/api/                  API: cari, meta, geo/[kab], inset/[name]
src/app/sitemap.ts            sitemap (dibagi per 50.000 URL)
src/app/robots.ts            robots.txt
src/components/Builder.tsx    UI: lokasi, gaya, basemap, tampilan, preview, unduh
src/lib/wilayah.ts            pencarian, pemuatan geometri, susunan adegan peta
src/lib/render-map.ts         render SVG: proyeksi, tile, grid, legenda, inset, gaya
src/lib/export.ts             ekspor SVG, PNG 300 dpi, dan PDF A4 di browser
src/lib/guard.ts              pembatasan akses API (asal permintaan dan rate limit)
src/lib/config.ts             gaya peta, basemap, dan batas-batas
public/images/                favicon, logo, dan gambar OG
```

## Deploy

Aplikasi butuh runtime Node.js, karena halaman `/desa/[kode]` dan API route dirender di server. Folder `data/` berisi sekitar 554 file dengan total ~184 MB. Cek batas ukuran deployment di layanan hosting yang dipakai.

## Lisensi

- Kode aplikasi: _belum ditentukan_.
- Data batas wilayah: MIT © Cahya DSN ([wilayah_boundaries](https://github.com/cahyadsn/wilayah_boundaries)).
- Tile basemap: mengikuti ketentuan masing-masing penyedia (lihat tabel di atas).
