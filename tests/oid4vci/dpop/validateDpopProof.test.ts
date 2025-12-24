import { assert } from "chai";
import ellipticJwk, { publicJwkFromPrivate } from "elliptic-jwk";
import * as jose from "jose";
import { v4 as uuidv4 } from "uuid";

import {
  validateDpopProof,
  hasDpopHeader,
} from "../../../src/oid4vci/dpop/validateDpopProof.js";
import { calculateAccessTokenHash } from "../../../src/oid4vci/dpop/utils.js";

const privateJwk = ellipticJwk.newPrivateJwk("P-256");
// @ts-ignore
const privateKey = await jose.importJWK(privateJwk, "ES256");
const publicJwk = publicJwkFromPrivate(privateJwk);

/**
 * Helper function to create a valid DPoP proof JWT
 */
async function createDpopProof(options: {
  httpMethod?: string;
  httpUri?: string;
  accessToken?: string;
  nonce?: string;
  iat?: number;
  jti?: string;
  jwk?: jose.JWK;
  privateKey?: jose.KeyLike;
  typ?: string;
  alg?: string;
  includePrivateKey?: boolean;
}): Promise<string> {
  const {
    httpMethod = "POST",
    httpUri = "https://example.com/token",
    accessToken,
    nonce,
    iat = Math.floor(Date.now() / 1000),
    jti = uuidv4(),
    jwk = publicJwk,
    typ = "dpop+jwt",
    alg = "ES256",
    includePrivateKey = false,
  } = options;

  const keyToUse = options.privateKey || privateKey;
  const jwkToUse = includePrivateKey ? privateJwk : jwk;

  const payload: Record<string, unknown> = {
    jti,
    htm: httpMethod,
    htu: httpUri,
    iat,
  };

  if (accessToken) {
    payload.ath = calculateAccessTokenHash(accessToken);
  }

  if (nonce) {
    payload.nonce = nonce;
  }

  const token = await new jose.SignJWT(payload)
    .setProtectedHeader({ typ, alg, jwk: jwkToUse as jose.JWK })
    .sign(keyToUse);

  return token;
}

describe("hasDpopHeader", () => {
  it("should return true for non-empty string", () => {
    assert.isTrue(hasDpopHeader("some-dpop-proof"));
  });

  it("should return false for empty string", () => {
    assert.isFalse(hasDpopHeader(""));
  });

  it("should return false for undefined", () => {
    assert.isFalse(hasDpopHeader(undefined));
  });

  it("should return true for array with one element", () => {
    assert.isTrue(hasDpopHeader(["some-dpop-proof"]));
  });

  it("should return false for empty array", () => {
    assert.isFalse(hasDpopHeader([]));
  });
});

describe("validateDpopProof", () => {
  const httpMethod = "POST";
  const httpUri = "https://example.com/token";

  describe("Basic validation", () => {
    it("should fail if DPoP header is missing", async () => {
      const result = await validateDpopProof(undefined, {
        httpMethod,
        httpUri,
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_dpop_proof");
        assert.include(result.errorDescription, "Missing DPoP header");
      }
    });

    it("should fail if multiple DPoP headers are provided", async () => {
      const proof1 = await createDpopProof({ httpMethod, httpUri });
      const proof2 = await createDpopProof({ httpMethod, httpUri });

      const result = await validateDpopProof([proof1, proof2], {
        httpMethod,
        httpUri,
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_dpop_proof");
        assert.include(result.errorDescription, "Multiple DPoP headers");
      }
    });

    it("should fail for invalid JWT format", async () => {
      const result = await validateDpopProof("not-a-valid-jwt", {
        httpMethod,
        httpUri,
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_dpop_proof");
        assert.include(result.errorDescription, "Invalid JWT format");
      }
    });
  });

  describe("Header validation", () => {
    it("should fail if typ is not dpop+jwt", async () => {
      const token = await new jose.SignJWT({
        jti: uuidv4(),
        htm: httpMethod,
        htu: httpUri,
        iat: Math.floor(Date.now() / 1000),
      })
        .setProtectedHeader({ typ: "jwt", alg: "ES256", jwk: publicJwk })
        .sign(privateKey);

      const result = await validateDpopProof(token, { httpMethod, httpUri });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_dpop_proof");
        assert.include(result.errorDescription, "Invalid typ");
      }
    });

    it("should fail if alg is none", async () => {
      // Create a fake token with alg=none (this won't actually work but tests the check)
      const result = await validateDpopProof(
        "eyJ0eXAiOiJkcG9wK2p3dCIsImFsZyI6Im5vbmUifQ.eyJ0ZXN0IjoxfQ.",
        {
          httpMethod,
          httpUri,
        },
      );

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_dpop_proof");
      }
    });

    it("should fail if jwk is missing", async () => {
      const token = await new jose.SignJWT({
        jti: uuidv4(),
        htm: httpMethod,
        htu: httpUri,
        iat: Math.floor(Date.now() / 1000),
      })
        .setProtectedHeader({ typ: "dpop+jwt", alg: "ES256" })
        .sign(privateKey);

      const result = await validateDpopProof(token, { httpMethod, httpUri });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_dpop_proof");
        assert.include(result.errorDescription, "Missing jwk");
      }
    });

    it("should fail if jwk contains private key", async () => {
      const proof = await createDpopProof({
        httpMethod,
        httpUri,
        includePrivateKey: true,
      });

      const result = await validateDpopProof(proof, { httpMethod, httpUri });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_dpop_proof");
        assert.include(result.errorDescription, "private key");
      }
    });
  });

  describe("Payload validation", () => {
    it("should fail if htm does not match HTTP method", async () => {
      const proof = await createDpopProof({ httpMethod: "GET", httpUri });

      const result = await validateDpopProof(proof, {
        httpMethod: "POST",
        httpUri,
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_dpop_proof");
        assert.include(result.errorDescription, "htm mismatch");
      }
    });

    it("should fail if htu does not match HTTP URI", async () => {
      const proof = await createDpopProof({
        httpMethod,
        httpUri: "https://other.com/token",
      });

      const result = await validateDpopProof(proof, { httpMethod, httpUri });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_dpop_proof");
        assert.include(result.errorDescription, "htu mismatch");
      }
    });

    it("should pass if htu matches ignoring query string", async () => {
      const proof = await createDpopProof({ httpMethod, httpUri });

      const result = await validateDpopProof(proof, {
        httpMethod,
        httpUri: httpUri + "?query=value",
      });

      assert.isTrue(result.valid);
    });

    it("should fail if iat is outside tolerance", async () => {
      const oldIat = Math.floor(Date.now() / 1000) - 400;
      const proof = await createDpopProof({ httpMethod, httpUri, iat: oldIat });

      const result = await validateDpopProof(proof, {
        httpMethod,
        httpUri,
        iatToleranceSeconds: 300,
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_dpop_proof");
        assert.include(result.errorDescription, "iat");
      }
    });
  });

  describe("Nonce validation", () => {
    it("should fail if server nonce is required but not provided", async () => {
      const proof = await createDpopProof({ httpMethod, httpUri });

      const result = await validateDpopProof(proof, {
        httpMethod,
        httpUri,
        serverNonce: "expected-nonce",
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "use_dpop_nonce");
        assert.include(result.errorDescription, "nonce mismatch");
      }
    });

    it("should fail if nonce does not match", async () => {
      const proof = await createDpopProof({
        httpMethod,
        httpUri,
        nonce: "wrong-nonce",
      });

      const result = await validateDpopProof(proof, {
        httpMethod,
        httpUri,
        serverNonce: "expected-nonce",
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "use_dpop_nonce");
      }
    });

    it("should pass if nonce matches", async () => {
      const serverNonce = "correct-nonce";
      const proof = await createDpopProof({
        httpMethod,
        httpUri,
        nonce: serverNonce,
      });

      const result = await validateDpopProof(proof, {
        httpMethod,
        httpUri,
        serverNonce,
      });

      assert.isTrue(result.valid);
    });
  });

  describe("Access token binding (ath)", () => {
    it("should fail if ath is missing when accessToken is provided", async () => {
      const proof = await createDpopProof({ httpMethod, httpUri });

      const result = await validateDpopProof(proof, {
        httpMethod,
        httpUri,
        accessToken: "test-access-token",
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_dpop_proof");
        assert.include(result.errorDescription, "Missing ath");
      }
    });

    it("should fail if ath does not match access token hash", async () => {
      const proof = await createDpopProof({
        httpMethod,
        httpUri,
        accessToken: "different-token",
      });

      const result = await validateDpopProof(proof, {
        httpMethod,
        httpUri,
        accessToken: "test-access-token",
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_dpop_proof");
        assert.include(result.errorDescription, "ath claim does not match");
      }
    });

    it("should pass if ath matches access token hash", async () => {
      const accessToken = "test-access-token";
      const proof = await createDpopProof({ httpMethod, httpUri, accessToken });

      const result = await validateDpopProof(proof, {
        httpMethod,
        httpUri,
        accessToken,
      });

      assert.isTrue(result.valid);
    });
  });

  describe("Thumbprint binding", () => {
    it("should fail if thumbprint does not match expected", async () => {
      // Thumbprint validation requires accessToken to be provided
      const accessToken = "test-access-token";
      const proof = await createDpopProof({ httpMethod, httpUri, accessToken });

      const result = await validateDpopProof(proof, {
        httpMethod,
        httpUri,
        accessToken,
        expectedThumbprint: "wrong-thumbprint",
      });

      assert.isFalse(result.valid);
      if (!result.valid) {
        assert.equal(result.errorCode, "invalid_dpop_proof");
        assert.include(result.errorDescription, "does not match");
      }
    });
  });

  describe("Success case", () => {
    it("should return valid result with thumbprint for valid proof", async () => {
      const proof = await createDpopProof({ httpMethod, httpUri });

      const result = await validateDpopProof(proof, { httpMethod, httpUri });

      assert.isTrue(result.valid);
      if (result.valid) {
        assert.isString(result.thumbprint);
        assert.isNotEmpty(result.thumbprint);
        assert.deepEqual(result.header.typ, "dpop+jwt");
        assert.equal(result.header.alg, "ES256");
        assert.equal(result.payload.htm, httpMethod);
        assert.equal(result.payload.htu, httpUri);
      }
    });

    it("should work with secp256k1 key", async () => {
      const k1PrivateJwk = ellipticJwk.newPrivateJwk("secp256k1");
      const k1PublicJwk = publicJwkFromPrivate(k1PrivateJwk);
      // @ts-ignore
      const k1PrivateKey = await jose.importJWK(k1PrivateJwk, "ES256K");

      const token = await new jose.SignJWT({
        jti: uuidv4(),
        htm: httpMethod,
        htu: httpUri,
        iat: Math.floor(Date.now() / 1000),
      })
        .setProtectedHeader({
          typ: "dpop+jwt",
          alg: "ES256K",
          jwk: k1PublicJwk,
        })
        .sign(k1PrivateKey);

      const result = await validateDpopProof(token, {
        httpMethod,
        httpUri,
        allowedAlgorithms: ["ES256K"],
      });

      assert.isTrue(result.valid);
    });
  });
});
