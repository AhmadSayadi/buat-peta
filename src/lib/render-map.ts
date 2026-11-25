import { SUMBER_DATA, type Basemap } from "./config";
import type { BBox, Identity, InsetData, Layout, Ring, Scene } from "./types";

export interface MapInput {
  layout: Layout;
  scene: Scene;
  identity: Identity;
  /** data:image/png|jpeg;base64,... atau null */
  logo: string | null;
  basemap: Basemap;
  /** Thumbnail: geometri lebih kasar, tanpa label kecil. */
  thumb?: boolean;
  /**
   * Piksel tile per satuan SVG. Preview ~1.5; ekspor 300 dpi memakai nilai lebih tinggi
   * supaya basemap tetap tajam (zoom tile naik satu tingkat).
   */
  tileDetail?: number;
  /** Zoom & geser dari preview. Thumbnail selalu tampilan awal. */
  view?: MapView;
  /** Peta memenuhi seluruh halaman, tanpa panel judul/legenda. */
  fullMap?: boolean;
  /** Tampilkan desa, kecamatan, dan kab/kota di sekitar lokasi. */
  showNeighbors?: boolean;
  /** Tampilkan peta inset (Indonesia, provinsi, kab/kota) di panel keterangan. */
  showInset?: boolean;
}

/** Batas jumlah tile per gambar supaya tidak membebani server tile. */
const MAX_TILES = 120;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FONT = "Segoe UI, Arial, Helvetica, sans-serif";

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface TextOpt {
  size?: number;
  weight?: number;
  fill?: string;
  anchor?: "start" | "middle" | "end";
  halo?: string;
  rotate?: number;
  italic?: boolean;
}

function txt(x: number, y: number, str: string, o: TextOpt = {}) {
  const { size = 14, weight = 400, fill = "#222", anchor = "start", halo, rotate, italic } = o;
  const extra =
    (halo ? ` stroke="${halo}" stroke-width="3" paint-order="stroke" stroke-linejoin="round"` : "") +
    (rotate ? ` transform="rotate(${rotate} ${x.toFixed(1)} ${y.toFixed(1)})"` : "") +
    (italic ? ` font-style="italic"` : "");
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${extra}>${esc(str)}</text>`;
}

function wrap(str: string, maxChars: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of String(str).trim().split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && next.length > maxChars) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------- Proyeksi ----------

interface Projection {
  proj: (p: [number, number]) => [number, number];
  inv: (x: number, y: number) => [number, number];
  /** piksel SVG per derajat bujur (Mercator) */
  scale: number;
  /** meter per piksel SVG di tengah peta */
  mPerPx: number;
}

const RAD = Math.PI / 180;
/** Lintang -> y Mercator, dalam satuan "derajat" supaya sebanding dengan bujur. */
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / RAD;
const invMercY = (y: number) => (2 * Math.atan(Math.exp(y * RAD)) - Math.PI / 2) / RAD;

/** Web Mercator (EPSG:3857), sama dengan tile basemap sehingga batas wilayah pas di atas tile. */
function makeProjection(bb: BBox, box: Box): Projection {
  const y0 = mercY(bb[1]);
  const y1 = mercY(bb[3]);
  const dx = Math.max(bb[2] - bb[0], 1e-9);
  const dy = Math.max(y1 - y0, 1e-9);
  const s = Math.min(box.w / dx, box.h / dy);
  const ox = box.x + (box.w - dx * s) / 2;
  const oy = box.y + (box.h - dy * s) / 2;
  const latC = invMercY((y0 + y1) / 2);
  return {
    proj: ([lng, lat]) => [ox + (lng - bb[0]) * s, oy + (y1 - mercY(lat)) * s],
    inv: (x, y) => [bb[0] + (x - ox) / s, invMercY(y1 - (y - oy) / s)],
    scale: s,
    mPerPx: ((111319.49 * Math.cos(latC * RAD)) / s),
  };
}

// ---------- Tile basemap ----------

function tileLayer(bm: Basemap, P: Projection, frame: Box, detail: number): string[] {
  if (!bm.url) return [];
  const [lngW, latN] = P.inv(frame.x, frame.y);
  const [lngE, latS] = P.inv(frame.x + frame.w, frame.y + frame.h);
  // Zoom: lebar dunia dalam piksel tile = 256 * 2^z, harus ~ detail * piksel SVG per 360°.
  let z = Math.min(bm.maxZoom ?? 18, Math.max(1, Math.round(Math.log2((P.scale * 360 * detail) / 256))));
  const tx = (lng: number, n: number) => Math.floor(((lng + 180) / 360) * n);
  const ty = (lat: number, n: number) => Math.floor(((1 - (mercY(lat) * RAD) / Math.PI) / 2) * n);
  let n = 2 ** z;
  while (z > 1 && (tx(lngE, n) - tx(lngW, n) + 1) * (ty(latS, n) - ty(latN, n) + 1) > MAX_TILES) {
    z--;
    n = 2 ** z;
  }
  const lngOf = (x: number) => (x / n) * 360 - 180;
  const latOf = (y: number) => invMercY(((1 - (2 * y) / n) * Math.PI) / RAD);
  const out: string[] = [];
  for (let x = tx(lngW, n); x <= tx(lngE, n); x++) {
    for (let y = ty(latN, n); y <= ty(latS, n); y++) {
      if (y < 0 || y >= n) continue;
      const [px0, py0] = P.proj([lngOf(x), latOf(y)]);
      const [px1, py1] = P.proj([lngOf(x + 1), latOf(y + 1)]);
      const href = bm.url.replace("{z}", String(z)).replace("{x}", String(((x % n) + n) % n)).replace("{y}", String(y));
      // +0.6 menutup celah tipis antar tile akibat pembulatan
      out.push(
        `<image href="${esc(href)}" x="${px0.toFixed(2)}" y="${py0.toFixed(2)}" width="${(px1 - px0 + 0.6).toFixed(2)}" height="${(py1 - py0 + 0.6).toFixed(2)}" preserveAspectRatio="none"/>`
      );
    }
  }
  return out;
}

/** Path SVG; titik yang kurang dari `step` px dari titik sebelumnya dilewati. */
function pathOf(rings: Ring[], proj: Projection["proj"], step: number) {
  let d = "";
  for (const ring of rings) {
    let lx = NaN;
    let ly = NaN;
    let s = "";
    for (const p of ring) {
      const [x, y] = proj(p);
      if (s && Math.abs(x - lx) < step && Math.abs(y - ly) < step) continue;
      s += (s ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
      lx = x;
      ly = y;
    }
    if (s) d += s + "Z";
  }
  return d;
}

/** Titik label: rata-rata titik pada ring terpanjang (cukup baik untuk bentuk desa). */
function labelPoint(rings: Ring[]): [number, number] {
  const ring = rings.reduce((a, b) => (b.length > a.length ? b : a), rings[0]);
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return [sx / ring.length, sy / ring.length];
}

// ---------- Grid koordinat & skala ----------

function dms(v: number, pos: string, neg: string) {
  const a = Math.abs(v);
  let d = Math.floor(a);
  let m = Math.floor((a - d) * 60);
  let s = Math.round(((a - d) * 60 - m) * 60);
  if (s === 60) {
    s = 0;
    m++;
  }
  if (m === 60) {
    m = 0;
    d++;
  }
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${d}°${p2(m)}'${p2(s)}" ${v >= 0 ? pos : neg}`;
}

const GRID_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300].map((m) => m / 60);
function gridStep(span: number) {
  return GRID_STEPS.find((s) => span / s <= 4) ?? 5;
}

function niceDistance(m: number) {
  const p = 10 ** Math.floor(Math.log10(m));
  const f = m / p;
  return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p;
}

// ---------- Render ----------

/** Ukuran kanvas dan posisi kotak peta/panel untuk sebuah layout (satuan SVG). */
export function layoutBoxes(L: Layout, fullMap = false) {
  const portrait = L.orientation === "portrait";
  const W = portrait ? 700 : 1000;
  const H = portrait ? 1000 : 700;
  const M = 20;
  const G = 20; // ruang label koordinat di luar bingkai peta
  if (fullMap) {
    const mapBox: Box = { x: M, y: M, w: W - 2 * M, h: H - 2 * M };
    const frame: Box = { x: mapBox.x + G, y: mapBox.y + G, w: mapBox.w - 2 * G, h: mapBox.h - 2 * G };
    return { W, H, headH: 0, mapBox, infoBox: null, frame };
  }
  const headH = L.headBar ? 96 : 0;
  const top = M + headH;
  const innerH = H - top - M;

  let mapBox: Box;
  let infoBox: Box;
  if (L.panel === "left") {
    infoBox = { x: M, y: top, w: W * 0.32 - M * 1.5, h: innerH };
    mapBox = { x: W * 0.32 + M / 2, y: top, w: W * 0.68 - M * 1.5, h: innerH };
  } else if (L.panel === "bottom") {
    const mh = innerH * 0.68;
    mapBox = { x: M, y: top, w: W - 2 * M, h: mh };
    infoBox = { x: M, y: top + mh + M / 2, w: W - 2 * M, h: innerH - mh - M / 2 };
  } else {
    mapBox = { x: M, y: top, w: W * 0.68 - M * 1.5, h: innerH };
    infoBox = { x: W * 0.68 + M / 2, y: top, w: W * 0.32 - M * 1.5, h: innerH };
  }
  const frame: Box = { x: mapBox.x + G, y: mapBox.y + G, w: mapBox.w - 2 * G, h: mapBox.h - 2 * G };
  return { W, H, headH, mapBox, infoBox: infoBox as Box | null, frame };
}

/** Zoom & geser peta. zoom 1 = tampilan awal; dx/dy = geseran dalam satuan SVG. */
export interface MapView {
  zoom: number;
  dx: number;
  dy: number;
}
export const DEFAULT_VIEW: MapView = { zoom: 1, dx: 0, dy: 0 };
/** Desa sekitar dimuat ~0.9x lebar lokasi di tiap sisi, jadi zoom out di bawah ini akan tampak kosong. */
export const MIN_ZOOM = 0.6;
export const MAX_ZOOM = 12;

/** Terapkan zoom (terhadap titik tengah bingkai) dan geseran pada proyeksi dasar. */
function withView(P: Projection, frame: Box, v: MapView): Projection {
  if (v.zoom === 1 && !v.dx && !v.dy) return P;
  const fx = frame.x + frame.w / 2;
  const fy = frame.y + frame.h / 2;
  return {
    proj: (p) => {
      const [x, y] = P.proj(p);
      return [fx + (x - fx) * v.zoom + v.dx, fy + (y - fy) * v.zoom + v.dy];
    },
    inv: (x, y) => P.inv(fx + (x - fx - v.dx) / v.zoom, fy + (y - fy - v.dy) / v.zoom),
    scale: P.scale * v.zoom,
    mPerPx: P.mPerPx / v.zoom,
  };
}

export function renderMap(input: MapInput): string {
  const { layout: L, identity, logo, basemap: BM, thumb = false, tileDetail = 1.5, view = DEFAULT_VIEW, fullMap = false, showNeighbors = true } = input;
  const base0 = showNeighbors ? input.scene : { ...input.scene, desa: [], kec: [], kab: [] };
  const scene: Scene = input.showInset === false ? { ...base0, inset: undefined } : base0;
  const { W, H, headH, mapBox, infoBox, frame } = layoutBoxes(L, fullMap);

  const sel = scene.selected;
  const hasCtx = scene.desa.length + scene.kec.length > 0;
  const bb: BBox = sel.length
    ? [Math.min(...sel.map((s) => s.bb[0])), Math.min(...sel.map((s) => s.bb[1])), Math.max(...sel.map((s) => s.bb[2])), Math.max(...sel.map((s) => s.bb[3]))]
    : [0, 0, 1, 1];
  // Lokasi mengisi sekitar 60% bingkai; sisanya untuk wilayah sekitar.
  const pad = Math.min(frame.w, frame.h) * (hasCtx ? 0.2 : 0.08);
  const base = makeProjection(bb, { x: frame.x + pad, y: frame.y + pad, w: frame.w - 2 * pad, h: frame.h - 2 * pad });
  const P = thumb ? base : withView(base, frame, view);
  const step = thumb ? 2.5 : 0.6;
  const inFrame = (b: BBox) => {
    const [x0, y1] = P.proj([b[0], b[1]]);
    const [x1, y0] = P.proj([b[2], b[3]]);
    return x1 >= frame.x && x0 <= frame.x + frame.w && y1 >= frame.y && y0 <= frame.y + frame.h;
  };

  // Dengan basemap tile: wilayah sekitar tanpa isi, lokasi agak transparan, label diberi halo agar terbaca.
  const tiles = Boolean(BM.url) && sel.length > 0;
  const darkMap = tiles ? Boolean(BM.dark) : Boolean(L.dark);
  const ctxText = darkMap ? "#e8ecf8" : "#444";
  const ctxHalo = tiles ? (darkMap ? "#111" : "#fff") : undefined;
  const boundary = darkMap ? "#f2f2f2" : "#333";
  const out: string[] = [];
  const clip = `clip-${L.id}-${thumb ? "t" : "f"}`;

  out.push(`<rect width="${W}" height="${H}" fill="${L.bg}"/>`);
  if (headH) {
    out.push(`<rect width="${W}" height="${headH}" fill="${L.headBg}"/>`);
    out.push(txt(W / 2, 46, identity.judul || "PETA LOKASI", { size: 28, weight: 700, fill: L.headText, anchor: "middle" }));
    out.push(txt(W / 2, 76, sel.map((s) => s.name).join(", ") || "Lokasi belum dipilih", { size: 16, fill: L.headText, anchor: "middle" }));
  }

  // Bingkai luar area peta (tempat label koordinat)
  out.push(`<rect x="${mapBox.x}" y="${mapBox.y}" width="${mapBox.w}" height="${mapBox.h}" fill="none" stroke="${L.frame}" stroke-width="1"/>`);
  out.push(`<defs><clipPath id="${clip}"><rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}"/></clipPath></defs>`);
  out.push(`<rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" fill="${L.mapBg ?? "#fbf9f2"}"/>`);
  out.push(`<g clip-path="url(#${clip})" stroke-linejoin="round">`);
  if (tiles) out.push(...tileLayer(BM, P, frame, thumb ? tileDetail * 0.5 : tileDetail));

  if (!sel.length) {
    out.push(txt(frame.x + frame.w / 2, frame.y + frame.h / 2, "Pilih lokasi dulu", { size: thumb ? 26 : 18, fill: ctxText, anchor: "middle" }));
  }

  const desa = scene.desa.filter((s) => inFrame(s.bb));
  const kec = scene.kec.filter((s) => inFrame(s.bb));
  const kab = scene.kab.filter((s) => inFrame(s.bb));

  // Isi: desa sekitar, atau kecamatan kalau area terlalu luas untuk desa.
  if (desa.length) {
    const fill = tiles ? "none" : L.ctxFill;
    const line = tiles ? boundary : L.ctxLine;
    for (const s of desa) out.push(`<path d="${pathOf(s.rings, P.proj, step)}" fill="${fill}" stroke="${line}" stroke-width="${tiles ? 0.7 : 0.8}" stroke-opacity="${tiles ? 0.7 : 1}" fill-rule="evenodd"/>`);
  } else if (!tiles) {
    for (const s of kec) out.push(`<path d="${pathOf(s.rings, P.proj, step)}" fill="${L.ctxFill}" stroke="none" fill-rule="evenodd"/>`);
  }
  // Batas kecamatan/kab di bawah lokasi: batas kecamatan di data tidak selalu persis berimpit
  // dengan batas desa, jadi garisnya jangan sampai memotong lokasi terpilih.
  for (const s of kec) out.push(`<path d="${pathOf(s.rings, P.proj, step)}" fill="none" stroke="${boundary}" stroke-width="1.1" stroke-dasharray="6 3"/>`);
  for (const s of kab) out.push(`<path d="${pathOf(s.rings, P.proj, step)}" fill="none" stroke="${boundary}" stroke-width="2" stroke-dasharray="12 4 2 4"/>`);
  for (const s of sel) out.push(`<path d="${pathOf(s.rings, P.proj, step)}" fill="${L.fill}" fill-opacity="${tiles ? 0.55 : 1}" stroke="none" fill-rule="evenodd"/>`);
  for (const s of sel) out.push(`<path d="${pathOf(s.rings, P.proj, step)}" fill="none" stroke="${L.stroke}" stroke-width="2.2"/>`);

  // Label wilayah sekitar, tanpa saling tumpuk.
  if (!thumb) {
    const placed: Box[] = [];
    const fits = (b: Box) =>
      b.x > frame.x + 4 && b.x + b.w < frame.x + frame.w - 4 && b.y > frame.y + 4 && b.y + b.h < frame.y + frame.h - 4 &&
      !placed.some((p) => b.x < p.x + p.w && b.x + b.w > p.x && b.y < p.y + p.h && b.y + b.h > p.y);
    for (const s of sel) {
      const [cx, cy] = P.proj(labelPoint(s.rings));
      const w = s.name.length * 8.5;
      placed.push({ x: cx - w / 2, y: cy - 14, w, h: 18 });
    }
    const labelSrc = desa.length ? desa : kec;
    const size = desa.length ? 10 : 11;
    for (const s of labelSrc) {
      const [x0, y1] = P.proj([s.bb[0], s.bb[1]]);
      const [x1, y0] = P.proj([s.bb[2], s.bb[3]]);
      const name = s.name;
      const w = name.length * size * 0.55;
      if (x1 - x0 < w * 0.8 || y1 - y0 < 14) continue;
      const [cx, cy] = P.proj(labelPoint(s.rings));
      const box = { x: cx - w / 2, y: cy - size, w, h: size + 4 };
      if (!fits(box)) continue;
      placed.push(box);
      out.push(txt(cx, cy, name, { size, fill: ctxText, anchor: "middle", halo: ctxHalo }));
    }
  }
  for (const s of sel) {
    const [cx, cy] = P.proj(labelPoint(s.rings));
    out.push(
      txt(cx, cy, s.name.replace(/^(Desa|Kelurahan) /, "").toUpperCase(), {
        size: thumb ? 22 : 14,
        weight: 700,
        fill: L.dark ? "#0f1220" : "#111",
        anchor: "middle",
        halo: L.dark ? L.fill : "#ffffff",
      })
    );
  }
  if (tiles && BM.attribution && !thumb) {
    const w = BM.attribution.length * 4.6 + 8;
    out.push(`<rect x="${frame.x + frame.w - w}" y="${frame.y + frame.h - 13}" width="${w}" height="13" fill="#fff" fill-opacity="0.8"/>`);
    out.push(txt(frame.x + frame.w - 4, frame.y + frame.h - 3.5, BM.attribution, { size: 8, fill: "#333", anchor: "end" }));
  }
  out.push(`</g>`);

  // Bingkai peta
  out.push(`<rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" fill="none" stroke="${L.frame}" stroke-width="${L.thickFrame ? 5 : 2}"/>`);
  if (L.doubleFrame) {
    out.push(`<rect x="${mapBox.x + 4}" y="${mapBox.y + 4}" width="${mapBox.w - 8}" height="${mapBox.h - 8}" fill="none" stroke="${L.frame}" stroke-width="1"/>`);
  }

  // Grid koordinat
  if (sel.length) {
    const [lng0, lat1] = P.inv(frame.x, frame.y);
    const [lng1, lat0] = P.inv(frame.x + frame.w, frame.y + frame.h);
    const g = gridStep(Math.min(lng1 - lng0, lat1 - lat0));
    const gs = thumb ? 0 : 9;
    for (let v = Math.ceil(lng0 / g) * g; v < lng1; v += g) {
      const [x] = P.proj([v, lat0]);
      if (x < frame.x + 15 || x > frame.x + frame.w - 15) continue;
      out.push(`<path d="M${x.toFixed(1)} ${frame.y}v-5M${x.toFixed(1)} ${frame.y + frame.h}v5" stroke="${L.frame}" stroke-width="1"/>`);
      if (gs) {
        const label = dms(v, "BT", "BB");
        out.push(txt(x, mapBox.y + 14, label, { size: gs, fill: L.text, anchor: "middle" }));
        out.push(txt(x, mapBox.y + mapBox.h - 6, label, { size: gs, fill: L.text, anchor: "middle" }));
      }
      for (let u = Math.ceil(lat0 / g) * g; u < lat1; u += g) {
        const [, y] = P.proj([v, u]);
        if (y > frame.y + 15 && y < frame.y + frame.h - 15) {
          out.push(`<path d="M${(x - 4).toFixed(1)} ${y.toFixed(1)}h8M${x.toFixed(1)} ${(y - 4).toFixed(1)}v8" stroke="${ctxText}" stroke-width="0.8"/>`);
        }
      }
    }
    for (let u = Math.ceil(lat0 / g) * g; u < lat1; u += g) {
      const [, y] = P.proj([lng0, u]);
      if (y < frame.y + 15 || y > frame.y + frame.h - 15) continue;
      out.push(`<path d="M${frame.x} ${y.toFixed(1)}h-5M${frame.x + frame.w} ${y.toFixed(1)}h5" stroke="${L.frame}" stroke-width="1"/>`);
      if (gs) {
        const label = dms(u, "LU", "LS");
        out.push(txt(mapBox.x + 13, y, label, { size: gs, fill: L.text, anchor: "middle", rotate: -90 }));
        out.push(txt(mapBox.x + mapBox.w - 6, y, label, { size: gs, fill: L.text, anchor: "middle", rotate: -90 }));
      }
    }
  }

  // Panah utara
  const nx = frame.x + frame.w - 30;
  const ny = frame.y + 42;
  out.push(`<circle cx="${nx}" cy="${ny - 4}" r="22" fill="${L.mapBg ?? "#ffffff"}" fill-opacity="0.85"/>`);
  out.push(`<path d="M${nx} ${ny - 22}L${nx - 10} ${ny + 12}L${nx} ${ny + 5}Z" fill="${L.text}"/>`);
  out.push(`<path d="M${nx} ${ny - 22}L${nx + 10} ${ny + 12}L${nx} ${ny + 5}Z" fill="none" stroke="${L.text}" stroke-width="1.2"/>`);
  out.push(txt(nx, ny - 26 + 0.5, "U", { size: 12, weight: 700, fill: L.text, anchor: "middle" }));

  if (infoBox) {
    out.push(...infoPanel(L, infoBox, scene, identity, logo, sel.length ? P.mPerPx : 0, desa.length > 0, thumb, tiles ? BM.attribution : undefined, clip));
  } else if (sel.length) {
    out.push(...scaleOverlay(frame, P.mPerPx, darkMap));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="map-svg" role="img" aria-label="${esc(identity.judul || "Peta lokasi")}">${out.join("")}</svg>`;
}

// ---------- Peta inset ----------

const SEA = "#dcebf7";
const LAND = "#ffffff";

interface InsetLayer {
  rings: Ring[];
  fill: string;
  stroke: string;
  width: number;
}

/** Satu kotak peta kecil. Proyeksi Mercator dipaskan ke `fit`. */
function insetMap(box: Box, fit: BBox, layers: InsetLayer[], bg: string, clipId: string, frameColor: string): string[] {
  const pad = 4;
  const P = makeProjection(fit, { x: box.x + pad, y: box.y + pad, w: box.w - 2 * pad, h: box.h - 2 * pad });
  const o = [
    `<defs><clipPath id="${clipId}"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"/></clipPath></defs>`,
    `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="${bg}"/>`,
    `<g clip-path="url(#${clipId})" stroke-linejoin="round">`,
  ];
  for (const l of layers) {
    if (!l.rings.length) continue;
    o.push(`<path d="${pathOf(l.rings, P.proj, 0.5)}" fill="${l.fill}" stroke="${l.stroke}" stroke-width="${l.width}" fill-rule="evenodd"/>`);
  }
  o.push(`</g>`, `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="none" stroke="${frameColor}" stroke-width="0.8"/>`);
  return o;
}

/** Indonesia (provinsi disorot) di atas, lalu provinsi (kab/kota disorot) dan kab/kota (lokasi disorot). */
function insetBlock(L: Layout, d: InsetData, tw: number, clipPrefix: string, thumb: boolean): Block {
  const gap = 6;
  const capH = thumb ? 0 : 13;
  const topH = Math.round(tw * 0.34);
  // Baris bawah: Provinsi + Kabupaten, ditambah Kecamatan kalau lokasinya desa.
  const kec = d.kecInset;
  const n = kec ? 3 : 2;
  const subW = (tw - gap * (n - 1)) / n;
  const subH = Math.round(subW * (n === 3 ? 0.9 : 0.78));
  const line = L.dark ? "#6b7699" : "#9aa3ad";
  const hiStroke = L.stroke;
  const height = 20 + topH + gap + subH + capH;

  const pick = (rec: Record<string, Ring[]>, keys: string[]) => keys.flatMap((k) => rec[k] ?? []);
  const others = (rec: Record<string, Ring[]>, keys: string[]) =>
    Object.entries(rec).flatMap(([k, r]) => (keys.includes(k) ? [] : r));
  const bbOf = (rings: Ring[]): BBox => {
    let a = Infinity, b = Infinity, c = -Infinity, e = -Infinity;
    for (const r of rings) for (const [x, y] of r) {
      if (x < a) a = x;
      if (y < b) b = y;
      if (x > c) c = x;
      if (y > e) e = y;
    }
    return [a, b, c, e];
  };
  const grow = (b: BBox, f: number): BBox => {
    const w = (b[2] - b[0]) * f;
    const h = (b[3] - b[1]) * f;
    return [b[0] - w, b[1] - h, b[2] + w, b[3] + h];
  };
  const landBg = L.dark ? "#1d2440" : "#eef2f6";

  return {
    height,
    draw: (x, y) => {
      const o = [txt(x, y + 12, "PETA INSET", { size: 11, weight: 700, fill: L.dark ? L.fill : L.stroke })];
      const y0 = y + 20;

      // 1. Indonesia, provinsi lokasi disorot
      const indoAll = Object.values(d.indonesia).flat();
      o.push(
        ...insetMap({ x, y: y0, w: tw, h: topH }, grow(bbOf(indoAll), 0.02), [
          { rings: others(d.indonesia, d.provHit), fill: LAND, stroke: line, width: 0.4 },
          { rings: pick(d.indonesia, d.provHit), fill: L.fill, stroke: hiStroke, width: 0.6 },
        ], SEA, `${clipPrefix}-i1`, line)
      );

      const y1 = y0 + topH + gap;
      const colX = (i: number) => x + i * (subW + gap);
      const captions: string[] = [];

      // 2. Provinsi, kab/kota lokasi disorot
      const provAll = Object.values(d.prov).flat();
      if (provAll.length) {
        o.push(
          ...insetMap({ x: colX(0), y: y1, w: subW, h: subH }, grow(bbOf(provAll), 0.05), [
            { rings: others(d.prov, d.kabHit), fill: LAND, stroke: line, width: 0.5 },
            { rings: pick(d.prov, d.kabHit), fill: L.fill, stroke: hiStroke, width: 0.7 },
          ], SEA, `${clipPrefix}-i2`, line)
        );
      }
      captions.push(`Provinsi ${d.provName}`);

      // 3. Kab/kota: batas kecamatan. Kalau ada inset kecamatan, kecamatan lokasi yang disorot.
      const kecAll = Object.values(d.kec).flat();
      const kabRings = kecAll.length ? kecAll : pick(d.prov, [d.kabKode]);
      if (kabRings.length) {
        const hit = kec ? d.kec[kec.kode] ?? d.local.flat() : d.local.flat();
        o.push(
          ...insetMap({ x: colX(1), y: y1, w: subW, h: subH }, grow(bbOf(kabRings), 0.06), [
            { rings: kabRings, fill: LAND, stroke: line, width: 0.5 },
            { rings: hit, fill: L.fill, stroke: hiStroke, width: 0.8 },
          ], landBg, `${clipPrefix}-i3`, line)
        );
      }
      captions.push(d.kabName);

      // 4. Kecamatan: batas desa, desa lokasi disorot
      if (kec) {
        const all = kec.desa.flat();
        o.push(
          ...insetMap({ x: colX(2), y: y1, w: subW, h: subH }, grow(bbOf(all), 0.06), [
            { rings: all, fill: LAND, stroke: line, width: 0.5 },
            { rings: kec.hit.flat(), fill: L.fill, stroke: hiStroke, width: 0.9 },
          ], landBg, `${clipPrefix}-i4`, line)
        );
        captions.push(`Kecamatan ${kec.name}`);
      }

      if (capH) {
        const cy = y1 + subH + 11;
        const size = n === 3 ? 8 : 9;
        const maxChars = Math.floor(subW / (size * 0.52));
        captions.forEach((c, i) =>
          o.push(txt(colX(i) + subW / 2, cy, c.length > maxChars ? c.slice(0, maxChars - 1) + "…" : c, { size, fill: L.text, anchor: "middle" }))
        );
      }
      return o;
    },
  };
}

/** Skala grafis di pojok kiri bawah bingkai, untuk mode peta penuh. */
function scaleOverlay(frame: Box, mPerPx: number, darkMap: boolean): string[] {
  const dist = niceDistance(140 * mPerPx);
  const barW = dist / mPerPx;
  const unit = dist >= 1000 ? `${dist / 1000} km` : `${dist} m`;
  const x = frame.x + 14;
  const y = frame.y + frame.h - 40;
  const ink = darkMap ? "#f2f2f2" : "#222";
  const paper = darkMap ? "#111" : "#fff";
  const o = [`<rect x="${x - 8}" y="${y - 8}" width="${barW + 46}" height="34" rx="4" fill="${paper}" fill-opacity="0.8"/>`];
  for (let i = 0; i < 4; i++) {
    o.push(`<rect x="${(x + (barW / 4) * i).toFixed(1)}" y="${y}" width="${(barW / 4).toFixed(1)}" height="6" fill="${i % 2 ? paper : ink}" stroke="${ink}" stroke-width="0.8"/>`);
  }
  o.push(txt(x, y + 19, "0", { size: 10, fill: ink, anchor: "middle" }));
  o.push(txt(x + barW, y + 19, unit, { size: 10, fill: ink, anchor: "middle" }));
  return o;
}

// ---------- Panel informasi ----------

interface Block {
  height: number;
  draw: (x: number, y: number, w: number) => string[];
}

function infoPanel(
  L: Layout,
  box: Box,
  scene: Scene,
  id: Identity,
  logo: string | null,
  mPerPx: number,
  desaCtx: boolean,
  thumb: boolean,
  basemapAttribution: string | undefined,
  clipPrefix: string
): string[] {
  const cols = Math.max(1, Math.floor(box.w / 210));
  const gap = 18;
  const colW = (box.w - gap * (cols - 1)) / cols;
  const innerPad = L.cards ? 12 : 4;
  const tw = colW - innerPad * 2;
  const chars = (size: number) => Math.max(10, Math.floor(tw / (size * 0.56)));
  const accent = L.dark ? L.fill : L.stroke;

  const lines = (items: { t: string; size: number; weight?: number; italic?: boolean }[]): Block => ({
    height: items.reduce((h, l) => h + l.size * 1.35, 0),
    draw: (x, y) => {
      let cy = y;
      return items.map((l) => {
        cy += l.size * 1.35;
        return txt(x, cy - l.size * 0.3, l.t, { size: l.size, weight: l.weight, fill: L.text, italic: l.italic });
      });
    },
  });
  const titled = (title: string, body: Block): Block => ({
    height: 20 + body.height,
    draw: (x, y, w) => [txt(x, y + 12, title.toUpperCase(), { size: 11, weight: 700, fill: accent }), ...body.draw(x, y + 20, w)],
  });
  const para = (s: string, size: number, weight = 400, italic = false) =>
    wrap(s, chars(size)).map((t) => ({ t, size, weight, italic }));

  const blocks: Block[] = [];
  if (logo) {
    blocks.push({
      height: 58,
      draw: (x, y, w) => [`<image href="${esc(logo)}" x="${x}" y="${y}" width="${w}" height="54" preserveAspectRatio="xMidYMid meet"/>`],
    });
  }
  blocks.push(
    lines([
      ...para(id.judul || "PETA LOKASI", 18, 700),
      ...scene.selected.flatMap((s) => para(s.name, 13, 600)),
    ])
  );

  if (mPerPx) {
    const target = tw * 0.75;
    const dist = niceDistance(target * mPerPx);
    const barW = dist / mPerPx;
    const unit = dist >= 1000 ? `${dist / 1000} km` : `${dist} m`;
    blocks.push(
      titled("Skala", {
        height: 40,
        draw: (x, y) => {
          const o: string[] = [];
          for (let i = 0; i < 4; i++) {
            o.push(`<rect x="${(x + (barW / 4) * i).toFixed(1)}" y="${y + 4}" width="${(barW / 4).toFixed(1)}" height="6" fill="${i % 2 ? L.bg : L.text}" stroke="${L.text}" stroke-width="0.8"/>`);
          }
          o.push(txt(x, y + 24, "0", { size: 10, fill: L.text, anchor: "middle" }));
          o.push(txt(x + barW / 2, y + 24, dist >= 1000 ? `${dist / 2000}` : `${dist / 2}`, { size: 10, fill: L.text, anchor: "middle" }));
          o.push(txt(x + barW, y + 24, unit, { size: 10, fill: L.text, anchor: "middle" }));
          o.push(txt(x, y + 38, "Proyeksi Web Mercator, datum WGS 84", { size: 10, fill: L.text }));
          return o;
        },
      })
    );
  }

  const legend: [string, string][] = [["fill", "Lokasi"]];
  if (desaCtx) legend.push(["ctx", "Desa/kelurahan lain"]);
  if (scene.kec.length) legend.push(["kec", "Batas kecamatan"]);
  if (scene.kab.length) legend.push(["kab", "Batas kabupaten/kota"]);
  blocks.push(
    titled("Legenda", {
      height: legend.length * 20,
      draw: (x, y) =>
        legend.flatMap(([k, label], i) => {
          const cy = y + i * 20;
          const boundary = L.dark ? "#8f9bc4" : "#444";
          const sym =
            k === "fill" ? `<rect x="${x}" y="${cy + 2}" width="22" height="12" fill="${L.fill}" stroke="${L.stroke}" stroke-width="1.5"/>`
            : k === "ctx" ? `<rect x="${x}" y="${cy + 2}" width="22" height="12" fill="${L.ctxFill}" stroke="${L.ctxLine}"/>`
            : k === "kec" ? `<path d="M${x} ${cy + 8}h22" stroke="${boundary}" stroke-width="1.1" stroke-dasharray="6 3"/>`
            : `<path d="M${x} ${cy + 8}h22" stroke="${boundary}" stroke-width="2" stroke-dasharray="8 3 2 3"/>`;
          return [sym, txt(x + 30, cy + 12, label, { size: 12, fill: L.text })];
        }),
    })
  );

  if (scene.inset) blocks.push(insetBlock(L, scene.inset, tw, clipPrefix, thumb));

  const idLines = [id.nama, id.nim && `NIM ${id.nim}`, id.prodi, id.univ, id.tahun].filter(Boolean) as string[];
  if (idLines.length) blocks.push(titled("Disusun oleh", lines(idLines.flatMap((t) => para(t, 12)))));
  if (!thumb) {
    const sumber = basemapAttribution ? `${SUMBER_DATA}. Basemap: ${basemapAttribution}` : SUMBER_DATA;
    blocks.push(titled("Sumber data", lines(para(sumber, 9, 400, true))));
  }

  // Susun blok mengalir ke bawah, pindah kolom kalau penuh.
  const out: string[] = [];
  let col = 0;
  let y = box.y;
  for (const b of blocks) {
    const h = b.height + innerPad * 2;
    if (y + h > box.y + box.h && y > box.y && col < cols - 1) {
      col++;
      y = box.y;
    }
    // Kolom terakhir penuh: blok ini dilewati daripada keluar dari halaman.
    if (y + h > box.y + box.h + 2) continue;
    const x = box.x + col * (colW + gap);
    if (L.cards) out.push(`<rect x="${x}" y="${y}" width="${colW}" height="${h}" rx="12" fill="#fff" stroke="${L.frame}" stroke-width="1.5"/>`);
    out.push(...b.draw(x + innerPad, y + innerPad, tw));
    y += h + (L.cards ? 10 : 14);
    if (!L.cards && L.panel !== "bottom") out.push(`<path d="M${x} ${y - 7}h${colW}" stroke="${L.ctxLine}" stroke-width="0.8"/>`);
  }
  return out;
}
