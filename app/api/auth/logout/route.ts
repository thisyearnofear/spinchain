import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout — clears the session cookie.
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("spinchain-session");
  return response;
}
