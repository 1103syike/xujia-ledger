import { COPY_ERRORS } from '../../copy';

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
    return `記錄失敗：${COPY_ERRORS.permissionDenied}`;
  }
  if (/undefined/i.test(msg)) {
    return `記錄失敗：${COPY_ERRORS.dataFormat}`;
  }
  return `記錄失敗：${msg}`;
}
