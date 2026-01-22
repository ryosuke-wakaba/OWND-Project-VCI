/**
 * Extract Client Attestation HTTP Headers
 * OAuth 2.0 Attestation-Based Client Authentication Section 6.1
 */

import {
  CLIENT_ATTESTATION_HEADER,
  CLIENT_ATTESTATION_POP_HEADER,
} from "./types.js";

/**
 * Extracted client attestation headers
 */
export interface ClientAttestationHeaders {
  /** Client Attestation JWT */
  attestation?: string;
  /** Client Attestation PoP JWT */
  attestationPoP?: string;
}

/**
 * Extract Client Attestation headers from HTTP request
 * Header names are case-insensitive per RFC9110
 *
 * @param getHeader - Function to get header value by name (case-insensitive)
 * @returns Extracted headers (undefined if not present)
 */
export function extractClientAttestationHeaders(
  getHeader: (name: string) => string | string[] | undefined,
): ClientAttestationHeaders {
  const attestation = normalizeHeader(getHeader(CLIENT_ATTESTATION_HEADER));
  const attestationPoP = normalizeHeader(
    getHeader(CLIENT_ATTESTATION_POP_HEADER),
  );

  return {
    attestation,
    attestationPoP,
  };
}

/**
 * Normalize header value to single string
 * @param value - Header value (string, array, or undefined)
 * @returns Single string or undefined
 */
function normalizeHeader(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  if (Array.isArray(value)) {
    // Use first value if multiple headers provided
    return value.length > 0 && value[0] !== "" ? value[0] : undefined;
  }
  return value;
}

/**
 * Check if client attestation headers are present
 * @param headers - Extracted headers
 * @returns true if both attestation and PoP headers are present
 */
export function hasClientAttestationHeaders(
  headers: ClientAttestationHeaders,
): boolean {
  return (
    headers.attestation !== undefined && headers.attestationPoP !== undefined
  );
}
