import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AVATAR_SLOT_IDS,
  AvatarChoice,
  AvatarSlotId,
  CHIBI_IDS,
  ChibiId,
  DisplayMember,
  defaultChibiForMember,
} from '../../../core/models';
import { AvatarService } from '../../../core/services/avatar.service';
import { MemberProfileService } from '../../../core/services/member-profile.service';
import { compressImageToWebp } from '../../../core/infra/image-compress';
import { MemberChibiHeadComponent } from '../member/member-chibi-head.component';

@Component({
  selector: 'app-avatar-picker',
  standalone: true,
  imports: [CommonModule, MemberChibiHeadComponent],
  templateUrl: './avatar-picker.component.html',

})
export class AvatarPickerComponent implements OnChanges {
  @Input({ required: true }) member!: DisplayMember;
  @Input({ required: true }) choice!: AvatarChoice;
  @Output() choiceChange = new EventEmitter<AvatarChoice>();

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  readonly avatarSlotIds = AVATAR_SLOT_IDS;
  readonly chibiIds = CHIBI_IDS;

  slotPreviewUrls: Partial<Record<AvatarSlotId, string>> = {};
  slotBusy = false;
  slotMessage = '';
  slotError = false;

  private pendingSlot: AvatarSlotId | null = null;
  private lastSlotsKey = '';

  constructor(
    private avatars: AvatarService,
    private profiles: MemberProfileService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['member']) return;

    const key = JSON.stringify(this.member.avatarSlots ?? {});
    if (key === this.lastSlotsKey) return;
    this.lastSlotsKey = key;
    void this.refreshSlotPreviews();
  }

  hasSlot(slot: AvatarSlotId): boolean {
    return Boolean(this.member.avatarSlots[String(slot) as '1' | '2' | '3']);
  }

  isSlotSelected(slot: AvatarSlotId): boolean {
    return this.choice.type === 'slot' && this.choice.slot === slot;
  }

  isSvgSelected(svgId: ChibiId): boolean {
    return this.choice.type === 'svg' && this.choice.svgId === svgId;
  }

  selectSlot(slot: AvatarSlotId): void {
    if (!this.hasSlot(slot)) return;
    this.choiceChange.emit({ type: 'slot', slot });
  }

  selectSvg(svgId: ChibiId): void {
    this.choiceChange.emit({ type: 'svg', svgId });
  }

  openFilePicker(slot: AvatarSlotId): void {
    if (this.slotBusy) return;
    this.pendingSlot = slot;
    const input = this.fileInput?.nativeElement;
    if (!input) return;
    input.value = '';
    input.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const slot = this.pendingSlot;
    this.pendingSlot = null;
    if (!slot) return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.slotBusy = true;
    this.slotMessage = '';
    this.slotError = false;

    try {
      const blob = await compressImageToWebp(file);
      const uploadErr = await this.avatars.uploadSlot(this.member.id, slot, blob);
      if (uploadErr) {
        this.slotMessage = uploadErr;
        this.slotError = true;
        return;
      }

      const timestamp = new Date().toISOString();
      const metaErr = await this.profiles.updateAvatarSlot(
        this.member.id,
        slot,
        timestamp
      );
      if (metaErr) {
        this.slotMessage = metaErr;
        this.slotError = true;
        return;
      }

      await this.refreshSlotPreviews();
      this.choiceChange.emit({ type: 'slot', slot });
      this.slotMessage = `槽位 ${slot} 已更新`;
      this.slotError = false;
    } catch {
      this.slotMessage = '無法處理這張圖片';
      this.slotError = true;
    } finally {
      this.slotBusy = false;
    }
  }

  async removeSlot(slot: AvatarSlotId): Promise<void> {
    if (this.slotBusy || !this.hasSlot(slot)) return;

    this.slotBusy = true;
    this.slotMessage = '';
    this.slotError = false;

    const deleteErr = await this.avatars.deleteSlotFile(this.member.id, slot);
    if (deleteErr) {
      this.slotMessage = deleteErr;
      this.slotError = true;
      this.slotBusy = false;
      return;
    }

    const metaErr = await this.profiles.updateAvatarSlot(this.member.id, slot, null);
    if (metaErr) {
      this.slotMessage = metaErr;
      this.slotError = true;
      this.slotBusy = false;
      return;
    }

    delete this.slotPreviewUrls[slot];
    if (this.choice.type === 'slot' && this.choice.slot === slot) {
      this.choiceChange.emit({
        type: 'svg',
        svgId: defaultChibiForMember(this.member.id),
      });
    }

    this.slotMessage = `槽位 ${slot} 已刪除`;
    this.slotError = false;
    this.slotBusy = false;
  }

  private async refreshSlotPreviews(): Promise<void> {
    const slots = this.member.avatarSlots ?? {};
    const next: Partial<Record<AvatarSlotId, string>> = {};

    for (const slot of AVATAR_SLOT_IDS) {
      const version = slots[String(slot) as '1' | '2' | '3'];
      if (!version) continue;

      const url = await this.avatars.getSlotUrl(this.member.id, slot, version);
      if (url) {
        next[slot] = `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
      }
    }

    this.slotPreviewUrls = next;
  }
}
