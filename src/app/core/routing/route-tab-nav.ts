/** 底部導覽四個主分頁的索引 */
export const MAIN_TAB_COUNT = 4;

export type RouteMotionKind =
  | 'tab-forward'
  | 'tab-back'
  | 'push'
  | 'pop'
  | 'crossfade';

export type RouteMotionParams = {
  enterX: string;
  enterY: string;
  leaveX: string;
  leaveY: string;
  enterScale: number;
  leaveScale: number;
};

const MOTION_BY_KIND: Record<RouteMotionKind, RouteMotionParams> = {
  'tab-forward': {
    enterX: '24px',
    enterY: '0px',
    leaveX: '-18px',
    leaveY: '0px',
    enterScale: 0.97,
    leaveScale: 0.98,
  },
  'tab-back': {
    enterX: '-24px',
    enterY: '0px',
    leaveX: '18px',
    leaveY: '0px',
    enterScale: 0.97,
    leaveScale: 0.98,
  },
  push: {
    enterX: '0px',
    enterY: '16px',
    leaveX: '0px',
    leaveY: '-8px',
    enterScale: 0.96,
    leaveScale: 0.99,
  },
  pop: {
    enterX: '0px',
    enterY: '-8px',
    leaveX: '0px',
    leaveY: '12px',
    enterScale: 0.99,
    leaveScale: 0.97,
  },
  crossfade: {
    enterX: '0px',
    enterY: '10px',
    leaveX: '0px',
    leaveY: '-6px',
    enterScale: 0.98,
    leaveScale: 0.99,
  },
};

export function tabIndexFromUrl(url: string): number {
  const path = url.split('?')[0].replace(/^\//, '');
  const [root = ''] = path.split('/');

  if (!root || root === 'pending') return 0;
  if (root === 'transactions') return 1;
  if (root === 'audit') return 2;
  if (root === 'settings') return 3;
  return -1;
}

function urlDepth(url: string): number {
  const path = url.split('?')[0].replace(/^\//, '');
  if (!path) return 0;
  return path.split('/').filter(Boolean).length;
}

export function resolveRouteMotionKind(
  fromUrl: string,
  toUrl: string
): RouteMotionKind {
  const fromTab = tabIndexFromUrl(fromUrl);
  const toTab = tabIndexFromUrl(toUrl);

  if (fromTab >= 0 && toTab >= 0 && fromTab !== toTab) {
    return toTab > fromTab ? 'tab-forward' : 'tab-back';
  }

  const fromDepth = urlDepth(fromUrl);
  const toDepth = urlDepth(toUrl);

  if (toDepth > fromDepth) return 'push';
  if (toDepth < fromDepth) return 'pop';

  return 'crossfade';
}

export function routeMotionParams(kind: RouteMotionKind): RouteMotionParams {
  return MOTION_BY_KIND[kind];
}
