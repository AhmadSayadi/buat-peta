import { guard, jsonResponse } from "@/lib/guard";
import { getWilayah } from "@/lib/server-index";

let body: string | null = null;

export async function GET(req: Request) {
  const denied = guard(req, "meta");
  if (denied) return denied;
  body ??= JSON.stringify((await getWilayah()).meta());
  return jsonResponse(body);
}
