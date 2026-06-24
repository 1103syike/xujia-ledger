import { ApplicationConfig, isDevMode } from '@angular/core';
import { provideRouter, withPreloading } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { CreateRoutePreloadStrategy } from './core/routing/create-route-preload.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withPreloading(CreateRoutePreloadStrategy)),
    provideAnimations(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
