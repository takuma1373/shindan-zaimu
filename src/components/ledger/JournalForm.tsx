"use client";

import { useMemo, useState } from "react";
import type { Account } from "@/data/ledgerAccounts";
import type { JournalEntry, NewJournalEntry } from "@/lib/ledger";
import { suggestAccounts, validateEntry } from "@/lib/ledger";
import GroupedAccountOptions from "./GroupedAccountOptions";

const fmt = (n: number) => `${n.toLocaleString("ja-JP")}円`;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function AccountSelect({
  accounts,
  value,
  onChange,
  label,
}: {
  accounts: Account[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid #e2e5ea",
          fontSize: 14,
          background: "#fff",
        }}
      >
        <option value="">選択してください</option>
        <GroupedAccountOptions accounts={accounts} />
      </select>
    </label>
  );
}

interface Props {
  accounts: Account[];
  entries: JournalEntry[];
  onAdd: (entry: NewJournalEntry) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function JournalForm({ accounts, entries, onAdd, onDelete }: Props) {
  const [date, setDate] = useState(today());
  const [debit, setDebit] = useState("");
  const [credit, setCredit] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;

  const suggestions = useMemo(() => suggestAccounts(memo, accounts), [memo, accounts]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = Number(amount);
    const validationError = validateEntry({ date, debit, credit, amount: amountNum });
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onAdd({ date, debit, credit, amount: amountNum, memo });
      setAmount("");
      setMemo("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "仕訳の保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  const sorted = entries
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  return (
    <div style={{ padding: "8px 0" }}>
      <form
        onSubmit={handleSubmit}
        style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid #e2e5ea" }}
      >
        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
            日付
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #e2e5ea",
              fontSize: 14,
            }}
          />
        </label>

        <AccountSelect accounts={accounts} value={debit} onChange={setDebit} label="借方科目" />
        <AccountSelect accounts={accounts} value={credit} onChange={setCredit} label="貸方科目" />

        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
            金額
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #e2e5ea",
              fontSize: 14,
            }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
            メモ（任意）
          </span>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="例）スーパーで食材購入"
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #e2e5ea",
              fontSize: 14,
            }}
          />
        </label>

        {suggestions.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, marginTop: -4 }}>
            {suggestions.map((s) => (
              <button
                key={s.account.id}
                type="button"
                onClick={() => (s.field === "debit" ? setDebit(s.account.id) : setCredit(s.account.id))}
                style={{
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  color: "#2563eb",
                  borderRadius: 999,
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {s.account.name}
                <span style={{ color: "#93c5fd", marginLeft: 4 }}>
                  ({s.field === "debit" ? "借方" : "貸方"})
                </span>
              </button>
            ))}
          </div>
        )}

        {error && <p style={{ color: "#dc2626", fontSize: 12, marginBottom: 10 }}>{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            padding: "10px 0",
            borderRadius: 8,
            border: "none",
            background: submitting ? "#93c5fd" : "#2563eb",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {submitting ? "保存中..." : "仕訳を記帳する"}
        </button>
      </form>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
          直近の仕訳（{sorted.length}件）
        </h3>
        {sorted.length === 0 && (
          <p style={{ fontSize: 12, color: "#9ca3af" }}>まだ仕訳がありません。上のフォームから記帳してください。</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((e) => (
            <div
              key={e.id}
              style={{
                background: "#fff",
                border: "1px solid #e2e5ea",
                borderRadius: 10,
                padding: "10px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{e.date}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                  {accountName(e.debit)} / {accountName(e.credit)}
                </div>
                {e.memo && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{e.memo}</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{fmt(e.amount)}</span>
                <button
                  onClick={() => onDelete(e.id)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#dc2626",
                    fontSize: 12,
                    padding: "4px 6px",
                  }}
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
