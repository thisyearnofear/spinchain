import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "INVALID_FORMAT"
  | "MISSING_FIELD"
  | "VALIDATION_FAILED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_ERROR"
  | "NOT_CONFIGURED"
  | "NOT_IMPLEMENTED"
  | "INTERNAL_ERROR"
  | "FORBIDDEN"
  | "RATE_LIMITED";

const ERROR_LABELS: Record<ApiErrorCode, string> = {
  INVALID_FORMAT: "Invalid request",
  MISSING_FIELD: "Missing field",
  VALIDATION_FAILED: "Validation failed",
  PROVIDER_UNAVAILABLE: "Provider unavailable",
  PROVIDER_ERROR: "Provider error",
  NOT_CONFIGURED: "Not configured",
  NOT_IMPLEMENTED: "Not implemented",
  INTERNAL_ERROR: "Internal error",
  FORBIDDEN: "Forbidden",
  RATE_LIMITED: "Rate limited",
};

export interface ApiErrorBody {
  error: string;
  message: string;
  code: ApiErrorCode;
  details?: string;
}

export function apiError(
  message: string,
  code: ApiErrorCode,
  status: number,
  detail?: unknown,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      error: ERROR_LABELS[code],
      message,
      code,
      ...(process.env.NODE_ENV === "development" && detail !== undefined
        ? { details: String(detail) }
        : {}),
    },
    { status },
  );
}

export function apiOk<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}
