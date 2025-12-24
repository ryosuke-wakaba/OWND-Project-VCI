import { IssueResult, NonceIssuerConfig, NonceIssueResponse } from "./types.js";

export class NonceIssuer {
  // eslint-disable-next-line no-unused-vars
  constructor(private config: NonceIssuerConfig) {}

  async issue(): Promise<IssueResult> {
    const nonceResponse = await this.config.nonceIssuer();
    if (nonceResponse.ok) {
      const response: NonceIssueResponse = {
        payload: nonceResponse.payload,
      };

      // Add DPoP-Nonce header if provider is configured
      if (this.config.dpopNonceProvider) {
        const dpopNonce = await this.config.dpopNonceProvider();
        response.headers = {
          "DPoP-Nonce": dpopNonce,
        };
      }

      return { ok: true, payload: response };
    } else {
      const { ok, error } = nonceResponse;
      if (error.internalError) {
        return { ok, error: { status: 500, payload: error } };
      } else {
        return { ok, error: { status: 400, payload: error } };
      }
    }
  }
}
