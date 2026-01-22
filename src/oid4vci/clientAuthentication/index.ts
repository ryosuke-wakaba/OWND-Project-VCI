/**
 * Client Authentication Module
 * OAuth 2.0 Attestation-Based Client Authentication
 *
 * This module provides validation for client authentication using
 * Wallet Attestation JWTs as defined in:
 * - OAuth 2.0 Attestation-Based Client Authentication
 * - OID4VCI Appendix E - Wallet Attestations in JWT format
 * - HAIP 4.4.1 - Wallet Attestation
 */

export * from "./types.js";
export * from "./extractHeaders.js";
export * from "./validateAttestation.js";
export * from "./validateAttestationPoP.js";

import {
  ClientAuthValidationResult,
  ClientAuthValidationOptions,
  ClientAuthValidationFailure,
  DEFAULT_ALLOWED_ALGORITHMS,
  DEFAULT_IAT_TOLERANCE_SECONDS,
} from "./types.js";
import {
  extractClientAttestationHeaders,
  hasClientAttestationHeaders,
  ClientAttestationHeaders,
} from "./extractHeaders.js";
import { validateClientAttestationJwt } from "./validateAttestation.js";
import { validateClientAttestationPoP } from "./validateAttestationPoP.js";

/**
 * Log function for client authentication
 */
function logClientAuth(message: string, data?: unknown): void {
  if (data !== undefined) {
    console.log(`[ClientAuth] ${message}:`, data);
  } else {
    console.log(`[ClientAuth] ${message}`);
  }
}

/**
 * Create validation failure result
 */
function fail(errorDescription: string): ClientAuthValidationFailure {
  logClientAuth("Validation failed", errorDescription);
  return {
    valid: false,
    errorCode: "invalid_client",
    errorDescription,
  };
}

/**
 * Validate client authentication using Wallet Attestation
 *
 * This function validates both the Client Attestation JWT and
 * the Client Attestation PoP JWT according to the specifications.
 *
 * @param headers - Extracted client attestation headers
 * @param options - Validation options
 * @returns Validation result
 */
export async function validateClientAuthentication(
  headers: ClientAttestationHeaders,
  options: ClientAuthValidationOptions,
): Promise<ClientAuthValidationResult> {
  const {
    issuerAudience,
    allowedAlgorithms = DEFAULT_ALLOWED_ALGORITHMS,
    iatToleranceSeconds = DEFAULT_IAT_TOLERANCE_SECONDS,
    x5cValidator,
    expectedChallenge,
    jtiValidator,
  } = options;

  logClientAuth(
    "========== Client Authentication Validation Started ==========",
  );
  logClientAuth("Issuer audience", issuerAudience);

  // ========================================
  // 1. Check both headers are present
  // ========================================
  logClientAuth("[1] Checking headers presence");
  if (!hasClientAttestationHeaders(headers)) {
    return fail(
      "Missing client authentication headers: both OAuth-Client-Attestation and OAuth-Client-Attestation-PoP are required",
    );
  }
  logClientAuth("Both headers present");

  const { attestation, attestationPoP } = headers;

  // ========================================
  // 2. Validate Client Attestation JWT
  // ========================================
  logClientAuth("[2] Validating Client Attestation JWT");
  const attestationResult = await validateClientAttestationJwt(attestation!, {
    allowedAlgorithms,
    x5cValidator,
  });

  if (!attestationResult.valid) {
    return attestationResult;
  }
  logClientAuth("Client Attestation JWT valid");

  // ========================================
  // 3. Validate Client Attestation PoP JWT
  // ========================================
  logClientAuth("[3] Validating Client Attestation PoP JWT");
  const popResult = await validateClientAttestationPoP(attestationPoP!, {
    cnfJwk: attestationResult.payload.cnf.jwk,
    expectedClientId: attestationResult.payload.sub,
    issuerAudience,
    allowedAlgorithms,
    iatToleranceSeconds,
    expectedChallenge,
    jtiValidator,
  });

  if (!popResult.valid) {
    return popResult;
  }
  logClientAuth("Client Attestation PoP JWT valid");

  // ========================================
  // Success
  // ========================================
  logClientAuth(
    "========== Client Authentication Validation Success ==========",
  );
  logClientAuth("Client ID", attestationResult.payload.sub);
  logClientAuth("Wallet Provider", attestationResult.payload.iss);

  return {
    valid: true,
    attestationHeader: attestationResult.header,
    attestationPayload: attestationResult.payload,
    popHeader: popResult.header,
    popPayload: popResult.payload,
    clientId: attestationResult.payload.sub,
    walletProvider: attestationResult.payload.iss,
  };
}

/**
 * Helper function to validate client authentication from HTTP request
 *
 * @param getHeader - Function to get header value by name
 * @param options - Validation options
 * @returns Validation result
 */
export async function validateClientAuthenticationFromRequest(
  getHeader: (name: string) => string | string[] | undefined,
  options: ClientAuthValidationOptions,
): Promise<ClientAuthValidationResult> {
  const headers = extractClientAttestationHeaders(getHeader);
  return validateClientAuthentication(headers, options);
}

/**
 * Check if client authentication headers are present in request
 *
 * @param getHeader - Function to get header value by name
 * @returns true if client authentication headers are present
 */
export function hasClientAuthenticationHeaders(
  getHeader: (name: string) => string | string[] | undefined,
): boolean {
  const headers = extractClientAttestationHeaders(getHeader);
  return hasClientAttestationHeaders(headers);
}
