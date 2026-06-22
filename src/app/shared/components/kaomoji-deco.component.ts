import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KaomojiMood, pickKaomoji } from '../../core/utils/kaomoji-pools';

@Component({
  selector: 'app-kaomoji-deco',
  standalone: true,
  imports: [CommonModule],
  template: `
    <p class="kaomoji-deco" [class.kaomoji-deco--sm]="size === 'sm'">{{ face }}</p>
  `,
})
export class KaomojiDecoComponent {
  @Input({ required: true }) mood!: KaomojiMood;
  @Input() seed = 'deco';
  @Input() salt = 0;
  @Input() size: 'md' | 'sm' = 'md';

  get face(): string {
    return pickKaomoji(this.mood, this.seed, this.salt);
  }
}
