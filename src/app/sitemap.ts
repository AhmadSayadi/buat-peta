import type { MetadataRoute } from "next";
import { getWilayah } from "@/lib/server-index";
import { SITE_URL } from "@/lib/site";

/** Satu sitemap maksimal 50.000 URL (batas protokol). 83 ribu desa dibagi jadi beberapa file. */
const PER_SITEMAP = 50000;

export async function generateSitemaps() {
  const n = (await getWilayah()).desaCount();
  return Array.from({ length: Math.max(1, Math.ceil(n / PER_SITEMAP)) }, (_, id) => ({ id }));
}

export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const page = Number(await id);
  const w = await getWilayah();
  const from = page * PER_SITEMAP;
  const to = Math.min(w.desaCount(), from + PER_SITEMAP);
  const out: MetadataRoute.Sitemap = [];
  if (page === 0) out.push({ url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 });
  for (let i = from; i < to; i++) {
    out.push({ url: `${SITE_URL}/desa/${w.desaKode(i)}`, changeFrequency: "yearly", priority: 0.6 });
  }
  return out;
}
