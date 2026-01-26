import Koa from "koa";

import { TokenIssuerConfig } from "ownd-vci/dist/oid4vci/tokenEndpoint/types.js";
import { TokenIssuer } from "ownd-vci/dist/oid4vci/tokenEndpoint/TokenIssuer.js";
import { CredentialIssuerConfig } from "ownd-vci/dist/oid4vci/credentialEndpoint/types.js";
import authStore, {
  StoredAccessToken,
  AddIssuanceEventParams,
} from "../../store/authStore.js";
import { CredentialIssuer } from "ownd-vci/dist/oid4vci/credentialEndpoint/CredentialIssuer.js";
import { NonceIssuerConfig } from "ownd-vci/dist/oid4vci/nonceEndpoint/types.js";
import { NonceIssuer } from "ownd-vci/dist/oid4vci/nonceEndpoint/NonceIssuer.js";
import { resolveAcceptLanguage } from "resolve-accept-language";
import { localizeIssuerMetadata } from "ownd-vci/dist/utils/localize.js";
import { IMetadataRepository } from "ownd-vci/dist/metadata/IMetadataRepository.js";
import { decodeJwtParts, safeStringify } from "../../utils/jwtDecode.js";

/**
 * Issuer Metadataを返すハンドラ
 *
 * クライアントのAccept Headerに基づいてレスポンス形式を決定する:
 * - Accept: application/jwt かつ署名付きメタデータあり → JWT形式で返却
 * - Accept: application/json または指定なし → JSON形式で返却
 *
 * @see https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#section-12.2.2
 *
 * @param ctx - Koaコンテキスト
 * @param metadataRepository - メタデータリポジトリ実装（各demoから注入）
 * @param availableLocales - 対応ロケール
 * @param defaultLocale - デフォルトロケール
 */
export async function handleIssueMetadata(
  ctx: Koa.Context,
  metadataRepository: IMetadataRepository,
  availableLocales: string[],
  defaultLocale: string,
) {
  try {
    const acceptHeader = ctx.request.header["accept"];

    // クライアントが application/jwt を要求した場合
    if (acceptHeader && acceptHeader.includes("application/jwt")) {
      const signedMetadata = await authStore.getActiveSignedMetadata();
      if (signedMetadata) {
        console.debug("Returning signed metadata JWT (Accept: application/jwt)");
        ctx.body = signedMetadata.jwt;
        ctx.status = 200;
        ctx.set("Content-Type", "application/jwt");
        return;
      }
      // 署名付きメタデータがない場合はJSONにフォールバック
      console.debug("Accept: application/jwt requested but no signed metadata available, falling back to JSON");
    }

    // デフォルト: JSON形式で返却
    const needsLocalization = process.env.RESOLVE_ACCEPT_LANGUAGE === "true";

    // リポジトリから取得
    const originalMetadataJson = await metadataRepository.getIssuerMetadata();
    console.debug("Issuer Metadata:", JSON.stringify(originalMetadataJson));

    if (!needsLocalization) {
      ctx.body = originalMetadataJson;
      ctx.status = 200;
      ctx.set("Content-Type", "application/json");
      return;
    }

    const acceptLanguage = ctx.request.header["accept-language"];
    if (!acceptLanguage) {
      ctx.body = originalMetadataJson;
      ctx.status = 200;
      ctx.set("Content-Type", "application/json");
      return;
    }

    try {
      const preferred = resolveAcceptLanguage(
        acceptLanguage,
        availableLocales,
        defaultLocale,
      );
      ctx.body = localizeIssuerMetadata(
        structuredClone(originalMetadataJson),
        preferred,
        defaultLocale,
      );
    } catch (err) {
      console.log(
        `unable to localize metadata using accept-language header: ${acceptLanguage}`,
      );
      ctx.body = originalMetadataJson;
    }

    ctx.status = 200;
    ctx.set("Content-Type", "application/json");
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { message: "Internal Server Error" };
  }
}

export async function handleAuthServer(
  ctx: Koa.Context,
  metadataRepository: IMetadataRepository,
) {
  try {
    const metadataJson =
      await metadataRepository.getAuthorizationServerMetadata();
    console.debug("Authorization Server Metadata:", JSON.stringify(metadataJson));
    ctx.body = metadataJson;
    ctx.status = 200;
    ctx.set("Content-Type", "application/json");
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { message: "Internal Server Error" };
  }
}

export async function handleToken(
  ctx: Koa.Context,
  configGenerator: () => TokenIssuerConfig,
) {
  console.log("=== Token Request Started ===");
  console.log("Grant Type:", ctx.request.body?.grant_type);
  console.log("Pre-authorized Code:", ctx.request.body?.["pre-authorized_code"]?.substring(0, 10) + "...");
  console.log("TX Code provided:", !!ctx.request.body?.tx_code);

  // Extract JWTs from headers for event logging
  const dpopJwt = ctx.get("DPoP") || undefined;
  const walletAttestationJwt = ctx.get("OAuth-Client-Attestation") || undefined;
  const walletAttestationPopJwt = ctx.get("OAuth-Client-Attestation-PoP") || undefined;

  // Get auth code for event logging
  const preAuthCode = ctx.request.body?.["pre-authorized_code"];
  const authCode = preAuthCode ? await authStore.getAuthCode(preAuthCode) : undefined;

  const tokenRequest = new TokenIssuer(configGenerator());
  const result = await tokenRequest.issue({
    getHeader: (name: string) => ctx.get(name),
    getBody: () => ctx.request.body,
  });

  // Record issuance event
  if (authCode?.id) {
    const decodedDpop = dpopJwt ? decodeJwtParts(dpopJwt) : null;
    const decodedWA = walletAttestationJwt ? decodeJwtParts(walletAttestationJwt) : null;
    const decodedWAPop = walletAttestationPopJwt ? decodeJwtParts(walletAttestationPopJwt) : null;

    // Determine error type based on error code, not JWT presence
    const errorPayload = !result.ok ? result.error.payload : null;
    const errorCode = errorPayload && "error" in errorPayload ? (errorPayload as { error: string }).error : null;
    const isDpopError = errorCode === "invalid_dpop_proof" || errorCode === "use_dpop_nonce";
    const isClientError = errorCode === "invalid_client";
    const errorJson = errorPayload ? JSON.stringify(errorPayload) : undefined;

    const eventParams: AddIssuanceEventParams = {
      authCodeId: authCode.id,
      eventType: result.ok ? "token_issued" : "token_request",
      dpopJwt,
      dpopHeader: safeStringify(decodedDpop?.header),
      dpopPayload: safeStringify(decodedDpop?.payload),
      // DPoP valid if: JWT sent and no DPoP error (even if request fails for other reason)
      dpopValid: isDpopError ? false : (dpopJwt ? true : undefined),
      dpopError: isDpopError ? errorJson : undefined,
      walletAttestationJwt,
      walletAttestationHeader: safeStringify(decodedWA?.header),
      walletAttestationPayload: safeStringify(decodedWA?.payload),
      // Wallet Attestation valid if: JWT sent and no client error (even if request fails for other reason)
      walletAttestationValid: isClientError ? false : (walletAttestationJwt ? true : undefined),
      walletAttestationError: isClientError ? errorJson : undefined,
      walletAttestationPopJwt,
      walletAttestationPopHeader: safeStringify(decodedWAPop?.header),
      walletAttestationPopPayload: safeStringify(decodedWAPop?.payload),
      // Wallet Attestation PoP valid if: JWT sent and no client error (even if request fails for other reason)
      walletAttestationPopValid: isClientError ? false : (walletAttestationPopJwt ? true : undefined),
      walletAttestationPopError: isClientError ? errorJson : undefined,
    };

    try {
      await authStore.addIssuanceEvent(eventParams);
      console.log("Issuance event recorded:", eventParams.eventType);
    } catch (err) {
      console.error("Failed to record issuance event:", err);
    }
  }

  if (!result.ok) {
    console.log("❌ Token Request Failed:", JSON.stringify(result.error.payload));
    const { status, payload } = result.error;
    ctx.status = status;
    ctx.body = payload;
    return;
  }

  console.log("✅ Token Issued Successfully");
  console.log("Access Token:", result.payload.access_token.substring(0, 10) + "...");
  console.log("=== Token Request Completed ===\n");

  // return access token
  ctx.body = result.payload;
  ctx.status = 200;
  ctx.set("Cache-Control", "no-store");
  ctx.set("Content-Type", "application/json");
}

export async function handleCredential(
  ctx: Koa.Context,
  configGenerator: () => CredentialIssuerConfig<StoredAccessToken>,
) {
  console.log("=== Credential Request Started ===");
  console.log("Authorization Header:", ctx.get("Authorization")?.substring(0, 20) + "...");
  console.log("Credential Configuration ID:", ctx.request.body?.credential_configuration_id);
  console.log("VCT:", ctx.request.body?.vct);
  console.log("Proof Type:", ctx.request.body?.proof?.proof_type);
  console.log("Number of JWT Proofs:", ctx.request.body?.proofs?.jwt?.length || 0);

  // Extract DPoP JWT for event logging
  const dpopJwt = ctx.get("DPoP") || undefined;

  // Get auth code ID from access token for event logging
  const authHeader = ctx.get("Authorization");
  const accessToken = authHeader?.replace(/^(Bearer|DPoP)\s+/i, "");
  const storedAccessToken = accessToken ? await authStore.getAccessToken(accessToken) : undefined;
  const authCodeId = storedAccessToken?.authorizedCode?.id;

  const credentialIssuer = new CredentialIssuer(configGenerator());
  const result = await credentialIssuer.issue({
    getHeader: (name: string) => ctx.get(name),
    getBody: () => ctx.request.body,
  });

  // Record issuance event
  if (authCodeId) {
    const decodedDpop = dpopJwt ? decodeJwtParts(dpopJwt) : null;

    // Determine error type based on error code
    const errorPayload = !result.ok ? result.error.payload : null;
    const errorCode = errorPayload && "error" in errorPayload ? (errorPayload as { error: string }).error : null;
    const isDpopError = errorCode === "invalid_dpop_proof" || errorCode === "use_dpop_nonce";
    const errorJson = errorPayload ? JSON.stringify(errorPayload) : undefined;

    const eventParams: AddIssuanceEventParams = {
      authCodeId,
      eventType: result.ok ? "credential_issued" : "credential_request",
      dpopJwt,
      dpopHeader: safeStringify(decodedDpop?.header),
      dpopPayload: safeStringify(decodedDpop?.payload),
      dpopValid: result.ok && dpopJwt ? true : (isDpopError ? false : undefined),
      dpopError: isDpopError ? errorJson : undefined,
    };

    try {
      await authStore.addIssuanceEvent(eventParams);
      console.log("Issuance event recorded:", eventParams.eventType);
    } catch (err) {
      console.error("Failed to record issuance event:", err);
    }
  }

  if (!result.ok) {
    console.log("❌ Credential Request Failed:", JSON.stringify(result.error.payload));
    console.debug("Error details:", JSON.stringify(result.error));
    ctx.status = result.error.status;
    ctx.body = result.error.payload;
    return;
  }

  console.log("✅ Credential Issued Successfully");
  console.log("Credential format:", result.payload.credential ? "credential field" : "credentials field");
  console.log("=== Credential Request Completed ===\n");

  ctx.body = result.payload;
  ctx.status = 200;
}

export async function handleNonce(
  ctx: Koa.Context,
  configGenerator: () => NonceIssuerConfig,
) {
  console.log("=== Nonce Request Started ===");

  const nonceIssuer = new NonceIssuer(configGenerator());
  const result = await nonceIssuer.issue();

  if (!result.ok) {
    console.log("❌ Nonce Request Failed:", JSON.stringify(result.error.payload));
    const { status, payload } = result.error;
    ctx.status = status;
    ctx.body = payload;
    return;
  }

  console.log("✅ Nonce Issued Successfully");
  console.log("C_nonce:", result.payload.payload.c_nonce);
  console.log("C_nonce expires in:", result.payload.payload.c_nonce_expires_in, "seconds");

  // Set DPoP-Nonce header if present
  if (result.payload.headers) {
    for (const [key, value] of Object.entries(result.payload.headers)) {
      console.log(`Setting header ${key}:`, value);
      ctx.set(key, value);
    }
  }

  console.log("=== Nonce Request Completed ===\n");

  // return nonce response
  ctx.body = result.payload.payload;
  ctx.status = 200;
  ctx.set("Cache-Control", "no-store");
  ctx.set("Content-Type", "application/json");
}

export default {
  handleIssueMetadata,
  handleAuthServer,
  handleToken,
  handleCredential,
  handleNonce,
};
