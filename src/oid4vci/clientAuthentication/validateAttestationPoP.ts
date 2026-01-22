/**
 * Validate Client Attestation PoP JWT
 * OAuth 2.0 Attestation-Based Client Authentication Section 5.2
 */

import * as jose from "jose";
import { JWK } from "jose";
import {
  ClientAttestationPopJwtHeader,
  ClientAttestationPopJwtPayload,
  ClientAuthValidationFailure,
  DEFAULT_ALLOWED_ALGORITHMS,
  DEFAULT_IAT_TOLERANCE_SECONDS,
} from "./types.js";

/**
 * Client Attestation PoP JWT validation success result
 */
export interface PopValidationSuccess {
  valid: true;
  header: ClientAttestationPopJwtHeader;
  payload: ClientAttestationPopJwtPayload;
}

/**
 * Client Attestation PoP JWT validation result
 */
export type PopValidationResult =
  | PopValidationSuccess
  | ClientAuthValidationFailure;

/**
 * Client Attestation PoP JWT validation options
 */
export interface PopValidationOptions {
  /** Public key from Client Attestation JWT cnf.jwk for signature verification */
  cnfJwk: JWK;
  /** Expected client_id (sub from Client Attestation JWT) */
  expectedClientId: string;
  /** Credential Issuer URL for audience validation */
  issuerAudience: string;
  /** Allowed signature algorithms */
  allowedAlgorithms?: string[];
  /** Tolerance for iat claim in seconds */
  iatToleranceSeconds?: number;
  /** Expected challenge value (optional) */
  expectedChallenge?: string;
  /** JTI validator for replay detection (returns true if jti is new/valid) */
  jtiValidator?: (jti: string) => Promise<boolean>;
}

/**
 * Log function for PoP validation
 */
function logPoP(message: string, data?: unknown): void {
  if (data !== undefined) {
    console.log(`[ClientAttestationPoP] ${message}:`, data);
  } else {
    console.log(`[ClientAttestationPoP] ${message}`);
  }
}

/**
 * Create validation failure result
 */
function fail(errorDescription: string): ClientAuthValidationFailure {
  logPoP("Validation failed", errorDescription);
  return {
    valid: false,
    errorCode: "invalid_client",
    errorDescription,
  };
}

/**
 * Check if iat is within acceptable tolerance
 */
function isIatWithinTolerance(iat: number, toleranceSeconds: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - iat) <= toleranceSeconds;
}

/**
 * Validate Client Attestation PoP JWT
 *
 * @param popJwt - The Client Attestation PoP JWT string
 * @param options - Validation options
 * @returns Validation result
 */
export async function validateClientAttestationPoP(
  popJwt: string,
  options: PopValidationOptions,
): Promise<PopValidationResult> {
  const {
    cnfJwk,
    expectedClientId,
    issuerAudience,
    allowedAlgorithms = DEFAULT_ALLOWED_ALGORITHMS,
    iatToleranceSeconds = DEFAULT_IAT_TOLERANCE_SECONDS,
    expectedChallenge,
    jtiValidator,
  } = options;

  logPoP("========== Client Attestation PoP JWT Validation Started ==========");
  logPoP("Expected client_id (iss)", expectedClientId);
  logPoP("Expected audience", issuerAudience);

  // ========================================
  // 1. Decode JWT header
  // ========================================
  logPoP("[1] Decoding JWT header");
  let header: jose.ProtectedHeaderParameters;
  try {
    header = jose.decodeProtectedHeader(popJwt);
  } catch {
    return fail("Invalid JWT format: cannot decode header");
  }
  logPoP("Header decoded", { typ: header.typ, alg: header.alg });

  // ========================================
  // 2. Check typ = oauth-client-attestation-pop+jwt
  // ========================================
  logPoP("[2] Checking typ claim");
  if (header.typ !== "oauth-client-attestation-pop+jwt") {
    return fail(
      `Invalid typ: expected "oauth-client-attestation-pop+jwt", got "${header.typ}"`,
    );
  }
  logPoP("typ is correct");

  // ========================================
  // 3. Check algorithm
  // ========================================
  logPoP("[3] Checking algorithm");
  if (!header.alg || !allowedAlgorithms.includes(header.alg)) {
    return fail(
      `Invalid or unsupported algorithm: "${
        header.alg
      }". Allowed: ${allowedAlgorithms.join(", ")}`,
    );
  }
  logPoP("Algorithm allowed", header.alg);

  // ========================================
  // 4. Import public key from cnf.jwk
  // ========================================
  logPoP("[4] Importing public key from cnf.jwk");
  let publicKey: jose.KeyLike | Uint8Array;
  try {
    publicKey = await jose.importJWK(cnfJwk, header.alg);
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return fail(`Failed to import public key from cnf.jwk: ${message}`);
  }
  logPoP("Public key imported");

  // ========================================
  // 5. Verify JWT signature with cnf.jwk
  // ========================================
  logPoP("[5] Verifying JWT signature with cnf.jwk");
  let payload: jose.JWTPayload;
  try {
    const verified = await jose.jwtVerify(popJwt, publicKey);
    payload = verified.payload;
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return fail(`JWT signature verification failed: ${message}`);
  }
  logPoP("JWT signature verified");

  // ========================================
  // 6. Validate required claims
  // ========================================
  logPoP("[6] Checking required claims");
  const { iss, aud, jti, iat } =
    payload as unknown as ClientAttestationPopJwtPayload;

  if (typeof iss !== "string" || iss === "") {
    return fail("Missing or invalid iss claim");
  }

  if (typeof aud !== "string" || aud === "") {
    return fail("Missing or invalid aud claim");
  }

  if (typeof jti !== "string" || jti === "") {
    return fail("Missing or invalid jti claim");
  }

  if (typeof iat !== "number") {
    return fail("Missing or invalid iat claim");
  }

  logPoP("Required claims present", { iss, aud, jti, iat });

  // ========================================
  // 7. Check iss matches client_id (sub from attestation)
  // ========================================
  logPoP("[7] Checking iss matches client_id");
  if (iss !== expectedClientId) {
    return fail(`iss mismatch: expected "${expectedClientId}", got "${iss}"`);
  }
  logPoP("iss matches client_id");

  // ========================================
  // 8. Check aud matches issuer audience
  // ========================================
  logPoP("[8] Checking aud matches issuer audience");
  if (aud !== issuerAudience) {
    return fail(`aud mismatch: expected "${issuerAudience}", got "${aud}"`);
  }
  logPoP("aud matches issuer audience");

  // ========================================
  // 9. Check iat within tolerance
  // ========================================
  logPoP("[9] Checking iat within tolerance");
  const now = Math.floor(Date.now() / 1000);
  logPoP("iat value", iat);
  logPoP("Current time", now);
  logPoP("Tolerance (seconds)", iatToleranceSeconds);
  if (!isIatWithinTolerance(iat, iatToleranceSeconds)) {
    return fail(
      `iat is outside acceptable range (tolerance: ${iatToleranceSeconds}s)`,
    );
  }
  logPoP("iat within tolerance");

  // ========================================
  // 10. Check nbf if present
  // ========================================
  const { nbf } = payload as unknown as ClientAttestationPopJwtPayload;
  if (nbf !== undefined) {
    logPoP("[10] Checking nbf claim");
    if (typeof nbf !== "number" || nbf > now) {
      return fail(`PoP JWT not yet valid (nbf: ${nbf}, now: ${now})`);
    }
    logPoP("nbf check passed");
  }

  // ========================================
  // 11. Check challenge if expected
  // ========================================
  const { challenge } = payload as unknown as ClientAttestationPopJwtPayload;
  if (expectedChallenge !== undefined) {
    logPoP("[11] Checking challenge");
    if (challenge !== expectedChallenge) {
      return fail(
        `challenge mismatch: expected "${expectedChallenge}", got "${challenge}"`,
      );
    }
    logPoP("challenge matches");
  }

  // ========================================
  // 12. Check jti for replay detection
  // ========================================
  if (jtiValidator) {
    logPoP("[12] Checking jti for replay detection");
    const isValidJti = await jtiValidator(jti);
    if (!isValidJti) {
      return fail("jti has already been used (replay attack detected)");
    }
    logPoP("jti is unique (not replayed)");
  } else {
    logPoP("[12] No jti validator configured, skipping replay detection");
  }

  // ========================================
  // Success
  // ========================================
  logPoP("========== Client Attestation PoP JWT Validation Success ==========");
  return {
    valid: true,
    header: header as unknown as ClientAttestationPopJwtHeader,
    payload: payload as unknown as ClientAttestationPopJwtPayload,
  };
}
