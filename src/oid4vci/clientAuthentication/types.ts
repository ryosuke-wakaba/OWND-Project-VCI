/**
 * Client Authentication Types
 * OAuth 2.0 Attestation-Based Client Authentication
 * https://drafts.oauth.net/draft-ietf-oauth-attestation-based-client-auth/draft-ietf-oauth-attestation-based-client-auth.html
 *
 * OID4VCI Appendix E - Wallet Attestations in JWT format
 * https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#appendix-E
 *
 * HAIP 4.4.1 - Wallet Attestation
 * https://openid.net/specs/openid4vc-high-assurance-interoperability-profile-1_0-05.html#name-wallet-attestation
 */

import { JWK } from "jose";

/**
 * Client Attestation JWT Header (Section 5.1)
 * HAIP requires x5c header for certificate chain
 */
export interface ClientAttestationJwtHeader {
  /** MUST be "oauth-client-attestation+jwt" */
  typ: "oauth-client-attestation+jwt";
  /** Signature algorithm */
  alg: string;
  /** Certificate chain (Base64 DER format) - HAIP required */
  x5c: string[];
  /** Key ID (optional) */
  kid?: string;
}

/**
 * Client Attestation JWT Payload (Section 5.1)
 */
export interface ClientAttestationJwtPayload {
  /** Issuer - Unique identifier for the Wallet Provider */
  iss: string;
  /** Subject - client_id value of the OAuth Client (Wallet) */
  sub: string;
  /** Expiration time */
  exp: number;
  /** Issued at (optional) */
  iat?: number;
  /** Not before (optional) */
  nbf?: number;
  /** Confirmation - Public key for PoP verification */
  cnf: {
    jwk: JWK;
  };
  /** Human-readable name of the Wallet (OID4VCI extension) */
  wallet_name?: string;
  /** URL for more information about the Wallet (OID4VCI extension) */
  wallet_link?: string;
}

/**
 * Client Attestation PoP JWT Header (Section 5.2)
 */
export interface ClientAttestationPopJwtHeader {
  /** MUST be "oauth-client-attestation-pop+jwt" */
  typ: "oauth-client-attestation-pop+jwt";
  /** Signature algorithm */
  alg: string;
}

/**
 * Client Attestation PoP JWT Payload (Section 5.2)
 */
export interface ClientAttestationPopJwtPayload {
  /** Issuer - MUST match sub from Client Attestation JWT */
  iss: string;
  /** Audience - Authorization Server issuer URL */
  aud: string;
  /** JWT ID - Unique identifier for replay detection */
  jti: string;
  /** Issued at */
  iat: number;
  /** Not before (optional) */
  nbf?: number;
  /** Challenge provided by authorization server (optional) */
  challenge?: string;
}

/**
 * Client Authentication Validation Options
 */
export interface ClientAuthValidationOptions {
  /** Credential Issuer URL for audience validation */
  issuerAudience: string;
  /** Allowed signature algorithms (default: ES256, ES384, ES512) */
  allowedAlgorithms?: string[];
  /** Tolerance for iat claim in seconds (default: 300) */
  iatToleranceSeconds?: number;
  /**
   * Custom x5c certificate chain validator
   * If provided, validates the certificate chain from x5c header
   * The first certificate (x5c[0]) is the end-entity certificate
   */
  x5cValidator?: X5cChainValidator;
  /**
   * Challenge value that must be present in PoP JWT
   * If provided, validates the challenge claim
   */
  expectedChallenge?: string;
  /**
   * JTI (JWT ID) validator for replay detection
   * Should return true if jti is new (not seen before)
   */
  jtiValidator?: (jti: string) => Promise<boolean>;
}

/**
 * x5c Certificate Chain Validator Function Type
 */
export type X5cChainValidator = (
  x5cChain: string[],
) => Promise<{ valid: boolean; error?: string }>;

/**
 * Client Authentication Validation Success
 */
export interface ClientAuthValidationSuccess {
  valid: true;
  /** Decoded Client Attestation header */
  attestationHeader: ClientAttestationJwtHeader;
  /** Decoded Client Attestation payload */
  attestationPayload: ClientAttestationJwtPayload;
  /** Decoded PoP header */
  popHeader: ClientAttestationPopJwtHeader;
  /** Decoded PoP payload */
  popPayload: ClientAttestationPopJwtPayload;
  /** Client ID (sub from attestation) */
  clientId: string;
  /** Wallet Provider issuer URL */
  walletProvider: string;
}

/**
 * Client Authentication Validation Failure
 */
export interface ClientAuthValidationFailure {
  valid: false;
  /** Error code (OAuth 2.0 error) */
  errorCode: ClientAuthErrorCode;
  /** Error description */
  errorDescription: string;
}

/**
 * Client Authentication Validation Result
 */
export type ClientAuthValidationResult =
  | ClientAuthValidationSuccess
  | ClientAuthValidationFailure;

/**
 * Client Authentication Error Codes
 */
export type ClientAuthErrorCode = "invalid_client";

/**
 * HTTP Header names for Client Attestation (Section 6.1)
 * Note: Header names are case-insensitive per RFC9110
 */
export const CLIENT_ATTESTATION_HEADER = "oauth-client-attestation";
export const CLIENT_ATTESTATION_POP_HEADER = "oauth-client-attestation-pop";

/**
 * Default allowed signature algorithms
 */
export const DEFAULT_ALLOWED_ALGORITHMS = ["ES256", "ES384", "ES512"];

/**
 * Default iat tolerance in seconds
 */
export const DEFAULT_IAT_TOLERANCE_SECONDS = 300;
