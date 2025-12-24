import { generateRandomString } from "ownd-vci/dist/utils/randomStringUtils.js";
import authStore from "ownd-vci-common/dist/store/authStore.js";
import {
  NonceIssuer,
  NonceIssuerConfig,
} from "ownd-vci/dist/oid4vci/nonceEndpoint/types.js";

export const nonceIssuer: NonceIssuer = async () => {
  try {
    const cNonce = generateRandomString();
    const cNonceExpiresIn = Number(
      process.env.VCI_ACCESS_TOKEN_C_NONCE_EXPIRES_IN,
    );

    await authStore.addCNonce(cNonce, cNonceExpiresIn);

    const nonceResponse = {
      c_nonce: cNonce,
      c_nonce_expires_in: cNonceExpiresIn,
    };
    return { ok: true, payload: nonceResponse };
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

export const nonceConfigure = (): NonceIssuerConfig => {
  const config: NonceIssuerConfig = {
    nonceIssuer,
  };

  // Add DPoP nonce provider if DPoP is enabled
  if (isDpopEnabled()) {
    config.dpopNonceProvider = async () => authStore.generateDpopNonce();
  }

  return config;
};
