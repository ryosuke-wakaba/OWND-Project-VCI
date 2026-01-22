/**
 * Integration tests for Client Authentication module
 */

import { assert } from "chai";
import * as jose from "jose";
import {
  validateClientAuthentication,
  extractClientAttestationHeaders,
  hasClientAttestationHeaders,
} from "../../../src/oid4vci/clientAuthentication/index.js";
import {
  generateTestKeyPair,
  generatePopKeyPair,
  createTestAttestationJwt,
  createTestAttestationPopJwt,
  TestKeyPair,
} from "./testUtils.js";

describe("Client Authentication Integration", () => {
  const issuerAudience = "https://issuer.example.com";

  let attestationKeyPair: TestKeyPair;
  let popKeyPair: { privateKey: jose.KeyLike; publicJwk: jose.JWK };

  before(async () => {
    attestationKeyPair = await generateTestKeyPair();
    popKeyPair = await generatePopKeyPair();
  });

  describe("extractClientAttestationHeaders", () => {
    it("should extract attestation headers from request", () => {
      const mockHeaders: Record<string, string> = {
        "oauth-client-attestation": "attestation-jwt",
        "oauth-client-attestation-pop": "pop-jwt",
      };

      const headers = extractClientAttestationHeaders(
        (name) => mockHeaders[name.toLowerCase()],
      );

      assert.equal(headers.attestation, "attestation-jwt");
      assert.equal(headers.attestationPoP, "pop-jwt");
    });

    it("should handle missing headers", () => {
      const headers = extractClientAttestationHeaders(() => undefined);

      assert.isUndefined(headers.attestation);
      assert.isUndefined(headers.attestationPoP);
    });

    it("should handle array headers (use first value)", () => {
      const mockHeaders: Record<string, string | string[]> = {
        "oauth-client-attestation": ["first", "second"],
        "oauth-client-attestation-pop": ["pop-first"],
      };

      const headers = extractClientAttestationHeaders(
        (name) => mockHeaders[name.toLowerCase()],
      );

      assert.equal(headers.attestation, "first");
      assert.equal(headers.attestationPoP, "pop-first");
    });
  });

  describe("hasClientAttestationHeaders", () => {
    it("should return true when both headers present", () => {
      const headers = {
        attestation: "jwt1",
        attestationPoP: "jwt2",
      };

      assert.isTrue(hasClientAttestationHeaders(headers));
    });

    it("should return false when attestation missing", () => {
      const headers = {
        attestationPoP: "jwt2",
      };

      assert.isFalse(hasClientAttestationHeaders(headers));
    });

    it("should return false when attestationPoP missing", () => {
      const headers = {
        attestation: "jwt1",
      };

      assert.isFalse(hasClientAttestationHeaders(headers));
    });
  });

  describe("validateClientAuthentication", () => {
    it("should validate complete client authentication", async () => {
      const clientId = "wallet-client-id";

      // Create attestation JWT with cnf pointing to PoP key
      const attestationJwt = await createTestAttestationJwt(
        attestationKeyPair,
        {
          iss: "https://wallet-provider.example.com",
          sub: clientId,
          cnfJwk: popKeyPair.publicJwk,
        },
      );

      // Create PoP JWT signed with the cnf key
      const popJwt = await createTestAttestationPopJwt(popKeyPair.privateKey, {
        iss: clientId, // Must match attestation.sub
        aud: issuerAudience,
      });

      const result = await validateClientAuthentication(
        {
          attestation: attestationJwt,
          attestationPoP: popJwt,
        },
        {
          issuerAudience,
        },
      );

      assert.isTrue(result.valid);
      if (result.valid) {
        assert.equal(result.clientId, clientId);
        assert.equal(
          result.walletProvider,
          "https://wallet-provider.example.com",
        );
        assert.exists(result.attestationHeader);
        assert.exists(result.attestationPayload);
        assert.exists(result.popHeader);
        assert.exists(result.popPayload);
      }
    });

    it("should reject when attestation header is missing", async () => {
      const result = await validateClientAuthentication(
        {
          attestationPoP: "some-jwt",
        },
        {
          issuerAudience,
        },
      );

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(
          result.errorDescription,
          "Missing client authentication headers",
        );
      }
    });

    it("should reject when PoP header is missing", async () => {
      const attestationJwt = await createTestAttestationJwt(
        attestationKeyPair,
        {
          cnfJwk: popKeyPair.publicJwk,
        },
      );

      const result = await validateClientAuthentication(
        {
          attestation: attestationJwt,
        },
        {
          issuerAudience,
        },
      );

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(
          result.errorDescription,
          "Missing client authentication headers",
        );
      }
    });

    it("should reject when PoP iss does not match attestation sub", async () => {
      const attestationJwt = await createTestAttestationJwt(
        attestationKeyPair,
        {
          sub: "correct-client-id",
          cnfJwk: popKeyPair.publicJwk,
        },
      );

      const popJwt = await createTestAttestationPopJwt(popKeyPair.privateKey, {
        iss: "wrong-client-id", // Does not match attestation.sub
        aud: issuerAudience,
      });

      const result = await validateClientAuthentication(
        {
          attestation: attestationJwt,
          attestationPoP: popJwt,
        },
        {
          issuerAudience,
        },
      );

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(result.errorDescription, "iss mismatch");
      }
    });

    it("should reject when PoP is signed with wrong key", async () => {
      const otherPopKeyPair = await generatePopKeyPair();

      const attestationJwt = await createTestAttestationJwt(
        attestationKeyPair,
        {
          sub: "wallet-client-id",
          cnfJwk: popKeyPair.publicJwk, // cnf points to original key
        },
      );

      // PoP signed with different key
      const popJwt = await createTestAttestationPopJwt(
        otherPopKeyPair.privateKey,
        {
          iss: "wallet-client-id",
          aud: issuerAudience,
        },
      );

      const result = await validateClientAuthentication(
        {
          attestation: attestationJwt,
          attestationPoP: popJwt,
        },
        {
          issuerAudience,
        },
      );

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(result.errorDescription, "signature");
      }
    });

    it("should validate with custom x5c validator", async () => {
      let x5cValidatorCalled = false;

      const attestationJwt = await createTestAttestationJwt(
        attestationKeyPair,
        {
          sub: "wallet-client-id",
          cnfJwk: popKeyPair.publicJwk,
        },
      );

      const popJwt = await createTestAttestationPopJwt(popKeyPair.privateKey, {
        iss: "wallet-client-id",
        aud: issuerAudience,
      });

      const result = await validateClientAuthentication(
        {
          attestation: attestationJwt,
          attestationPoP: popJwt,
        },
        {
          issuerAudience,
          x5cValidator: async (x5cChain) => {
            x5cValidatorCalled = true;
            assert.isArray(x5cChain);
            assert.isTrue(x5cChain.length > 0);
            return { valid: true };
          },
        },
      );

      assert.isTrue(x5cValidatorCalled);
      assert.isTrue(result.valid);
    });

    it("should reject with custom x5c validator failure", async () => {
      const attestationJwt = await createTestAttestationJwt(
        attestationKeyPair,
        {
          sub: "wallet-client-id",
          cnfJwk: popKeyPair.publicJwk,
        },
      );

      const popJwt = await createTestAttestationPopJwt(popKeyPair.privateKey, {
        iss: "wallet-client-id",
        aud: issuerAudience,
      });

      const result = await validateClientAuthentication(
        {
          attestation: attestationJwt,
          attestationPoP: popJwt,
        },
        {
          issuerAudience,
          x5cValidator: async () => ({
            valid: false,
            error: "Certificate not in trust store",
          }),
        },
      );

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.include(
          result.errorDescription,
          "Certificate not in trust store",
        );
      }
    });

    it("should validate with JTI validator", async () => {
      const usedJtis = new Set<string>();

      const attestationJwt = await createTestAttestationJwt(
        attestationKeyPair,
        {
          sub: "wallet-client-id",
          cnfJwk: popKeyPair.publicJwk,
        },
      );

      const popJwt = await createTestAttestationPopJwt(popKeyPair.privateKey, {
        iss: "wallet-client-id",
        aud: issuerAudience,
        jti: "unique-jti-123",
      });

      const jtiValidator = async (jti: string): Promise<boolean> => {
        if (usedJtis.has(jti)) {
          return false;
        }
        usedJtis.add(jti);
        return true;
      };

      // First request should succeed
      const result1 = await validateClientAuthentication(
        {
          attestation: attestationJwt,
          attestationPoP: popJwt,
        },
        {
          issuerAudience,
          jtiValidator,
        },
      );

      assert.isTrue(result1.valid);

      // Second request with same JTI should fail (replay)
      const result2 = await validateClientAuthentication(
        {
          attestation: attestationJwt,
          attestationPoP: popJwt, // Same PoP with same JTI
        },
        {
          issuerAudience,
          jtiValidator,
        },
      );

      assert.isFalse(result2.valid);
      if (!result2.valid) {
        assert.include(result2.errorDescription, "replay");
      }
    });
  });
});
