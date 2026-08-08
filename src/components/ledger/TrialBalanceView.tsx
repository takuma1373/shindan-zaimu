"use client";

import { CATEGORY_INFO, GROUP_INFO, GROUP_ORDER, type Account } from "@/data/ledgerAccounts";
import { computeTrialBalance, type JournalEntry } from "@/lib/ledger";

const fmt = (n: number) => n.toLocaleString("ja-JP");

interface Props {
  accounts: Account[];
  entries: JournalEntry[];
}

export default function TrialBalanceView({ accounts, entries }: Props) {
  const { rows, debitTotalSum, creditTotalSum, isBalanced } = computeTrialBalance(accounts, entries);

  return (
    <div style={{ padding: "8px 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 14px",
          borderRadius: 10,
          marginBottom: 12,
          background: isBalanced ? "#ecfdf3" : "#fef2f2",
          border: `1px solid ${isBalanced ? "#16a34a" : "#dc2626"}`,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: isBalanced ? "#16a34a" : "#dc2626" }}>
          {isBalanced ? "貸借一致 ✓" : "貸借不一致 ✗"}
        </span>
        <span style={{ fontSize: 12, color: "#374151" }}>
          借方 {fmt(debitTotalSum)} / 貸方 {fmt(creditTotalSum)}
        </span>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e5ea", overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 80px 80px",
            gap: 4,
            padding: "8px 10px",
            background: "#f8fafc",
            fontSize: 11,
            fontWeight: 700,
            color: "#6b7280",
            borderBottom: "1px solid #e2e5ea",
          }}
        >
          <span>科目</span>
          <span style={{ textAlign: "right" }}>借方合計</span>
          <span style={{ textAlign: "right" }}>貸方合計</span>
          <span style={{ textAlign: "right" }}>残高</span>
        </div>

        {GROUP_ORDER.map((group) => {
          const groupRows = rows.filter((r) => r.account.group === group);
          if (groupRows.length === 0) return null;
          const info = GROUP_INFO[group];
          return (
            <div key={group}>
              <div
                style={{
                  padding: "6px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#2563eb",
                  background: "#eff6ff",
                }}
              >
                {CATEGORY_INFO[info.category].label} ／ {info.label}
              </div>
              {groupRows.map((row) => (
                <div
                  key={row.account.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 80px 80px 80px",
                    gap: 4,
                    padding: "8px 10px",
                    fontSize: 12,
                    borderBottom: "1px solid #f1f5f9",
                  }}
                >
                  <span style={{ color: "#1e293b" }}>{row.account.name}</span>
                  <span style={{ textAlign: "right", color: "#1e293b" }}>{fmt(row.debitTotal)}</span>
                  <span style={{ textAlign: "right", color: "#1e293b" }}>{fmt(row.creditTotal)}</span>
                  <span style={{ textAlign: "right", fontWeight: 700, color: "#1e293b" }}>
                    {fmt(row.balance)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
