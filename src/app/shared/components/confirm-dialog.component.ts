import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="open"
      class="fixed inset-0 z-50 flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="titleId"
      [attr.aria-describedby]="messageId"
    >
      <button
        type="button"
        class="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
        aria-label="取消"
        (click)="cancel()"
      ></button>

      <div
        class="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <p [id]="titleId" class="section-title">{{ title }}</p>
        <p *ngIf="detail" class="item-title mt-2">{{ detail }}</p>
        <p [id]="messageId" class="helper-text mt-2">{{ message }}</p>

        <div class="mt-5 flex gap-2">
          <button
            type="button"
            class="btn-secondary btn-sm flex-1"
            [disabled]="busy"
            (click)="cancel()"
          >
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            class="btn-sm flex-1"
            [class.btn-danger]="destructive"
            [class.btn-primary]="!destructive"
            [disabled]="busy"
            (click)="confirm()"
          >
            {{ busy ? busyLabel : confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ConfirmDialogComponent {
  @Input() open = false;
  @Input() title = '確認';
  @Input() detail = '';
  @Input() message = '';
  @Input() confirmLabel = '確認';
  @Input() cancelLabel = '取消';
  @Input() busyLabel = '處理中…';
  @Input() destructive = false;
  @Input() busy = false;

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  readonly titleId = `confirm-dialog-title-${ConfirmDialogComponent.nextId()}`;
  readonly messageId = `confirm-dialog-message-${ConfirmDialogComponent.nextId()}`;

  private static idSeq = 0;
  private static nextId(): number {
    return ++ConfirmDialogComponent.idSeq;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open && !this.busy) {
      this.cancel();
    }
  }

  confirm(): void {
    if (this.busy) return;
    this.confirmed.emit();
  }

  cancel(): void {
    if (this.busy) return;
    this.cancelled.emit();
  }
}
