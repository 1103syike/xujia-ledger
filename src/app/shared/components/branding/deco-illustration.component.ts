import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ILLUSTRATIONS,
  IllustrationKind,
} from '../../../shared/constants/illustrations';

@Component({
  selector: 'app-deco-illustration',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './deco-illustration.component.html',

})
export class DecoIllustrationComponent {
  @Input({ required: true }) kind!: IllustrationKind;
  @Input() alt = '';

  get src(): string {
    return ILLUSTRATIONS[this.kind];
  }
}
