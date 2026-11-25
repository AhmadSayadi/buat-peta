import { guard, jsonResponse } from "@/lib/guard";
import { readKabGeo } from "@/lib/server-index";

export async function GET(req: Request, { params }: { params: Promise<{ kab: string }> }) {
  const denied = guard(req, "geo");
  if (denied) return denied;
  const json = await readKabGeo((await params).kab);
  return json ? jsonResponse(json) : new Response("Not found", { status: 404 });
}
