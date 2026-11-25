import type { Metadata, Viewport } from "next";
import { Commissioner, Red_Hat_Display, Spline_Sans_Mono } from "next/font/google";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import "./globals.css";

// Tipografi dari design system: Red Hat Display (judul), Commissioner (UI), Spline Sans Mono (koordinat/skala).
const display = Red_Hat_Display({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display", display: "swap" });
const body = Commissioner({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });
const mono = Spline_Sans_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  icons: { icon: "/images/favicon.ico", shortcut: "/images/favicon.ico" },
  title: { default: SITE_TITLE, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "peta lokasi",
    "peta desa",
    "peta kelurahan",
    "peta kecamatan",
    "peta kabupaten",
    "batas wilayah Indonesia",
    "peta penelitian",
    "peta skripsi",
    "peta batas desa",
    "unduh peta gratis",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: SITE_NAME,
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [OG_IMAGE.url] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7F6F2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
