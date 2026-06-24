import { Observable } from 'rxjs';

export interface HasUnsavedChanges {
  canDeactivate(): boolean | Observable<boolean> | Promise<boolean>;
}
