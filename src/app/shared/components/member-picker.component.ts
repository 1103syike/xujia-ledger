import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Member } from '../../core/models';
import { MemberAvatarComponent } from './member-avatar.component';

@Component({
  selector: 'app-member-picker',
  standalone: true,
  imports: [CommonModule, MemberAvatarComponent],
  template: `
    <label class="block text-sm font-medium">{{ label }}</label>

    <button
      type="button"
      class="mt-1 flex w-full items-center gap-3 rounded-2xl border border-peach/30 bg-cream px-4 py-3 text-left transition active:scale-[0.99]"
      (click)="open()"
      [attr.aria-expanded]="isOpen"
      aria-haspopup="listbox"
    >
      <ng-container *ngIf="selected; else empty">
        <app-member-avatar [member]="selected" size="md" />
        <span class="flex-1 font-medium text-ink">{{ selected.name }}</span>
      </ng-container>
      <ng-template #empty>
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-ink/30">
          ?
        </span>
        <span class="flex-1 text-ink/40">請選擇</span>
      </ng-template>
      <svg
        class="h-5 w-5 shrink-0 text-ink/35"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
          clip-rule="evenodd"
        />
      </svg>
    </button>

    <div
      *ngIf="isOpen"
      class="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="label"
    >
      <button
        type="button"
        class="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
        aria-label="關閉"
        (click)="close()"
      ></button>

      <div
        class="sheet-panel absolute bottom-0 left-0 right-0 mx-auto max-w-md rounded-t-3xl bg-white shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <div class="flex justify-center pt-3">
          <span class="h-1 w-10 rounded-full bg-peach/40"></span>
        </div>

        <div class="flex items-center justify-between px-5 pb-3 pt-2">
          <h3 class="text-base font-bold text-ink">{{ label }}</h3>
          <button
            type="button"
            class="rounded-full px-3 py-1 text-sm text-ink/50 active:bg-cream"
            (click)="close()"
          >
            關閉
          </button>
        </div>

        <ul class="max-h-[50vh] space-y-1 overflow-y-auto px-3 pb-4" role="listbox">
          <li *ngFor="let m of members" role="option" [attr.aria-selected]="m.id === value">
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition active:scale-[0.99]"
              [ngClass]="{
                'bg-peach-15': m.id === value,
                'ring-1 ring-peach-40': m.id === value
              }"
              (click)="pick(m.id)"
            >
              <app-member-avatar [member]="m" size="lg" />
              <span class="flex-1 font-medium text-ink">{{ m.name }}</span>
              <span
                *ngIf="m.id === value"
                class="flex h-6 w-6 items-center justify-center rounded-full bg-peach text-xs text-white"
              >
                ✓
              </span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  `,
})
export class MemberPickerComponent {
  @Input({ required: true }) label = '選擇成員';
  @Input({ required: true }) members: Member[] = [];
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();

  isOpen = false;

  get selected(): Member | undefined {
    return this.members.find((m) => m.id === this.value);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  open(): void {
    this.isOpen = true;
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    this.isOpen = false;
    document.body.style.overflow = '';
  }

  pick(id: string): void {
    this.valueChange.emit(id);
    this.close();
  }
}
