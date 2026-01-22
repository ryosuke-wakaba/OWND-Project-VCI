import { ErrorPayload, ErrorResponse, Result } from "../../types.js";
import { TokenResponse } from "../types/protocol.types.js";
import { Exists, NotExists, AuthorizedCode } from "../types/types.js";
import { X5cChainValidator } from "../clientAuthentication/types.js";

/**
 * DPoP configuration for Token Endpoint
 * Note: Token Endpoint does not issue nonces per OID4VCI spec.
 * Nonces are issued by the Nonce Endpoint.
 */
export interface DpopConfig {
  /** Enable DPoP support */
  enabled: boolean;
  /** Require DPoP for all token requests (default: false) */
  required?: boolean;
  /** Allowed signature algorithms */
  allowedAlgorithms?: string[];
  /** Tolerance for iat claim in seconds (default: 300) */
  iatToleranceSeconds?: number;
}

/**
 * Client Authentication configuration for Token Endpoint
 * OAuth 2.0 Attestation-Based Client Authentication
 */
export interface ClientAuthenticationConfig {
  /** Enable Client Authentication support */
  enabled: boolean;
  /** Credential Issuer URL for audience validation in PoP JWT */
  issuerAudience: string;
  /** Allowed signature algorithms (default: ES256, ES384, ES512) */
  allowedAlgorithms?: string[];
  /** Tolerance for iat claim in seconds (default: 300) */
  iatToleranceSeconds?: number;
  /** Custom x5c certificate chain validator */
  x5cValidator?: X5cChainValidator;
  /** JTI validator for replay detection */
  jtiValidator?: (jti: string) => Promise<boolean>;
}

export interface TokenIssuerConfig {
  authCodeStateProvider: AuthCodeStateProvider;
  accessTokenIssuer: AccessTokenIssuer;
  /** DPoP configuration (optional) */
  dpop?: DpopConfig;
  /** Client Authentication configuration (optional) */
  clientAuthentication?: ClientAuthenticationConfig;
  /** HTTP URI for htu validation (required when dpop is enabled) */
  tokenEndpointUrl?: string;
}

export type IssueResult = Result<TokenResponse, ErrorResponse>;

export type AuthorizedCodeWithStoredData = AuthorizedCode & {
  storedData?: any;
};

/**
 * Context for token issuance (DPoP binding, etc.)
 */
export interface TokenIssuanceContext {
  /** DPoP JWK Thumbprint (jkt) - set when DPoP proof is valid */
  dpopJkt?: string;
}

export interface PayloadAtExists {
  authorizedCode: AuthorizedCodeWithStoredData;
}

/* eslint-disable no-unused-vars */
/**
 * AuthCodeStateProvider is a function that provides the issued `authorized_code` and its status.
 *
 * @param authorizedCode - The issued `code` or `pre-authorized_code`.
 * @returns Promise<NotExists | (Exists<PayloadAtExists<T>>)> -
 *           Returns a promise that resolves to NotExists if the code does not exist, or Exists if it does.
 *           In the case of Exists, the payload includes the AuthorizedCode.
 *
 * This function asynchronously provides the status of the specified authorized code.
 * If the code does not exist in the database or cache, it returns an object with { exists: false }.
 * If the code exists and is valid, it returns an object with { exists: true, payload: { ... } },
 * where the payload contains information about the authorized code.
 *
 * This type definition uses generics, allowing the authorizedEntity to be of any type T.
 * This provides a reusable validation function for different types of entities.
 */
export type AuthCodeStateProvider = (
  authorizedCode: string,
) => Promise<NotExists | Exists<PayloadAtExists>>;

/**
 * AccessTokenIssuer is a function that takes the information of a pre-authorized code and issues an access token.
 *
 * @param preAuthorizedCode - The pre-authorized code used to issue the access token.
 * @param context - Optional context for token issuance (DPoP binding, etc.)
 * @returns Promise<Result<TokenResponse, ErrorPayload>> -
 *           A promise that returns a TokenResponse upon successful token issuance,
 *           or a Result containing an ErrorPayload if the issuance fails.
 *
 * This function asynchronously issues an access token using the specified pre-authorized code.
 * If the issuance process is successful, a TokenResponse containing the token information is returned.
 * If the issuance fails for any reason, an ErrorPayload containing details of the error is returned.
 */
export type AccessTokenIssuer = (
  authorizedCode: AuthorizedCodeWithStoredData,
  context?: TokenIssuanceContext,
) => Promise<Result<TokenResponse, ErrorPayload>>;
/* eslint-enable no-unused-vars */
