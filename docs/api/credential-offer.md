# Credential Offer

## 概要
Wallet向けのCredential Offer URLを生成する。

## 出力形式

```
openid-credential-offer://?credential_offer=<encoded_json>
```

## パラメータ構造

```json
{
  "credential_issuer": "https://issuer.example.com",
  "credential_configuration_ids": ["EmployeeCredential"],
  "grants": {
    "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
      "pre-authorized_code": "oaKazRN8I0IbtZ0C7JuMn5",
      "tx_code": {
        "length": 4,
        "input_mode": "numeric",
        "description": "Please enter the code"
      }
    }
  }
}
```

## 実装
`src/oid4vci/CredentialOffer.ts`
