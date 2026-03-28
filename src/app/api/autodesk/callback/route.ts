import { exchangeAutodeskCode, readAutodeskState, writeAutodeskTokens } from "@/lib/autodesk";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim();
  const state = url.searchParams.get("state")?.trim();
  const expectedState = await readAutodeskState();

  if (!code || !state || !expectedState || state !== expectedState) {
    return Response.redirect(new URL("/dashboard?autodesk=error", req.url));
  }

  try {
    const tokens = await exchangeAutodeskCode(code);
    await writeAutodeskTokens(tokens);
    return Response.redirect(new URL("/dashboard?autodesk=connected", req.url));
  } catch {
    return Response.redirect(new URL("/dashboard?autodesk=error", req.url));
  }
}
