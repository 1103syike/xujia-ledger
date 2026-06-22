/** Firestore 不接受 undefined，寫入前需移除 */
export function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function formatFirestoreError(error: unknown): string {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);

  if (/permission|insufficient/i.test(msg)) {
    return '建立失敗：Firestore 權限不足，請確認已登入且規則已部署';
  }
  if (/undefined/i.test(msg)) {
    return '建立失敗：資料格式有誤，請重新整理後再試';
  }
  return `建立失敗：${msg}`;
}
