/**
 * 用 visualViewport 判斷虛擬鍵盤是否開啟。
 * 比單純 focus/blur 穩：iOS 收鍵盤後 input 常仍 focused，或捲動時會誤觸 blur。
 */
export type VirtualKeyboardChange = (open: boolean) => void;

const KEYBOARD_COVER_PX = 120;

export function isVirtualKeyboardOpen(): boolean {
  if (typeof window === 'undefined') return false;
  const vv = window.visualViewport;
  if (!vv) return false;
  const covered = window.innerHeight - vv.height - vv.offsetTop;
  return covered > KEYBOARD_COVER_PX;
}

export class VirtualKeyboardMonitor {
  private open = false;
  private listening = false;
  private onChange: VirtualKeyboardChange | null = null;

  private readonly handleViewportChange = (): void => {
    this.sync();
  };

  start(onChange: VirtualKeyboardChange): void {
    this.onChange = onChange;
    if (this.listening) {
      this.sync();
      return;
    }
    this.listening = true;

    const vv = window.visualViewport;
    vv?.addEventListener('resize', this.handleViewportChange);
    vv?.addEventListener('scroll', this.handleViewportChange);
    window.addEventListener('resize', this.handleViewportChange);
    this.sync();
  }

  stop(): void {
    if (!this.listening) return;
    this.listening = false;

    const vv = window.visualViewport;
    vv?.removeEventListener('resize', this.handleViewportChange);
    vv?.removeEventListener('scroll', this.handleViewportChange);
    window.removeEventListener('resize', this.handleViewportChange);

    this.setOpen(false);
    this.onChange = null;
  }

  get isOpen(): boolean {
    return this.open;
  }

  private sync(): void {
    this.setOpen(isVirtualKeyboardOpen());
  }

  private setOpen(next: boolean): void {
    if (this.open === next) return;
    this.open = next;
    this.onChange?.(next);
  }
}
