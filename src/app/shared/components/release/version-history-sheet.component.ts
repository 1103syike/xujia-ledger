import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CURRENT_APP_VERSION,
  RELEASE_HISTORY,
  ReleaseEntry,
  formatReleaseDate,
  isMajorRelease as isMajorVersion,
  versionLine,
} from '../../../core/release/release-history';
import { sheetOverlay, sheetPanel } from '../../../animations/route.animations';

export type ReleaseLineGroup = {
  line: string;
  major: ReleaseEntry;
  minors: ReleaseEntry[];
};

function buildReleaseGroups(releases: ReleaseEntry[]): ReleaseLineGroup[] {
  const groups: ReleaseLineGroup[] = [];

  for (const entry of releases) {
    if (isMajorVersion(entry.version)) {
      groups.push({ line: entry.version, major: entry, minors: [] });
      continue;
    }

    const line = versionLine(entry.version);
    const current = groups[groups.length - 1];
    if (current && current.line === line) {
      current.minors.push(entry);
    } else {
      groups.push({ line, major: entry, minors: [] });
    }
  }

  return groups;
}

@Component({
  selector: 'app-version-history-sheet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './version-history-sheet.component.html',
  animations: [sheetOverlay, sheetPanel],
})
export class VersionHistorySheetComponent implements OnChanges {
  @Input() open = false;
  @Output() closed = new EventEmitter<void>();

  readonly currentVersion = CURRENT_APP_VERSION;
  readonly groups = buildReleaseGroups(RELEASE_HISTORY);
  formatReleaseDate = formatReleaseDate;

  /** 各線獨立開關；預設只開目前版本那一條 */
  private expandedLines = new Set<string>([versionLine(CURRENT_APP_VERSION)]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.expandedLines = new Set([versionLine(CURRENT_APP_VERSION)]);
    }
  }

  isLineExpanded(line: string): boolean {
    return this.expandedLines.has(line);
  }

  /** 目前版本所屬的大版本線 → 實心 */
  isCurrentLine(line: string): boolean {
    return versionLine(this.currentVersion) === line;
  }

  /** 目前精確版本 → 實心；其餘空心 */
  isCurrentRelease(version: string): boolean {
    return version === this.currentVersion;
  }

  toggleLine(line: string, event?: Event): void {
    event?.stopPropagation();
    const next = new Set(this.expandedLines);
    if (next.has(line)) {
      next.delete(line);
    } else {
      next.add(line);
    }
    this.expandedLines = next;
  }

  trackGroup(_index: number, group: ReleaseLineGroup): string {
    return group.line;
  }

  trackRelease(_index: number, entry: ReleaseEntry): string {
    return entry.version;
  }

  close(): void {
    this.closed.emit();
  }
}
