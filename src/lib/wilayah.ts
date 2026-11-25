import type { BBox, KabGeo, Level, Lokasi, Meta, RawIndex, Ring, Scene, Shape } from "./types";

const low = (s: string) => s.toLowerCase();
export const kabOf = (kode: string) => kode.split(".").slice(0, 2).join(".");
export const levelOfKode = (kode: string): Level | null =>
  ({ 2: "kabupaten", 3: "kecamatan", 4: "desa" } as const)[kode.split(".").length as 2 | 3 | 4] ?? null;

/** Desa berkode 2xxx, kelurahan 1xxx (aturan kode Kemendagri). */
const jenisDesa = (suffix: string) => (suffix.startsWith("1") ? "Kelurahan" : "Desa");

interface Entry {
  name: string;
  hay: string;
}

/** Indeks wilayah lengkap. Hanya dipakai di server (data/index.json tidak dikirim ke browser). */
export class Wilayah {
  readonly raw: RawIndex;
  private prov = new Map<string, string>();
  private kab = new Map<string, number>();
  private kec = new Map<string, number>();
  private desa = new Map<string, number>();
  private entries: Record<Level, Entry[]>;

  constructor(raw: RawIndex) {
    this.raw = raw;
    raw.p.forEach(([k, n]) => this.prov.set(k, n));
    raw.k.forEach(([k], i) => this.kab.set(k, i));
    raw.c.forEach(([k], i) => this.kec.set(k, i));
    raw.d.forEach(([ci, suffix], i) => this.desa.set(`${raw.c[ci][0]}.${suffix}`, i));

    const kabName = (kode: string) => raw.k[this.kab.get(kabOf(kode)) ?? -1]?.[1] ?? "";
    const provName = (kode: string) => this.prov.get(kode.split(".")[0]) ?? "";
    this.entries = {
      desa: raw.d.map(([ci, , n]) => {
        const [kk, kn] = raw.c[ci];
        return { name: low(n), hay: low(`${n} ${kn} ${kabName(kk)} ${provName(kk)}`) };
      }),
      kecamatan: raw.c.map(([kk, n]) => ({ name: low(n), hay: low(`${n} ${kabName(kk)} ${provName(kk)}`) })),
      kabupaten: raw.k.map(([kk, n]) => ({
        name: low(n.replace(/^(Kabupaten|Kota) /, "")),
        hay: low(`${n} ${provName(kk)}`),
      })),
    };
  }

  /** Cari wilayah. Hasil: kode wilayah, urut dari awalan nama yang cocok lalu nama terpendek. */
  search(level: Level, term: string, exclude: Set<string>, limit: number): string[] {
    const tokens = low(term).split(/\s+/).filter(Boolean);
    if (term.trim().length < 2 || !tokens.length) return [];
    const list = this.entries[level];
    const hits: [number, number, number][] = [];
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!tokens.every((t) => e.hay.includes(t))) continue;
      const score = e.name.startsWith(tokens[0]) ? 0 : e.name.includes(tokens[0]) ? 1 : 2;
      hits.push([score, e.name.length, i]);
    }
    hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const out: string[] = [];
    for (const [, , i] of hits) {
      const kode = this.kodeAt(level, i);
      if (!exclude.has(kode)) out.push(kode);
      if (out.length >= limit) break;
    }
    return out;
  }

  desaCount(): number {
    return this.raw.d.length;
  }

  /** Kode lengkap desa ke-i (urutan sama dengan index.json). */
  desaKode(i: number): string {
    return this.kodeAt("desa", i);
  }

  kodeAt(level: Level, i: number): string {
    if (level === "desa") {
      const [ci, suffix] = this.raw.d[i];
      return `${this.raw.c[ci][0]}.${suffix}`;
    }
    return level === "kecamatan" ? this.raw.c[i][0] : this.raw.k[i][0];
  }

  /** Nama tampilan dan induk wilayah dari sebuah kode. null kalau kode tidak ada di data. */
  lookup(kode: string): Lokasi | null {
    const level = levelOfKode(kode);
    if (!level) return null;
    const prov = this.prov.get(kode.split(".")[0]) ?? "";
    const kab = this.raw.k[this.kab.get(kabOf(kode)) ?? -1]?.[1] ?? "";
    if (level === "kabupaten") {
      if (!this.kab.has(kode)) return null;
      return { level, kode, name: kab, parent: `Provinsi ${prov}` };
    }
    if (level === "kecamatan") {
      const i = this.kec.get(kode);
      if (i === undefined) return null;
      return { level, kode, name: `Kecamatan ${this.raw.c[i][1]}`, parent: `${kab}, Provinsi ${prov}` };
    }
    const i = this.desa.get(kode);
    if (i === undefined) return null;
    const [ci, suffix, n] = this.raw.d[i];
    return {
      level,
      kode,
      name: `${jenisDesa(suffix)} ${n}`,
      parent: `Kecamatan ${this.raw.c[ci][1]}, ${kab}, Provinsi ${prov}`,
    };
  }

  /** Kab/kota yang bbox-nya bersinggungan dengan area tertentu. */
  kabIntersecting(bb: BBox): string[] {
    return this.raw.k.filter(([, , b]) => intersects(b, bb)).map(([k]) => k);
  }

  provName(kode: string): string {
    return this.prov.get(kode) ?? "";
  }

  /** Data ringkas untuk browser: provinsi dan kab/kota (dengan bbox), tanpa kecamatan/desa. */
  meta(): Meta {
    return { p: this.raw.p, k: this.raw.k };
  }

  private kabNames = new Map<string, Record<string, string>>();
  /** Nama pendek kab/kota, kecamatan, dan desa di dalam satu kab/kota (dikirim bersama geometrinya). */
  namesForKab(kab: string): Record<string, string> {
    let out = this.kabNames.get(kab);
    if (out) return out;
    out = { [kab]: this.shortName(kab) };
    const prefix = kab + ".";
    const kecIdx = new Set<number>();
    this.raw.c.forEach(([k, n], i) => {
      if (k.startsWith(prefix)) {
        out![k] = n;
        kecIdx.add(i);
      }
    });
    for (const [ci, suffix, n] of this.raw.d) if (kecIdx.has(ci)) out[`${this.raw.c[ci][0]}.${suffix}`] = n;
    this.kabNames.set(kab, out);
    return out;
  }

  /** Nama pendek (tanpa awalan) untuk label desa/kecamatan sekitar. */
  shortName(kode: string): string {
    const level = levelOfKode(kode);
    if (level === "desa") return this.raw.d[this.desa.get(kode) ?? -1]?.[2] ?? "";
    if (level === "kecamatan") return this.raw.c[this.kec.get(kode) ?? -1]?.[1] ?? "";
    return this.raw.k[this.kab.get(kode) ?? -1]?.[1] ?? "";
  }
}

// ---------- Geometri ----------

export function bboxOf(rings: Ring[]): BBox {
  let a = Infinity;
  let b = Infinity;
  let c = -Infinity;
  let d = -Infinity;
  for (const r of rings) {
    for (const [x, y] of r) {
      if (x < a) a = x;
      if (y < b) b = y;
      if (x > c) c = x;
      if (y > d) d = y;
    }
  }
  return [a, b, c, d];
}

export const mergeBB = (list: BBox[]): BBox => [
  Math.min(...list.map((b) => b[0])),
  Math.min(...list.map((b) => b[1])),
  Math.max(...list.map((b) => b[2])),
  Math.max(...list.map((b) => b[3])),
];

export const intersects = (a: BBox, b: BBox) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/** Perbesar bbox sebesar `f` kali lebar/tingginya di tiap sisi. */
export function grow(bb: BBox, f: number): BBox {
  const w = Math.max(bb[2] - bb[0], 0.005);
  const h = Math.max(bb[3] - bb[1], 0.005);
  return [bb[0] - w * f, bb[1] - h * f, bb[2] + w * f, bb[3] + h * f];
}

// ---------- Nama wilayah di browser ----------

/** Yang dibutuhkan buildScene untuk menamai wilayah dan mencari kab/kota tetangga. */
export interface NameSource {
  kabIntersecting(bb: BBox): string[];
  provName(kode: string): string;
  shortName(kode: string): string;
}

/** Versi browser: provinsi & kab/kota dari /api/meta, nama kecamatan/desa ikut tiap /api/geo. */
export class ClientNames implements NameSource {
  private prov: Map<string, string>;
  private kab: Meta["k"];
  private names = new Map<string, string>();

  constructor(meta: Meta) {
    this.prov = new Map(meta.p);
    this.kab = meta.k;
    for (const [k, n] of meta.k) this.names.set(k, n);
  }
  register(names: Record<string, string> | undefined) {
    if (names) for (const [k, n] of Object.entries(names)) this.names.set(k, n);
  }
  kabIntersecting(bb: BBox) {
    return this.kab.filter(([, , b]) => intersects(b, bb)).map(([k]) => k);
  }
  provName(kode: string) {
    return this.prov.get(kode) ?? "";
  }
  shortName(kode: string) {
    return this.names.get(kode) ?? "";
  }
}

// ---------- Memuat data (browser, lewat API) ----------

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "same-origin" });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

const geoCache = new Map<string, Promise<KabGeo>>();

export function loadKabGeo(kab: string): Promise<KabGeo> {
  let job = geoCache.get(kab);
  if (!job) {
    job = getJson<KabGeo>(`/api/geo/${encodeURIComponent(kab)}`);
    job.catch(() => geoCache.delete(kab));
    geoCache.set(kab, job);
  }
  return job;
}

let metaJob: Promise<ClientNames> | null = null;
export function loadNames(): Promise<ClientNames> {
  metaJob ??= getJson<Meta>("/api/meta").then((m) => new ClientNames(m));
  metaJob.catch(() => (metaJob = null));
  return metaJob;
}

/** Pencarian di server; hanya hasil teratas yang dikirim. */
export function searchWilayah(level: Level, q: string, signal: AbortSignal): Promise<Lokasi[]> {
  return fetch(`/api/cari?level=${level}&q=${encodeURIComponent(q)}`, { signal, credentials: "same-origin" }).then((r) => {
    if (!r.ok) throw new Error(`/api/cari: HTTP ${r.status}`);
    return r.json() as Promise<Lokasi[]>;
  });
}

/** Batas maksimum kab/kota tetangga yang dimuat untuk konteks, supaya unduhan tidak membengkak. */
const MAX_KAB_KONTEKS = 8;
/** Kalau area peta lebih lebar dari ini (derajat), konteks memakai batas kecamatan, bukan desa. */
const DESA_KONTEKS_MAX_DEG = 0.6;

/**
 * Susun adegan peta: geometri lokasi terpilih, ditambah desa, kecamatan, dan kab/kota di sekitarnya
 * (termasuk dari kab/kota tetangga) supaya peta tidak "melayang" sendirian.
 */
export async function buildScene(w: ClientNames, lokasi: Lokasi[]): Promise<Scene> {
  const empty: Scene = { selected: [], desa: [], kec: [], kab: [] };
  if (!lokasi.length) return empty;

  const own = await Promise.all(lokasi.map((l) => loadKabGeo(kabOf(l.kode))));
  own.forEach((g) => w.register(g.names));
  const selected: Scene["selected"] = [];
  lokasi.forEach((l, i) => {
    const g = own[i];
    let rings: Ring[] | undefined;
    if (l.level === "desa") rings = g.desa[l.kode];
    else if (l.level === "kecamatan")
      rings = g.kec[l.kode] ?? Object.entries(g.desa).flatMap(([k, r]) => (k.startsWith(l.kode + ".") ? r : []));
    else rings = g.kab;
    if (rings?.length) selected.push({ level: l.level, kode: l.kode, name: l.name, rings, bb: bboxOf(rings) });
  });
  if (!selected.length) return empty;

  // Area konteks dibuat lebih lebar dari lokasi supaya bingkai dengan rasio berapa pun tetap terisi.
  const view = grow(mergeBB(selected.map((s) => s.bb)), 0.9);
  const ownKabs = new Set(lokasi.map((l) => kabOf(l.kode)));
  const neighbours = w.kabIntersecting(view).filter((k) => !ownKabs.has(k)).slice(0, MAX_KAB_KONTEKS);
  const geos = new Map<string, KabGeo>();
  lokasi.forEach((l, i) => geos.set(kabOf(l.kode), own[i]));
  const loaded = await Promise.allSettled(neighbours.map((k) => loadKabGeo(k)));
  loaded.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    geos.set(neighbours[i], r.value);
    w.register(r.value.names);
  });

  const taken = new Set(selected.map((s) => s.kode));
  const wide = view[2] - view[0] > DESA_KONTEKS_MAX_DEG;
  const scene: Scene = { selected, desa: [], kec: [], kab: [] };
  const add = (list: Shape[], kode: string, rings: Ring[]) => {
    const bb = bboxOf(rings);
    if (intersects(bb, view)) list.push({ kode, name: w.shortName(kode), rings, bb });
  };
  for (const [kab, g] of geos) {
    add(scene.kab, kab, g.kab);
    for (const [k, r] of Object.entries(g.kec)) add(scene.kec, k, r);
    if (!wide) for (const [k, r] of Object.entries(g.desa)) if (!taken.has(k)) add(scene.desa, k, r);
  }

  // Peta inset gagal dimuat bukan alasan untuk menggagalkan peta utama.
  try {
    const kabKode = kabOf(lokasi[0].kode);
    const provKode = kabKode.split(".")[0];
    const [indonesia, prov] = await Promise.all([loadInset("indonesia"), loadInset(provKode)]);
    scene.inset = {
      indonesia,
      provKode,
      provName: w.provName(provKode),
      prov,
      kabKode,
      kabName: w.shortName(kabKode),
      kec: geos.get(kabKode)?.kec ?? {},
      provHit: [...new Set(lokasi.map((l) => l.kode.split(".")[0]))],
      kabHit: [...new Set(lokasi.map((l) => kabOf(l.kode)))],
      local: selected.filter((s) => kabOf(s.kode) === kabKode).map((s) => s.rings),
    };
    if (lokasi[0].level === "desa") {
      const kecKode = lokasi[0].kode.split(".").slice(0, 3).join(".");
      const desaKec = Object.entries(geos.get(kabKode)?.desa ?? {}).filter(([k]) => k.startsWith(kecKode + "."));
      if (desaKec.length) {
        scene.inset.kecInset = {
          kode: kecKode,
          name: w.shortName(kecKode),
          desa: desaKec.map(([, r]) => r),
          hit: selected.filter((s) => s.kode.startsWith(kecKode + ".")).map((s) => s.rings),
        };
      }
    }
  } catch (err) {
    console.warn("Peta inset tidak dimuat:", err);
  }
  return scene;
}

const insetCache = new Map<string, Promise<Record<string, Ring[]>>>();
function loadInset(name: string): Promise<Record<string, Ring[]>> {
  let job = insetCache.get(name);
  if (!job) {
    job = getJson<Record<string, Ring[]>>(`/api/inset/${encodeURIComponent(name)}`);
    job.catch(() => insetCache.delete(name));
    insetCache.set(name, job);
  }
  return job;
}
