import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { KabGeo, RawIndex } from "./types";
import { Wilayah } from "./wilayah";

/** Folder data di luar public/, jadi tidak bisa diunduh langsung lewat URL. */
const DATA_DIR = path.join(process.cwd(), "data");

let cached: Promise<Wilayah> | null = null;

/** Indeks wilayah lengkap (pencarian, validasi kode, nama). */
export function getWilayah(): Promise<Wilayah> {
  cached ??= fs.readFile(path.join(DATA_DIR, "index.json"), "utf8").then((t) => new Wilayah(JSON.parse(t) as RawIndex));
  cached.catch(() => (cached = null));
  return cached;
}

const KAB = /^\d{2}\.\d{2}$/;
const INSET = /^(indonesia|\d{2})$/;

/** Cache kecil supaya kab/kota yang sering diminta tidak dibaca ulang dari disk. */
const geoCache = new Map<string, string>();
const GEO_CACHE_MAX = 40;

/** Geometri satu kab/kota sebagai JSON string, ditambah nama wilayahnya. null kalau kode tidak valid/tidak ada. */
export async function readKabGeo(kab: string): Promise<string | null> {
  if (!KAB.test(kab)) return null;
  const hit = geoCache.get(kab);
  if (hit) {
    geoCache.delete(kab);
    geoCache.set(kab, hit);
    return hit;
  }
  let raw: string;
  try {
    raw = await fs.readFile(path.join(DATA_DIR, "geo", `${kab}.json`), "utf8");
  } catch {
    return null;
  }
  const geo = JSON.parse(raw) as KabGeo;
  geo.names = (await getWilayah()).namesForKab(kab);
  const json = JSON.stringify(geo);
  geoCache.set(kab, json);
  if (geoCache.size > GEO_CACHE_MAX) geoCache.delete(geoCache.keys().next().value!);
  return json;
}

export async function readInset(name: string): Promise<string | null> {
  if (!INSET.test(name)) return null;
  try {
    return await fs.readFile(path.join(DATA_DIR, "inset", `${name}.json`), "utf8");
  } catch {
    return null;
  }
}
