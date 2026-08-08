import { CATEGORY_INFO, DEFAULT_ACCOUNTS, type Account, type Category } from "@/data/ledgerAccounts";

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  debit: string; // account id
  credit: string; // account id
  amount: number;
  memo: string;
}

export type NewJournalEntry = Omit<JournalEntry, "id">;

// ────────────────────────────────────────────────────────────────
// バリデーション: 借方科目≠貸方科目、金額は正の数、日付・借方・貸方すべて必須
// ────────────────────────────────────────────────────────────────
export function validateEntry(entry: {
  date?: string;
  debit?: string;
  credit?: string;
  amount?: number;
}): string | null {
  if (!entry.date) return "日付を入力してください";
  if (!entry.debit) return "借方科目を選択してください";
  if (!entry.credit) return "貸方科目を選択してください";
  if (entry.debit === entry.credit) return "借方科目と貸方科目は異なる科目にしてください";
  if (!entry.amount || entry.amount <= 0) return "金額は正の数で入力してください";
  return null;
}

// 勘定科目ごとの借方合計・貸方合計・差引残高（借方-貸方）を計算
export function accountRaw(entries: JournalEntry[], accountId: string) {
  let d = 0;
  let c = 0;
  entries.forEach((e) => {
    if (e.debit === accountId) d += e.amount;
    if (e.credit === accountId) c += e.amount;
  });
  return { debitTotal: d, creditTotal: c, raw: d - c };
}

// 科目自身の正常残高側（評価勘定はカテゴリの逆側になる）
export function accountNormal(account: Account): "debit" | "credit" {
  const base = CATEGORY_INFO[account.category].normal;
  if (!account.isContra) return base;
  return base === "debit" ? "credit" : "debit";
}

// 元帳・試算表用：科目自身の正常残高側でプラスになる残高
export function accountBalance(account: Account, entries: JournalEntry[]): number {
  const { raw } = accountRaw(entries, account.id);
  return accountNormal(account) === "debit" ? raw : -raw;
}

// BS/PL集計用：評価勘定（isContra）は控除項目として符号を反転する
export function accountContribution(account: Account, entries: JournalEntry[]): number {
  const balance = accountBalance(account, entries);
  return account.isContra ? -balance : balance;
}

// 損益計算書（P/L）: 収益は貸方残高、費用は借方残高がそのまま金額になる
export function computePL(accounts: Account[], entries: JournalEntry[]) {
  let revenue = 0;
  let expense = 0;
  accounts
    .filter((a) => a.category === "revenue")
    .forEach((a) => {
      revenue += accountContribution(a, entries);
    });
  accounts
    .filter((a) => a.category === "expense")
    .forEach((a) => {
      expense += accountContribution(a, entries);
    });
  return { revenue, expense, netIncome: revenue - expense };
}

// 貸借対照表（B/S）: 資産＝負債＋資本＋当期純利益 が成立するはず
export function computeBS(accounts: Account[], entries: JournalEntry[]) {
  let asset = 0;
  let liability = 0;
  let equity = 0;
  accounts
    .filter((a) => a.category === "asset")
    .forEach((a) => {
      asset += accountContribution(a, entries);
    });
  accounts
    .filter((a) => a.category === "liability")
    .forEach((a) => {
      liability += accountContribution(a, entries);
    });
  accounts
    .filter((a) => a.category === "equity")
    .forEach((a) => {
      equity += accountContribution(a, entries);
    });
  const { netIncome } = computePL(accounts, entries);
  return { asset, liability, equity, netIncome, equityPlusIncome: equity + netIncome };
}

// ────────────────────────────────────────────────────────────────
// 試算表: 科目ごとの借方合計・貸方合計・自身の正常残高側の残高
// ────────────────────────────────────────────────────────────────
export interface TrialBalanceRow {
  account: Account;
  debitTotal: number;
  creditTotal: number;
  balance: number; // 科目自身の正常残高側にプラスとなる金額
}

export function computeTrialBalance(accounts: Account[], entries: JournalEntry[]) {
  const rows: TrialBalanceRow[] = accounts.map((account) => {
    const { debitTotal, creditTotal } = accountRaw(entries, account.id);
    const balance = accountBalance(account, entries);
    return { account, debitTotal, creditTotal, balance };
  });
  const debitTotalSum = rows.reduce((s, r) => s + r.debitTotal, 0);
  const creditTotalSum = rows.reduce((s, r) => s + r.creditTotal, 0);
  return { rows, debitTotalSum, creditTotalSum, isBalanced: debitTotalSum === creditTotalSum };
}

// ────────────────────────────────────────────────────────────────
// 元帳: 指定科目に関わる仕訳を日付順に並べ、残高推移を付与する
// ────────────────────────────────────────────────────────────────
export interface LedgerRow {
  entry: JournalEntry;
  counterAccount: Account | undefined;
  debitAmount: number;
  creditAmount: number;
  balance: number;
}

export function getAccountLedger(entries: JournalEntry[], accountId: string, accounts: Account[] = DEFAULT_ACCOUNTS) {
  const account = accounts.find((a) => a.id === accountId);
  const normal = account ? accountNormal(account) : "debit";
  const related = entries
    .filter((e) => e.debit === accountId || e.credit === accountId)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  let running = 0;
  const rows: LedgerRow[] = related.map((entry) => {
    const isDebit = entry.debit === accountId;
    const delta = isDebit === (normal === "debit") ? entry.amount : -entry.amount;
    running += delta;
    return {
      entry,
      counterAccount: accounts.find((a) => a.id === (isDebit ? entry.credit : entry.debit)),
      debitAmount: isDebit ? entry.amount : 0,
      creditAmount: isDebit ? 0 : entry.amount,
      balance: running,
    };
  });
  return rows;
}

export type { Account, Category };
