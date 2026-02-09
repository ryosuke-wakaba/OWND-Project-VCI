import { createRequire } from "module";
const require = createRequire(import.meta.url);
const setupTestEnv = require("../test-env-setup.cjs");
setupTestEnv();

import { assert } from "chai";
import request from "supertest";
import * as jose from "jose";
import ellipticJwk, { newPrivateJwk, publicJwkFromPrivate } from "elliptic-jwk";
import { decodeDisclosure } from "@meeco/sd-jwt";

import {
  generateRandomString,
  generateRandomNumericString,
} from "ownd-vci/dist/utils/randomStringUtils.js";
import keyStore from "ownd-vci-common/dist/store/keyStore.js";
import authStore from "ownd-vci-common/dist/store/authStore.js";

import { init } from "../src/app.js";
import store, { NewLearner } from "../src/store.js";

// Test data for v1.02 fields
const testLearner: NewLearner = {
  learnerNo: "L001",
  familyName: "山田",
  givenName: "太郎",
  issuingAuthority: "テスト教育機関",
  issuingCountry: "JP",
  achievementTitle: "AI基礎講座",
  achievementDescription: "人工知能の基礎を学ぶ講座",
  learningOutcomes: '["機械学習の基礎理解","Pythonプログラミング"]',
  assessmentGrade: "A",
  dateOfIssuance: "2024-01-15",
  dateOfExpiry: "2025-01-15",
  // v1.02 新規フィールド
  languageOfClasses: '["ja","en"]',
  expectedStudyTime: "40時間",
  levelOfLearningExperience: 5,
  typesOfQualityAssurance: '["機関認証","プログラム認定"]',
  prerequisitesToEnroll: '["Python基礎","数学基礎"]',
  integrationStackabilityOptions: true,
};

let app: any;

describe("Learning VCI - Store Operations", () => {
  beforeEach(async () => {
    await store.destroyDb();
    await store.createDb();
  });

  describe("Learner CRUD with v1.02 fields", () => {
    it("should register and retrieve learner with all v1.02 fields", async () => {
      await store.registerLearner(testLearner);

      const retrieved = await store.getLearnerByNo("L001");
      assert.isNotNull(retrieved);

      // 既存フィールド
      assert.equal(retrieved!.learnerNo, testLearner.learnerNo);
      assert.equal(retrieved!.familyName, testLearner.familyName);
      assert.equal(retrieved!.givenName, testLearner.givenName);

      // v1.02 新規フィールド
      assert.equal(retrieved!.languageOfClasses, testLearner.languageOfClasses);
      assert.equal(retrieved!.expectedStudyTime, testLearner.expectedStudyTime);
      assert.equal(
        retrieved!.levelOfLearningExperience,
        testLearner.levelOfLearningExperience,
      );
      assert.equal(
        retrieved!.typesOfQualityAssurance,
        testLearner.typesOfQualityAssurance,
      );
      assert.equal(
        retrieved!.prerequisitesToEnroll,
        testLearner.prerequisitesToEnroll,
      );
      // SQLite stores boolean as 0/1, check truthiness
      assert.isTrue(!!retrieved!.integrationStackabilityOptions);
    });

    it("should update learner with v1.02 fields", async () => {
      await store.registerLearner(testLearner);
      const learner = await store.getLearnerByNo("L001");

      const updatedData: NewLearner = {
        ...testLearner,
        expectedStudyTime: "80時間",
        levelOfLearningExperience: 6,
        integrationStackabilityOptions: false,
      };

      await store.updateLearner(learner!.id, updatedData);

      const updated = await store.getLearnerById(learner!.id);
      assert.equal(updated!.expectedStudyTime, "80時間");
      assert.equal(updated!.levelOfLearningExperience, 6);
      // SQLite stores boolean as 0/1, check falsiness
      assert.isFalse(!!updated!.integrationStackabilityOptions);
    });

    it("should handle optional givenName (v1.02 change: M→O)", async () => {
      const learnerWithoutGivenName: NewLearner = {
        ...testLearner,
        givenName: undefined,
      };

      await store.registerLearner(learnerWithoutGivenName);

      const retrieved = await store.getLearnerByNo("L001");
      assert.isNotNull(retrieved);
      assert.isNull(retrieved!.givenName);
    });
  });
});

const privateJwk = ellipticJwk.newPrivateJwk("P-256");
// @ts-ignore
const privateKey = await jose.importJWK(privateJwk, "ES256");
const jwk = publicJwkFromPrivate(privateJwk);

const validAccessTokenMock = async () => {
  const learner = await store.getLearnerByNo("L001");
  const id = await store.addPreAuthCode(
    "dummy code",
    30,
    "dummy-user-pin",
    String(learner!.id),
  );
  const accessToken = "validToken";
  const expiresIn = 86400;
  await store.addAccessToken(accessToken, expiresIn, id!);
  await authStore.addCNonce("randomNonce", 86400);
};

describe("Learning VCI - Credential Issuance", () => {
  beforeEach(async () => {
    app = await init();
    await store.destroyDb();
    await store.createDb();
    await store.registerLearner(testLearner);
  });

  describe("POST /credentials - v1.02 claims", () => {
    it("should issue credential with all v1.02 claims", async () => {
      const signingJwk = newPrivateJwk("P-256");
      const { kty, crv, x, y, d } = signingJwk;
      await keyStore.insertECKeyPair({
        kid: "key-1",
        kty,
        crv,
        x,
        y: y || "",
        d,
      } as any);

      const payload = { nonce: "randomNonce" };
      const token = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: "ES256", typ: "openid4vci-proof+jwt", jwk })
        .setIssuedAt()
        .setAudience(process.env.CREDENTIAL_ISSUER || "")
        .setExpirationTime("2h")
        .sign(privateKey);

      await validAccessTokenMock();

      const response = await request(app.callback())
        .post("/credentials")
        .set("Authorization", "BEARER validToken")
        .send({
          credential_configuration_id: "LearningCredential",
          proofs: { jwt: [token] },
        });

      assert.equal(response.status, 200);
      assert.isString(response.body.credential);

      // SD-JWT の disclosure を解析
      const parts = response.body.credential.split("~");
      const disclosures = decodeDisclosure(parts.slice(1, parts.length - 1));

      console.log("==================================");
      console.log("Disclosures:", disclosures);

      // v1.02 新規必須フィールドの確認
      const disclosureMap = new Map(disclosures.map((d) => [d.key, d.value]));

      // SD: Always のクレーム（選択的開示）
      assert.equal(disclosureMap.get("family_name"), "山田");
      assert.equal(disclosureMap.get("given_name"), "太郎");
      assert.equal(disclosureMap.get("learner_identification"), "L001");
      assert.equal(disclosureMap.get("expected_study_time"), "40時間");
      assert.equal(disclosureMap.get("level_of_learning_experience"), 5);

      // 配列フィールド
      const learningOutcomes = disclosureMap.get("learning_outcomes");
      assert.isArray(learningOutcomes);
      assert.include(learningOutcomes, "機械学習の基礎理解");

      const typesOfQa = disclosureMap.get("types_of_quality_assurance");
      assert.isArray(typesOfQa);
      assert.include(typesOfQa, "機関認証");

      const prereqs = disclosureMap.get("prerequisites_to_enroll");
      assert.isArray(prereqs);
      assert.include(prereqs, "Python基礎");

      assert.equal(
        disclosureMap.get("integration_stackability_options"),
        true,
      );
    });

    it("should issue credential without optional given_name", async () => {
      // given_name なしの学習者を登録
      await store.destroyDb();
      await store.createDb();

      const learnerWithoutGivenName: NewLearner = {
        ...testLearner,
        learnerNo: "L002",
        givenName: undefined,
      };
      await store.registerLearner(learnerWithoutGivenName);

      const signingJwk = newPrivateJwk("P-256");
      const { kty, crv, x, y, d } = signingJwk;
      await keyStore.insertECKeyPair({
        kid: "key-1",
        kty,
        crv,
        x,
        y: y || "",
        d,
      } as any);

      const learner = await store.getLearnerByNo("L002");
      const id = await store.addPreAuthCode(
        "dummy code2",
        30,
        "pin2",
        String(learner!.id),
      );
      await store.addAccessToken("validToken2", 86400, id!);
      await authStore.addCNonce("randomNonce2", 86400);

      const payload = { nonce: "randomNonce2" };
      const token = await new jose.SignJWT(payload)
        .setProtectedHeader({ alg: "ES256", typ: "openid4vci-proof+jwt", jwk })
        .setIssuedAt()
        .setAudience(process.env.CREDENTIAL_ISSUER || "")
        .setExpirationTime("2h")
        .sign(privateKey);

      const response = await request(app.callback())
        .post("/credentials")
        .set("Authorization", "BEARER validToken2")
        .send({
          credential_configuration_id: "LearningCredential",
          proofs: { jwt: [token] },
        });

      assert.equal(response.status, 200);

      // given_name が disclosure に含まれていないことを確認
      const parts = response.body.credential.split("~");
      const disclosures = decodeDisclosure(parts.slice(1, parts.length - 1));
      const disclosureMap = new Map(disclosures.map((d) => [d.key, d.value]));

      assert.isFalse(disclosureMap.has("given_name"));
      assert.equal(disclosureMap.get("family_name"), "山田");
    });
  });
});

describe("Learning VCI - Metadata Endpoint", () => {
  beforeEach(async () => {
    app = await init();
    await store.destroyDb();
    await store.createDb();
  });

  describe("GET /.well-known/openid-credential-issuer", () => {
    it("should return 200 with issuer metadata", async () => {
      const response = await request(app.callback()).get(
        "/.well-known/openid-credential-issuer",
      );

      assert.equal(response.status, 200);
      assert.equal(response.type, "application/json");
    });

    it("should include LearningCredential configuration", async () => {
      const response = await request(app.callback()).get(
        "/.well-known/openid-credential-issuer",
      );

      const configs = response.body.credential_configurations_supported;
      assert.property(configs, "LearningCredential");

      const learningConfig = configs.LearningCredential;
      assert.equal(learningConfig.format, "dc+sd-jwt");
      assert.equal(
        learningConfig.vct,
        "urn:eu.europa.ec.eudi:learning:credential:1",
      );
    });

    it("should include v1.02 claim definitions in credential_metadata", async () => {
      const response = await request(app.callback()).get(
        "/.well-known/openid-credential-issuer",
      );

      const learningConfig =
        response.body.credential_configurations_supported.LearningCredential;
      const credentialMetadata = learningConfig.credential_metadata;

      // 既存フィールド
      assert.property(credentialMetadata, "family_name");
      assert.property(credentialMetadata, "given_name");
      assert.property(credentialMetadata, "issuing_authority");
      assert.property(credentialMetadata, "issuing_country");
      assert.property(credentialMetadata, "date_of_issuance");
      assert.property(credentialMetadata, "achievement_title");

      // v1.02 新規フィールド
      assert.property(credentialMetadata, "language_of_classes");
      assert.property(credentialMetadata, "learner_identification");
      assert.property(credentialMetadata, "expected_study_time");
      assert.property(credentialMetadata, "level_of_learning_experience");
      assert.property(credentialMetadata, "types_of_quality_assurance");
      assert.property(credentialMetadata, "prerequisites_to_enroll");
      assert.property(credentialMetadata, "integration_stackability_options");
    });

    it("should include display names for v1.02 claims", async () => {
      const response = await request(app.callback()).get(
        "/.well-known/openid-credential-issuer",
      );

      const credentialMetadata =
        response.body.credential_configurations_supported.LearningCredential
          .credential_metadata;

      // language_of_classes の display を確認
      const langClasses = credentialMetadata.language_of_classes;
      assert.isArray(langClasses.display);
      assert.isAtLeast(langClasses.display.length, 1);

      // learner_identification の display を確認
      const learnerId = credentialMetadata.learner_identification;
      assert.isArray(learnerId.display);
      assert.isAtLeast(learnerId.display.length, 1);
    });
  });

  describe("GET /.well-known/oauth-authorization-server", () => {
    it("should return 200 with authorization server metadata", async () => {
      const response = await request(app.callback()).get(
        "/.well-known/oauth-authorization-server",
      );

      assert.equal(response.status, 200);
      assert.equal(response.type, "application/json");
    });

    it("should include required OAuth 2.0 fields", async () => {
      const response = await request(app.callback()).get(
        "/.well-known/oauth-authorization-server",
      );

      assert.property(response.body, "issuer");
      assert.property(response.body, "token_endpoint");
      assert.property(response.body, "grant_types_supported");
    });
  });
});

describe("Learning VCI - Token Endpoint", () => {
  beforeEach(async () => {
    app = await init();
    await store.destroyDb();
    await store.createDb();
    await store.registerLearner(testLearner);
  });

  it("should return 400 when request body is missing", async () => {
    const response = await request(app.callback()).post("/token");
    assert.equal(response.status, 400);
    assert.equal(response.body.error, "invalid_request");
  });

  it("should return 200 and access token when correct pre-authorized_code is provided", async () => {
    const learner = await store.getLearnerByNo("L001");
    const preAuthorizedCode = generateRandomString();
    const txCode = generateRandomNumericString();
    await store.addPreAuthCode(
      preAuthorizedCode,
      86400,
      txCode,
      String(learner?.id!),
    );

    const response = await request(app.callback()).post("/token").send({
      grant_type: "urn:ietf:params:oauth:grant-type:pre-authorized_code",
      "pre-authorized_code": preAuthorizedCode,
      tx_code: txCode,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.token_type.toLowerCase(), "bearer");
    assert.property(response.body, "access_token");
    assert.property(response.body, "expires_in");
  });
});
