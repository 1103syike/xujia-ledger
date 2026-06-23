import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Member } from '../../../core/models';
import {
  formatNetBalance,
  netBalanceClass,
} from '../../../core/ledger/settlement-display';
import { MemberAvatarComponent } from './member-avatar.component';

@Component({
  selector: 'app-member-picker',
  standalone: true,
  imports: [CommonModule, MemberAvatarComponent],
  templateUrl: './member-picker.component.html',

})
export class MemberPickerComponent {
  @Input({ required: true }) label = '選擇成員';
  @Input({ required: true }) members: Member[] = [];
  @Input() value = '';
  /** 正數＝欠對方；負數＝對方欠你；0＝已結清。有值時僅正數可選 */
  @Input() oweAmounts: Record<string, number> | null = null;
  @Output() valueChange = new EventEmitter<string>();

  isOpen = false;

  get selected(): Member | undefined {
    return this.members.find((m) => m.id === this.value);
  }

  get pickerDisabled(): boolean {
    if (!this.oweAmounts) return false;
    return !this.members.some((m) => this.isSelectable(m.id));
  }

  get selectedOweLabel(): string | null {
    if (!this.oweAmounts || !this.value) return null;
    return formatNetBalance(this.oweAmounts[this.value] ?? 0);
  }

  get selectedOweClass(): string {
    if (!this.oweAmounts || !this.value) return '';
    return netBalanceClass(this.oweAmounts[this.value] ?? 0);
  }

  isSelectable(memberId: string): boolean {
    if (!this.oweAmounts) return true;
    return (this.oweAmounts[memberId] ?? 0) > 0;
  }

  memberSubtitle(memberId: string): string | null {
    if (!this.oweAmounts) return null;
    const owe = this.oweAmounts[memberId] ?? 0;
    if (owe === 0) return '已結清';
    return formatNetBalance(owe);
  }

  amountClass(memberId: string): string {
    if (!this.oweAmounts) return '';
    const owe = this.oweAmounts[memberId] ?? 0;
    if (owe === 0) return 'caption-text';
    return netBalanceClass(owe);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  open(): void {
    if (this.pickerDisabled) return;
    this.isOpen = true;
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    this.isOpen = false;
    document.body.style.overflow = '';
  }

  pick(id: string): void {
    if (!this.isSelectable(id)) return;
    this.valueChange.emit(id);
    this.close();
  }
}
