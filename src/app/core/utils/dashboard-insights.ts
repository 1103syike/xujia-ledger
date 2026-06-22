import { Expense } from '../models';
import { computeBalances, netBalances } from './balance-calculator';

export interface DebtRankingEntry {
  memberId: string;
  total: number;
}

export interface DebtorEntry {
  memberId: string;
  amount: number;
}

/** 各成員尚未結清的總負債（加總所有待付分攤） */
export function totalDebtRanking(expenses: Expense[]): DebtRankingEntry[] {
  const totals = new Map<string, number>();

  for (const edge of computeBalances(expenses)) {
    totals.set(edge.fromId, (totals.get(edge.fromId) ?? 0) + edge.amount);
  }

  return [...totals.entries()]
    .map(([memberId, total]) => ({ memberId, total }))
    .sort((a, b) => b.total - a.total);
}

/** 欠指定成員的淨額（已 net 過雙向） */
export function debtorsToCreditor(
  expenses: Expense[],
  creditorId: string
): DebtorEntry[] {
  return netBalances(expenses)
    .filter((edge) => edge.toId === creditorId)
    .map((edge) => ({ memberId: edge.fromId, amount: edge.amount }))
    .sort((a, b) => b.amount - a.amount);
}

const RANK_TITLES = [
  '負債王',
  '欠債老二',
  '欠債老三',
  '榜單常客',
  '潛力股欠債人',
];

const RANK_QUIPS: string[][] = [
  [
    '錢包比臉還乾，嘴還是挺硬。',
    '全場就你最會「先欠著」。',
    '代墊的人看著你，眼神很複雜。',
    '不是沒錢，是錢先拿去排隊了。',
    '這個月的光族，你包辦了。',
    '欠債欠到可以開分店。',
    '大家吃飯你負責「精神分擔」。',
    'A 錢 A 到變成 A 片長度。',
    '你的待付比手搖杯還多。',
    '群組已讀，帳款未讀。',
    '先墊的人：我沒有比較閒齁。',
    '欠這麼多，是要存錢存到變存證信函喔。',
    '財務狀況：靠北但真實。',
    '榜一穩到可以掛匾額。',
  ],
  [
    '再欠一頓火鍋就能篡位。',
    '欠不多，但存在感很強。',
    '穩定發揮，從不讓人失望（反向）。',
    '離負債王只差一次聚餐。',
    '老二當久了也會想當老大。',
    '你的欠債曲線很健康（對別人來說）。',
    '再拖一下就能領獎盃。',
  ],
  [
    '季軍也是冠軍的一種預告。',
    '榜上有名，代表常一起吃。',
    '再努力一下就能上頭版。',
    '老三不搶第一，但從不缺席。',
    '穩居前三，實至名歸。',
  ],
  [
    '雖然不是前三，但戲很多。',
    '欠債界的中堅份子。',
    '每次聚餐都有你的份（待付）。',
  ],
  [
    '欠一點也是欠，別裝沒事。',
    '新手村還沒出，欠債先解。',
  ],
];

/** 複製貼到 Line 的催款句 */
const ROAST_LINES = [
  '欸 {name}，NT${amount} 欠多久了？許家帳本都要長蜘蛛網了',
  '喂 {name}，這 NT${amount} 是打算當傳家寶喔？',
  '{name}，NT${amount} 已讀不回齁，帳本可是有在記的',
  '先墊的人沒比較有錢，{name} 的 NT${amount} 該來了吧',
  '{name}：說好 A 錢，結果 A 到「下次再說」——NT${amount}',
  '溫馨靠北：{name}，NT${amount} 再不還，下次代墊會先深呼吸',
  '{name} 欸，NT${amount} 比等超商特寵還難等捏',
  '給 {name} 的小紙條：NT${amount}，許家帳本敬上（請快）',
  '{name}，你的欠條在許家帳本發霉了，NT${amount}',
  '{name} 的 NT${amount} 還在待結清榜單閃閃發光',
  '{name}：還錢不會變老，但會變成下次還有人敢先墊',
  '【許家帳本快訊】{name} 的 NT${amount} 進入馬拉松模式',
  '{name}，NT${amount} 再拖，群組貼圖都要變催帳專用',
  '友情可以久，帳款不能拖——{name}，NT${amount}',
  '{name}：這 NT${amount} 是在測試代墊者耐心喔',
  '{name}，許家帳本不是許願池，NT${amount} 該報到了',
  '提醒 {name}：NT${amount} 不還，下次可能「剛好沒帶到」',
  '{name}，NT${amount}——不是逼你，是帳本快哭了',
  '許家帳本靠北版：{name}，NT${amount}，拜託快一下',
  '{name} 的 NT${amount}，跟我的減肥一樣遙遙無期',
  '欸～{name}，許家帳本不是慈善機構捏',
  '{name}：Line 回超快，匯款慢到像跨年出國',
  '拜託 {name}，NT${amount} 再拖我要去拜拜了',
  '{name}，NT${amount} 放著不還，是要當貢品嗎',
  '先墊的人：{name}，NT${amount} 該結一下了吧齁',
  '{name} 同學，NT${amount} 欠這麼久，合理嗎',
  '許家帳本通知：{name} 的 NT${amount} 待結清，請勿忽略',
  '{name}，NT${amount}——你忘記，帳本沒忘',
  '欸 {name}，NT${amount} 再不還，下次點餐我會先問三次',
  '{name}：均分均到只剩你在拖，NT${amount}',
  '代墊的人沒有比較閒，{name} 的 NT${amount} 請查收',
  '{name}，NT${amount} 欠太久，連手搖都退冰了',
  '給 {name}：NT${amount}，還一下會死嗎（不會）',
  '{name} 欸，NT${amount} 是打算用現金還是用真誠',
  '許家帳本：{name} 的 NT${amount}，狀態「還在拖」',
  '{name}，NT${amount} 再欠下去，我要改叫你欠欠了',
  '欸 {name}，NT${amount} 這筆比追劇還拖',
  '{name}：先墊是情分，還錢是本分，NT${amount}',
  '拜託 {name}，NT${amount} 一下，大家還是好朋友',
  '{name} 的 NT${amount}，已經可以寫成家族傳說',
  '許家帳本提醒 {name}：NT${amount}，請對帳本負責',
  '{name}，NT${amount} 欠著欠著，不會自己消失喔',
  '欸 {name}，NT${amount} 你是要存到變古蹟嗎',
  '{name}：群組聊天第一名，還錢最後一名，NT${amount}',
  '先墊的人心很累，{name} 的 NT${amount} 拜託了',
  '{name}，NT${amount}——不是催，是帳本在求救',
  '許家帳本：{name} 的 NT${amount}，請勿已讀不回',
  '{name} 欸，NT${amount} 再拖，下次火鍋你坐小孩桌',
  '{name}：欠 NT${amount} 欠到我都會背了',
  '欸 {name}，NT${amount} 該還了，不然我要貼標籤了',
  '{name}，NT${amount} 放著不動，是在等升息嗎',
  '代墊的人：{name}，NT${amount}，謝謝配合（快）',
  '{name} 同學，NT${amount} 欠這麼爽，睡得好嗎',
  '許家帳本：{name} 的 NT${amount}，再拖就變教材了',
  '{name}，NT${amount}——還一下，世界會更美好',
  '欸 {name}，NT${amount} 你是要讓帳本過期喔',
  '{name}：說好分帳，結果分到「我先欠」——NT${amount}',
  '拜託 {name}，NT${amount} 一下，我請你喝珍奶（假的）',
  '{name} 的 NT${amount}，比捷運文湖線還難等到',
  '許家帳本靠北通知：{name}，NT${amount}，快',
  '{name}，NT${amount} 欠太久，代墊的人髮絲都白了',
  '欸 {name}，NT${amount} 再不還，下次只傳帳本給你看',
  '{name}：NT${amount} 這筆，比前任還難忘',
  '先墊的人沒有義務當 ATM，{name} 的 NT${amount} 請還',
  '{name} 欸，NT${amount} 一下，不然我會一直記得',
  '許家帳本：{name} 的 NT${amount}，請勿佛系還款',
  '{name}，NT${amount}——帳本不會生氣，但會記仇',
  '欸 {name}，NT${amount} 欠這麼久，合理齁（不合理）',
  '{name}：NT${amount} 再拖，我要在群組置頂了',
  '拜託 {name}，NT${amount} 該結了，大家還要一起吃飯',
  '{name} 的 NT${amount}，跟路邊野貓一樣難抓',
  '許家帳本提醒：{name}，NT${amount}，請勿裝死',
  '{name}，NT${amount}——不是逼你，是帳本需要關愛',
  '欸 {name}，NT${amount} 你是要欠到變許家吉祥物嗎',
  '{name}：先墊的人沒有比較會賺，NT${amount} 請還',
  '代墊的人：{name}，NT${amount}，再拖我要開記者會了',
  '{name} 欸，NT${amount} 一下，我會當沒看見（騙你的）',
  '許家帳本：{name} 的 NT${amount}，請對自己誠實',
  '{name}，NT${amount} 欠著不還，下次代墊會先問五遍',
  '欸 {name}，NT${amount} 該報到了，帳本等很久了',
  '{name}：NT${amount} 這筆，比颱風假還拖',
  '拜託 {name}，NT${amount} 一下，許家帳本謝謝你',
  '{name} 的 NT${amount}，已讀不回可以，不還不行',
  '許家帳本通知 {name}：NT${amount}，請勿讓帳本過勞',
  '{name}，NT${amount}——還一下，代墊的人會很開心',
  '欸 {name}，NT${amount} 你是要存到變國寶嗎',
  '{name}：欠 NT${amount} 欠到可以出週邊了',
  '先墊的人：{name}，NT${amount}，拜託快一下齁',
  '{name} 欸，NT${amount} 再拖，下次聚餐你負責洗碗（還是要還）',
  '許家帳本：{name} 的 NT${amount}，請勿讓友情負債',
  '{name}，NT${amount}——帳本很單純，欠就是欠',
  '欸 {name}，NT${amount} 一下，不然我要念經了',
  '{name}：NT${amount} 放著，是不會自己長利息給你',
  '拜託 {name}，NT${amount} 該還了，大家還要一起活',
  '{name} 的 NT${amount}，比等公車還久',
  '許家帳本靠北：{name}，NT${amount}，快啦',
  '{name}，NT${amount} 欠太久，連帳本都會嘆氣',
  '欸 {name}，NT${amount} 你是要讓代墊的人轉職嗎',
  '{name}：NT${amount} 這筆，比考試還難結束',
  '先墊的人沒有比較閒，{name} 的 NT${amount} 請查收',
  '{name} 欸，NT${amount} 一下，許家帳本等你',
  '許家帳本：{name} 的 NT${amount}，請勿讓我難做',
  '{name}，NT${amount}——不是急，是拖太久了',
  '欸 {name}，NT${amount} 該結了，帳本要下班了',
  '{name}：欠 NT${amount} 欠到我都會幫你緊張',
  '拜託 {name}，NT${amount} 一下，代墊的人會謝天謝地',
  '{name} 的 NT${amount}，跟梅雨一樣下個沒完（要還）',
  '許家帳本提醒 {name}：NT${amount}，請勿讓帳本失眠',
  '{name}，NT${amount}——還一下，功德無量',
  '欸 {name}，NT${amount} 你是要欠到變許家梗圖嗎',
  '{name}：NT${amount} 再拖，我要改叫你拖拖了',
  '代墊的人：{name}，NT${amount}，快，我說快',
  '{name} 欸，NT${amount} 一下，不然帳本要造反了',
  '許家帳本：{name} 的 NT${amount}，請對錢包負責',
  '{name}，NT${amount} 欠著，下次誰敢先墊啊',
  '欸 {name}，NT${amount} 該還了，齁，真的該還了',
];

const DEBTOR_CARD_QUIPS = [
  '該催了，但用可愛的方式（其實不太可愛）。',
  '友情歸友情，帳款歸帳款，分清楚齁。',
  '再拖下去，下次聚餐只能目擊別人點餐。',
  '欠債不還，代墊的人下次會先深呼吸。',
  '這位：記憶力很好，除了還錢這件事。',
  '溫柔提醒，效果不打折，請配合演出。',
  '帳款待結清，人情還在，耐心有限。',
  '不是急，是帳本需要關愛。',
  'Line 回很快，匯款很慢，經典組合。',
  '先墊的人沒有比較有錢，請記住。',
  '欠這麼久，合理嗎？不合理。',
  '群組最活躍，還錢最佛系。',
  '再拖，下次只傳帳本給他看。',
  'A 錢 A 到變成 A 片長度。',
  '已讀不回可以，不還不行。',
  '欠到可以出週邊了，真的。',
  '代墊的人心很累，幫幫他。',
  '帳本不會生氣，但會記仇。',
  '再欠下去，火鍋他坐小孩桌。',
  '說好分帳，結果分到「我先欠」。',
  '比等手搖還久，離譜。',
  '欠債界的老面孔，又見面了。',
  '不是逼他，是帳本在求救。',
  '還一下，大家還是好朋友。',
  '這位朋友：欠債穩定度滿分。',
  '先墊是情分，還錢是本分。',
  '再拖，群組要置頂催帳了。',
  '欠到我都會背金額了。',
  '代墊的人：我沒有比較閒。',
  '帳本很單純，欠就是欠。',
  '還錢不會變老，會變受歡迎。',
  '下次代墊會先問三遍。',
  '欠這麼爽，睡得好嗎？',
  '比颱風假還能拖，厲害。',
  '請勿讓帳本過勞，謝謝。',
  '還一下，功德無量。',
  '欠到可以寫成家族傳說。',
  '比前任還難忘的一筆。',
  '跟路邊野貓一樣難抓。',
  '請勿裝死，帳本看著。',
];

const ALL_CLEAR_QUIPS = [
  '全家清清白白的，今天可以加雞腿。',
  '許家帳本：罕見和平年代，請珍惜。',
  '沒有欠債，只有一起變胖的回憶。',
  '帳清人静，代墊的人終於笑了。',
  '零待付，值得開一罐可樂慶祝。',
  '目前沒人欠錢，許家奇蹟時刻。',
  '大家都有還，感動到想哭。',
  '沒有催帳訊息的一天，真美好。',
  '帳本空空的，心裡暖暖的（？）',
  '今天可以安心點大份，不用怕。',
  '許家財務：穩如老狗。',
  '沒欠錢的感覺，像發薪日。',
  '代墊的人終於可以喘口氣。',
  '群組不用貼帳本截圖，爽。',
  '這種日子不多，且行且珍惜。',
  '沒有待付，連空氣都甜。',
  '許家帳本：今日無靠北素材。',
  '大家都有還，今晚加菜。',
  '零負債狀態，請截圖留念。',
  '沒人欠錢，可以安心約下一攤。',
  '帳本比臉還乾淨，難得。',
  '今天不用當討債鬼，開心。',
  '許家經濟：暫時沒有內憂。',
  '沒欠債，連手搖都敢點大杯。',
  '和平的一天，請勿破壞。',
  '代墊的人：終於可以正常社交了。',
  '沒有待付，比中發票還開心。',
  '許家帳本：今日無戰事。',
  '大家都有還，感動到想請客（但沒有）。',
  '零欠債，值得放煙火（心裡的）。',
];

function pickIndex(seed: string, length: number, salt = 0): number {
  if (length <= 0) return 0;
  let hash = salt >>> 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

export function rankTitle(index: number): string {
  return RANK_TITLES[index] ?? `欠債第 ${index + 1} 名`;
}

export function rankQuip(memberId: string, index: number, salt = 0): string {
  const pool = RANK_QUIPS[index] ?? RANK_QUIPS[RANK_QUIPS.length - 1];
  return pool[pickIndex(`${memberId}-rank-${index}`, pool.length, salt)];
}

export function debtorCardQuip(
  debtorId: string,
  creditorId: string,
  salt = 0
): string {
  return DEBTOR_CARD_QUIPS[
    pickIndex(`${debtorId}-${creditorId}-card`, DEBTOR_CARD_QUIPS.length, salt)
  ];
}

export function allClearQuip(memberId: string, salt = 0): string {
  return ALL_CLEAR_QUIPS[
    pickIndex(`${memberId}-clear`, ALL_CLEAR_QUIPS.length, salt)
  ];
}

export function buildRoastMessage(
  name: string,
  amount: number,
  debtorId: string,
  creditorId: string,
  salt = 0
): string {
  const template =
    ROAST_LINES[
      pickIndex(`${debtorId}-${creditorId}-roast`, ROAST_LINES.length, salt)
    ];
  return template.replace('{name}', name).replace('${amount}', String(amount));
}

export function quoteCounts() {
  return {
    roast: ROAST_LINES.length,
    debtorCard: DEBTOR_CARD_QUIPS.length,
    allClear: ALL_CLEAR_QUIPS.length,
  };
}
