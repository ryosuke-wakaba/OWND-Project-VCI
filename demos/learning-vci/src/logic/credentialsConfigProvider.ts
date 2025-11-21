import { StoredAccessToken } from "ownd-vci-common/dist/store/authStore.js";
import {
  CredentialIssuerConfig,
  IssueSdJwtVcCredential,
  DecodedProofJwt,
} from "ownd-vci/dist/oid4vci/credentialEndpoint/types.js";
import {
  CredentialRequestVcSdJwt,
  IssuerMetadataVcSdJwt,
} from "ownd-vci/dist/oid4vci/types/protocol.types.js";

import learningCredential from "./learningCredential.js";
import { accessTokenStateProvider } from "ownd-vci-common/dist/oid4vci/credentialEndpoint/defaults/accessToken.js";
import authStore from "ownd-vci-common/dist/store/authStore.js";

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

export const configure = (): CredentialIssuerConfig<StoredAccessToken> => {
  return {
    credentialIssuer: process.env.CREDENTIAL_ISSUER || "",
    issuerMetadata: issuerMetadata,
    supportAnonymousAccess: true,
    accessTokenStateProvider: accessTokenStateProvider,
    issuingExecutor: { sdJwtVc: issueSdJwtVcCredential },
    getCNonce: getCNonceWrapper,
  };
};
