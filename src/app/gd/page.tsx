"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────
type Stage = "setup" | "discussion" | "result";

interface AIResponse {
  name: string;
  message: string;
}

interface RealtimeFeedback {
  score: number;
  comment: string;
  tip: string;
}

interface ChatMessage {
  id: string;
  type: "ai" | "user";
  name?: string;
  text: string;
  feedback?: RealtimeFeedback;
  color?: string;
}

interface FinalEvaluation {
  scores: { logic: number; assertion: number; drive: number; perspective: number };
  summary: string;
  strengths: string[];
  improvements: string[];
  best_moment: string;
}

interface HistoryEntry {
  role: "user" | "assistant";
  content: string;
}

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────
const EXAMPLE_THEME_GROUPS = [
  {
    category: "公共DX・事業戦略",
    themes: [
      "NTTデータグループの2030年に向けた公共DX戦略",
      "生成AI導入で変わる公共システム開発の役割分担",
      "レガシーシステム刷新が進まない自治体への提案",
      "マイナンバーカード普及後の次の行政DXステップ",
      "海外展開（GTSS）と国内公共事業のリソース配分",
    ],
  },
  {
    category: "マネジメント・組織",
    themes: [
      "メンバーのモチベーションが低下している原因と対策",
      "チームの生産性を上げるための働き方改革案",
      "若手エンジニアの離職を防ぐための施策",
      "多様なスキルレベルのメンバーをまとめるリーダーのあり方",
    ],
  },
  {
    category: "経営課題",
    themes: [
      "売上は維持しているが利益率が低下している事業をどう立て直すか",
      "新規事業参入か既存事業深化か、限られたリソースをどう配分するか",
    ],
  },
  {
    category: "緊急対応",
    themes: [
      "本番障害が発生、原因不明のまま経営層へ報告が必要な状況での対応",
      "プロジェクトが炎上、メンバーの残業が限界に達している状況の打開策",
    ],
  },
];

const CHARACTER_COLORS: Record<string, string> = {
  "田中（積極派）": "#2563eb",
  "佐藤（慎重派）": "#d97706",
  "鈴木（まとめ役）": "#16a34a",
};

const AXES = [
  { key: "logic", label: "論理性", desc: "主張に根拠があるか。筋道立てて説明できているか" },
  { key: "assertion", label: "主張性", desc: "自分の意見を明確に述べているか" },
  { key: "drive", label: "推進力", desc: "議論を前進させ、まとめに貢献しているか" },
  { key: "perspective", label: "視座の高さ", desc: "広い視点・多面的な観点から発言できているか" },
] as const;

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function StarRating({ score }: { score: number }) {
  return (
    <span style={{ color: "#f59e0b", letterSpacing: "1px" }}>
      {"★".repeat(score)}
      <span style={{ color: "#d1d5db" }}>{"★".repeat(5 - score)}</span>
    </span>
  );
}

function Spinner() {
  return (
    <div
      style={{
        display: "inline-block",
        width: 18,
        height: 18,
        border: "2px solid #e5e7eb",
        borderTop: "2px solid #2563eb",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}

// ────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────
function ScoreCard({ label, score, desc }: { label: string; score: number; desc: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#1f2933" }}>{label}</div>
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{desc}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#2563eb", lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 10, color: "#6b7280" }}>/ 5</div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────
export default function GDPage() {
  const [stage, setStage] = useState<Stage>("setup");
  const [theme, setTheme] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finalEvaluation, setFinalEvaluation] = useState<FinalEvaluation | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Timer
  useEffect(() => {
    if (stage === "discussion") {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stage]);

  // ── API calls ────────────────────────────────────────────────
  const callAPI = useCallback(
    async (userMessage: string, mode: string): Promise<unknown> => {
      const res = await fetch("/api/gd/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, history, userMessage, mode }),
      });
      if (!res.ok) throw new Error("API error");
      return res.json();
    },
    [theme, history]
  );

  // ── Start discussion ─────────────────────────────────────────
  const startDiscussion = async () => {
    if (!theme.trim()) return;
    setStage("discussion");
    setIsLoading(true);

    const openingMsg = `テーマ「${theme}」についてグループディスカッションを始めましょう。各自の立場から意見を述べてください。`;

    try {
      const data = (await callAPI(openingMsg, "discuss")) as { responses: AIResponse[] };
      const aiHistory: HistoryEntry = { role: "assistant", content: JSON.stringify(data) };

      const newMessages: ChatMessage[] = data.responses.map((r) => ({
        id: crypto.randomUUID(),
        type: "ai",
        name: r.name,
        text: r.message,
        color: CHARACTER_COLORS[r.name] ?? "#374151",
      }));

      setMessages(newMessages);
      setHistory([
        { role: "user", content: openingMsg },
        aiHistory,
      ]);
    } catch {
      setMessages([
        {
          id: crypto.randomUUID(),
          type: "ai",
          name: "システム",
          text: "APIエラーが発生しました。再度お試しください。",
          color: "#6b7280",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Send user message ────────────────────────────────────────
  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;
    setInputText("");
    setIsLoading(true);

    const userMsgId = crypto.randomUUID();
    const tempUserMsg: ChatMessage = { id: userMsgId, type: "user", text };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      // Realtime feedback
      const feedback = (await callAPI(text, "realtime_feedback")) as RealtimeFeedback;

      // Update user message with feedback
      setMessages((prev) =>
        prev.map((m) => (m.id === userMsgId ? { ...m, feedback } : m))
      );

      // Update history with user message
      const newHistory: HistoryEntry[] = [
        ...history,
        { role: "user", content: text },
      ];

      // AI responses
      const discussData = (await callAPI(text, "discuss")) as { responses: AIResponse[] };
      const aiHistory: HistoryEntry = { role: "assistant", content: JSON.stringify(discussData) };

      const aiMessages: ChatMessage[] = discussData.responses.map((r) => ({
        id: crypto.randomUUID(),
        type: "ai",
        name: r.name,
        text: r.message,
        color: CHARACTER_COLORS[r.name] ?? "#374151",
      }));

      setMessages((prev) => [...prev, ...aiMessages]);
      setHistory([...newHistory, aiHistory]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "ai",
          name: "システム",
          text: "エラーが発生しました。",
          color: "#6b7280",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── End and evaluate ─────────────────────────────────────────
  const endDiscussion = async () => {
    setIsLoading(true);
    try {
      const evalData = (await callAPI(
        "ディスカッションを終了します。これまでの私の発言全体を評価してください。",
        "final_evaluation"
      )) as FinalEvaluation;
      setFinalEvaluation(evalData);
      setStage("result");
    } catch {
      alert("評価の取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────
  const reset = () => {
    setStage("setup");
    setTheme("");
    setMessages([]);
    setHistory([]);
    setInputText("");
    setElapsed(0);
    setFinalEvaluation(null);
  };

  // ────────────────────────────────────────────────────────────
  // Render: Setup
  // ────────────────────────────────────────────────────────────
  if (stage === "setup") {
    return (
      <div style={{ minHeight: "100dvh", background: "#f5f6f8", padding: "0 0 40px" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* Header */}
        <div
          style={{
            background: "#fff",
            borderBottom: "1px solid #e5e7eb",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <a href="/" style={{ color: "#6b7280", fontSize: 20, textDecoration: "none" }}>
            ←
          </a>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#1f2933" }}>GD練習シミュレーター</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>AIとのグループディスカッション練習</div>
          </div>
        </div>

        <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
          {/* Theme input */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <label
              style={{ display: "block", fontWeight: 700, fontSize: 15, color: "#1f2933", marginBottom: 10 }}
            >
              ディスカッションテーマを入力
            </label>
            <textarea
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="例：中小企業のDX推進における人材育成の課題"
              rows={3}
              style={{
                width: "100%",
                border: "1px solid #d1d5db",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 15,
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none",
                color: "#1f2933",
                lineHeight: 1.6,
              }}
            />

            <button
              onClick={startDiscussion}
              disabled={!theme.trim() || isLoading}
              style={{
                marginTop: 12,
                width: "100%",
                background: theme.trim() ? "#2563eb" : "#9ca3af",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "14px",
                fontSize: 16,
                fontWeight: 700,
                cursor: theme.trim() ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {isLoading ? <Spinner /> : "ディスカッションを開始"}
            </button>
          </div>

          {/* Example themes */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: "#374151", marginBottom: 12 }}>
              テーマ例（クリックで入力）
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {EXAMPLE_THEME_GROUPS.map((group) => (
                <div key={group.category}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#6b7280",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: 6,
                    }}
                  >
                    {group.category}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {group.themes.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTheme(t)}
                        style={{
                          background: "#f9fafb",
                          border: "1px solid #e5e7eb",
                          borderRadius: 10,
                          padding: "10px 14px",
                          fontSize: 13,
                          color: "#374151",
                          textAlign: "left",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          lineHeight: 1.5,
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.background = "#eff6ff")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.background = "#f9fafb")
                        }
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div style={{ marginTop: 16, padding: "0 4px" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
              このシミュレーターについて
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7 }}>
              3人のAIキャラクター（田中・佐藤・鈴木）とグループディスカッションを練習できます。
              発言するたびにリアルタイムでフィードバックを受け取り、終了後は4つの軸（論理性・主張性・推進力・視座の高さ）で評価されます。
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // Render: Result
  // ────────────────────────────────────────────────────────────
  if (stage === "result" && finalEvaluation) {
    return (
      <div style={{ minHeight: "100dvh", background: "#f5f6f8", padding: "0 0 40px" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        {/* Header */}
        <div
          style={{
            background: "#fff",
            borderBottom: "1px solid #e5e7eb",
            padding: "16px 20px",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 17, color: "#1f2933" }}>評価結果</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{theme}</div>
        </div>

        <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px" }}>
          {/* Score cards */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1f2933", marginBottom: 10 }}>
              評価スコア
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {AXES.map((axis) => (
                <ScoreCard
                  key={axis.key}
                  label={axis.label}
                  score={finalEvaluation.scores[axis.key]}
                  desc={axis.desc}
                />
              ))}
            </div>
          </div>

          {/* Summary */}
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 14,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1d4ed8", marginBottom: 6 }}>
              総合評価
            </div>
            <div style={{ fontSize: 14, color: "#1f2933", lineHeight: 1.7 }}>
              {finalEvaluation.summary}
            </div>
          </div>

          {/* Strengths */}
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 14,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: "#15803d", marginBottom: 8 }}>
              強み
            </div>
            {finalEvaluation.strengths.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                <span style={{ color: "#16a34a", fontWeight: 700, marginTop: 1 }}>✓</span>
                <span style={{ fontSize: 14, color: "#1f2933", lineHeight: 1.6 }}>{s}</span>
              </div>
            ))}
          </div>

          {/* Improvements */}
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: 14,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: "#c2410c", marginBottom: 8 }}>
              改善点
            </div>
            {finalEvaluation.improvements.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                <span style={{ color: "#ea580c", fontWeight: 700, marginTop: 1 }}>→</span>
                <span style={{ fontSize: 14, color: "#1f2933", lineHeight: 1.6 }}>{s}</span>
              </div>
            ))}
          </div>

          {/* Best moment */}
          {finalEvaluation.best_moment && (
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, color: "#374151", marginBottom: 8 }}>
                最も良かった発言
              </div>
              <blockquote
                style={{
                  margin: 0,
                  paddingLeft: 12,
                  borderLeft: "3px solid #2563eb",
                  fontSize: 14,
                  color: "#374151",
                  fontStyle: "italic",
                  lineHeight: 1.7,
                }}
              >
                {finalEvaluation.best_moment}
              </blockquote>
            </div>
          )}

          {/* Retry button */}
          <button
            onClick={reset}
            style={{
              width: "100%",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "14px",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            もう一度練習する
          </button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // Render: Discussion
  // ────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#f5f6f8",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .gd-hint-col { display: none; }
        @media (min-width: 768px) {
          .gd-layout { flex-direction: row !important; }
          .gd-chat-col { width: 68% !important; }
          .gd-hint-col { display: flex !important; flex-direction: column; width: 32% !important; }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#1f2933", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {theme}
          </div>
        </div>
        <div
          style={{
            background: "#f3f4f6",
            borderRadius: 8,
            padding: "4px 10px",
            fontSize: 14,
            fontWeight: 700,
            color: "#374151",
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
          }}
        >
          {formatTime(elapsed)}
        </div>
      </div>

      {/* Main layout */}
      <div
        className="gd-layout"
        style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        {/* Chat column */}
        <div
          className="gd-chat-col"
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            flex: 1,
          }}
        >
          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 16px 8px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {messages.map((msg) => {
              if (msg.type === "ai") {
                const initial = msg.name ? msg.name.charAt(0) : "A";
                const color = msg.color ?? "#374151";
                return (
                  <div key={msg.id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    {/* Avatar */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: color,
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      {initial}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4, fontWeight: 600 }}>
                        {msg.name}
                      </div>
                      <div
                        style={{
                          background: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "4px 14px 14px 14px",
                          padding: "10px 14px",
                          fontSize: 14,
                          color: "#1f2933",
                          lineHeight: 1.7,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        }}
                      >
                        {msg.text}
                      </div>
                    </div>
                  </div>
                );
              }

              // User message
              return (
                <div
                  key={msg.id}
                  style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}
                >
                  <div
                    style={{
                      background: "#2563eb",
                      color: "#fff",
                      borderRadius: "14px 4px 14px 14px",
                      padding: "10px 14px",
                      fontSize: 14,
                      lineHeight: 1.7,
                      maxWidth: "80%",
                    }}
                  >
                    {msg.text}
                  </div>
                  {/* Feedback badge */}
                  {msg.feedback && (
                    <div
                      style={{
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        padding: "8px 12px",
                        fontSize: 12,
                        maxWidth: "85%",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <StarRating score={msg.feedback.score} />
                        <span style={{ fontWeight: 600, color: "#374151" }}>
                          {msg.feedback.comment}
                        </span>
                      </div>
                      <div style={{ color: "#6b7280" }}>
                        💡 {msg.feedback.tip}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
                <Spinner />
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input area */}
          <div
            style={{
              background: "#fff",
              borderTop: "1px solid #e5e7eb",
              padding: "12px 16px",
              flexShrink: 0,
            }}
          >
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="あなたの意見を入力（Enterで送信、Shift+Enterで改行）"
              rows={3}
              disabled={isLoading}
              style={{
                width: "100%",
                border: "1px solid #d1d5db",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 14,
                fontFamily: "inherit",
                resize: "none",
                outline: "none",
                color: "#1f2933",
                lineHeight: 1.6,
                marginBottom: 8,
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={sendMessage}
                disabled={!inputText.trim() || isLoading}
                style={{
                  flex: 1,
                  background: inputText.trim() && !isLoading ? "#2563eb" : "#9ca3af",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: inputText.trim() && !isLoading ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {isLoading ? <Spinner /> : "発言する"}
              </button>
              <button
                onClick={endDiscussion}
                disabled={isLoading || messages.filter((m) => m.type === "user").length === 0}
                style={{
                  background: "#fff",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isLoading ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                終了して評価を見る
              </button>
            </div>
          </div>
        </div>

        {/* Hint column — hidden on mobile, shown on desktop via CSS class */}
        <div
          className="gd-hint-col"
          style={{
            width: "32%",
            background: "#fff",
            borderLeft: "1px solid #e5e7eb",
            padding: 16,
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, color: "#1f2933", marginBottom: 12 }}>
            GD評価4軸
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {AXES.map((axis) => (
              <div
                key={axis.key}
                style={{
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: "#1f2933", marginBottom: 4 }}>
                  {axis.label}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>{axis.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <button
              onClick={endDiscussion}
              disabled={isLoading || messages.filter((m) => m.type === "user").length === 0}
              style={{
                width: "100%",
                background: "#1f2937",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "12px",
                fontSize: 14,
                fontWeight: 700,
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: messages.filter((m) => m.type === "user").length === 0 ? 0.45 : 1,
              }}
            >
              終了して評価を見る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
