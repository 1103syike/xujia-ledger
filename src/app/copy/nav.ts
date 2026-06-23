/** 導覽與資訊架構 */
export const COPY_NAV = {
  appName: '許家帳本',
  home: '首頁',
  ledger: '帳本',
  ledgerWith: (name: string) => `與${name}的帳本`,
  addRecord: '記一筆',
  changes: '變更',
  settings: '設定',
} as const;
