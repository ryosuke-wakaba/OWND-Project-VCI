import { IMetadataRepository } from "ownd-vci/dist/metadata/IMetadataRepository.js";
import {
  IssuerMetadata,
  AuthorizationServerMetadata,
} from "ownd-vci/dist/oid4vci/types/protocol.types.js";
import { employeeCredentialConfig } from "./credentialConfigs.js";

/**
 * Employee-VCI固有のメタデータリポジトリ実装
 *
 * Phase 1: ハードコード実装
 * Phase 2: DB実装に切り替え（将来）
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
      nonce_endpoint: `${this.credentialIssuer}/nonce`, // REQUIRED by HAIP when key binding is supported
      display: this.buildDisplayInfo(),
      credential_configurations_supported: this.buildCredentialConfigurations(),
    };
  }

  async getAuthorizationServerMetadata(): Promise<AuthorizationServerMetadata> {
    return {
      issuer: this.credentialIssuer,
      authorization_endpoint: `${this.credentialIssuer}/authorize`,
      token_endpoint: `${this.credentialIssuer}/token`,
      pushed_authorization_request_endpoint: `${this.credentialIssuer}/par`,
      grant_types_supported: [
        "urn:ietf:params:oauth:grant-type:pre-authorized_code",
      ],
      token_endpoint_auth_methods_supported: ["none", "attest_jwt_client_auth"],
      // HAIP compliance: Attestation-based client authentication
      client_attestation_signing_alg_values_supported: ["ES256"],
      client_attestation_pop_signing_alg_values_supported: ["ES256"],
      // HAIP compliance: DPoP signing algorithms
      dpop_signing_alg_values_supported: ["ES256"],
    };
  }

  // ========================================
  // Private Methods
  // ========================================

  /**
   * 発行者の表示情報を構築
   */
  private buildDisplayInfo() {
    // 環境変数から取得（デフォルト値も設定）
    const companyNameJa = process.env.COMPANY_NAME_JA || "株式会社Example";
    const companyNameEn = process.env.COMPANY_NAME_EN || "Example Inc.";
    const brandColor = process.env.BRAND_COLOR || "#003289";

    return [
      {
        name: companyNameJa,
        locale: "ja-JP",
        logo: {
          uri: `${this.credentialIssuer}/images/company-logo.png`,
          alt_text: `${companyNameJa}のロゴ`,
        },
        background_color: brandColor,
        text_color: "#FFFFFF",
      },
      {
        name: companyNameEn,
        locale: "en-US",
        logo: {
          uri: `${this.credentialIssuer}/images/company-logo.png`,
          alt_text: `a square logo of a ${companyNameEn}`,
        },
        background_color: brandColor,
        text_color: "#FFFFFF",
      },
    ];
  }

  /**
   * サポートするクレデンシャル設定を構築
   */
  private buildCredentialConfigurations() {
    // credential_metadata.display配列内のURIを動的に設定
    // OID4VCI v1.0: display is inside credential_metadata for SD-JWT VC
    const config = structuredClone(employeeCredentialConfig);

    if (config.credential_metadata?.display) {
      for (const display of config.credential_metadata.display) {
        if (display.logo) {
          display.logo.uri = `${this.credentialIssuer}/images/credential-logo.png`;
        }
        if (display.background_image) {
          display.background_image.uri = `${this.credentialIssuer}/images/credential-background.png`;
        }
      }
    }

    return {
      EmployeeIdentificationCredential: config,
      // 将来的に追加する場合:
      // UniversityDegreeCredential: universityDegreeConfig,
    };
  }

  // ========================================
  // 将来的にDB実装に切り替える場合の例
  // ========================================

  /*
  async getIssuerMetadata(): Promise<IssuerMetadata> {
    const db = await openDb();

    // issuer_metadata テーブルから取得
    const issuerInfo = await db.get(
      'SELECT * FROM issuer_metadata WHERE credential_issuer = ?',
      this.credentialIssuer
    );

    // display_info テーブルから取得
    const displays = await db.all(
      'SELECT * FROM display_info WHERE issuer_id = ? AND target_type = ?',
      [issuerInfo.id, 'issuer']
    );

    // credential_configurations テーブルから取得
    const configs = await db.all(
      'SELECT * FROM credential_configurations WHERE issuer_id = ?',
      issuerInfo.id
    );

    return {
      credential_issuer: issuerInfo.credential_issuer,
      credential_endpoint: issuerInfo.credential_endpoint,
      display: displays.map(d => ({ ... })),
      credential_configurations_supported: this.buildConfigsFromDb(configs),
    };
  }
  */
}
