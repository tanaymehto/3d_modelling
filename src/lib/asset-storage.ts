import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

type AssetKind = "images" | "models" | "previews";

const GENERATED_ROOT = path.join(process.cwd(), "public", "generated");

function isReplicateAssetUrl(sourceUrl: string): boolean {
  try {
    const host = new URL(sourceUrl).host.toLowerCase();
    return host.includes("replicate") || host.includes("delivery") || host.includes("r8.im");
  } catch {
    return false;
  }
}

async function fetchGeneratedAsset(sourceUrl: string): Promise<Response> {
  const directResponse = await fetch(sourceUrl);
  if (directResponse.ok || !isReplicateAssetUrl(sourceUrl)) {
    return directResponse;
  }

  const replicateKey = process.env.REPLICATE_API_TOKEN?.trim();
  if (!replicateKey || (directResponse.status !== 401 && directResponse.status !== 403)) {
    return directResponse;
  }

  const authAttempts = [
    { Authorization: `Bearer ${replicateKey}` },
    { Authorization: `Token ${replicateKey}` },
  ];

  for (const headers of authAttempts) {
    const response = await fetch(sourceUrl, { headers });
    if (response.ok) {
      return response;
    }
  }

  return directResponse;
}

function extFromContentType(contentType: string | null, fallback: string): string {
  const normalized = String(contentType ?? "").toLowerCase();
  if (normalized.includes("image/jpeg")) return "jpg";
  if (normalized.includes("image/png")) return "png";
  if (normalized.includes("image/webp")) return "webp";
  if (normalized.includes("video/mp4")) return "mp4";
  if (normalized.includes("video/webm")) return "webm";
  if (normalized.includes("model/gltf-binary")) return "glb";
  if (normalized.includes("application/octet-stream")) return fallback;
  return fallback;
}

function extFromUrl(url: string, fallback: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).replace(/^\./, "").toLowerCase();
    if (ext) return ext;
  } catch {
    return fallback;
  }

  return fallback;
}

function extFromMimeType(mimeType: string | null, fallback: string): string {
  return extFromContentType(mimeType, fallback);
}

async function saveBufferToGeneratedDirectory(
  buffer: Buffer,
  kind: AssetKind,
  extension: string,
): Promise<string> {
  const directory = path.join(GENERATED_ROOT, kind);
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  const absolutePath = path.join(directory, filename);

  await mkdir(directory, { recursive: true });
  await writeFile(absolutePath, buffer);

  return `/generated/${kind}/${filename}`;
}

function parseDataUrl(sourceUrl: string): { mimeType: string; data: string } | null {
  const match = sourceUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  return {
    mimeType: match[1] ?? "application/octet-stream",
    data: match[2] ?? "",
  };
}

export async function persistRemoteAsset(
  sourceUrl: string,
  kind: AssetKind,
  fallbackExtension: string,
): Promise<string> {
  if (sourceUrl.startsWith("/")) {
    return sourceUrl;
  }

  if (sourceUrl.startsWith("data:")) {
    const parsed = parseDataUrl(sourceUrl);
    if (!parsed) {
      throw new Error("Invalid inline asset data URL.");
    }

    const buffer = Buffer.from(parsed.data, "base64");
    const extension = extFromMimeType(parsed.mimeType, fallbackExtension);
    return saveBufferToGeneratedDirectory(buffer, kind, extension);
  }

  const response = await fetchGeneratedAsset(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download generated asset: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const extension = extFromContentType(
    response.headers.get("content-type"),
    extFromUrl(sourceUrl, fallbackExtension),
  );
  return saveBufferToGeneratedDirectory(buffer, kind, extension);
}