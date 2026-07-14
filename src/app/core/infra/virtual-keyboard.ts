/**
 * 用 visualViewport 相對基準高度判斷虛擬鍵盤。
 * iOS 常讓 innerHeight 跟 visualViewport 一起縮，不能用兩者相減。
 */
export type VirtualKeyboardChange = (open: boolean) => void;

const KEYBOARD_DROP_PX = 100;

export class VirtualKeyboardMonitor {
  private open = false;
  private listening = false;
  private baselineHeight = 0;
  private onChange: VirtualKeyboardChange | null = null;

  private readonly handleViewportChange = (): void => {
    this.sync();
  };

  start(onChange: VirtualKeyboardChange): void {
    this.onChange = onChange;

    if (!this.listening) {
      this.listening = true;
      this.baselineHeight = this.currentHeight();

      const vv = window.visualViewport;
      vv?.addEventListener('resize', this.handleViewportChange);
      vv?.addEventListener('scroll', this.handleViewportChange);
      window.addEventListener('resize', this.handleViewportChange);
    }

    // 下一幀再量一次，鍵盤常在 focus 後才開始升起
    requestAnimationFrame(() => this.sync());
    window.setTimeout(() => this.sync(), 120);
    window.setTimeout(() => this.sync(), 320);
  }

  stop(): void {
    if (!this.listening) return;
    this.listening = false;

    const vv = window.visualViewport;
    vv?.removeEventListener('resize', this.handleViewportChange);
    vv?.removeEventListener('scroll', this.handleViewportChange);
    window.removeEventListener('resize', this.handleViewportChange);

    this.baselineHeight = 0;
    this.setOpen(false);
    this.onChange = null;
  }

  get isOpen(): boolean {
    return this.open;
  }

  private currentHeight(): number {
    return window.visualViewport?.height ?? window.innerHeight;
  }

  private sync(): void {
    if (!this.listening) return;

    const height = this.currentHeight();

    // 還原到接近基準 → 視為鍵盤已關，並刷新基準（旋轉螢幕等）
    if (this.baselineHeight > 0 && height >= this.baselineHeight - 24) {
      this.baselineHeight = Math.max(this.baselineHeight, height);
      this.setOpen(false);
      return;
    }

    // 相對 focus 當下的高度大幅下降 → 鍵盤開著
    if (this.baselineHeight <= 0) {
      this.baselineHeight = height;
      this.setOpen(false);
      return;
    }

    this.setOpen(height < this.baselineHeight - KEYBOARD_DROP_PX);
  }

  private setOpen(next: boolean): void {
    if (this.open === next) return;
    this.open = next;
    this.onChange?.(next);
  }
}
