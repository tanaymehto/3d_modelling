import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const workspaces = await db.workspace.findMany({
    where: { ownerId: session.user.id },
    include: { projects: true },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ workspaces });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { name?: string };
  const name = String(body.name ?? "").trim() || "New workspace";

  const workspace = await db.workspace.create({
    data: {
      name,
      ownerId: session.user.id,
      isPrivate: true,
    },
  });

  return Response.json({ workspace }, { status: 201 });
}
