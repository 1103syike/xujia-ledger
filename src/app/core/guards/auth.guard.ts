import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.authReady$.pipe(
    filter((ready) => ready),
    take(1),
    switchMap(() => auth.currentMember$),
    take(1),
    map((member) => (member ? true : router.createUrlTree(['/login'])))
  );
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.authReady$.pipe(
    filter((ready) => ready),
    take(1),
    switchMap(() => auth.currentMember$),
    take(1),
    map((member) => (member ? router.createUrlTree(['/']) : true))
  );
};
