import { redirect } from "next/navigation";

// Halaman pencarian sekarang ada di "/". Route ini hanya meneruskan ke sana, termasuk ?q=.
export default async function BuatRedirect({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const query = Array.isArray(q) ? q[0] : q;
  redirect(query ? `/?q=${encodeURIComponent(query.slice(0, 100))}` : "/");
}
