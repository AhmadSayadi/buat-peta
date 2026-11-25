import { guard, jsonResponse } from "@/lib/guard";
import { readInset } from "@/lib/server-index";

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const denied = guard(req, "inset");
  if (denied) return denied;
  const json = await readInset((await params).name);
  return json ? jsonResponse(json) : new Response("Not found", { status: 404 });
}
