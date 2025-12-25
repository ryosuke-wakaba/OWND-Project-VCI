import { assert } from "chai";
import ellipticJwk, { publicJwkFromPrivate } from "elliptic-jwk";
import * as jose from "jose";
import { v4 as uuidv4 } from "uuid";

import { TokenIssuer } from "../../../src/oid4vci/tokenEndpoint/TokenIssuer.js";
import {
  TokenIssuerConfig,
  AuthCodeStateProvider,
  AccessTokenIssuer,
} from "../../../src/oid4vci/tokenEndpoint/types.js";
import {
  HttpRequest,
  AuthorizedCode,
} from "../../../src/oid4vci/types/types.js";
import { calculateAccessTokenHash } from "../../../src/oid4vci/dpop/utils.js";

const TOKEN_ENDPOINT_URL = "https://example.com/token";

const privateJwk = ellipticJwk.newPrivateJwk("P-256");
// @ts-ignore
const privateKey = await jose.importJWK(privateJwk, "ES256");
const publicJwk = publicJwkFromPrivate(privateJwk);

/**
 * Helper function to create a valid DPoP proof JWT for Token Endpoint
 */
async function createDpopProof(options: {
  httpMethod?: string;
  httpUri?: string;
  nonce?: string;
  iat?: number;
  jti?: string;
}): Promise<string> {
  const {
    httpMethod = "POST",
    httpUri = TOKEN_ENDPOINT_URL,
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

  if (nonce) {
    payload.nonce = nonce;
  }

  const token = await new jose.SignJWT(payload)
    .setProtectedHeader({ typ: "dpop+jwt", alg: "ES256", jwk: publicJwk })
    .sign(privateKey);

  return token;
}

/**
 * Create mock HttpRequest
 */
function createMockRequest(options: {
  dpopHeader?: string;
  body?: Record<string, string>;
}): HttpRequest {
  const headers: Record<string, string> = {};
  if (options.dpopHeader) {
    headers["DPoP"] = options.dpopHeader;
  }

  return {
    getHeader: (name: string) => headers[name] || "",
    getBody: () =>
      options.body || {
        grant_type: "urn:ietf:params:oauth:grant-type:pre-authorized_code",
        "pre-authorized_code": "valid-code",
      },
  };
}

/**
 * Create mock AuthCodeStateProvider that returns a valid authorized code
 */
const createAuthCodeStateProvider =
  (): AuthCodeStateProvider => async (code: string) => {
    if (code === "valid-code") {
      const authorizedCode: AuthorizedCode = {
        id: 1,
        code: "valid-code",
        expiresIn: 86400,
        needsProof: true,
        preAuthFlow: true,
        isUsed: false,
        createdAt: new Date().toISOString(),
        sub: "test-subject",
      };
      return {
        exists: true,
        payload: { authorizedCode },
      };
    }
    return { exists: false };
  };

/**
 * Create mock AccessTokenIssuer
 */
const createAccessTokenIssuer =
  (): AccessTokenIssuer => async (authorizedCode, context) => {
    return {
      ok: true,
      payload: {
        access_token: "issued-access-token",
        token_type: context?.dpopJkt ? "DPoP" : "Bearer",
        expires_in: 3600,
      },
    };
  };

describe("TokenIssuer DPoP", () => {
  describe("DPoP disabled", () => {
    it("should issue Bearer token when DPoP is disabled", async () => {
      const config: TokenIssuerConfig = {
        authCodeStateProvider: createAuthCodeStateProvider(),
        accessTokenIssuer: createAccessTokenIssuer(),
      };

      const issuer = new TokenIssuer(config);
      const request = createMockRequest({});

      const result = await issuer.issue(request);

      assert.isTrue(result.ok);
      if (result.ok) {
        assert.equal(result.payload.token_type, "Bearer");
      }
    });

    it("should ignore DPoP proof when DPoP is disabled", async () => {
      const config: TokenIssuerConfig = {
        authCodeStateProvider: createAuthCodeStateProvider(),
        accessTokenIssuer: createAccessTokenIssuer(),
      };

      const issuer = new TokenIssuer(config);
      const dpopProof = await createDpopProof({});
      const request = createMockRequest({ dpopHeader: dpopProof });

      const result = await issuer.issue(request);

      assert.isTrue(result.ok);
      if (result.ok) {
        // Token type is still Bearer because DPoP is disabled
        assert.equal(result.payload.token_type, "Bearer");
      }
    });
  });

  describe("DPoP enabled (optional)", () => {
    it("should issue Bearer token when DPoP proof is not provided", async () => {
      const config: TokenIssuerConfig = {
        authCodeStateProvider: createAuthCodeStateProvider(),
        accessTokenIssuer: createAccessTokenIssuer(),
        dpop: {
          enabled: true,
          required: false,
        },
        tokenEndpointUrl: TOKEN_ENDPOINT_URL,
      };

      const issuer = new TokenIssuer(config);
      const request = createMockRequest({});

      const result = await issuer.issue(request);

      assert.isTrue(result.ok);
      if (result.ok) {
        assert.equal(result.payload.token_type, "Bearer");
      }
    });

    it("should issue DPoP token when valid DPoP proof is provided", async () => {
      const config: TokenIssuerConfig = {
        authCodeStateProvider: createAuthCodeStateProvider(),
        accessTokenIssuer: createAccessTokenIssuer(),
        dpop: {
          enabled: true,
          required: false,
        },
        tokenEndpointUrl: TOKEN_ENDPOINT_URL,
      };

      const issuer = new TokenIssuer(config);
      const dpopProof = await createDpopProof({});
      const request = createMockRequest({ dpopHeader: dpopProof });

      const result = await issuer.issue(request);

      assert.isTrue(result.ok);
      if (result.ok) {
        assert.equal(result.payload.token_type, "DPoP");
      }
    });

    it("should fail when invalid DPoP proof is provided", async () => {
      const config: TokenIssuerConfig = {
        authCodeStateProvider: createAuthCodeStateProvider(),
        accessTokenIssuer: createAccessTokenIssuer(),
        dpop: {
          enabled: true,
          required: false,
        },
        tokenEndpointUrl: TOKEN_ENDPOINT_URL,
      };

      const issuer = new TokenIssuer(config);
      const request = createMockRequest({ dpopHeader: "invalid-dpop-proof" });

      const result = await issuer.issue(request);

      assert.isFalse(result.ok);
      if (!result.ok) {
        assert.equal(result.error.status, 400);
        assert.equal(result.error.payload.error, "invalid_dpop_proof");
      }
    });

    it("should fail when DPoP proof has wrong htu", async () => {
      const config: TokenIssuerConfig = {
        authCodeStateProvider: createAuthCodeStateProvider(),
        accessTokenIssuer: createAccessTokenIssuer(),
        dpop: {
          enabled: true,
          required: false,
        },
        tokenEndpointUrl: TOKEN_ENDPOINT_URL,
      };

      const issuer = new TokenIssuer(config);
      const dpopProof = await createDpopProof({
        httpUri: "https://wrong.com/token",
      });
      const request = createMockRequest({ dpopHeader: dpopProof });

      const result = await issuer.issue(request);

      assert.isFalse(result.ok);
      if (!result.ok) {
        assert.equal(result.error.status, 400);
        assert.equal(result.error.payload.error, "invalid_dpop_proof");
        assert.include(result.error.payload.error_description, "htu mismatch");
      }
    });
  });

  describe("DPoP required", () => {
    it("should fail when DPoP is required but not provided", async () => {
      const config: TokenIssuerConfig = {
        authCodeStateProvider: createAuthCodeStateProvider(),
        accessTokenIssuer: createAccessTokenIssuer(),
        dpop: {
          enabled: true,
          required: true,
        },
        tokenEndpointUrl: TOKEN_ENDPOINT_URL,
      };

      const issuer = new TokenIssuer(config);
      const request = createMockRequest({});

      const result = await issuer.issue(request);

      assert.isFalse(result.ok);
      if (!result.ok) {
        assert.equal(result.error.status, 400);
        assert.equal(result.error.payload.error, "invalid_dpop_proof");
        assert.include(result.error.payload.error_description, "required");
      }
    });

    it("should issue DPoP token when valid DPoP proof is provided", async () => {
      const config: TokenIssuerConfig = {
        authCodeStateProvider: createAuthCodeStateProvider(),
        accessTokenIssuer: createAccessTokenIssuer(),
        dpop: {
          enabled: true,
          required: true,
        },
        tokenEndpointUrl: TOKEN_ENDPOINT_URL,
      };

      const issuer = new TokenIssuer(config);
      const dpopProof = await createDpopProof({});
      const request = createMockRequest({ dpopHeader: dpopProof });

      const result = await issuer.issue(request);

      assert.isTrue(result.ok);
      if (result.ok) {
        assert.equal(result.payload.token_type, "DPoP");
      }
    });
  });

  // Note: OID4VCI does not issue DPoP nonce from Token Endpoint.
  // DPoP nonces are issued by the Nonce Endpoint via DPoP-Nonce header.

  describe("Configuration error", () => {
    it("should fail when tokenEndpointUrl is not configured", async () => {
      const config: TokenIssuerConfig = {
        authCodeStateProvider: createAuthCodeStateProvider(),
        accessTokenIssuer: createAccessTokenIssuer(),
        dpop: {
          enabled: true,
          required: false,
        },
        // tokenEndpointUrl is missing
      };

      const issuer = new TokenIssuer(config);
      const dpopProof = await createDpopProof({});
      const request = createMockRequest({ dpopHeader: dpopProof });

      const result = await issuer.issue(request);

      assert.isFalse(result.ok);
      if (!result.ok) {
        assert.equal(result.error.status, 500);
        assert.equal(result.error.payload.error, "server_error");
      }
    });
  });
});
