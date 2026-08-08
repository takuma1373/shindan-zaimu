"use client";

import { useState } from "react";
import AccountCombobox from "@/components/shiwake/AccountCombobox";

interface Line {
  account: string;
  amount: string;
}

interface Perspective {
  role: "cpa" | "accountant" | "instructor";
  comment: string;
}

interface CheckResult {
  mode: "graded" | "inferred";
  perspectives: Perspective[];
  usageContext?: string;
  // graded モード（取引内容が入力されている場合）
  isCorrect?: boolean;
  correctDebits?: { account: string; amount: number }[];
  correctCredits?: { account: string; amount: number }[];
  // inferred モード（取引内容が未入力の場合）
  isPlausible?: boolean;
  inferredTransaction?: string;
}

const PERSONA_META: Record<Perspective["role"], { label: string; color: string }> = {
  cpa: { label: "公認会計士", color: "#4f46e5" },
  accountant: { label: "大企業の経理担当", color: "#0d9488" },
  instructor: { label: "予備校講師", color: "#ea580c" },
};

function PerspectiveList({ perspectives }: { perspectives: Perspective[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
      {perspectives.map((p) => {
        const meta = PERSONA_META[p.role] ?? { label: p.role, color: "#6b7280" };
        return (
          <div key={p.role} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: meta.color, marginBottom: 2 }}>{meta.label}</div>
            <p style={{ fontSize: 12, color: "#374151" }}>{p.comment}</p>
          </div>
        );
      })}
    </div>
  );
}

const emptyLine = (): Line => ({ account: "", amount: "" });

const LEVELS: { value: "3" | "2" | "1"; label: string }[] = [
  { value: "3", label: "3級" },
  { value: "2", label: "2級" },
  { value: "1", label: "1級" },
];

function LinesEditor({
  title,
  lines,
  onChange,
}: {
  title: string;
  lines: Line[];
  onChange: (lines: Line[]) => void;
}) {
  function updateLine(index: number, field: keyof Line, value: string) {
    onChange(lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }
  function addLine() {
    onChange([...lines, emptyLine()]);
  }
  function removeLine(index: number) {
    onChange(lines.filter((_, i) => i !== index));
  }

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
        {title}
      </span>
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            marginBottom: 8,
            padding: 8,
            borderRadius: 8,
            border: "1px solid #f1f5f9",
            background: "#f8fafc",
          }}
        >
          <div style={{ marginBottom: 6 }}>
            <AccountCombobox
              value={line.account}
              onChange={(v) => updateLine(i, "account", v)}
              placeholder="科目名（タップで候補）"
            />
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="number"
              inputMode="numeric"
              value={line.amount}
              onChange={(e) => updateLine(i, "amount", e.target.value)}
              placeholder="金額"
              style={{
                flex: 1,
                minWidth: 0,
                boxSizing: "border-box",
                padding: "12px 10px",
                borderRadius: 8,
                border: "1px solid #e2e5ea",
                fontSize: 16,
              }}
            />
            {lines.length > 1 && (
              <button
                type="button"
                onClick={() => removeLine(i)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#dc2626",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "12px 6px",
                  flexShrink: 0,
                }}
              >
                削除
              </button>
            )}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addLine}
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: "1px dashed #cbd5e1",
          background: "transparent",
          color: "#2563eb",
          borderRadius: 8,
          padding: "10px 8px",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        ＋ {title}を追加
      </button>
    </div>
  );
}

function EntryList({ lines }: { lines: { account: string; amount: number }[] }) {
  return (
    <div>
      {lines.map((l, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
          <span>{l.account}</span>
          <span>{l.amount.toLocaleString("ja-JP")}円</span>
        </div>
      ))}
    </div>
  );
}

export default function ShiwakePage() {
  const [level, setLevel] = useState<"3" | "2" | "1">("2");
  const [transaction, setTransaction] = useState("");
  const [debits, setDebits] = useState<Line[]>([emptyLine()]);
  const [credits, setCredits] = useState<Line[]>([emptyLine()]);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toApiLines(lines: Line[]) {
    return lines.map((l) => ({ account: l.account, amount: Number(l.amount) }));
  }

  async function runCheck(revealAnswer: boolean) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/shiwake/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction,
          level,
          debits: toApiLines(debits),
          credits: toApiLines(credits),
          attemptNumber,
          revealAnswer,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "判定に失敗しました");
      setResult(data);
      if (!revealAnswer && data.mode === "graded" && !data.isCorrect) {
        setAttemptNumber((n) => n + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "判定に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setTransaction("");
    setDebits([emptyLine()]);
    setCredits([emptyLine()]);
    setAttemptNumber(1);
    setResult(null);
    setError(null);
  }

  return (
    <main className="app">
      <header className="header">
        <h1>簿記仕訳チェック</h1>
        <p>取引を入力して、自分の仕訳をAIが判定・ヒント表示</p>
      </header>

      <nav className="tabs">
        {LEVELS.map((l) => (
          <button
            key={l.value}
            className={`tab ${level === l.value ? "active" : ""}`}
            onClick={() => setLevel(l.value)}
          >
            {l.label}
          </button>
        ))}
      </nav>

      <section className="content" style={{ padding: "8px 0" }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid #e2e5ea" }}>
          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
              取引内容（任意）
            </span>
            <textarea
              value={transaction}
              onChange={(e) => setTransaction(e.target.value)}
              placeholder="空欄でもOK。空欄の場合は、入力した仕訳からAIが取引内容を推測して解説します。&#10;例）商品100,000円を掛けで仕入れた。消費税10%、税抜方式で処理する。"
              rows={3}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #e2e5ea",
                fontSize: 16,
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
          </label>

          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <LinesEditor title="借方" lines={debits} onChange={setDebits} />
            <div style={{ width: 1, background: "#e2e5ea", flexShrink: 0 }} />
            <LinesEditor title="貸方" lines={credits} onChange={setCredits} />
          </div>

          {error && <p style={{ color: "#dc2626", fontSize: 12, marginBottom: 10 }}>{error}</p>}

          <button
            type="button"
            onClick={() => runCheck(false)}
            disabled={submitting}
            style={{
              width: "100%",
              padding: "14px 0",
              borderRadius: 8,
              border: "none",
              background: submitting ? "#93c5fd" : "#2563eb",
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            {submitting ? "処理中..." : transaction.trim() ? "判定する" : "この仕訳を解説する"}
          </button>
        </div>

        {result && result.mode === "inferred" && (
          <div
            style={{
              marginTop: 12,
              background: "#fff",
              borderRadius: 12,
              border: `1px solid ${result.isPlausible === false ? "#dc2626" : "#e2e5ea"}`,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", marginBottom: 8 }}>
              {result.isPlausible === false ? "この組み合わせは少し不自然です" : "この仕訳の解説"}
            </div>

            {result.inferredTransaction && (
              <div style={{ background: "#eff6ff", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", marginBottom: 2 }}>
                  推測される取引内容
                </div>
                <p style={{ fontSize: 13, color: "#374151" }}>{result.inferredTransaction}</p>
              </div>
            )}

            {result.perspectives && <PerspectiveList perspectives={result.perspectives} />}

            {result.usageContext && (
              <div style={{ background: "#eff6ff", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", marginBottom: 2 }}>
                  この仕訳が使われる場面
                </div>
                <p style={{ fontSize: 12, color: "#374151" }}>{result.usageContext}</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleReset}
              style={{
                width: "100%",
                marginTop: 8,
                padding: "12px 0",
                borderRadius: 8,
                border: "1px solid #e2e5ea",
                background: "#fff",
                color: "#374151",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              新しい仕訳を入力する
            </button>
          </div>
        )}

        {result && result.mode === "graded" && (
          <div
            style={{
              marginTop: 12,
              background: "#fff",
              borderRadius: 12,
              border: `1px solid ${result.isCorrect ? "#16a34a" : "#dc2626"}`,
              padding: 16,
            }}
          >
            <div
              style={{
                display: "inline-block",
                fontSize: 13,
                fontWeight: 700,
                color: result.isCorrect ? "#16a34a" : "#dc2626",
                marginBottom: 8,
              }}
            >
              {result.isCorrect ? "正解 ✓" : "不正解 ✗"}
            </div>

            {result.perspectives && <PerspectiveList perspectives={result.perspectives} />}

            {result.usageContext && (
              <div style={{ background: "#eff6ff", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", marginBottom: 2 }}>
                  この仕訳が使われる場面
                </div>
                <p style={{ fontSize: 12, color: "#374151" }}>{result.usageContext}</p>
              </div>
            )}

            {result.correctDebits && result.correctCredits && (
              <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>正解の仕訳</div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>借方</div>
                    <EntryList lines={result.correctDebits} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>貸方</div>
                    <EntryList lines={result.correctCredits} />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {!result.isCorrect && !result.correctDebits && (
                <button
                  type="button"
                  onClick={() => runCheck(true)}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    borderRadius: 8,
                    border: "1px solid #e2e5ea",
                    background: "#fff",
                    color: "#374151",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  正解を見る
                </button>
              )}
              <button
                type="button"
                onClick={handleReset}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 8,
                  border: "1px solid #e2e5ea",
                  background: "#fff",
                  color: "#374151",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                新しい取引を入力する
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
