type TransactionCreateModule = typeof import('../../features/transactions/create/transaction-create.component');

let createRoutePrefetch: Promise<TransactionCreateModule> | null = null;

/** 預載記一筆頁 chunk（與路由 lazy import 共用同一模組） */
export function prefetchTransactionCreateRoute(): void {
  if (!createRoutePrefetch) {
    createRoutePrefetch = import(
      '../../features/transactions/create/transaction-create.component'
    );
  }
}

export function loadTransactionCreateComponent() {
  prefetchTransactionCreateRoute();
  return import('../../features/transactions/create/transaction-create.component').then(
    (m) => m.TransactionCreateComponent
  );
}
