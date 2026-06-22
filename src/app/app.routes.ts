import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
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
        path: 'expenses',
        loadComponent: () =>
          import('./features/expenses/expense-list.component').then(
            (m) => m.ExpenseListComponent
          ),
      },
      {
        path: 'expenses/new',
        loadComponent: () =>
          import('./features/expenses/expense-create.component').then(
            (m) => m.ExpenseCreateComponent
          ),
      },
      {
        path: 'expenses/:id',
        loadComponent: () =>
          import('./features/expenses/expense-detail.component').then(
            (m) => m.ExpenseDetailComponent
          ),
      },
      {
        path: 'pending',
        loadComponent: () =>
          import('./features/pending/pending.component').then(
            (m) => m.PendingComponent
          ),
      },
      {
        path: 'audit',
        loadComponent: () =>
          import('./features/audit/audit.component').then(
            (m) => m.AuditComponent
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
