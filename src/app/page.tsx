"use client";

import { useState } from "react";
import Flashcard from "@/components/Flashcard";
import Quiz from "@/components/Quiz";

type Mode = "flashcard" | "quiz";

export default function Home() {
  const [mode, setMode] = useState<Mode>("flashcard");

  return (
    <main className="app">
      <header className="header">
        <h1>財務・会計 公式トレーニング</h1>
        <p>中小企業診断士 1次試験</p>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${mode === "flashcard" ? "active" : ""}`}
          onClick={() => setMode("flashcard")}
        >
          フラッシュカード
        </button>
        <button
          className={`tab ${mode === "quiz" ? "active" : ""}`}
          onClick={() => setMode("quiz")}
        >
          公式クイズ
        </button>
      </nav>

      <section className="content">
        {mode === "flashcard" ? <Flashcard /> : <Quiz />}
      </section>
    </main>
  );
}
