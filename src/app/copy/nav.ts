/** 導覽與資訊架構 */
export const COPY_NAV = {
  appName: '許家帳本',
  home: '首頁',
  ledger: '帳本',
  ledgerWith: (name: string) => `與${name}的帳本`,
  /** 頁面 Header／情境 CTA，不用於 Bottom Navigation */
  addRecord: '記一筆',
  changes: '變更',
  settings: '設定',
} as const;
