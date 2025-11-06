# Doing

# Done

### /credentialエンドポイントのIFを最新化する(続き)
- 現在の実装のペイロードが最新版に準拠していないので修正する
- credential_configuration_idを使用する方法に変更

現在の実装
```
{
  format: "vc+sd-jwt",
  vct: "EmployeeIdentificationCredential",
}
```

最新版の例
```
{
  "credential_configuration_id": "EmployeeIdentificationCredential",
}
```

実装内容:
- src/oid4vci/credentialEndpoint/CredentialIssuer.ts
    - credential_configuration_idによるクレデンシャル設定の解決を実装
    - IssuerMetadataのcredential_configurations_supportedから設定を取得
    - formatとvctはメタデータから取得するように変更
    - CredentialIssuerConfigにissuerMetadataフィールドを追加
    - credential_identifierは未サポートとしてエラーを返す
- demos/employee-vci/src/logic/credentialsConfigProvider.ts
    - IssuerMetadataVcSdJwtを定義してconfigureに追加
- demos/employee-vci/tests/vci.test.ts
    - credential_configuration_idを使用するようにテストを更新
- すべてのテスト(21個)が合格

### /credentialエンドポイントのIFを最新化する
- 現在の実装のペイロードが最新版に準拠していないので修正する
- proofをproofsに変更
    - ペイロードも以下の例の様に変更

現在の実装
```
{
  proof: {
    proof_type: "jwt",
    jwt: "eyJhbGciOiJFUzI1NiIsImp3ayI6eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6InNqcTYxTGViS2tkNDk3MFBwOUhmYkZuNWNOci1aNlVsZWxQWmNzUXo0NkkiLCJ5Ijoiazc3bHBXLVVhV3M1RTUwM3NWdF9ub0MwUXR3OEREX3JvNVdub1BXZnlocyJ9fQ.eyJub25jZSI6InJhbmRvbU5vbmNlIiwiaWF0IjoxNzYyNDAzODE2LCJhdWQiOiJodHRwczovL2V4YW1wbGUuY29tIiwiZXhwIjoxNzYyNDExMDE2fQ.NjCLNgscYB8qOl8bDcKYS7zWN2ThHqN7lo1iYlRhfKLsIwc5z6Pggp5IEIKiKzlCfu8YKzMu3HEnIAyiv6CfVA",
  },
}
```

最新版の例
```
{
  "proofs": {
    "jwt": [
      "eyJraWQiOiJkaWQ6ZXhhbXBsZTplYmZlYjFmNzEyZWJjNmYxYzI3NmUxMmVjMjEva2V5cy8x
       IiwiYWxnIjoiRVMyNTYiLCJ0eXAiOiJKV1QifQ"
    ]
  }
}
```
### /tokenエンドポイントのerror codeの適切性の確認と修正
以下の実装を確認してerror codeが適切にハンドリング、レスポンスされているか確認して、必要があれば修正してください。
- src/oid4vci/tokenEndpoint/TokenIssuer.ts
- demos/employee-vci/tests/vci.test.ts

#### 対応するerror codeの仕様
https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#name-token-error-response
```
If the Token Request is invalid or unauthorized, the Authorization Server constructs the error response as defined as in Section 5.2 of OAuth 2.0 [RFC6749].

The following additional clarifications are provided for some of the error codes already defined in [RFC6749]:

- invalid_request:
The Authorization Server does not expect a Transaction Code in the Pre-Authorized Code Flow but the Client provides a Transaction Code.
The Authorization Server expects a Transaction Code in the Pre-Authorized Code Flow but the Client does not provide a Transaction Code.

- invalid_grant:
The Authorization Server expects a Transaction Code in the Pre-Authorized Code Flow but the Client provides the wrong Transaction Code.
The End-User provides the wrong Pre-Authorized Code or the Pre-Authorized Code has expired.

- invalid_client:
The Client tried to send a Token Request with a Pre-Authorized Code without a Client ID but the Authorization Server does not support anonymous access.
```

### /credentialエンドポイントのerror codeの適切性の確認と修正
以下の実装を確認してerror codeが適切にハンドリング、レスポンスされているか確認して、必要があれば修正してください。
- src/oid4vci/credentialEndpoint/validateProof.ts
- tests/oid4vci/credentialEndpoint/authenticate.test.ts
- tests/oid4vci/credentialEndpoint/validateProof.test.ts
- demos/employee-vci/tests/vci.test.ts

#### 対応するerror codeの仕様
https://www.rfc-editor.org/rfc/rfc6750.html#section-3.1
```
   invalid_request
         The request is missing a required parameter, includes an
         unsupported parameter or parameter value, repeats the same
         parameter, uses more than one method for including an access
         token, or is otherwise malformed.  The resource server SHOULD
         respond with the HTTP 400 (Bad Request) status code.

   invalid_token
         The access token provided is expired, revoked, malformed, or
         invalid for other reasons.  The resource SHOULD respond with
         the HTTP 401 (Unauthorized) status code.  The client MAY
         request a new access token and retry the protected resource
         request.
```

https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#name-credential-request-errors
```
8.3.1.1. Authorization Errors
If the Credential Request does not contain an Access Token that enables issuance of a requested Credential, the Credential Endpoint returns an authorization error response such as defined in Section 3 of [RFC6750].

- error: REQUIRED. The error parameter SHOULD be a single ASCII [USASCII] error code from the following:

    - invalid_credential_request: The Credential Request is missing a required parameter, includes an unsupported parameter or parameter value, repeats the same parameter, or is otherwise malformed.
    - unknown_credential_configuration: Requested Credential Configuration is unknown.
    - unknown_credential_identifier: Requested Credential identifier is unknown.
    - invalid_proof: The proofs parameter in the Credential Request is invalid: (1) if the field is missing, or (2) one of the provided key proofs is invalid, or (3) if at least one of the key proofs does not contain a c_nonce value (refer to Section 7.2).
    - invalid_nonce: The proofs parameter in the Credential Request uses an invalid nonce: at least one of the key proofs contains an invalid c_nonce value. The wallet should retrieve a new c_nonce value (refer to Section 7).
    - invalid_encryption_parameters: This error occurs when the encryption parameters in the Credential Request are either invalid or missing. In the latter case, it indicates that the Credential Issuer requires the Credential Response to be sent encrypted, but the Credential Request does not contain the necessary encryption parameters.
    - credential_request_denied: The Credential Request has not been accepted by the Credential Issuer. The Wallet SHOULD treat this error as unrecoverable, meaning if received from a Credential Issuer the Credential cannot be issued.
- error_description: OPTIONAL. The error_description parameter MUST be a human-readable ASCII [USASCII] text, providing any additional information used to assist the Client implementers in understanding the occurred error. The values for the error_description parameter MUST NOT include characters outside the set %x20-21 / %x23-5B / %x5D-7E.

The usage of these parameters takes precedence over the invalid_request parameter defined in Section 8.3.1.1, since they provide more details about the errors.
```
### /credentialエンドポイントのPoP実装のチェック
    - 実装は、src/oid4vci/credentialEndpoint/validateProof.ts
    - proofsのキーが`jwt`だった場合、デコードしたヘッダーにtypが存在して、値が`openid4vci-proof+jwt`であることをチェックしているか？
    - 未対応だった場合、チェック処理を追加して`invalid_proof`エラーを返すように修正する

### /credentialエンドポイントを修正
    - 現在、設計変更の影響でコメントアウトしているためテストコードが通らない
        - src/oid4vci/credentialEndpoint/defaults/accessToken.ts
        - src/oid4vci/credentialEndpoint/defaults/nonce.ts
    - 現在の問題点
        1. accessToken.ts (7-33行目)

        - accessTokenStateProviderが常に{ exists: false }を返している
        - 本来はアクセストークンをDBから取得し、c_nonce情報を含めて返すべき
        - コメントアウトされた実装ではdemos/common/src/authStore.jsに依存していた

        2. nonce.ts (8-15行目)

        - updateNonceがc_nonceを生成するが、DBに保存していない（13行目がコメントア
        ウト）
        - authStore.refreshNonceの呼び出しがコメントアウトされている

        3. 設計の問題

        - src/oid4vci配下のデフォルト実装がdemos/commonに直接依存していた
        - これは循環依存や設計上の問題があった

    - 解決方針
        - これらのデフォルト実装はdemos/commonに移動する
        - nonceのリフレッシュ要件はプロトコルから削除されたので関連する実装は削除

    - 未解決の問題
        > ⏺ テストはnonceの検証を期待していますが、現在proofElementsがundefinedのため
        >   、nonce検証が行われていません。
        > 
        >   問題は、c_nonceテーブルからaccess_token_idを削除したため、アクセストークン
        >   からc_nonceを取得できなくなったことです。
        > 
        >   新しい設計では：
        >   1. /nonceエンドポイントでc_nonceを取得
        >   2. /tokenエンドポイントではc_nonceを返さない
        >   3. /credentialエンドポイントでc_nonceを検証する際、どうやってc_nonceを取得
        >   するか？
        - c_nonceの検証の条件をリクエストにproofsが含まれている場合に変更
            - 該当する実装は、src/oid4vci/credentialEndpoint/CredentialIssuer.ts
            - nonceの値はproofsから取得した値で検索

### /nonceエンドポイントを追加
    - src/oid4vci/noncetokenEndpoint/TokenIssuer.tsに倣って、NonceIssuer.tsを追加
        - validateは不要
        - this.config.nonceIssuer()を呼び出す
    - demos/employee-vci/src/logic/vciConfigProvider.tsに倣ってnonceConfigProviderを実装
        - 分離したc_nonceの登録処理を呼び出す
    - demos/common/src/routes/vci/routesHandler.tsにhandleNonceを追加
    - demos/common/src/routes/vci/routes.tsに`POST /nonce`を追加
    - demos/employee-vci/tests/vci.test.tsに追加した処理のテストを追加

### /tokenエンドポイントからc_nonce生成処理を分離
    - demos/common/src/store/authStore.tsのaddAccessTokenからTBL_NM_C_NONCESへの追加処理を別関数に抽出
    - demos/employee-vci/src/store.tsの呼び出し部分を修正(抽出した関数の呼び出しは不要)
    - demos/employee-vci/tests/vci.test.tsの"should return 200 and access token details when correct pre-authorized_code is provided"の検証内容からc_nonceを削除

### テーブルの関連変更
    - demos/employee-vci/src/store.tsのauth_codes_employeesテーブルを削除
    - demos/common/src/store/authStore.tsのauth_codesテーブルに`sub VARCHAR`を追加
    - 影響を受けるdemos/employee-vci/src/store.tsのaddPreAuthCodeを修正