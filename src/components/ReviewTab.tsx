"use client";

import { useEffect, useMemo, useState } from "react";
import { flashcards, quizQuestions } from "@/data/formulas";
import { caseIVCards, caseIVQuestions } from "@/data/caseiv";
import {
  getAllRecords,
  getMastery,
  getRecord,
  isDue,
  MASTERY_CSS,
  MASTERY_LABEL,
  MasteryLevel,
  recordAnswer,
  SRMRecord,
  getTodayJSTString,
} from "@/lib/srm";

// ── Unified reviewable item ──────────────────────────
type ReviewItem =
  | {
      kind: "flashcard";
      id: string;
      topic: string;
      front: string;
      back: string;
      explanation: string;
    }
  | {
      kind: "quiz";
      id: string;
      topic: string;
      question: string;
      choices: string[];
      answerIndex: number;
      explanation: string;
    };

function buildRegistry(): ReviewItem[] {
  const items: ReviewItem[] = [];
  for (const c of flashcards) {
    items.push({ kind: "flashcard", id: c.id, topic: c.topic, front: c.front, back: c.back, explanation: c.explanation });
  }
  for (const q of quizQuestions) {
    items.push({ kind: "quiz", id: q.id, topic: q.topic, question: q.question, choices: q.choices, answerIndex: q.answerIndex, explanation: q.explanation });
  }
  for (const c of caseIVCards) {
    items.push({ kind: "flashcard", id: c.id, topic: c.topic, front: c.front, back: c.back, explanation: c.explanation });
  }
  for (const q of caseIVQuestions) {
    items.push({ kind: "quiz", id: q.id, topic: q.topic, question: q.question, choices: q.choices, answerIndex: q.answerIndex, explanation: q.explanation });
  }
  return items;
}

const REGISTRY: ReviewItem[] = buildRegistry();
const TOTAL = REGISTRY.length;

// ── Stats ────────────────────────────────────────────
function Stats({ records, dueCount }: { records: SRMRecord[]; dueCount: number }) {
  const byMastery: Record<MasteryLevel, number> = { unseen: 0, learning: 0, consolidating: 0, mastered: 0 };
  for (const r of records) {
    byMastery[getMastery(r)]++;
  }
  byMastery.unseen = TOTAL - records.length + (records.filter((r) => r.streak === 0).length);
  // recalc: unseen = never answered or streak=0
  const seen = records.filter((r) => r.streak > 0);
  byMastery.learning = seen.filter((r) => r.streak <= 2).length;
  byMastery.consolidating = seen.filter((r) => r.streak >= 3 && r.streak <= 4).length;
  byMastery.mastered = seen.filter((r) => r.streak >= 5).length;
  byMastery.unseen = TOTAL - byMastery.learning - byMastery.consolidating - byMastery.mastered;

  const masteryOrder: MasteryLevel[] = ["mastered", "consolidating", "learning", "unseen"];

  return (
    <div className="stats-card">
      <div className="stats-row">
        <div className="stat-item">
          <div className="stat-number">{TOTAL}</div>
          <div className="stat-label">総問題数</div>
        </div>
        <div className="stat-item">
          <div className="stat-number mastered-num">{byMastery.mastered}</div>
          <div className="stat-label">習得済み</div>
        </div>
        <div className="stat-item">
          <div className="stat-number due-num">{dueCount}</div>
          <div className="stat-label">今日の復習</div>
        </div>
      </div>

      <div className="mastery-bar-wrap">
        <div className="mastery-bar">
          {masteryOrder.map((m) => {
            const pct = (byMastery[m] / TOTAL) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={m}
                className={`mastery-bar-seg ${MASTERY_CSS[m]}-bg`}
                style={{ width: `${pct}%` }}
                title={`${MASTERY_LABEL[m]}: ${byMastery[m]}`}
              />
            );
          })}
        </div>
        <div className="mastery-legend">
          {masteryOrder.map((m) => (
            <span key={m} className="mastery-legend-item">
              <span className={`mastery-dot ${MASTERY_CSS[m]}`} />
              {MASTERY_LABEL[m]} {byMastery[m]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Flashcard review ─────────────────────────────────
function FlashcardReview({
  item,
  onDone,
}: {
  item: Extract<ReviewItem, { kind: "flashcard" }>;
  onDone: (correct: boolean) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div>
      <div className="flashcard review-flashcard" onClick={() => setFlipped((f) => !f)} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setFlipped((f) => !f); }}>
        <div className="topic-badge">{item.topic}</div>
        {flipped ? (
          <>
            <div className="face-label">うら</div>
            <div className="back-expression caseiv-back">{item.back}</div>
            <div className="back-explanation">{item.explanation}</div>
          </>
        ) : (
          <>
            <div className="face-label">おもて</div>
            <div className="front-text">{item.front}</div>
          </>
        )}
        <div className="hint">タップで{flipped ? "おもて" : "うら"}に切り替え</div>
      </div>
      {flipped && (
        <div className="btn-row">
          <button className="btn srm-btn-wrong" onClick={() => onDone(false)}>もう一度</button>
          <button className="btn srm-btn-correct" onClick={() => onDone(true)}>覚えた ✓</button>
        </div>
      )}
    </div>
  );
}

// ── Quiz review ───────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function QuizReview({
  item,
  onDone,
}: {
  item: Extract<ReviewItem, { kind: "quiz" }>;
  onDone: (correct: boolean) => void;
}) {
  const [choices] = useState(() =>
    shuffle(item.choices.map((text, i) => ({ text, correct: i === item.answerIndex })))
  );
  const [selected, setSelected] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = selected !== "" && choices[Number(selected)]?.correct;

  const handleSubmit = () => {
    if (selected === "") return;
    setSubmitted(true);
  };

  return (
    <div>
      <div className="quiz-question">
        <div className="topic-badge topic-badge-inline">{item.topic}</div>
        {item.question}
      </div>
      <label className="quiz-label" htmlFor={`rev-${item.id}`}>正しい選択肢を選んでください</label>
      <select id={`rev-${item.id}`} className="select" value={selected} disabled={submitted}
        onChange={(e) => setSelected(e.target.value)}>
        <option value="" disabled>― 選択してください ―</option>
        {choices.map((c, i) => (
          <option key={i} value={String(i)}>{c.text}</option>
        ))}
      </select>
      {!submitted ? (
        <div className="btn-row">
          <button className="btn btn-primary" onClick={handleSubmit} disabled={selected === ""}>回答する</button>
        </div>
      ) : (
        <>
          <div className={`result ${isCorrect ? "correct" : "wrong"}`}>
            <div className="verdict">{isCorrect ? "⭕ 正解！" : "❌ 不正解"}</div>
            {!isCorrect && <div className="answer-name">正解：{choices.find((c) => c.correct)?.text}</div>}
            <div className="explanation">{item.explanation}</div>
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={() => onDone(!!isCorrect)}>次へ →</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Due item card ─────────────────────────────────────
function DueItemCard({
  item,
  record,
  onReviewed,
}: {
  item: ReviewItem;
  record: SRMRecord | null;
  onReviewed: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const mastery = getMastery(record);
  const preview = item.kind === "flashcard" ? item.front : item.question;

  const handleDone = (correct: boolean) => {
    recordAnswer(item.id, correct);
    setExpanded(false);
    onReviewed();
  };

  return (
    <div className="due-card">
      {!expanded ? (
        <div className="due-card-header" onClick={() => setExpanded(true)}>
          <div className="due-card-left">
            <span className="topic-badge topic-badge-inline">{item.topic}</span>
            <span className={`mastery-badge ${MASTERY_CSS[mastery]}`}>{MASTERY_LABEL[mastery]}</span>
            <span className="due-kind-badge">{item.kind === "flashcard" ? "カード" : "クイズ"}</span>
          </div>
          <div className="due-card-preview">{preview.length > 30 ? preview.slice(0, 30) + "…" : preview}</div>
          <button className="btn btn-primary due-start-btn">復習する</button>
        </div>
      ) : (
        <div className="due-card-expanded">
          {item.kind === "flashcard" ? (
            <FlashcardReview item={item} onDone={handleDone} />
          ) : (
            <QuizReview item={item} onDone={handleDone} />
          )}
          <button className="btn" style={{ marginTop: 8 }} onClick={() => setExpanded(false)}>閉じる</button>
        </div>
      )}
    </div>
  );
}

// ── Main ReviewTab ────────────────────────────────────
export default function ReviewTab() {
  const [records, setRecords] = useState<SRMRecord[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setRecords(getAllRecords());
  }, [tick]);

  const today = getTodayJSTString();

  const dueItems = useMemo(() => {
    const recordMap = new Map(records.map((r) => [r.id, r]));
    return REGISTRY.filter((item) => {
      const r = recordMap.get(item.id);
      return r ? isDue(r) : false;
    });
  }, [records, today]);

  const recordMap = useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);

  const refresh = () => setTick((t) => t + 1);

  return (
    <div>
      <Stats records={records} dueCount={dueItems.length} />

      <h2 className="review-section-title">今日の復習 {dueItems.length > 0 && <span className="due-count-badge">{dueItems.length}件</span>}</h2>

      {dueItems.length === 0 ? (
        <div className="review-empty">
          <div className="review-empty-icon">🎉</div>
          <div className="review-empty-text">今日の復習は完了しています</div>
          <div className="review-empty-sub">問題を解くと次回の復習日が設定されます</div>
        </div>
      ) : (
        <div className="due-list">
          {dueItems.map((item) => (
            <DueItemCard
              key={item.id}
              item={item}
              record={recordMap.get(item.id) ?? null}
              onReviewed={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
