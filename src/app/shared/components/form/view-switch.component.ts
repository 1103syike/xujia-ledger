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
  templateUrl: './view-switch.component.html',

})
export class ViewSwitchComponent {
  @Input({ required: true }) options: ViewSwitchOption[] = [];
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();

  select(id: string): void {
    if (id !== this.value) this.valueChange.emit(id);
  }
}
