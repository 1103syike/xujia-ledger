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
} from '../../core/models';
import { AvatarService } from '../../core/services/avatar.service';
import { MemberProfileService } from '../../core/services/member-profile.service';
import { compressImageToWebp } from '../../core/utils/image-compress';
import { MemberChibiHeadComponent } from './member-chibi-head.component';

@Component({
  selector: 'app-avatar-picker',
  standalone: true,
  imports: [CommonModule, MemberChibiHeadComponent],
  template: `
    <div>
      <label class="field-label">頭像</label>
      <p class="helper-text mb-2">
        上排可上傳照片（即時儲存），下排為 Q 版造型；選好後請按「儲存設定」
      </p>

      <p
        *ngIf="slotMessage"
        class="caption-text mb-2 text-center"
        [class.text-coral]="slotError"
        [class.text-mint]="!slotError"
      >
        {{ slotMessage }}
      </p>

      <div class="avatar-picker-grid">
        <div
          *ngFor="let slot of avatarSlotIds"
          class="avatar-picker-cell"
          [class.avatar-picker-cell--selected]="isSlotSelected(slot)"
        >
          <button
            *ngIf="!hasSlot(slot)"
            type="button"
            class="avatar-picker-cell__button avatar-picker-cell__button--empty"
            [disabled]="slotBusy"
            [attr.aria-label]="'上傳頭像槽位 ' + slot"
            (click)="openFilePicker(slot)"
          >
            <span class="avatar-picker-cell__plus" aria-hidden="true">＋</span>
            <span class="avatar-picker-cell__label">槽位 {{ slot }}</span>
          </button>

          <button
            *ngIf="hasSlot(slot)"
            type="button"
            class="avatar-picker-cell__button"
            [disabled]="slotBusy"
            [attr.aria-label]="'選擇槽位 ' + slot + ' 為頭像'"
            [attr.aria-pressed]="isSlotSelected(slot)"
            (click)="selectSlot(slot)"
          >
            <img
              *ngIf="slotPreviewUrls[slot]"
              class="avatar-picker-cell__photo"
              [src]="slotPreviewUrls[slot]"
              alt=""
            />
          </button>

          <div *ngIf="hasSlot(slot)" class="avatar-picker-cell__actions">
            <button
              type="button"
              class="avatar-picker-cell__action"
              [disabled]="slotBusy"
              (click)="openFilePicker(slot)"
            >
              更換
            </button>
            <button
              type="button"
              class="avatar-picker-cell__action avatar-picker-cell__action--danger"
              [disabled]="slotBusy"
              (click)="removeSlot(slot)"
            >
              刪除
            </button>
          </div>
        </div>

        <button
          *ngFor="let svgId of chibiIds"
          type="button"
          class="avatar-picker-cell__button avatar-picker-cell__button--svg"
          [class.avatar-picker-cell--selected]="isSvgSelected(svgId)"
          [attr.aria-label]="'選擇 Q 版造型 ' + svgId"
          [attr.aria-pressed]="isSvgSelected(svgId)"
          (click)="selectSvg(svgId)"
        >
          <app-member-chibi-head [chibiId]="svgId" [size]="48" />
        </button>
      </div>
    </div>

    <input
      #fileInput
      type="file"
      accept="image/*"
      class="sr-only"
      (change)="onFileSelected($event)"
    />
  `,
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
