# 許家帳本 · xujia-ledger

五人出遊分帳 PWA：Ledger（流水帳）模型、代墊、還款、即時結算。

| | |
|---|---|
| **線上** | [xujia-ledger.vercel.app](https://xujia-ledger.vercel.app/) |
| **GitHub** | [github.com/1103syike/xujia-ledger](https://github.com/1103syike/xujia-ledger) |
| **技術** | Angular 16 · Firebase Auth · Firestore · Vercel |

## 核心理念

系統只記錄**交易事件**（代墊、還款），**誰欠誰**全部由交易即時計算，不儲存欠款狀態。

```
Transaction → Balance（計算） → Settlement（UI 顯示）
```

## 功能

- **代墊**：平分／細分（五人全列出，不用付填 0）
- **還款**：建立還款交易，立即更新結算（支援部分還款、超額還款）
- **目前結算**：首頁顯示與各成員的 pairwise 淨額
- 平分零頭：非代墊者隨機一人承擔
- 圓餅圖分攤比例、成員交易紀錄、操作紀錄
- Firebase 即時同步
- 向下相容：仍會讀取舊版 `expenses` collection

## 本地開發

```bash
npm install
npm start
```

## Firebase 設定（必做）

專案：`xujia-ledger`

### 1. Authentication

- 啟用 **Email/Password**
- Authorized domains 加入 `xujia-ledger.vercel.app`
- 建立 5 個用戶（密碼預設 `1234`）：

| Email | 對應成員 |
|-------|---------|
| `m1@xujia-ledger.app` | 成員一 |
| `m2@xujia-ledger.app` | 成員二 |
| `m3@xujia-ledger.app` | 成員三 |
| `m4@xujia-ledger.app` | 成員四 |
| `m5@xujia-ledger.app` | 成員五 |

### 2. Firestore

- 建立資料庫（production mode）
- 部署 Rules（含 `transactions` collection）：

```bash
firebase login
firebase deploy --only firestore:rules
```

### 3. 登入方式

1. 輸入密碼（預設 `1234`）
2. 點成員名字 → Firebase Auth 登入
3. 首次登入會自動寫入 `users/{uid}` → `{ memberId: 'm1' }`

## 資料模型

| Collection | 說明 |
|------------|------|
| `transactions` | 新交易（`advance` / `repayment`） |
| `expenses` | 舊版代墊（唯讀相容，新資料請寫入 transactions） |
| `auditLogs` | 操作紀錄 |

## Vercel 部署

Push 到 GitHub 後自動 build。設定已在 `environment.prod.ts` / `firebase.config.ts`。

## 自訂成員

編輯 `src/app/core/models/index.ts` 的 `DEFAULT_MEMBERS`（名稱、emoji、`loginEmail`），並在 Firebase Auth 建立對應帳號。
