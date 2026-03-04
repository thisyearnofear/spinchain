/**
 * MindbodyAdapter - Bridge between Mindbody/ClassPass bookings and on-chain tickets
 *
 * Core Principles:
 * - MODULAR: Isolated adapter, no changes to core protocol
 * - CLEAN: Single responsibility — translate Mindbody bookings to on-chain mints
 * - DRY: Reuses existing contract ABIs and error handling
 *
 * Flow:
 *   Mindbody API → poll bookings → map to ClassFactory mint → wallet-less claim link
 *
 * Production setup:
 *   Set MINDBODY_API_KEY and MINDBODY_SITE_ID in environment.
 *   The adapter is intentionally read-only on the Mindbody side (no writes back).
 */

// ─── Mindbody API Types ───────────────────────────────────────────────────────

export interface MindbodyClass {
  Id: number;
  ClassDescription: { Name: string; Description: string };
  StartDateTime: string;   // ISO 8601
  EndDateTime: string;
  Staff: { DisplayName: string };
  Location: { Name: string };
  MaxCapacity: number;
  TotalBooked: number;
}

export interface MindbodyBooking {
  Id: number;
  Client: {
    Id: string;
    Email: string;
    FirstName: string;
    LastName: string;
  };
  Class: MindbodyClass;
  Status: 'Booked' | 'Waitlisted' | 'Cancelled';
}

// ─── On-chain ticket types ────────────────────────────────────────────────────

export interface OnChainTicketRequest {
  classId: string;          // Derived from Mindbody class ID
  recipientEmail: string;   // For wallet-less claim link
  instructorName: string;
  startTime: number;        // Unix timestamp
  maxCapacity: number;
}

export interface ClaimLink {
  url: string;              // e.g. https://app.spinchain.xyz/claim?token=...
  token: string;            // JWT or signed payload
  expiresAt: number;        // Unix timestamp
  booking: MindbodyBooking;
}

export interface SyncResult {
  synced: number;
  skipped: number;
  errors: string[];
  claimLinks: ClaimLink[];
}

// ─── Config ──────────────────────────────────────────────────────────────────

const MINDBODY_BASE_URL = 'https://api.mindbodyonline.com/public/v6';
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.spinchain.xyz';
const CLAIM_LINK_TTL_SECS = 7 * 24 * 60 * 60; // 7 days

// ─── MindbodyAdapter ─────────────────────────────────────────────────────────

export class MindbodyAdapter {
  private apiKey: string;
  private siteId: string;

  constructor(apiKey?: string, siteId?: string) {
    this.apiKey = apiKey ?? process.env.MINDBODY_API_KEY ?? '';
    this.siteId = siteId ?? process.env.MINDBODY_SITE_ID ?? '';
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Api-Key': this.apiKey,
      'SiteId': this.siteId,
    };
  }

  // ── Mindbody API calls ──────────────────────────────────────────────────────

  /** Fetch upcoming classes from Mindbody */
  async fetchClasses(startDate: Date, endDate: Date): Promise<MindbodyClass[]> {
    if (!this.apiKey || !this.siteId) {
      console.warn('[MindbodyAdapter] API key or site ID not configured — returning empty list');
      return [];
    }

    const params = new URLSearchParams({
      StartDateTime: startDate.toISOString(),
      EndDateTime: endDate.toISOString(),
    });

    const response = await fetch(
      `${MINDBODY_BASE_URL}/class/classes?${params}`,
      { headers: this.headers },
    );

    if (!response.ok) {
      throw new Error(`Mindbody API error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.Classes ?? []) as MindbodyClass[];
  }

  /** Fetch bookings for a specific class */
  async fetchBookings(classId: number): Promise<MindbodyBooking[]> {
    if (!this.apiKey || !this.siteId) return [];

    const response = await fetch(
      `${MINDBODY_BASE_URL}/class/classbookings?ClassId=${classId}`,
      { headers: this.headers },
    );

    if (!response.ok) {
      throw new Error(`Mindbody bookings error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.Bookings ?? []) as MindbodyBooking[];
  }

  // ── Mapping ─────────────────────────────────────────────────────────────────

  /** Map a Mindbody class to an on-chain ticket request */
  mapClassToTicketRequest(mbClass: MindbodyClass): OnChainTicketRequest {
    return {
      classId: `mindbody-${mbClass.Id}`,
      recipientEmail: '',   // Filled per-booking in syncBookings
      instructorName: mbClass.Staff.DisplayName,
      startTime: Math.floor(new Date(mbClass.StartDateTime).getTime() / 1000),
      maxCapacity: mbClass.MaxCapacity,
    };
  }

  // ── Claim links (wallet-less entry point) ───────────────────────────────────

  /**
   * Generate a wallet-less claim link for a non-crypto user.
   * The token encodes the booking ID + expiry as a base64 payload.
   * In production, sign this with a server-side secret (e.g. JWT).
   */
  generateClaimLink(booking: MindbodyBooking): ClaimLink {
    const expiresAt = Math.floor(Date.now() / 1000) + CLAIM_LINK_TTL_SECS;
    const payload = {
      bookingId: booking.Id,
      classId: booking.Class.Id,
      email: booking.Client.Email,
      expiresAt,
    };

    // Base64-encode payload (replace with JWT signing in production)
    const token = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const url = `${APP_BASE_URL}/claim?token=${token}`;

    return { url, token, expiresAt, booking };
  }

  // ── Sync ────────────────────────────────────────────────────────────────────

  /**
   * Full sync: fetch bookings for upcoming classes → generate claim links.
   * On-chain minting is intentionally deferred to the claim page
   * (rider clicks link → wallet-less mint via relayer or their own wallet).
   */
  async syncBookings(
    startDate: Date = new Date(),
    endDate: Date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    onMint?: (request: OnChainTicketRequest, booking: MindbodyBooking) => Promise<void>,
  ): Promise<SyncResult> {
    const result: SyncResult = { synced: 0, skipped: 0, errors: [], claimLinks: [] };

    let classes: MindbodyClass[];
    try {
      classes = await this.fetchClasses(startDate, endDate);
    } catch (err) {
      result.errors.push(`fetchClasses failed: ${err instanceof Error ? err.message : String(err)}`);
      return result;
    }

    for (const mbClass of classes) {
      let bookings: MindbodyBooking[];
      try {
        bookings = await this.fetchBookings(mbClass.Id);
      } catch (err) {
        result.errors.push(`fetchBookings(${mbClass.Id}) failed: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }

      for (const booking of bookings) {
        if (booking.Status !== 'Booked') {
          result.skipped++;
          continue;
        }

        try {
          const ticketRequest: OnChainTicketRequest = {
            ...this.mapClassToTicketRequest(mbClass),
            recipientEmail: booking.Client.Email,
          };

          // Optional: trigger on-chain mint immediately (e.g. via relayer)
          if (onMint) {
            await onMint(ticketRequest, booking);
          }

          // Always generate a claim link (wallet-less fallback)
          const claimLink = this.generateClaimLink(booking);
          result.claimLinks.push(claimLink);
          result.synced++;
        } catch (err) {
          result.errors.push(
            `booking ${booking.Id} failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    return result;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let adapterInstance: MindbodyAdapter | null = null;

export function getMindbodyAdapter(): MindbodyAdapter {
  if (!adapterInstance) {
    adapterInstance = new MindbodyAdapter();
  }
  return adapterInstance;
}
