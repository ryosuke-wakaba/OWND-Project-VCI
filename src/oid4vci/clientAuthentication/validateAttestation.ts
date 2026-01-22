/**
 * Validate Client Attestation JWT
 * OAuth 2.0 Attestation-Based Client Authentication Section 5.1
 * HAIP 4.4.1 - x5c header is required
 */

import * as jose from "jose";
import {
  ClientAttestationJwtHeader,
  ClientAttestationJwtPayload,
  ClientAuthValidationFailure,
  X5cChainValidator,
  DEFAULT_ALLOWED_ALGORITHMS,
} from "./types.js";

/**
 * Client Attestation JWT validation success result
 */
export interface AttestationValidationSuccess {
  valid: true;
  header: ClientAttestationJwtHeader;
  payload: ClientAttestationJwtPayload;
}

/**
 * Client Attestation JWT validation result
 */
export type AttestationValidationResult =
  | AttestationValidationSuccess
  | ClientAuthValidationFailure;

/**
 * Client Attestation JWT validation options
 */
export interface AttestationValidationOptions {
  /** Allowed signature algorithms */
  allowedAlgorithms?: string[];
  /** Custom x5c certificate chain validator */
  x5cValidator?: X5cChainValidator;
}

/**
 * Log function for client attestation validation
 */
function logAttestation(message: string, data?: unknown): void {
  if (data !== undefined) {
    console.log(`[ClientAttestation] ${message}:`, data);
  } else {
    console.log(`[ClientAttestation] ${message}`);
  }
}

/**
 * Create validation failure result
 */
function fail(errorDescription: string): ClientAuthValidationFailure {
  logAttestation("Validation failed", errorDescription);
  return {
    valid: false,
    errorCode: "invalid_client",
    errorDescription,
  };
}

/**
 * Validate Client Attestation JWT
 *
 * @param attestationJwt - The Client Attestation JWT string
 * @param options - Validation options
 * @returns Validation result
 */
export async function validateClientAttestationJwt(
  attestationJwt: string,
  options: AttestationValidationOptions = {},
): Promise<AttestationValidationResult> {
  const { allowedAlgorithms = DEFAULT_ALLOWED_ALGORITHMS, x5cValidator } =
    options;

  logAttestation(
    "========== Client Attestation JWT Validation Started ==========",
  );

  // ========================================
  // 1. Decode JWT header
  // ========================================
  logAttestation("[1] Decoding JWT header");
  let header: jose.ProtectedHeaderParameters;
  try {
    header = jose.decodeProtectedHeader(attestationJwt);
  } catch {
    return fail("Invalid JWT format: cannot decode header");
  }
  logAttestation("Header decoded", { typ: header.typ, alg: header.alg });

  // ========================================
  // 2. Check typ = oauth-client-attestation+jwt
  // ========================================
  logAttestation("[2] Checking typ claim");
  if (header.typ !== "oauth-client-attestation+jwt") {
    return fail(
      `Invalid typ: expected "oauth-client-attestation+jwt", got "${header.typ}"`,
    );
  }
  logAttestation("typ is correct");

  // ========================================
  // 3. Check algorithm
  // ========================================
  logAttestation("[3] Checking algorithm");
  if (!header.alg || !allowedAlgorithms.includes(header.alg)) {
    return fail(
      `Invalid or unsupported algorithm: "${
        header.alg
      }". Allowed: ${allowedAlgorithms.join(", ")}`,
    );
  }
  logAttestation("Algorithm allowed", header.alg);

  // ========================================
  // 4. Check x5c header (HAIP required)
  // ========================================
  logAttestation("[4] Checking x5c header");
  if (!header.x5c || !Array.isArray(header.x5c) || header.x5c.length === 0) {
    return fail(
      "Missing or invalid x5c header: HAIP requires x5c certificate chain",
    );
  }
  logAttestation("x5c chain present", { length: header.x5c.length });

  // ========================================
  // 5. Extract public key from x5c[0] (end-entity certificate)
  // ========================================
  logAttestation("[5] Extracting public key from x5c[0]");
  let publicKey: jose.KeyLike;
  try {
    // x5c contains Base64 DER-encoded certificates
    const certDer = Buffer.from(header.x5c[0], "base64");
    const certPem = `-----BEGIN CERTIFICATE-----\n${header.x5c[0]}\n-----END CERTIFICATE-----`;
    publicKey = await jose.importX509(certPem, header.alg);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return fail(`Failed to extract public key from x5c: ${message}`);
  }
  logAttestation("Public key extracted from certificate");

  // ========================================
  // 6. Validate x5c certificate chain (if validator provided)
  // ========================================
  if (x5cValidator) {
    logAttestation("[6] Validating x5c certificate chain");
    const chainResult = await x5cValidator(header.x5c);
    if (!chainResult.valid) {
      return fail(
        `x5c certificate chain validation failed: ${
          chainResult.error || "unknown error"
        }`,
      );
    }
    logAttestation("x5c chain validation passed");
  } else {
    logAttestation(
      "[6] No x5c validator configured, skipping chain validation",
    );
  }

  // ========================================
  // 7. Verify JWT signature
  // ========================================
  logAttestation("[7] Verifying JWT signature");
  let payload: jose.JWTPayload;
  try {
    const verified = await jose.jwtVerify(attestationJwt, publicKey);
    payload = verified.payload;
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return fail(`JWT signature verification failed: ${message}`);
  }
  logAttestation("JWT signature verified");

  // ========================================
  // 8. Validate required claims
  // ========================================
  logAttestation("[8] Checking required claims");
  const { iss, sub, exp, cnf } =
    payload as unknown as ClientAttestationJwtPayload;

  if (typeof iss !== "string" || iss === "") {
    return fail("Missing or invalid iss claim");
  }

  if (typeof sub !== "string" || sub === "") {
    return fail("Missing or invalid sub claim");
  }

  if (typeof exp !== "number") {
    return fail("Missing or invalid exp claim");
  }

  if (!cnf || typeof cnf !== "object" || !cnf.jwk) {
    return fail("Missing or invalid cnf claim with jwk");
  }

  logAttestation("Required claims present", { iss, sub, exp });

  // ========================================
  // 9. Check expiration
  // ========================================
  logAttestation("[9] Checking expiration");
  const now = Math.floor(Date.now() / 1000);
  if (exp <= now) {
    return fail(`Attestation JWT has expired (exp: ${exp}, now: ${now})`);
  }
  logAttestation("Attestation JWT not expired");

  // ========================================
  // 10. Check nbf if present
  // ========================================
  const { nbf } = payload as unknown as ClientAttestationJwtPayload;
  if (nbf !== undefined) {
    logAttestation("[10] Checking nbf claim");
    if (typeof nbf !== "number" || nbf > now) {
      return fail(`Attestation JWT not yet valid (nbf: ${nbf}, now: ${now})`);
    }
    logAttestation("nbf check passed");
  }

  // ========================================
  // Success
  // ========================================
  logAttestation(
    "========== Client Attestation JWT Validation Success ==========",
  );
  return {
    valid: true,
    header: header as unknown as ClientAttestationJwtHeader,
    payload: payload as unknown as ClientAttestationJwtPayload,
  };
}
