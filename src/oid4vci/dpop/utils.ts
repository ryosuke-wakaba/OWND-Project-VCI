/**
 * DPoP Utility Functions
 * RFC9449: https://www.rfc-editor.org/rfc/rfc9449.html
 * RFC7638: https://www.rfc-editor.org/rfc/rfc7638.html (JWK Thumbprint)
 */

import * as jose from "jose";
import { createHash } from "crypto";

/**
 * 許可されるデフォルトの非対称署名アルゴリズム
 * RFC9449 Section 4.3: MUST be an asymmetric digital signature algorithm
 */
export const DEFAULT_ALLOWED_ALGORITHMS = [
  // ECDSA
  "ES256",
  "ES384",
  "ES512",
  // RSASSA-PSS
  "PS256",
  "PS384",
  "PS512",
  // EdDSA
  "EdDSA",
];

/**
 * デフォルトのiat許容範囲（秒）
 */
export const DEFAULT_IAT_TOLERANCE_SECONDS = 300;

/**
 * JWK Thumbprint計算 (RFC7638)
 *
 * @param jwk - JSON Web Key
 * @returns Base64URL encoded SHA-256 thumbprint
 */
export async function calculateJwkThumbprint(jwk: jose.JWK): Promise<string> {
  return jose.calculateJwkThumbprint(jwk, "sha256");
}

/**
 * Access Token Hash計算
 * RFC9449 Section 4.2: SHA-256 hash of the ASCII encoding, base64url encoded
 *
 * @param accessToken - Access token string
 * @returns Base64URL encoded SHA-256 hash
 */
export function calculateAccessTokenHash(accessToken: string): string {
  const hash = createHash("sha256").update(accessToken, "ascii").digest();
  return jose.base64url.encode(hash);
}

/**
 * HTTP URI正規化
 * RFC9449 Section 4.3: Query and fragment parts are not covered by htu
 *
 * @param uri - Full HTTP URI
 * @returns Normalized URI (scheme + host + path only)
 */
export function normalizeHttpUri(uri: string): string {
  try {
    const url = new URL(uri);
    // Remove query string and fragment
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    // Return as-is if parsing fails
    return uri;
  }
}

/**
 * HTTP URIの比較
 * RFC9449 Section 4.3: Without query and fragment components
 *
 * @param uri1 - First URI
 * @param uri2 - Second URI
 * @returns true if URIs match
 */
export function compareHttpUri(uri1: string, uri2: string): boolean {
  return normalizeHttpUri(uri1) === normalizeHttpUri(uri2);
}

/**
 * JWKに秘密鍵が含まれているかチェック
 * RFC9449 Section 4.3: jwk MUST NOT contain a private key
 *
 * @param jwk - JSON Web Key
 * @returns true if private key is present
 */
export function hasPrivateKey(jwk: jose.JWK): boolean {
  // Check for private key parameters
  // EC: d
  // RSA: d, p, q, dp, dq, qi
  // OKP: d
  return "d" in jwk && jwk.d !== undefined;
}

/**
 * アルゴリズムが非対称署名アルゴリズムかチェック
 *
 * @param alg - Algorithm identifier
 * @param allowedAlgorithms - List of allowed algorithms
 * @returns true if algorithm is allowed
 */
export function isAllowedAlgorithm(
  alg: string,
  allowedAlgorithms: string[] = DEFAULT_ALLOWED_ALGORITHMS,
): boolean {
  // "none" is never allowed
  if (alg === "none") {
    return false;
  }
  return allowedAlgorithms.includes(alg);
}

/**
 * iatが許容範囲内かチェック
 *
 * @param iat - Issued at timestamp (seconds since epoch)
 * @param toleranceSeconds - Tolerance in seconds
 * @returns true if iat is within acceptable range
 */
export function isIatWithinTolerance(
  iat: number,
  toleranceSeconds: number = DEFAULT_IAT_TOLERANCE_SECONDS,
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - iat);
  return diff <= toleranceSeconds;
}
