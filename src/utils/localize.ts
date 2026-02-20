import {
  BaseDisplay,
  ClaimDisplay,
  CredentialDisplay,
  IssuerDisplay,
  IssuerMetadata,
} from "../oid4vci/types/protocol.types.js";

const localizeDisplay = <T extends BaseDisplay>(
  displays: T[],
  locale: string,
  defaultLocale: string,
): T[] => {
  const defaultDisplay = displays.find(
    (display) => display.locale === defaultLocale,
  );
  const localeDisplay = displays.find((display) => display.locale === locale);
  return localeDisplay
    ? [localeDisplay]
    : defaultDisplay
    ? [defaultDisplay]
    : displays;
};

const localizeIssuerDisplay = (
  issuerDisplays: IssuerDisplay[],
  locale: string,
  defaultLocale: string,
): IssuerDisplay[] => {
  return localizeDisplay(issuerDisplays, locale, defaultLocale);
};

const localizeCredentialDisplay = (
  credentialDisplays: CredentialDisplay[],
  locale: string,
  defaultLocale: string,
): CredentialDisplay[] => {
  return localizeDisplay(credentialDisplays, locale, defaultLocale);
};

const localizeClaimDisplay = (
  claimDisplays: ClaimDisplay[],
  locale: string,
  defaultLocale: string,
): ClaimDisplay[] => {
  return localizeDisplay(claimDisplays, locale, defaultLocale);
};

export const localizeIssuerMetadata = (
  metadata: IssuerMetadata,
  locale: string,
  defaultLocale: string,
): IssuerMetadata => {
  const localizedMetadata = { ...metadata };

  if (metadata.display) {
    localizedMetadata.display = localizeIssuerDisplay(
      metadata.display,
      locale,
      defaultLocale,
    );
  }

  Object.keys(metadata.credential_configurations_supported).forEach((key) => {
    const config = metadata.credential_configurations_supported[key];

    // Handle display at config level (for non-SD-JWT VC formats like jwt_vc_json, ldp_vc)
    if ("display" in config && config.display) {
      config.display = localizeCredentialDisplay(
        config.display,
        locale,
        defaultLocale,
      );
    }

    if (
      "credential_definition" in config &&
      config.credential_definition.credentialSubject
    ) {
      Object.keys(config.credential_definition.credentialSubject).forEach(
        (claimKey) => {
          const claim =
            config.credential_definition.credentialSubject![claimKey];
          if (claim.display) {
            claim.display = localizeClaimDisplay(
              claim.display,
              locale,
              defaultLocale,
            );
          }
        },
      );
    }

    if ("credential_metadata" in config && config.credential_metadata) {
      // Handle OID4VCI v1.0 compliant format for SD-JWT VC
      // Credential display is inside credential_metadata for SD-JWT VC
      if (config.credential_metadata.display) {
        config.credential_metadata.display = localizeCredentialDisplay(
          config.credential_metadata.display,
          locale,
          defaultLocale,
        );
      }
      // Handle claims array
      if (config.credential_metadata.claims) {
        config.credential_metadata.claims.forEach((claim) => {
          if (claim.display) {
            claim.display = localizeClaimDisplay(
              claim.display,
              locale,
              defaultLocale,
            );
          }
        });
      }
    }

    localizedMetadata.credential_configurations_supported[key] = config;
  });

  return localizedMetadata;
};
