// Ekspor peta di browser: SVG apa adanya, PNG 300 dpi, dan PDF A4 (berisi gambar JPEG 300 dpi).

/** Lebar A4 pada 300 dpi: landscape 297 mm, portrait 210 mm. */
const A4_300DPI = { landscape: 3508, portrait: 2480 };
/** A4 dalam point PDF (1/72 inci). */
const A4_PT = { landscape: [842, 595], portrait: [595, 842] } as const;

function viewBoxOf(svg: string): [number, number] {
  const m = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  if (!m) throw new Error("SVG tanpa viewBox");
  return [Number(m[1]), Number(m[2])];
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function rasterize(svg: string): Promise<{ canvas: HTMLCanvasElement; portrait: boolean }> {
  const [vw, vh] = viewBoxOf(svg);
  const portrait = vh > vw;
  const w = portrait ? A4_300DPI.portrait : A4_300DPI.landscape;
  const h = Math.round((w * vh) / vw);
  const sized = svg.replace("<svg ", `<svg width="${w}" height="${h}" `);
  const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak tersedia");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { canvas, portrait };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal membuat gambar"))), type, quality)
  );

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

/**
 * SVG yang digambar ke canvas (lewat <img>) tidak boleh memuat gambar dari luar,
 * jadi tile basemap diunduh lebih dulu dan diganti dengan data URL.
 */
async function inlineImages(svg: string): Promise<string> {
  const urls = [...new Set([...svg.matchAll(/<image href="(https:\/\/[^"]+)"/g)].map((m) => m[1]))];
  if (!urls.length) return svg;
  const decode = (u: string) => u.replace(/&amp;/g, "&");
  const map = new Map<string, string>();
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const u = urls[next++];
      const res = await fetch(decode(u), { mode: "cors" });
      if (!res.ok) throw new Error(`Tile gagal dimuat (HTTP ${res.status})`);
      map.set(u, await blobToDataUrl(await res.blob()));
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, urls.length) }, worker));
  return svg.replace(/<image href="(https:\/\/[^"]+)"/g, (m, u: string) => `<image href="${map.get(u) ?? u}"`);
}

export async function downloadSvg(svg: string, name: string) {
  const full = await inlineImages(svg);
  save(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${full}`], { type: "image/svg+xml" }), `${name}.svg`);
}

export async function downloadPng(svg: string, name: string) {
  const { canvas } = await rasterize(await inlineImages(svg));
  save(await toBlob(canvas, "image/png"), `${name}.png`);
}

/** PDF satu halaman A4 berisi satu gambar JPEG (DCTDecode), ditulis manual tanpa library. */
export async function downloadPdf(svg: string, name: string) {
  const { canvas, portrait } = await rasterize(await inlineImages(svg));
  const jpeg = new Uint8Array(await (await toBlob(canvas, "image/jpeg", 0.92)).arrayBuffer());
  const [pw, ph] = portrait ? A4_PT.portrait : A4_PT.landscape;

  // Muat gambar di halaman dengan margin 18 pt, rasio tetap.
  const margin = 18;
  const s = Math.min((pw - 2 * margin) / canvas.width, (ph - 2 * margin) / canvas.height);
  const dw = canvas.width * s;
  const dh = canvas.height * s;
  const dx = (pw - dw) / 2;
  const dy = (ph - dh) / 2;
  const content = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${dx.toFixed(2)} ${dy.toFixed(2)} cm /Im0 Do Q`;

  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (p: Uint8Array | string) => {
    const b = typeof p === "string" ? enc.encode(p) : p;
    parts.push(b);
    length += b.length;
  };
  const obj = (n: number, body: string) => {
    offsets[n] = length;
    push(`${n} 0 obj\n${body}\nendobj\n`);
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = length;
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  push("\nendstream\nendobj\n");
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

  const xref = length;
  push(`xref\n0 6\n0000000000 65535 f \n`);
  for (let i = 1; i <= 5; i++) push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  save(new Blob(parts as BlobPart[], { type: "application/pdf" }), `${name}.pdf`);
}
