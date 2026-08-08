"use client";

import { useState } from "react";
import {
  CATEGORY_INFO,
  CATEGORY_ORDER,
  GROUP_INFO,
  GROUP_ORDER,
  groupsForCategory,
  type Account,
  type Category,
  type Group,
} from "@/data/ledgerAccounts";
import type { JournalEntry } from "@/lib/ledger";

export interface AccountInput {
  name: string;
  category: Category;
  group: Group;
  isContra: boolean;
}

interface Props {
  accounts: Account[];
  entries: JournalEntry[];
  onAdd: (input: AccountInput) => Promise<void>;
  onEdit: (id: string, input: AccountInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #e2e5ea",
  fontSize: 13,
  background: "#fff",
};

function AccountFields({
  value,
  onChange,
}: {
  value: AccountInput;
  onChange: (v: AccountInput) => void;
}) {
  const groups = groupsForCategory(value.category);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input
        type="text"
        placeholder="科目名"
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        style={inputStyle}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <select
          value={value.category}
          onChange={(e) => {
            const category = e.target.value as Category;
            onChange({ ...value, category, group: groupsForCategory(category)[0] });
          }}
          style={inputStyle}
        >
          {CATEGORY_ORDER.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_INFO[cat].label}
            </option>
          ))}
        </select>
        <select value={value.group} onChange={(e) => onChange({ ...value, group: e.target.value as Group })} style={inputStyle}>
          {groups.map((g) => (
            <option key={g} value={g}>
              {GROUP_INFO[g].label}
            </option>
          ))}
        </select>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
        <input
          type="checkbox"
          checked={value.isContra}
          onChange={(e) => onChange({ ...value, isContra: e.target.checked })}
        />
        評価勘定（マイナス勘定）として扱う
      </label>
    </div>
  );
}

const emptyInput = (): AccountInput => ({
  name: "",
  category: "asset",
  group: groupsForCategory("asset")[0],
  isContra: false,
});

export default function AccountMaster({ accounts, entries, onAdd, onEdit, onDelete }: Props) {
  const [newAccount, setNewAccount] = useState<AccountInput>(emptyInput());
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<AccountInput>(emptyInput());
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const usedAccountIds = new Set(entries.flatMap((e) => [e.debit, e.credit]));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAdding(true);
    try {
      await onAdd(newAccount);
      setNewAccount(emptyInput());
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "科目の追加に失敗しました");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(account: Account) {
    setEditingId(account.id);
    setEditValue({
      name: account.name,
      category: account.category,
      group: account.group,
      isContra: !!account.isContra,
    });
    setEditError(null);
  }

  async function handleEditSave(id: string) {
    setEditError(null);
    try {
      await onEdit(id, editValue);
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "科目の更新に失敗しました");
    }
  }

  async function handleDelete(id: string) {
    setDeleteError(null);
    try {
      await onDelete(id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "科目の削除に失敗しました");
    }
  }

  return (
    <div style={{ padding: "8px 0" }}>
      <form
        onSubmit={handleAdd}
        style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid #e2e5ea", marginBottom: 16 }}
      >
        <h3 style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>科目を追加</h3>
        <AccountFields value={newAccount} onChange={setNewAccount} />
        {addError && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 8 }}>{addError}</p>}
        <button
          type="submit"
          disabled={adding}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "9px 0",
            borderRadius: 8,
            border: "none",
            background: adding ? "#93c5fd" : "#2563eb",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {adding ? "追加中..." : "科目を追加する"}
        </button>
      </form>

      {deleteError && <p style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>{deleteError}</p>}

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e5ea", overflow: "hidden" }}>
        {GROUP_ORDER.map((group) => {
          const groupAccounts = accounts.filter((a) => a.group === group);
          if (groupAccounts.length === 0) return null;
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
              {groupAccounts.map((account) => {
                const isEditing = editingId === account.id;
                const inUse = usedAccountIds.has(account.id);
                if (isEditing) {
                  return (
                    <div key={account.id} style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>
                      <AccountFields value={editValue} onChange={setEditValue} />
                      {editError && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 6 }}>{editError}</p>}
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button
                          onClick={() => handleEditSave(account.id)}
                          style={{
                            flex: 1,
                            padding: "6px 0",
                            borderRadius: 6,
                            border: "none",
                            background: "#2563eb",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{
                            flex: 1,
                            padding: "6px 0",
                            borderRadius: 6,
                            border: "1px solid #e2e5ea",
                            background: "#fff",
                            color: "#374151",
                            fontSize: 12,
                          }}
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={account.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 10px",
                      fontSize: 12,
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <span style={{ color: "#1e293b" }}>
                      {account.name}
                      {account.isContra && (
                        <span style={{ color: "#d97706", fontWeight: 700, marginLeft: 6, fontSize: 11 }}>
                          評価勘定
                        </span>
                      )}
                    </span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => startEdit(account)}
                        style={{
                          border: "1px solid #e2e5ea",
                          background: "#fff",
                          color: "#374151",
                          fontSize: 11,
                          padding: "4px 8px",
                          borderRadius: 6,
                        }}
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(account.id)}
                        disabled={inUse}
                        title={inUse ? "仕訳で使用中のため削除できません" : undefined}
                        style={{
                          border: "1px solid #fecaca",
                          background: "#fff",
                          color: inUse ? "#d1d5db" : "#dc2626",
                          fontSize: 11,
                          padding: "4px 8px",
                          borderRadius: 6,
                          cursor: inUse ? "not-allowed" : "pointer",
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
