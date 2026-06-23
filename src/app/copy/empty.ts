/** 空狀態 */
export const COPY_EMPTY = {
  noRecords: '還沒記過帳',
  noRecordsWithMember: (name: string) => `與${name}還沒有相關記錄`,
  noRecordsCta: '記第一筆',
  noChanges: '還沒改過任何東西',
  noPendingRepayment: '目前沒有待還的款',
  ledgerClear: '帳本已結清，暫時不用記還款',
  noConsolidatable:
    '目前沒有可整合的分帳（已整合或已還款的記錄無法勾選）',
  noConsolidationDebt: '勾選的記錄之間沒有待結清的欠款',
  noRelatedRecords: '還沒有相關記錄',
  noRelatedWithOther: '跟對方還沒有相關記錄',
  noPendingForPair: '目前沒有待結清的款項',
  noPendingDebtForInterest: '目前沒有待結清的欠款，不用試算利息',
  recordNotFound: '找不到這筆記錄',
  noImpact: '這筆跟大家都有關，但你不欠也不被欠',
} as const;
