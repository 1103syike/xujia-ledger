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
  templateUrl: './confirm-dialog.component.html',

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
