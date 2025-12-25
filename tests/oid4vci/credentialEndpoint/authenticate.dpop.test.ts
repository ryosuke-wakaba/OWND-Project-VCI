import { assert } from "chai";
import ellipticJwk, { publicJwkFromPrivate } from "elliptic-jwk";
import * as jose from "jose";
import { v4 as uuidv4 } from "uuid";

import { authenticate } from "../../../src/oid4vci/credentialEndpoint/authenticate.js";
import {
  AccessTokenStateProvider,
  ValidAccessTokenState,
  CredentialDpopConfig,
} from "../../../src/oid4vci/credentialEndpoint/types.js";
import {
  calculateAccessTokenHash,
  calculateJwkThumbprint,
} from "../../../src/oid4vci/dpop/utils.js";

const CREDENTIAL_ENDPOINT_URL = "https://example.com/credentials";

const privateJwk = ellipticJwk.newPrivateJwk("P-256");
// @ts-ignore
const privateKey = await jose.importJWK(privateJwk, "ES256");
const publicJwk = publicJwkFromPrivate(privateJwk);

/**
 * Calculate JWK thumbprint for test setup
 */
let testDpopJkt: string;
(async () => {
  testDpopJkt = await calculateJwkThumbprint(publicJwk as jose.JWK);
})();

/**
 * Helper function to create a valid DPoP proof JWT for Credential Endpoint
 */
async function createDpopProof(options: {
  httpMethod?: string;
  httpUri?: string;
  accessToken?: string;
  nonce?: string;
  iat?: number;
  jti?: string;
}): Promise<string> {
  const {
    httpMethod = "POST",
    httpUri = CREDENTIAL_ENDPOINT_URL,
    accessToken,
    nonce,
    iat = Math.floor(Date.now() / 1000),
    jti = uuidv4(),
  } = options;

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
    .setProtectedHeader({ typ: "dpop+jwt", alg: "ES256", jwk: publicJwk })
    .sign(privateKey);

  return token;
}

/**
 * Create mock access token state for Bearer tokens
 */
const createBearerTokenState = (): ValidAccessTokenState<{}> => ({
  authorizedCode: {
    code: "test-code",
    sub: "test-subject",
  },
  expiresIn: 86400,
  createdAt: new Date(),
  storedAccessToken: {},
});

/**
 * Create mock access token state for DPoP-bound tokens
 */
const createDpopTokenState = (dpopJkt: string): ValidAccessTokenState<{}> => ({
  authorizedCode: {
    code: "test-code",
    sub: "test-subject",
  },
  expiresIn: 86400,
  createdAt: new Date(),
  storedAccessToken: {},
  dpopJkt,
});

/**
 * Create mock AccessTokenStateProvider
 */
const createAccessTokenStateProvider = (
  tokenState: ValidAccessTokenState<{}>,
): AccessTokenStateProvider<{}> => {
  return async (token: string) => {
    if (token === "valid-token") {
      return { exists: true, payload: tokenState };
    }
    return { exists: false };
  };
};

describe("authenticate with DPoP", () => {
  // Initialize testDpopJkt before tests
  before(async () => {
    testDpopJkt = await calculateJwkThumbprint(publicJwk as jose.JWK);
  });

  describe("DPoP disabled", () => {
    it("should authenticate Bearer token when DPoP is disabled", async () => {
      const tokenState = createBearerTokenState();
      const provider = createAccessTokenStateProvider(tokenState);

      const result = await authenticate("Bearer valid-token", provider);

      assert.isTrue(result.ok);
      if (result.ok) {
        assert.deepEqual(result.payload.tokenState, tokenState);
      }
    });

    it("should reject DPoP token type when DPoP is disabled", async () => {
      const tokenState = createBearerTokenState();
      const provider = createAccessTokenStateProvider(tokenState);

      const result = await authenticate("DPoP valid-token", provider);

      assert.isFalse(result.ok);
      if (!result.ok) {
        assert.equal(result.error.error, "invalid_token");
        assert.include(
          result.error.error_description,
          "Only Bearer token type is supported",
        );
      }
    });
  });

  describe("DPoP enabled (optional)", () => {
    const dpopConfig: CredentialDpopConfig = {
      enabled: true,
      required: false,
      credentialEndpointUrl: CREDENTIAL_ENDPOINT_URL,
    };

    it("should authenticate Bearer token when DPoP is optional", async () => {
      const tokenState = createBearerTokenState();
      const provider = createAccessTokenStateProvider(tokenState);

      const result = await authenticate(
        "Bearer valid-token",
        provider,
        undefined,
        dpopConfig,
      );

      assert.isTrue(result.ok);
      if (result.ok) {
        assert.deepEqual(result.payload.tokenState, tokenState);
      }
    });

    it("should authenticate DPoP token with valid proof", async () => {
      const tokenState = createDpopTokenState(testDpopJkt);
      const provider = createAccessTokenStateProvider(tokenState);

      const accessToken = "valid-token";
      const dpopProof = await createDpopProof({ accessToken });

      const result = await authenticate(
        `DPoP ${accessToken}`,
        provider,
        dpopProof,
        dpopConfig,
      );

      assert.isTrue(result.ok);
      if (result.ok) {
        assert.deepEqual(result.payload.tokenState, tokenState);
      }
    });

    it("should fail when DPoP-bound token is presented with Bearer type", async () => {
      const tokenState = createDpopTokenState(testDpopJkt);
      const provider = createAccessTokenStateProvider(tokenState);

      const result = await authenticate(
        "Bearer valid-token",
        provider,
        undefined,
        dpopConfig,
      );

      assert.isFalse(result.ok);
      if (!result.ok) {
        assert.equal(result.error.error, "invalid_token");
        assert.include(result.error.error_description, "DPoP-bound token");
      }
    });

    it("should fail when DPoP-bound token is missing DPoP proof", async () => {
      const tokenState = createDpopTokenState(testDpopJkt);
      const provider = createAccessTokenStateProvider(tokenState);

      const result = await authenticate(
        "DPoP valid-token",
        provider,
        undefined,
        dpopConfig,
      );

      assert.isFalse(result.ok);
      if (!result.ok) {
        assert.equal(result.error.error, "invalid_dpop_proof");
        assert.include(
          result.error.error_description,
          "DPoP proof is required",
        );
      }
    });

    it("should fail when DPoP proof has invalid signature", async () => {
      const tokenState = createDpopTokenState(testDpopJkt);
      const provider = createAccessTokenStateProvider(tokenState);

      const result = await authenticate(
        "DPoP valid-token",
        provider,
        "invalid-proof",
        dpopConfig,
      );

      assert.isFalse(result.ok);
      if (!result.ok) {
        assert.equal(result.error.error, "invalid_dpop_proof");
      }
    });

    it("should fail when DPoP proof has wrong thumbprint", async () => {
      // Create a different key pair
      const otherPrivateJwk = ellipticJwk.newPrivateJwk("P-256");
      const otherPublicJwk = publicJwkFromPrivate(otherPrivateJwk);
      // @ts-ignore
      const otherPrivateKey = await jose.importJWK(otherPrivateJwk, "ES256");

      const accessToken = "valid-token";
      const wrongProof = await new jose.SignJWT({
        jti: uuidv4(),
        htm: "POST",
        htu: CREDENTIAL_ENDPOINT_URL,
        iat: Math.floor(Date.now() / 1000),
        ath: calculateAccessTokenHash(accessToken),
      })
        .setProtectedHeader({
          typ: "dpop+jwt",
          alg: "ES256",
          jwk: otherPublicJwk,
        })
        .sign(otherPrivateKey);

      const tokenState = createDpopTokenState(testDpopJkt);
      const provider = createAccessTokenStateProvider(tokenState);

      const result = await authenticate(
        `DPoP ${accessToken}`,
        provider,
        wrongProof,
        dpopConfig,
      );

      assert.isFalse(result.ok);
      if (!result.ok) {
        assert.equal(result.error.error, "invalid_dpop_proof");
        assert.include(result.error.error_description, "does not match");
      }
    });

    it("should fail when DPoP proof has missing ath", async () => {
      const tokenState = createDpopTokenState(testDpopJkt);
      const provider = createAccessTokenStateProvider(tokenState);

      // Create proof without ath
      const proofWithoutAth = await createDpopProof({});

      const result = await authenticate(
        "DPoP valid-token",
        provider,
        proofWithoutAth,
        dpopConfig,
      );

      assert.isFalse(result.ok);
      if (!result.ok) {
        assert.equal(result.error.error, "invalid_dpop_proof");
        assert.include(result.error.error_description, "ath");
      }
    });

    it("should fail when DPoP proof has wrong ath", async () => {
      const tokenState = createDpopTokenState(testDpopJkt);
      const provider = createAccessTokenStateProvider(tokenState);

      // Create proof with wrong ath
      const proofWithWrongAth = await createDpopProof({
        accessToken: "wrong-token",
      });

      const result = await authenticate(
        "DPoP valid-token",
        provider,
        proofWithWrongAth,
        dpopConfig,
      );

      assert.isFalse(result.ok);
      if (!result.ok) {
        assert.equal(result.error.error, "invalid_dpop_proof");
        assert.include(result.error.error_description, "ath");
      }
    });
  });

  describe("DPoP required", () => {
    const dpopConfig: CredentialDpopConfig = {
      enabled: true,
      required: true,
      credentialEndpointUrl: CREDENTIAL_ENDPOINT_URL,
    };

    it("should fail when DPoP is required but Bearer token is used", async () => {
      const tokenState = createBearerTokenState();
      const provider = createAccessTokenStateProvider(tokenState);

      const result = await authenticate(
        "Bearer valid-token",
        provider,
        undefined,
        dpopConfig,
      );

      assert.isFalse(result.ok);
      if (!result.ok) {
        assert.equal(result.error.error, "invalid_dpop_proof");
        assert.include(result.error.error_description, "required");
      }
    });

    it("should authenticate DPoP token with valid proof when required", async () => {
      const tokenState = createDpopTokenState(testDpopJkt);
      const provider = createAccessTokenStateProvider(tokenState);

      const accessToken = "valid-token";
      const dpopProof = await createDpopProof({ accessToken });

      const result = await authenticate(
        `DPoP ${accessToken}`,
        provider,
        dpopProof,
        dpopConfig,
      );

      assert.isTrue(result.ok);
      if (result.ok) {
        assert.deepEqual(result.payload.tokenState, tokenState);
      }
    });
  });

  describe("DPoP nonce validation", () => {
    it("should return invalid_nonce when nonce validation fails", async () => {
      const dpopConfig: CredentialDpopConfig = {
        enabled: true,
        required: false,
        credentialEndpointUrl: CREDENTIAL_ENDPOINT_URL,
        nonceValidator: async () => false, // Always reject nonce
      };

      const tokenState = createDpopTokenState(testDpopJkt);
      const provider = createAccessTokenStateProvider(tokenState);

      const accessToken = "valid-token";
      // Create proof with nonce (required when nonceValidator is configured)
      const dpopProof = await createDpopProof({
        accessToken,
        nonce: "invalid-nonce",
      });

      const result = await authenticate(
        `DPoP ${accessToken}`,
        provider,
        dpopProof,
        dpopConfig,
      );

      assert.isFalse(result.ok);
      if (!result.ok) {
        assert.equal(result.error.error, "invalid_nonce");
        assert.include(result.error.error_description, "Nonce Endpoint");
      }
    });

    it("should return invalid_nonce when nonce is missing but required", async () => {
      const dpopConfig: CredentialDpopConfig = {
        enabled: true,
        required: false,
        credentialEndpointUrl: CREDENTIAL_ENDPOINT_URL,
        nonceValidator: async () => true, // Would accept if present
      };

      const tokenState = createDpopTokenState(testDpopJkt);
      const provider = createAccessTokenStateProvider(tokenState);

      const accessToken = "valid-token";
      // Create proof WITHOUT nonce
      const dpopProof = await createDpopProof({ accessToken });

      const result = await authenticate(
        `DPoP ${accessToken}`,
        provider,
        dpopProof,
        dpopConfig,
      );

      assert.isFalse(result.ok);
      if (!result.ok) {
        assert.equal(result.error.error, "invalid_nonce");
        assert.include(result.error.error_description, "Nonce Endpoint");
      }
    });

    it("should authenticate when nonce is valid", async () => {
      const validNonce = "valid-server-nonce";
      const dpopConfig: CredentialDpopConfig = {
        enabled: true,
        required: false,
        credentialEndpointUrl: CREDENTIAL_ENDPOINT_URL,
        nonceValidator: async (nonce) => nonce === validNonce,
      };

      const tokenState = createDpopTokenState(testDpopJkt);
      const provider = createAccessTokenStateProvider(tokenState);

      const accessToken = "valid-token";
      const dpopProof = await createDpopProof({
        accessToken,
        nonce: validNonce,
      });

      const result = await authenticate(
        `DPoP ${accessToken}`,
        provider,
        dpopProof,
        dpopConfig,
      );

      assert.isTrue(result.ok);
      if (result.ok) {
        assert.deepEqual(result.payload.tokenState, tokenState);
      }
    });
  });
});
