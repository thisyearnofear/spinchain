/**
 * SuiEngine — Manages Sui Move contract interactions for ride sessions.
 *
 * Responsibilities:
 * - Session lifecycle: create / join / close Sui sessions
 * - Telemetry: single-point and batched submission to on-chain RiderStats
 * - EventBus integration: auto-submit telemetry on telemetry:committed,
 *   emit sui:session-started / sui:session-ended
 *
 * NOTE: Reward minting was stripped from this engine in Phase 2 of the
 * reward path consolidation. All rewards flow through IncentiveEngine
 * on Avalanche. Sui handles telemetry and sessions only.
 *
 * Design rules:
 * - Plain TS class, no React imports
 * - Uses @mysten/sui/client (SuiClient) and @mysten/sui/transactions (Transaction) directly
 * - Accepts executeTransaction callback from the page (bridges wallet signing)
 * - Accepts suiClient for read-only operations (balance queries, object fetching)
 *
 * Usage (via coordinator):
 *   await engine.startSession({ classId, duration, executeTransaction });
 *   engine.submitTelemetry({ hr, power, cadence });
 *   const result = await engine.closeSession();
 */

import { EventBus } from "./event-bus";
import { SUI_CONFIG } from "@/app/config";
import { Transaction } from "@mysten/sui/transactions";

// ─── Types ───────────────────────────────────────────────────────

export interface SuiEngineConfig {
  packageId?: string;
  network?: "testnet" | "mainnet";
  /** Callback that signs and executes a Transaction. Provided by the page's wallet hooks. */
  executeTransaction?: (tx: unknown) => Promise<{ digest: string } | null>;
  /** Optional SuiClient for read-only operations */
  suiClient?: {
    getCoins: (params: {
      owner: string;
      coinType: string;
    }) => Promise<{ data: Array<{ balance: string; coinObjectId: string }> }>;
    getObject: (params: { id: string; options?: { showContent?: boolean } }) => Promise<{
      data?: { content?: { fields?: Record<string, unknown> } };
    }>;
  };
}

export interface SuiSessionState {
  sessionId: string | null;
  statsObjectId: string | null;
  classId: string;
  isActive: boolean;
  startedAt: number;
}

export interface TelemetryPoint {
  hr: number;
  power: number;
  cadence: number;
  timestamp: number;
}

const SPINSESSION_MODULE = "spinsession";

const DEFAULT_PACKAGE_ID = SUI_CONFIG.packageId;

// ─── Engine ─────────────────────────────────────────────────────

export class SuiEngine {
  readonly bus: EventBus;

  private config: SuiEngineConfig;
  private session: SuiSessionState = {
    sessionId: null,
    statsObjectId: null,
    classId: "",
    isActive: false,
    startedAt: 0,
  };

  /** Buffer for batched telemetry submission */
  private telemetryBuffer: TelemetryPoint[] = [];
  private flushTimerId: ReturnType<typeof setInterval> | null = null;
  private totalSubmitted = 0;
  private disposed = false;

  // EventBus subscriptions (for cleanup)
  private unsubTelemetry: (() => void) | null = null;

  constructor(bus: EventBus, config: Partial<SuiEngineConfig> = {}) {
    this.bus = bus;
    this.config = {
      packageId: DEFAULT_PACKAGE_ID,
      network: SUI_CONFIG.network,
      ...config,
    };
  }

  // ─── Public Getters ────────────────────────────────────────────

  get sessionState(): Readonly<SuiSessionState> {
    return this.session;
  }

  get pendingTelemetryCount(): number {
    return this.telemetryBuffer.length;
  }

  get submittedTelemetryCount(): number {
    return this.totalSubmitted;
  }

  get isConnected(): boolean {
    return !!this.config.executeTransaction;
  }

  // ─── Session Lifecycle ────────────────────────────────────────

  /**
   * Start a new Sui session. Creates the on-chain session object.
   * Requires executeTransaction to be configured.
   */
  async startSession(classId: string, duration: number): Promise<string | null> {
    if (this.disposed) return null;
    if (!this.config.executeTransaction) {
      console.warn("[SuiEngine] No executeTransaction callback configured");
      return null;
    }

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.config.packageId}::${SPINSESSION_MODULE}::create_session`,
        arguments: [
          tx.pure.id(classId),
          tx.pure.u64(duration),
        ],
      });

      const result = await this.config.executeTransaction(tx);
      if (!result) return null;

      this.session = {
        sessionId: `pending-${Date.now()}`, // Real ID would come from tx effects + indexer
        statsObjectId: null,
        classId,
        isActive: true,
        startedAt: Date.now(),
      };

      this.bus.emit("sui:session-started", { sessionId: this.session.sessionId! });

      // Start auto-flush timer for batched telemetry
      this.startFlushTimer();

      return this.session.sessionId;
    } catch (err) {
      console.error("[SuiEngine] Failed to start session:", err);
      return null;
    }
  }

  /**
   * Join an existing Sui session as a rider. Creates a RiderStats object.
   */
  async joinSession(sessionId: string): Promise<string | null> {
    if (this.disposed) return null;
    if (!this.config.executeTransaction) {
      console.warn("[SuiEngine] No executeTransaction callback configured");
      return null;
    }

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.config.packageId}::${SPINSESSION_MODULE}::join_session`,
        arguments: [tx.object(sessionId)],
      });

      const result = await this.config.executeTransaction(tx);
      if (!result) return null;

      const statsObjectId = `stats-${Date.now()}`; // Real ID from tx effects
      this.session = {
        sessionId,
        statsObjectId,
        classId: this.session.classId,
        isActive: true,
        startedAt: Date.now(),
      };

      this.bus.emit("sui:session-started", { sessionId: this.session.sessionId! });
      this.startFlushTimer();

      return statsObjectId;
    } catch (err) {
      console.error("[SuiEngine] Failed to join session:", err);
      return null;
    }
  }

  /**
   * Close the active Sui session. Emits sui:session-ended.
   */
  async closeSession(): Promise<boolean> {
    if (this.disposed) return false;
    if (!this.session.sessionId || !this.session.isActive) return false;
    if (!this.config.executeTransaction) return false;

    // Flush any remaining telemetry before closing
    if (this.telemetryBuffer.length > 0) {
      await this.flushTelemetry();
    }

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.config.packageId}::${SPINSESSION_MODULE}::close_session`,
        arguments: [tx.object(this.session.sessionId)],
      });

      const result = await this.config.executeTransaction(tx);
      if (!result) return false;

      const prevSessionId = this.session.sessionId;
      this.stopFlushTimer();
      this.session = {
        ...this.session,
        isActive: false,
      };

      this.bus.emit("sui:session-ended", { sessionId: prevSessionId });
      return true;
    } catch (err) {
      console.error("[SuiEngine] Failed to close session:", err);
      return false;
    }
  }

  // ─── Telemetry ────────────────────────────────────────────────

  /**
   * Submit a single telemetry update to the active Sui session.
   * Returns a Transaction object for the caller to sign and execute,
   * or null if the engine executes it directly.
   */
  async submitTelemetry(hr: number, power: number, cadence: number): Promise<boolean> {
    if (this.disposed) return false;
    if (!this.session.sessionId || !this.session.statsObjectId || !this.session.isActive) {
      return false;
    }
    if (!this.config.executeTransaction) return false;

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.config.packageId}::${SPINSESSION_MODULE}::update_telemetry`,
        arguments: [
          tx.object(this.session.sessionId),
          tx.object(this.session.statsObjectId),
          tx.pure.u32(hr),
          tx.pure.u32(power),
          tx.pure.u32(cadence),
          tx.pure.u64(Date.now()),
        ],
      });

      const result = await this.config.executeTransaction(tx);
      return !!result;
    } catch (err) {
      console.error("[SuiEngine] Failed to submit telemetry:", err);
      return false;
    }
  }

  /**
   * Queue a telemetry point for batched submission (reduces gas by ~80%).
   * Auto-flushes when buffer reaches 50 points or every 5 seconds.
   */
  queueTelemetry(hr: number, power: number, cadence: number): void {
    if (this.disposed) return;
    if (!this.session.isActive) return;

    this.telemetryBuffer.push({ hr, power, cadence, timestamp: Date.now() });

    // Auto-flush at 50 points
    if (this.telemetryBuffer.length >= 50) {
      this.flushTelemetry().catch((err) =>
        console.warn("[SuiEngine] Auto-flush failed:", err),
      );
    }
  }

  /**
   * Flush buffered telemetry points as a single PTB transaction.
   */
  async flushTelemetry(): Promise<boolean> {
    if (this.disposed) return false;
    if (
      this.telemetryBuffer.length === 0 ||
      !this.session.sessionId ||
      !this.session.statsObjectId ||
      !this.config.executeTransaction
    ) {
      return false;
    }

    const batch = [...this.telemetryBuffer];
    this.telemetryBuffer = [];

    try {
      const tx = new Transaction();

      for (const point of batch) {
        tx.moveCall({
          target: `${this.config.packageId}::${SPINSESSION_MODULE}::update_telemetry`,
          arguments: [
            tx.object(this.session.sessionId),
            tx.object(this.session.statsObjectId),
            tx.pure.u32(point.hr),
            tx.pure.u32(point.power),
            tx.pure.u32(point.cadence),
            tx.pure.u64(point.timestamp),
          ],
        });
      }

      const result = await this.config.executeTransaction(tx);
      if (result) {
        this.totalSubmitted += batch.length;
        this.bus.emit("sui:telemetry-submitted", {
          count: batch.length,
          sessionId: this.session.sessionId!,
        });
      } else {
        // Re-queue on failure
        this.telemetryBuffer.unshift(...batch);
      }
      return !!result;
    } catch (err) {
      console.error("[SuiEngine] Failed to flush telemetry:", err);
      this.telemetryBuffer.unshift(...batch);
      return false;
    }
  }

  // ─── Engine Lifecycle ─────────────────────────────────────────

  /**
   * Anchor a Walrus telemetry blob on-chain ("Walrus-as-memory").
   *
   * Standalone — does NOT require an active session. Submits a single
   * anchor_telemetry_blob moveCall that mints a TelemetryAnchor object and
   * emits TelemetryBlobAttached. Returns the tx result, or null if no wallet
   * callback is configured or the call fails.
   */
  async anchorTelemetryBlob(params: {
    classId: string;
    blobId: string;
    epoch: number;
    pointCount: number;
  }): Promise<{ digest: string } | null> {
    if (this.disposed || !this.config.executeTransaction) return null;

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.config.packageId}::${SPINSESSION_MODULE}::anchor_telemetry_blob`,
        arguments: [
          tx.pure.string(params.classId),
          tx.pure.string(params.blobId),
          tx.pure.u64(params.epoch),
          tx.pure.u64(params.pointCount),
          tx.pure.u64(Date.now()),
        ],
      });

      return await this.config.executeTransaction(tx);
    } catch (err) {
      console.error("[SuiEngine] anchorTelemetryBlob failed:", err);
      return null;
    }
  }

  /**
   * Start the engine: subscribe to telemetry:committed events for auto-submit.
   */
  start(): void {
    if (this.disposed) return;

    // Auto-submit telemetry when the TelemetryEngine commits a snapshot
    this.unsubTelemetry = this.bus.on("telemetry:committed", (data) => {
      if (!this.session.isActive) return;

      const d = data as Record<string, unknown>;

      // TelemetryEngine emits data with heartRate, power, cadence fields
      const hr = typeof d.heartRate === "number" ? d.heartRate :
                 typeof d.cadence === "number" ? d.cadence : 0;
      const power = typeof d.power === "number" ? d.power : 0;
      const cadence = typeof d.cadence === "number" ? d.cadence : 0;

      this.queueTelemetry(hr, power, cadence);
    });

    // Emit sui:telemetry-submitted on successful telemetry flush
  }

  /**
   * Stop the session without disposing. Flushes pending telemetry.
   */
  async stop(): Promise<void> {
    if (this.disposed) return;

    if (this.telemetryBuffer.length > 0) {
      await this.flushTelemetry();
    }

    this.stopFlushTimer();

    if (this.unsubTelemetry) {
      this.unsubTelemetry();
      this.unsubTelemetry = null;
    }
  }

  /**
   * Dispose the engine. Clean up timers and EventBus subscriptions.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.stopFlushTimer();

    if (this.unsubTelemetry) {
      this.unsubTelemetry();
      this.unsubTelemetry = null;
    }

    this.session = {
      sessionId: null,
      statsObjectId: null,
      classId: "",
      isActive: false,
      startedAt: 0,
    };
    this.telemetryBuffer = [];
    this.totalSubmitted = 0;
  }

  // ─── Config Update ────────────────────────────────────────────

  /**
   * Update engine configuration (wallet connection, sui client, etc.).
   */
  updateConfig(config: Partial<SuiEngineConfig>): void {
    if (this.disposed) return;
    this.config = { ...this.config, ...config };
  }

  // ─── Private ──────────────────────────────────────────────────

  private startFlushTimer(): void {
    this.stopFlushTimer();
    // Flush every 5 seconds if there's buffered data
    this.flushTimerId = setInterval(() => {
      if (this.telemetryBuffer.length > 0 && !this.disposed) {
        this.flushTelemetry().catch((err) =>
          console.warn("[SuiEngine] Interval flush failed:", err),
        );
      }
    }, 5000);
  }

  private stopFlushTimer(): void {
    if (this.flushTimerId) {
      clearInterval(this.flushTimerId);
      this.flushTimerId = null;
    }
  }
}
