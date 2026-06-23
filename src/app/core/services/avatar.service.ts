import { Injectable } from '@angular/core';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { firebaseStorage } from '../config/firebase';
import { AvatarSlotId } from '../models';

@Injectable({ providedIn: 'root' })
export class AvatarService {
  private readonly urlCache = new Map<string, string>();

  slotPath(memberId: string, slot: AvatarSlotId): string {
    return `avatars/${memberId}/slot-${slot}.webp`;
  }

  invalidateSlot(memberId: string, slot: AvatarSlotId): void {
    for (const key of [...this.urlCache.keys()]) {
      if (key.startsWith(`${memberId}:${slot}:`)) {
        this.urlCache.delete(key);
      }
    }
  }

  async getSlotUrl(
    memberId: string,
    slot: AvatarSlotId,
    version?: string
  ): Promise<string | null> {
    if (!version) return null;

    const cacheKey = `${memberId}:${slot}:${version}`;
    const cached = this.urlCache.get(cacheKey);
    if (cached) return cached;

    try {
      const url = await getDownloadURL(
        ref(firebaseStorage, this.slotPath(memberId, slot))
      );
      this.urlCache.set(cacheKey, url);
      return url;
    } catch {
      return null;
    }
  }

  async uploadSlot(
    memberId: string,
    slot: AvatarSlotId,
    blob: Blob
  ): Promise<string | null> {
    try {
      await uploadBytes(ref(firebaseStorage, this.slotPath(memberId, slot)), blob, {
        contentType: 'image/webp',
      });
      this.invalidateSlot(memberId, slot);
      return null;
    } catch {
      return '上傳失敗，請稍後再試';
    }
  }

  async deleteSlotFile(
    memberId: string,
    slot: AvatarSlotId
  ): Promise<string | null> {
    try {
      await deleteObject(ref(firebaseStorage, this.slotPath(memberId, slot)));
      this.invalidateSlot(memberId, slot);
      return null;
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code: string }).code)
          : '';
      if (code === 'storage/object-not-found') return null;
      return '刪除失敗，請稍後再試';
    }
  }
}
