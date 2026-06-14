"use client";

import { useCallback, useEffect, useState } from "react";
import { topics } from "@/data/formulas";

const ALL = "すべて";

type GeneratedQuiz = {
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
};

type Choice = { text: string; correct: boolean };
type Prepared = { quiz: GeneratedQuiz; choices: Choice[]; effectiveTopic: string };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Quiz() {
  const [topic, setTopic] = useState<string>(ALL);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const newQuestion = useCallback(async (currentTopic: string) => {
    setLoading(true);
    setError(false);
    setPrepared(null);
    setSelected("");
    setSubmitted(false);

    const effectiveTopic =
      currentTopic === ALL
        ? topics[Math.floor(Math.random() * topics.length)]
        : currentTopic;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "quiz", topic: effectiveTopic }),
      });
      if (!res.ok) throw new Error("API error");
      const data: GeneratedQuiz = await res.json();
      const choices = shuffle(
        data.choices.map((text, i) => ({ text, correct: i === data.answerIndex }))
      );
      setPrepared({ quiz: data, choices, effectiveTopic });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    newQuestion(ALL);
  }, [newQuestion]);

  const onTopicChange = (value: string) => {
    setTopic(value);
    setScore({ correct: 0, total: 0 });
    newQuestion(value);
  };

  const topicSelect = (
    <select
      className="select"
      value={topic}
      onChange={(e) => onTopicChange(e.target.value)}
      aria-label="論点を選択"
    >
      <option value={ALL}>すべての論点</option>
      {topics.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );

  const scoreDisplay = (
    <div className="progress">正解 {score.correct} / {score.total} 問</div>
  );

  if (loading) {
    return (
      <div>
        {topicSelect}
        {scoreDisplay}
        <div className="progress">Claude が問題を生成中…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {topicSelect}
        {scoreDisplay}
        <div className="progress">生成に失敗しました</div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => newQuestion(topic)}>
            再試行
          </button>
        </div>
      </div>
    );
  }

  if (!prepared) {
    return (
      <div>
        {topicSelect}
        {scoreDisplay}
        <div className="progress">読み込み中…</div>
      </div>
    );
  }

  const { quiz, choices, effectiveTopic } = prepared;
  const selectedChoice = selected === "" ? null : choices[Number(selected)];
  const isCorrect = selectedChoice?.correct ?? false;

  const handleSubmit = () => {
    if (selected === "") return;
    setSubmitted(true);
    setScore((s) => ({
      correct: s.correct + (isCorrect ? 1 : 0),
      total: s.total + 1,
    }));
  };

  return (
    <div>
      {topicSelect}
      {scoreDisplay}

      <div className="quiz-question">
        <div className="topic-badge topic-badge-inline">{effectiveTopic}</div>
        {quiz.question}
      </div>

      <label className="quiz-label" htmlFor="answer">
        正しい選択肢を選んでください
      </label>
      <select
        id="answer"
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
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={selected === ""}
          >
            回答する
          </button>
        </div>
      ) : (
        <>
          <div className={`result ${isCorrect ? "correct" : "wrong"}`}>
            <div className="verdict">{isCorrect ? "⭕ 正解！" : "❌ 不正解"}</div>
            {!isCorrect && (
              <div className="answer-name">
                正解：{choices.find((c) => c.correct)?.text}
              </div>
            )}
            <div className="explanation">{quiz.explanation}</div>
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={() => newQuestion(topic)}>
              次の問題 →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
