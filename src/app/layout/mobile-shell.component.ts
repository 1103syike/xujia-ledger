import { Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  NavigationEnd,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  ChildrenOutletContexts,
} from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../core/services/auth.service';
import { displayNameOf } from '../core/models';
import { MemberAvatarComponent } from '../shared/components/member/member-avatar.component';
import { AppLogoComponent } from '../shared/components/branding/app-logo.component';
import { COPY_ACTIONS, COPY_NAV } from '../copy';
import { prefetchTransactionCreateRoute } from '../core/routing/lazy-routes';
import {
  RouteMotionKind,
  resolveRouteMotionKind,
  routeMotionParams,
  tabIndexFromUrl,
} from '../core/routing/route-tab-nav';
import { routeTabSlide } from '../animations/route.animations';
import { AnimationEvent } from '@angular/animations';

@Component({
  selector: 'app-mobile-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MemberAvatarComponent,
    AppLogoComponent,
  ],
  templateUrl: './mobile-shell.component.html',
  animations: [routeTabSlide],
})
export class MobileShellComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  nav = COPY_NAV;
  actions = COPY_ACTIONS;
  displayNameOf = displayNameOf;
  headerCompact = false;
  fabRipple = false;
  navRippleIndex: number | null = null;
  routeMotionKind: RouteMotionKind = 'crossfade';
  routeOutletMinHeight: string | null = null;
  private pendingScrollReset = false;
  private navigatingToConsolidateSelect = false;

  /** 收起門檻（往下捲超過此值才收合） */
  private readonly collapseAt = 72;
  /** 展開門檻（往上捲回到此值以下才展開，與收起分開避免抖動） */
  private readonly expandAt = 12;

  constructor(
    public auth: AuthService,
    private contexts: ChildrenOutletContexts,
    private router: Router
  ) {
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationStart => event instanceof NavigationStart
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        const fromUrl = this.router.url;
        const toUrl = event.url;
        const fromTab = tabIndexFromUrl(fromUrl);
        const toTab = tabIndexFromUrl(toUrl);

        this.routeMotionKind = resolveRouteMotionKind(fromUrl, toUrl);
        this.pendingScrollReset =
          fromTab >= 0 && toTab >= 0 && fromTab !== toTab;

        const toPath = event.url.split('?')[0] ?? '';
        this.navigatingToConsolidateSelect =
          toPath === '/transactions' && event.url.includes('consolidate=1');
      });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.navigatingToConsolidateSelect = false;
        if (!this.pendingScrollReset) return;
        this.pendingScrollReset = false;
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      });
  }

  ngOnInit(): void {
    const schedule =
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 300);
    schedule(() => prefetchTransactionCreateRoute());
  }

  get activeTabIndex(): number {
    return tabIndexFromUrl(this.router.url);
  }

  prefetchCreateRoute(): void {
    prefetchTransactionCreateRoute();
  }

  onRecordFabPress(event: PointerEvent): void {
    if (event.button !== 0) return;

    this.fabRipple = false;
    requestAnimationFrame(() => {
      this.fabRipple = true;
      window.setTimeout(() => {
        this.fabRipple = false;
      }, 480);
    });
  }

  onNavPress(event: PointerEvent, index: number): void {
    if (event.button !== 0) return;

    this.navRippleIndex = null;
    requestAnimationFrame(() => {
      this.navRippleIndex = index;
      window.setTimeout(() => {
        this.navRippleIndex = null;
      }, 420);
    });
  }

  /** 記一筆／編輯頁、整合勾選：隱藏 FAB 與底部導覽 */
  get hideBottomNav(): boolean {
    return (
      this.isCreateFlow ||
      this.isConsolidateSelectFlow ||
      this.navigatingToConsolidateSelect
    );
  }

  get showRecordFab(): boolean {
    return !this.hideBottomNav;
  }

  private get isConsolidateSelectFlow(): boolean {
    const path = this.router.url.split('?')[0] ?? '';
    if (path !== '/transactions') return false;
    return this.router.parseUrl(this.router.url).queryParams['consolidate'] === '1';
  }

  private get isCreateFlow(): boolean {
    const path = this.router.url.split('?')[0] ?? '';
    return (
      path === '/transactions/new' ||
      /^\/transactions\/[^/]+\/edit$/.test(path)
    );
  }

  get addRecordQueryParams(): { with: string } | null {
    const parsed = this.router.parseUrl(this.router.url);
    const withFromQuery = parsed.queryParams['with'];
    if (withFromQuery) {
      return { with: withFromQuery };
    }

    const memberId =
      this.router.routerState.snapshot.root.firstChild?.params['id'];
    const memberRoute =
      this.router.routerState.snapshot.root.firstChild?.routeConfig?.path;
    if (memberRoute === 'members/:id' && memberId) {
      return { with: memberId };
    }

    return null;
  }

  routeAnimationState(): string {
    return this.contexts.getContext('primary')?.route?.snapshot.url.join('/') ?? '';
  }

  routeAnimationParams(): Record<string, string | number> {
    const motion = routeMotionParams(this.routeMotionKind);
    return {
      enterX: motion.enterX,
      enterY: motion.enterY,
      leaveX: motion.leaveX,
      leaveY: motion.leaveY,
      enterScale: motion.enterScale,
      leaveScale: motion.leaveScale,
    };
  }

  onRouteAnimStart(event: AnimationEvent): void {
    const height = (event.element as HTMLElement).offsetHeight;
    if (height > 0) {
      this.routeOutletMinHeight = `${height}px`;
    }
  }

  onRouteAnimDone(): void {
    this.routeOutletMinHeight = null;
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const y = window.scrollY;

    if (!this.headerCompact && y > this.collapseAt) {
      this.headerCompact = true;
    } else if (this.headerCompact && y < this.expandAt) {
      this.headerCompact = false;
    }
  }
}
