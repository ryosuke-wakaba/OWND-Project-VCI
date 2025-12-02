import { IMetadataRepository } from "ownd-vci/dist/metadata/IMetadataRepository.js";
import {
  IssuerMetadata,
  AuthorizationServerMetadata,
} from "ownd-vci/dist/oid4vci/types/protocol.types.js";
import { learningCredentialConfig } from "./credentialConfigs.js";

/**
 * Learning-VCI固有のメタデータリポジトリ実装
 */
export class MetadataRepository implements IMetadataRepository {
  private credentialIssuer: string;

  constructor(credentialIssuer: string) {
    this.credentialIssuer = credentialIssuer;
  }

  async getIssuerMetadata(): Promise<IssuerMetadata> {
    return {
      credential_issuer: this.credentialIssuer,
      authorization_servers: [this.credentialIssuer],
      credential_endpoint: `${this.credentialIssuer}/credentials`,
      nonce_endpoint: `${this.credentialIssuer}/nonce`,
      display: this.buildDisplayInfo(),
      credential_configurations_supported: this.buildCredentialConfigurations(),
    };
  }

  async getAuthorizationServerMetadata(): Promise<AuthorizationServerMetadata> {
    return {
      issuer: this.credentialIssuer,
      authorization_endpoint: `${this.credentialIssuer}/authorize`,
      token_endpoint: `${this.credentialIssuer}/token`,
      grant_types_supported: [
        "urn:ietf:params:oauth:grant-type:pre-authorized_code",
      ],
      token_endpoint_auth_methods_supported: ["none"],
    };
  }

  private buildDisplayInfo() {
    const issuerNameJa = process.env.ISSUER_NAME_JA || "教育機関";
    const issuerNameEn =
      process.env.ISSUER_NAME_EN || "Educational Institution";
    const brandColor = process.env.BRAND_COLOR || "#1E3A5F";

    return [
      {
        name: issuerNameJa,
        locale: "ja-JP",
        logo: {
          uri: `${this.credentialIssuer}/images/issuer-logo.png`,
          alt_text: `${issuerNameJa}のロゴ`,
        },
        background_color: brandColor,
        text_color: "#FFFFFF",
      },
      {
        name: issuerNameEn,
        locale: "en-US",
        logo: {
          uri: `${this.credentialIssuer}/images/issuer-logo.png`,
          alt_text: `a square logo of ${issuerNameEn}`,
        },
        background_color: brandColor,
        text_color: "#FFFFFF",
      },
    ];
  }

  private buildCredentialConfigurations() {
    const config = structuredClone(learningCredentialConfig);

    if (config.display) {
      for (const display of config.display) {
        if (display.logo) {
          display.logo.uri = `${this.credentialIssuer}/images/credential-logo.png`;
        }
        if (display.background_image) {
          display.background_image.uri = `${this.credentialIssuer}/images/credential-background.png`;
        }
      }
    }

    return {
      LearningCredential: config,
    };
  }
}
