import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastMessage {
  id: string;
  text: string;
  kind: ToastKind;
  durationMs: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastSubject = new Subject<ToastMessage>();
  readonly toast$ = this.toastSubject.asObservable();

  show(text: string, kind: ToastKind = 'info', durationMs = 2800): void {
    this.toastSubject.next({
      id: crypto.randomUUID?.() ?? String(Date.now()),
      text,
      kind,
      durationMs,
    });
  }

  success(text: string, durationMs = 2800): void {
    this.show(text, 'success', durationMs);
  }

  error(text: string, durationMs = 3200): void {
    this.show(text, 'error', durationMs);
  }
}
