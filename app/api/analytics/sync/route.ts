import { NextRequest, NextResponse } from "next/server";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export const dynamic = 'force-dynamic';

// In-memory store for analytics events (resets on server restart)
// For production, use a database (Postgres, Redis, etc.)
const analyticsEvents: Array<{
  name: string;
  timestamp: number;
  path?: string;
  payload: Record<string, unknown>;
  sessionId: string;
}> = [];

const MAX_EVENTS = 10000;
const MAX_BATCH_SIZE = 50;
const MAX_EVENT_NAME_LENGTH = 100;
const MAX_SESSION_ID_LENGTH = 128;
const MAX_PATH_LENGTH = 256;
const MAX_PAYLOAD_STRING_LENGTH = 512;

// Persistent storage path (for development - use DB in production)
const ANALYTICS_DIR = join(process.cwd(), "data");
const ANALYTICS_FILE = join(ANALYTICS_DIR, "analytics.jsonl");

function ensureAnalyticsDir() {
  if (!existsSync(ANALYTICS_DIR)) {
    mkdirSync(ANALYTICS_DIR, { recursive: true });
  }
}

function persistEvent(event: typeof analyticsEvents[0]) {
  ensureAnalyticsDir();
  appendFileSync(ANALYTICS_FILE, JSON.stringify(event) + "\n", "utf-8");
}

function isServerAnalyticsEnabled() {
  return process.env.ENABLE_SERVER_ANALYTICS === "true";
}

function hasAdminAccess(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") return true;
  const token = process.env.ANALYTICS_ADMIN_TOKEN;
  if (!token) return false;
  return req.headers.get("x-analytics-admin-token") === token;
}

function sanitizePayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};

  const sanitized = Object.entries(payload as Record<string, unknown>).slice(0, 25).map(([key, value]) => {
    if (typeof value === "string") {
      return [key, value.slice(0, MAX_PAYLOAD_STRING_LENGTH)];
    }
    if (typeof value === "number" || typeof value === "boolean" || value === null) {
      return [key, value];
    }
    return [key, String(value).slice(0, MAX_PAYLOAD_STRING_LENGTH)];
  });

  return Object.fromEntries(sanitized);
}

export async function GET(req: NextRequest) {
  if (!isServerAnalyticsEnabled()) {
    return NextResponse.json(
      { error: "Analytics server storage disabled" },
      { status: 404 }
    );
  }

  if (!hasAdminAccess(req)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  // Query params for filtering
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "100"), 500);
  const eventName = req.nextUrl.searchParams.get("event");
  const since = req.nextUrl.searchParams.get("since");

  let filtered = [...analyticsEvents];

  if (eventName) {
    filtered = filtered.filter((e) => e.name === eventName);
  }

  if (since) {
    const sinceTs = parseInt(since);
    filtered = filtered.filter((e) => e.timestamp >= sinceTs);
  }

  // Return most recent first
  const results = filtered.reverse().slice(0, limit);

  // Get summary stats
  const summary = {
    totalEvents: analyticsEvents.length,
    uniqueSessions: new Set(analyticsEvents.map((e) => e.sessionId)).size,
    eventTypes: Object.fromEntries(
      [...new Set(analyticsEvents.map((e) => e.name))].map((name) => [
        name,
        analyticsEvents.filter((e) => e.name === name).length,
      ])
    ),
    recentEvents: results.length,
  };

  return NextResponse.json({
    events: results,
    summary,
  });
}

export async function POST(req: NextRequest) {
  if (!isServerAnalyticsEnabled()) {
    return NextResponse.json({
      success: true,
      accepted: 0,
      rejected: 0,
      disabled: true,
    }, { status: 202 });
  }

  try {
    const body = await req.json();
    const { events, sessionId } = body;

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: "Invalid payload: expected 'events' array" },
        { status: 400 }
      );
    }

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Invalid payload: 'sessionId' is required" },
        { status: 400 }
      );
    }

    if (sessionId.length > MAX_SESSION_ID_LENGTH) {
      return NextResponse.json(
        { error: "Invalid payload: 'sessionId' is too long" },
        { status: 400 }
      );
    }

    if (events.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Invalid payload: max ${MAX_BATCH_SIZE} events per request` },
        { status: 400 }
      );
    }

    const validEvents: string[] = [];
    const invalidEvents: string[] = [];

    for (const event of events) {
      if (
        !event.name ||
        typeof event.name !== "string" ||
        event.name.length > MAX_EVENT_NAME_LENGTH ||
        typeof event.timestamp !== "number"
      ) {
        invalidEvents.push(event.name || "unknown");
        continue;
      }

      const analyticsEvent = {
        name: event.name,
        timestamp: event.timestamp,
        path: typeof event.path === "string" ? event.path.slice(0, MAX_PATH_LENGTH) : undefined,
        payload: sanitizePayload(event.payload),
        sessionId,
      };

      analyticsEvents.push(analyticsEvent);
      validEvents.push(event.name);

      // Persist to file for backup
      try {
        persistEvent(analyticsEvent);
      } catch {
        // Best-effort persistence
      }
    }

    // Trim old events if we exceed max
    if (analyticsEvents.length > MAX_EVENTS) {
      analyticsEvents.splice(0, analyticsEvents.length - MAX_EVENTS);
    }

    return NextResponse.json({
      success: true,
      accepted: validEvents.length,
      rejected: invalidEvents.length,
      sessionId,
    });
  } catch (error) {
    console.error("Analytics sync error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
