import { COPY_TERMS } from './terms';

/** 按鈕與動作文案 */
export const COPY_ACTIONS = {
  addRecord: '記一筆',
  addRepayment: '記還款',
  consolidate: COPY_TERMS.consolidate,
  save: '儲存',
  saveRecord: '儲存這筆',
  confirm: '確定',
  confirmSave: '確認儲存',
  confirmCancel: '確定取消',
  cancel: '取消',
  edit: '編輯',
  editRecord: '編輯記錄',
  cancelRecord: '取消這筆',
  goRepay: '去還款',
  goLedgerSelect: '去帳本勾選',
  viewAll: '看全部',
  viewRecord: '看這筆',
  back: '← 返回',
  backToLedger: '← 返回帳本',
  next: '下一步',
  copyReminder: '複製提醒',
  copied: '已複製 ✓',
  refreshCopy: '🔄 換文案',
  refreshLine: '🔄 換一句',
} as const;
