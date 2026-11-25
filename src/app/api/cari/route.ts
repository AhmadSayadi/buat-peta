import { MAX_HASIL } from "@/lib/config";
import { guard, jsonResponse } from "@/lib/guard";
import { getWilayah } from "@/lib/server-index";
import type { Level, Lokasi } from "@/lib/types";

const LEVELS = new Set<Level>(["desa", "kecamatan", "kabupaten"]);

export async function GET(req: Request) {
  const denied = guard(req, "cari");
  if (denied) return denied;
  const url = new URL(req.url);
  const level = url.searchParams.get("level") as Level;
  const q = (url.searchParams.get("q") ?? "").slice(0, 100);
  if (!LEVELS.has(level)) return new Response("level tidak valid", { status: 400 });
  const w = await getWilayah();
  const results = w
    .search(level, q, new Set(), MAX_HASIL)
    .map((k) => w.lookup(k))
    .filter((x): x is Lokasi => x !== null);
  return jsonResponse(JSON.stringify(results), 300);
}
