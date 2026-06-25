import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CURRENT_APP_VERSION,
  RELEASE_HISTORY,
  ReleaseEntry,
  formatReleaseDate,
  isMajorBump,
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

  isMajorBump(index: number): boolean {
    if (index >= this.releases.length - 1) return false;
    return isMajorBump(this.releases[index + 1].version, this.releases[index].version);
  }

  trackRelease(_index: number, entry: ReleaseEntry): string {
    return entry.version;
  }

  close(): void {
    this.closed.emit();
  }
}
