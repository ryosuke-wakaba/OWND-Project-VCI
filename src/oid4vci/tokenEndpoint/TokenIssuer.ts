import { HttpRequest } from "../types/types.js";
import {
  IssueResult,
  TokenIssuerConfig,
  TokenIssuanceContext,
} from "./types.js";
import validate from "./validate.js";
import {
  validateDpopProof,
  hasDpopHeader,
  DpopValidationResult,
} from "../dpop/index.js";

export class TokenIssuer {
  // eslint-disable-next-line no-unused-vars
  constructor(private config: TokenIssuerConfig) {}

  async issue(request: HttpRequest): Promise<IssueResult> {
    // DPoP Proof validation (if enabled)
    let dpopResult: DpopValidationResult | undefined;
    const context: TokenIssuanceContext = {};

    if (this.config.dpop?.enabled) {
      const dpopHeader = request.getHeader("DPoP");
      const hasDpop = hasDpopHeader(dpopHeader);

      // Check if DPoP is required but not provided
      if (this.config.dpop.required && !hasDpop) {
        return {
          ok: false,
          error: {
            status: 400,
            payload: {
              error: "invalid_dpop_proof",
              error_description: "DPoP proof is required",
            },
          },
        };
      }

      // Validate DPoP proof if provided
      if (hasDpop) {
        if (!this.config.tokenEndpointUrl) {
          console.error("tokenEndpointUrl is required when DPoP is enabled");
          return {
            ok: false,
            error: {
              status: 500,
              payload: {
                error: "server_error",
                error_description: "DPoP configuration error",
              },
            },
          };
        }

        // Token Endpoint does not require nonce validation
        // (nonce is only used for Credential Endpoint requests)
        dpopResult = await validateDpopProof(dpopHeader, {
          httpMethod: "POST",
          httpUri: this.config.tokenEndpointUrl,
          allowedAlgorithms: this.config.dpop.allowedAlgorithms,
          iatToleranceSeconds: this.config.dpop.iatToleranceSeconds,
        });

        if (!dpopResult.valid) {
          return {
            ok: false,
            error: {
              status: 400,
              payload: {
                error: "invalid_dpop_proof",
                error_description: dpopResult.errorDescription,
              },
            },
          };
        }

        // Set DPoP thumbprint in context for token binding
        context.dpopJkt = dpopResult.thumbprint;
      }
    }

    // Validate pre-authorized code
    const validateResult = await validate(
      request,
      this.config.authCodeStateProvider,
    );
    if (!validateResult.ok) {
      const { ok, error } = validateResult;
      return { ok, error: { status: 400, payload: error } };
    }

    // Issue access token with context (including DPoP binding if applicable)
    const { authorizedCode } = validateResult.payload;
    const accessToken = await this.config.accessTokenIssuer(
      authorizedCode,
      context,
    );

    if (accessToken.ok) {
      const response = { ...accessToken.payload };

      // Set token_type based on DPoP
      if (context.dpopJkt) {
        response.token_type = "DPoP";
      }

      return { ok: true, payload: response };
    } else {
      const { ok, error } = accessToken;
      if (error.internalError) {
        return { ok, error: { status: 500, payload: error } };
      } else {
        return { ok, error: { status: 400, payload: error } };
      }
    }
  }
}
