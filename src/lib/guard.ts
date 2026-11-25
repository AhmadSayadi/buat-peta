import "server-only";

/**
 * Penjaga API data wilayah.
 *
 * - Hanya melayani fetch dari halaman situs ini sendiri (Sec-Fetch-Site: same-origin, atau Referer/Origin
 *   ber-host sama). Ini menghalangi pemakaian langsung dari situs lain dan unduhan iseng lewat address bar.
 * - Membatasi jumlah permintaan per IP supaya seluruh dataset tidak bisa disedot cepat.
 *
 * Catatan: header bisa dipalsukan oleh skrip di luar browser. Ini penghalang, bukan pengaman mutlak;
 * data yang digambar di browser memang harus sampai ke browser.
 * Rate limit disimpan di memori proses: untuk banyak instance/serverless, pindahkan ke Redis/KV atau WAF.
 */

type Bucket = "geo" | "cari" | "inset" | "meta";

const LIMITS: Record<Bucket, { max: number; windowMs: number }> = {
  geo: { max: 150, windowMs: 10 * 60_000 },
  cari: { max: 600, windowMs: 10 * 60_000 },
  inset: { max: 120, windowMs: 10 * 60_000 },
  meta: { max: 60, windowMs: 10 * 60_000 },
};

const hits = new Map<string, number[]>();
let lastSweep = Date.now();

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}

function sameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  // Browser lama tanpa Sec-Fetch-*: bandingkan host Origin/Referer dengan host permintaan.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const from = req.headers.get("origin") ?? req.headers.get("referer");
  if (!host || !from) return false;
  try {
    return new URL(from).host === host;
  } catch {
    return false;
  }
}

function rateLimited(bucket: Bucket, ip: string): number {
  const { max, windowMs } = LIMITS[bucket];
  const now = Date.now();
  const key = `${bucket}:${ip}`;
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    hits.set(key, list);
    return Math.ceil((windowMs - (now - list[0])) / 1000);
  }
  list.push(now);
  hits.set(key, list);
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 10 * 60_000) hits.delete(k);
  }
  return 0;
}

/** null kalau boleh lanjut, atau Response penolakan. */
export function guard(req: Request, bucket: Bucket): Response | null {
  if (!sameOrigin(req)) return new Response("Forbidden", { status: 403 });
  const retry = rateLimited(bucket, clientIp(req));
  if (retry) return new Response("Terlalu banyak permintaan. Coba lagi nanti.", { status: 429, headers: { "Retry-After": String(retry) } });
  return null;
}

export function jsonResponse(body: string, maxAge = 3600): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // private: boleh di-cache browser pengguna, tidak oleh CDN/proxy bersama.
      "Cache-Control": `private, max-age=${maxAge}`,
      "X-Robots-Tag": "noindex",
      Vary: "Sec-Fetch-Site",
    },
  });
}
