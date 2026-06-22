import { Component, forwardRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { formatExpenseDateLabel } from '../../core/utils/expense-date';

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
  template: `
    <div class="field-group">
      <label class="field-label">{{ label }}</label>
      <div class="date-field">
        <span
          class="date-field__display min-w-0 truncate"
          [class.date-field__display--empty]="!value"
        >
          {{ displayLabel }}
        </span>
        <input
          type="date"
          class="date-field__input"
          [value]="value"
          [disabled]="disabled"
          (input)="onInput($event)"
          (blur)="onTouched()"
        />
        <svg
          class="date-field__icon"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
    </div>
  `,
})
export class DateFieldComponent implements ControlValueAccessor {
  @Input() label = '日期';

  value = '';
  disabled = false;

  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  get displayLabel(): string {
    return this.value ? formatExpenseDateLabel(this.value) : '請選擇日期';
  }

  writeValue(value: string | null): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }

  onInput(event: Event): void {
    const next = (event.target as HTMLInputElement).value;
    this.value = next;
    this.onChange(next);
  }
}
