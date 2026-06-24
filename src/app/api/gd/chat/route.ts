import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

function getSystemPrompt(mode: string, theme: string): string {
  if (mode === "discuss") {
    return `あなたはグループディスカッション（GD）の練習相手です。テーマ「${theme}」について、3人のAIキャラクターとして発言します。
純粋なJSONのみで返答してください。マークダウン、コードブロック、前置き文は一切不要です。
{"responses":[{"name":"田中（積極派）","message":"..."},{"name":"佐藤（慎重派）","message":"..."},{"name":"鈴木（まとめ役）","message":"..."}]}
各発言は1〜2文。テーマに沿った具体的な内容。
田中は新アイデア・機会を推進し、佐藤はリスク・実現可能性を指摘し、鈴木は論点整理・合意形成を担う。`;
  }

  if (mode === "realtime_feedback") {
    return `あなたはGD練習のフィードバック専門家です。
ユーザーの直前の発言に対して即座にフィードバックを行います。
純粋なJSONのみで返答してください。マークダウン、コードブロック、前置き文は一切不要です。
{"score":1〜5の整数,"comment":"一言コメント（30字以内）","tip":"改善のヒント（40字以内）"}
評価軸：論理性（主張に根拠があるか）、GDへの貢献度（場を前進させたか）`;
  }

  if (mode === "final_evaluation") {
    return `あなたはGD練習の最終評価専門家です。
会話全体を見て総合評価を行います。
純粋なJSONのみで返答してください。マークダウン、コードブロック、前置き文は一切不要です。
{"scores":{"logic":1〜5の整数,"assertion":1〜5の整数,"drive":1〜5の整数,"perspective":1〜5の整数},"summary":"全体評価コメント（100字程度）","strengths":["強み1","強み2"],"improvements":["改善点1","改善点2"],"best_moment":"最も良かった発言の引用"}`;
  }

  return "";
}

function parseJSON(text: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Strip markdown code fences and retry
    const cleaned = text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    return JSON.parse(cleaned);
  }
}

export async function POST(req: NextRequest) {
  const { theme, history, userMessage, mode } = await req.json();

  try {
    const systemPrompt = getSystemPrompt(mode, theme);

    const messages: Anthropic.MessageParam[] = [
      ...history,
      { role: "user", content: userMessage },
    ];

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: systemPrompt,
      messages,
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in response");
    }

    const parsed = parseJSON(textContent.text);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("GD chat error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
