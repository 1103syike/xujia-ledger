# 許家帳本 · xujia-ledger

五人出遊分帳 PWA：代墊、平分／細分、繳款確認、操作紀錄。

| | |
|---|---|
| **GitHub** | [github.com/1103syike/xujia-ledger](https://github.com/1103syike/xujia-ledger) |
| **技術** | Angular 16 · Firestore · Vercel |
| **平台** | 手機優先 PWA（iPhone 可加主畫面） |

## 功能

- 建立帳款：全部人／特定人 × 平分／細分
- 平分零頭：在非代墊者中隨機一人承擔（代墊福利），並標記
- 備注：平分整筆備注；細分大備注 + 每人小備注（皆選填）
- 繳款流程：標記已付 → 代墊者確認 → 可撤銷確認
- 儀表板：誰欠誰最多、最近一筆開銷
- 完整操作紀錄

## 本地開發

```bash
cd xujia-ledger
npm install
npm start
```

開啟 http://localhost:4200 ，選擇成員即可使用（目前 `demoMode: true`，資料存 localStorage）。

## Firebase 設定

1. 建立 Firebase 專案，啟用 Firestore + Authentication
2. 複製設定到 `src/environments/environment.prod.ts`
3. 將 `demoMode` 改為 `false`
4. 部署 `firestore.rules`：

```bash
firebase deploy --only firestore:rules
```

## Vercel 部署

1. 在 [Vercel](https://vercel.com) 匯入 [GitHub repo](https://github.com/1103syike/xujia-ledger)
2. Root Directory：`xujia-ledger`（若 repo 根目錄即專案則留空）
3. Build Command：`npm run build`
4. Output Directory：`dist/xujia-ledger`
5. 已含 `vercel.json` SPA fallback

## 自訂成員

編輯 `src/app/core/models/index.ts` 的 `DEFAULT_MEMBERS`（名稱、emoji、代表色）。

## 授權

私人專案，五人私用。
# xujia-ledger
