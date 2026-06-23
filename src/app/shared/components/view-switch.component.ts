import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ViewSwitchOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-view-switch',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="view-switch" role="tablist">
      <button
        *ngFor="let opt of options"
        type="button"
        role="tab"
        class="view-switch__btn"
        [class.view-switch__btn--active]="value === opt.id"
        [attr.aria-selected]="value === opt.id"
        (click)="select(opt.id)"
      >
        {{ opt.label }}
      </button>
    </div>
  `,
})
export class ViewSwitchComponent {
  @Input({ required: true }) options: ViewSwitchOption[] = [];
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();

  select(id: string): void {
    if (id !== this.value) this.valueChange.emit(id);
  }
}
