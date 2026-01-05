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
    } = payload;

    // Validate required fields
    if (
      typeof learnerNo !== "string" ||
      typeof givenName !== "string" ||
      typeof familyName !== "string" ||
      typeof issuingAuthority !== "string" ||
      typeof issuingCountry !== "string" ||
      typeof achievementTitle !== "string" ||
      typeof dateOfIssuance !== "string"
    ) {
      return { ok: false, error: { type: "INVALID_PARAMETER" } };
    }

    // Convert comma-separated learning outcomes to JSON array
    let learningOutcomesJson: string | undefined;
    if (learningOutcomes && typeof learningOutcomes === "string") {
      const trimmed = learningOutcomes.trim();
      if (trimmed) {
        // Check if already JSON array
        if (trimmed.startsWith("[")) {
          learningOutcomesJson = trimmed;
        } else {
          // Convert comma-separated string to JSON array
          const items = trimmed
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          learningOutcomesJson = JSON.stringify(items);
        }
      }
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
};

const credentialOfferForLearner = async (
  learnerNo: string,
  signingKeyKid?: string,
): Promise<Result<GenerateCredentialOfferResult, NotSuccessResult>> => {
  console.log("=== Credential Offer Generation Started ===");
  console.log("Learner No:", learnerNo);
  console.log("Signing Key:", signingKeyKid || "(latest)");

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
  await store.addPreAuthCode(
    code,
    expiresIn,
    txCode,
    String(learner.id),
    signingKeyKid,
  );

  const credentialOfferUrl = generatePreAuthCredentialOffer(
    process.env.CREDENTIAL_ISSUER || "",
    ["LearningCredential"],
    code,
    {},
  );

  console.log("Credential Offer URL generated");
  console.log("=== Credential Offer Generation Completed ===\n");

  const payload = {
    subject: { learnerNo },
    credentialOffer: credentialOfferUrl,
    txCode: txCode,
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

    // Convert comma-separated learning outcomes to JSON array
    if (
      learner.learningOutcomes &&
      typeof learner.learningOutcomes === "string"
    ) {
      const trimmed = learner.learningOutcomes.trim();
      if (trimmed) {
        if (!trimmed.startsWith("[")) {
          const items = trimmed
            .split(",")
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0);
          learner.learningOutcomes = JSON.stringify(items);
        }
      } else {
        learner.learningOutcomes = undefined;
      }
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

    const result = await credentialOfferForLearner(learnerNo, signingKeyKid);

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
};
