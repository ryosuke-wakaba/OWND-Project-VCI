import {
  AccessTokenStateProvider,
  ValidAccessTokenState,
  CredentialDpopConfig,
} from "./types.js";
import { ErrorPayload, Result } from "../../types.js";
import { isExpired } from "../utils.js";
import {
  validateDpopProof,
  hasDpopHeader,
  DpopValidationResult,
} from "../dpop/index.js";

const INVALID_TOKEN = "invalid_token";
const INVALID_DPOP_PROOF = "invalid_dpop_proof";

/**
 * Authentication result
 */
export interface AuthenticateResult<T> {
  tokenState: ValidAccessTokenState<T>;
}

/**
 * Extended error payload with optional headers
 */
export interface AuthErrorPayload extends ErrorPayload {
  headers?: Record<string, string>;
}

/**
 * Parse Authorization header and extract token type and value
 */
function parseAuthHeader(authHeader: string): {
  type: "Bearer" | "DPoP" | null;
  token: string | null;
} {
  if (!authHeader) {
    return { type: null, token: null };
  }

  if (RegExp("^Bearer ", "i").test(authHeader)) {
    return { type: "Bearer", token: authHeader.split(" ")[1] };
  }

  if (RegExp("^DPoP ", "i").test(authHeader)) {
    return { type: "DPoP", token: authHeader.split(" ")[1] };
  }

  return { type: null, token: null };
}

/**
 * Authenticate request with Bearer or DPoP token
 *
 * @param authHeader - Authorization header value
 * @param dpopHeader - DPoP header value (for DPoP authentication)
 * @param accessTokenStateProvider - Function to get access token state
 * @param dpopConfig - DPoP configuration (optional)
 * @returns Authentication result or error
 */
export const authenticate = async <T>(
  authHeader: string,
  accessTokenStateProvider: AccessTokenStateProvider<T>,
  dpopHeader?: string | string[],
  dpopConfig?: CredentialDpopConfig,
): Promise<Result<AuthenticateResult<T>, AuthErrorPayload>> => {
  /*
  https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#name-credential-error-response

  invalid_token:
    - Credential Request contains the wrong Access Token or the Access Token is missing
   */

  // Parse Authorization header
  const { type: tokenType, token: accessToken } = parseAuthHeader(authHeader);

  if (!tokenType || !accessToken) {
    const error: AuthErrorPayload = {
      error: INVALID_TOKEN,
      error_description: "Invalid or missing Authorization header",
    };
    return { ok: false, error };
  }

  // Get token state
  const tokenState = await accessTokenStateProvider(accessToken);
  if (!tokenState.exists) {
    const error: AuthErrorPayload = {
      error: INVALID_TOKEN,
      error_description: "Invalid access token",
    };
    return { ok: false, error };
  }

  // Check token expiration
  const { expiresIn, createdAt } = tokenState.payload;
  if (isExpired(new Date(createdAt), expiresIn)) {
    const error: AuthErrorPayload = {
      error: INVALID_TOKEN,
      error_description: "The access token expired",
    };
    return { ok: false, error };
  }

  const storedDpopJkt = tokenState.payload.dpopJkt;

  // DPoP validation
  if (dpopConfig?.enabled) {
    const hasDpop = hasDpopHeader(dpopHeader);

    // Check if token was issued with DPoP binding
    if (storedDpopJkt) {
      // Token is DPoP-bound, DPoP proof is required
      if (tokenType !== "DPoP") {
        const error: AuthErrorPayload = {
          error: INVALID_TOKEN,
          error_description:
            "DPoP-bound token must be presented with DPoP token type",
        };
        return { ok: false, error };
      }

      if (!hasDpop) {
        const error: AuthErrorPayload = {
          error: INVALID_DPOP_PROOF,
          error_description:
            "DPoP proof is required for DPoP-bound access token",
        };
        return { ok: false, error };
      }
    } else if (dpopConfig.required) {
      // DPoP is required by configuration but token is not DPoP-bound
      if (!hasDpop || tokenType !== "DPoP") {
        const error: AuthErrorPayload = {
          error: INVALID_DPOP_PROOF,
          error_description: "DPoP proof is required",
        };
        return { ok: false, error };
      }
    }

    // Validate DPoP proof if provided
    if (hasDpop && tokenType === "DPoP") {
      const dpopResult: DpopValidationResult = await validateDpopProof(
        dpopHeader,
        {
          httpMethod: "POST",
          httpUri: dpopConfig.credentialEndpointUrl,
          accessToken: accessToken,
          expectedThumbprint: storedDpopJkt,
          allowedAlgorithms: dpopConfig.allowedAlgorithms,
          iatToleranceSeconds: dpopConfig.iatToleranceSeconds,
          nonceValidator: dpopConfig.nonceValidator,
          nonceRequired: dpopConfig.nonceValidator !== undefined,
        },
      );

      if (!dpopResult.valid) {
        // Nonce errors: return invalid_nonce - client should get new nonce from Nonce Endpoint
        if (dpopResult.errorCode === "use_dpop_nonce") {
          const error: AuthErrorPayload = {
            error: "invalid_nonce",
            error_description:
              "Invalid or missing DPoP nonce. Please obtain a new nonce from the Nonce Endpoint.",
          };
          return { ok: false, error };
        }

        const error: AuthErrorPayload = {
          error: INVALID_DPOP_PROOF,
          error_description: dpopResult.errorDescription,
        };
        return { ok: false, error };
      }
    }
  } else {
    // DPoP not enabled, only accept Bearer tokens
    if (tokenType !== "Bearer") {
      const error: AuthErrorPayload = {
        error: INVALID_TOKEN,
        error_description: "Only Bearer token type is supported",
      };
      return { ok: false, error };
    }
  }

  return {
    ok: true,
    payload: {
      tokenState: tokenState.payload,
    },
  };
};

/**
 * Legacy authenticate function for backward compatibility
 * @deprecated Use authenticate with dpopHeader and dpopConfig parameters
 */
export const authenticateLegacy = async <T>(
  authHeader: string,
  accessTokenStateProvider: AccessTokenStateProvider<T>,
): Promise<Result<ValidAccessTokenState<T>, ErrorPayload>> => {
  const result = await authenticate(authHeader, accessTokenStateProvider);
  if (result.ok) {
    return { ok: true, payload: result.payload.tokenState };
  }
  return { ok: false, error: result.error };
};
