"use client";

import { useMemo, useState } from "react";
import {
  caseIVCards,
  caseIVQuestions,
  caseIVTopics,
  type CaseIVQuestion,
} from "@/data/caseiv";

const ALL = "すべて";
type SubMode = "flashcard" | "quiz";
type Choice = { text: string; correct: boolean };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickQuestion(pool: CaseIVQuestion[]): { q: CaseIVQuestion; choices: Choice[] } {
  const q = pool[Math.floor(Math.random() * pool.length)];
  const choices = shuffle(q.choices.map((text, i) => ({ text, correct: i === q.answerIndex })));
  return { q, choices };
}

// ── フラッシュカード ──────────────────────────────────────
function Flashcards({ topic }: { topic: string }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const cards = useMemo(
    () => (topic === ALL ? caseIVCards : caseIVCards.filter((c) => c.topic === topic)),
    [topic]
  );

  const card = cards[index] ?? cards[0];

  const go = (delta: number) => {
    setFlipped(false);
    setIndex((i) => (i + delta + cards.length) % cards.length);
  };

  return (
    <div>
      <div className="progress">
        {index + 1} / {cards.length}
      </div>

      <div
        className="flashcard"
        onClick={() => setFlipped((f) => !f)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setFlipped((f) => !f);
        }}
      >
        <div className="topic-badge">{card.topic}</div>
        {flipped ? (
          <>
            <div className="face-label">うら（公式・要点）</div>
            <div className="back-expression caseiv-back">{card.back}</div>
            <div className="back-explanation">{card.explanation}</div>
          </>
        ) : (
          <>
            <div className="face-label">おもて（論点名）</div>
            <div className="front-text">{card.front}</div>
          </>
        )}
        <div className="hint">タップで{flipped ? "おもて" : "うら"}に切り替え</div>
      </div>

      <div className="btn-row">
        <button className="btn" onClick={() => go(-1)}>
          ← 前へ
        </button>
        <button className="btn btn-primary" onClick={() => setFlipped((f) => !f)}>
          裏返す
        </button>
        <button className="btn" onClick={() => go(1)}>
          次へ →
        </button>
      </div>
    </div>
  );
}

// ── クイズ ────────────────────────────────────────────────
function Quiz({ topic }: { topic: string }) {
  const pool = useMemo(
    () => (topic === ALL ? caseIVQuestions : caseIVQuestions.filter((q) => q.topic === topic)),
    [topic]
  );

  const [current, setCurrent] = useState(() => pickQuestion(pool));
  const [selected, setSelected] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const { q, choices } = current;
  const selectedChoice = selected === "" ? null : choices[Number(selected)];
  const isCorrect = selectedChoice?.correct ?? false;

  const next = () => {
    const newPool =
      topic === ALL ? caseIVQuestions : caseIVQuestions.filter((q) => q.topic === topic);
    setCurrent(pickQuestion(newPool));
    setSelected("");
    setSubmitted(false);
  };

  const handleSubmit = () => {
    if (selected === "") return;
    setSubmitted(true);
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
  };

  return (
    <div>
      <div className="progress">正解 {score.correct} / {score.total} 問</div>

      <div className="quiz-question">
        <div className="quiz-question-header">
          <div className="topic-badge topic-badge-inline">{q.topic}</div>
          <div className={`question-tag ${q.tag === "ボックス図・逆算型" ? "tag-box" : "tag-formula"}`}>
            {q.tag}
          </div>
        </div>
        {q.question}
      </div>

      <label className="quiz-label" htmlFor="caseiv-answer">
        正しい選択肢を選んでください
      </label>
      <select
        id="caseiv-answer"
        className="select"
        value={selected}
        disabled={submitted}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="" disabled>
          ― 選択してください ―
        </option>
        {choices.map((c, i) => (
          <option key={i} value={String(i)}>
            {c.text}
          </option>
        ))}
      </select>

      {!submitted ? (
        <div className="btn-row">
          <button className="btn btn-primary" onClick={handleSubmit} disabled={selected === ""}>
            回答する
          </button>
        </div>
      ) : (
        <>
          <div className={`result ${isCorrect ? "correct" : "wrong"}`}>
            <div className="verdict">{isCorrect ? "⭕ 正解！" : "❌ 不正解"}</div>
            {!isCorrect && (
              <div className="answer-name">正解：{choices.find((c) => c.correct)?.text}</div>
            )}
            <div className="explanation">{q.explanation}</div>
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={next}>
              次の問題 →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────
export default function CaseIV() {
  const [subMode, setSubMode] = useState<SubMode>("flashcard");
  const [topic, setTopic] = useState<string>(ALL);

  return (
    <div>
      <div className="subtabs">
        <button
          className={`subtab ${subMode === "flashcard" ? "active" : ""}`}
          onClick={() => setSubMode("flashcard")}
        >
          フラッシュカード
        </button>
        <button
          className={`subtab ${subMode === "quiz" ? "active" : ""}`}
          onClick={() => setSubMode("quiz")}
        >
          クイズ
        </button>
      </div>

      <select
        className="select"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        aria-label="論点を選択"
      >
        <option value={ALL}>すべての論点</option>
        {caseIVTopics.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {subMode === "flashcard" ? (
        <Flashcards key={topic} topic={topic} />
      ) : (
        <Quiz key={topic} topic={topic} />
      )}
    </div>
  );
}
