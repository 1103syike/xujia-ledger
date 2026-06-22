import { Pipe, PipeTransform } from '@angular/core';
import { formatExpenseDateLabel, normalizeExpenseDate } from '../../core/utils/expense-date';

@Pipe({
  name: 'expenseDate',
  standalone: true,
})
export class ExpenseDatePipe implements PipeTransform {
  transform(
    value: string | null | undefined | { date?: string | null; createdAt?: string }
  ): string {
    if (!value) return '';
    const date =
      typeof value === 'string'
        ? value
        : normalizeExpenseDate(value);
    return formatExpenseDateLabel(date);
  }
}
