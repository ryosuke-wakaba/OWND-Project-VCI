/**
 * Tests for Client Attestation JWT validation
 */

import { assert } from "chai";
import * as jose from "jose";
import { validateClientAttestationJwt } from "../../../src/oid4vci/clientAuthentication/validateAttestation.js";
import {
  generateTestKeyPair,
  createTestAttestationJwt,
  generatePopKeyPair,
  TestKeyPair,
} from "./testUtils.js";

describe("validateClientAttestationJwt", () => {
  let testKeyPair: TestKeyPair;
  let popKeyPair: { privateKey: jose.KeyLike; publicJwk: jose.JWK };

  before(async () => {
    testKeyPair = await generateTestKeyPair();
    popKeyPair = await generatePopKeyPair();
  });

  describe("Valid attestation", () => {
    it("should validate a properly formed attestation JWT", async () => {
      const jwt = await createTestAttestationJwt(testKeyPair, {
        cnfJwk: popKeyPair.publicJwk,
      });

      const result = await validateClientAttestationJwt(jwt);

      assert.isTrue(result.valid);
      if (result.valid) {
        assert.equal(result.payload.iss, "https://wallet-provider.example.com");
        assert.equal(result.payload.sub, "wallet-client-id");
        assert.deepEqual(result.payload.cnf.jwk, popKeyPair.publicJwk);
      }
    });

    it("should validate attestation with optional wallet_name and wallet_link", async () => {
      const jwt = await createTestAttestationJwt(testKeyPair, {
        cnfJwk: popKeyPair.publicJwk,
        walletName: "Test Wallet",
        walletLink: "https://wallet.example.com",
      });

      const result = await validateClientAttestationJwt(jwt);

      assert.isTrue(result.valid);
      if (result.valid) {
        assert.equal(result.payload.wallet_name, "Test Wallet");
        assert.equal(result.payload.wallet_link, "https://wallet.example.com");
      }
    });
  });

  describe("Invalid typ", () => {
    it("should reject JWT with wrong typ", async () => {
      const jwt = await createTestAttestationJwt(testKeyPair, {
        cnfJwk: popKeyPair.publicJwk,
        typ: "jwt",
      });

      const result = await validateClientAttestationJwt(jwt);

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(result.errorDescription, "Invalid typ");
      }
    });
  });

  describe("Invalid algorithm", () => {
    it("should reject JWT with unsupported algorithm in allowedAlgorithms", async () => {
      const jwt = await createTestAttestationJwt(testKeyPair, {
        cnfJwk: popKeyPair.publicJwk,
        alg: "ES256", // Valid but not in allowed list
      });

      const result = await validateClientAttestationJwt(jwt, {
        allowedAlgorithms: ["ES384"], // Only allow ES384
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(result.errorDescription, "algorithm");
      }
    });

    it("should allow algorithm specified in options", async () => {
      const jwt = await createTestAttestationJwt(testKeyPair, {
        cnfJwk: popKeyPair.publicJwk,
      });

      const result = await validateClientAttestationJwt(jwt, {
        allowedAlgorithms: ["ES256"],
      });

      assert.isTrue(result.valid);
    });
  });

  describe("Missing x5c header", () => {
    it("should reject JWT without x5c header", async () => {
      const jwt = await createTestAttestationJwt(testKeyPair, {
        cnfJwk: popKeyPair.publicJwk,
        includeX5c: false,
      });

      const result = await validateClientAttestationJwt(jwt);

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(result.errorDescription, "x5c");
      }
    });
  });

  describe("Missing required claims", () => {
    it("should reject JWT without iss claim", async () => {
      const jwt = await createTestAttestationJwt(testKeyPair, {
        cnfJwk: popKeyPair.publicJwk,
        iss: "",
      });

      const result = await validateClientAttestationJwt(jwt);

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(result.errorDescription, "iss");
      }
    });

    it("should reject JWT without sub claim", async () => {
      const jwt = await createTestAttestationJwt(testKeyPair, {
        cnfJwk: popKeyPair.publicJwk,
        sub: "",
      });

      const result = await validateClientAttestationJwt(jwt);

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(result.errorDescription, "sub");
      }
    });
  });

  describe("Expiration", () => {
    it("should reject expired JWT", async () => {
      const jwt = await createTestAttestationJwt(testKeyPair, {
        cnfJwk: popKeyPair.publicJwk,
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      });

      const result = await validateClientAttestationJwt(jwt);

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        // jose library checks exp during verification, so error comes from there
        assert.isTrue(
          result.errorDescription.includes("expired") ||
            result.errorDescription.includes("exp"),
        );
      }
    });
  });

  describe("Not Before (nbf)", () => {
    it("should reject JWT that is not yet valid", async () => {
      const jwt = await createTestAttestationJwt(testKeyPair, {
        cnfJwk: popKeyPair.publicJwk,
        nbf: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      });

      const result = await validateClientAttestationJwt(jwt);

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

    it("should accept JWT with valid nbf", async () => {
      const jwt = await createTestAttestationJwt(testKeyPair, {
        cnfJwk: popKeyPair.publicJwk,
        nbf: Math.floor(Date.now() / 1000) - 60, // 1 minute ago
      });

      const result = await validateClientAttestationJwt(jwt);

      assert.isTrue(result.valid);
    });
  });

  describe("x5c certificate chain validation", () => {
    it("should call custom x5c validator", async () => {
      let validatorCalled = false;
      let receivedChain: string[] = [];

      const jwt = await createTestAttestationJwt(testKeyPair, {
        cnfJwk: popKeyPair.publicJwk,
      });

      const result = await validateClientAttestationJwt(jwt, {
        x5cValidator: async (x5cChain) => {
          validatorCalled = true;
          receivedChain = x5cChain;
          return { valid: true };
        },
      });

      assert.isTrue(validatorCalled);
      assert.deepEqual(receivedChain, testKeyPair.x5c);
      assert.isTrue(result.valid);
    });

    it("should reject if x5c validator returns invalid", async () => {
      const jwt = await createTestAttestationJwt(testKeyPair, {
        cnfJwk: popKeyPair.publicJwk,
      });

      const result = await validateClientAttestationJwt(jwt, {
        x5cValidator: async () => {
          return { valid: false, error: "Certificate not trusted" };
        },
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(result.errorDescription, "Certificate not trusted");
      }
    });
  });

  describe("Invalid JWT format", () => {
    it("should reject malformed JWT", async () => {
      const result = await validateClientAttestationJwt("not-a-valid-jwt");

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(result.errorDescription, "Invalid JWT format");
      }
    });

    it("should reject empty string", async () => {
      const result = await validateClientAttestationJwt("");

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
      }
    });
  });

  describe("Signature verification", () => {
    it("should reject JWT with tampered signature", async () => {
      // Create a valid JWT
      const jwt = await createTestAttestationJwt(testKeyPair, {
        cnfJwk: popKeyPair.publicJwk,
      });

      // Modify the signature part to simulate tampering
      const parts = jwt.split(".");
      parts[2] = parts[2].split("").reverse().join(""); // corrupt signature
      const tamperedJwt = parts.join(".");

      const result = await validateClientAttestationJwt(tamperedJwt);

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_client");
        assert.include(result.errorDescription, "signature");
      }
    });
  });
});
