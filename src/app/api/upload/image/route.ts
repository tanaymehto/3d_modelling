import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  return "jpg";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  const projectId = String(formData.get("projectId") || "").trim();

  if (!(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return Response.json({ error: "Unsupported file type. Use PNG or JPG." }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "Image must be between 1 byte and 10MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = extensionForMimeType(file.type);
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;

  const outputDir = path.join(process.cwd(), "public", "generated", "images");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, filename), buffer);

  const fallbackUrl = `/api/generated/images/${filename}`;

  // If projectId is provided, store this reference image sketch as a successful IMAGE Generation 
  // so that it persists in the database and shows up in the chat feed on reload
  if (projectId) {
    const project = await db.project.findFirst({
      where: { id: projectId, workspace: { ownerId: session.user.id } },
    });

    if (project) {
      const generation = await db.generation.create({
        data: {
          projectId,
          prompt: `Attached sketch: ${file.name || "Upload"}`,
          type: "IMAGE",
          status: "COMPLETED",
          metadata: { isUpload: true },
        },
      });

      await db.generatedAsset.create({
        data: {
          generationId: generation.id,
          filePath: fallbackUrl,
          fileType: "IMAGE",
          metadata: { filename: file.name },
        },
      });
    }
  }

  const base64 = buffer.toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  return Response.json({
    imageUrl: dataUri,
    fallbackUrl
  });
}
