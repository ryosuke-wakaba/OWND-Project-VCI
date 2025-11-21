import { generateRandomString } from "ownd-vci/dist/utils/randomStringUtils.js";
import store from "../store.js";
import {
  AccessTokenIssuer,
  AuthCodeStateProvider,
  AuthorizedCodeWithStoredData,
  TokenIssuerConfig,
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
) => {
  const newAccessToken = generateRandomString();
  const { needsProof } = authorizedCode;

  try {
    const expiresIn = Number(process.env.VCI_ACCESS_TOKEN_EXPIRES_IN);
    let nonce = {};

    await store.addAccessToken(
      newAccessToken,
      expiresIn,
      authorizedCode.storedData.id,
    );

    if (needsProof) {
      // c_nonce is issued via Nonce Endpoint
    }

    const tokenResponse = {
      access_token: newAccessToken,
      token_type: "bearer",
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

export const tokenConfigure = (): TokenIssuerConfig => {
  return {
    authCodeStateProvider,
    accessTokenIssuer,
  };
};
