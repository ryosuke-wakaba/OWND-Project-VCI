import Koa from "koa";

import { Result } from "ownd-vci/dist/types.js";
import {
  handleNotSuccessResult,
  NotSuccessResult,
} from "ownd-vci-common/dist/routes/common.js";
import {
  generateRandomNumericString,
  generateRandomString,
} from "ownd-vci/dist/utils/randomStringUtils.js";
import { generatePreAuthCredentialOffer } from "ownd-vci/dist/oid4vci/CredentialOffer.js";
import keys, {
  appendCertificateChain,
  removeParentCertificates,
  removeCertificateAtIndex,
} from "ownd-vci-common/dist/keys.js";
import keyStore from "ownd-vci-common/dist/store/keyStore.js";
import authStore from "ownd-vci-common/dist/store/authStore.js";
import signedMetadata from "ownd-vci-common/dist/signedMetadata.js";
import {
  getCertificatesInfo,
  CERT_PEM_PREAMBLE,
  CERT_PEM_POSTAMBLE,
} from "@ownd-project/ts-toolbox";

import store, { NewLearner } from "../../store.js";
import { MetadataRepository } from "../../metadata/MetadataRepository.js";

export async function handleNewLearner(ctx: Koa.Context) {
  if (!ctx.request.body) {
    ctx.body = { status: "error", message: "Invalid data received!" };
    ctx.status = 400;
    return;
  }
  const learner = ctx.request.body.learner;

  const result = await registerLearner(learner);
  if (result.ok) {
    const acceptsHtml = ctx.request.headers.accept?.includes("text/html");
    if (acceptsHtml) {
      ctx.redirect("/admin/learners");
    } else {
      ctx.body = result.payload;
      ctx.status = 201;
    }
  } else {
    handleNotSuccessResult(result.error, ctx);
  }
}

export async function handleLearnerCredentialOffer(ctx: Koa.Context) {
  const { learnerNo } = ctx.params;
  const result = await credentialOfferForLearner(learnerNo);
  if (result.ok) {
    ctx.body = result.payload;
    ctx.status = 201;
  } else {
    handleNotSuccessResult(result.error, ctx);
  }
}

const registerLearner = async (
  payload: any,
): Promise<Result<NewLearner, NotSuccessResult>> => {
  try {
    if (typeof payload !== "object" || !payload) {
      return { ok: false, error: { type: "INVALID_PARAMETER" } };
    }

    const {
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
      // v1.02 新規フィールド
      languageOfClasses,
      expectedStudyTime,
      levelOfLearningExperience,
      typesOfQualityAssurance,
      prerequisitesToEnroll,
      integrationStackabilityOptions,
    } = payload;

    // Validate required fields (given_name is optional in v1.02)
    if (
      typeof learnerNo !== "string" ||
      typeof familyName !== "string" ||
      typeof issuingAuthority !== "string" ||
      typeof issuingCountry !== "string" ||
      typeof achievementTitle !== "string" ||
      typeof dateOfIssuance !== "string"
    ) {
      return { ok: false, error: { type: "INVALID_PARAMETER" } };
    }

    // Helper function to convert comma-separated or array fields to JSON array string
    const toJsonArrayString = (
      value: string | string[] | undefined,
    ): string | undefined => {
      if (!value) return undefined;
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      if (trimmed.startsWith("[")) {
        return trimmed;
      }
      const items = trimmed
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      return JSON.stringify(items);
    };

    // Convert comma-separated learning outcomes to JSON array
    const learningOutcomesJson = toJsonArrayString(learningOutcomes);

    // Convert language of classes (checkbox array or comma-separated)
    let languageOfClassesJson = '["ja"]'; // default
    if (languageOfClasses) {
      if (Array.isArray(languageOfClasses)) {
        languageOfClassesJson = JSON.stringify(languageOfClasses);
      } else {
        languageOfClassesJson =
          toJsonArrayString(languageOfClasses) || '["ja"]';
      }
    }

    // Convert types of quality assurance
    const typesOfQualityAssuranceJson =
      toJsonArrayString(typesOfQualityAssurance) || "[]";

    // Convert prerequisites to enroll
    const prerequisitesToEnrollJson = toJsonArrayString(prerequisitesToEnroll);

    // Convert integration stackability options (checkbox)
    let integrationStackabilityOptionsValue: boolean | undefined;
    if (integrationStackabilityOptions !== undefined) {
      integrationStackabilityOptionsValue =
        integrationStackabilityOptions === "true" ||
        integrationStackabilityOptions === true ||
        integrationStackabilityOptions === "on";
    }

    const newLearner: NewLearner = {
      learnerNo,
      givenName,
      familyName,
      issuingAuthority,
      issuingCountry,
      achievementTitle,
      achievementDescription: achievementDescription || undefined,
      learningOutcomes: learningOutcomesJson,
      assessmentGrade: assessmentGrade || undefined,
      dateOfIssuance,
      dateOfExpiry: dateOfExpiry || undefined,
      // v1.02 新規フィールド
      languageOfClasses: languageOfClassesJson,
      expectedStudyTime: expectedStudyTime || "",
      levelOfLearningExperience: parseInt(levelOfLearningExperience, 10) || 1,
      typesOfQualityAssurance: typesOfQualityAssuranceJson,
      prerequisitesToEnroll: prerequisitesToEnrollJson,
      integrationStackabilityOptions: integrationStackabilityOptionsValue,
    };

    await store.registerLearner(newLearner);

    return { ok: true, payload: newLearner };
  } catch (e) {
    console.error(e);
    if (e instanceof Error) {
      return {
        ok: false,
        error: { type: "INTERNAL_ERROR", message: e.message },
      };
    } else {
      return { ok: false, error: { type: "INTERNAL_ERROR", message: "" } };
    }
  }
};

export type GenerateCredentialOfferResult = {
  subject: any;
  credentialOffer: string;
  txCode: string;
  requireClientAuth: boolean;
  requireDpop: boolean;
  authCodeId: number;
};

export type GenerateCredentialOfferOptions = {
  signingKeyKid?: string;
  requireClientAuth?: boolean;
  requireDpop?: boolean;
};

const credentialOfferForLearner = async (
  learnerNo: string,
  options: GenerateCredentialOfferOptions = {},
): Promise<Result<GenerateCredentialOfferResult, NotSuccessResult>> => {
  const { signingKeyKid, requireClientAuth, requireDpop } = options;

  console.log("=== Credential Offer Generation Started ===");
  console.log("Learner No:", learnerNo);
  console.log("Signing Key:", signingKeyKid || "(latest)");
  console.log("Require Client Auth:", requireClientAuth || false);
  console.log("Require DPoP:", requireDpop || false);

  const learner = await store.getLearnerByNo(learnerNo);
  if (!learner) {
    console.log("Learner not found:", learnerNo);
    return { ok: false, error: { type: "NOT_FOUND" } };
  }

  console.log("Learner found:", learner.familyName, learner.givenName);

  const code = generateRandomString();
  const expiresIn = Number(process.env.VCI_PRE_AUTH_CODE_EXPIRES_IN || "86400");
  const txCode = generateRandomNumericString(6);

  console.log("Pre-authorized Code:", code.substring(0, 10) + "...");
  console.log("TX Code:", txCode);
  console.log("Expires in:", expiresIn, "seconds");

  // Store learner ID as sub, signing key kid stored separately in metadata
  const authCodeId = await store.addPreAuthCode(
    code,
    expiresIn,
    txCode,
    String(learner.id),
    signingKeyKid,
    requireClientAuth,
    requireDpop,
  );

  if (!authCodeId) {
    console.log("Failed to create auth code");
    return {
      ok: false,
      error: { type: "INTERNAL_ERROR", message: "Failed to create auth code" },
    };
  }

  const credentialOfferUrl = generatePreAuthCredentialOffer(
    process.env.CREDENTIAL_ISSUER || "",
    ["LearningCredential"],
    code,
    {},
  );

  console.log("Credential Offer URL generated");
  console.log("Auth Code ID:", authCodeId);
  console.log("=== Credential Offer Generation Completed ===\n");

  const payload = {
    subject: { learnerNo },
    credentialOffer: credentialOfferUrl,
    txCode: txCode,
    requireClientAuth: requireClientAuth || false,
    requireDpop: requireDpop || false,
    authCodeId,
  };
  return { ok: true, payload };
};

// Learner Management UI Handlers
export async function handleLearnersList(ctx: Koa.Context) {
  try {
    const learners = await store.getAllLearners();
    await ctx.render("admin/learners", {
      title: "学習者一覧",
      learners,
    });
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to load learners" };
  }
}

export async function handleLearnerNewForm(ctx: Koa.Context) {
  await ctx.render("admin/learner-new", {
    title: "学習者登録",
  });
}

export async function handleLearnerEditForm(ctx: Koa.Context) {
  try {
    const { id } = ctx.params;
    const learner = await store.getLearnerById(Number(id));
    if (!learner) {
      ctx.status = 404;
      ctx.body = { error: "Learner not found" };
      return;
    }
    await ctx.render("admin/learner-edit", {
      title: "学習者編集",
      learner,
    });
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to load learner" };
  }
}

export async function handleLearnerUpdate(ctx: Koa.Context) {
  try {
    const { id } = ctx.params;
    const learner = ctx.request.body.learner;

    if (!learner) {
      ctx.status = 400;
      ctx.body = { error: "Invalid data received" };
      return;
    }

    // Helper function to convert comma-separated or array fields to JSON array string
    const toJsonArrayString = (
      value: string | string[] | undefined,
    ): string | undefined => {
      if (!value) return undefined;
      if (Array.isArray(value)) {
        return JSON.stringify(value);
      }
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      if (trimmed.startsWith("[")) {
        return trimmed;
      }
      const items = trimmed
        .split(",")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
      return JSON.stringify(items);
    };

    // Convert comma-separated learning outcomes to JSON array
    learner.learningOutcomes = toJsonArrayString(learner.learningOutcomes);

    // Convert language of classes (checkbox array or comma-separated)
    if (learner.languageOfClasses) {
      if (Array.isArray(learner.languageOfClasses)) {
        learner.languageOfClasses = JSON.stringify(learner.languageOfClasses);
      } else {
        learner.languageOfClasses =
          toJsonArrayString(learner.languageOfClasses) || '["ja"]';
      }
    } else {
      learner.languageOfClasses = '["ja"]';
    }

    // Convert types of quality assurance
    learner.typesOfQualityAssurance =
      toJsonArrayString(learner.typesOfQualityAssurance) || "[]";

    // Convert prerequisites to enroll
    learner.prerequisitesToEnroll = toJsonArrayString(
      learner.prerequisitesToEnroll,
    );

    // Convert level of learning experience to integer
    if (learner.levelOfLearningExperience) {
      learner.levelOfLearningExperience =
        parseInt(learner.levelOfLearningExperience, 10) || 1;
    } else {
      learner.levelOfLearningExperience = 1;
    }

    // Convert integration stackability options (checkbox)
    if (learner.integrationStackabilityOptions !== undefined) {
      learner.integrationStackabilityOptions =
        learner.integrationStackabilityOptions === "true" ||
        learner.integrationStackabilityOptions === true ||
        learner.integrationStackabilityOptions === "on";
    }

    await store.updateLearner(Number(id), learner);
    ctx.redirect("/admin/learners");
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to update learner" };
  }
}

export async function handleLearnerDelete(ctx: Koa.Context) {
  try {
    const { id } = ctx.params;
    await store.deleteLearner(Number(id));
    ctx.status = 204;
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to delete learner" };
  }
}

export async function handleLearnerCredentialOfferForm(ctx: Koa.Context) {
  try {
    const { learnerNo } = ctx.params;
    const learner = await store.getLearnerByNo(learnerNo);
    if (!learner) {
      ctx.status = 404;
      ctx.body = { error: "Learner not found" };
      return;
    }

    // Get available signing keys
    const keysResult = await keys.getAllKeys();
    const availableKeys = keysResult.ok
      ? keysResult.payload
          .filter((k) => !k.revokedAt)
          .map((k, index) => ({
            ...k,
            isLatest: index === 0, // First (most recent) key
          }))
      : [];

    await ctx.render("admin/learner-offer", {
      title: "クレデンシャル発行準備",
      learner,
      availableKeys,
    });
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to load offer form" };
  }
}

export async function handleLearnerCredentialOfferDisplay(ctx: Koa.Context) {
  try {
    const { learnerNo } = ctx.params;
    const signingKeyKid = ctx.request.body?.signingKeyKid;
    const requireClientAuth = ctx.request.body?.requireClientAuth === "true";
    const requireDpop = ctx.request.body?.requireDpop === "true";

    const result = await credentialOfferForLearner(learnerNo, {
      signingKeyKid,
      requireClientAuth,
      requireDpop,
    });

    if (result.ok) {
      const expiresInSeconds = parseInt(
        process.env.VCI_PRE_AUTH_CODE_EXPIRES_IN || "86400",
        10,
      );
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      await ctx.render("admin/credential-offer", {
        title: "クレデンシャル発行",
        subject: result.payload.subject,
        credentialOffer: result.payload.credentialOffer,
        txCode: result.payload.txCode,
        requireClientAuth: result.payload.requireClientAuth,
        requireDpop: result.payload.requireDpop,
        authCodeId: result.payload.authCodeId,
        expiresAtJST: expiresAt.toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo",
        }),
        expiresAtUTC: expiresAt.toISOString(),
      });
    } else {
      handleNotSuccessResult(result.error, ctx);
    }
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to generate credential offer" };
  }
}

// Key Management UI Handlers
export async function handleKeysList(ctx: Koa.Context) {
  try {
    const result = await keys.getAllKeys();
    if (result.ok) {
      await ctx.render("admin/keys", {
        title: "キーペア一覧",
        keys: result.payload,
      });
    } else {
      ctx.status = 500;
      ctx.body = { error: "Failed to load keys" };
    }
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to load keys" };
  }
}

export async function handleKeyNewForm(ctx: Koa.Context) {
  await ctx.render("admin/key-new", {
    title: "キーペア生成",
  });
}

export async function handleKeyNew(ctx: Koa.Context) {
  if (!ctx.request.body) {
    ctx.body = { status: "error", message: "Invalid data received!" };
    ctx.status = 400;
    return;
  }
  const { kid, curve } = ctx.request.body;
  const result = await keys.genKey(kid, curve || "P-256");
  if (result.ok) {
    ctx.redirect("/admin/keys");
  } else {
    handleNotSuccessResult(result.error, ctx);
  }
}

export async function handleCertDescriptionUpdate(ctx: Koa.Context) {
  try {
    const { kid } = ctx.params;
    const { description } = ctx.request.body;

    await keyStore.updateX509CertificateDescription(kid, description || null);
    ctx.redirect(`/admin/keys/${encodeURIComponent(kid)}/detail`);
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to update description" };
  }
}

export async function handleKeyDetail(ctx: Koa.Context) {
  try {
    const { kid } = ctx.params;
    const keyPair = await keyStore.getEcKeyPair(kid);
    if (!keyPair) {
      ctx.status = 404;
      ctx.body = { error: "Key not found" };
      return;
    }

    const x509Chain = await keyStore.getX509Chain(kid);
    let certInfos: ReturnType<typeof getCertificatesInfo> = [];
    let certDescription: string | undefined;

    if (x509Chain && x509Chain.length > 0) {
      try {
        // Parse all certificates in the chain
        const certPems = x509Chain.map(
          (cert: string) =>
            CERT_PEM_PREAMBLE + "\n" + cert + "\n" + CERT_PEM_POSTAMBLE,
        );
        certInfos = getCertificatesInfo(certPems);
      } catch (e) {
        console.error("Failed to parse certificates:", e);
      }

      // Get certificate description
      const certData = await keyStore.getX509CertificateData(kid);
      certDescription = certData?.description;
    }

    await ctx.render("admin/key-detail", {
      title: "キーペア詳細",
      key: keyPair,
      x509Chain,
      certInfos,
      certDescription,
    });
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to load key detail" };
  }
}

export async function handleKeyCertificateForm(ctx: Koa.Context) {
  try {
    const { kid } = ctx.params;
    const keyPair = await keyStore.getEcKeyPair(kid);
    if (!keyPair) {
      ctx.status = 404;
      ctx.body = { error: "Key not found" };
      return;
    }

    // Get all keys with certificates for issuer selection
    const allKeysResult = await keys.getAllKeys();
    const rootKeys = allKeysResult.ok
      ? allKeysResult.payload.filter((k) => k.hasCertificate && !k.revokedAt)
      : [];

    await ctx.render("admin/key-certificate", {
      title: "証明書発行",
      key: keyPair,
      rootKeys,
    });
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to load certificate form" };
  }
}

export async function handleKeyCertificateIssue(ctx: Koa.Context) {
  try {
    const { kid } = ctx.params;
    const { subject, certType, issuerKid } = ctx.request.body;

    // Generate CSR (use CA extensions for self-signed root certificates)
    const isCA = certType === "self";
    const csrResult = await keys.createCsr(kid, subject, isCA);
    if (!csrResult.ok) {
      handleNotSuccessResult(csrResult.error, ctx);
      return;
    }

    let certResult;
    if (certType === "self") {
      // Self-signed certificate
      certResult = await keys.createSelfCert(kid, csrResult.payload.csr);
    } else {
      // Leaf certificate signed by issuer
      certResult = await keys.signLeafCert({
        csr: csrResult.payload.csr,
        issuerKid,
      });
    }

    if (!certResult.ok) {
      handleNotSuccessResult(certResult.error, ctx);
      return;
    }

    // Register the certificate
    const cert = certResult.payload.cert;
    let certificates = [cert];

    // If leaf cert, include issuer chain
    if (certType === "leaf" && issuerKid) {
      const issuerChain = await keyStore.getX509Chain(issuerKid);
      if (issuerChain && issuerChain.length > 0) {
        certificates = [cert, ...issuerChain];
      }
    }

    const registerResult = await keys.registerCert(kid, certificates);
    if (!registerResult.ok) {
      handleNotSuccessResult(registerResult.error, ctx);
      return;
    }

    ctx.redirect(`/admin/keys/${encodeURIComponent(kid)}/detail`);
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to issue certificate" };
  }
}

export async function handleKeyImportForm(ctx: Koa.Context) {
  await ctx.render("admin/key-import", {
    title: "キーペアインポート",
  });
}

export async function handleKeyImport(ctx: Koa.Context) {
  try {
    if (!ctx.request.body) {
      ctx.body = { status: "error", message: "Invalid data received!" };
      ctx.status = 400;
      return;
    }

    const { kid, privateKeyPem, certificatesPem, certDescription } =
      ctx.request.body;

    // Parse certificates if provided
    let certificates: string[] | undefined;
    if (certificatesPem && certificatesPem.trim()) {
      // Split multiple certificates and extract base64 content
      const certMatches = certificatesPem.match(
        /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
      );
      if (certMatches) {
        certificates = certMatches.map((cert: string) =>
          cert
            .replace(/-----BEGIN CERTIFICATE-----/, "")
            .replace(/-----END CERTIFICATE-----/, "")
            .replace(/\s/g, ""),
        );
      }
    }

    const result = await keys.importKey({
      kid,
      privateKeyPem,
      certificates,
      certDescription: certDescription || undefined,
    });
    if (result.ok) {
      ctx.redirect("/admin/keys");
    } else {
      handleNotSuccessResult(result.error, ctx);
    }
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to import key" };
  }
}

export async function handleAdminIndex(ctx: Koa.Context) {
  await ctx.render("admin/index", {
    title: "管理メニュー",
  });
}

export async function handleAddParentCertForm(ctx: Koa.Context) {
  try {
    const { kid } = ctx.params;
    const keyPair = await keyStore.getEcKeyPair(kid);
    if (!keyPair) {
      ctx.status = 404;
      ctx.body = { error: "Key not found" };
      return;
    }

    const x509Chain = await keyStore.getX509Chain(kid);
    if (!x509Chain || x509Chain.length === 0) {
      ctx.status = 400;
      ctx.body = { error: "No certificate registered for this key" };
      return;
    }

    // Get leaf certificate info
    let leafCertInfo = null;
    try {
      const leafPem =
        CERT_PEM_PREAMBLE + "\n" + x509Chain[0] + "\n" + CERT_PEM_POSTAMBLE;
      const certInfos = getCertificatesInfo([leafPem]);
      if (certInfos.length > 0) {
        leafCertInfo = certInfos[0];
      }
    } catch (e) {
      console.error("Failed to parse leaf certificate:", e);
    }

    await ctx.render("admin/add-parent-cert", {
      title: "上位証明書追加",
      key: keyPair,
      currentChainLength: x509Chain.length,
      leafCertInfo,
    });
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to load form" };
  }
}

export async function handleAddParentCert(ctx: Koa.Context) {
  try {
    const { kid } = ctx.params;
    const { certificatesPem } = ctx.request.body;

    if (!certificatesPem || !certificatesPem.trim()) {
      ctx.status = 400;
      ctx.body = { error: "Certificate is required" };
      return;
    }

    // Parse certificates from PEM
    const certMatches = certificatesPem.match(
      /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
    );
    if (!certMatches || certMatches.length === 0) {
      ctx.status = 400;
      ctx.body = { error: "No valid certificates found in input" };
      return;
    }

    // Extract base64 content from each certificate
    const certificates = certMatches.map((cert: string) =>
      cert
        .replace(/-----BEGIN CERTIFICATE-----/, "")
        .replace(/-----END CERTIFICATE-----/, "")
        .replace(/\s/g, ""),
    );

    const result = await appendCertificateChain({ kid, certificates });
    if (result.ok) {
      ctx.redirect(`/admin/keys/${encodeURIComponent(kid)}/detail`);
    } else {
      handleNotSuccessResult(result.error, ctx);
    }
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to add parent certificates" };
  }
}

export async function handleRemoveParentCerts(ctx: Koa.Context) {
  try {
    const { kid } = ctx.params;

    const result = await removeParentCertificates(kid);
    if (result.ok) {
      ctx.redirect(`/admin/keys/${encodeURIComponent(kid)}/detail`);
    } else {
      handleNotSuccessResult(result.error, ctx);
    }
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to remove parent certificates" };
  }
}

export async function handleRemoveCert(ctx: Koa.Context) {
  try {
    const { kid, index } = ctx.params;
    const certIndex = parseInt(index, 10);

    if (isNaN(certIndex) || certIndex < 1) {
      ctx.status = 400;
      ctx.body = { error: "Invalid certificate index" };
      return;
    }

    const result = await removeCertificateAtIndex(kid, certIndex);
    if (result.ok) {
      ctx.redirect(`/admin/keys/${encodeURIComponent(kid)}/detail`);
    } else {
      handleNotSuccessResult(result.error, ctx);
    }
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to remove certificate" };
  }
}

// Metadata Management Handlers
export async function handleMetadataIndex(ctx: Koa.Context) {
  try {
    // Get current metadata
    const credentialIssuer = process.env.CREDENTIAL_ISSUER || "";
    const metadataRepository = new MetadataRepository(credentialIssuer);
    const metadata = await metadataRepository.getIssuerMetadata();

    // Get available signing keys
    const keysResult = await keys.getAllKeys();
    const availableKeys = keysResult.ok
      ? keysResult.payload.filter((k) => !k.revokedAt)
      : [];

    // Get signed metadata history
    const signedMetadataHistory = await authStore.getAllSignedMetadata();

    // Get active signed metadata
    const activeSignedMetadata = await authStore.getActiveSignedMetadata();

    await ctx.render("admin/metadata", {
      title: "メタデータ管理",
      metadata: JSON.stringify(metadata, null, 2),
      availableKeys,
      signedMetadataHistory,
      activeSignedMetadata,
      credentialIssuer,
    });
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to load metadata page" };
  }
}

export async function handleMetadataSign(ctx: Koa.Context) {
  try {
    const { signingKeyKid, includeFullChain } = ctx.request.body;

    if (!signingKeyKid) {
      ctx.status = 400;
      ctx.body = { error: "Signing key is required" };
      return;
    }

    // Get current metadata
    const credentialIssuer = process.env.CREDENTIAL_ISSUER || "";
    const metadataRepository = new MetadataRepository(credentialIssuer);
    const metadata = await metadataRepository.getIssuerMetadata();

    // Sign metadata with options
    const result = await signedMetadata.signMetadata(metadata, signingKeyKid, {
      includeFullChain: includeFullChain === "true",
    });

    if (result.ok) {
      ctx.redirect("/admin/metadata");
    } else {
      ctx.status = 400;
      ctx.body = { error: result.error.error };
    }
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to sign metadata" };
  }
}

export async function handleMetadataRevoke(ctx: Koa.Context) {
  try {
    const { id } = ctx.params;
    await authStore.revokeSignedMetadata(Number(id));
    ctx.redirect("/admin/metadata");
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to revoke signed metadata" };
  }
}

// Wallet Provider CA Management Handlers
export async function handleWalletProviderCAIndex(ctx: Koa.Context) {
  try {
    const cas = await authStore.getAllTrustedWalletProviderCAs();
    const settings = await authStore.getWalletAttestationSettings();

    // Parse certificate info for each CA
    const casWithInfo = cas.map((ca) => {
      let certInfo = null;
      try {
        const certInfos = getCertificatesInfo([ca.rootCertPem]);
        if (certInfos.length > 0) {
          certInfo = certInfos[0];
        }
      } catch (e) {
        console.error("Failed to parse CA certificate:", e);
      }
      return { ...ca, certInfo };
    });

    await ctx.render("admin/wallet-provider-ca", {
      title: "Wallet Provider CA 管理",
      cas: casWithInfo,
      settings,
    });
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to load wallet provider CA page" };
  }
}

export async function handleWalletProviderCAImport(ctx: Koa.Context) {
  try {
    const { name, rootCertPem } = ctx.request.body;

    if (!name || !name.trim()) {
      ctx.status = 400;
      ctx.body = { error: "CA name is required" };
      return;
    }

    if (!rootCertPem || !rootCertPem.trim()) {
      ctx.status = 400;
      ctx.body = { error: "Root certificate is required" };
      return;
    }

    // Validate the certificate format
    const trimmedCert = rootCertPem.trim();
    if (
      !trimmedCert.includes("-----BEGIN CERTIFICATE-----") ||
      !trimmedCert.includes("-----END CERTIFICATE-----")
    ) {
      ctx.status = 400;
      ctx.body = { error: "Invalid certificate format. Must be PEM format." };
      return;
    }

    // Try to parse the certificate to validate it
    try {
      getCertificatesInfo([trimmedCert]);
    } catch (e) {
      ctx.status = 400;
      ctx.body = { error: "Invalid certificate. Could not parse." };
      return;
    }

    await authStore.addTrustedWalletProviderCA(name.trim(), trimmedCert);
    ctx.redirect("/admin/wallet-provider-ca");
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to import CA certificate" };
  }
}

export async function handleWalletProviderCAToggle(ctx: Koa.Context) {
  try {
    const { id } = ctx.params;
    const ca = await authStore.getTrustedWalletProviderCA(Number(id));
    if (!ca) {
      ctx.status = 404;
      ctx.body = { error: "CA not found" };
      return;
    }

    await authStore.updateTrustedWalletProviderCAEnabled(
      Number(id),
      !ca.enabled,
    );
    ctx.redirect("/admin/wallet-provider-ca");
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to toggle CA status" };
  }
}

export async function handleWalletProviderCADelete(ctx: Koa.Context) {
  try {
    const { id } = ctx.params;
    await authStore.deleteTrustedWalletProviderCA(Number(id));
    ctx.redirect("/admin/wallet-provider-ca");
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to delete CA" };
  }
}

export async function handleWalletAttestationSettingsUpdate(ctx: Koa.Context) {
  try {
    const enableChainValidation =
      ctx.request.body?.enableChainValidation === "true";
    await authStore.updateWalletAttestationSettings(enableChainValidation);
    ctx.redirect("/admin/wallet-provider-ca");
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to update settings" };
  }
}

// Issuance Status Handler
export async function handleIssuanceStatus(ctx: Koa.Context) {
  try {
    const { authCodeId } = ctx.params;
    const id = Number(authCodeId);

    if (isNaN(id)) {
      ctx.status = 400;
      ctx.body = { error: "Invalid auth code ID" };
      return;
    }

    // Get auth code
    const authCode = await authStore.getAuthCodeById(id);
    if (!authCode) {
      ctx.status = 404;
      ctx.body = { error: "Auth code not found" };
      return;
    }

    // Get learner info
    const learner = authCode.sub
      ? await store.getLearnerById(authCode.sub)
      : null;

    // Get issuance events
    const events = await authStore.getIssuanceEventsByAuthCodeId(id);

    // Calculate status
    const now = Date.now();
    const createdAt = new Date(authCode.createdAt).getTime();
    const expiresAt = createdAt + authCode.expiresIn * 1000;
    const isExpired = now > expiresAt;

    const hasTokenRequest = events.some(
      (e) => e.eventType === "token_request" || e.eventType === "token_issued",
    );
    const hasTokenIssued = events.some((e) => e.eventType === "token_issued");
    const hasCredentialRequest = events.some(
      (e) =>
        e.eventType === "credential_request" ||
        e.eventType === "credential_issued",
    );
    const hasCredentialIssued = events.some(
      (e) => e.eventType === "credential_issued",
    );

    let status: string;
    if (!hasTokenRequest) {
      status = isExpired ? "no_request_expired" : "no_request";
    } else if (hasCredentialIssued) {
      status = "credential_issued";
    } else if (hasTokenIssued) {
      status = "token_issued";
    } else {
      status = "token_request";
    }

    // Get token events
    const tokenEvents = events.filter(
      (e) => e.eventType === "token_request" || e.eventType === "token_issued",
    );
    const credentialEvents = events.filter(
      (e) =>
        e.eventType === "credential_request" ||
        e.eventType === "credential_issued",
    );

    await ctx.render("admin/issuance-status", {
      title: "発行状況",
      authCode,
      learner,
      events,
      tokenEvents,
      credentialEvents,
      status,
      isExpired,
      hasTokenRequest,
      hasTokenIssued,
      hasCredentialRequest,
      hasCredentialIssued,
      expiresAtJST: new Date(expiresAt).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
      }),
      createdAtJST: new Date(authCode.createdAt).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
      }),
    });
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: "Failed to load issuance status" };
  }
}

export default {
  handleAdminIndex,
  handleNewLearner,
  handleLearnerCredentialOffer,
  handleLearnersList,
  handleLearnerNewForm,
  handleLearnerEditForm,
  handleLearnerUpdate,
  handleLearnerDelete,
  handleLearnerCredentialOfferForm,
  handleLearnerCredentialOfferDisplay,
  // Key management
  handleKeysList,
  handleKeyNewForm,
  handleKeyNew,
  handleKeyDetail,
  handleCertDescriptionUpdate,
  handleKeyCertificateForm,
  handleKeyCertificateIssue,
  handleKeyImportForm,
  handleKeyImport,
  handleAddParentCertForm,
  handleAddParentCert,
  handleRemoveParentCerts,
  handleRemoveCert,
  // Metadata management
  handleMetadataIndex,
  handleMetadataSign,
  handleMetadataRevoke,
  // Wallet Provider CA management
  handleWalletProviderCAIndex,
  handleWalletProviderCAImport,
  handleWalletProviderCAToggle,
  handleWalletProviderCADelete,
  handleWalletAttestationSettingsUpdate,
  // Issuance status
  handleIssuanceStatus,
};
