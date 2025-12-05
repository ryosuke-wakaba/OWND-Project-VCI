# UI改善作業

## Status
- [x] 1. 学習者編集フォーム必須化
- [x] 2. tx code 6桁化
- [x] 3. クレデンシャル発行画面レイアウト調整
- [x] 4. キーペア管理description追加

## 1. 学習者編集フォーム必須化

### 対象ファイル
- `demos/learning-vci/views/admin/learner-edit.ejs`

### 変更内容
オプションフィールドに `required` 属性を追加:
- `achievementDescription` (実績の説明)
- `learningOutcomes` (学習成果)
- `assessmentGrade` (評価/成績)
- `dateOfExpiry` (有効期限)

---

## 2. tx code 6桁化

### 対象ファイル
- `demos/learning-vci/src/routes/admin/routesHandler.ts`
- `demos/learning-vci/views/admin/credential-offer.ejs`

### 変更内容
- `generateRandomNumericString()` → `generateRandomNumericString(6)`
- 表示形式: `xxxx-xxxx` → `xxx-xxx`

---

## 3. クレデンシャル発行画面レイアウト調整

### 対象ファイル
- `demos/learning-vci/views/admin/credential-offer.ejs`

### 変更内容
セクション順序を変更:

**現在:**
1. 学習者情報
2. 発行情報（TX Code, 有効期限）
3. Credential Offer URL
4. QRコード

**変更後:**
1. 学習者情報
2. Credential Offer URL
3. QRコード
4. 発行情報（TX Code, 有効期限）

---

## 4. キーペア管理description追加

### 設計変更
当初はキーペアに説明をつける予定だったが、**証明書に説明をつける**形に変更

### 対象ファイル
- `demos/common/src/store/keyStore.ts` - DDL修正、関数追加
- `demos/common/src/keys.ts` - importKey、KeyInfoにcertDescription追加
- `demos/learning-vci/views/admin/keys.ejs` - 一覧表示（カラム順序変更）
- `demos/learning-vci/views/admin/key-detail.ejs` - 証明書説明編集フォーム追加
- `demos/learning-vci/views/admin/key-new.ejs` - description入力欄削除
- `demos/learning-vci/views/admin/key-import.ejs` - 証明書説明入力欄
- `demos/learning-vci/views/admin/learner-offer.ejs` - 署名鍵選択でcertDescription表示
- `demos/learning-vci/src/routes/admin/routesHandler.ts` - handleKeyDetail、handleCertDescriptionUpdate修正
- `demos/learning-vci/src/routes/admin/routes.ts` - 説明更新ルート追加

### 変更内容

#### 4.1 DDL修正
`ec_key_x509_certificate` テーブルに `description` カラム追加

#### 4.2 keyStore.ts追加関数
- `insertEcKeyX509Certificate` - descriptionパラメータ追加
- `getX509CertificateData` - 証明書データと説明を取得
- `updateX509CertificateDescription` - 証明書の説明を更新
- `getAllKeyPairs` - certDescriptionを返すよう変更

#### 4.3 一覧画面
- 証明書の説明を表示（証明書カラムの右に配置）
- カラム順序: キーID → 楕円曲線 → 証明書 → 説明 → 作成日 → アクション

#### 4.4 詳細画面
- 証明書セクションに説明の編集フォームを追加
- キーペア情報セクションから説明を削除

#### 4.5 フォーム
- 新規作成画面: description入力欄を削除（証明書がまだないため）
- インポート画面: 証明書の説明入力欄

#### 4.6 署名鍵選択
- ドロップダウンにcertDescription表示

### マイグレーション
既存DBに対して以下を実行:
```sql
ALTER TABLE ec_key_x509_certificate ADD COLUMN description VARCHAR(255) DEFAULT NULL;
```

---

## 参考
- `docs/work/2025-12-02-key-management.md`
- `docs/demos/learning-vci.md`
