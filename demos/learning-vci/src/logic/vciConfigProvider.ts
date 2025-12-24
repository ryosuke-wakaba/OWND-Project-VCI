import { generateRandomString } from "ownd-vci/dist/utils/randomStringUtils.js";
import store from "../store.js";
import {
  AccessTokenIssuer,
  AuthCodeStateProvider,
  AuthorizedCodeWithStoredData,
  TokenIssuerConfig,
  TokenIssuanceContext,
} from "ownd-vci/dist/oid4vci/tokenEndpoint/types.js";

export const authCodeStateProvider: AuthCodeStateProvider = async (
  authorizedCode: string,
) => {
  const result = await store.getPreAuthCodeAndLearner(authorizedCode);
  if (!result) {
    return { exists: false };
  }
  const { storedAuthCode } = result;
  const { usedAt, ...rest } = storedAuthCode;
  const _preAuthorizedCode = {
    ...rest,
    isUsed: usedAt !== null,
    storedData: { id: storedAuthCode.id },
  };
  return {
    exists: true,
    payload: {
      authorizedCode: _preAuthorizedCode,
    },
  };
};

export const accessTokenIssuer: AccessTokenIssuer = async (
  authorizedCode: AuthorizedCodeWithStoredData,
  context?: TokenIssuanceContext,
) => {
  const newAccessToken = generateRandomString();
  const { needsProof } = authorizedCode;

  try {
    const expiresIn = Number(process.env.VCI_ACCESS_TOKEN_EXPIRES_IN);
    const nonce = {};

    // Store access token with optional DPoP binding
    await store.addAccessToken(
      newAccessToken,
      expiresIn,
      authorizedCode.storedData.id,
      context?.dpopJkt,
    );

    if (needsProof) {
      // c_nonce is issued via Nonce Endpoint
    }

    const tokenResponse = {
      access_token: newAccessToken,
      token_type: context?.dpopJkt ? "DPoP" : "Bearer",
      expires_in: expiresIn,
      ...nonce,
    };
    return { ok: true, payload: tokenResponse };
  } catch (err) {
    console.error(err);
    return {
      ok: false,
      error: { error: "INTERNAL_ERROR", internalError: true },
    };
  }
};

/**
 * Check if DPoP is enabled via environment variable
 */
const isDpopEnabled = (): boolean => {
  return process.env.DPOP_ENABLED === "true";
};

/**
 * Get token endpoint URL from environment
 */
const getTokenEndpointUrl = (): string => {
  const issuer = process.env.CREDENTIAL_ISSUER || "http://localhost:3001";
  return `${issuer}/token`;
};

export const tokenConfigure = (): TokenIssuerConfig => {
  const config: TokenIssuerConfig = {
    authCodeStateProvider,
    accessTokenIssuer,
  };

  // Add DPoP configuration if enabled
  // Note: Token Endpoint does not issue nonces per OID4VCI spec.
  // Nonces are issued by the Nonce Endpoint.
  if (isDpopEnabled()) {
    config.dpop = {
      enabled: true,
      required: process.env.DPOP_REQUIRED === "true",
    };
    config.tokenEndpointUrl = getTokenEndpointUrl();
  }

  return config;
};
