import { generateRandomString } from "ownd-vci/dist/utils/randomStringUtils.js";
import store from "../store.js";
import {
  AccessTokenIssuer,
  AuthCodeStateProvider,
  AuthorizedCodeWithStoredData,
  TokenIssuerConfig,
  TokenIssuanceContext,
} from "ownd-vci/dist/oid4vci/tokenEndpoint/types.js";
import { x5cValidator } from "./x5cValidator.js";

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
    // Include requireClientAuth from stored auth code
    // Note: SQLite returns 0/1 for boolean columns, so we convert to boolean
    requireClientAuth: Boolean(storedAuthCode.requireClientAuth),
    // Include requireDpop from stored auth code
    requireDpop: Boolean(storedAuthCode.requireDpop),
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
 * Get token endpoint URL from environment
 */
const getTokenEndpointUrl = (): string => {
  const issuer = process.env.CREDENTIAL_ISSUER || "http://localhost:3001";
  return `${issuer}/token`;
};

/**
 * Get Credential Issuer URL for Client Authentication audience validation
 */
const getCredentialIssuerUrl = (): string => {
  return process.env.CREDENTIAL_ISSUER || "http://localhost:3001";
};

export const tokenConfigure = (): TokenIssuerConfig => {
  const config: TokenIssuerConfig = {
    authCodeStateProvider,
    accessTokenIssuer,
  };

  // DPoP is always enabled. Whether it's required is controlled per auth code.
  // Note: Token Endpoint does not issue nonces per OID4VCI spec.
  // Nonces are issued by the Nonce Endpoint.
  config.dpop = {
    enabled: true,
    // required is checked per auth code (requireDpop flag) in TokenIssuer
    required: false,
  };
  config.tokenEndpointUrl = getTokenEndpointUrl();

  // Add Client Authentication configuration
  // Client authentication is checked per auth code (requireClientAuth flag)
  config.clientAuthentication = {
    enabled: true,
    issuerAudience: getCredentialIssuerUrl(),
    // Custom x5c validator for certificate chain validation against trusted CAs
    // The validator checks wallet attestation settings to determine if chain validation is enabled
    x5cValidator,
    // Optional: Add jti validator for replay detection
    // jtiValidator: async (jti) => { ... }
  };

  return config;
};
