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

interface Perspective {
  role: "cpa" | "accountant" | "instructor";
  comment: string;
}

// 解説を3つの立場から生成する。役割の説明はプロンプトに埋め込み、
// role/labelの対応は固定なのでクライアント側にも同じ3件を静的に持たせている。
const PERSONAS: { role: Perspective["role"]; label: string; angle: string }[] = [
  { role: "cpa", label: "公認会計士", angle: "会計基準・条文根拠に基づく厳密な視点" },
  { role: "accountant", label: "大企業の経理担当", angle: "実務での処理フロー・社内ルール・現場でありがちな勘違いの視点" },
  { role: "instructor", label: "予備校講師", angle: "試験対策としての覚え方・ひっかけポイント・出題パターンの視点" },
];

const PERSONAS_PROMPT_BLOCK = PERSONAS.map((p) => `- ${p.role}（${p.label}）: ${p.angle}`).join("\n");

function validateLines(lines: ShiwakeLine[] | undefined, label: string): string | null {
  if (!lines || lines.length === 0) return `${label}科目を1行以上入力してください`;
  for (const line of lines) {
    if (!line.account || !line.account.trim()) return `${label}科目の科目名を入力してください`;
    if (!line.amount || line.amount <= 0) return `${label}科目の金額を正しく入力してください`;
  }
  return null;
}

function validateShiwakeInput(body: CheckRequestBody): string | null {
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

const PERSPECTIVES_JSON_FIELD = `"perspectives":[{"role":"cpa","comment":"..."},{"role":"accountant","comment":"..."},{"role":"instructor","comment":"..."}]`;

function buildSystemPrompt(level: string, attemptNumber: number): string {
  return `あなたは日本の商業簿記・工業簿記（日商簿記3級〜1級）に精通した、仕訳の採点者です。
ユーザーが入力した取引内容に対して、ユーザーが入力した仕訳（借方・貸方の科目と金額）が会計上正しいかどうかを判定してください。

判定方針:
- 勘定科目名は表記ゆれ（一般的な同義語・略称）を許容し、実質的に同じ科目であれば正解として扱う
- 金額は取引内容から計算される正しい金額と一致しているかを厳密に確認する（税額計算、按分計算、償却計算などを含む）
- 借方・貸方の行数・組み合わせが複数（複合仕訳）でも、全体として会計上妥当なら正解とする
- 出題レベル「日商簿記${level}級」を受験する学習者を想定した厳密さで判定する（1級の場合は連結会計・リース会計・退職給付会計・税効果会計・減損会計等の高度な論点にも対応する）
- 与えられた取引内容だけでは金額や科目が一意に定まらない曖昧さがある場合は、その旨を指摘したうえで、最も妥当な解釈で判定する
- これはユーザーのこの問題への${attemptNumber}回目の挑戦です。${attemptNumber >= 2 ? "1回目より具体的に、正解の科目や金額を直接明かさない範囲でもう一歩踏み込んだ内容にしてください。" : ""}

解説は次の3つの立場から、それぞれの視点で行ってください（判定自体はisCorrect1つに統一し、3者で結論が食い違うことはないようにする）:
${PERSONAS_PROMPT_BLOCK}
- isCorrectがfalseの場合、各perspectives.commentは「ヒント」です。正解の科目名・金額を直接明かさず、その立場らしい考え方の方向性だけを示してください（各60字程度）。
- isCorrectがtrueの場合、各perspectives.commentは「解説」です。なぜ正しいのか、その立場らしい理由付けで説明してください（各80字程度）。

純粋なJSONのみで返答してください。マークダウン、コードブロック、前置き文は一切不要です。
{"isCorrect":true/false,${PERSPECTIVES_JSON_FIELD},"usageContext":"ユーザーが入力した科目の組み合わせが実務上どのような場面で使われるかの解説（100字程度）","correctDebits":[{"account":"科目名","amount":数値}],"correctCredits":[{"account":"科目名","amount":数値}]}`;
}

// 取引内容が未入力の場合: 正誤判定の対象となる「正解」が存在しないため、
// 仕訳（借方・貸方の科目と金額）だけから、ユーザーが何を記録しようとしたのかを解釈・解説するモード。
function buildInferSystemPrompt(level: string): string {
  return `あなたは日本の商業簿記・工業簿記（日商簿記3級〜1級）に精通した会計の専門家です。
ユーザーは取引内容を記述せず、仕訳（借方・貸方の科目と金額）だけを入力しました。この仕訳だけを手がかりに、ユーザーが何をしようとしていたのか（どんな取引を記録しようとしたのか）を解釈して解説してください。

解説方針:
- 借方・貸方の科目名・金額の組み合わせから、最も可能性が高い具体的な取引内容を推測する（例：「商品を掛けで仕入れた取引と考えられます」）
- 出題レベル「日商簿記${level}級」の学習者を想定した解説の厳密さにする
- 借方合計と貸方合計は一致している前提だが、科目の組み合わせ自体が実務上ほぼあり得ない・会計的に矛盾している場合は、isPlausibleをfalseにする
- 曖昧で複数の解釈があり得る場合は、最も一般的な解釈を挙げたうえでその旨に触れる
- 勘定科目名の表記ゆれ（一般的な同義語・略称）は許容する

コメントは次の3つの立場から、それぞれの視点で行ってください（isPlausibleの結論は1つに統一し、3者で食い違うことはないようにする。isPlausibleがfalseの場合は、それぞれの立場らしい理由でどこが不自然かに触れる）:
${PERSONAS_PROMPT_BLOCK}
各perspectives.commentは80字程度。

純粋なJSONのみで返答してください。マークダウン、コードブロック、前置き文は一切不要です。
{"isPlausible":true/false,"inferredTransaction":"この仕訳が表していると考えられる具体的な取引内容の推測（100字程度）","usageContext":"この科目の組み合わせが実務上どのような場面で使われるかの解説（100字程度）",${PERSPECTIVES_JSON_FIELD}}`;
}

export async function POST(req: NextRequest) {
  try {
    const body: CheckRequestBody = await req.json();

    const validationError = validateShiwakeInput(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const level = body.level!;
    const hasTransaction = !!body.transaction && !!body.transaction.trim();

    const entriesText = `借方: ${formatLines(body.debits!)}
貸方: ${formatLines(body.credits!)}`;

    if (!hasTransaction) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: buildInferSystemPrompt(level),
        messages: [{ role: "user", content: `【ユーザーが入力した仕訳】\n${entriesText}` }],
      });

      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text content in response");
      }

      const parsed = parseJSON(textContent.text) as {
        isPlausible: boolean;
        inferredTransaction: string;
        usageContext: string;
        perspectives: Perspective[];
      };

      return NextResponse.json({
        mode: "inferred",
        isPlausible: parsed.isPlausible,
        inferredTransaction: parsed.inferredTransaction,
        usageContext: parsed.usageContext,
        perspectives: parsed.perspectives,
      });
    }

    const attemptNumber = body.attemptNumber && body.attemptNumber > 0 ? body.attemptNumber : 1;
    const revealAnswer = body.revealAnswer === true;

    const userMessage = `【取引内容】
${body.transaction}

【ユーザーが入力した仕訳】
${entriesText}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: buildSystemPrompt(level, attemptNumber),
      messages: [{ role: "user", content: userMessage }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in response");
    }

    const parsed = parseJSON(textContent.text) as {
      isCorrect: boolean;
      perspectives: Perspective[];
      usageContext: string;
      correctDebits: ShiwakeLine[];
      correctCredits: ShiwakeLine[];
    };

    const result: Record<string, unknown> = {
      mode: "graded",
      isCorrect: parsed.isCorrect,
      perspectives: parsed.perspectives,
      usageContext: parsed.usageContext,
    };
    // 不正解かつギブアップしていない場合は正解を返さない（プロンプト指示だけに頼らない機械的なガード）。
    // perspectives自体はこの状態でも「ヒント」として返す（プロンプト側で正解を明かさないよう指示済み）。
    if (parsed.isCorrect || revealAnswer) {
      result.correctDebits = parsed.correctDebits;
      result.correctCredits = parsed.correctCredits;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Shiwake check error:", error);
    return NextResponse.json({ error: "判定処理に失敗しました" }, { status: 500 });
  }
}
