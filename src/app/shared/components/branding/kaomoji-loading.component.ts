import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { pickKaomoji } from '../../../core/display/kaomoji-pools';

@Component({
  selector: 'app-kaomoji-loading',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kaomoji-loading.component.html',

})
export class KaomojiLoadingComponent implements OnInit, OnDestroy {
  @Input() message = '載入中，請稍候';

  face = pickKaomoji('login', 'loading', 0);
  private timer?: ReturnType<typeof setInterval>;
  private tick = 0;

  ngOnInit(): void {
    this.timer = setInterval(() => {
      this.tick++;
      this.face = pickKaomoji('login', 'loading', this.tick);
    }, 480);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
