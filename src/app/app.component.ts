import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { KaomojiLoadingComponent } from './shared/components/kaomoji-loading.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, KaomojiLoadingComponent],
  template: `
    <app-kaomoji-loading *ngIf="!authReady" message="正在載入，請稍候" />
    <router-outlet />
  `,
  styles: [`:host { display: block; min-height: 100%; }`],
})
export class AppComponent implements OnInit {
  authReady = false;

  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    this.auth.authReady$.subscribe((ready) => {
      this.authReady = ready;
    });
  }
}
