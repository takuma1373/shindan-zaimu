"use client";

import { useState } from "react";

interface Line {
  account: string;
  amount: string;
}

interface CheckResult {
  isCorrect: boolean;
  comment: string;
  hint?: string;
  usageContext?: string;
  correctDebits?: { account: string; amount: number }[];
  correctCredits?: { account: string; amount: number }[];
  explanation?: string;
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
    <div style={{ marginBottom: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>
        {title}
      </span>
      {lines.map((line, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input
            type="text"
            value={line.account}
            onChange={(e) => updateLine(i, "account", e.target.value)}
            placeholder="科目名"
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #e2e5ea",
              fontSize: 14,
            }}
          />
          <input
            type="number"
            inputMode="numeric"
            value={line.amount}
            onChange={(e) => updateLine(i, "amount", e.target.value)}
            placeholder="金額"
            style={{
              width: 110,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #e2e5ea",
              fontSize: 14,
            }}
          />
          {lines.length > 1 && (
            <button
              type="button"
              onClick={() => removeLine(i)}
              style={{ border: "none", background: "transparent", color: "#dc2626", fontSize: 12, padding: "0 4px" }}
            >
              削除
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addLine}
        style={{
          border: "1px dashed #cbd5e1",
          background: "transparent",
          color: "#2563eb",
          borderRadius: 8,
          padding: "6px 10px",
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
      if (!revealAnswer && !data.isCorrect) {
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
              取引内容
            </span>
            <textarea
              value={transaction}
              onChange={(e) => setTransaction(e.target.value)}
              placeholder="例）商品100,000円を掛けで仕入れた。消費税10%、税抜方式で処理する。"
              rows={3}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #e2e5ea",
                fontSize: 14,
                resize: "vertical",
              }}
            />
          </label>

          <LinesEditor title="借方" lines={debits} onChange={setDebits} />
          <LinesEditor title="貸方" lines={credits} onChange={setCredits} />

          {error && <p style={{ color: "#dc2626", fontSize: 12, marginBottom: 10 }}>{error}</p>}

          <button
            type="button"
            onClick={() => runCheck(false)}
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
            {submitting ? "判定中..." : "判定する"}
          </button>
        </div>

        {result && (
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
            <p style={{ fontSize: 13, color: "#374151", marginBottom: 8 }}>{result.comment}</p>

            {!result.isCorrect && result.hint && (
              <p style={{ fontSize: 12, color: "#b45309", background: "#fffbeb", borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
                ヒント: {result.hint}
              </p>
            )}

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
                {result.explanation && (
                  <p style={{ fontSize: 12, color: "#374151", marginTop: 8 }}>{result.explanation}</p>
                )}
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
                    padding: "8px 0",
                    borderRadius: 8,
                    border: "1px solid #e2e5ea",
                    background: "#fff",
                    color: "#374151",
                    fontSize: 13,
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
                  padding: "8px 0",
                  borderRadius: 8,
                  border: "1px solid #e2e5ea",
                  background: "#fff",
                  color: "#374151",
                  fontSize: 13,
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
