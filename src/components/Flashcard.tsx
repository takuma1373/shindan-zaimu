"use client";

import { useCallback, useMemo, useState } from "react";
import { flashcards, topics } from "@/data/formulas";

const ALL = "すべて";

type GeneratedCard = {
  front: string;
  back: string;
  explanation: string;
};

type DisplayCard = {
  topic: string;
  front: string;
  back: string;
  explanation: string;
};

export default function Flashcard() {
  const [topic, setTopic] = useState<string>(ALL);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [generated, setGenerated] = useState<GeneratedCard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const staticCards: DisplayCard[] = useMemo(
    () => (topic === ALL ? flashcards : flashcards.filter((c) => c.topic === topic)),
    [topic]
  );

  const cards: DisplayCard[] =
    topic === ALL ? staticCards : generated?.map((c) => ({ ...c, topic })) ?? [];

  const fetchCards = useCallback(async (t: string) => {
    setLoading(true);
    setError(false);
    setGenerated(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "flashcard", topic: t }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setGenerated(data.flashcards);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const go = (delta: number) => {
    setFlipped(false);
    setIndex((i) => (i + delta + cards.length) % cards.length);
  };

  const onTopicChange = (value: string) => {
    setTopic(value);
    setIndex(0);
    setFlipped(false);
    if (value !== ALL) {
      fetchCards(value);
    } else {
      setGenerated(null);
      setError(false);
    }
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

  if (loading) {
    return (
      <div>
        {topicSelect}
        <div className="progress">Claude が生成中…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {topicSelect}
        <div className="progress">生成に失敗しました</div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => fetchCards(topic)}>
            再試行
          </button>
        </div>
      </div>
    );
  }

  if (!cards.length) {
    return (
      <div>
        {topicSelect}
        <div className="progress">論点を選択するとフラッシュカードを生成します</div>
      </div>
    );
  }

  const card = cards[index];

  return (
    <div>
      {topicSelect}

      <div className="progress">
        {index + 1} / {cards.length}
        {topic !== ALL && <span className="generated-badge"> ✦ AI生成</span>}
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
            <div className="back-expression">{card.back}</div>
            <div className="back-explanation">{card.explanation}</div>
          </>
        ) : (
          <>
            <div className="face-label">おもて（公式名）</div>
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

      {topic !== ALL && (
        <div className="btn-row">
          <button className="btn" onClick={() => fetchCards(topic)}>
            再生成
          </button>
        </div>
      )}
    </div>
  );
}
