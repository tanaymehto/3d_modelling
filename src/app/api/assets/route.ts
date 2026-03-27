import { auth } from "@/lib/auth";

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (h.startsWith("10.")) return true;
  if (h.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}

function maybeReplicateHeaders(url: URL): HeadersInit | undefined {
  const host = url.host.toLowerCase();
  if (!host.includes("replicate") && !host.includes("r8.im") && !host.includes("delivery")) {
    return undefined;
  }

  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) return undefined;
  return { Authorization: `Bearer ${token}` };
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rawUrl = String(searchParams.get("url") ?? "").trim();
  if (!rawUrl) {
    return Response.json({ error: "Missing url" }, { status: 400 });
  }

  let remote: URL;
  try {
    remote = new URL(rawUrl);
  } catch {
    return Response.json({ error: "Invalid url" }, { status: 400 });
  }

  if (remote.protocol !== "https:") {
    return Response.json({ error: "Only https URLs are allowed" }, { status: 400 });
  }

  if (isPrivateHost(remote.hostname)) {
    return Response.json({ error: "Private hosts are blocked" }, { status: 400 });
  }

  const headers = maybeReplicateHeaders(remote);
  let response = await fetch(remote.toString(), headers ? { headers } : undefined);

  if (!response.ok && headers) {
    response = await fetch(remote.toString(), { headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN?.trim()}` } });
  }

  if (!response.ok) {
    return Response.json({ error: `Failed to fetch asset (${response.status})` }, { status: 502 });
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const arrayBuffer = await response.arrayBuffer();

  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
