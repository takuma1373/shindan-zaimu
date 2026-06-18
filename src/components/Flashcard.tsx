"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { flashcards, topics } from "@/data/formulas";
import {
  getMastery,
  getRecord,
  MASTERY_CSS,
  MASTERY_LABEL,
  recordAnswer,
  SRMRecord,
} from "@/lib/srm";

const ALL = "すべて";

type GeneratedCard = {
  front: string;
  back: string;
  explanation: string;
};

type DisplayCard = {
  id: string;
  topic: string;
  front: string;
  back: string;
  explanation: string;
  isGenerated: boolean;
};

function MasteryBadge({ id }: { id: string }) {
  const [record, setRecord] = useState<SRMRecord | null>(null);
  useEffect(() => { setRecord(getRecord(id)); }, [id]);
  const mastery = getMastery(record);
  return (
    <span className={`mastery-badge ${MASTERY_CSS[mastery]}`}>{MASTERY_LABEL[mastery]}</span>
  );
}

export default function Flashcard() {
  const [topic, setTopic] = useState<string>(ALL);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [generated, setGenerated] = useState<GeneratedCard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<boolean | null>(null);

  const staticCards: DisplayCard[] = useMemo(
    () =>
      (topic === ALL ? flashcards : flashcards.filter((c) => c.topic === topic)).map((c) => ({
        ...c,
        isGenerated: false,
      })),
    [topic]
  );

  const cards: DisplayCard[] =
    topic === ALL
      ? staticCards
      : generated?.map((c, i) => ({ ...c, id: `ai_${topic}_${i}`, topic, isGenerated: true })) ?? [];

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
    setLastAnswer(null);
    setIndex((i) => (i + delta + cards.length) % cards.length);
  };

  const onTopicChange = (value: string) => {
    setTopic(value);
    setIndex(0);
    setFlipped(false);
    setLastAnswer(null);
    if (value !== ALL) {
      fetchCards(value);
    } else {
      setGenerated(null);
      setError(false);
    }
  };

  const card = cards[index];

  const handleSRM = (correct: boolean) => {
    if (!card || card.isGenerated) return;
    recordAnswer(card.id, correct);
    setLastAnswer(correct);
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
        <option key={t} value={t}>{t}</option>
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
          <button className="btn btn-primary" onClick={() => fetchCards(topic)}>再試行</button>
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

  return (
    <div>
      {topicSelect}

      <div className="progress">
        {index + 1} / {cards.length}
        {topic !== ALL && <span className="generated-badge"> ✦ AI生成</span>}
      </div>

      <div
        className="flashcard"
        onClick={() => { setFlipped((f) => !f); setLastAnswer(null); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { setFlipped((f) => !f); setLastAnswer(null); }
        }}
      >
        <div className="flashcard-header-row">
          <div className="topic-badge" style={{ margin: 0 }}>{card.topic}</div>
          {!card.isGenerated && <MasteryBadge id={card.id} />}
        </div>
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

      {flipped && !card.isGenerated && lastAnswer === null && (
        <div className="btn-row">
          <button className="btn srm-btn-wrong" onClick={(e) => { e.stopPropagation(); handleSRM(false); }}>もう一度</button>
          <button className="btn srm-btn-correct" onClick={(e) => { e.stopPropagation(); handleSRM(true); }}>覚えた ✓</button>
        </div>
      )}
      {lastAnswer !== null && (
        <div className={`srm-recorded ${lastAnswer ? "srm-correct" : "srm-wrong"}`}>
          {lastAnswer ? "✓ 記録しました（覚えた）" : "↩ 記録しました（もう一度）"}
        </div>
      )}

      <div className="btn-row">
        <button className="btn" onClick={() => go(-1)}>← 前へ</button>
        <button className="btn btn-primary" onClick={() => { setFlipped((f) => !f); setLastAnswer(null); }}>裏返す</button>
        <button className="btn" onClick={() => go(1)}>次へ →</button>
      </div>

      {topic !== ALL && (
        <div className="btn-row">
          <button className="btn" onClick={() => fetchCards(topic)}>再生成</button>
        </div>
      )}
    </div>
  );
}
