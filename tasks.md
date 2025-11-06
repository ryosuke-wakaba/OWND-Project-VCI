- /credentialエンドポイントのPoP実装のチェック
    - 実装は、src/oid4vci/credentialEndpoint/validateProof.ts
    - proofsのキーが`jwt`だった場合、デコードしたヘッダーにtypが存在して、値が`openid4vci-proof+jwt`であることをチェックしているか？
    - 未対応だった場合、チェック処理を追加して`invalid_proof`エラーを返すように修正する

--- Done ---
- /credentialエンドポイントを修正
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

- /nonceエンドポイントを追加
    - src/oid4vci/noncetokenEndpoint/TokenIssuer.tsに倣って、NonceIssuer.tsを追加
        - validateは不要
        - this.config.nonceIssuer()を呼び出す
    - demos/employee-vci/src/logic/vciConfigProvider.tsに倣ってnonceConfigProviderを実装
        - 分離したc_nonceの登録処理を呼び出す
    - demos/common/src/routes/vci/routesHandler.tsにhandleNonceを追加
    - demos/common/src/routes/vci/routes.tsに`POST /nonce`を追加
    - demos/employee-vci/tests/vci.test.tsに追加した処理のテストを追加

- /tokenエンドポイントからc_nonce生成処理を分離
    - demos/common/src/store/authStore.tsのaddAccessTokenからTBL_NM_C_NONCESへの追加処理を別関数に抽出
    - demos/employee-vci/src/store.tsの呼び出し部分を修正(抽出した関数の呼び出しは不要)
    - demos/employee-vci/tests/vci.test.tsの"should return 200 and access token details when correct pre-authorized_code is provided"の検証内容からc_nonceを削除

- テーブルの関連変更
    - demos/employee-vci/src/store.tsのauth_codes_employeesテーブルを削除
    - demos/common/src/store/authStore.tsのauth_codesテーブルに`sub VARCHAR`を追加
    - 影響を受けるdemos/employee-vci/src/store.tsのaddPreAuthCodeを修正