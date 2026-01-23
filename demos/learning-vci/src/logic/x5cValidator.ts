import { verifyCertificateChain } from "@ownd-project/ts-toolbox";
import authStore from "ownd-vci-common/dist/store/authStore.js";
import type { X5cChainValidator } from "ownd-vci/dist/oid4vci/clientAuthentication/types.js";

/**
 * x5cValidator function that validates x5c certificate chains against trusted CA certificates.
 *
 * The validator:
 * - Checks wallet attestation settings to see if chain validation is enabled
 * - If disabled, returns valid (x5c signature verification only, handled elsewhere)
 * - If enabled, checks the x5c chain against registered trusted CA certificates
 *
 * @param x5cChain - Array of Base64 DER encoded certificates
 * @returns Validation result
 */
export const x5cValidator: X5cChainValidator = async (
  x5cChain: string[],
): Promise<{ valid: boolean; error?: string }> => {
  try {
    // Check if chain validation is enabled
    const settings = await authStore.getWalletAttestationSettings();

    if (!settings.enableChainValidation) {
      console.log(
        "[x5cValidator] Chain validation is disabled, skipping x5c chain validation",
      );
      return { valid: true };
    }

    console.log("[x5cValidator] Chain validation is enabled");

    if (!x5cChain || x5cChain.length === 0) {
      return { valid: false, error: "x5c chain is empty" };
    }

    // Get enabled trusted CA certificates
    const trustedCAs = await authStore.getEnabledTrustedWalletProviderCAs();

    if (trustedCAs.length === 0) {
      return {
        valid: false,
        error:
          "No trusted CA certificates registered. Please register at least one CA certificate.",
      };
    }

    console.log(
      `[x5cValidator] Validating x5c chain (${x5cChain.length} certs) against ${trustedCAs.length} trusted CAs`,
    );

    // Extract base64 content from trusted CA certificates (remove PEM headers)
    const trustedRootCerts = trustedCAs.map((ca) => {
      return ca.rootCertPem
        .replace(/-----BEGIN CERTIFICATE-----/g, "")
        .replace(/-----END CERTIFICATE-----/g, "")
        .replace(/\s/g, "");
    });

    // Try to verify the certificate chain against trusted CAs
    try {
      await verifyCertificateChain(x5cChain, { trustedRootCerts });
      console.log("[x5cValidator] Certificate chain validation succeeded");
      return { valid: true };
    } catch (chainError) {
      const errorMessage =
        chainError instanceof Error
          ? chainError.message
          : "Unknown validation error";
      console.log(
        `[x5cValidator] Certificate chain validation failed: ${errorMessage}`,
      );
      return {
        valid: false,
        error: `Certificate chain validation failed: ${errorMessage}`,
      };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[x5cValidator] Unexpected error:", errorMessage);
    return {
      valid: false,
      error: `Certificate chain validation error: ${errorMessage}`,
    };
  }
};

export default { x5cValidator };
