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

import store, { NewLearner } from "../../store.js";

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
): Promise<Result<GenerateCredentialOfferResult, NotSuccessResult>> => {
  console.log("=== Credential Offer Generation Started ===");
  console.log("Learner No:", learnerNo);

  const learner = await store.getLearnerByNo(learnerNo);
  if (!learner) {
    console.log("❌ Learner not found:", learnerNo);
    return { ok: false, error: { type: "NOT_FOUND" } };
  }

  console.log("✅ Learner found:", learner.familyName, learner.givenName);

  const code = generateRandomString();
  const expiresIn = Number(process.env.VCI_PRE_AUTH_CODE_EXPIRES_IN || "86400");
  const txCode = generateRandomNumericString();

  console.log("Pre-authorized Code:", code.substring(0, 10) + "...");
  console.log("TX Code:", txCode);
  console.log("Expires in:", expiresIn, "seconds");

  await store.addPreAuthCode(code, expiresIn, txCode, String(learner.id));

  const credentialOfferUrl = generatePreAuthCredentialOffer(
    process.env.CREDENTIAL_ISSUER || "",
    ["LearningCredential"],
    code,
    {},
  );

  console.log("✅ Credential Offer URL generated");
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
      layout: "layout",
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
    layout: "layout",
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
      layout: "layout",
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

export async function handleLearnerCredentialOfferDisplay(ctx: Koa.Context) {
  try {
    const { learnerNo } = ctx.params;
    const result = await credentialOfferForLearner(learnerNo);

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
        layout: "layout",
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

export default {
  handleNewLearner,
  handleLearnerCredentialOffer,
  handleLearnersList,
  handleLearnerNewForm,
  handleLearnerEditForm,
  handleLearnerUpdate,
  handleLearnerDelete,
  handleLearnerCredentialOfferDisplay,
};
