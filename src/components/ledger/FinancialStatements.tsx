"use client";

import { CATEGORY_INFO, type Account, type Group } from "@/data/ledgerAccounts";
import { accountContribution, computeBS, computePL, type JournalEntry } from "@/lib/ledger";

const fmt = (n: number) => (n < 0 ? `△${Math.abs(n).toLocaleString("ja-JP")}` : n.toLocaleString("ja-JP"));

function byGroup(accounts: Account[], group: Group) {
  return accounts.filter((a) => a.group === group);
}

function Section({
  title,
  accounts,
  entries,
  total,
  totalLabel = "合計",
}: {
  title: string;
  accounts: Account[];
  entries: JournalEntry[];
  total: number;
  totalLabel?: string;
}) {
  if (accounts.length === 0) return null;
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e5ea", overflow: "hidden" }}>
      <div style={{ padding: "8px 12px", background: "#f8fafc", fontSize: 12, fontWeight: 700, color: "#374151" }}>
        {title}
      </div>
      {accounts.map((a) => {
        const value = accountContribution(a, entries);
        return (
          <div
            key={a.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 12px",
              fontSize: 12,
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <span style={{ color: "#374151" }}>
              {a.isContra ? "△ " : ""}
              {a.name}
            </span>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>{fmt(value)}</span>
          </div>
        );
      })}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "8px 12px",
          fontSize: 13,
          fontWeight: 700,
          borderTop: "2px solid #e2e5ea",
        }}
      >
        <span>{totalLabel}</span>
        <span>{fmt(total)}</span>
      </div>
    </div>
  );
}

function groupTotal(accounts: Account[], entries: JournalEntry[]): number {
  return accounts.reduce((sum, a) => sum + accountContribution(a, entries), 0);
}

export default function FinancialStatements({ accounts, entries }: { accounts: Account[]; entries: JournalEntry[] }) {
  const bs = computeBS(accounts, entries);
  const pl = computePL(accounts, entries);

  const assetCurrent = byGroup(accounts, "asset_current");
  const assetFixedTangible = byGroup(accounts, "asset_fixed_tangible");
  const assetFixedContra = byGroup(accounts, "asset_fixed_contra");
  const assetFixedIntangible = byGroup(accounts, "asset_fixed_intangible");
  const assetInvestmentOther = byGroup(accounts, "asset_investment_other");
  const tangibleBlock = [...assetFixedTangible, ...assetFixedContra];

  const liabilityCurrent = byGroup(accounts, "liability_current");
  const liabilityFixed = byGroup(accounts, "liability_fixed");

  const equityCapitalStock = byGroup(accounts, "equity_capital_stock");
  const equityCapitalSurplus = byGroup(accounts, "equity_capital_surplus");
  const equityRetainedEarnings = byGroup(accounts, "equity_retained_earnings");
  const equityValuationDiff = byGroup(accounts, "equity_valuation_diff");

  const revenueOperating = byGroup(accounts, "revenue_operating");
  const revenueSpecial = byGroup(accounts, "revenue_special");
  const expenseOperating = byGroup(accounts, "expense_operating");
  const expenseSpecial = byGroup(accounts, "expense_special");

  const bsMatches = bs.asset === bs.liability + bs.equityPlusIncome;

  return (
    <div style={{ padding: "8px 0", display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>貸借対照表（B/S）</h3>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
            borderRadius: 10,
            marginBottom: 10,
            background: bsMatches ? "#ecfdf3" : "#fef2f2",
            border: `1px solid ${bsMatches ? "#16a34a" : "#dc2626"}`,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: bsMatches ? "#16a34a" : "#dc2626" }}>
            {bsMatches ? "貸借一致 ✓" : "貸借不一致 ✗"}
          </span>
          <span style={{ fontSize: 12, color: "#374151" }}>
            資産 {fmt(bs.asset)} / 負債+純資産+純利益 {fmt(bs.liability + bs.equityPlusIncome)}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", padding: "0 2px" }}>資産の部</span>
          <Section
            title={CATEGORY_INFO.asset.label + " ／ 流動資産"}
            accounts={assetCurrent}
            entries={entries}
            total={groupTotal(assetCurrent, entries)}
          />
          <Section
            title={CATEGORY_INFO.asset.label + " ／ 固定資産（有形）"}
            accounts={tangibleBlock}
            entries={entries}
            total={groupTotal(tangibleBlock, entries)}
            totalLabel="有形固定資産（純額）"
          />
          <Section
            title={CATEGORY_INFO.asset.label + " ／ 固定資産（無形）"}
            accounts={assetFixedIntangible}
            entries={entries}
            total={groupTotal(assetFixedIntangible, entries)}
          />
          <Section
            title={CATEGORY_INFO.asset.label + " ／ 投資その他の資産"}
            accounts={assetInvestmentOther}
            entries={entries}
            total={groupTotal(assetInvestmentOther, entries)}
          />

          <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", padding: "8px 2px 0" }}>負債の部</span>
          <Section
            title={CATEGORY_INFO.liability.label + " ／ 流動負債"}
            accounts={liabilityCurrent}
            entries={entries}
            total={groupTotal(liabilityCurrent, entries)}
          />
          <Section
            title={CATEGORY_INFO.liability.label + " ／ 固定負債"}
            accounts={liabilityFixed}
            entries={entries}
            total={groupTotal(liabilityFixed, entries)}
          />

          <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", padding: "8px 2px 0" }}>純資産の部</span>
          <Section
            title="資本金"
            accounts={equityCapitalStock}
            entries={entries}
            total={groupTotal(equityCapitalStock, entries)}
          />
          <Section
            title="資本剰余金"
            accounts={equityCapitalSurplus}
            entries={entries}
            total={groupTotal(equityCapitalSurplus, entries)}
          />
          <Section
            title="利益剰余金"
            accounts={equityRetainedEarnings}
            entries={entries}
            total={groupTotal(equityRetainedEarnings, entries)}
          />
          <Section
            title="その他有価証券評価差額金"
            accounts={equityValuationDiff}
            entries={entries}
            total={groupTotal(equityValuationDiff, entries)}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderRadius: 10,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              fontSize: 13,
              fontWeight: 700,
              color: "#1d4ed8",
            }}
          >
            <span>当期純利益（利益剰余金に加算）＋純資産合計</span>
            <span>
              {fmt(pl.netIncome)} → {fmt(bs.equityPlusIncome)}
            </span>
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>損益計算書（P/L）</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          <Section
            title="営業収益"
            accounts={revenueOperating}
            entries={entries}
            total={groupTotal(revenueOperating, entries)}
          />
          <Section
            title="特別利益"
            accounts={revenueSpecial}
            entries={entries}
            total={groupTotal(revenueSpecial, entries)}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              color: "#374151",
            }}
          >
            <span>収益合計</span>
            <span>{fmt(pl.revenue)}</span>
          </div>
          <Section
            title="営業費用"
            accounts={expenseOperating}
            entries={entries}
            total={groupTotal(expenseOperating, entries)}
          />
          <Section
            title="特別損失"
            accounts={expenseSpecial}
            entries={entries}
            total={groupTotal(expenseSpecial, entries)}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              color: "#374151",
            }}
          >
            <span>費用合計</span>
            <span>{fmt(pl.expense)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderRadius: 10,
              background: pl.netIncome >= 0 ? "#ecfdf3" : "#fef2f2",
              border: `1px solid ${pl.netIncome >= 0 ? "#16a34a" : "#dc2626"}`,
              fontSize: 13,
              fontWeight: 700,
              color: pl.netIncome >= 0 ? "#16a34a" : "#dc2626",
            }}
          >
            <span>当期純{pl.netIncome >= 0 ? "利益" : "損失"}</span>
            <span>{fmt(Math.abs(pl.netIncome))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
