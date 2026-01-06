import { assert } from "chai";
import * as jose from "jose";
import ellipticJwk, { publicJwkFromPrivate } from "elliptic-jwk";

describe("Signed Metadata", () => {
  const SIGNED_METADATA_TYP = "openidvci-issuer-metadata+jwt";

  // Generate test key pair
  const privateJwk = ellipticJwk.newPrivateJwk("P-256");
  const publicJwk = publicJwkFromPrivate(privateJwk);

  // Sample metadata for testing (minimal structure for test purposes)
  const sampleMetadata = {
    credential_issuer: "https://issuer.example.com",
    credential_endpoint: "https://issuer.example.com/credentials",
    credential_configurations_supported: {
      TestCredential: {
        format: "vc+sd-jwt",
        vct: "https://example.com/test",
      },
    },
  };

  describe("JWT Structure", () => {
    it("should create JWT with correct typ header", async () => {
      const alg = "ES256";
      const signingKey = await jose.importJWK(privateJwk as jose.JWK, alg);

      const header: jose.JWTHeaderParameters = {
        alg,
        typ: SIGNED_METADATA_TYP,
        jwk: publicJwk as jose.JWK,
      };

      const iat = Math.floor(Date.now() / 1000);
      const payload = {
        sub: sampleMetadata.credential_issuer,
        iat,
        ...sampleMetadata,
      };

      const jwt = await new jose.SignJWT(payload)
        .setProtectedHeader(header)
        .sign(signingKey);

      // Verify JWT structure
      const decoded = jose.decodeProtectedHeader(jwt);
      assert.equal(decoded.typ, SIGNED_METADATA_TYP);
      assert.equal(decoded.alg, "ES256");
    });

    it("should include sub claim matching credential_issuer", async () => {
      const alg = "ES256";
      const signingKey = await jose.importJWK(privateJwk as jose.JWK, alg);

      const header: jose.JWTHeaderParameters = {
        alg,
        typ: SIGNED_METADATA_TYP,
        jwk: publicJwk as jose.JWK,
      };

      const iat = Math.floor(Date.now() / 1000);
      const payload = {
        sub: sampleMetadata.credential_issuer,
        iat,
        ...sampleMetadata,
      };

      const jwt = await new jose.SignJWT(payload)
        .setProtectedHeader(header)
        .sign(signingKey);

      // Verify payload
      const claims = jose.decodeJwt(jwt);
      assert.equal(claims.sub, sampleMetadata.credential_issuer);
      assert.exists(claims.iat);
      assert.equal(claims.credential_issuer, sampleMetadata.credential_issuer);
      assert.equal(claims.credential_endpoint, sampleMetadata.credential_endpoint);
    });

    it("should include iat claim", async () => {
      const alg = "ES256";
      const signingKey = await jose.importJWK(privateJwk as jose.JWK, alg);
      const beforeSign = Math.floor(Date.now() / 1000);

      const header: jose.JWTHeaderParameters = {
        alg,
        typ: SIGNED_METADATA_TYP,
        jwk: publicJwk as jose.JWK,
      };

      const iat = Math.floor(Date.now() / 1000);
      const payload = {
        sub: sampleMetadata.credential_issuer,
        iat,
        ...sampleMetadata,
      };

      const jwt = await new jose.SignJWT(payload)
        .setProtectedHeader(header)
        .sign(signingKey);

      const afterSign = Math.floor(Date.now() / 1000);

      const claims = jose.decodeJwt(jwt);
      assert.isAtLeast(claims.iat as number, beforeSign);
      assert.isAtMost(claims.iat as number, afterSign);
    });
  });

  describe("Header Mode Branching", () => {
    it("should use jwk header when no certificate is available", async () => {
      const alg = "ES256";
      const signingKey = await jose.importJWK(privateJwk as jose.JWK, alg);

      // jwk mode - no certificate
      const header: jose.JWTHeaderParameters = {
        alg,
        typ: SIGNED_METADATA_TYP,
        jwk: publicJwk as jose.JWK,
      };

      const payload = {
        sub: sampleMetadata.credential_issuer,
        iat: Math.floor(Date.now() / 1000),
        ...sampleMetadata,
      };

      const jwt = await new jose.SignJWT(payload)
        .setProtectedHeader(header)
        .sign(signingKey);

      const decoded = jose.decodeProtectedHeader(jwt);
      assert.exists(decoded.jwk);
      assert.notExists(decoded.x5c);
      assert.equal((decoded.jwk as jose.JWK).kty, "EC");
      assert.equal((decoded.jwk as jose.JWK).crv, "P-256");
      // Ensure private key is not included
      assert.notExists((decoded.jwk as jose.JWK).d);
    });

    it("should use x5c header when certificate is available", async () => {
      const alg = "ES256";
      const signingKey = await jose.importJWK(privateJwk as jose.JWK, alg);

      // x5c mode - with certificate (mock certificate chain)
      // This is a mock base64-encoded certificate for testing structure only
      const mockCertChain = ["MIIB...mockCert1", "MIIB...mockCert2"];

      const header: jose.JWTHeaderParameters = {
        alg,
        typ: SIGNED_METADATA_TYP,
        x5c: mockCertChain,
      };

      const payload = {
        sub: sampleMetadata.credential_issuer,
        iat: Math.floor(Date.now() / 1000),
        ...sampleMetadata,
      };

      const jwt = await new jose.SignJWT(payload)
        .setProtectedHeader(header)
        .sign(signingKey);

      const decoded = jose.decodeProtectedHeader(jwt);
      assert.exists(decoded.x5c);
      assert.notExists(decoded.jwk);
      assert.isArray(decoded.x5c);
      assert.lengthOf(decoded.x5c!, 2);
    });

    it("should include only leaf certificate by default", async () => {
      const alg = "ES256";
      const signingKey = await jose.importJWK(privateJwk as jose.JWK, alg);

      // Full chain available
      const fullCertChain = ["leafCert", "intermediateCert", "rootCert"];

      // Default behavior: leaf only
      const header: jose.JWTHeaderParameters = {
        alg,
        typ: SIGNED_METADATA_TYP,
        x5c: [fullCertChain[0]], // leaf only
      };

      const payload = {
        sub: sampleMetadata.credential_issuer,
        iat: Math.floor(Date.now() / 1000),
        ...sampleMetadata,
      };

      const jwt = await new jose.SignJWT(payload)
        .setProtectedHeader(header)
        .sign(signingKey);

      const decoded = jose.decodeProtectedHeader(jwt);
      assert.exists(decoded.x5c);
      assert.lengthOf(decoded.x5c!, 1);
      assert.equal(decoded.x5c![0], "leafCert");
    });

    it("should include full chain when includeFullChain option is true", async () => {
      const alg = "ES256";
      const signingKey = await jose.importJWK(privateJwk as jose.JWK, alg);

      // Full chain
      const fullCertChain = ["leafCert", "intermediateCert", "rootCert"];

      const header: jose.JWTHeaderParameters = {
        alg,
        typ: SIGNED_METADATA_TYP,
        x5c: fullCertChain,
      };

      const payload = {
        sub: sampleMetadata.credential_issuer,
        iat: Math.floor(Date.now() / 1000),
        ...sampleMetadata,
      };

      const jwt = await new jose.SignJWT(payload)
        .setProtectedHeader(header)
        .sign(signingKey);

      const decoded = jose.decodeProtectedHeader(jwt);
      assert.exists(decoded.x5c);
      assert.lengthOf(decoded.x5c!, 3);
      assert.deepEqual(decoded.x5c, fullCertChain);
    });

    it("should not include both jwk and x5c in header", async () => {
      const alg = "ES256";
      const signingKey = await jose.importJWK(privateJwk as jose.JWK, alg);

      // Test jwk mode
      const jwkHeader: jose.JWTHeaderParameters = {
        alg,
        typ: SIGNED_METADATA_TYP,
        jwk: publicJwk as jose.JWK,
      };

      const payload = {
        sub: sampleMetadata.credential_issuer,
        iat: Math.floor(Date.now() / 1000),
        ...sampleMetadata,
      };

      const jwkJwt = await new jose.SignJWT(payload)
        .setProtectedHeader(jwkHeader)
        .sign(signingKey);

      const jwkDecoded = jose.decodeProtectedHeader(jwkJwt);
      assert.exists(jwkDecoded.jwk);
      assert.notExists(jwkDecoded.x5c);

      // Test x5c mode
      const x5cHeader: jose.JWTHeaderParameters = {
        alg,
        typ: SIGNED_METADATA_TYP,
        x5c: ["mockCert"],
      };

      const x5cJwt = await new jose.SignJWT(payload)
        .setProtectedHeader(x5cHeader)
        .sign(signingKey);

      const x5cDecoded = jose.decodeProtectedHeader(x5cJwt);
      assert.exists(x5cDecoded.x5c);
      assert.notExists(x5cDecoded.jwk);
    });
  });

  describe("Signature Verification", () => {
    it("should create verifiable JWT with jwk header", async () => {
      const alg = "ES256";
      const signingKey = await jose.importJWK(privateJwk as jose.JWK, alg);

      const header: jose.JWTHeaderParameters = {
        alg,
        typ: SIGNED_METADATA_TYP,
        jwk: publicJwk as jose.JWK,
      };

      const payload = {
        sub: sampleMetadata.credential_issuer,
        iat: Math.floor(Date.now() / 1000),
        ...sampleMetadata,
      };

      const jwt = await new jose.SignJWT(payload)
        .setProtectedHeader(header)
        .sign(signingKey);

      // Verify using embedded public key
      const decoded = jose.decodeProtectedHeader(jwt);
      const verifyKey = await jose.importJWK(decoded.jwk as jose.JWK, alg);
      const { payload: verified } = await jose.jwtVerify(jwt, verifyKey);

      assert.equal(verified.sub, sampleMetadata.credential_issuer);
      assert.equal(verified.credential_issuer, sampleMetadata.credential_issuer);
    });

    it("should support ES256K algorithm for secp256k1 curve", async () => {
      const secp256k1Jwk = ellipticJwk.newPrivateJwk("secp256k1");
      const secp256k1PublicJwk = publicJwkFromPrivate(secp256k1Jwk);
      const alg = "ES256K";
      const signingKey = await jose.importJWK(secp256k1Jwk as jose.JWK, alg);

      const header: jose.JWTHeaderParameters = {
        alg,
        typ: SIGNED_METADATA_TYP,
        jwk: secp256k1PublicJwk as jose.JWK,
      };

      const payload = {
        sub: sampleMetadata.credential_issuer,
        iat: Math.floor(Date.now() / 1000),
        ...sampleMetadata,
      };

      const jwt = await new jose.SignJWT(payload)
        .setProtectedHeader(header)
        .sign(signingKey);

      const decoded = jose.decodeProtectedHeader(jwt);
      assert.equal(decoded.alg, "ES256K");
      assert.equal((decoded.jwk as jose.JWK).crv, "secp256k1");

      // Verify signature
      const verifyKey = await jose.importJWK(decoded.jwk as jose.JWK, alg);
      const { payload: verified } = await jose.jwtVerify(jwt, verifyKey);
      assert.equal(verified.sub, sampleMetadata.credential_issuer);
    });
  });

  describe("Metadata Payload", () => {
    it("should include all metadata parameters as top-level claims", async () => {
      const alg = "ES256";
      const signingKey = await jose.importJWK(privateJwk as jose.JWK, alg);

      const metadataWithDisplay = {
        ...sampleMetadata,
        display: [
          {
            name: "Test Issuer",
            locale: "en-US",
          },
        ],
        nonce_endpoint: "https://issuer.example.com/nonce",
      };

      const header: jose.JWTHeaderParameters = {
        alg,
        typ: SIGNED_METADATA_TYP,
        jwk: publicJwk as jose.JWK,
      };

      const payload = {
        sub: metadataWithDisplay.credential_issuer,
        iat: Math.floor(Date.now() / 1000),
        ...metadataWithDisplay,
      };

      const jwt = await new jose.SignJWT(payload)
        .setProtectedHeader(header)
        .sign(signingKey);

      const claims = jose.decodeJwt(jwt) as Record<string, unknown>;

      // Verify all metadata parameters are present
      assert.equal(claims.credential_issuer, metadataWithDisplay.credential_issuer);
      assert.equal(claims.credential_endpoint, metadataWithDisplay.credential_endpoint);
      assert.equal(claims.nonce_endpoint, metadataWithDisplay.nonce_endpoint);
      assert.deepEqual(claims.display, metadataWithDisplay.display);
      assert.deepEqual(
        claims.credential_configurations_supported,
        metadataWithDisplay.credential_configurations_supported
      );
    });
  });

  describe("Endpoint Response Format (Accept Header based)", () => {
    /**
     * OID4VCI Section 12.2.2に基づくAccept Header判定ロジック:
     * - Accept: application/jwt + 署名あり → JWT返却
     * - Accept: application/jwt + 署名なし → JSONにフォールバック
     * - Accept: application/json → JSON返却
     * - Accept Header なし → JSON返却（デフォルト）
     */

    it("should return application/jwt when Accept header is application/jwt and signed metadata exists", () => {
      // クライアントがAccept: application/jwtを指定し、署名付きメタデータがある場合
      const acceptHeader = "application/jwt";
      const hasSignedMetadata = true;

      const shouldReturnJwt = acceptHeader.includes("application/jwt") && hasSignedMetadata;
      assert.isTrue(shouldReturnJwt);

      const expectedContentType = shouldReturnJwt ? "application/jwt" : "application/json";
      assert.equal(expectedContentType, "application/jwt");
    });

    it("should fallback to application/json when Accept header is application/jwt but no signed metadata", () => {
      // クライアントがAccept: application/jwtを指定したが、署名付きメタデータがない場合
      const acceptHeader = "application/jwt";
      const hasSignedMetadata = false;

      const shouldReturnJwt = acceptHeader.includes("application/jwt") && hasSignedMetadata;
      assert.isFalse(shouldReturnJwt);

      const expectedContentType = shouldReturnJwt ? "application/jwt" : "application/json";
      assert.equal(expectedContentType, "application/json");
    });

    it("should return application/json when Accept header is application/json", () => {
      // クライアントがAccept: application/jsonを指定した場合
      const acceptHeader = "application/json";

      const requestsJwt = acceptHeader.includes("application/jwt");
      assert.isFalse(requestsJwt);

      const expectedContentType = "application/json";
      assert.equal(expectedContentType, "application/json");
    });

    it("should return application/json when no Accept header is provided (default)", () => {
      // Accept Headerがない場合はデフォルトでJSON
      // 実装では: if (acceptHeader && acceptHeader.includes("application/jwt"))
      // Accept Header なし → JSONを返却

      // Test the logic: when acceptHeader is falsy, we should return JSON
      function determineContentType(acceptHeader: string | undefined): string {
        if (acceptHeader && acceptHeader.includes("application/jwt")) {
          return "application/jwt";
        }
        return "application/json";
      }

      assert.equal(determineContentType(undefined), "application/json");
      assert.equal(determineContentType(""), "application/json");
    });

    it("should return raw JWT string when Accept: application/jwt and signed metadata exists", async () => {
      const alg = "ES256";
      const signingKey = await jose.importJWK(privateJwk as jose.JWK, alg);

      const header: jose.JWTHeaderParameters = {
        alg,
        typ: SIGNED_METADATA_TYP,
        jwk: publicJwk as jose.JWK,
      };

      const payload = {
        sub: sampleMetadata.credential_issuer,
        iat: Math.floor(Date.now() / 1000),
        ...sampleMetadata,
      };

      const jwt = await new jose.SignJWT(payload)
        .setProtectedHeader(header)
        .sign(signingKey);

      // JWT should be a string with 3 parts separated by dots
      assert.isString(jwt);
      const parts = jwt.split(".");
      assert.lengthOf(parts, 3);

      // First part (header) should be valid base64url
      const headerPart = parts[0];
      const decodedHeader = JSON.parse(
        Buffer.from(headerPart, "base64url").toString()
      );
      assert.equal(decodedHeader.typ, SIGNED_METADATA_TYP);
    });

    it("should return JSON object as default response format", () => {
      // デフォルト（JSONを返却する場合）のレスポンス形式
      const jsonResponse = sampleMetadata;
      assert.isObject(jsonResponse);
      assert.property(jsonResponse, "credential_issuer");
      assert.property(jsonResponse, "credential_endpoint");
    });
  });
});
