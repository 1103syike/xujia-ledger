import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';
import { prefetchTransactionCreateRoute } from './lazy-routes';

/** App 穩定後預載高頻路由（記一筆） */
@Injectable({ providedIn: 'root' })
export class CreateRoutePreloadStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    const path = route.path ?? '';
    if (path === 'transactions/new' || path === 'transactions/:id/edit') {
      prefetchTransactionCreateRoute();
      return load();
    }
    return of(null);
  }
}
