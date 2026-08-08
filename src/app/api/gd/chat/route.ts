import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

// 3つのmodeを1つのエンドポイントに集約した理由：
// discuss / realtime_feedback / final_evaluation はすべて「GDに関するAI処理」で
// 本質的に同じリクエスト構造（history + userMessage → JSON）を持つ。
// エンドポイントを分けると /api/gd/discuss, /api/gd/feedback, /api/gd/eval と
// 3ファイル管理が必要になるが、modeフラグで切り替えれば1ファイルで済む。
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

// parseJSONを別関数として切り出した理由：
// プロンプトで「JSONのみ返せ」と指示しても、Claudeが
// ```json ... ``` のようなマークダウン記法で囲んだり、JSONの前に説明文を付けて返すことがある。
// まず素直にJSON.parseを試み、失敗したらコードフェンスを除去して再試行、
// それでも失敗したら最初の{〜最後の}を抜き出して再試行する。
// この段階処理をPOST本体に書くと読みにくくなるため関数に分離した。
function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const cleaned = text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1 || end <= start) {
        throw new Error("JSON object not found in response");
      }
      return JSON.parse(cleaned.slice(start, end + 1));
    }
  }
}

export async function POST(req: NextRequest) {
  const { theme, history, userMessage, mode } = await req.json();

  try {
    const systemPrompt = getSystemPrompt(mode, theme);

    // historyをリクエストごとに全件送る理由：
    // Claude APIはステートレス（サーバー側に会話を保存しない）。
    // 前の発言内容をAIに覚えさせるには、毎回「今までの会話全部」を
    // messages配列に含めて送るしかない。
    const messages: Anthropic.MessageParam[] = [
      ...history,
      { role: "user", content: userMessage },
    ];

    const response = await client.messages.create({
      // Sonnetを使う理由：GDのロールプレイと評価は文脈理解・表現の質が重要で、
      // Haiku（簡易モデル）では発言のバリエーションや評価の深みが不足する。
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
