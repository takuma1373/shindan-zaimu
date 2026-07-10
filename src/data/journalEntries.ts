// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────
export type BSAssetKey =
  | '現金' | '売掛金' | '建物' | '繰延税金資産' | 'リース資産' | 'のれん' | '貸倒引当金';

export type BSLiabilityKey =
  | '買掛金' | '借入金' | '未払法人税等' | '賞与引当金'
  | '退職給付引当金' | 'リース債務' | '繰延税金負債' | '未払配当金';

export type BSEquityKey = '資本金' | '繰越利益剰余金' | '自己株式';

export type PLKey =
  | '売上高' | '売上原価' | '減価償却費' | '法人税等'
  | '貸倒引当金繰入' | '賞与引当金繰入' | '退職給付費用' | '減損損失'
  | 'のれん償却' | '支払利息' | '為替差益' | '為替差損' | '法人税等調整額';

export type Effect =
  | { section: 'assets'; field: BSAssetKey; delta: number }
  | { section: 'liabilities'; field: BSLiabilityKey; delta: number }
  | { section: 'equity'; field: BSEquityKey; delta: number }
  | { section: 'pl'; field: PLKey; delta: number };

export interface JournalLine {
  account: string;
  amount: number; // 正=増加 負=減少
}

export interface JournalEntry {
  id: number;
  category: string;
  name: string;
  debits: JournalLine[];
  credits: JournalLine[];
  effects: Effect[];
}

export interface BSState {
  assets: Record<BSAssetKey, number>;
  liabilities: Record<BSLiabilityKey, number>;
  equity: Record<BSEquityKey, number>;
}

// ────────────────────────────────────────────────────────────────
// Initial values
// ────────────────────────────────────────────────────────────────
export const INITIAL_BS: BSState = {
  assets: {
    現金: 500, 売掛金: 200, 建物: 1000,
    繰延税金資産: 0, リース資産: 0, のれん: 0, 貸倒引当金: 0,
  },
  liabilities: {
    買掛金: 100, 借入金: 500, 未払法人税等: 0,
    賞与引当金: 0, 退職給付引当金: 0, リース債務: 0,
    繰延税金負債: 0, 未払配当金: 0,
  },
  equity: {
    資本金: 1000, 繰越利益剰余金: 100, 自己株式: 0,
  },
};

export const INITIAL_PL: Record<PLKey, number> = {
  売上高: 0, 売上原価: 0, 減価償却費: 0, 法人税等: 0,
  貸倒引当金繰入: 0, 賞与引当金繰入: 0, 退職給付費用: 0,
  減損損失: 0, のれん償却: 0, 支払利息: 0,
  為替差益: 0, 為替差損: 0, 法人税等調整額: 0,
};

// ────────────────────────────────────────────────────────────────
// Journal entries
// ────────────────────────────────────────────────────────────────
export const JOURNAL_ENTRIES: JournalEntry[] = [
  // ── 売上・収益 ──────────────────────────────────────────────
  {
    id: 1, category: '売上・収益', name: '現金売上',
    debits: [{ account: '現金', amount: 100 }],
    credits: [{ account: '売上高', amount: 100 }],
    effects: [
      { section: 'assets', field: '現金', delta: 100 },
      { section: 'pl', field: '売上高', delta: 100 },
    ],
  },
  {
    id: 2, category: '売上・収益', name: '掛け売上',
    debits: [{ account: '売掛金', amount: 100 }],
    credits: [{ account: '売上高', amount: 100 }],
    effects: [
      { section: 'assets', field: '売掛金', delta: 100 },
      { section: 'pl', field: '売上高', delta: 100 },
    ],
  },
  {
    id: 3, category: '売上・収益', name: '売掛金回収',
    debits: [{ account: '現金', amount: 100 }],
    credits: [{ account: '売掛金', amount: -100 }],
    effects: [
      { section: 'assets', field: '現金', delta: 100 },
      { section: 'assets', field: '売掛金', delta: -100 },
    ],
  },
  // ── 仕入・費用 ──────────────────────────────────────────────
  {
    id: 4, category: '仕入・費用', name: '現金仕入',
    debits: [{ account: '仕入', amount: 100 }],
    credits: [{ account: '現金', amount: -100 }],
    effects: [
      { section: 'pl', field: '売上原価', delta: 100 },
      { section: 'assets', field: '現金', delta: -100 },
    ],
  },
  {
    id: 5, category: '仕入・費用', name: '掛け仕入',
    debits: [{ account: '仕入', amount: 100 }],
    credits: [{ account: '買掛金', amount: 100 }],
    effects: [
      { section: 'pl', field: '売上原価', delta: 100 },
      { section: 'liabilities', field: '買掛金', delta: 100 },
    ],
  },
  {
    id: 6, category: '仕入・費用', name: '買掛金支払',
    debits: [{ account: '買掛金', amount: -100 }],
    credits: [{ account: '現金', amount: -100 }],
    effects: [
      { section: 'liabilities', field: '買掛金', delta: -100 },
      { section: 'assets', field: '現金', delta: -100 },
    ],
  },
  // ── 固定資産 ───────────────────────────────────────────────
  {
    id: 7, category: '固定資産', name: '固定資産購入',
    debits: [{ account: '建物', amount: 500 }],
    credits: [{ account: '現金', amount: -500 }],
    effects: [
      { section: 'assets', field: '建物', delta: 500 },
      { section: 'assets', field: '現金', delta: -500 },
    ],
  },
  {
    id: 8, category: '固定資産', name: '減価償却',
    debits: [{ account: '減価償却費', amount: 50 }],
    credits: [{ account: '建物', amount: -50 }],
    effects: [
      { section: 'pl', field: '減価償却費', delta: 50 },
      { section: 'assets', field: '建物', delta: -50 },
    ],
  },
  // ── 資金調達 ───────────────────────────────────────────────
  {
    id: 9, category: '資金調達', name: '借入',
    debits: [{ account: '現金', amount: 200 }],
    credits: [{ account: '借入金', amount: 200 }],
    effects: [
      { section: 'assets', field: '現金', delta: 200 },
      { section: 'liabilities', field: '借入金', delta: 200 },
    ],
  },
  {
    id: 10, category: '資金調達', name: '借入金返済',
    debits: [{ account: '借入金', amount: -100 }],
    credits: [{ account: '現金', amount: -100 }],
    effects: [
      { section: 'liabilities', field: '借入金', delta: -100 },
      { section: 'assets', field: '現金', delta: -100 },
    ],
  },
  {
    id: 11, category: '資金調達', name: '増資',
    debits: [{ account: '現金', amount: 300 }],
    credits: [{ account: '資本金', amount: 300 }],
    effects: [
      { section: 'assets', field: '現金', delta: 300 },
      { section: 'equity', field: '資本金', delta: 300 },
    ],
  },
  // ── 税務 ───────────────────────────────────────────────────
  {
    id: 12, category: '税務', name: '法人税計上',
    debits: [{ account: '法人税等', amount: 30 }],
    credits: [{ account: '未払法人税等', amount: 30 }],
    effects: [
      { section: 'pl', field: '法人税等', delta: 30 },
      { section: 'liabilities', field: '未払法人税等', delta: 30 },
    ],
  },
  {
    id: 13, category: '税務', name: '法人税支払',
    debits: [{ account: '未払法人税等', amount: -30 }],
    credits: [{ account: '現金', amount: -30 }],
    effects: [
      { section: 'liabilities', field: '未払法人税等', delta: -30 },
      { section: 'assets', field: '現金', delta: -30 },
    ],
  },
  // ── 税効果会計 ────────────────────────────────────────────
  {
    id: 14, category: '税効果会計', name: '繰延税金資産計上',
    debits: [{ account: '繰延税金資産', amount: 30 }],
    credits: [{ account: '法人税等調整額', amount: 30 }],
    effects: [
      { section: 'assets', field: '繰延税金資産', delta: 30 },
      { section: 'pl', field: '法人税等調整額', delta: 30 }, // 正=税効果ベネフィット
    ],
  },
  {
    id: 15, category: '税効果会計', name: '繰延税金負債計上',
    debits: [{ account: '法人税等調整額', amount: 20 }],
    credits: [{ account: '繰延税金負債', amount: 20 }],
    effects: [
      { section: 'pl', field: '法人税等調整額', delta: -20 }, // 負=追加税負担
      { section: 'liabilities', field: '繰延税金負債', delta: 20 },
    ],
  },
  // ── 減損会計 ──────────────────────────────────────────────
  {
    id: 16, category: '減損会計', name: '減損損失計上',
    debits: [{ account: '減損損失', amount: 200 }],
    credits: [{ account: '建物', amount: -200 }],
    effects: [
      { section: 'pl', field: '減損損失', delta: 200 },
      { section: 'assets', field: '建物', delta: -200 },
    ],
  },
  // ── 引当金 ────────────────────────────────────────────────
  {
    id: 17, category: '引当金', name: '貸倒引当金繰入',
    debits: [{ account: '貸倒引当金繰入', amount: 10 }],
    credits: [{ account: '貸倒引当金', amount: 10 }],
    effects: [
      { section: 'pl', field: '貸倒引当金繰入', delta: 10 },
      { section: 'assets', field: '貸倒引当金', delta: 10 }, // 評価性引当（資産のマイナス）
    ],
  },
  {
    id: 18, category: '引当金', name: '賞与引当金繰入',
    debits: [{ account: '賞与引当金繰入', amount: 50 }],
    credits: [{ account: '賞与引当金', amount: 50 }],
    effects: [
      { section: 'pl', field: '賞与引当金繰入', delta: 50 },
      { section: 'liabilities', field: '賞与引当金', delta: 50 },
    ],
  },
  {
    id: 19, category: '引当金', name: '退職給付費用',
    debits: [{ account: '退職給付費用', amount: 30 }],
    credits: [{ account: '退職給付引当金', amount: 30 }],
    effects: [
      { section: 'pl', field: '退職給付費用', delta: 30 },
      { section: 'liabilities', field: '退職給付引当金', delta: 30 },
    ],
  },
  // ── 自社株・資本取引 ────────────────────────────────────
  {
    id: 20, category: '自社株・資本取引', name: '自社株買い',
    debits: [{ account: '自己株式', amount: 100 }],
    credits: [{ account: '現金', amount: -100 }],
    effects: [
      { section: 'equity', field: '自己株式', delta: 100 }, // 純資産から控除される額が増加
      { section: 'assets', field: '現金', delta: -100 },
    ],
  },
  {
    id: 21, category: '自社株・資本取引', name: '自己株式消却',
    debits: [{ account: '資本金', amount: -100 }],
    credits: [{ account: '自己株式', amount: -100 }],
    effects: [
      { section: 'equity', field: '資本金', delta: -100 },
      { section: 'equity', field: '自己株式', delta: -100 }, // 控除額が減少→純資産増加
    ],
  },
  {
    id: 22, category: '自社株・資本取引', name: '剰余金配当',
    debits: [{ account: '繰越利益剰余金', amount: -50 }],
    credits: [{ account: '未払配当金', amount: 50 }],
    effects: [
      { section: 'equity', field: '繰越利益剰余金', delta: -50 },
      { section: 'liabilities', field: '未払配当金', delta: 50 },
    ],
  },
  // ── リース ────────────────────────────────────────────────
  {
    id: 23, category: 'リース', name: 'ファイナンスリース開始',
    debits: [{ account: 'リース資産', amount: 300 }],
    credits: [{ account: 'リース債務', amount: 300 }],
    effects: [
      { section: 'assets', field: 'リース資産', delta: 300 },
      { section: 'liabilities', field: 'リース債務', delta: 300 },
    ],
  },
  {
    id: 24, category: 'リース', name: 'リース料支払',
    debits: [{ account: 'リース債務', amount: -20 }, { account: '支払利息', amount: 5 }],
    credits: [{ account: '現金', amount: -25 }],
    effects: [
      { section: 'liabilities', field: 'リース債務', delta: -20 },
      { section: 'pl', field: '支払利息', delta: 5 },
      { section: 'assets', field: '現金', delta: -25 },
    ],
  },
  // ── 連結・のれん ─────────────────────────────────────────
  {
    id: 25, category: '連結・のれん', name: 'のれん計上',
    debits: [{ account: 'のれん', amount: 200 }],
    credits: [{ account: '現金', amount: -200 }],
    effects: [
      { section: 'assets', field: 'のれん', delta: 200 },
      { section: 'assets', field: '現金', delta: -200 },
    ],
  },
  {
    id: 26, category: '連結・のれん', name: 'のれん償却',
    debits: [{ account: 'のれん償却', amount: 20 }],
    credits: [{ account: 'のれん', amount: -20 }],
    effects: [
      { section: 'pl', field: 'のれん償却', delta: 20 },
      { section: 'assets', field: 'のれん', delta: -20 },
    ],
  },
  // ── 外貨換算 ────────────────────────────────────────────
  {
    id: 27, category: '外貨換算', name: '外貨建売掛金計上',
    debits: [{ account: '売掛金', amount: 100 }],
    credits: [{ account: '売上高', amount: 100 }],
    effects: [
      { section: 'assets', field: '売掛金', delta: 100 },
      { section: 'pl', field: '売上高', delta: 100 },
    ],
  },
  {
    id: 28, category: '外貨換算', name: '為替差益',
    debits: [{ account: '売掛金', amount: 10 }],
    credits: [{ account: '為替差益', amount: 10 }],
    effects: [
      { section: 'assets', field: '売掛金', delta: 10 },
      { section: 'pl', field: '為替差益', delta: 10 },
    ],
  },
  {
    id: 29, category: '外貨換算', name: '為替差損',
    debits: [{ account: '為替差損', amount: 10 }],
    credits: [{ account: '売掛金', amount: -10 }],
    effects: [
      { section: 'pl', field: '為替差損', delta: 10 },
      { section: 'assets', field: '売掛金', delta: -10 },
    ],
  },
];

// カテゴリの表示順
export const CATEGORIES = [
  '売上・収益', '仕入・費用', '固定資産', '資金調達', '税務',
  '税効果会計', '減損会計', '引当金', '自社株・資本取引', 'リース',
  '連結・のれん', '外貨換算',
];
