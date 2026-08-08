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

function isPerspectiveArray(v: unknown): v is Perspective[] {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every(
      (p) =>
        p &&
        typeof p === "object" &&
        typeof (p as Perspective).comment === "string" &&
        ["cpa", "accountant", "instructor"].includes((p as Perspective).role)
    )
  );
}

interface GradedResponse {
  correctDebits: ShiwakeLine[];
  correctCredits: ShiwakeLine[];
  isCorrect: boolean;
  perspectives: Perspective[];
  usageContext: string;
}

function isGradedResponse(v: unknown): v is GradedResponse {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.isCorrect === "boolean" &&
    typeof o.usageContext === "string" &&
    Array.isArray(o.correctDebits) &&
    Array.isArray(o.correctCredits) &&
    isPerspectiveArray(o.perspectives)
  );
}

interface InferredResponse {
  inferredTransaction: string;
  usageContext: string;
  isPlausible: boolean;
  perspectives: Perspective[];
}

function isInferredResponse(v: unknown): v is InferredResponse {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.isPlausible === "boolean" &&
    typeof o.inferredTransaction === "string" &&
    typeof o.usageContext === "string" &&
    isPerspectiveArray(o.perspectives)
  );
}

// Claudeは指示してもまれにJSON構造を崩す（perspectivesが3要素の配列にならない等）ことがあるため、
// パース or 形状検証に失敗した場合は1回だけ再試行する。
async function callAndParse<T>(
  system: string,
  userMessage: string,
  maxTokens: number,
  isValid: (v: unknown) => v is T
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userMessage }],
      });
      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text content in response");
      }
      const parsed = parseJSON(textContent.text);
      if (isValid(parsed)) return parsed;
      throw new Error("Response failed shape validation");
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Failed to get a valid response");
}

const PERSPECTIVES_JSON_FIELD = `"perspectives":[{"role":"cpa","comment":"..."},{"role":"accountant","comment":"..."},{"role":"instructor","comment":"..."}]`;
const PERSPECTIVES_FORMAT_NOTE =
  "perspectivesは必ずちょうど3要素の配列にすること。3人分のrole/commentを1つのオブジェクトにまとめず、それぞれ独立したオブジェクトとして配列に並べること。";

// モデル自身の記憶（うろ覚え）に頼ると誤りやすい、頻出の混同ポイントを明示的に与えて判定精度を上げる。
// ここに書かれた情報は、モデル自身の記憶と食い違う場合でも常にこちらを優先させる。
const ACCOUNTING_REFERENCE_NOTES = `
【正確性のための参考情報。該当する場合は必ず優先すること。自身の記憶と食い違う場合もこの情報に従うこと】

■ 繰延資産5項目と最長償却期間（日本基準・会社計算規則）。特に創立費・開業費・開発費は5年、株式交付費のみ3年である点で混同しやすいので注意すること。
- 創立費（会社設立に関する費用。発起人報酬、設立登記の登録免許税等）: 会社成立後5年以内
- 開業費（会社成立後、営業開始までの開業準備のための費用）: 開業後5年以内
- 開発費（新技術・新経営組織の採用、資源開発、市場開拓等の特別支出。研究開発費とは別概念）: 支出後5年以内
- 株式交付費（新株発行費用。会社成立後の増資等に伴う費用）: 株式交付後3年以内（創立費・開業費・開発費と異なり3年）
- 社債発行費等: 社債の償還までの期間

■ 繰延資産の償却仕訳における勘定科目名について
繰延資産を償却する仕訳は、借方に費用（P/L）、貸方に当該繰延資産（B/S）を計上する。日本の簿記教育・実務では、借方・貸方に同一の勘定科目名（例: 借方「株式交付費」／貸方「株式交付費」）を用いる書き方が標準的であり、これは正しい処理である。「相殺されて意味がない」「借方・貸方は別科目にすべき」等の理由でこれを誤りとして扱ってはならない。「株式交付費償却」のように償却専用の科目名を使う書き方も、教材によっては採用されるため正解として扱ってよい。
`;

function buildSystemPrompt(level: string, attemptNumber: number): string {
  return `あなたは日本の商業簿記・工業簿記（日商簿記3級〜1級）に精通した、仕訳の採点者です。
ユーザーが入力した取引内容に対して、ユーザーが入力した仕訳（借方・貸方の科目と金額）が会計上正しいかどうかを判定してください。
${ACCOUNTING_REFERENCE_NOTES}
判定方針:
- 勘定科目名は表記ゆれ（一般的な同義語・略称）を許容し、実質的に同じ科目であれば正解として扱う
- 金額は取引内容から計算される正しい金額と一致しているかを厳密に確認する（税額計算、按分計算、償却計算などを含む）
- 借方・貸方の行数・組み合わせが複数（複合仕訳）でも、全体として会計上妥当なら正解とする
- 出題レベル「日商簿記${level}級」を受験する学習者を想定した厳密さで判定する（1級の場合は連結会計・リース会計・退職給付会計・税効果会計・減損会計等の高度な論点にも対応する）
- 与えられた取引内容だけでは金額や科目が一意に定まらない曖昧さがある場合は、その旨を指摘したうえで、最も妥当な解釈で判定する
- これはユーザーのこの問題への${attemptNumber}回目の挑戦です。${attemptNumber >= 2 ? "1回目より具体的に、正解の科目や金額を直接明かさない範囲でもう一歩踏み込んだ内容にしてください。" : ""}

内部的な判定の考え方（この思考過程はテキストとして出力せず、結果のJSONの値だけに反映させること）: correctDebits/correctCreditsは、ユーザーの入力を見る前に取引内容だけから正解として自分で算出した値を書くこと。isCorrectは、その正解とユーザーの入力を比較した結果を書くこと。isCorrectを先に決めてから正解を後付けで合わせることはしないこと。

解説は次の3つの立場から、それぞれの視点で行ってください（判定自体はisCorrect1つに統一し、3者で結論が食い違うことはないようにする）:
${PERSONAS_PROMPT_BLOCK}
- isCorrectがfalseの場合、各perspectives.commentは「ヒント」です。正解の科目名・金額を直接明かさず、その立場らしい考え方の方向性だけを示してください（各60字程度）。
- isCorrectがtrueの場合、各perspectives.commentは「解説」です。なぜ正しいのか、その立場らしい理由付けで説明してください（各80字程度）。
- ${PERSPECTIVES_FORMAT_NOTE}

出力は純粋なJSONのみです。説明文・前置き・マークダウン・コードブロックは一切出力せず、応答の最初の文字を「{」にすること。次の順序でキーを出力すること:
{"correctDebits":[{"account":"科目名","amount":数値}],"correctCredits":[{"account":"科目名","amount":数値}],"isCorrect":true/false,${PERSPECTIVES_JSON_FIELD},"usageContext":"ユーザーが入力した科目の組み合わせが実務上どのような場面で使われるかの解説（100字程度）"}`;
}

// 取引内容が未入力の場合: 正誤判定の対象となる「正解」が存在しないため、
// 仕訳（借方・貸方の科目と金額）だけから、ユーザーが何を記録しようとしたのかを解釈・解説するモード。
function buildInferSystemPrompt(level: string): string {
  return `あなたは日本の商業簿記・工業簿記（日商簿記3級〜1級）に精通した会計の専門家です。
ユーザーは取引内容を記述せず、仕訳（借方・貸方の科目と金額）だけを入力しました。この仕訳だけを手がかりに、ユーザーが何をしようとしていたのか（どんな取引を記録しようとしたのか）を解釈して解説してください。
${ACCOUNTING_REFERENCE_NOTES}

解説方針:
- 借方・貸方の科目名・金額の組み合わせから、最も可能性が高い具体的な取引内容を推測する（例：「商品を掛けで仕入れた取引と考えられます」）
- 出題レベル「日商簿記${level}級」の学習者を想定した解説の厳密さにする
- 借方合計と貸方合計は一致している前提だが、科目の組み合わせ自体が実務上ほぼあり得ない・会計的に矛盾している場合は、isPlausibleをfalseにする
- 曖昧で複数の解釈があり得る場合は、最も一般的な解釈を挙げたうえでその旨に触れる
- 勘定科目名の表記ゆれ（一般的な同義語・略称）は許容する

内部的な判定の考え方（この思考過程はテキストとして出力せず、結果のJSONの値だけに反映させること）: inferredTransactionとusageContextの内容を先に検討し、その検討結果を踏まえてisPlausibleを決定すること。isPlausibleを先に決めてから理由を後付けすることはしないこと。

コメントは次の3つの立場から、それぞれの視点で行ってください（isPlausibleの結論は1つに統一し、3者で食い違うことはないようにする。isPlausibleがfalseの場合は、それぞれの立場らしい理由でどこが不自然かに触れる）:
${PERSONAS_PROMPT_BLOCK}
各perspectives.commentは80字程度。${PERSPECTIVES_FORMAT_NOTE}

出力は純粋なJSONのみです。説明文・前置き・マークダウン・コードブロックは一切出力せず、応答の最初の文字を「{」にすること。次の順序でキーを出力すること:
{"inferredTransaction":"この仕訳が表していると考えられる具体的な取引内容の推測（100字程度）","usageContext":"この科目の組み合わせが実務上どのような場面で使われるかの解説（100字程度）","isPlausible":true/false,${PERSPECTIVES_JSON_FIELD}}`;
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
      const parsed = await callAndParse(
        buildInferSystemPrompt(level),
        `【ユーザーが入力した仕訳】\n${entriesText}`,
        1800,
        isInferredResponse
      );

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

    const parsed = await callAndParse(buildSystemPrompt(level, attemptNumber), userMessage, 2200, isGradedResponse);

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
