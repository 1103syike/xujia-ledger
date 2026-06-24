import {
  resolveRouteMotionKind,
  routeMotionParams,
  tabIndexFromUrl,
} from './route-tab-nav';

describe('route-tab-nav', () => {
  it('maps main tab urls to indices', () => {
    expect(tabIndexFromUrl('/')).toBe(0);
    expect(tabIndexFromUrl('/transactions')).toBe(1);
    expect(tabIndexFromUrl('/transactions/abc')).toBe(1);
    expect(tabIndexFromUrl('/audit')).toBe(2);
    expect(tabIndexFromUrl('/settings')).toBe(3);
    expect(tabIndexFromUrl('/members/x')).toBe(-1);
  });

  it('resolves tab slide direction', () => {
    expect(resolveRouteMotionKind('/', '/audit')).toBe('tab-forward');
    expect(resolveRouteMotionKind('/settings', '/')).toBe('tab-back');
  });

  it('resolves drill push and pop', () => {
    expect(resolveRouteMotionKind('/transactions', '/transactions/1')).toBe(
      'push'
    );
    expect(resolveRouteMotionKind('/transactions/1', '/transactions')).toBe(
      'pop'
    );
  });

  it('exposes motion params for each kind', () => {
    expect(routeMotionParams('tab-forward').enterX).toBe('24px');
    expect(routeMotionParams('crossfade').enterY).toBe('10px');
  });
});
