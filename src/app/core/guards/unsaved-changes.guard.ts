import { CanDeactivateFn } from '@angular/router';
import { from, isObservable, Observable, of } from 'rxjs';
import { HasUnsavedChanges } from '../forms/unsaved-changes';

export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (
  component
) => {
  if (!component?.canDeactivate) {
    return true;
  }
  const result = component.canDeactivate();
  if (typeof result === 'boolean') {
    return result;
  }
  if (result instanceof Promise) {
    return from(result);
  }
  if (isObservable(result)) {
    return result as Observable<boolean>;
  }
  return of(true);
};
