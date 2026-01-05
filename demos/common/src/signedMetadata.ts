import * as jose from "jose";
import { PrivateJwk } from "elliptic-jwk";

import keyStore from "./store/keyStore.js";
import authStore from "./store/authStore.js";
import { ErrorPayload, Result } from "ownd-vci/dist/types.js";
import { IssuerMetadata } from "ownd-vci/dist/oid4vci/types/protocol.types.js";

const SIGNED_METADATA_TYP = "openidvci-issuer-metadata+jwt";

export interface SignMetadataResult {
  jwt: string;
  payload: object;
}

export interface SignMetadataOptions {
  /** Include full certificate chain in x5c header. Default: false (leaf only) */
  includeFullChain?: boolean;
}

/**
 * Sign issuer metadata according to OID4VCI Section 12.2.3
 *
 * @param metadata - The issuer metadata to sign
 * @param kid - The key identifier to use for signing
 * @param options - Signing options
 * @returns The signed metadata JWT and payload
 */
export const signMetadata = async (
  metadata: IssuerMetadata,
  kid: string,
  options: SignMetadataOptions = {},
): Promise<Result<SignMetadataResult, ErrorPayload>> => {
  const { includeFullChain = false } = options;
  // 1. Get key pair
  const keyPair = await keyStore.getEcKeyPair(kid);
  if (!keyPair) {
    return { ok: false, error: { error: "Key not found" } };
  }

  // Check if key is revoked
  if (keyPair.revokedAt) {
    return { ok: false, error: { error: "Signing key is revoked" } };
  }

  // 2. Get certificate chain if available
  const certChain: string[] = await keyStore.getX509Chain(kid);
  const hasCertificate = certChain && certChain.length > 0;

  // 3. Build private key for signing
  const privateJwk: PrivateJwk = {
    kty: keyPair.kty,
    crv: keyPair.crv,
    x: keyPair.x,
    y: keyPair.y,
    d: keyPair.d,
  };

  // Determine algorithm based on curve
  const alg = keyPair.crv === "secp256k1" ? "ES256K" : "ES256";

  // 4. Import private key for signing
  const signingKey = await jose.importJWK(privateJwk as jose.JWK, alg);

  // 5. Build JOSE header
  const header: jose.JWTHeaderParameters = {
    alg,
    typ: SIGNED_METADATA_TYP,
  };

  if (hasCertificate) {
    // x5c mode: include certificate (leaf only or full chain)
    header.x5c = includeFullChain ? certChain : [certChain[0]];
  } else {
    // jwk mode: include public key
    const publicJwk: jose.JWK = {
      kty: privateJwk.kty,
      crv: privateJwk.crv,
      x: privateJwk.x,
      y: privateJwk.y,
    };
    header.jwk = publicJwk;
  }

  // 6. Build JWS payload
  // sub: REQUIRED. String matching the Credential Issuer Identifier
  // iat: REQUIRED. Integer for the time at which the metadata was issued
  // iss: OPTIONAL. String denoting the party attesting to the claims
  // exp: OPTIONAL. Integer for the time at which the metadata is expiring
  // All metadata parameters as top-level claims
  const iat = Math.floor(Date.now() / 1000);
  const payload = {
    sub: metadata.credential_issuer,
    iat,
    ...metadata,
  };

  // 7. Sign and create JWT
  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader(header)
    .sign(signingKey);

  // 8. Revoke all previous signed metadata
  await authStore.revokeAllSignedMetadata();

  // 9. Save to database
  await authStore.addSignedMetadata(jwt, kid);

  console.log("Signed metadata created:");
  console.log("  - Key ID:", kid);
  console.log(
    "  - Mode:",
    hasCertificate
      ? `x5c (${includeFullChain ? "full chain" : "leaf only"})`
      : "jwk (public key)",
  );
  console.log("  - Algorithm:", alg);

  return {
    ok: true,
    payload: {
      jwt,
      payload,
    },
  };
};

export default {
  signMetadata,
};
