import { NextRequest, NextResponse } from "next/server";
import { getMindbodyAdapter } from "@/app/lib/integrations/mindbody";

export async function POST(_req: NextRequest) {
  try {
    const adapter = getMindbodyAdapter();
    const result = await adapter.syncBookings();

    return NextResponse.json({
      success: true,
      synced: result.synced,
      skipped: result.skipped,
      errors: result.errors,
      claimLinks: result.claimLinks.map((link) => ({
        url: link.url,
        expiresAt: link.expiresAt,
        bookingId: link.booking.Id,
        clientEmail: link.booking.Client.Email,
        className: link.booking.Class.ClassDescription.Name,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get("days") ?? "7", 10);

    const adapter = getMindbodyAdapter();
    const startDate = new Date();
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const classes = await adapter.fetchClasses(startDate, endDate);

    return NextResponse.json({
      success: true,
      classes: classes.map((c) => ({
        id: c.Id,
        name: c.ClassDescription.Name,
        description: c.ClassDescription.Description,
        instructor: c.Staff.DisplayName,
        location: c.Location.Name,
        startDateTime: c.StartDateTime,
        endDateTime: c.EndDateTime,
        maxCapacity: c.MaxCapacity,
        totalBooked: c.TotalBooked,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Fetch failed",
      },
      { status: 500 },
    );
  }
}
