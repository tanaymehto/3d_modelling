import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await db.project.findMany({
    where: { workspace: { ownerId: session.user.id } },
    include: { workspace: true },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ projects });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { workspaceId?: string; name?: string };
  const workspaceId = String(body.workspaceId ?? "").trim();
  const name = String(body.name ?? "").trim() || "Untitled project";

  if (!workspaceId) {
    return Response.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, ownerId: session.user.id },
  });
  if (!workspace) return Response.json({ error: "Workspace not found" }, { status: 404 });

  const project = await db.project.create({
    data: { name, workspaceId },
  });

  return Response.json({ project }, { status: 201 });
}
