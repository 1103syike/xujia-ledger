import { Pipe, PipeTransform } from '@angular/core';
import { formatTransactionDateLabel, normalizeTransactionDate } from '../../core/transactions/transaction-date';

@Pipe({ name: 'transactionDate', standalone: true })
export class TransactionDatePipe implements PipeTransform {
  transform(value: { date?: string | null; createdAt?: string } | string | null | undefined): string {
    if (!value) return '';
    if (typeof value === 'string') {
      return formatTransactionDateLabel(value);
    }
    return formatTransactionDateLabel(normalizeTransactionDate(value));
  }
}

/** @deprecated 使用 TransactionDatePipe */
export { TransactionDatePipe as ExpenseDatePipe };
