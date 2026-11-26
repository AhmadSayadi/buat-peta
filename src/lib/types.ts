export type Level = "desa" | "kecamatan" | "kabupaten";

export type BBox = [minLng: number, minLat: number, maxLng: number, maxLat: number];
export type Ring = [lng: number, lat: number][];

/** Format data/index.json (hanya dibaca di server). */
export interface RawIndex {
  p: [kode: string, nama: string][];
  k: [kode: string, nama: string, bbox: BBox][];
  c: [kode: string, nama: string][];
  d: [kecIdx: number, suffix: string, nama: string][];
}

/** Format data/geo/<kab>.json, ditambah `names` oleh /api/geo/[kab]. */
export interface KabGeo {
  kab: Ring[];
  kec: Record<string, Ring[]>;
  desa: Record<string, Ring[]>;
  /** kode -> nama pendek untuk kab/kota ini beserta kecamatan & desanya */
  names?: Record<string, string>;
}

/** Respons /api/meta: cukup untuk mencari kab/kota tetangga dan nama provinsi. */
export interface Meta {
  p: [kode: string, nama: string][];
  k: [kode: string, nama: string, bbox: BBox][];
}

export interface Lokasi {
  level: Level;
  kode: string;
  name: string;
  parent: string;
}

export interface Shape {
  kode: string;
  name: string;
  rings: Ring[];
  bb: BBox;
}

export interface Scene {
  selected: (Shape & { level: Level })[];
  desa: Shape[];
  kec: Shape[];
  kab: Shape[];
  inset?: InsetData;
}

/** Data peta inset: Indonesia -> provinsi -> kab/kota dari lokasi pertama. */
export interface InsetData {
  /** kode provinsi -> rings */
  indonesia: Record<string, Ring[]>;
  provKode: string;
  provName: string;
  /** kode kab/kota -> rings, untuk provinsi lokasi */
  prov: Record<string, Ring[]>;
  kabKode: string;
  kabName: string;
  /** kode kecamatan -> rings, untuk kab/kota lokasi */
  kec: Record<string, Ring[]>;
  /** provinsi & kab/kota yang memuat lokasi terpilih (disorot) */
  provHit: string[];
  kabHit: string[];
  /** lokasi terpilih di dalam kab/kota inset (disorot di inset ketiga) */
  local: Ring[][];
  /** Hanya kalau lokasi pertama berupa desa: kecamatannya beserta semua desa di dalamnya. */
  kecInset?: {
    kode: string;
    name: string;
    /** batas semua desa di kecamatan */
    desa: Ring[][];
    /** desa terpilih di kecamatan ini (disorot) */
    hit: Ring[][];
  };
}

export interface Identity {
  judul: string;
  nama: string;
  nim: string;
  tahun: string;
  prodi: string;
  univ: string;
}

export interface Layout {
  id: string;
  name: string;
  orientation?: "portrait";
  panel: "left" | "right" | "bottom";
  headBar?: boolean;
  headBg?: string;
  headText?: string;
  doubleFrame?: boolean;
  thickFrame?: boolean;
  cards?: boolean;
  dark?: boolean;
  bg: string;
  frame: string;
  fill: string;
  stroke: string;
  text: string;
  mapBg?: string;
  ctxFill: string;
  ctxLine: string;
}
