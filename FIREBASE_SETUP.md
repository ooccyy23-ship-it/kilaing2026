# Firebase 設定步驟

## 1. Firestore 資料庫

1. 前往 [Firebase Console](https://console.firebase.google.com/) → 你的專案 `valleyball2026-8c89e`
2. 左側選單 → **Firestore Database** → **建立資料庫**
3. 選擇 **Production mode（生產模式）**
4. 地區選擇 `asia-east1`（台灣最近）
5. 建立完成後，前往 **規則（Rules）** 標籤
6. 將 `firestore.rules` 的內容完整貼入並發布

## 2. Storage

1. 左側選單 → **Storage** → **開始使用**
2. 選擇 **Production mode**
3. 地區同樣選 `asia-east1`
4. 建立後前往 **規則（Rules）** 標籤
5. 將 `storage.rules` 的內容完整貼入並發布

## 3. Authentication（後台管理員登入用）

1. 左側選單 → **Authentication** → **開始使用**
2. **Sign-in method** → 啟用 **電子郵件/密碼**
3. 前往 **Users** 標籤 → **新增使用者**
4. 填入管理員 Email 與密碼（之後後台登入用）

## 4. 允許的網域

部署後需新增網域白名單：

1. **Authentication** → **設定** → **授權網域**
2. 新增你的 GitHub Pages 或 Netlify 網址
   - 範例：`your-repo.github.io` 或 `your-site.netlify.app`

## Firestore 資料結構

```
registrations/
  {docId}/
    nameZh:         "王小明"
    gender:         "male"
    idNumber:       "A123456789"
    birthdate:      "2010-05-20"
    school:         "XX國中"
    grade:          "國二"
    church:         "XX教會"
    isMinor:        true
    phone:          "0912345678"
    email:          "test@example.com"
    address:        "台北市..."
    parentName:     "王大明"
    parentPhone:    "0923456789"
    shuttle:        "none"
    diet:           "normal"
    tshirt:         "M"
    health:         ""
    notes:          ""
    consentFileURL: "https://storage.googleapis.com/..."  ← 未滿18歲才有
    status:         "pending"   ← pending / confirmed / cancelled
    createdAt:      Timestamp
```

## Storage 資料夾結構

```
consent-forms/
  consent_{timestamp}_{末4碼}.pdf
  consent_{timestamp}_{末4碼}.jpg
  ...
```
