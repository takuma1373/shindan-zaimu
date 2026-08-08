"use client";

import { useEffect, useState } from "react";
import type { Account } from "@/data/ledgerAccounts";
import type { JournalEntry, NewJournalEntry } from "@/lib/ledger";
import JournalForm from "@/components/ledger/JournalForm";
import GeneralLedgerView from "@/components/ledger/GeneralLedgerView";
import TrialBalanceView from "@/components/ledger/TrialBalanceView";
import FinancialStatements from "@/components/ledger/FinancialStatements";
import AccountMaster, { type AccountInput } from "@/components/ledger/AccountMaster";
import FixedAssetsView from "@/components/ledger/FixedAssetsView";

type Mode = "journal" | "ledger" | "trial" | "statements" | "accounts" | "fixedAssets";

export default function LedgerPage() {
  const [mode, setMode] = useState<Mode>("journal");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [usefulLifeOverrides, setUsefulLifeOverrides] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/ledger/entries").then((res) => res.json()),
      fetch("/api/ledger/accounts").then((res) => res.json()),
      fetch("/api/ledger/fixed-assets").then((res) => res.json()),
    ])
      .then(([entriesData, accountsData, fixedAssetsData]) => {
        setEntries(entriesData.entries ?? []);
        setAccounts(accountsData.accounts ?? []);
        setUsefulLifeOverrides(fixedAssetsData.usefulLifeOverrides ?? {});
      })
      .catch(() => setError("データの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  async function updateUsefulLife(entryId: string, years: number) {
    const res = await fetch("/api/ledger/fixed-assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId, usefulLifeYears: years }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "耐用年数の更新に失敗しました");
    setUsefulLifeOverrides(data.usefulLifeOverrides ?? {});
  }

  async function addEntry(input: NewJournalEntry) {
    const res = await fetch("/api/ledger/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "仕訳の保存に失敗しました");
    setEntries((prev) => [...prev, data.entry]);
  }

  async function deleteEntry(id: string) {
    const res = await fetch(`/api/ledger/entries/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "仕訳の削除に失敗しました");
    setEntries(data.entries ?? []);
  }

  async function addAccount(input: AccountInput) {
    const res = await fetch("/api/ledger/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "科目の追加に失敗しました");
    setAccounts((prev) => [...prev, data.account]);
  }

  async function editAccount(id: string, input: AccountInput) {
    const res = await fetch(`/api/ledger/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "科目の更新に失敗しました");
    setAccounts((prev) => prev.map((a) => (a.id === id ? data.account : a)));
  }

  async function deleteAccount(id: string) {
    const res = await fetch(`/api/ledger/accounts/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "科目の削除に失敗しました");
    setAccounts(data.accounts ?? []);
  }

  return (
    <main className="app">
      <header className="header">
        <h1>複式簿記家計簿</h1>
        <p>仕訳 → 元帳 → 試算表 → B/S・P/L</p>
      </header>

      <nav className="tabs">
        <button className={`tab ${mode === "journal" ? "active" : ""}`} onClick={() => setMode("journal")}>
          仕訳入力
        </button>
        <button className={`tab ${mode === "ledger" ? "active" : ""}`} onClick={() => setMode("ledger")}>
          元帳
        </button>
        <button className={`tab ${mode === "trial" ? "active" : ""}`} onClick={() => setMode("trial")}>
          試算表
        </button>
        <button className={`tab ${mode === "statements" ? "active" : ""}`} onClick={() => setMode("statements")}>
          B/S・P/L
        </button>
        <button className={`tab ${mode === "accounts" ? "active" : ""}`} onClick={() => setMode("accounts")}>
          科目マスタ
        </button>
        <button
          className={`tab ${mode === "fixedAssets" ? "active" : ""}`}
          onClick={() => setMode("fixedAssets")}
        >
          固定資産
        </button>
      </nav>

      <section className="content">
        {loading && <p style={{ padding: 16, color: "#6b7280", fontSize: 13 }}>読み込み中...</p>}
        {error && <p style={{ padding: 16, color: "#dc2626", fontSize: 13 }}>{error}</p>}
        {!loading && mode === "journal" && (
          <JournalForm accounts={accounts} entries={entries} onAdd={addEntry} onDelete={deleteEntry} />
        )}
        {!loading && mode === "ledger" && <GeneralLedgerView accounts={accounts} entries={entries} />}
        {!loading && mode === "trial" && <TrialBalanceView accounts={accounts} entries={entries} />}
        {!loading && mode === "statements" && <FinancialStatements accounts={accounts} entries={entries} />}
        {!loading && mode === "accounts" && (
          <AccountMaster
            accounts={accounts}
            entries={entries}
            onAdd={addAccount}
            onEdit={editAccount}
            onDelete={deleteAccount}
          />
        )}
        {!loading && mode === "fixedAssets" && (
          <FixedAssetsView
            accounts={accounts}
            entries={entries}
            usefulLifeOverrides={usefulLifeOverrides}
            onUpdateUsefulLife={updateUsefulLife}
          />
        )}
      </section>
    </main>
  );
}
