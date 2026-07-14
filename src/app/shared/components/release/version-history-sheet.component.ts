import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CURRENT_APP_VERSION,
  RELEASE_HISTORY,
  ReleaseEntry,
  formatReleaseDate,
  isHighlightedRelease,
} from '../../../core/release/release-history';
import { sheetOverlay, sheetPanel } from '../../../animations/route.animations';

@Component({
  selector: 'app-version-history-sheet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './version-history-sheet.component.html',
  animations: [sheetOverlay, sheetPanel],
})
export class VersionHistorySheetComponent {
  @Input() open = false;
  @Output() closed = new EventEmitter<void>();

  readonly currentVersion = CURRENT_APP_VERSION;
  readonly releases = RELEASE_HISTORY;
  formatReleaseDate = formatReleaseDate;

  isMajorRelease(index: number): boolean {
    return isHighlightedRelease(index, this.releases);
  }

  trackRelease(_index: number, entry: ReleaseEntry): string {
    return entry.version;
  }

  close(): void {
    this.closed.emit();
  }
}
