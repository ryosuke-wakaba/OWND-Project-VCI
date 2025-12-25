import authStore, {
  StoredAccessToken,
} from "ownd-vci-common/dist/store/authStore.js";
import {
  CredentialIssuerConfig,
  IssueSdJwtVcCredential,
  DecodedProofJwt,
  CredentialDpopConfig,
} from "ownd-vci/dist/oid4vci/credentialEndpoint/types.js";
import {
  CredentialRequestVcSdJwt,
  IssuerMetadataVcSdJwt,
} from "ownd-vci/dist/oid4vci/types/protocol.types.js";

import learningCredential from "./learningCredential.js";
import { accessTokenStateProvider } from "ownd-vci-common/dist/oid4vci/credentialEndpoint/defaults/accessToken.js";

const issueSdJwtVcCredential: IssueSdJwtVcCredential = async (
  sub: string,
  payload: CredentialRequestVcSdJwt,
  proofOfPossession?: DecodedProofJwt,
) => {
  if (
    !proofOfPossession ||
    !proofOfPossession.jwt ||
    !proofOfPossession.jwt.header ||
    !proofOfPossession.jwt.header.jwk
  ) {
    const error = {
      error: "invalid_or_missing_proof",
    };
    return { ok: false, error };
  }

  const vct = payload.vct;
  console.debug("Credential issuance payload:", JSON.stringify(payload));

  if (vct === "urn:eu.europa.ec.eudi:learning:credential:1") {
    return await learningCredential.issueLearningCredential(
      sub,
      proofOfPossession.jwt.header.jwk,
    );
  } else {
    const error = {
      error: "unsupported_credential_type",
    };
    return { ok: false, error };
  }
};

const issuerMetadata: IssuerMetadataVcSdJwt = {
  credential_issuer: process.env.CREDENTIAL_ISSUER || "",
  credential_endpoint: `${process.env.CREDENTIAL_ISSUER}/credentials`,
  credential_configurations_supported: {
    LearningCredential: {
      format: "dc+sd-jwt",
      scope: "LearningCredential",
      cryptographic_binding_methods_supported: ["jwk"],
      credential_signing_alg_values_supported: ["ES256"],
      proof_types_supported: {
        jwt: {
          proof_signing_alg_values_supported: ["ES256"],
        },
      },
      vct: "urn:eu.europa.ec.eudi:learning:credential:1",
      credential_metadata: {
        issuing_authority: {},
        issuing_country: {},
        date_of_issuance: {},
        family_name: {},
        given_name: {},
        achievement_title: {},
        achievement_description: {},
        learning_outcomes: {},
        assessment_grade: {},
        date_of_expiry: {},
      },
    },
  },
};

const getCNonceWrapper = async (nonce: string) => {
  const result = await authStore.getCNonce(nonce);
  if (!result) return undefined;
  return {
    ...result,
    createdAt: result.createdAt.toString(),
  };
};

/**
 * Check if DPoP is enabled via environment variable
 */
const isDpopEnabled = (): boolean => {
  return process.env.DPOP_ENABLED === "true";
};

/**
 * Get credential endpoint URL from environment
 */
const getCredentialEndpointUrl = (): string => {
  const issuer = process.env.CREDENTIAL_ISSUER || "http://localhost:3001";
  return `${issuer}/credentials`;
};

/**
 * Build DPoP configuration if enabled
 *
 * Note: DPoP nonces are issued only by the Nonce Endpoint per OID4VCI specification.
 * Credential Endpoint validates nonces but does not issue new ones.
 */
const buildDpopConfig = (): CredentialDpopConfig | undefined => {
  if (!isDpopEnabled()) {
    return undefined;
  }

  return {
    enabled: true,
    required: process.env.DPOP_REQUIRED === "true",
    credentialEndpointUrl: getCredentialEndpointUrl(),
    nonceValidator: async (nonce: string) => authStore.validateDpopNonce(nonce),
  };
};

export const configure = (): CredentialIssuerConfig<StoredAccessToken> => {
  const config: CredentialIssuerConfig<StoredAccessToken> = {
    credentialIssuer: process.env.CREDENTIAL_ISSUER || "",
    issuerMetadata: issuerMetadata,
    supportAnonymousAccess: true,
    accessTokenStateProvider: accessTokenStateProvider,
    issuingExecutor: { sdJwtVc: issueSdJwtVcCredential },
    getCNonce: getCNonceWrapper,
  };

  // Add DPoP configuration if enabled
  const dpopConfig = buildDpopConfig();
  if (dpopConfig) {
    config.dpop = dpopConfig;
  }

  return config;
};
