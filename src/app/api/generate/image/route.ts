import { auth } from "@/lib/auth";
import { generateImages } from "@/lib/ai/image-generator";
import { persistRemoteAsset } from "@/lib/asset-storage";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    projectId?: string;
    prompt?: string;
    mode?: "design" | "multiview";
    referenceImageUrl?: string;
  };
  const projectId = String(body.projectId ?? "").trim();
  const prompt = String(body.prompt ?? "").trim();
  const mode = body.mode === "multiview" ? "multiview" : "design";
  const referenceImageUrl = String(body.referenceImageUrl ?? "").trim();

  if (!projectId || !prompt) {
    return Response.json({ error: "projectId and prompt are required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const project = await db.project.findFirst({
    where: { id: projectId, workspace: { ownerId: session.user.id } },
  });
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const generation = await db.generation.create({
    data: {
      projectId,
      prompt,
      type: "IMAGE",
      status: "RUNNING",
      metadata: referenceImageUrl ? { referenceImageUrl } : undefined,
    },
  });

  try {
    const result = await generateImages({ prompt, mode, referenceImageUrl: referenceImageUrl || undefined });
    const persisted = await Promise.allSettled(
      result.images.map((url) => persistRemoteAsset(url, "images", "jpg")),
    );

    let savedImages = persisted
      .filter((item): item is PromiseFulfilledResult<string> => item.status === "fulfilled")
      .map((item) => item.value);

    if (savedImages.length === 0) {
      // Fallback to provider URLs so generation remains usable when local persistence fails.
      savedImages = result.images.filter((url) => typeof url === "string" && url.length > 0);
    }

    if (savedImages.length === 0) {
      throw new Error("Image generation failed. No image output was returned.");
    }

    while (savedImages.length < 3) {
      savedImages.push(savedImages[savedImages.length - 1] as string);
    }

    await db.generatedAsset.createMany({
      data: savedImages.map((filePath) => ({
        generationId: generation.id,
        filePath,
        fileType: "IMAGE",
        metadata: { provider: result.provider },
      })),
    });

    await db.generation.update({
      where: { id: generation.id },
      data: {
        status: "COMPLETED",
        metadata: {
          referenceImageUrl: referenceImageUrl || null,
          provider: result.provider,
        },
      },
    });
    await db.user.update({ where: { id: session.user.id }, data: { imageCredits: { decrement: 1 } } });

    return Response.json({ generationId: generation.id, images: savedImages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed.";
    await db.generation.update({ where: { id: generation.id }, data: { status: "FAILED", metadata: { error: message } } });
    const status = message.toLowerCase().includes("rate limited") ? 429 : 502;
    return Response.json({ error: message }, { status });
  }
}

