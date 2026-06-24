import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastMessage, ToastService } from '../../../core/motion/toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-host" aria-live="polite" aria-atomic="true">
      <div
        *ngFor="let toast of toasts"
        class="toast-item"
        [class.toast-item--success]="toast.kind === 'success'"
        [class.toast-item--error]="toast.kind === 'error'"
        [class.toast-item--leaving]="toast.leaving"
      >
        {{ toast.text }}
      </div>
    </div>
  `,
})
export class ToastHostComponent implements OnInit, OnDestroy {
  toasts: Array<ToastMessage & { leaving?: boolean }> = [];
  private sub?: Subscription;

  constructor(private toast: ToastService) {}

  ngOnInit(): void {
    this.sub = this.toast.toast$.subscribe((message) => this.enqueue(message));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private enqueue(message: ToastMessage): void {
    this.toasts = [...this.toasts, message];
    const removeAfter = message.durationMs + 200;

    window.setTimeout(() => {
      this.toasts = this.toasts.map((t) =>
        t.id === message.id ? { ...t, leaving: true } : t
      );
    }, message.durationMs);

    window.setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== message.id);
    }, removeAfter);
  }
}
