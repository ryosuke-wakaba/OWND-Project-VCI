- /nonceエンドポイントを追加
    - src/oid4vci/noncetokenEndpoint/TokenIssuer.tsに倣って、NonceIssuer.tsを追加
        - validateは不要
        - this.config.nonceIssuer()を呼び出す
    - demos/employee-vci/src/logic/vciConfigProvider.tsに倣ってnonceConfigProviderを実装
        - 分離したc_nonceの登録処理を呼び出す
    - demos/common/src/routes/vci/routesHandler.tsにhandleNonceを追加
    - demos/common/src/routes/vci/routes.tsに`POST /nonce`を追加
    - demos/employee-vci/tests/vci.test.tsに追加した処理のテストを追加

--- Done ---

- /tokenエンドポイントからc_nonce生成処理を分離
    - demos/common/src/store/authStore.tsのaddAccessTokenからTBL_NM_C_NONCESへの追加処理を別関数に抽出
    - demos/employee-vci/src/store.tsの呼び出し部分を修正(抽出した関数の呼び出しは不要)
    - demos/employee-vci/tests/vci.test.tsの"should return 200 and access token details when correct pre-authorized_code is provided"の検証内容からc_nonceを削除

- テーブルの関連変更
    - demos/employee-vci/src/store.tsのauth_codes_employeesテーブルを削除
    - demos/common/src/store/authStore.tsのauth_codesテーブルに`sub VARCHAR`を追加
    - 影響を受けるdemos/employee-vci/src/store.tsのaddPreAuthCodeを修正