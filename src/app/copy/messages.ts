import { COPY_TERMS } from './terms';

/** 錯誤與驗證訊息 */
export const COPY_ERRORS = {
  recordNotFound: '找不到這筆記錄',
  onlySplitBillEditable: '只有分帳記錄可以改',
  recordCancelled: '這筆已取消',
  alreadyConsolidated: '這筆已整合，請先取消那筆整合記錄',
  cancelFailed: '取消失敗，請稍後再試',
  loginRequired: '請先登入帳號',
  titleRequired: '請填寫項目名稱',
  dateRequired: '請選擇日期',
  dateInvalid: '日期格式不正確',
  amountPositive: '總金額必須大於 0',
  payerRequired: '請至少選擇一位付款人',
  payerPick: '請選擇付款人',
  payerDuplicate: '付款人不可重複',
  payerAmountPositive: '付款金額必須大於 0',
  payerTotalShort: (paid: number, split: number) =>
    `付款合計（NT$ ${paid}）不可少於分攤總額（NT$ ${split}）`,
  splitMemberRequired: '請至少選擇一位分攤成員',
  splitParticipantRequired: '至少需要一位成員參與分攤',
  solePayerRemainder:
    '只有付款人參與分攤時無法分配零頭，請標記其他成員不用分',
  repaymentTargetRequired: '請選擇還款對象',
  repaymentSelf: '還款對象不能是自己',
  repaymentAmountPositive: '還款金額必須大於 0',
  noRepaymentTarget: '目前沒有可還款的對象',
  consolidatePickOne: '請至少勾選一筆分帳記錄',
  consolidateNotFound: '找不到部分勾選的記錄',
  consolidateOnlyActive: '只能整合還沒結清的分帳記錄',
  consolidateNoDebt: '勾選的記錄之間沒有待結清的欠款',
  permissionDenied: '目前無法讀取，請重新登入',
  dataFormat: '資料格式有誤，請聯絡管理員',
  loadFailed: '載入失敗，請稍後再試',
  firestoreGeneric: '連線發生問題，請稍後再試',
} as const;

/** 確認對話框 */
export const COPY_DIALOGS = {
  cancelRecordTitle: COPY_TERMS.cancelRecord,
  cancelRecordMessage:
    '確定取消這筆嗎？取消後大家欠多少會重算，變更裡仍看得到。',
  saveSplitTitle: '儲存這筆',
  saveSplitMessage: '確定要儲存嗎？儲存後大家欠多少會重算。',
  addRepaymentTitle: '記還款',
  addRepaymentMessage: '確定記這筆還款嗎？記完大家欠多少會馬上更新。',
  consolidateTitle: COPY_TERMS.consolidate,
  consolidateMessage:
    '確定整合這些欠款嗎？勾選的記錄會標成已整合。',
  discardDraftTitle: '放棄這筆記帳？',
  discardDraftMessage: '你尚未儲存，目前輸入的內容將會遺失。',
  stayEditing: '繼續編輯',
  discardLeave: '放棄離開',
  confirmSave: '確認儲存',
  confirmAdd: '確定',
  confirmCancel: '確定取消',
} as const;
