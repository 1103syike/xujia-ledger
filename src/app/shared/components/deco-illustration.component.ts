import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ILLUSTRATIONS,
  IllustrationKind,
} from '../constants/illustrations';

@Component({
  selector: 'app-deco-illustration',
  standalone: true,
  imports: [CommonModule],
  template: `
    <img
      [src]="src"
      [alt]="alt"
      class="deco-illustration"
      [ngClass]="'deco-illustration--' + kind"
      loading="lazy"
      decoding="async"
    />
  `,
})
export class DecoIllustrationComponent {
  @Input({ required: true }) kind!: IllustrationKind;
  @Input() alt = '';

  get src(): string {
    return ILLUSTRATIONS[this.kind];
  }
}
