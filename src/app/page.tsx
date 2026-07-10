"use client";

import { useEffect, useState } from "react";
import Flashcard from "@/components/Flashcard";
import Quiz from "@/components/Quiz";
import CaseIV from "@/components/CaseIV";
import ReviewTab from "@/components/ReviewTab";
import { getAllRecords, isDue } from "@/lib/srm";

type Mode = "flashcard" | "quiz" | "caseiv" | "review";

export default function Home() {
  const [mode, setMode] = useState<Mode>("flashcard");
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    const update = () => {
      const records = getAllRecords();
      setDueCount(records.filter(isDue).length);
    };
    update();
    // ページにフォーカスが戻ったときに件数を更新する理由：
    // 別タブで学習して戻ってきた場合にバッジ数が古いままにならないようにするため。
    window.addEventListener("focus", update);
    return () => window.removeEventListener("focus", update);
  }, []);

  // タブ切り替えを関数で包んだ理由：
  // 「復習」タブに移動した瞬間にdue件数を再計算し、バッジを最新にするため。
  // setModeだけ直接呼ぶと再計算タイミングが遅れることがある。
  const switchMode = (m: Mode) => {
    setMode(m);
    if (m === "review") {
      const records = getAllRecords();
      setDueCount(records.filter(isDue).length);
    }
  };

  return (
    <main className="app">
      <header className="header">
        <h1>財務・会計 公式トレーニング</h1>
        <p>中小企業診断士 1次試験 / 2次試験</p>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${mode === "flashcard" ? "active" : ""}`}
          onClick={() => switchMode("flashcard")}
        >
          カード
          <span className="tab-sub">1次対応</span>
        </button>
        <button
          className={`tab ${mode === "quiz" ? "active" : ""}`}
          onClick={() => switchMode("quiz")}
        >
          クイズ
          <span className="tab-sub">1次対応</span>
        </button>
        <button
          className={`tab ${mode === "caseiv" ? "active" : ""}`}
          onClick={() => switchMode("caseiv")}
        >
          事例Ⅳ
          <span className="tab-sub">2次対応</span>
        </button>
        <button
          className={`tab ${mode === "review" ? "active" : ""}`}
          onClick={() => switchMode("review")}
        >
          復習
          {dueCount > 0 && <span className="tab-due-badge">{dueCount}</span>}
          <span className="tab-sub">学習管理</span>
        </button>
      </nav>

      <section className="content">
        {mode === "flashcard" && <Flashcard />}
        {mode === "quiz" && <Quiz />}
        {mode === "caseiv" && <CaseIV />}
        {mode === "review" && <ReviewTab />}
      </section>
    </main>
  );
}
