/**
 * DPoP (Demonstrating Proof of Possession) Types
 * RFC9449: https://www.rfc-editor.org/rfc/rfc9449.html
 */

import { JWK } from "jose";

/**
 * DPoP Proof JWTのヘッダー
 * RFC9449 Section 4.2
 */
export interface DpopProofHeader {
  /** MUST be "dpop+jwt" */
  typ: "dpop+jwt";
  /** Asymmetric signature algorithm */
  alg: string;
  /** Public key (MUST NOT contain private key) */
  jwk: JWK;
}

/**
 * DPoP Proof JWTのペイロード
 * RFC9449 Section 4.2
 */
export interface DpopProofPayload {
  /** Unique identifier for the DPoP proof JWT */
  jti: string;
  /** HTTP method of the request */
  htm: string;
  /** HTTP URI of the request (without query and fragment) */
  htu: string;
  /** Issued at timestamp */
  iat: number;
  /** Access token hash (for protected resource requests) */
  ath?: string;
  /** Server-provided nonce */
  nonce?: string;
}

/**
 * DPoP Proof検証オプション
 */
export interface DpopValidationOptions {
  /** HTTP method of the current request (e.g., "POST") */
  httpMethod: string;
  /** HTTP URI of the current request */
  httpUri: string;
  /** Access token (required for protected resource requests) */
  accessToken?: string;
  /** Expected JWK thumbprint for token binding verification */
  expectedThumbprint?: string;
  /** Server-provided nonce that must match (static check) */
  serverNonce?: string;
  /**
   * Async function to validate nonce from proof (dynamic check)
   * If provided, nonce in proof will be validated using this function.
   * If nonce is missing in proof, returns use_dpop_nonce error.
   */
  nonceValidator?: (nonce: string) => Promise<boolean>;
  /**
   * Whether nonce is required in the proof.
   * Only used when nonceValidator is provided.
   * Default: true
   */
  nonceRequired?: boolean;
  /** Allowed signature algorithms (default: ES256, ES384, ES512, PS256, PS384, PS512) */
  allowedAlgorithms?: string[];
  /** Tolerance for iat claim in seconds (default: 300) */
  iatToleranceSeconds?: number;
}

/**
 * DPoP Proof検証成功結果
 */
export interface DpopValidationSuccess {
  valid: true;
  /** JWK Thumbprint (jkt) - RFC7638 */
  thumbprint: string;
  /** Decoded header */
  header: DpopProofHeader;
  /** Decoded payload */
  payload: DpopProofPayload;
}

/**
 * DPoP Proof検証失敗結果
 */
export interface DpopValidationFailure {
  valid: false;
  /** Error code */
  errorCode: DpopErrorCode;
  /** Error description */
  errorDescription: string;
}

/**
 * DPoP Proof検証結果
 */
export type DpopValidationResult =
  | DpopValidationSuccess
  | DpopValidationFailure;

/**
 * DPoPエラーコード
 * RFC9449 Section 5
 */
export type DpopErrorCode = "invalid_dpop_proof" | "use_dpop_nonce";

/**
 * DPoP対応のトークンタイプ
 */
export type TokenType = "Bearer" | "DPoP";

/**
 * DPoP JWK Thumbprint確認用のAccess Token情報
 */
export interface DpopBoundAccessToken {
  token: string;
  /** JWK Thumbprint (jkt) - bound to this token */
  dpopJkt: string;
}
