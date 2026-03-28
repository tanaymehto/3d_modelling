import { existsSync } from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      workspaces: {
        include: {
          projects: {
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) redirect("/sign-in");

  // Seed one project for a new account so the prompt bar works immediately.
  if (user.workspaces.length === 0) {
    const ws = await db.workspace.create({
      data: {
        name: "Private workspace",
        ownerId: user.id,
        isPrivate: true,
      },
    });
    await db.project.create({
      data: {
        name: "test",
        workspaceId: ws.id,
      },
    });

    redirect("/dashboard");
  }

  if (user.workspaces[0].projects.length === 0) {
    await db.project.create({
      data: {
        name: "test",
        workspaceId: user.workspaces[0].id,
      },
    });

    redirect("/dashboard");
  }

  // Load past generations for the user's projects
  const projectIds = user.workspaces.flatMap((w: { projects: { id: string }[] }) => w.projects.map((p) => p.id));

  const pastGenerations = await db.generation.findMany({
    where: { projectId: { in: projectIds }, status: { in: ["COMPLETED", "FAILED"] } },
    include: { assets: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  function isRenderableAsset(filePath: string | undefined): boolean {
    if (!filePath) return false;
    if (filePath.startsWith("http") || filePath.startsWith("data:")) return true;
    if (filePath.startsWith("/api/assets") || filePath.startsWith("/api/generated") || filePath.startsWith("/generated/")) {
      return true;
    }

    if (!filePath.startsWith("/")) return false;

    const cleanRelativePath = filePath.replace(/^\/+/, "").split("?")[0] ?? "";
    if (!cleanRelativePath) return false;

    const absolutePath = path.join(process.cwd(), "public", cleanRelativePath.replace(/\//g, path.sep));
    return existsSync(absolutePath);
  }

  const initialMessages = pastGenerations.map((g: {
    id: string;
    prompt: string;
    type: string;
    status: string;
    metadata?: unknown;
    assets: { filePath: string; fileType: string }[];
  }) => {
    const modelPath = g.type === "MODEL_3D" ? g.assets.find((a) => a.fileType === "MODEL_GLB")?.filePath : undefined;
    const safeModelPath = modelPath?.startsWith("/sample/") ? undefined : modelPath;
    const images =
      g.type === "IMAGE"
        ? g.assets
          .filter((a) => a.fileType === "IMAGE")
          .map((a) => a.filePath)
          .filter((filePath) => isRenderableAsset(filePath))
        : undefined;

    const hasRenderableAssets = Boolean(images?.length || isRenderableAsset(safeModelPath));
    const metadata = (typeof g.metadata === "object" && g.metadata !== null ? g.metadata : {}) as {
      error?: string;
      cadDownloads?: {
        glb?: string;
        obj?: string;
        fbx?: string;
        stl?: string;
      };
    };

    const failedError = g.status === "FAILED"
      ? (metadata.error || "Generation failed. Please retry.")
      : undefined;

    return {
      id: g.id,
      prompt: g.prompt,
      images,
      modelUrl: isRenderableAsset(safeModelPath) ? safeModelPath : undefined,
      cadDownloads: metadata.cadDownloads,
      error:
        failedError ||
        (hasRenderableAssets ? undefined : "Older assets are unavailable now. New generations will persist locally."),
    };
  });

  return (
    <DashboardShell
      userName={user.name ?? "Designer"}
      imageCredits={user.imageCredits}
      modelCredits={user.modelCredits}
      workspaces={user.workspaces.map((w: { id: string; name: string; projects: { id: string; name: string }[] }) => ({
        id: w.id,
        name: w.name,
        projects: w.projects.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })),
      }))}
      initialMessages={initialMessages}
    />
  );
}
