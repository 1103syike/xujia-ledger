import {
  animate,
  group,
  query,
  style,
  transition,
  trigger,
} from '@angular/animations';

const PAGE_DURATION = '280ms';
const PAGE_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/** 主分頁／內頁切換：離開頁疊在上層滑出，進入頁留在文檔流撐開高度 */
export const routeTabSlide = trigger('routeTabSlide', [
  transition('* <=> *', [
    group([
      query(
        ':leave',
        [
          style({
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            width: '100%',
            zIndex: 2,
            opacity: 1,
            transform: 'none',
            willChange: 'transform, opacity',
          }),
          animate(
            `${PAGE_DURATION} ${PAGE_EASE}`,
            style({
              opacity: 0,
              transform:
                'translate3d({{ leaveX }}, {{ leaveY }}, 0) scale({{ leaveScale }})',
            })
          ),
        ],
        { optional: true }
      ),
      query(
        ':enter',
        [
          style({
            opacity: 0,
            transform:
              'translate3d({{ enterX }}, {{ enterY }}, 0) scale({{ enterScale }})',
            willChange: 'transform, opacity',
          }),
          animate(
            `${PAGE_DURATION} ${PAGE_EASE}`,
            style({ opacity: 1, transform: 'none' })
          ),
        ],
        { optional: true }
      ),
    ]),
  ], {
    params: {
      enterX: '0px',
      enterY: '10px',
      leaveX: '0px',
      leaveY: '-6px',
      enterScale: 0.98,
      leaveScale: 0.99,
    },
  }),
]);

/** @deprecated 使用 routeTabSlide */
export const routeFadeSlide = routeTabSlide;

/** Dialog 遮罩 */
export const dialogOverlay = trigger('dialogOverlay', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate('200ms ease-out', style({ opacity: 1 })),
  ]),
  transition(':leave', [animate('150ms ease-in', style({ opacity: 0 }))]),
]);

/** Dialog 面板 */
export const dialogPanel = trigger('dialogPanel', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.96) translateY(8px)' }),
    animate(
      '250ms cubic-bezier(0.34, 1.2, 0.64, 1)',
      style({ opacity: 1, transform: 'none' })
    ),
  ]),
  transition(':leave', [
    animate(
      '200ms ease-in',
      style({ opacity: 0, transform: 'scale(0.98) translateY(4px)' })
    ),
  ]),
]);

/** Bottom sheet 遮罩 */
export const sheetOverlay = trigger('sheetOverlay', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate('200ms ease-out', style({ opacity: 1 })),
  ]),
  transition(':leave', [animate('200ms ease-in', style({ opacity: 0 }))]),
]);

/** Bottom sheet 面板 */
export const sheetPanel = trigger('sheetPanel', [
  transition(':enter', [
    style({ transform: 'translateY(100%)' }),
    animate('280ms cubic-bezier(0.2, 0.8, 0.2, 1)', style({ transform: 'none' })),
  ]),
  transition(':leave', [
    animate('220ms ease-in', style({ transform: 'translateY(100%)' })),
  ]),
]);
