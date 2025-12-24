export interface OkResult<T> {
  ok: true;
  payload: T;
}

export interface NgResult<T> {
  ok: false;
  error: T;
}

export type Result<T, E> = OkResult<T> | NgResult<E>;

export interface ErrorPayload {
  error: string;
  error_description?: string;
  internalError?: boolean;
}

export interface ErrorResponse {
  status: number;
  payload: ErrorPayload;
  /** Additional HTTP headers to include in the response (e.g., DPoP-Nonce) */
  headers?: Record<string, string>;
}

export interface Message {
  message: string;
}
