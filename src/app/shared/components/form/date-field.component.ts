import {
  Component,
  ElementRef,
  forwardRef,
  HostListener,
  Input,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { formatExpenseDateLabel } from '../../../core/infra/expense-date';
import {
  buildMonthGrid,
  CalendarDayCell,
  parseIsoDate,
} from '../../../core/infra/calendar';
import { todayLocalDate } from '../../../core/transactions/transaction-date';

@Component({
  selector: 'app-date-field',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateFieldComponent),
      multi: true,
    },
  ],
  templateUrl: './date-field.component.html',
})
export class DateFieldComponent implements ControlValueAccessor {
  @Input() label = '日期';
  @ViewChild('root') rootRef?: ElementRef<HTMLElement>;

  value = '';
  disabled = false;
  open = false;
  viewYear = new Date().getFullYear();
  viewMonth = new Date().getMonth();

  readonly weekLabels = ['日', '一', '二', '三', '四', '五', '六'] as const;

  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  get displayLabel(): string {
    return this.value ? formatExpenseDateLabel(this.value) : '請選擇日期';
  }

  get monthTitle(): string {
    return `${this.viewYear}年${String(this.viewMonth + 1).padStart(2, '0')}月`;
  }

  get cells(): CalendarDayCell[] {
    return buildMonthGrid(this.viewYear, this.viewMonth, this.value);
  }

  writeValue(value: string | null): void {
    this.value = value ?? '';
    if (this.value) {
      this.syncViewToValue();
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    if (disabled) {
      this.open = false;
    }
  }

  toggleOpen(event: Event): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.open = !this.open;
    if (this.open) {
      this.syncViewToValue();
    }
  }

  prevMonth(event: Event): void {
    event.stopPropagation();
    if (this.viewMonth === 0) {
      this.viewMonth = 11;
      this.viewYear -= 1;
      return;
    }
    this.viewMonth -= 1;
  }

  nextMonth(event: Event): void {
    event.stopPropagation();
    if (this.viewMonth === 11) {
      this.viewMonth = 0;
      this.viewYear += 1;
      return;
    }
    this.viewMonth += 1;
  }

  selectDate(iso: string, event: Event): void {
    event.stopPropagation();
    this.value = iso;
    this.onChange(iso);
    this.open = false;
    this.onTouched();
  }

  pickToday(event: Event): void {
    event.stopPropagation();
    this.selectDate(todayLocalDate(), event);
  }

  clear(event: Event): void {
    event.stopPropagation();
    this.value = '';
    this.onChange('');
    this.open = false;
    this.onTouched();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open) return;
    const root = this.rootRef?.nativeElement;
    if (root?.contains(event.target as Node)) return;
    this.open = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.open = false;
    }
  }

  private syncViewToValue(): void {
    const parsed = parseIsoDate(this.value);
    if (!parsed) return;
    this.viewYear = parsed.getFullYear();
    this.viewMonth = parsed.getMonth();
  }
}
