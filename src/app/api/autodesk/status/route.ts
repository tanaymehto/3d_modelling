import { auth } from "@/lib/auth";
import { readAutodeskTokens } from "@/lib/autodesk";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ connected: false }, { status: 401 });
  }

  const tokens = await readAutodeskTokens();
  const connected = Boolean(tokens?.access_token && tokens.expires_at > Date.now());
  return Response.json({ connected, expiresAt: tokens?.expires_at ?? null });
}
