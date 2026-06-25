export type ReleaseSection = {
  heading: string;
  items: string[];
};

export type ReleaseEntry = {
  version: string;
  releasedAt: string;
  title: string;
  highlights: string[];
  sections?: ReleaseSection[];
  /** 顯示含時分秒的發佈時間 */
  detailedTime?: boolean;
};

/** 目前 App 版本（對應最新一筆 release） */
export const CURRENT_APP_VERSION = '3.1.0';

/**
 * 版本歷程：由 git 紀錄整理，語意化版本獨立於 commit 訊息。
 * 最新在上、最舊在下。
 */
export const RELEASE_HISTORY: ReleaseEntry[] = [
  {
    version: '3.1.0',
    releasedAt: '2026-06-24T17:29:03+08:00',
    detailedTime: true,
    title: '強化動效體驗、導覽轉場與帳本 UI 還原補齊',
    highlights: [],
    sections: [
      {
        heading: '動效與轉場',
        items: [
          '新增 motion tokens、skeleton 元件與 toast 系統',
          '主分頁方向性滑動轉場，修正切換時頁面被裁切',
          '底部導覽滑動指示器、點擊漣漪與圖示彈跳',
        ],
      },
      {
        heading: '記帳 FAB',
        items: ['膠囊形「記一筆／新交易」按鈕與點擊漣漪'],
      },
      {
        heading: '頭像載入',
        items: ['自訂照片載入 skeleton，避免先閃預設頭像'],
      },
      {
        heading: '首頁與帳本',
        items: [
          '首頁帳務合併「跟誰有帳」，可點 pill 結清',
          '帳本成員篩選 chip、日期分組修正',
        ],
      },
      {
        heading: '成員與設定',
        items: ['金主／丐幫幫主 badge、設定頁重構'],
      },
      {
        heading: '整合欠款',
        items: ['勾選模式底部列貼底，隱藏導覽與 FAB'],
      },
      {
        heading: '記帳與表單',
        items: ['未儲存離開 guard、確認對話框排版修正'],
      },
    ],
  },
  {
    version: '3.0.0',
    releasedAt: '2026-06-23T17:29:53+08:00',
    detailedTime: true,
    title: 'core 目錄分層與設計系統',
    highlights: [
      'utils 拆為 ledger／display／infra／consolidation',
      'design tokens、SCSS 模組化、元件目錄整理',
    ],
  },
  {
    version: '2.2.0',
    releasedAt: '2026-06-23T16:43:33+08:00',
    detailedTime: true,
    title: '架構重整與文案集中管理',
    highlights: [
      '抽出 copy/ 文案模組',
      'advance draft、audit diff 與記帳表單重構',
      'app shell 拆分、樣式模組化',
    ],
  },
  {
    version: '2.1.1',
    releasedAt: '2026-06-23T13:56:10+08:00',
    detailedTime: true,
    title: '加深頭像選擇器已選狀態對比色',
    highlights: ['修正代表色預覽在淺色背景下不易辨識'],
  },
  {
    version: '2.1.0',
    releasedAt: '2026-06-23T13:51:25+08:00',
    detailedTime: true,
    title: '墊付分攤、整合欠款與利息結算',
    highlights: [
      'advance allocation、debt consolidation、interest calculator',
      '交易建立／明細／列表大幅擴充',
      '新增 inline transaction list 元件',
    ],
  },
  {
    version: '2.0.2',
    releasedAt: '2026-06-23T09:53:52+08:00',
    detailedTime: true,
    title: '修正分享預覽圖標籤語法',
    highlights: ['修正 og:image 缺少結尾引號'],
  },
  {
    version: '2.0.1',
    releasedAt: '2026-06-23T09:51:32+08:00',
    detailedTime: true,
    title: '更新分享預覽圖',
    highlights: ['og:image 改為角色群組圖'],
  },
  {
    version: '2.0.0',
    releasedAt: '2026-06-23T09:47:43+08:00',
    detailedTime: true,
    title: '交易模型重構與帳本服務升級',
    highlights: [
      'expense 遷移為 transaction 服務與 ledger 計算',
      '自訂頭像上傳、成員帳本頁、登入偏好',
    ],
  },
  {
    version: '1.4.2',
    releasedAt: '2026-06-22T15:29:35+08:00',
    title: '新增 Open Graph 分享預覽',
    highlights: ['og:title、description、image 等社群分享標籤'],
  },
  {
    version: '1.4.1',
    releasedAt: '2026-06-22T15:04:49+08:00',
    title: '修正記帳頁日期選單爆版',
    highlights: ['抽出 date-field 元件並調整樣式'],
  },
  {
    version: '1.4.0',
    releasedAt: '2026-06-22T14:41:35+08:00',
    title: '成員代表色與主題系統擴充',
    highlights: [
      'member profile 色票與 member-color 工具',
      '設定頁代表色選擇',
    ],
  },
  {
    version: '1.3.0',
    releasedAt: '2026-06-22T14:19:18+08:00',
    title: '品牌視覺與日期顯示強化',
    highlights: [
      'app logo、chibi 頭像、kaomoji 裝飾與日期 pipe',
      '登入與 dashboard 體驗調整',
    ],
  },
  {
    version: '1.2.1',
    releasedAt: '2026-06-22T13:25:57+08:00',
    title: '修正行動裝置點擊輸入時畫面放大',
    highlights: ['調整 viewport 與 touch 相關樣式'],
  },
  {
    version: '1.2.0',
    releasedAt: '2026-06-22T13:19:45+08:00',
    title: '正式版核心功能補齊',
    highlights: [
      '首頁帳務洞察、記帳流程擴充、異動紀錄格式化',
      'confirm dialog、kaomoji loading、pending 頁',
    ],
  },
  {
    version: '1.1.0',
    releasedAt: '2026-06-22T11:19:06+08:00',
    title: '成員系統與個人化設定初版',
    highlights: [
      '成員 profile、主題色、頭像與登入流程',
      '設定頁、member picker、Firestore 規則調整',
    ],
  },
  {
    version: '1.0.0',
    releasedAt: '2026-06-22T09:21:26+08:00',
    title: '許家帳本初版上線',
    highlights: [
      'Angular、Firestore、PWA 與 Tailwind 基礎設定',
      '分帳記帳初版 UI 與 expense 服務骨架',
    ],
  },
];

export function formatReleaseDate(entry: ReleaseEntry): string {
  const date = new Date(entry.releasedAt);
  if (entry.detailedTime) {
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

export function isMajorBump(prev: string, next: string): boolean {
  const [pMaj] = prev.split('.').map(Number);
  const [nMaj] = next.split('.').map(Number);
  return nMaj > pMaj;
}
