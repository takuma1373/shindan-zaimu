// 摘要メモの内容から科目を提案するためのキーワード辞書。
// 外部AIは使わず、単純な部分一致（includes）でマッチさせる。
// field は「その科目をどちら側（借方/貸方）の候補として提案するか」を表す。
export interface KeywordRule {
  keywords: string[];
  accountId: string;
  field: "debit" | "credit";
}

export const KEYWORD_DICTIONARY: KeywordRule[] = [
  { keywords: ["スーパー", "食材", "コンビニ"], accountId: "food", field: "debit" },
  { keywords: ["電車", "バス", "タクシー"], accountId: "transport", field: "debit" },
  { keywords: ["家賃"], accountId: "housing", field: "debit" },
  { keywords: ["電気", "ガス", "水道"], accountId: "utility", field: "debit" },
  { keywords: ["給料", "給与"], accountId: "salary", field: "credit" },
  { keywords: ["Mac", "PC", "パソコン", "備品"], accountId: "equipment", field: "debit" },
  { keywords: ["クレジット", "カード"], accountId: "card", field: "credit" },
];
