import { readFile } from "node:fs/promises";
import path from "node:path";
import { extname } from "node:path";

function getMimeType(ext: string): string {
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".glb":
      return "model/gltf-binary";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const slug = (await params).slug;
    const filePath = path.join(process.cwd(), "public", "generated", ...slug);
    const data = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const contentType = getMimeType(ext);

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return new Response("Not found", { status: 404 });
  }
}
