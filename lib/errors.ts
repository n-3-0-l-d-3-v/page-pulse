export type AuditErrorCode =
  | "INVALID_URL"
  | "FETCH_FAILED"
  | "TIMEOUT"
  | "NOT_HTML"
  | "TOO_LARGE"
  | "NOT_FOUND"
  | "RATE_LIMITED";

const STATUS_BY_CODE: Record<AuditErrorCode, number> = {
  INVALID_URL: 400,
  FETCH_FAILED: 502,
  TIMEOUT: 504,
  NOT_HTML: 422,
  TOO_LARGE: 413,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
};

export class AuditError extends Error {
  code: AuditErrorCode;
  status: number;

  constructor(code: AuditErrorCode, message: string) {
    super(message);
    this.name = "AuditError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }

  toJSON() {
    return { error: { code: this.code, message: this.message } };
  }
}
