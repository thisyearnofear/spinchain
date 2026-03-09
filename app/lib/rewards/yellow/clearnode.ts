/**
 * ClearNode Transport Layer
 *
 * Manages WebSocket connection to Yellow ClearNode and uses
 * the @erc7824/nitrolite SDK for RPC message creation and parsing.
 *
 * The SDK provides message formatters/parsers — we manage the WebSocket.
 */

"use client";

import {
  createECDSAMessageSigner,
  createAppSessionMessage,
  createSubmitAppStateMessage,
  createCloseAppSessionMessage,
  createGetAppSessionsMessageV2,
  parseCreateAppSessionResponse,
  parseSubmitAppStateResponse,
  parseGetAppSessionsResponse,
  generateRequestId,
  getRequestId,
  getError,
  RPCProtocolVersion,
  RPCChannelStatus,
  RPCAppStateIntent,
  type RPCAppDefinition,
  type RPCAppSessionAllocation,
  type RPCAppSession,
  type MessageSigner as NitroliteMessageSigner,
} from "@erc7824/nitrolite";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Hex, Address } from "viem";
import { YELLOW_CLEARNODE_URL, SPINCHAIN_PROTOCOL, DEFAULT_CHANNEL_PARAMS } from "./index";

// ============================================================================
// Session Key (ephemeral key for ClearNode RPC signing)
// ============================================================================

const SESSION_KEY_STORAGE = "spinchain:yellow:session-key";

function getOrCreateSessionKey(): { privateKey: Hex; address: Address } {
  let pk = localStorage.getItem(SESSION_KEY_STORAGE) as Hex | null;
  if (!pk) {
    pk = generatePrivateKey();
    localStorage.setItem(SESSION_KEY_STORAGE, pk);
  }
  const account = privateKeyToAccount(pk);
  return { privateKey: pk, address: account.address };
}

// ============================================================================
// Connection State
// ============================================================================

let ws: WebSocket | null = null;
let rpcSigner: NitroliteMessageSigner | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000;
let heartbeatInterval: NodeJS.Timeout | null = null;

const pendingRequests = new Map<
  number,
  { resolve: (data: string) => void; reject: (err: Error) => void }
>();

// ============================================================================
// WebSocket Transport
// ============================================================================

export async function connectClearNode(
  url: string = YELLOW_CLEARNODE_URL,
): Promise<WebSocket> {
  if (ws?.readyState === WebSocket.OPEN) return ws;
  if (ws?.readyState === WebSocket.CONNECTING) {
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          clearInterval(check);
          resolve(ws);
        } else if (ws?.readyState === WebSocket.CLOSED) {
          clearInterval(check);
          reject(new Error("Connection failed while waiting"));
        }
      }, 100);
    });
  }

  return new Promise((resolve, reject) => {
    console.log(`[ClearNode] Connecting to ${url}...`);
    const socket = new WebSocket(url);

    socket.onopen = () => {
      console.log("[ClearNode] Connected");
      reconnectAttempts = 0;
      const { privateKey } = getOrCreateSessionKey();
      rpcSigner = createECDSAMessageSigner(privateKey);
      ws = socket;
      
      // Setup heartbeat
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ method: "ping", jsonrpc: "2.0", id: 0 }));
        }
      }, 30000);

      resolve(socket);
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string);
        
        // Handle pong/heartbeat
        if (parsed.id === 0) return;

        const reqId = getRequestId(parsed);
        if (reqId !== undefined) {
          const pending = pendingRequests.get(reqId);
          if (pending) {
            const error = getError(parsed);
            if (error) {
              pending.reject(
                new Error(`ClearNode error ${error.code}: ${error.message}`),
              );
            } else {
              pending.resolve(event.data as string);
            }
          }
        }
      } catch {
        // Non-JSON or broadcast message
      }
    };

    socket.onerror = (err) => {
      console.error("[ClearNode] WebSocket error:", err);
    };

    socket.onclose = () => {
      console.log("[ClearNode] Disconnected");
      ws = null;
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }

      // Exponential backoff reconnection
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts);
        reconnectAttempts++;
        console.log(`[ClearNode] Reconnecting in ${delay}ms... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(() => connectClearNode(url), delay);
      }
    };

    // Timeout for initial connection
    setTimeout(() => {
      if (socket.readyState === WebSocket.CONNECTING) {
        socket.close();
        reject(new Error("ClearNode connection timeout"));
      }
    }, 10000);
  });
}

function sendRpc(
  message: string,
  requestId: number,
  timeout = 10000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error("ClearNode not connected"));
      return;
    }

    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error("ClearNode request timeout"));
    }, timeout);

    pendingRequests.set(requestId, {
      resolve: (data) => {
        clearTimeout(timer);
        pendingRequests.delete(requestId);
        resolve(data);
      },
      reject: (err) => {
        clearTimeout(timer);
        pendingRequests.delete(requestId);
        reject(err);
      },
    });

    ws.send(message);
  });
}

// ============================================================================
// SDK Operations
// ============================================================================

export async function createSession(
  rider: Address,
  instructor: Address,
  classId: string,
  extraParticipants: Address[] = [],
): Promise<{ appSessionId: Hex; version: number }> {
  await connectClearNode();
  if (!rpcSigner) throw new Error("Signer not initialized");

  const requestId = generateRequestId();
  const allParticipants = [rider, instructor, ...extraParticipants];

  // Dynamic weights: 100 total, divided among participants
  const weight = Math.floor(100 / allParticipants.length);
  const weights = allParticipants.map(() => weight);
  // Adjust last weight to ensure total is exactly 100
  weights[weights.length - 1] += 100 - weights.reduce((a, b) => a + b, 0);

  const definition: RPCAppDefinition = {
    application: SPINCHAIN_PROTOCOL,
    protocol: RPCProtocolVersion.NitroRPC_0_4,
    participants: allParticipants,
    weights,
    quorum: 100, // Still require unanimous for high-value rewards
    challenge: 60,
    nonce: Date.now(),
  };

  const allocations: RPCAppSessionAllocation[] = allParticipants.map((p, i) => ({
    participant: p,
    asset: "spin",
    amount: i === 0 ? "0" : "0", // Rider is at index 0
  }));

  const msg = await createAppSessionMessage(
    rpcSigner,
    {
      definition,
      allocations,
      session_data: JSON.stringify({ classId, type: "reward-channel" }),
    },
    requestId,
  );

  const response = await sendRpc(msg, requestId);
  const parsed = parseCreateAppSessionResponse(response);
  return {
    appSessionId: parsed.params.appSessionId,
    version: parsed.params.version,
  };
}

export async function submitState(
  appSessionId: Hex,
  rider: Address,
  accumulatedReward: bigint,
  version: number,
  sessionData: object,
  allParticipants: Address[],
): Promise<{ version: number }> {
  if (!ws || ws.readyState !== WebSocket.OPEN || !rpcSigner) {
    throw new Error("ClearNode not connected");
  }

  const requestId = generateRequestId();

  const allocations = allParticipants.map((p) => ({
    participant: p,
    asset: "spin",
    amount: p.toLowerCase() === rider.toLowerCase() ? accumulatedReward.toString() : "0",
  })) as RPCAppSessionAllocation[];

  const params = {
    app_session_id: appSessionId,
    intent: RPCAppStateIntent.Operate,
    version,
    allocations,
    session_data: JSON.stringify(sessionData),
  };

  const msg = await createSubmitAppStateMessage(
    rpcSigner,
    params,
    requestId,
  );
  const response = await sendRpc(msg, requestId);
  const parsed = parseSubmitAppStateResponse(response);
  return { version: parsed.params.version };
}

export async function closeSession(
  appSessionId: Hex,
  rider: Address,
  finalReward: bigint,
  allParticipants: Address[],
): Promise<void> {
  if (!ws || ws.readyState !== WebSocket.OPEN || !rpcSigner) {
    throw new Error("ClearNode not connected");
  }

  const requestId = generateRequestId();

  const allocations = allParticipants.map((p) => ({
    participant: p,
    asset: "spin",
    amount: p.toLowerCase() === rider.toLowerCase() ? finalReward.toString() : "0",
  })) as RPCAppSessionAllocation[];

  const msg = await createCloseAppSessionMessage(
    rpcSigner,
    {
      app_session_id: appSessionId,
      allocations,
    },
    requestId,
  );

  await sendRpc(msg, requestId);
}

// ============================================================================
// Cache
// ============================================================================

const sessionCache = new Map<string, { data: RPCAppSession[]; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds

export async function getSessions(
  participant: Address,
  status?: "open" | "closed",
): Promise<RPCAppSession[]> {
  const cacheKey = `${participant}:${status}`;
  const cached = sessionCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  await connectClearNode();

  const requestId = generateRequestId();
  const rpcStatus =
    status === "closed"
      ? RPCChannelStatus.Closed
      : status === "open"
        ? RPCChannelStatus.Open
        : undefined;

  const msg = createGetAppSessionsMessageV2(
    participant,
    rpcStatus,
    requestId,
  );
  
  try {
    const response = await sendRpc(msg, requestId);
    const parsed = parseGetAppSessionsResponse(response);
    const sessions = parsed.params.appSessions;
    
    sessionCache.set(cacheKey, { data: sessions, timestamp: Date.now() });
    return sessions;
  } catch (err) {
    // If request fails but we have stale cache, return it as fallback
    if (cached) return cached.data;
    throw err;
  }
}

export function isClearNodeConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}

export function disconnectClearNode(): void {
  ws?.close();
  ws = null;
  rpcSigner = null;
}
