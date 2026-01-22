/**
 * Test utilities for Client Authentication tests
 * Provides helper functions to create test certificates and JWTs
 */

import * as jose from "jose";
import jsrsasign from "jsrsasign";

/**
 * Test key pair with certificate for x5c testing
 */
export interface TestKeyPair {
  privateKeyPem: string;
  publicKeyPem: string;
  x5c: string[]; // Base64 DER-encoded certificate chain
  publicJwk: jose.JWK;
  privateKey: jose.KeyLike;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KeyPair = any;

/**
 * Generate a self-signed test certificate and key pair using jsrsasign
 */
export async function generateTestKeyPair(): Promise<TestKeyPair> {
  // Generate EC key pair (P-256)
  const keypair: KeyPair = jsrsasign.KEYUTIL.generateKeypair("EC", "secp256r1");

  // Get PEM formats
  const privateKeyPem = jsrsasign.KEYUTIL.getPEM(keypair.prvKeyObj, "PKCS8PRV");
  const publicKeyPem = jsrsasign.KEYUTIL.getPEM(keypair.pubKeyObj);

  // Create self-signed certificate
  const certPem = createSelfSignedCertificate(keypair);

  // Extract DER-encoded certificate for x5c
  const x5c = [extractDerFromPem(certPem)];

  // Convert to jose KeyLike for signing
  const privateKey = await jose.importPKCS8(privateKeyPem, "ES256");

  // Export public key as JWK
  const publicKey = await jose.importSPKI(publicKeyPem, "ES256");
  const publicJwk = await jose.exportJWK(publicKey);
  publicJwk.alg = "ES256";

  return {
    privateKeyPem,
    publicKeyPem,
    x5c,
    publicJwk,
    privateKey,
  };
}

/**
 * Create a self-signed X.509 certificate using jsrsasign
 */
function createSelfSignedCertificate(keypair: KeyPair): string {
  const now = new Date();
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  // Format dates as YYMMDDHHMMSSZ
  const formatDate = (d: Date): string => {
    return d.toISOString().replace(/[-:T]/g, "").slice(2, 14) + "Z";
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cert = new (jsrsasign.KJUR.asn1.x509 as any).Certificate({
    version: 3,
    serial: { int: 1 },
    issuer: { str: "/CN=Test Wallet Provider" },
    notbefore: { str: formatDate(now) },
    notafter: { str: formatDate(oneYearFromNow) },
    subject: { str: "/CN=Test Wallet Provider" },
    sbjpubkey: keypair.pubKeyObj,
    sigalg: "SHA256withECDSA",
    cakey: keypair.prvKeyObj,
  });

  return cert.getPEM();
}

/**
 * Extract Base64-encoded DER from PEM certificate
 */
function extractDerFromPem(pem: string): string {
  return pem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s/g, "");
}

/**
 * Create a Client Attestation JWT for testing
 */
export async function createTestAttestationJwt(
  keyPair: TestKeyPair,
  options: {
    iss?: string;
    sub?: string;
    exp?: number;
    nbf?: number;
    cnfJwk?: jose.JWK;
    typ?: string;
    includeX5c?: boolean;
    alg?: string;
    walletName?: string;
    walletLink?: string;
  } = {},
): Promise<string> {
  const {
    iss = "https://wallet-provider.example.com",
    sub = "wallet-client-id",
    exp = Math.floor(Date.now() / 1000) + 3600,
    nbf,
    cnfJwk = keyPair.publicJwk,
    typ = "oauth-client-attestation+jwt",
    includeX5c = true,
    alg = "ES256",
    walletName,
    walletLink,
  } = options;

  const header: jose.JWTHeaderParameters = {
    alg,
    typ,
  };

  if (includeX5c) {
    header.x5c = keyPair.x5c;
  }

  const payload: Record<string, unknown> = {
    iss,
    sub,
    exp,
    cnf: { jwk: cnfJwk },
  };

  if (nbf !== undefined) {
    payload.nbf = nbf;
  }

  if (walletName) {
    payload.wallet_name = walletName;
  }

  if (walletLink) {
    payload.wallet_link = walletLink;
  }

  return await new jose.SignJWT(payload)
    .setProtectedHeader(header)
    .sign(keyPair.privateKey);
}

/**
 * Create a Client Attestation PoP JWT for testing
 */
export async function createTestAttestationPopJwt(
  signingKey: jose.KeyLike,
  options: {
    iss?: string;
    aud?: string;
    jti?: string;
    iat?: number;
    nbf?: number;
    challenge?: string;
    typ?: string;
    alg?: string;
  } = {},
): Promise<string> {
  const {
    iss = "wallet-client-id",
    aud = "https://issuer.example.com",
    jti = `test-jti-${Date.now()}`,
    iat = Math.floor(Date.now() / 1000),
    nbf,
    challenge,
    typ = "oauth-client-attestation-pop+jwt",
    alg = "ES256",
  } = options;

  const header: jose.JWTHeaderParameters = {
    alg,
    typ,
  };

  const payload: Record<string, unknown> = {
    iss,
    aud,
    jti,
    iat,
  };

  if (nbf !== undefined) {
    payload.nbf = nbf;
  }

  if (challenge !== undefined) {
    payload.challenge = challenge;
  }

  return await new jose.SignJWT(payload)
    .setProtectedHeader(header)
    .sign(signingKey);
}

/**
 * Generate a separate key pair for PoP JWT signing (cnf key)
 */
export async function generatePopKeyPair(): Promise<{
  privateKey: jose.KeyLike;
  publicJwk: jose.JWK;
}> {
  const { privateKey, publicKey } = await jose.generateKeyPair("ES256");
  const publicJwk = await jose.exportJWK(publicKey);
  publicJwk.alg = "ES256";

  return {
    privateKey,
    publicJwk,
  };
}
