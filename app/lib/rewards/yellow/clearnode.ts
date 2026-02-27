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
import { YELLOW_CLEARNODE_URL, SPINCHAIN_PROTOCOL } from "./index";

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

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);

    socket.onopen = () => {
      console.log("[ClearNode] Connected");
      const { privateKey } = getOrCreateSessionKey();
      rpcSigner = createECDSAMessageSigner(privateKey);
      ws = socket;
      resolve(socket);
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string);
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

    socket.onerror = () => {
      reject(new Error("ClearNode connection failed"));
    };

    socket.onclose = () => {
      console.log("[ClearNode] Disconnected");
      ws = null;
    };
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
): Promise<{ appSessionId: Hex; version: number }> {
  await connectClearNode();
  if (!rpcSigner) throw new Error("Signer not initialized");

  const requestId = generateRequestId();

  const definition: RPCAppDefinition = {
    application: SPINCHAIN_PROTOCOL,
    protocol: RPCProtocolVersion.NitroRPC_0_4,
    participants: [rider, instructor],
    weights: [50, 50],
    quorum: 100,
    challenge: 0,
    nonce: Date.now(),
  };

  const allocations: RPCAppSessionAllocation[] = [
    { participant: rider, asset: "spin", amount: "0" },
    { participant: instructor, asset: "spin", amount: "0" },
  ];

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
  instructor: Address,
  accumulatedReward: bigint,
  version: number,
  sessionData: object,
): Promise<{ version: number }> {
  if (!ws || ws.readyState !== WebSocket.OPEN || !rpcSigner) {
    throw new Error("ClearNode not connected");
  }

  const requestId = generateRequestId();

  const params = {
    app_session_id: appSessionId,
    intent: RPCAppStateIntent.Operate,
    version,
    allocations: [
      {
        participant: rider,
        asset: "spin",
        amount: accumulatedReward.toString(),
      },
      { participant: instructor, asset: "spin", amount: "0" },
    ] as RPCAppSessionAllocation[],
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
  instructor: Address,
  finalReward: bigint,
): Promise<void> {
  if (!ws || ws.readyState !== WebSocket.OPEN || !rpcSigner) {
    throw new Error("ClearNode not connected");
  }

  const requestId = generateRequestId();

  const msg = await createCloseAppSessionMessage(
    rpcSigner,
    {
      app_session_id: appSessionId,
      allocations: [
        {
          participant: rider,
          asset: "spin",
          amount: finalReward.toString(),
        },
        { participant: instructor, asset: "spin", amount: "0" },
      ],
    },
    requestId,
  );

  await sendRpc(msg, requestId);
}

export async function getSessions(
  participant: Address,
  status?: "open" | "closed",
): Promise<RPCAppSession[]> {
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
  const response = await sendRpc(msg, requestId);
  const parsed = parseGetAppSessionsResponse(response);
  return parsed.params.appSessions;
}

export function isClearNodeConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}

export function disconnectClearNode(): void {
  ws?.close();
  ws = null;
  rpcSigner = null;
}
