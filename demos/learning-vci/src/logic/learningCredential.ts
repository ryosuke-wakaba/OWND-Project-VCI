import * as jose from "jose";
import { PrivateJwk } from "elliptic-jwk";

import store from "../store.js";
import keyStore from "ownd-vci-common/dist/store/keyStore.js";
import { issueFlatCredential } from "@ownd-project/ts-toolbox";
import { ErrorPayload, Result } from "ownd-vci/dist/types.js";

const issueLearningCredential = async (
  sub: string,
  jwk: jose.JWK,
): Promise<Result<string, ErrorPayload>> => {
  const learner = await store.getLearnerById(sub);
  if (!learner) {
    return { ok: false, error: { error: "NotFound" } };
  }

  const keyPair = await keyStore.getLatestKeyPair();
  if (keyPair) {
    const { x509cert } = keyPair;
    if (!x509cert) {
      const error = { status: 500, error: "No X.509 certificate registered for key" };
      return { ok: false, error };
    }
    const x5c: string[] = JSON.parse(x509cert);

    const privateJwk = keyPair as unknown as PrivateJwk;
    const issuerJwk: PrivateJwk = {
      kty: privateJwk.kty,
      crv: privateJwk.crv,
      x: privateJwk.x,
      y: privateJwk.y,
      d: privateJwk.d,
    };

    const iss = process.env.CREDENTIAL_ISSUER_IDENTIFIER;
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 60 * 60 * 24 * 365; // 1 year
    const vct = "urn:eu.europa.ec.eudi:learning:credential:1";

    const {
      givenName,
      familyName,
      issuingAuthority,
      issuingCountry,
      achievementTitle,
      achievementDescription,
      learningOutcomes,
      assessmentGrade,
      dateOfIssuance,
      dateOfExpiry,
    } = learner;

    // Parse learning outcomes from JSON string if exists
    let parsedLearningOutcomes: string[] | undefined;
    if (learningOutcomes) {
      try {
        parsedLearningOutcomes = JSON.parse(learningOutcomes);
      } catch {
        parsedLearningOutcomes = undefined;
      }
    }

    const claims: Record<string, unknown> = {
      // Required fields
      issuing_authority: issuingAuthority,
      issuing_country: issuingCountry,
      date_of_issuance: dateOfIssuance,
      family_name: familyName,
      given_name: givenName,
      achievement_title: achievementTitle,
      // Optional fields
      ...(achievementDescription && {
        achievement_description: achievementDescription,
      }),
      ...(parsedLearningOutcomes && {
        learning_outcomes: parsedLearningOutcomes,
      }),
      ...(assessmentGrade && { assessment_grade: assessmentGrade }),
      ...(dateOfExpiry && { date_of_expiry: dateOfExpiry }),
      // Standard claims
      cnf: { jwk },
      vct,
      iss,
      iat,
      exp,
    };

    const credential = await issueFlatCredential(claims, issuerJwk, x5c);
    return { ok: true, payload: credential };
  } else {
    const error = { status: 500, error: "No keypair exists" };
    return { ok: false, error };
  }
};

export default {
  issueLearningCredential,
};
