import { Directive, ElementRef, HostListener, Optional, Self } from '@angular/core';
import { NgControl } from '@angular/forms';

/** 只留 0–9（貼上／IME 組字後也會清掉） */
export function keepDigitsOnly(value: string | number | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * 金額欄只允許數字，並把 FormControl / NgModel 寫成 number | null。
 * （改 type=text 後若留字串，`+` 會黏成 1231212880 這種怪總額）
 *
 * 套用：`input.input-amount[inputmode="numeric"]`
 */
@Directive({
  selector: 'input.input-amount[inputmode="numeric"]',
  standalone: true,
})
export class DigitsOnlyDirective {
  constructor(
    private readonly el: ElementRef<HTMLInputElement>,
    @Optional() @Self() private readonly ngControl: NgControl | null
  ) {}

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    if (event.isComposing) {
      event.preventDefault();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const passKeys = new Set([
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ]);
    if (passKeys.has(event.key)) return;

    if (event.key.length === 1 && !/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }

  @HostListener('beforeinput', ['$event'])
  onBeforeInput(event: InputEvent): void {
    if (!event.inputType?.startsWith('insert')) return;
    if (event.data != null && /\D/.test(event.data)) {
      event.preventDefault();
    }
  }

  @HostListener('compositionend')
  onCompositionEnd(): void {
    this.sanitizeValue();
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const digits = keepDigitsOnly(event.clipboardData?.getData('text'));
    if (!digits) return;
    this.insertDigits(digits);
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    event.preventDefault();
    const digits = keepDigitsOnly(event.dataTransfer?.getData('text'));
    if (!digits) return;
    this.insertDigits(digits);
  }

  @HostListener('input')
  onInput(): void {
    const cleaned = keepDigitsOnly(this.el.nativeElement.value);
    if (cleaned !== this.el.nativeElement.value) {
      // 清掉非法字元：立刻寫回
      this.writeValue(cleaned);
      return;
    }
    // Angular text CVA 會先寫字串；下一微任務再收成 number，避免 `"123"+456` 黏字串
    queueMicrotask(() => this.writeValue(cleaned));
  }

  private insertDigits(digits: string): void {
    const input = this.el.nativeElement;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = keepDigitsOnly(
      `${input.value.slice(0, start)}${digits}${input.value.slice(end)}`
    );
    this.writeValue(next);
    const caret = Math.min(start + digits.length, next.length);
    queueMicrotask(() => input.setSelectionRange(caret, caret));
  }

  private sanitizeValue(): void {
    const input = this.el.nativeElement;
    const cleaned = keepDigitsOnly(input.value);
    // 即便畫面已是純數字，也要把字串 Control 收成 number，避免後面 + 黏字串
    this.writeValue(cleaned);
  }

  private writeValue(digits: string): void {
    const input = this.el.nativeElement;
    const next = digits === '' ? null : Number(digits);
    const control = this.ngControl?.control;
    if (control) {
      if (control.value === next) {
        // DOM 可能還留著舊字，對齊一下
        if (input.value !== digits) input.value = digits;
        return;
      }
      control.setValue(next, { emitEvent: true });
      control.markAsDirty();
      return;
    }
    if (input.value !== digits) {
      input.value = digits;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}
