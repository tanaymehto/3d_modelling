import { auth } from "@/lib/auth";
import { generate3DModel } from "@/lib/ai/model-3d-generator";
import { persistRemoteAsset } from "@/lib/asset-storage";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { projectId?: string; prompt?: string; imageUrl?: string };
  const projectId = String(body.projectId ?? "").trim();
  const prompt = String(body.prompt ?? "").trim();
  let imageUrl = String(body.imageUrl ?? "").trim();

  // Convert relative paths to absolute URLs
  if (imageUrl && !imageUrl.startsWith("http")) {
    const origin = req.headers.get("origin") || req.headers.get("x-forwarded-proto")
      ? `${req.headers.get("x-forwarded-proto")}://${req.headers.get("host")}`
      : `http://${req.headers.get("host")}`;
    imageUrl = new URL(imageUrl, origin).href;
  }

  if (!projectId || (!prompt && !imageUrl)) {
    return Response.json({ error: "projectId and either prompt or imageUrl are required" }, { status: 400 });
  }

  const meshyEnabled = Boolean(process.env.MESHY_API_KEY?.trim());
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || (!meshyEnabled && user.modelCredits <= 0)) {
    return Response.json({ error: "No 3D credits left" }, { status: 402 });
  }

  const project = await db.project.findFirst({
    where: { id: projectId, workspace: { ownerId: session.user.id } },
  });
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const generation = await db.generation.create({
    data: {
      projectId,
      prompt: prompt || "Image to 3D",
      type: "MODEL_3D",
      status: "RUNNING",
      metadata: imageUrl ? { imageUrl } : undefined,
    },
  });

  try {
    const result = await generate3DModel({ prompt, imageUrl });
    const savedModelUrl = await persistRemoteAsset(result.modelUrl, "models", "glb").catch((error) => {
      console.warn("[3d] model persist failed, using remote URL", error);
      return result.modelUrl;
    });
    const saveCadAsset = async (sourceUrl: string | undefined, extension: "obj" | "fbx" | "stl") => {
      if (!sourceUrl) return undefined;
      return persistRemoteAsset(sourceUrl, "models", extension).catch((error) => {
        console.warn(`[3d] ${extension} persist failed, using remote URL`, error);
        return sourceUrl;
      });
    };

    const cadDownloads = {
      glb: savedModelUrl,
      obj: await saveCadAsset(result.cadDownloads?.obj, "obj"),
      fbx: await saveCadAsset(result.cadDownloads?.fbx, "fbx"),
      stl: await saveCadAsset(result.cadDownloads?.stl, "stl"),
    };
    const cadDownloadsJson = Object.fromEntries(
      Object.entries(cadDownloads).filter(([, value]) => typeof value === "string" && value.length > 0),
    );

    const savedPreviewUrl = result.previewUrl
      ? await persistRemoteAsset(result.previewUrl, "previews", "mp4").catch((error) => {
          console.warn("[3d] preview persist failed, using remote URL", error);
          return result.previewUrl;
        })
      : undefined;

    await db.generatedAsset.create({
      data: {
        generationId: generation.id,
        filePath: savedModelUrl,
        fileType: "MODEL_GLB",
        metadata: { provider: result.provider },
      },
    });

    await db.generation.update({
      where: { id: generation.id },
      data: {
        status: "COMPLETED",
        metadata: {
          imageUrl,
          provider: result.provider,
          previewUrl: savedPreviewUrl ?? null,
          cadDownloads: cadDownloadsJson,
        },
      },
    });
    if (!meshyEnabled) {
      await db.user.update({ where: { id: session.user.id }, data: { modelCredits: { decrement: 1 } } });
    }

    return Response.json({
      generationId: generation.id,
      modelUrl: savedModelUrl,
      previewUrl: savedPreviewUrl ?? null,
      cadDownloads: cadDownloadsJson,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "3D generation failed. Try again in 10-20 seconds.";
    await db.generation.update({
      where: { id: generation.id },
      data: { status: "FAILED", metadata: { imageUrl, error: message } },
    });
    const status = message.toLowerCase().includes("rate limited") ? 429 : 502;
    return Response.json({ error: message }, { status });
  }
}
