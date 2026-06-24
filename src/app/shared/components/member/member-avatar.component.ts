import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
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
} from '../../../core/models';
import { AvatarService } from '../../../core/services/avatar.service';
import { MemberChibiHeadComponent } from './member-chibi-head.component';

/** 與 `--motion-skeleton-threshold` 一致，避免快取命中時閃一下 skeleton */
const SKELETON_THRESHOLD_MS = 150;

@Component({
  selector: 'app-member-avatar',
  standalone: true,
  imports: [CommonModule, MemberChibiHeadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './member-avatar.component.html',
})
export class MemberAvatarComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) member!: Member | DisplayMember;
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' = 'md';

  @ViewChild('photoImg') private photoImg?: ElementRef<HTMLImageElement>;

  slotImageSrc: string | null = null;
  chibiId: ChibiId = 'chibi-1';
  photoLoading = false;
  showSkeleton = false;
  imageReady = false;

  private lastRefreshKey = '';
  private refreshToken = 0;
  private skeletonTimer: ReturnType<typeof setTimeout> | null = null;

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

  get showChibi(): boolean {
    if (!this.expectsSlotPhoto()) return true;
    if (this.photoLoading) return false;
    return !this.slotImageSrc || !this.imageReady;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['member'] && !changes['size']) return;

    const key = this.refreshKey();
    if (key === this.lastRefreshKey) return;
    this.lastRefreshKey = key;
    void this.refreshAvatar();
  }

  ngOnDestroy(): void {
    this.clearSkeletonTimer();
  }

  onPhotoLoad(): void {
    this.imageReady = true;
    this.endPhotoLoad();
    this.cdr.markForCheck();
  }

  onPhotoError(): void {
    this.slotImageSrc = null;
    this.imageReady = false;
    this.endPhotoLoad();
    this.cdr.markForCheck();
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

  private expectsSlotPhoto(): boolean {
    const choice = this.choice;
    if (choice.type !== 'slot') return false;
    return !!this.slots[String(choice.slot) as '1' | '2' | '3'];
  }

  private beginPhotoLoad(): void {
    this.clearSkeletonTimer();
    this.photoLoading = true;
    this.showSkeleton = false;
    this.imageReady = false;
    this.skeletonTimer = setTimeout(() => {
      if (this.photoLoading) {
        this.showSkeleton = true;
        this.cdr.markForCheck();
      }
    }, SKELETON_THRESHOLD_MS);
  }

  private endPhotoLoad(): void {
    this.clearSkeletonTimer();
    this.photoLoading = false;
    this.showSkeleton = false;
  }

  private clearSkeletonTimer(): void {
    if (this.skeletonTimer !== null) {
      clearTimeout(this.skeletonTimer);
      this.skeletonTimer = null;
    }
  }

  private async refreshAvatar(): Promise<void> {
    const token = ++this.refreshToken;
    const choice = this.choice;
    this.chibiId = effectiveChibiId(this.member.id, choice);

    if (!this.expectsSlotPhoto()) {
      this.endPhotoLoad();
      this.slotImageSrc = null;
      this.imageReady = false;
      if (token === this.refreshToken) this.cdr.markForCheck();
      return;
    }

    this.beginPhotoLoad();
    this.slotImageSrc = null;

    if (choice.type !== 'slot') return;

    const version = this.slots[String(choice.slot) as '1' | '2' | '3']!;
    const url = await this.avatars.getSlotUrl(
      this.member.id,
      choice.slot,
      version
    );
    if (token !== this.refreshToken) return;

    if (!url) {
      this.endPhotoLoad();
      this.cdr.markForCheck();
      return;
    }

    this.slotImageSrc = `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
    this.cdr.markForCheck();
    this.scheduleCachedPhotoCheck();
  }

  private scheduleCachedPhotoCheck(): void {
    setTimeout(() => this.tryCompleteCachedPhoto());
  }

  private tryCompleteCachedPhoto(): void {
    const el = this.photoImg?.nativeElement;
    if (!el || !this.photoLoading || this.imageReady) return;
    if (el.complete && el.naturalWidth > 0) {
      this.onPhotoLoad();
    } else if (el.complete) {
      this.onPhotoError();
    }
  }
}
