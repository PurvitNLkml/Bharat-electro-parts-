import { readToken } from "@/lib/auth/token";
import { getRepo } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function GET(request: Request) {
  if (isSupabaseConfigured()) return new Response("Use a storage signed URL.", { status: 404 });
  const token = new URL(request.url).searchParams.get("token");
  const value = readToken(token);
  if (!value) return new Response("This link is not valid.", { status: 403 });
  const split = value.lastIndexOf("|");
  const path = value.slice(0, split);
  const exp = Number(value.slice(split + 1));
  if (!path || !Number.isFinite(exp) || Date.now() > exp) return new Response("This link has expired.", { status: 403 });
  const file = await (await getRepo()).readDemoAttachment(path);
  if (!file) return new Response("File not found.", { status: 404 });
  return new Response(Buffer.from(file.base64, "base64"), {
    headers: {
      "content-type": file.contentType,
      "content-disposition": `attachment; filename="${file.filename.replace(/"/g, "")}"`,
      "cache-control": "private, no-store",
    },
  });
}
