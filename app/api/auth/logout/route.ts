import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/app/lib/api/response";
import { isRequestOriginAllowed } from "@/app/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout — clears the session cookie.
 */
export async function POST(request: NextRequest) {
  if (!isRequestOriginAllowed(request)) {
    return apiError("Origin mismatch", "FORBIDDEN", 403);
  }
  const response = NextResponse.json({ success: true });
  response.cookies.delete("spinchain-session");
  return response;
}
