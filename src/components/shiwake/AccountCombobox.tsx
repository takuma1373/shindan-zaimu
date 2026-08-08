"use client";

import { useMemo, useState } from "react";
import { ALL_SHIWAKE_ACCOUNTS, COMMON_SHIWAKE_ACCOUNTS } from "@/data/shiwakeAccounts";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// スマホでの片手操作を想定: タップ領域を大きめに確保し、
// input要素はfont-size 16px以上にしてiOS Safariの自動ズームを防ぐ。
export default function AccountCombobox({ value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = value.trim();
    if (!q) return [];
    return ALL_SHIWAKE_ACCOUNTS.filter((a) => a.includes(q)).slice(0, 8);
  }, [value]);

  function select(account: string) {
    onChange(account);
    setOpen(false);
  }

  const showQuickPicks = open && !value.trim();
  const showSuggestions = open && suggestions.length > 0;

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "12px 10px",
          borderRadius: 8,
          border: "1px solid #e2e5ea",
          fontSize: 16,
        }}
      />
      {(showQuickPicks || showSuggestions) && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #e2e5ea",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            zIndex: 20,
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {showQuickPicks && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 8 }}>
              {COMMON_SHIWAKE_ACCOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(a)}
                  style={{
                    border: "1px solid #bfdbfe",
                    background: "#eff6ff",
                    color: "#2563eb",
                    borderRadius: 999,
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
          {showSuggestions &&
            suggestions.map((a) => (
              <button
                key={a}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(a)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  borderTop: "1px solid #f1f5f9",
                  background: "#fff",
                  padding: "12px",
                  fontSize: 15,
                  color: "#1e293b",
                }}
              >
                {a}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
