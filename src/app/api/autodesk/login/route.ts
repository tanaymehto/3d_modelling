import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { buildAutodeskAuthorizeUrl, writeAutodeskState } from "@/lib/autodesk";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.redirect(new URL("/sign-in", req.url));
  }

  const state = randomUUID();
  await writeAutodeskState(state);
  return Response.redirect(buildAutodeskAuthorizeUrl(state));
}
