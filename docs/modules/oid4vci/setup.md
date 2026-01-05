# VCIエンドポイントの設定

共通ルーティングを使用してVCIエンドポイントを設定する。

## ルーティング設定

**ファイル:** `src/routes/vci/routes.ts`

```typescript
// demos/learning-vci/src/routes/vci/routes.ts より引用
import Router from "koa-router";
import commonVciRoutes from "ownd-vci-common/dist/routes/vci/routes.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

import { tokenConfigure } from "../../logic/vciConfigProvider.js";
import { configure } from "../../logic/credentialsConfigProvider.js";
import { nonceConfigure } from "../../logic/nonceConfigProvider.js";
import { MetadataRepository } from "../../metadata/MetadataRepository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename).split("/src")[0];

const init = () => {
  const router = new Router();
  const credentialIssuer = process.env.CREDENTIAL_ISSUER || "http://localhost:3000";
  const metadataRepository = new MetadataRepository(credentialIssuer);

  // 共通VCIルートを設定
  // これにより以下のエンドポイントが自動設定される:
  // - GET  /.well-known/openid-credential-issuer
  // - GET  /.well-known/oauth-authorization-server
  // - POST /token
  // - POST /credentials
  // - POST /nonce
  commonVciRoutes.setupCommonRoute(
    router,
    tokenConfigure,
    configure,
    nonceConfigure,
    metadataRepository,
    __dirname,
  );

  return router;
};

export default init;
```

## 設定されるエンドポイント

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/.well-known/openid-credential-issuer` | Issuerメタデータ |
| GET | `/.well-known/oauth-authorization-server` | Authorization Serverメタデータ |
| POST | `/token` | Access Token発行 |
| POST | `/credentials` | Credential発行 |
| POST | `/nonce` | c_nonce発行 |

## メタデータリポジトリの実装

`IMetadataRepository`インターフェースを実装して、Issuerメタデータを提供する。

**ファイル:** `src/metadata/MetadataRepository.ts`

```typescript
// demos/learning-vci/src/metadata/MetadataRepository.ts より引用
import { IMetadataRepository } from "ownd-vci/dist/metadata/IMetadataRepository.js";
import {
  IssuerMetadata,
  AuthorizationServerMetadata,
} from "ownd-vci/dist/oid4vci/types/protocol.types.js";
import { learningCredentialConfig } from "./credentialConfigs.js";

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
    return [
      {
        name: "Your Issuer Name",
        locale: "ja-JP",
        logo: { uri: `${this.credentialIssuer}/images/logo.png` },
      },
    ];
  }

  private buildCredentialConfigurations() {
    return {
      YourCredential: learningCredentialConfig,
    };
  }
}
```

## Credential設定の定義例

**ファイル:** `src/metadata/credentialConfigs.ts`

```typescript
// demos/learning-vci/src/metadata/credentialConfigs.ts より引用
export const learningCredentialConfig = {
  format: "dc+sd-jwt" as const,
  scope: "LearningCredential",
  cryptographic_binding_methods_supported: ["jwk"],
  credential_signing_alg_values_supported: ["ES256K"],
  proof_types_supported: {
    jwt: {
      proof_signing_alg_values_supported: ["ES256", "ES256K"],
    },
  },
  vct: "urn:eu.europa.ec.eudi:learning:credential:1",
  display: [
    {
      name: "学習証明書",
      locale: "ja-JP",
      background_color: "#1E3A5F",
      text_color: "#FFFFFF",
    },
  ],
  credential_metadata: {
    family_name: {
      display: [{ name: "姓", locale: "ja-JP" }],
    },
    given_name: {
      display: [{ name: "名", locale: "ja-JP" }],
    },
    // 他のフィールド...
  },
};
```
