import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-app-logo',
  standalone: true,
  templateUrl: './app-logo.component.html',

})
export class AppLogoComponent {
  @Input() size = 80;
  @Input() label = '';
}
