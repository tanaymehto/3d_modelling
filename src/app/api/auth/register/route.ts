import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      password?: string;
    };

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").toLowerCase().trim();
    const password = String(body.password ?? "");

    if (!name || !email || password.length < 8) {
      return Response.json(
        { error: "Name, email and password (min 8 chars) are required" },
        { status: 400 },
      );
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return Response.json({ error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
    });

    await db.workspace.create({
      data: {
        name: "Private workspace",
        ownerId: user.id,
        isPrivate: true,
      },
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
}
