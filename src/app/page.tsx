"use client";

import { useState } from "react";
import Flashcard from "@/components/Flashcard";
import Quiz from "@/components/Quiz";
import CaseIV from "@/components/CaseIV";

type Mode = "flashcard" | "quiz" | "caseiv";

export default function Home() {
  const [mode, setMode] = useState<Mode>("flashcard");

  return (
    <main className="app">
      <header className="header">
        <h1>財務・会計 公式トレーニング</h1>
        <p>中小企業診断士 1次試験 / 2次試験</p>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${mode === "flashcard" ? "active" : ""}`}
          onClick={() => setMode("flashcard")}
        >
          フラッシュカード
          <span className="tab-sub">1次対応</span>
        </button>
        <button
          className={`tab ${mode === "quiz" ? "active" : ""}`}
          onClick={() => setMode("quiz")}
        >
          公式クイズ
          <span className="tab-sub">1次対応</span>
        </button>
        <button
          className={`tab ${mode === "caseiv" ? "active" : ""}`}
          onClick={() => setMode("caseiv")}
        >
          事例Ⅳ演習
          <span className="tab-sub">2次対応</span>
        </button>
      </nav>

      <section className="content">
        {mode === "flashcard" && <Flashcard />}
        {mode === "quiz" && <Quiz />}
        {mode === "caseiv" && <CaseIV />}
      </section>
    </main>
  );
}
