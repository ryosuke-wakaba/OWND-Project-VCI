/**
 * Tests for Client Attestation PoP JWT validation
 */

import { assert } from "chai";
import * as jose from "jose";
import { validateClientAttestationPoP } from "../../../src/oid4vci/clientAuthentication/validateAttestationPoP.js";
import {
  generatePopKeyPair,
  createTestAttestationPopJwt,
} from "./testUtils.js";

describe("validateClientAttestationPoP", () => {
  const issuerAudience = "https://issuer.example.com";
  const expectedClientId = "wallet-client-id";

  let popKeyPair: { privateKey: jose.KeyLike; publicJwk: jose.JWK };

  before(async () => {
    popKeyPair = await generatePopKeyPair();
  });

  describe("Valid PoP JWT", () => {
    it("should validate a properly formed PoP JWT", async () => {
      const jwt = await createTestAttestationPopJwt(popKeyPair.privateKey, {
        iss: expectedClientId,
        aud: issuerAudience,
      });

      const result = await validateClientAttestationPoP(jwt, {
        cnfJwk: popKeyPair.publicJwk,
        expectedClientId,
        issuerAudience,
      });

      assert.isTrue(result.valid);
      if (result.valid) {
        assert.equal(result.payload.iss, expectedClientId);
        assert.equal(result.payload.aud, issuerAudience);
        assert.exists(result.payload.jti);
        assert.exists(result.payload.iat);
      }
    });
  });

  describe("Invalid typ", () => {
    it("should reject JWT with wrong typ", async () => {
      const jwt = await createTestAttestationPopJwt(popKeyPair.privateKey, {
        iss: expectedClientId,
        aud: issuerAudience,
        typ: "jwt",
      });

      const result = await validateClientAttestationPoP(jwt, {
        cnfJwk: popKeyPair.publicJwk,
        expectedClientId,
        issuerAudience,
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(result.errorDescription, "Invalid typ");
      }
    });
  });

  describe("Invalid algorithm", () => {
    it("should reject JWT with unsupported algorithm in allowedAlgorithms", async () => {
      const jwt = await createTestAttestationPopJwt(popKeyPair.privateKey, {
        iss: expectedClientId,
        aud: issuerAudience,
        alg: "ES256", // Valid but not in allowed list
      });

      const result = await validateClientAttestationPoP(jwt, {
        cnfJwk: popKeyPair.publicJwk,
        expectedClientId,
        issuerAudience,
        allowedAlgorithms: ["ES384"], // Only allow ES384
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(result.errorDescription, "algorithm");
      }
    });
  });

  describe("Issuer (iss) validation", () => {
    it("should reject JWT with wrong iss", async () => {
      const jwt = await createTestAttestationPopJwt(popKeyPair.privateKey, {
        iss: "wrong-client-id",
        aud: issuerAudience,
      });

      const result = await validateClientAttestationPoP(jwt, {
        cnfJwk: popKeyPair.publicJwk,
        expectedClientId,
        issuerAudience,
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(result.errorDescription, "iss mismatch");
      }
    });
  });

  describe("Audience (aud) validation", () => {
    it("should reject JWT with wrong aud", async () => {
      const jwt = await createTestAttestationPopJwt(popKeyPair.privateKey, {
        iss: expectedClientId,
        aud: "https://wrong-issuer.example.com",
      });

      const result = await validateClientAttestationPoP(jwt, {
        cnfJwk: popKeyPair.publicJwk,
        expectedClientId,
        issuerAudience,
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(result.errorDescription, "aud mismatch");
      }
    });
  });

  describe("Issued At (iat) validation", () => {
    it("should reject JWT with iat too far in the past", async () => {
      const jwt = await createTestAttestationPopJwt(popKeyPair.privateKey, {
        iss: expectedClientId,
        aud: issuerAudience,
        iat: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      });

      const result = await validateClientAttestationPoP(jwt, {
        cnfJwk: popKeyPair.publicJwk,
        expectedClientId,
        issuerAudience,
        iatToleranceSeconds: 300, // 5 minutes
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(
          result.errorDescription,
          "iat is outside acceptable range",
        );
      }
    });

    it("should reject JWT with iat in the future", async () => {
      const jwt = await createTestAttestationPopJwt(popKeyPair.privateKey, {
        iss: expectedClientId,
        aud: issuerAudience,
        iat: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      });

      const result = await validateClientAttestationPoP(jwt, {
        cnfJwk: popKeyPair.publicJwk,
        expectedClientId,
        issuerAudience,
        iatToleranceSeconds: 300,
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(
          result.errorDescription,
          "iat is outside acceptable range",
        );
      }
    });

    it("should accept JWT with iat within tolerance", async () => {
      const jwt = await createTestAttestationPopJwt(popKeyPair.privateKey, {
        iss: expectedClientId,
        aud: issuerAudience,
        iat: Math.floor(Date.now() / 1000) - 60, // 1 minute ago
      });

      const result = await validateClientAttestationPoP(jwt, {
        cnfJwk: popKeyPair.publicJwk,
        expectedClientId,
        issuerAudience,
        iatToleranceSeconds: 300,
      });

      assert.isTrue(result.valid);
    });
  });

  describe("Not Before (nbf) validation", () => {
    it("should reject JWT that is not yet valid", async () => {
      const jwt = await createTestAttestationPopJwt(popKeyPair.privateKey, {
        iss: expectedClientId,
        aud: issuerAudience,
        nbf: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      });

      const result = await validateClientAttestationPoP(jwt, {
        cnfJwk: popKeyPair.publicJwk,
        expectedClientId,
        issuerAudience,
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        // jose library checks nbf during verification, so error comes from there
        assert.isTrue(
          result.errorDescription.includes("not yet valid") ||
            result.errorDescription.includes("nbf"),
        );
      }
    });
  });

  describe("Challenge validation", () => {
    it("should validate challenge when expected", async () => {
      const expectedChallenge = "test-challenge-12345";
      const jwt = await createTestAttestationPopJwt(popKeyPair.privateKey, {
        iss: expectedClientId,
        aud: issuerAudience,
        challenge: expectedChallenge,
      });

      const result = await validateClientAttestationPoP(jwt, {
        cnfJwk: popKeyPair.publicJwk,
        expectedClientId,
        issuerAudience,
        expectedChallenge,
      });

      assert.isTrue(result.valid);
    });

    it("should reject JWT with wrong challenge", async () => {
      const jwt = await createTestAttestationPopJwt(popKeyPair.privateKey, {
        iss: expectedClientId,
        aud: issuerAudience,
        challenge: "wrong-challenge",
      });

      const result = await validateClientAttestationPoP(jwt, {
        cnfJwk: popKeyPair.publicJwk,
        expectedClientId,
        issuerAudience,
        expectedChallenge: "expected-challenge",
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(result.errorDescription, "challenge mismatch");
      }
    });
  });

  describe("JTI replay detection", () => {
    it("should call jti validator", async () => {
      let validatorCalled = false;
      let receivedJti = "";

      const jwt = await createTestAttestationPopJwt(popKeyPair.privateKey, {
        iss: expectedClientId,
        aud: issuerAudience,
        jti: "unique-jti-12345",
      });

      const result = await validateClientAttestationPoP(jwt, {
        cnfJwk: popKeyPair.publicJwk,
        expectedClientId,
        issuerAudience,
        jtiValidator: async (jti) => {
          validatorCalled = true;
          receivedJti = jti;
          return true;
        },
      });

      assert.isTrue(validatorCalled);
      assert.equal(receivedJti, "unique-jti-12345");
      assert.isTrue(result.valid);
    });

    it("should reject if jti validator returns false (replay)", async () => {
      const jwt = await createTestAttestationPopJwt(popKeyPair.privateKey, {
        iss: expectedClientId,
        aud: issuerAudience,
        jti: "replayed-jti",
      });

      const result = await validateClientAttestationPoP(jwt, {
        cnfJwk: popKeyPair.publicJwk,
        expectedClientId,
        issuerAudience,
        jtiValidator: async () => false,
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(result.errorDescription, "replay");
      }
    });
  });

  describe("Signature verification", () => {
    it("should reject JWT signed with wrong key", async () => {
      // Generate a different key pair
      const otherKeyPair = await generatePopKeyPair();

      // Create JWT signed with other key but verify with original key
      const jwt = await createTestAttestationPopJwt(otherKeyPair.privateKey, {
        iss: expectedClientId,
        aud: issuerAudience,
      });

      const result = await validateClientAttestationPoP(jwt, {
        cnfJwk: popKeyPair.publicJwk, // Wrong key
        expectedClientId,
        issuerAudience,
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(result.errorDescription, "signature");
      }
    });
  });

  describe("Invalid JWT format", () => {
    it("should reject malformed JWT", async () => {
      const result = await validateClientAttestationPoP("not-a-valid-jwt", {
        cnfJwk: popKeyPair.publicJwk,
        expectedClientId,
        issuerAudience,
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(result.errorDescription, "Invalid JWT format");
      }
    });
  });
});
