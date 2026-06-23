import { NextRequest } from "next/server";
import { apiOk } from "@/app/lib/api/response";
import { verifySession } from "@/app/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me — returns the current session if authenticated.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("spinchain-session")?.value
    || request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return apiOk({ session: null });
  }

  const payload = await verifySession(token);
  if (!payload) {
    return apiOk({ session: null });
  }

  return apiOk({ session: payload });
}
