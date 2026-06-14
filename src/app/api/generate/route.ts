import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

const FLASHCARD_TOOL = {
  name: "output_flashcards",
  description: "フラッシュカードを出力する",
  input_schema: {
    type: "object" as const,
    properties: {
      flashcards: {
        type: "array",
        items: {
          type: "object",
          properties: {
            front: { type: "string", description: "おもて面：公式名または論点名" },
            back: { type: "string", description: "うら面：計算式または要点" },
            explanation: { type: "string", description: "補足解説（1〜2文）" },
          },
          required: ["front", "back", "explanation"],
        },
        minItems: 3,
        maxItems: 3,
      },
    },
    required: ["flashcards"],
  },
} satisfies Anthropic.Tool;

const QUIZ_TOOL = {
  name: "output_quiz",
  description: "択一問題を出力する",
  input_schema: {
    type: "object" as const,
    properties: {
      question: { type: "string", description: "問題文" },
      choices: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 3,
        description: "選択肢（3つ）",
      },
      answerIndex: {
        type: "integer",
        minimum: 0,
        maximum: 2,
        description: "正解のインデックス（0, 1, 2のいずれか）",
      },
      explanation: { type: "string", description: "正解の根拠と誤答の誤りを指摘する解説" },
    },
    required: ["question", "choices", "answerIndex", "explanation"],
  },
} satisfies Anthropic.Tool;

export async function POST(req: NextRequest) {
  const { type, topic } = await req.json();

  try {
    if (type === "flashcard") {
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        tools: [FLASHCARD_TOOL],
        tool_choice: { type: "tool", name: "output_flashcards" },
        messages: [
          {
            role: "user",
            content: `中小企業診断士1次試験「財務・会計」の「${topic}」について、試験頻出の重要公式・論点のフラッシュカードを3枚生成してください。おもては公式名/論点名、うらは計算式/要点、補足解説を含めてください。すべて日本語で。`,
          },
        ],
      });

      const toolUse = msg.content.find((c) => c.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") throw new Error("No tool use in response");
      return NextResponse.json(toolUse.input);
    }

    if (type === "quiz") {
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        tools: [QUIZ_TOOL],
        tool_choice: { type: "tool", name: "output_quiz" },
        messages: [
          {
            role: "user",
            content: `中小企業診断士1次試験「財務・会計」の「${topic}」について、択一問題を1問生成してください。誤答は「惜しい間違い」（数値が近い・似た概念・計算手順の一部違い など）にして受験生が間違えやすいものにしてください。すべて日本語で。`,
          },
        ],
      });

      const toolUse = msg.content.find((c) => c.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") throw new Error("No tool use in response");
      return NextResponse.json(toolUse.input);
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json({ error: "Failed to generate content" }, { status: 500 });
  }
}
