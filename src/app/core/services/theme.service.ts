import { Injectable } from '@angular/core';
import { DEFAULT_THEME, DisplayMember, ThemeColors } from '../models';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private active: ThemeColors = { ...DEFAULT_THEME };

  applyTheme(theme: ThemeColors): void {
    this.active = { ...theme };
    const root = document.documentElement;
    root.style.setProperty('--theme-peach', this.active.peach);
    root.style.setProperty('--theme-cream', this.active.cream);
    root.style.setProperty('--theme-mint', this.active.mint);
    root.style.setProperty('--theme-lavender', this.active.lavender);
    root.style.setProperty('--theme-coral', this.active.coral);
    root.style.setProperty('--theme-ink', '#3D3D3D');

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', this.active.peach);
    }
  }

  applyForMember(member: DisplayMember | null): void {
    if (member) {
      this.applyTheme(member.theme);
    } else {
      this.applyTheme(DEFAULT_THEME);
    }
  }

  get current(): ThemeColors {
    return this.active;
  }
}
