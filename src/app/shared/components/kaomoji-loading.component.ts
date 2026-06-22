import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

const FACES = [
  '(｡･ω･｡)ﾉ',
  '(๑•̀ㅂ•́)و✧',
  '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧',
  '(⌐■_■)',
  '(づ｡◕‿‿◕｡)づ',
  '٩(ˊᗜˋ*)و',
];

@Component({
  selector: 'app-kaomoji-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-cream/92 px-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <p class="section-title mb-4 min-h-[2rem] text-center">{{ face }}</p>
      <div class="h-2.5 w-56 overflow-hidden rounded-full bg-peach/20">
        <div class="loading-bar h-full rounded-full"></div>
      </div>
      <p class="helper-text mt-3">{{ message }}</p>
    </div>
  `,
})
export class KaomojiLoadingComponent implements OnInit, OnDestroy {
  @Input() message = '載入中，請稍候';

  face = FACES[0];
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    let i = 0;
    this.timer = setInterval(() => {
      i = (i + 1) % FACES.length;
      this.face = FACES[i];
    }, 480);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
