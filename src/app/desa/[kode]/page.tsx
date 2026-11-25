import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Builder from "@/components/Builder";
import { getWilayah } from "@/lib/server-index";
import { OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/site";

// Kode wilayah Kemendagri: 35, 35.26, 35.26.12, atau 35.26.12.2011
const KODE = /^\d{2}(\.\d{2}(\.\d{2}(\.\d{4})?)?)?$/;

async function find(kode: string) {
  const k = decodeURIComponent(kode);
  if (!KODE.test(k)) return null;
  return (await getWilayah()).lookup(k);
}

export async function generateMetadata({ params }: { params: Promise<{ kode: string }> }): Promise<Metadata> {
  const { kode } = await params;
  const lokasi = await find(kode);
  if (!lokasi) return { title: "Wilayah tidak ditemukan", robots: { index: false, follow: false } };

  const induk = lokasi.parent.split(", ")[0]; // mis. "Kecamatan Labang"
  const title = `Peta ${lokasi.name}, ${induk}`;
  const description = `Buat dan unduh peta ${lokasi.name}, ${lokasi.parent}. Batas wilayah resmi, gratis PNG 300 dpi, PDF A4, dan SVG.`;
  const path = `/desa/${lokasi.kode}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: `${title} | ${SITE_NAME}`, description, url: path, type: "article", images: [OG_IMAGE] },
    twitter: { title: `${title} | ${SITE_NAME}`, description, images: [OG_IMAGE.url] },
  };
}

export default async function DesaPage({ params }: { params: Promise<{ kode: string }> }) {
  const lokasi = await find((await params).kode);
  if (!lokasi) notFound();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `Peta ${lokasi.name}`,
    description: `Peta ${lokasi.name}, ${lokasi.parent}`,
    url: `${SITE_URL}/desa/${lokasi.kode}`,
    inLanguage: "id-ID",
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Builder preset={lokasi} />
    </>
  );
}
