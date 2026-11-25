/** URL publik situs, tanpa garis miring di akhir. Atur lewat NEXT_PUBLIC_SITE_URL (lihat .env.example). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const SITE_NAME = "Buat Peta";
export const SITE_TITLE = "Buat Peta: Peta Lokasi Gratis";
export const SITE_DESCRIPTION =
  "Buat peta lokasi desa, kecamatan, atau kabupaten/kota di seluruh Indonesia. Batas wilayah Kepmendagri 2025. Unduh gratis PNG 300 dpi, PDF A4, atau SVG.";

/** Gambar untuk link yang dibagikan (public/images/image-og.png). */
export const OG_IMAGE = { url: "/images/image-og.png", width: 1024, height: 587 };
