import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AvatarChoice,
  AvatarSlotTimestamps,
  ChibiId,
  DisplayMember,
  Member,
  defaultAvatarChoice,
  effectiveChibiId,
  resolveAvatarChoice,
} from '../../core/models';
import { AvatarService } from '../../core/services/avatar.service';
import { MemberChibiHeadComponent } from './member-chibi-head.component';

@Component({
  selector: 'app-member-avatar',
  standalone: true,
  imports: [CommonModule, MemberChibiHeadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './member-avatar.component.html',

})
export class MemberAvatarComponent implements OnChanges {
  @Input({ required: true }) member!: Member | DisplayMember;
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' = 'md';

  slotImageSrc: string | null = null;
  chibiId: ChibiId = 'chibi-1';
  private lastRefreshKey = '';
  private refreshToken = 0;

  constructor(
    private avatars: AvatarService,
    private cdr: ChangeDetectorRef
  ) {}

  get pixelSize(): number {
    switch (this.size) {
      case 'xs':
        return 24;
      case 'sm':
        return 32;
      case 'lg':
        return 44;
      default:
        return 36;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['member'] && !changes['size']) return;

    const key = this.refreshKey();
    if (key === this.lastRefreshKey) return;
    this.lastRefreshKey = key;
    void this.refreshAvatar();
  }

  private refreshKey(): string {
    const choice = this.choice;
    const choiceKey =
      choice.type === 'slot'
        ? `slot:${choice.slot}:${this.slots[String(choice.slot) as '1' | '2' | '3'] ?? ''}`
        : `svg:${choice.svgId}`;
    return `${this.member.id}|${this.size}|${choiceKey}`;
  }

  private get choice(): AvatarChoice {
    if ('avatarChoice' in this.member && this.member.avatarChoice) {
      return resolveAvatarChoice(this.member.id, this.member.avatarChoice);
    }
    return defaultAvatarChoice(this.member.id);
  }

  private get slots(): AvatarSlotTimestamps {
    if ('avatarSlots' in this.member && this.member.avatarSlots) {
      return this.member.avatarSlots;
    }
    return {};
  }

  private async refreshAvatar(): Promise<void> {
    const token = ++this.refreshToken;
    const choice = this.choice;
    this.chibiId = effectiveChibiId(this.member.id, choice);

    if (choice.type !== 'slot') {
      this.slotImageSrc = null;
      if (token === this.refreshToken) this.cdr.markForCheck();
      return;
    }

    const version = this.slots[String(choice.slot) as '1' | '2' | '3'];
    if (!version) {
      this.slotImageSrc = null;
      if (token === this.refreshToken) this.cdr.markForCheck();
      return;
    }

    const url = await this.avatars.getSlotUrl(
      this.member.id,
      choice.slot,
      version
    );
    if (token !== this.refreshToken) return;

    this.slotImageSrc = url
      ? `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`
      : null;
    this.cdr.markForCheck();
  }
}
