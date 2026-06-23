/** 分攤方式 */
export const COPY_SPLIT = {
  equal: '大家均分',
  custom: '每人不一樣',
  lineItems: '逐項記帳',
  direct: '直接填金額',
  nPeople: (n: number) => `${n} 人分`,
  bears: (name: string) => `${name} 承擔`,
  skipped: '沒參與',
} as const;

/** 記錄類型標籤 */
export const COPY_RECORD_TYPE = {
  splitBill: '分帳',
  repayment: '還款',
  consolidate: '整合欠款',
  adjustment: '調整',
} as const;
