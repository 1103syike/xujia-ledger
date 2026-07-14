export type ReleaseSection = {
  heading: string;
  items: string[];
};

export type ReleaseEntry = {
  version: string;
  releasedAt: string;
  /** 大版本（如 16.3）可留空 */
  title: string;
  highlights: string[];
  sections?: ReleaseSection[];
};

/**
 * 版本號：XX.YY.ZZ
 * - XX = Angular 主版本（目前 16）
 * - YY = App 大版本
 * - ZZ = 小版本
 * 大版本寫成 XX.YY（兩段），不附敘述。
 */
export const CURRENT_APP_VERSION = '16.3.5';

/** 此日期起顯示含時分的發佈時間 */
const DETAILED_TIME_CUTOFF = new Date('2026-06-22T00:00:00+08:00');

/**
 * 版本歷程顯示順序（由上往下）：
 * 大版本線新→舊（16.3 → 16.2 → 16.1）；
 * 同線內大版本標題在上，小版由下往上遞增（16.3 → 16.3.1 → 16.3.2）。
 */
export const RELEASE_HISTORY: ReleaseEntry[] = [
  {
    version: '16.3',
    releasedAt: '2026-06-23T17:29:53+08:00',
    title: '',
    highlights: [],
  },
  {
    version: '16.3.1',
    releasedAt: '2026-06-24T17:29:03+08:00',
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
    version: '16.3.2',
    releasedAt: '2026-07-14T14:57:00+08:00',
    title: '記帳分攤更聰明、手機輸入更順',
    highlights: [
      '細項歸人、剩下的共同均分，不用再自己心算',
      '手機打字時底部「記一筆」先讓路，鍵盤不擠畫面',
    ],
    sections: [
      {
        heading: '記帳與分攤',
        items: [
          '填了專屬細項後，剩餘金額自動均分給所有參與者',
          '「全家」可再點一次清空選擇',
          '多人付款輸入金額時不再每打一字就失焦',
          '鍵盤開啟時隱藏底部提交列，收起後再顯示',
        ],
      },
      {
        heading: '還款',
        items: ['還款超出後可反轉債務方向'],
      },
      {
        heading: '介面細節',
        items: [
          '分攤卡片頭像與名字垂直置中',
          '頂欄名字的下行字母（如 y）不再被裁切',
        ],
      },
    ],
  },
  {
    version: '16.3.3',
    releasedAt: '2026-07-14T15:30:00+08:00',
    title: '修手機鍵盤與提交列搶畫面',
    highlights: [
      '改以 visualViewport 判斷鍵盤開關，底部「記一筆」不再亂冒出',
    ],
  },
  {
    version: '16.3.4',
    releasedAt: '2026-07-14T15:36:00+08:00',
    title: '修正鍵盤開啟時提交列仍顯示',
    highlights: [
      '改用基準高度偵測鍵盤，並確保畫面會跟著刷新',
    ],
  },
  {
    version: '16.3.5',
    releasedAt: '2026-07-14T16:28:00+08:00',
    title: '還款超額顯示與首頁帳務整理',
    highlights: [
      '多還款後卡片顯示反轉殘額，債主／丐幫對齊',
      '首頁沒欠或沒被欠的區塊自動隱藏，全無帳顯示恭喜文案',
    ],
    sections: [
      {
        heading: '還款',
        items: [
          '超額還款後只顯示反轉殘額（例如多還 200 → 你 +200、對方 −200）',
          '金主／丐幫 badge 依反轉後方向顯示',
        ],
      },
      {
        heading: '首頁',
        items: [
          '沒欠人錢或沒人欠你的 pill 不顯示，單邊佔滿',
          '完全無債務時改為「恭喜你沒有債務纏身」',
        ],
      },
      {
        heading: '介面細節',
        items: [
          '記帳 FAB 去掉會冒矩形光暈的 blur 陰影',
          '鍵盤開啟時提交列完全隱藏，不殘留陰影',
        ],
      },
    ],
  },
  {
    version: '16.2',
    releasedAt: '2026-06-23T09:47:43+08:00',
    title: '',
    highlights: [],
  },
  {
    version: '16.2.1',
    releasedAt: '2026-06-23T13:51:25+08:00',
    title: '墊付分攤、整合欠款與利息結算',
    highlights: [
      'advance allocation、debt consolidation、interest calculator',
      '交易建立／明細／列表大幅擴充',
      '新增 inline transaction list 元件',
    ],
  },
  {
    version: '16.2.2',
    releasedAt: '2026-06-23T16:43:33+08:00',
    title: '架構重整與文案集中管理',
    highlights: [
      '抽出 copy/ 文案模組',
      'advance draft、audit diff 與記帳表單重構',
      'app shell 拆分、樣式模組化',
    ],
  },
  {
    version: '16.1',
    releasedAt: '2026-06-22T09:21:26+08:00',
    title: '',
    highlights: [],
  },
  {
    version: '16.1.1',
    releasedAt: '2026-06-22T11:19:06+08:00',
    title: '成員系統與個人化設定初版',
    highlights: [
      '成員 profile、主題色、頭像與登入流程',
      '設定頁、member picker、firestore 規則調整',
    ],
  },
  {
    version: '16.1.2',
    releasedAt: '2026-06-22T13:19:45+08:00',
    title: '正式版核心功能補齊',
    highlights: [
      '首頁帳務洞察、記帳流程擴充、異動紀錄格式化',
      'confirm dialog、kaomoji loading、pending 頁',
      '行動裝置點擊輸入不再意外放大',
    ],
  },
  {
    version: '16.1.3',
    releasedAt: '2026-06-22T14:19:18+08:00',
    title: '品牌視覺與日期顯示強化',
    highlights: [
      'app logo、chibi 頭像、kaomoji 裝飾與日期 pipe',
      '登入與 dashboard 體驗調整',
    ],
  },
  {
    version: '16.1.4',
    releasedAt: '2026-06-22T15:29:35+08:00',
    title: '代表色、分享預覽與記帳體驗',
    highlights: [
      '成員代表色與主題系統擴充',
      'Open Graph 分享預覽標籤',
      '記帳頁日期選單排版修正',
    ],
  },
];

export function formatReleaseDate(entry: ReleaseEntry): string {
  const date = new Date(entry.releasedAt);
  const useDetailed = date >= DETAILED_TIME_CUTOFF;

  if (useDetailed) {
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

/** 取 XX.YY（大版本線） */
export function versionLine(version: string): string {
  const parts = version.split('.');
  return `${parts[0]}.${parts[1] ?? 0}`;
}

export function isMajorBump(prev: string, next: string): boolean {
  return versionLine(prev) !== versionLine(next);
}

/** 大版本：兩段式（如 16.3），無小版號 */
export function isMajorRelease(version: string): boolean {
  return version.split('.').length === 2;
}

export function isHighlightedRelease(
  index: number,
  releases: ReleaseEntry[]
): boolean {
  const entry = releases[index];
  if (isMajorRelease(entry.version)) return true;
  if (index >= releases.length - 1) return false;
  return isMajorBump(releases[index + 1].version, entry.version);
}
