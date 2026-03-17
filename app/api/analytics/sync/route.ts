import { NextRequest, NextResponse } from "next/server";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

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

export async function GET(req: NextRequest) {
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
  try {
    const body = await req.json();
    const { events, sessionId } = body;

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: "Invalid payload: expected 'events' array" },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "Invalid payload: 'sessionId' is required" },
        { status: 400 }
      );
    }

    const validEvents: string[] = [];
    const invalidEvents: string[] = [];

    for (const event of events) {
      if (!event.name || typeof event.timestamp !== "number") {
        invalidEvents.push(event.name || "unknown");
        continue;
      }

      const analyticsEvent = {
        name: event.name,
        timestamp: event.timestamp,
        path: event.path,
        payload: event.payload || {},
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
