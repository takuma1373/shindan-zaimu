export type Category = "asset" | "liability" | "equity" | "revenue" | "expense";

export interface CategoryInfo {
  label: string;
  normal: "debit" | "credit";
}

export const CATEGORY_INFO: Record<Category, CategoryInfo> = {
  asset: { label: "資産", normal: "debit" },
  liability: { label: "負債", normal: "credit" },
  equity: { label: "純資産", normal: "credit" },
  revenue: { label: "収益", normal: "credit" },
  expense: { label: "費用", normal: "debit" },
};

export const CATEGORY_ORDER: Category[] = ["asset", "liability", "equity", "revenue", "expense"];

export type Group =
  | "asset_current"
  | "asset_fixed_tangible"
  | "asset_fixed_contra"
  | "asset_fixed_intangible"
  | "asset_investment_other"
  | "liability_current"
  | "liability_fixed"
  | "equity_capital_stock"
  | "equity_capital_surplus"
  | "equity_retained_earnings"
  | "equity_valuation_diff"
  | "revenue_operating"
  | "revenue_special"
  | "expense_operating"
  | "expense_special";

export interface GroupInfo {
  category: Category;
  label: string;
}

export const GROUP_INFO: Record<Group, GroupInfo> = {
  asset_current: { category: "asset", label: "流動資産" },
  asset_fixed_tangible: { category: "asset", label: "固定資産（有形）" },
  asset_fixed_contra: { category: "asset", label: "固定資産（評価勘定）" },
  asset_fixed_intangible: { category: "asset", label: "固定資産（無形）" },
  asset_investment_other: { category: "asset", label: "投資その他の資産" },
  liability_current: { category: "liability", label: "流動負債" },
  liability_fixed: { category: "liability", label: "固定負債" },
  equity_capital_stock: { category: "equity", label: "資本金" },
  equity_capital_surplus: { category: "equity", label: "資本剰余金" },
  equity_retained_earnings: { category: "equity", label: "利益剰余金" },
  equity_valuation_diff: { category: "equity", label: "その他有価証券評価差額金" },
  revenue_operating: { category: "revenue", label: "営業収益" },
  revenue_special: { category: "revenue", label: "特別利益" },
  expense_operating: { category: "expense", label: "営業費用" },
  expense_special: { category: "expense", label: "特別損失" },
};

export const GROUP_ORDER: Group[] = [
  "asset_current",
  "asset_fixed_tangible",
  "asset_fixed_contra",
  "asset_fixed_intangible",
  "asset_investment_other",
  "liability_current",
  "liability_fixed",
  "equity_capital_stock",
  "equity_capital_surplus",
  "equity_retained_earnings",
  "equity_valuation_diff",
  "revenue_operating",
  "revenue_special",
  "expense_operating",
  "expense_special",
];

export function groupsForCategory(category: Category): Group[] {
  return GROUP_ORDER.filter((g) => GROUP_INFO[g].category === category);
}

export interface Account {
  id: string;
  name: string;
  category: Category;
  group: Group;
  isContra?: boolean; // 評価勘定（正常残高がカテゴリの逆側になるマイナス勘定）
}

export function validateAccountInput(input: {
  name?: string;
  category?: Category;
  group?: Group;
}): string | null {
  if (!input.name || !input.name.trim()) return "科目名を入力してください";
  if (!input.category || !CATEGORY_INFO[input.category]) return "分類を選択してください";
  if (!input.group || !GROUP_INFO[input.group]) return "中区分を選択してください";
  if (GROUP_INFO[input.group].category !== input.category) return "中区分が分類と一致していません";
  return null;
}

export const DEFAULT_ACCOUNTS: Account[] = [
  // ── 資産（流動） ─────────────────────────────────────────
  { id: "cash", name: "現金", category: "asset", group: "asset_current" },
  { id: "bank", name: "普通預金", category: "asset", group: "asset_current" },
  { id: "time_deposit", name: "定期預金", category: "asset", group: "asset_current" },
  { id: "trading_securities", name: "売買目的有価証券", category: "asset", group: "asset_current" },
  { id: "accounts_receivable_other", name: "未収入金", category: "asset", group: "asset_current" },
  { id: "prepaid_expenses", name: "前払費用", category: "asset", group: "asset_current" },
  { id: "supplies", name: "貯蔵品", category: "asset", group: "asset_current" },

  // ── 資産（固定・有形） ───────────────────────────────────
  { id: "building", name: "建物", category: "asset", group: "asset_fixed_tangible" },
  { id: "equipment", name: "備品", category: "asset", group: "asset_fixed_tangible" },
  { id: "vehicle", name: "車両運搬具", category: "asset", group: "asset_fixed_tangible" },
  { id: "land", name: "土地", category: "asset", group: "asset_fixed_tangible" },

  // ── 資産（固定・評価勘定） ─────────────────────────────────
  {
    id: "accumulated_depreciation",
    name: "減価償却累計額",
    category: "asset",
    group: "asset_fixed_contra",
    isContra: true,
  },

  // ── 資産（固定・無形） ───────────────────────────────────
  { id: "software", name: "ソフトウェア", category: "asset", group: "asset_fixed_intangible" },
  { id: "goodwill", name: "のれん", category: "asset", group: "asset_fixed_intangible" },

  // ── 資産（投資その他） ───────────────────────────────────
  { id: "other_securities", name: "その他有価証券", category: "asset", group: "asset_investment_other" },
  {
    id: "long_term_prepaid_expenses",
    name: "長期前払費用",
    category: "asset",
    group: "asset_investment_other",
  },
  { id: "deferred_tax_assets", name: "繰延税金資産", category: "asset", group: "asset_investment_other" },

  // ── 負債（流動） ─────────────────────────────────────────
  { id: "card", name: "クレジットカード未払金", category: "liability", group: "liability_current" },
  { id: "accounts_payable_other", name: "未払金", category: "liability", group: "liability_current" },
  { id: "accrued_expenses", name: "未払費用", category: "liability", group: "liability_current" },
  { id: "advances_received", name: "前受金", category: "liability", group: "liability_current" },
  { id: "deposits_received", name: "預り金", category: "liability", group: "liability_current" },
  { id: "short_term_loans", name: "短期借入金", category: "liability", group: "liability_current" },

  // ── 負債（固定） ─────────────────────────────────────────
  { id: "long_term_loans", name: "長期借入金", category: "liability", group: "liability_fixed" },
  { id: "lease_obligations", name: "リース債務", category: "liability", group: "liability_fixed" },
  {
    id: "retirement_benefit_liability",
    name: "退職給付引当金",
    category: "liability",
    group: "liability_fixed",
  },
  { id: "deferred_tax_liabilities", name: "繰延税金負債", category: "liability", group: "liability_fixed" },
  {
    id: "asset_retirement_obligations",
    name: "資産除去債務",
    category: "liability",
    group: "liability_fixed",
  },

  // ── 純資産 ──────────────────────────────────────────────
  { id: "capital", name: "資本金", category: "equity", group: "equity_capital_stock" },
  { id: "capital_surplus", name: "資本剰余金", category: "equity", group: "equity_capital_surplus" },
  { id: "retained_earnings", name: "利益剰余金", category: "equity", group: "equity_retained_earnings" },
  {
    id: "valuation_diff",
    name: "その他有価証券評価差額金",
    category: "equity",
    group: "equity_valuation_diff",
  },

  // ── 収益（営業） ─────────────────────────────────────────
  { id: "salary", name: "給与収入", category: "revenue", group: "revenue_operating" },
  { id: "other_income", name: "副収入", category: "revenue", group: "revenue_operating" },
  { id: "interest_income", name: "受取利息", category: "revenue", group: "revenue_operating" },
  { id: "dividend_income", name: "受取配当金", category: "revenue", group: "revenue_operating" },

  // ── 収益（特別利益） ─────────────────────────────────────
  {
    id: "gain_on_sale_of_fixed_assets",
    name: "固定資産売却益",
    category: "revenue",
    group: "revenue_special",
  },
  { id: "insurance_gain", name: "保険差益", category: "revenue", group: "revenue_special" },

  // ── 費用（営業） ─────────────────────────────────────────
  { id: "food", name: "食費", category: "expense", group: "expense_operating" },
  { id: "housing", name: "住居費", category: "expense", group: "expense_operating" },
  { id: "utility", name: "水道光熱費", category: "expense", group: "expense_operating" },
  { id: "comm", name: "通信費", category: "expense", group: "expense_operating" },
  { id: "transport", name: "交通費", category: "expense", group: "expense_operating" },
  { id: "fun", name: "娯楽費", category: "expense", group: "expense_operating" },
  { id: "other_exp", name: "その他支出", category: "expense", group: "expense_operating" },
  { id: "depreciation_expense", name: "減価償却費", category: "expense", group: "expense_operating" },
  { id: "interest_expense", name: "支払利息", category: "expense", group: "expense_operating" },
  {
    id: "provision_for_doubtful_accounts",
    name: "貸倒引当金繰入",
    category: "expense",
    group: "expense_operating",
  },

  // ── 費用（特別損失） ─────────────────────────────────────
  {
    id: "loss_on_sale_of_fixed_assets",
    name: "固定資産売却損",
    category: "expense",
    group: "expense_special",
  },
  { id: "impairment_loss", name: "減損損失", category: "expense", group: "expense_special" },
  { id: "disaster_loss", name: "災害損失", category: "expense", group: "expense_special" },
];

export function getAccount(accounts: Account[], id: string): Account | undefined {
  return accounts.find((a) => a.id === id);
}
