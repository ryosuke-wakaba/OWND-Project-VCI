/**
 * DPoP Proof Validation
 * RFC9449 Section 4.3: Checking DPoP Proofs
 * https://www.rfc-editor.org/rfc/rfc9449.html#name-checking-dpop-proofs
 */

import * as jose from "jose";
import {
  DpopValidationOptions,
  DpopValidationResult,
  DpopValidationFailure,
  DpopProofHeader,
  DpopProofPayload,
} from "./types.js";
import {
  calculateJwkThumbprint,
  calculateAccessTokenHash,
  compareHttpUri,
  hasPrivateKey,
  isAllowedAlgorithm,
  isIatWithinTolerance,
  DEFAULT_ALLOWED_ALGORITHMS,
  DEFAULT_IAT_TOLERANCE_SECONDS,
} from "./utils.js";

/**
 * DPoP検証用ログ出力
 */
function logDpop(message: string, data?: unknown): void {
  if (data !== undefined) {
    console.log(`[DPoP] ${message}:`, data);
  } else {
    console.log(`[DPoP] ${message}`);
  }
}

/**
 * 検証失敗結果を生成
 */
function fail(errorDescription: string): DpopValidationFailure {
  logDpop("❌ Validation failed", errorDescription);
  return {
    valid: false,
    errorCode: "invalid_dpop_proof",
    errorDescription,
  };
}

/**
 * DPoP Proof検証
 *
 * RFC9449 Section 4.3に準拠した12項目の検証を実行
 *
 * @param dpopHeader - DPoP HTTP header value (single JWT)
 * @param options - Validation options
 * @returns Validation result
 */
export async function validateDpopProof(
  dpopHeader: string | string[] | undefined,
  options: DpopValidationOptions,
): Promise<DpopValidationResult> {
  const {
    httpMethod,
    httpUri,
    accessToken,
    expectedThumbprint,
    serverNonce,
    nonceValidator,
    nonceRequired = true,
    allowedAlgorithms = DEFAULT_ALLOWED_ALGORITHMS,
    iatToleranceSeconds = DEFAULT_IAT_TOLERANCE_SECONDS,
  } = options;

  logDpop("========== DPoP Proof Validation Started ==========");
  logDpop("Expected HTTP Method", httpMethod);
  logDpop("Expected HTTP URI", httpUri);
  logDpop("Access Token provided", accessToken ? "yes" : "no");
  logDpop("Expected Thumbprint", expectedThumbprint || "(none)");
  logDpop("Server Nonce", serverNonce || "(none)");
  logDpop("Nonce Validator", nonceValidator ? "configured" : "(none)");
  logDpop("Nonce Required", nonceRequired);

  // ========================================
  // 1. DPoPヘッダーが1つだけであること
  // ========================================
  logDpop("[1] Checking DPoP header presence");
  if (dpopHeader === undefined || dpopHeader === "") {
    return fail("Missing DPoP header");
  }

  if (Array.isArray(dpopHeader)) {
    if (dpopHeader.length !== 1) {
      return fail("Multiple DPoP headers are not allowed");
    }
    dpopHeader = dpopHeader[0];
  }
  logDpop("✓ DPoP header present");

  // ========================================
  // 2. 単一の適格なJWTであること
  // ========================================
  logDpop("[2] Decoding JWT header");
  let header: jose.ProtectedHeaderParameters;
  let payload: jose.JWTPayload;

  try {
    header = jose.decodeProtectedHeader(dpopHeader);
  } catch {
    return fail("Invalid JWT format: cannot decode header");
  }
  logDpop("✓ JWT header decoded", { typ: header.typ, alg: header.alg });

  // ========================================
  // 4. typ = dpop+jwt であること
  // ========================================
  logDpop("[4] Checking typ claim");
  if (header.typ !== "dpop+jwt") {
    return fail(`Invalid typ: expected "dpop+jwt", got "${header.typ}"`);
  }
  logDpop("✓ typ = dpop+jwt");

  // ========================================
  // 5. alg が許可された非対称署名アルゴリズムであること
  // ========================================
  logDpop("[5] Checking algorithm");
  if (!header.alg || !isAllowedAlgorithm(header.alg, allowedAlgorithms)) {
    return fail(
      `Invalid or unsupported algorithm: "${
        header.alg
      }". Allowed: ${allowedAlgorithms.join(", ")}`,
    );
  }
  logDpop("✓ Algorithm allowed", header.alg);

  // ========================================
  // 6 & 7. jwkヘッダーの検証
  // ========================================
  logDpop("[6/7] Checking JWK in header");
  if (!header.jwk) {
    return fail("Missing jwk in header");
  }

  // 7. jwkに秘密鍵が含まれていないこと
  if (hasPrivateKey(header.jwk as jose.JWK)) {
    return fail("jwk MUST NOT contain a private key");
  }
  logDpop("✓ JWK present and public key only");

  // ========================================
  // 6. JWT署名の検証
  // ========================================
  logDpop("[6] Verifying JWT signature");
  let publicKey: jose.KeyLike | Uint8Array;
  try {
    publicKey = await jose.importJWK(header.jwk as jose.JWK, header.alg);
  } catch {
    return fail("Failed to import public key from jwk");
  }

  try {
    const verified = await jose.jwtVerify(dpopHeader, publicKey);
    payload = verified.payload;
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    return fail(`JWT signature verification failed: ${message}`);
  }
  logDpop("✓ JWT signature verified");

  // ========================================
  // 3. 必須クレームが含まれていること
  // ========================================
  logDpop("[3] Checking required claims");
  const { jti, htm, htu, iat, ath, nonce } =
    payload as unknown as DpopProofPayload;

  if (typeof jti !== "string" || jti === "") {
    return fail("Missing or invalid jti claim");
  }

  if (typeof htm !== "string" || htm === "") {
    return fail("Missing or invalid htm claim");
  }

  if (typeof htu !== "string" || htu === "") {
    return fail("Missing or invalid htu claim");
  }

  if (typeof iat !== "number") {
    return fail("Missing or invalid iat claim");
  }
  logDpop("✓ Required claims present", {
    jti: jti.substring(0, 8) + "...",
    htm,
    htu,
    iat,
  });

  // ========================================
  // 8. htm = HTTPメソッド であること
  // ========================================
  logDpop("[8] Checking htm (HTTP method)");
  if (htm.toUpperCase() !== httpMethod.toUpperCase()) {
    return fail(
      `htm mismatch: expected "${httpMethod.toUpperCase()}", got "${htm.toUpperCase()}"`,
    );
  }
  logDpop("✓ htm matches", htm);

  // ========================================
  // 9. htu = HTTP URI であること（クエリ・フラグメント除外）
  // ========================================
  logDpop("[9] Checking htu (HTTP URI)");
  if (!compareHttpUri(htu, httpUri)) {
    return fail(`htu mismatch: expected "${httpUri}", got "${htu}"`);
  }
  logDpop("✓ htu matches", htu);

  // ========================================
  // 10. nonce一致（サーバー提供時）
  // ========================================
  logDpop("[10] Checking nonce");
  if (serverNonce !== undefined) {
    // Static nonce check (exact match)
    logDpop("Server nonce required (static)", serverNonce);
    logDpop("Proof nonce", nonce || "(none)");
    if (nonce !== serverNonce) {
      logDpop("❌ Nonce mismatch");
      return {
        valid: false,
        errorCode: "use_dpop_nonce",
        errorDescription: `nonce mismatch: expected "${serverNonce}", got "${nonce}"`,
      };
    }
    logDpop("✓ Nonce matches (static)");
  } else if (nonceValidator !== undefined) {
    // Dynamic nonce validation
    logDpop("Nonce validation required (dynamic)");
    logDpop("Proof nonce", nonce || "(none)");
    if (nonce === undefined || nonce === "") {
      if (nonceRequired) {
        logDpop("❌ Nonce required but not provided");
        return {
          valid: false,
          errorCode: "use_dpop_nonce",
          errorDescription: "nonce is required in DPoP proof",
        };
      } else {
        logDpop("✓ Nonce not provided but not required");
      }
    } else {
      // Validate the nonce using the provided validator
      const isValidNonce = await nonceValidator(nonce);
      if (!isValidNonce) {
        logDpop("❌ Nonce validation failed (invalid or expired)");
        return {
          valid: false,
          errorCode: "use_dpop_nonce",
          errorDescription: "nonce is invalid or expired",
        };
      }
      logDpop("✓ Nonce validated successfully");
    }
  } else {
    logDpop("✓ No server nonce required");
  }

  // ========================================
  // 11. iat許容範囲内であること
  // ========================================
  logDpop("[11] Checking iat (issued at)");
  const now = Math.floor(Date.now() / 1000);
  logDpop("iat value", iat);
  logDpop("Current time", now);
  logDpop("Difference (seconds)", now - iat);
  logDpop("Tolerance (seconds)", iatToleranceSeconds);
  if (!isIatWithinTolerance(iat, iatToleranceSeconds)) {
    return fail(
      `iat is outside acceptable range (tolerance: ${iatToleranceSeconds}s)`,
    );
  }
  logDpop("✓ iat within tolerance");

  // ========================================
  // JWK Thumbprint計算
  // ========================================
  logDpop("Calculating JWK Thumbprint");
  let thumbprint: string;
  try {
    thumbprint = await calculateJwkThumbprint(header.jwk as jose.JWK);
  } catch {
    return fail("Failed to calculate JWK thumbprint");
  }
  logDpop("✓ JWK Thumbprint (jkt)", thumbprint);

  // ========================================
  // 12. Access Token検証（保護リソース用）
  // ========================================
  if (accessToken !== undefined) {
    logDpop("[12] Checking access token binding (ath)");

    // 12a. athクレームの検証
    if (typeof ath !== "string" || ath === "") {
      return fail("Missing ath claim for protected resource request");
    }

    const expectedAth = calculateAccessTokenHash(accessToken);
    logDpop("ath in proof", ath);
    logDpop("Expected ath (hash of access token)", expectedAth);
    if (ath !== expectedAth) {
      return fail("ath claim does not match access token hash");
    }
    logDpop("✓ ath matches access token hash");

    // 12b. 公開鍵の一致確認（トークンバインディング）
    if (expectedThumbprint !== undefined) {
      logDpop("[12b] Checking thumbprint binding");
      logDpop("Proof thumbprint", thumbprint);
      logDpop("Expected thumbprint (from token)", expectedThumbprint);
      if (thumbprint !== expectedThumbprint) {
        return fail(
          "DPoP proof public key does not match the key bound to the access token",
        );
      }
      logDpop("✓ Thumbprint matches token binding");
    }
  } else {
    logDpop("[12] No access token provided (Token Endpoint mode)");
  }

  // ========================================
  // 検証成功
  // ========================================
  logDpop("========== ✅ DPoP Proof Validation Success ==========");
  logDpop("Thumbprint", thumbprint);
  return {
    valid: true,
    thumbprint,
    header: header as unknown as DpopProofHeader,
    payload: payload as unknown as DpopProofPayload,
  };
}

/**
 * DPoPヘッダーの存在チェック
 *
 * @param dpopHeader - DPoP HTTP header value
 * @returns true if DPoP header is present
 */
export function hasDpopHeader(
  dpopHeader: string | string[] | undefined,
): boolean {
  if (dpopHeader === undefined || dpopHeader === "") {
    return false;
  }
  if (Array.isArray(dpopHeader)) {
    return dpopHeader.length > 0 && dpopHeader[0] !== "";
  }
  return true;
}
