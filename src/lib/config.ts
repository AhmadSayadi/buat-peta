import type { Layout, Level } from "./types";

export const MAX_LOKASI = 5;
export const MAX_HASIL = 20;

export const SUMBER_DATA = "Batas administrasi Kepmendagri No 300.2.2-2138/2025";

export const LEVELS: Record<Level, string> = {
  desa: "Desa/Kelurahan",
  kecamatan: "Kecamatan",
  kabupaten: "Kabupaten/Kota",
};

export const PLACEHOLDER: Record<Level, string> = {
  desa: "Ketik nama desa/kelurahan...",
  kecamatan: "Ketik nama kecamatan...",
  kabupaten: "Ketik nama kabupaten/kota...",
};

export interface Basemap {
  label: string;
  /** Warna bulatan di tombol pilihan. */
  swatch: string;
  /** Template tile XYZ ({z}/{x}/{y}). Kosong = tanpa basemap. */
  url?: string;
  maxZoom?: number;
  /** Atribusi wajib menurut lisensi/ketentuan penyedia tile. */
  attribution?: string;
  /** Teks/garis di atas basemap ini perlu warna terang. */
  dark?: boolean;
}

export const BASEMAPS = {
  none: { label: "Tanpa basemap", swatch: "#e8eef5" },
  osm: {
    label: "Jalan (OSM)",
    swatch: "#ffffff",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  },
  // CARTO (basemaps.cartocdn.com) kini mengembalikan tile "API KEY REQUIRED" tanpa kunci,
  // jadi Terang/Gelap memakai Esri Canvas yang masih terbuka. Esri Canvas maksimum zoom 16.
  terang: {
    label: "Terang",
    swatch: "#ffffff",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 16,
    attribution: "Basemap: Esri, HERE, Garmin, © OpenStreetMap contributors",
  },
  gelap: {
    label: "Gelap",
    swatch: "#2b2f3a",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 16,
    attribution: "Basemap: Esri, HERE, Garmin, © OpenStreetMap contributors",
    dark: true,
  },
  satelit: {
    label: "Citra satelit",
    swatch: "#4a6b48",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19,
    attribution: "Citra: Esri, Maxar, Earthstar Geographics",
    dark: true,
  },
  topografi: {
    label: "Topografi",
    swatch: "#c9e2b8",
    url: "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
    maxZoom: 17,
    attribution: "© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)",
  },
} satisfies Record<string, Basemap>;
export type BasemapId = keyof typeof BASEMAPS;

export const LAYOUTS: Layout[] = [
  { id: "klasik-kanan", name: "Klasik Kanan", panel: "right", bg: "#ffffff", frame: "#222", fill: "#f28c28", stroke: "#a85a10", text: "#222", ctxFill: "#fbf8ee", ctxLine: "#9a9a9a" },
  { id: "klasik-portrait", name: "Klasik Portrait", orientation: "portrait", panel: "bottom", bg: "#ffffff", frame: "#222", fill: "#f28c28", stroke: "#a85a10", text: "#222", ctxFill: "#fbf8ee", ctxLine: "#9a9a9a" },
  { id: "navy-kiri", name: "Navy Kiri", panel: "left", headBar: true, headBg: "#1e2a4a", headText: "#fff", bg: "#f4f6fb", frame: "#1e2a4a", fill: "#ffb020", stroke: "#b87800", text: "#1e2a4a", ctxFill: "#fff", ctxLine: "#a7b0c4" },
  { id: "atlas-bingkai-ganda", name: "Atlas Bingkai Ganda", panel: "right", doubleFrame: true, bg: "#f5efe0", frame: "#7a5c2e", fill: "#c98b3c", stroke: "#6b4a1e", text: "#4a3a1e", ctxFill: "#faf4e4", ctxLine: "#b5a383" },
  { id: "header-bar", name: "Header Bar", panel: "right", headBar: true, headBg: "#f2b705", headText: "#222", bg: "#ffffff", frame: "#333", fill: "#f9d342", stroke: "#b08a00", text: "#222", ctxFill: "#fdfdfb", ctxLine: "#aaa" },
  { id: "floating-cards", name: "Floating Cards", panel: "right", cards: true, bg: "#fff4ec", frame: "#ff6b35", fill: "#ff6b35", stroke: "#b3401a", text: "#3a2a22", ctxFill: "#fff", ctxLine: "#e7b9a4" },
  { id: "dark-neon", name: "Dark Neon", panel: "right", dark: true, bg: "#0f1220", frame: "#b6ff3b", fill: "#b6ff3b", stroke: "#6fb81a", text: "#e6ffb0", mapBg: "#161b2e", ctxFill: "#1d2440", ctxLine: "#3a4677" },
  { id: "pastel", name: "Pastel Aesthetic", panel: "right", bg: "#fdf6fb", frame: "#c9a7d6", fill: "#f7a8c4", stroke: "#c0628c", text: "#5a4a6a", ctxFill: "#fffafd", ctxLine: "#d8c4e0" },
  { id: "portrait-modern", name: "Portrait Modern", orientation: "portrait", panel: "bottom", bg: "#ffffff", frame: "#333", fill: "#f0a030", stroke: "#a86a10", text: "#222", ctxFill: "#fafafa", ctxLine: "#bbb" },
  { id: "pop-brutal", name: "Pop Brutal", panel: "right", bg: "#ffe14d", frame: "#000", fill: "#e8542b", stroke: "#000", text: "#000", thickFrame: true, ctxFill: "#fff8c2", ctxLine: "#000" },
  // Gaya tambahan: semuanya memakai fitur render yang sudah ada.
  { id: "monokrom-cetak", name: "Monokrom Cetak", panel: "right", bg: "#ffffff", frame: "#111111", fill: "#3f3f46", stroke: "#000000", text: "#111111", ctxFill: "#f4f4f5", ctxLine: "#a1a1aa" },
  { id: "hijau-alam", name: "Hijau Alam", panel: "left", headBar: true, headBg: "#1f4d3a", headText: "#ffffff", bg: "#f4f8f3", frame: "#1f4d3a", fill: "#2e7d4f", stroke: "#1b4d2e", text: "#1b4d2e", ctxFill: "#ffffff", ctxLine: "#9db8a6" },
  { id: "biru-laut-portrait", name: "Biru Laut Portrait", orientation: "portrait", panel: "bottom", headBar: true, headBg: "#0e4c6b", headText: "#ffffff", bg: "#ffffff", frame: "#0b5673", fill: "#1c8fb8", stroke: "#0b5673", text: "#0b3a4f", ctxFill: "#f2f8fb", ctxLine: "#a9c9d8" },
  { id: "marun-modern", name: "Marun Modern", panel: "right", bg: "#fbf7f4", frame: "#7f1d1d", fill: "#9f1239", stroke: "#4c0519", text: "#3b0a14", ctxFill: "#ffffff", ctxLine: "#d6b5bc" },
];
