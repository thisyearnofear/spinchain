// Shared auth types + validators. Client-safe: no secrets, no server imports.

export interface SessionPayload {
  address: string;
  role: "rider" | "instructor";
  exp: number;
}

export const SESSION_ROLES = ["rider", "instructor"] as const;

export const EVM_ADDRESS_RE = /^0x[0-9a-f]{40}$/;
export const SUI_ADDRESS_RE = /^0x[0-9a-f]{64}$/;
export const SIGNATURE_HEX_RE = /^[0-9a-f]{64}$/;

export function isValidSessionAddress(address: unknown): address is string {
  return (
    typeof address === "string" &&
    (EVM_ADDRESS_RE.test(address) || SUI_ADDRESS_RE.test(address))
  );
}

export function isValidSessionRole(role: unknown): role is SessionPayload["role"] {
  return role === "rider" || role === "instructor";
}

export function isValidSessionExp(exp: unknown): exp is number {
  return (
    typeof exp === "number" &&
    Number.isSafeInteger(exp) &&
    exp > Math.floor(Date.now() / 1000)
  );
}
