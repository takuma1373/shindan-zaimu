"use client";

import { useState } from "react";
import type { Account } from "@/data/ledgerAccounts";
import { accountNormal, getAccountLedger, type JournalEntry } from "@/lib/ledger";
import GroupedAccountOptions from "./GroupedAccountOptions";

const fmt = (n: number) => n.toLocaleString("ja-JP");

interface Props {
  accounts: Account[];
  entries: JournalEntry[];
}

export default function GeneralLedgerView({ accounts, entries }: Props) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const account = accounts.find((a) => a.id === accountId);
  const rows = accountId ? getAccountLedger(entries, accountId, accounts) : [];
  const normal = account ? accountNormal(account) : "debit";

  return (
    <div style={{ padding: "8px 0" }}>
      <select
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid #e2e5ea",
          fontSize: 14,
          background: "#fff",
          marginBottom: 12,
        }}
      >
        <GroupedAccountOptions accounts={accounts} />
      </select>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e5ea", overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "70px 1fr 60px 60px 70px",
            gap: 4,
            padding: "8px 10px",
            background: "#f8fafc",
            fontSize: 11,
            fontWeight: 700,
            color: "#6b7280",
            borderBottom: "1px solid #e2e5ea",
          }}
        >
          <span>日付</span>
          <span>相手科目</span>
          <span style={{ textAlign: "right" }}>借方</span>
          <span style={{ textAlign: "right" }}>貸方</span>
          <span style={{ textAlign: "right" }}>残高</span>
        </div>
        {rows.length === 0 && (
          <p style={{ padding: 16, fontSize: 12, color: "#9ca3af" }}>この科目の仕訳はまだありません。</p>
        )}
        {rows.map((row) => (
          <div
            key={row.entry.id}
            style={{
              display: "grid",
              gridTemplateColumns: "70px 1fr 60px 60px 70px",
              gap: 4,
              padding: "8px 10px",
              fontSize: 12,
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <span style={{ color: "#6b7280" }}>{row.entry.date.slice(5)}</span>
            <span style={{ color: "#1e293b" }}>{row.counterAccount?.name ?? "-"}</span>
            <span style={{ textAlign: "right", color: "#1e293b" }}>
              {row.debitAmount ? fmt(row.debitAmount) : ""}
            </span>
            <span style={{ textAlign: "right", color: "#1e293b" }}>
              {row.creditAmount ? fmt(row.creditAmount) : ""}
            </span>
            <span style={{ textAlign: "right", fontWeight: 700, color: "#1e293b" }}>{fmt(row.balance)}</span>
          </div>
        ))}
        {rows.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 10px",
              background: "#f8fafc",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <span>残高（{normal === "debit" ? "借方" : "貸方"}側が正常）</span>
            <span>{fmt(rows[rows.length - 1].balance)}円</span>
          </div>
        )}
      </div>
    </div>
  );
}
