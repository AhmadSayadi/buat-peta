"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BASEMAPS, LAYOUTS, LEVELS, MAX_LOKASI, PLACEHOLDER, type Basemap, type BasemapId } from "@/lib/config";
import { downloadPdf, downloadPng, downloadSvg } from "@/lib/export";
import { DEFAULT_VIEW, layoutBoxes, MAX_ZOOM, MIN_ZOOM, renderMap, type MapView } from "@/lib/render-map";
import type { Identity, Level, Lokasi, Scene } from "@/lib/types";
import { buildScene, loadNames, searchWilayah, type ClientNames } from "@/lib/wilayah";

type Format = "png" | "pdf" | "svg";
const slug = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "peta";
const EMPTY_SCENE: Scene = { selected: [], desa: [], kec: [], kab: [] };

// Pencarian terakhir disimpan di localStorage selama 1 menit. Refresh dalam waktu itu memulihkannya.
const LAST_SEARCH_KEY = "peta-lokasi:last-search";
const LAST_SEARCH_TTL_MS = 60_000;
const LEVEL_KEYS: Level[] = ["desa", "kecamatan", "kabupaten"];

function readLastSearch(): { q: string; level: Level; lokasi: Lokasi[] } | null {
  try {
    const raw = localStorage.getItem(LAST_SEARCH_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { q?: unknown; level?: unknown; lokasi?: unknown; t?: unknown };
    if (typeof v.t !== "number" || Date.now() - v.t > LAST_SEARCH_TTL_MS || !LEVEL_KEYS.includes(v.level as Level)) {
      localStorage.removeItem(LAST_SEARCH_KEY);
      return null;
    }
    const lokasi = Array.isArray(v.lokasi)
      ? (v.lokasi as Lokasi[]).filter((l) => l && typeof l.kode === "string" && typeof l.name === "string" && typeof l.parent === "string").slice(0, MAX_LOKASI)
      : [];
    return { q: typeof v.q === "string" ? v.q.slice(0, 100) : "", level: v.level as Level, lokasi };
  } catch {
    return null;
  }
}

function writeLastSearch(q: string, level: Level, lokasi: Lokasi[]) {
  try {
    localStorage.setItem(LAST_SEARCH_KEY, JSON.stringify({ q: q.slice(0, 100), level, lokasi, t: Date.now() }));
  } catch {
    // Penyimpanan penuh atau diblokir: pencarian tetap berjalan tanpa fitur ini.
  }
}

/** Identitas tidak dipakai lagi: peta memakai judul baku tanpa blok "Disusun oleh". */
const NO_IDENTITY: Identity = { judul: "", nama: "", nim: "", tahun: "", prodi: "", univ: "" };

interface Props {
  /** Halaman lokasi tetap (/desa/[kode]): langkah lokasi dikunci ke lokasi ini. */
  preset?: Lokasi;
  initialQuery?: string;
}

export default function Builder({ preset, initialQuery = "" }: Props) {
  const [wilayah, setWilayah] = useState<ClientNames | null>(null);
  const [level, setLevel] = useState<Level>("desa");
  const [query, setQuery] = useState(initialQuery);
  const [lokasi, setLokasi] = useState<Lokasi[]>(preset ? [preset] : []);
  const [scene, setScene] = useState<Scene>(EMPTY_SCENE);
  const [sceneState, setSceneState] = useState<"idle" | "loading" | "error">("idle");
  const [layoutId, setLayoutId] = useState(LAYOUTS[0].id);
  const [view, setView] = useState<MapView>(DEFAULT_VIEW);
  const [fullMap, setFullMap] = useState(false);
  const [showNeighbors, setShowNeighbors] = useState(true);
  const [showInset, setShowInset] = useState(true);
  const [basemap, setBasemap] = useState<BasemapId>("none");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<Format | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNames().then(setWilayah, (err) => {
      console.error(err);
      setSceneState("error");
    });
  }, []);

  // Pulihkan pencarian terakhir saat halaman dibuka ulang (tidak untuk /desa/[kode] atau ?q=).
  useEffect(() => {
    if (preset || initialQuery) return;
    const s = readLastSearch();
    if (s) {
      setLevel(s.level);
      setQuery(s.q);
      setLokasi(s.lokasi);
    }
  }, [preset, initialQuery]);

  function updateQuery(v: string) {
    setQuery(v);
    if (!preset) writeLastSearch(v, level, lokasi);
  }
  function updateLevel(k: Level) {
    setLevel(k);
    if (!preset) writeLastSearch(query, k, lokasi);
  }
  function removeLokasi(kode: string) {
    const next = lokasi.filter((x) => x.kode !== kode);
    setLokasi(next);
    if (!preset) writeLastSearch(query, level, next);
  }

  // Bangun ulang adegan peta setiap daftar lokasi berubah. Hasil lama diabaikan kalau sudah ada yang lebih baru.
  const sceneSeq = useRef(0);
  useEffect(() => {
    if (!wilayah) return;
    const seq = ++sceneSeq.current;
    setSceneState("loading");
    buildScene(wilayah, lokasi).then(
      (s) => {
        if (seq !== sceneSeq.current) return;
        setScene(s);
        setSceneState("idle");
      },
      (err) => {
        console.error(err);
        if (seq === sceneSeq.current) setSceneState("error");
      }
    );
  }, [wilayah, lokasi]);

  // Pencarian di server, ditunda 200 ms setelah berhenti mengetik; permintaan lama dibatalkan.
  const [found, setFound] = useState<Lokasi[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "error">("idle");
  useEffect(() => {
    const q = query.trim();
    if (preset || q.length < 2) {
      setFound([]);
      setSearchState("idle");
      return;
    }
    const ctrl = new AbortController();
    setSearchState("loading");
    const t = setTimeout(() => {
      searchWilayah(level, q, ctrl.signal).then(
        (r) => {
          setFound(r);
          setSearchState("idle");
        },
        (err) => {
          if (ctrl.signal.aborted) return;
          console.error(err);
          setSearchState("error");
        }
      );
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [level, query, preset]);
  const results = useMemo(() => {
    const taken = new Set(lokasi.map((l) => l.kode));
    return found.filter((r) => !taken.has(r.kode));
  }, [found, lokasi]);

  const layout = LAYOUTS.find((l) => l.id === layoutId) ?? LAYOUTS[0];
  const bm: Basemap = BASEMAPS[basemap];
  const showResults = !preset && query.trim().length >= 2;

  const opts = { identity: NO_IDENTITY, logo: null, basemap: bm, fullMap, showNeighbors, showInset };
  const previewSvg = useMemo(
    () => renderMap({ layout, scene, view, ...opts }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- opts dibentuk dari nilai di dependency
    [layout, scene, bm, view, fullMap, showNeighbors, showInset]
  );
  const thumbs = useMemo(
    () => LAYOUTS.map((l) => renderMap({ layout: l, scene, thumb: true, ...opts })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- opts dibentuk dari nilai di dependency
    [scene, bm, fullMap, showNeighbors, showInset]
  );

  // Tampilan kembali ke awal setiap lokasi, layout, atau mode peta penuh berganti.
  useEffect(() => setView(DEFAULT_VIEW), [lokasi, layoutId, fullMap]);

  // ---------- Zoom & geser ----------
  const boxes = layoutBoxes(layout, fullMap);
  const fcx = boxes.frame.x + boxes.frame.w / 2;
  const fcy = boxes.frame.y + boxes.frame.h / 2;
  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  /** Zoom dengan faktor `f`, menjaga titik (sx, sy) dalam satuan SVG tetap di tempat. */
  function zoomAt(f: number, sx = fcx, sy = fcy) {
    setView((v) => {
      const z = clampZoom(v.zoom * f);
      const k = z / v.zoom;
      return { zoom: z, dx: sx - fcx - (sx - fcx - v.dx) * k, dy: sy - fcy - (sy - fcy - v.dy) * k };
    });
  }

  /** Posisi pointer dalam satuan SVG, atau null kalau di luar bingkai peta. */
  function toSvg(clientX: number, clientY: number, mustBeInFrame = true): [number, number] | null {
    const svg = previewRef.current?.querySelector("svg");
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * boxes.W;
    const y = ((clientY - r.top) / r.height) * boxes.H;
    const f = boxes.frame;
    if (mustBeInFrame && (x < f.x || x > f.x + f.w || y < f.y || y > f.y + f.h)) return null;
    return [x, y];
  }

  // Wheel harus non-passive supaya halaman tidak ikut scroll saat zoom.
  const zoomRef = useRef(zoomAt);
  const toSvgRef = useRef(toSvg);
  zoomRef.current = zoomAt;
  toSvgRef.current = toSvg;
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const p = toSvgRef.current(e.clientX, e.clientY);
      if (!p) return;
      e.preventDefault();
      zoomRef.current(Math.exp(-e.deltaY * 0.0015), p[0], p[1]);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const pendingPan = useRef<{ dx: number; dy: number } | null>(null);
  const panFrame = useRef(0);
  function onPointerDown(e: React.PointerEvent) {
    const p = toSvg(e.clientX, e.clientY);
    if (!p || e.button !== 0) return;
    drag.current = { x: p[0], y: p[1], dx: view.dx, dy: view.dy };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = toSvg(e.clientX, e.clientY, false);
    if (!p) return;
    // Satu render per frame layar supaya drag tetap halus di peta yang berat.
    pendingPan.current = { dx: d.dx + p[0] - d.x, dy: d.dy + p[1] - d.y };
    if (panFrame.current) return;
    panFrame.current = requestAnimationFrame(() => {
      panFrame.current = 0;
      const next = pendingPan.current;
      if (next) setView((v) => ({ ...v, ...next }));
    });
  }
  function onPointerUp() {
    drag.current = null;
  }

  // ---------- Aksi ----------
  const ready = scene.selected.length > 0 && sceneState === "idle";

  async function unduh(format: Format) {
    if (!ready) {
      setNotice(lokasi.length ? "Tunggu peta selesai dimuat." : "Pilih lokasi dulu.");
      return;
    }
    setNotice("");
    setBusy(format);
    const name = `buat-peta-${slug(lokasi.map((l) => l.name).join(" "))}`;
    try {
      // Versi ekspor memakai tile satu tingkat zoom lebih tinggi supaya basemap tajam di 300 dpi.
      const svg = bm.url ? renderMap({ layout, scene, view, tileDetail: 3, ...opts }) : previewSvg;
      if (format === "svg") await downloadSvg(svg, name);
      else if (format === "png") await downloadPng(svg, name);
      else await downloadPdf(svg, name);
    } catch (err) {
      console.error(err);
      setNotice("Gagal membuat file. Coba lagi atau pilih format lain.");
    } finally {
      setBusy(null);
    }
  }

  function addLokasi(l: Lokasi) {
    if (lokasi.length >= MAX_LOKASI) {
      setNotice(`Maksimal ${MAX_LOKASI} lokasi dalam satu peta.`);
      return;
    }
    setNotice("");
    const next = [...lokasi, l];
    setLokasi(next);
    setQuery("");
    if (!preset) writeLastSearch("", level, next);
    // Di HP preview ada di bawah kotak cari: gulir ke sana supaya hasilnya langsung terlihat.
    if (window.matchMedia("(max-width: 960px)").matches) {
      (document.activeElement as HTMLElement | null)?.blur();
      setTimeout(() => previewCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }

  const LEVEL_SHORT: Record<Level, string> = { desa: "Desa", kecamatan: "Kecamatan", kabupaten: "Kab/Kota" };
  const statusText =
    sceneState === "loading" ? "Memuat peta..." : sceneState === "error" ? "Gagal memuat peta" : `${layout.name} · ${bm.label}`;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo kecil statis, tidak perlu optimasi */}
            <img className="brand-mark" src="/images/logo-saja.png" alt="" width={36} height={36} />
            <span>
              <span className="brand-row">
                <span className="brand-name">Buat Peta</span>
                <span className="tag">Gratis</span>
              </span>
              <span className="brand-sub">Buat peta lokasi gratis · Siap cetak 300 DPI</span>
            </span>
          </Link>
          <div className="header-actions">
            <button type="button" className="btn" onClick={() => unduh("svg")} disabled={busy !== null}>
              <Icon d={ICON.svg} size={16} />
              {busy === "svg" ? "Membuat..." : "SVG"}
            </button>
            <button type="button" className="btn" onClick={() => unduh("pdf")} disabled={busy !== null}>
              <Icon d={ICON.pdf} size={16} />
              {busy === "pdf" ? "Membuat..." : "PDF"}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => unduh("png")} disabled={busy !== null}>
              <Icon d={ICON.download} size={16} />
              {busy === "png" ? "Membuat..." : "Unduh PNG"}
            </button>
          </div>
        </div>
      </header>

      <h1 className="sr-only">{preset ? `Peta ${preset.name}, ${preset.parent}` : "Bikin peta lokasi gratis"}</h1>

      <main className="workbench">
        <section className="stage">
          <div className="stage-card" ref={previewCardRef}>
            <div className="stage-top">
              <div className="stage-title">
                <span className="dot" aria-hidden="true" />
                <h2>Kanvas Peta</h2>
                <span className="status-pill">{statusText}</span>
              </div>
              <div className="zoom-pill" role="group" aria-label="Zoom peta">
                <button type="button" aria-label="Perkecil peta" onClick={() => zoomAt(1 / 1.4)} disabled={view.zoom <= MIN_ZOOM}>
                  <Icon d={ICON.minus} size={14} />
                </button>
                <span className="zoom-readout">{Math.round(view.zoom * 100)}%</span>
                <button type="button" aria-label="Perbesar peta" onClick={() => zoomAt(1.4)} disabled={view.zoom >= MAX_ZOOM}>
                  <Icon d={ICON.plus} size={14} />
                </button>
                <button type="button" aria-label="Reset posisi peta" title="Tampilan awal" onClick={() => setView(DEFAULT_VIEW)}>
                  <Icon d={ICON.reset} size={14} />
                </button>
              </div>
            </div>

            <div className="sheet">
              <div
                ref={previewRef}
                className={`preview ${scene.selected.length ? "pannable" : ""}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                dangerouslySetInnerHTML={{ __html: previewSvg }}
              />
            </div>

            <div className="stage-foot">
              <p className="hint">
                <Icon d={ICON.move} size={14} />
                Scroll untuk zoom, drag untuk geser. Unduhan mengikuti tampilan ini.
              </p>
              <span className="mono-meta">{layout.orientation === "portrait" ? "A4 Portrait" : "A4 Landscape"} · WGS 84</span>
            </div>

            {notice && (
              <p className="notice" role="alert">
                {notice}
              </p>
            )}
          </div>

          <div className="steps-strip">
            <div>
              <span className="step-num">1</span>
              <p>Cari lokasi lalu pilih gaya peta dan basemap di panel kanan.</p>
            </div>
            <div>
              <span className="step-num">2</span>
              <p>Atur zoom dan posisi peta langsung pada kanvas pratinjau.</p>
            </div>
            <div>
              <span className="step-num">3</span>
              <p>Ekspor gratis ke PNG 300 dpi, PDF A4, atau SVG vektor.</p>
            </div>
          </div>
        </section>

        <aside className="inspector">
          <section className="insp sec-lokasi" aria-labelledby="h-lokasi">
            <div className="insp-head">
              <h2 id="h-lokasi">Lokasi Wilayah</h2>
              <span className="mono-pill">{`${lokasi.length} / ${MAX_LOKASI}`}</span>
            </div>

            {!preset && (
              <>
                <div className="segmented" role="tablist" aria-label="Tingkat wilayah">
                  {(Object.keys(LEVELS) as Level[]).map((k) => (
                    <button key={k} type="button" role="tab" aria-selected={k === level} className={k === level ? "active" : ""} onClick={() => updateLevel(k)}>
                      {LEVEL_SHORT[k]}
                    </button>
                  ))}
                </div>
                <div className="search">
                  <span className="search-icon" aria-hidden="true">
                    <Icon d={ICON.search} size={16} />
                  </span>
                  <input
                    className="field"
                    type="search"
                    value={query}
                    placeholder={PLACEHOLDER[level]}
                    autoComplete="off"
                    aria-label={PLACEHOLDER[level]}
                    onChange={(e) => updateQuery(e.target.value)}
                  />
                </div>
                {showResults && (
                  <div className="results" role="listbox">
                    {searchState === "error" ? (
                      <div className="empty">Pencarian gagal. Coba lagi sebentar.</div>
                    ) : searchState === "loading" && !results.length ? (
                      <div className="empty">Mencari...</div>
                    ) : results.length ? (
                      results.map((r) => (
                        <button key={r.kode} type="button" role="option" aria-selected={false} className="result" onClick={() => addLokasi(r)}>
                          <strong>{r.name}</strong>
                          <small>{r.parent}</small>
                        </button>
                      ))
                    ) : (
                      <div className="empty">Tidak ditemukan di {LEVELS[level]}.</div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="chips">
              {lokasi.map((l) => (
                <span key={l.kode} className={`chip ${preset ? "locked" : ""}`} title={l.parent}>
                  {l.name}
                  {!preset && (
                    <button type="button" aria-label={`Hapus ${l.name}`} onClick={() => removeLokasi(l.kode)}>
                      <Icon d={ICON.close} size={11} width={2.5} />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {preset && <p className="hint">{preset.parent}</p>}
          </section>

          <section className="insp sec-gaya" id="layout" aria-labelledby="h-gaya">
            <div className="insp-head">
              <h2 id="h-gaya">Gaya Peta</h2>
              <span className="meta">{LAYOUTS.length} gaya</span>
            </div>
            <div className="layouts">
              {LAYOUTS.map((l, i) => (
                <button key={l.id} type="button" className={`layout-card ${l.id === layoutId ? "active" : ""}`} onClick={() => setLayoutId(l.id)} aria-pressed={l.id === layoutId}>
                  <span className="thumb" dangerouslySetInnerHTML={{ __html: thumbs[i] }} />
                  <span className="layout-label">{l.name}</span>
                  {l.id === layoutId && (
                    <span className="check" aria-hidden="true">
                      <Icon d={ICON.check} size={12} width={3} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="insp sec-basemap" aria-labelledby="h-basemap">
            <div className="insp-head">
              <h2 id="h-basemap">Basemap</h2>
              <span className="meta">{Object.keys(BASEMAPS).length} pilihan</span>
            </div>
            <div className="opt-grid" role="radiogroup" aria-label="Basemap">
              {(Object.keys(BASEMAPS) as BasemapId[]).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={k === basemap} className={`opt ${k === basemap ? "active" : ""}`} onClick={() => setBasemap(k)}>
                  <span className="swatch" style={{ background: BASEMAPS[k].swatch }} />
                  {BASEMAPS[k].label}
                </button>
              ))}
            </div>
          </section>

          <section className="insp sec-tampilan" aria-labelledby="h-tampilan">
            <h2 id="h-tampilan">Tampilan Peta</h2>
            <div className="toggles">
              <Toggle checked={fullMap} onChange={setFullMap} title="Peta penuh" desc="Peta memenuhi halaman, tanpa panel judul dan legenda." />
              <Toggle checked={showNeighbors} onChange={setShowNeighbors} title="Wilayah sekitar" desc="Desa, kecamatan, dan kab/kota tetangga beserta namanya." />
              <Toggle
                checked={showInset && !fullMap}
                disabled={fullMap}
                onChange={setShowInset}
                title="Peta inset"
                desc={fullMap ? "Tidak tersedia di mode peta penuh." : "Posisi lokasi di Indonesia, provinsi, dan kab/kota."}
              />
            </div>
          </section>
        </aside>
      </main>
    </>
  );
}

const ICON = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.2-4.2",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  reset: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  svg: "M4 17l5-5 4 4 7-8",
  pdf: "M7 3h7l5 5v13H7zM14 3v5h5",
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7.5",
  move: "M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3",
};

function Toggle({
  checked,
  onChange,
  title,
  desc,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  desc: string;
  disabled?: boolean;
}) {
  return (
    <label className={`toggle ${disabled ? "disabled" : ""}`}>
      <span className="toggle-text">
        <strong>{title}</strong>
        <small>{desc}</small>
      </span>
      <input type="checkbox" role="switch" className="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Icon({ d, size = 18, width = 2 }: { d: string; size?: number; width?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
