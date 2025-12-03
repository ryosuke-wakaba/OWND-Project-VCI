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
  // sub is the learner ID (e.g., "4")
  const learnerId = sub;

  // 暫定対応: 学習者の最新のauth_codeに紐づくsigningKeyKidを取得
  const signingKeyKid = await store.getLatestSigningKeyKidForLearner(learnerId);

  const learner = await store.getLearnerById(learnerId);
  if (!learner) {
    return { ok: false, error: { error: "NotFound" } };
  }

  // Get signing key: specified key or latest key
  let keyPair;
  let x509cert: string | null = null;

  if (signingKeyKid) {
    keyPair = await keyStore.getEcKeyPair(signingKeyKid);
    if (keyPair) {
      const x509Chain = await keyStore.getX509Chain(signingKeyKid);
      if (x509Chain && x509Chain.length > 0) {
        x509cert = JSON.stringify(x509Chain);
      }
    }
  } else {
    const latestKeyPair = await keyStore.getLatestKeyPair();
    if (latestKeyPair) {
      keyPair = latestKeyPair;
      x509cert = latestKeyPair.x509cert || null;
    }
  }

  if (!keyPair) {
    const error = { status: 500, error: "No keypair exists" };
    return { ok: false, error };
  }

  // Check if key is revoked
  if (keyPair.revokedAt) {
    const error = { status: 500, error: "Signing key is revoked" };
    return { ok: false, error };
  }

  // Parse x5c if available, otherwise use empty array for jwk mode
  // Only include leaf certificate in x5c (first element of chain) for credential issuance
  const certChain: string[] = x509cert ? JSON.parse(x509cert) : [];
  const x5c: string[] = certChain.length > 0 ? [certChain[0]] : [];

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

  // Issue credential with x5c (if available) or jwk mode (if no certificate)
  const credential = await issueFlatCredential(claims, issuerJwk, x5c);

  // Log SD-JWT header for verification
  const headerBase64 = credential.split(".")[0];
  const header = JSON.parse(Buffer.from(headerBase64, "base64url").toString());
  console.log("SD-JWT Header:", JSON.stringify(header));
  console.log(
    "Signing mode:",
    x5c.length > 0 ? "x5c (certificate)" : "jwk (public key)",
  );

  return { ok: true, payload: credential };
};

export default {
  issueLearningCredential,
};
