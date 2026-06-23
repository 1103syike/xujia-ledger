import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DisplayMember } from '../../core/models';
import { MemberAvatarComponent } from './member-avatar.component';

@Component({
  selector: 'app-member-select-grid',
  standalone: true,
  imports: [CommonModule, MemberAvatarComponent],
  templateUrl: './member-select-grid.component.html',

})
export class MemberSelectGridComponent {
  @Input({ required: true }) members!: DisplayMember[];
  @Input() label = '選擇成員';
  @Input() value = '';
  @Input() selectedIds: string[] = [];
  @Input() multiple = false;
  @Input() disabledIds: string[] = [];
  @Input() compact = false;
  @Output() valueChange = new EventEmitter<string>();
  @Output() selectedIdsChange = new EventEmitter<string[]>();

  isSelected(id: string): boolean {
    return this.multiple ? this.selectedIds.includes(id) : this.value === id;
  }

  isDisabled(id: string): boolean {
    return this.disabledIds.includes(id);
  }

  onTap(id: string): void {
    if (this.isDisabled(id)) return;

    if (this.multiple) {
      const next = this.selectedIds.includes(id)
        ? this.selectedIds.filter((x) => x !== id)
        : [...this.selectedIds, id];
      this.selectedIdsChange.emit(next);
      return;
    }

    this.valueChange.emit(id);
  }
}
