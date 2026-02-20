import * as jose from "jose";
import { PrivateJwk } from "elliptic-jwk";

import store from "../store.js";
import keyStore from "ownd-vci-common/dist/store/keyStore.js";
import { issueCredentialCore } from "@ownd-project/ts-toolbox";
import { DisclosureFrame } from "@meeco/sd-jwt";
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

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60 * 60 * 24 * 365; // 1 year
  const vct = "urn:eu.europa.ec.eudi:learning:credential:1";

  const {
    credentialIssuer,
    learnerNo,
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
    languageOfClasses,
    expectedStudyTime,
    levelOfLearningExperience,
    typesOfQualityAssurance,
    prerequisitesToEnroll,
    integrationStackabilityOptions,
  } = learner;

  // issクレームは学習者登録時に入力されたcredentialIssuerを使用
  const iss = credentialIssuer;

  // Parse learning outcomes from JSON string if exists
  let parsedLearningOutcomes: string[] | undefined;
  if (learningOutcomes) {
    try {
      parsedLearningOutcomes = JSON.parse(learningOutcomes);
    } catch {
      parsedLearningOutcomes = undefined;
    }
  }

  // Parse language_of_classes from JSON string
  let parsedLanguageOfClasses: string[] = ["ja"];
  if (languageOfClasses) {
    try {
      parsedLanguageOfClasses = JSON.parse(languageOfClasses);
    } catch {
      parsedLanguageOfClasses = ["ja"];
    }
  }

  // Parse types_of_quality_assurance from JSON string
  let parsedTypesOfQualityAssurance: string[] = [];
  if (typesOfQualityAssurance) {
    try {
      parsedTypesOfQualityAssurance = JSON.parse(typesOfQualityAssurance);
    } catch {
      parsedTypesOfQualityAssurance = [];
    }
  }

  // Parse prerequisites_to_enroll from JSON string if exists
  let parsedPrerequisitesToEnroll: string[] | undefined;
  if (prerequisitesToEnroll) {
    try {
      parsedPrerequisitesToEnroll = JSON.parse(prerequisitesToEnroll);
    } catch {
      parsedPrerequisitesToEnroll = undefined;
    }
  }

  const claims: Record<string, unknown> = {
    // Required fields
    issuing_authority: issuingAuthority,
    issuing_country: issuingCountry,
    date_of_issuance: dateOfIssuance,
    family_name: familyName,
    achievement_title: achievementTitle,
    // v1.02 新規必須フィールド
    language_of_classes: parsedLanguageOfClasses,
    learner_identification: learnerNo,
    expected_study_time: expectedStudyTime || "",
    level_of_learning_experience: levelOfLearningExperience || 1,
    types_of_quality_assurance: parsedTypesOfQualityAssurance,
    // Optional fields - 値がある場合のみ含める
    // SD: Always
    ...(givenName && { given_name: givenName }),
    ...(parsedLearningOutcomes && {
      learning_outcomes: parsedLearningOutcomes,
    }),
    ...(assessmentGrade && { assessment_grade: assessmentGrade }),
    ...(parsedPrerequisitesToEnroll && {
      prerequisites_to_enroll: parsedPrerequisitesToEnroll,
    }),
    ...(integrationStackabilityOptions !== undefined &&
      integrationStackabilityOptions !== null && {
        integration_stackability_options: integrationStackabilityOptions,
      }),
    // SD: Never
    ...(dateOfExpiry && { date_of_expiry: dateOfExpiry }),
    ...(achievementDescription && {
      achievement_description: achievementDescription,
    }),
    // Standard claims
    cnf: { jwk },
    vct,
    iss,
    iat,
    exp,
  };

  // SD: Always のクレームのみをselective disclosureに
  // SD: Never のクレームはJWTペイロードに直接含める
  // 参照: docs/demos/learning-vci.md, SD-JWT Draft-22, EUDI-Wallet-NiScy v1.02
  const selectivelyDisclosableClaims = [
    "family_name",
    "given_name",
    "learning_outcomes",
    "assessment_grade",
    // v1.02 新規追加
    "learner_identification",
    "expected_study_time",
    "level_of_learning_experience",
    "types_of_quality_assurance",
    "prerequisites_to_enroll",
    "integration_stackability_options",
  ];
  const disclosureFrame: DisclosureFrame = {
    _sd: selectivelyDisclosableClaims.filter(
      (name) => name in claims,
    ) as string[],
  };

  // Log claims for verification
  console.log("SD-JWT Claims:", JSON.stringify(claims, null, 2));
  console.log("Claims keys:", Object.keys(claims));

  // Issue credential with x5c (if available) or jwk mode (if no certificate)
  const credential = await issueCredentialCore(
    claims,
    disclosureFrame,
    issuerJwk,
    x5c,
  );

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
