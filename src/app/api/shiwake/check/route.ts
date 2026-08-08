import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

interface ShiwakeLine {
  account: string;
  amount: number;
}

interface CheckRequestBody {
  transaction?: string;
  level?: "3" | "2" | "1";
  debits?: ShiwakeLine[];
  credits?: ShiwakeLine[];
  attemptNumber?: number;
  revealAnswer?: boolean;
}

function validateLines(lines: ShiwakeLine[] | undefined, label: string): string | null {
  if (!lines || lines.length === 0) return `${label}科目を1行以上入力してください`;
  for (const line of lines) {
    if (!line.account || !line.account.trim()) return `${label}科目の科目名を入力してください`;
    if (!line.amount || line.amount <= 0) return `${label}科目の金額を正しく入力してください`;
  }
  return null;
}

function validateShiwakeInput(body: CheckRequestBody): string | null {
  if (!body.transaction || !body.transaction.trim()) return "取引内容を入力してください";
  if (!body.level || !["3", "2", "1"].includes(body.level)) return "級を選択してください";

  const debitError = validateLines(body.debits, "借方");
  if (debitError) return debitError;
  const creditError = validateLines(body.credits, "貸方");
  if (creditError) return creditError;

  const debitTotal = body.debits!.reduce((sum, l) => sum + l.amount, 0);
  const creditTotal = body.credits!.reduce((sum, l) => sum + l.amount, 0);
  if (debitTotal !== creditTotal) return "借方合計と貸方合計が一致していません";

  return null;
}

// gd/chat/route.ts と同じ理由: Claudeが```json```でコードフェンスを付けて返すことがあるため、
// 素直なJSON.parseに失敗したらフェンスを除去して再試行する。
function parseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const cleaned = text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    return JSON.parse(cleaned);
  }
}

function formatLines(lines: ShiwakeLine[]): string {
  return lines.map((l) => `${l.account} ${l.amount.toLocaleString("ja-JP")}円`).join(" / ");
}

function buildSystemPrompt(level: string, attemptNumber: number): string {
  return `あなたは日本の商業簿記・工業簿記（日商簿記3級〜1級）に精通した、仕訳の採点者です。
ユーザーが入力した取引内容に対して、ユーザーが入力した仕訳（借方・貸方の科目と金額）が会計上正しいかどうかを判定してください。

判定方針:
- 勘定科目名は表記ゆれ（一般的な同義語・略称）を許容し、実質的に同じ科目であれば正解として扱う
- 金額は取引内容から計算される正しい金額と一致しているかを厳密に確認する（税額計算、按分計算、償却計算などを含む）
- 借方・貸方の行数・組み合わせが複数（複合仕訳）でも、全体として会計上妥当なら正解とする
- 出題レベル「日商簿記${level}級」を受験する学習者を想定した厳密さで判定する（1級の場合は連結会計・リース会計・退職給付会計・税効果会計・減損会計等の高度な論点にも対応する）
- 与えられた取引内容だけでは金額や科目が一意に定まらない曖昧さがある場合は、その旨をcommentで指摘したうえで、最も妥当な解釈で判定する
- これはユーザーのこの問題への${attemptNumber}回目の挑戦です。${attemptNumber >= 2 ? "1回目のヒントより具体的に、正解の科目や金額を直接明かさない範囲でもう一歩踏み込んだヒントにしてください。" : ""}
- ユーザーが入力した科目の組み合わせ（正誤にかかわらず）が実務上どのような場面・取引で一般的に使われるものかを、簿記を学ぶ人向けに解説してください（例：「この組み合わせは、商品を掛けで仕入れた際に将来の支払義務を負債として計上する場面で使われます」）。これは取引の一般的な位置づけの解説であり、この問題固有の正解の科目・金額そのものを明かすものではありません。

純粋なJSONのみで返答してください。マークダウン、コードブロック、前置き文は一切不要です。
{"isCorrect":true/false,"comment":"採点コメント（100字程度、何が合っていて何が違うかを具体的に）","hint":"不正解時のヒント（正解の科目名・金額を直接明かさない範囲で考え方の方向性を示す。60字程度。正解の場合は空文字でよい）","usageContext":"ユーザーが入力した科目の組み合わせが実務上どのような場面で使われるかの解説（100字程度）","correctDebits":[{"account":"科目名","amount":数値}],"correctCredits":[{"account":"科目名","amount":数値}],"explanation":"正解の考え方の解説（150字程度）"}`;
}

export async function POST(req: NextRequest) {
  try {
    const body: CheckRequestBody = await req.json();

    const validationError = validateShiwakeInput(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const level = body.level!;
    const attemptNumber = body.attemptNumber && body.attemptNumber > 0 ? body.attemptNumber : 1;
    const revealAnswer = body.revealAnswer === true;

    const userMessage = `【取引内容】
${body.transaction}

【ユーザーが入力した仕訳】
借方: ${formatLines(body.debits!)}
貸方: ${formatLines(body.credits!)}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: buildSystemPrompt(level, attemptNumber),
      messages: [{ role: "user", content: userMessage }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in response");
    }

    const parsed = parseJSON(textContent.text) as {
      isCorrect: boolean;
      comment: string;
      hint: string;
      usageContext: string;
      correctDebits: ShiwakeLine[];
      correctCredits: ShiwakeLine[];
      explanation: string;
    };

    const result: Record<string, unknown> = {
      isCorrect: parsed.isCorrect,
      comment: parsed.comment,
      usageContext: parsed.usageContext,
    };
    if (!parsed.isCorrect) {
      result.hint = parsed.hint;
    }
    // 不正解かつギブアップしていない場合は正解を返さない（プロンプト指示だけに頼らない機械的なガード）
    if (parsed.isCorrect || revealAnswer) {
      result.correctDebits = parsed.correctDebits;
      result.correctCredits = parsed.correctCredits;
      result.explanation = parsed.explanation;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Shiwake check error:", error);
    return NextResponse.json({ error: "判定処理に失敗しました" }, { status: 500 });
  }
}
