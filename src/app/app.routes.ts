import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';
import { loadTransactionCreateComponent } from './core/routing/lazy-routes';
import { MobileShellComponent } from './layout/mobile-shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
  },
  {
    path: '',
    component: MobileShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'transactions',
        loadComponent: () =>
          import('./features/transactions/list/transaction-list.component').then(
            (m) => m.TransactionListComponent
          ),
      },
      {
        path: 'transactions/new',
        loadComponent: loadTransactionCreateComponent,
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'transactions/:id/edit',
        loadComponent: loadTransactionCreateComponent,
        data: { edit: true },
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'transactions/:id',
        loadComponent: () =>
          import('./features/transactions/detail/transaction-detail.component').then(
            (m) => m.TransactionDetailComponent
          ),
      },
      {
        path: 'members/:id',
        loadComponent: () =>
          import('./features/members/member-ledger.component').then(
            (m) => m.MemberLedgerComponent
          ),
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./features/audit/audit.component').then(
            (m) => m.AuditComponent
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(
            (m) => m.SettingsComponent
          ),
      },
      { path: 'expenses', redirectTo: 'transactions', pathMatch: 'full' },
      { path: 'expenses/new', redirectTo: 'transactions/new', pathMatch: 'full' },
      { path: 'expenses/:id', redirectTo: 'transactions/:id' },
      { path: 'expenses/:id/edit', redirectTo: 'transactions/:id/edit' },
      { path: 'pending', redirectTo: '' },
    ],
  },
  { path: '**', redirectTo: '' },
];
