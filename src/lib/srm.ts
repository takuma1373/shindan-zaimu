// SRM = Spaced Repetition Memory（間隔反復学習）
// エビングハウスの忘却曲線に基づく設計：正解するほど次回復習までの間隔を長くし、
// 間違えたらまた1日後に戻す。これにより「ちょうど忘れかけた時に復習」が実現する。

export type SRMRecord = {
  id: string;
  correct: number;
  incorrect: number;
  streak: number;
  lastReviewed: string;
  nextReview: string;
};

export type MasteryLevel = "unseen" | "learning" | "consolidating" | "mastered";

// 連続正解数をインデックスとして次の復習間隔（日数）を決定する。
// 例：1回正解→3日後、3回連続正解→14日後、5回以上→60日後。
// この数列はSM-2アルゴリズムを簡略化したもの。
const INTERVALS = [1, 3, 7, 14, 30, 60];

// UTCではなくJST（日本時間）で日付を計算する理由：
// 深夜0時をまたいだ際に「今日」の判定がずれないようにするため。
// サーバー側のタイムゾーンに依存しない実装にしている。
function getTodayJST(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// localStorageを使う理由：
// バックエンドDB（PostgreSQL等）を用意すると、サーバー費用・ログイン機能・
// データ同期が必要になる。個人学習ツールとして使う前提なら、
// ブラウザ内蔵のlocalStorageで十分。設定・開発ゼロで永続化できる。
const KEY_PREFIX = "srm_";

export function getRecord(id: string): SRMRecord | null {
  // typeof window === "undefined" チェックの理由：
  // Next.jsはサーバーサイドでもこのコードを実行することがある。
  // サーバー環境にはlocalStorageが存在しないためクラッシュを防ぐ。
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + id);
    return raw ? (JSON.parse(raw) as SRMRecord) : null;
  } catch {
    return null;
  }
}

export function recordAnswer(id: string, isCorrect: boolean): SRMRecord {
  const today = getTodayJST();
  const existing = getRecord(id);
  const newStreak = isCorrect ? (existing?.streak ?? 0) + 1 : 0;
  const days = INTERVALS[Math.min(newStreak, INTERVALS.length - 1)];
  const record: SRMRecord = {
    id,
    correct: (existing?.correct ?? 0) + (isCorrect ? 1 : 0),
    incorrect: (existing?.incorrect ?? 0) + (isCorrect ? 0 : 1),
    streak: newStreak,
    lastReviewed: today,
    nextReview: addDays(today, days),
  };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY_PREFIX + id, JSON.stringify(record));
    } catch {}
  }
  return record;
}

export function isDue(record: SRMRecord | null): boolean {
  if (!record) return false;
  return record.nextReview <= getTodayJST();
}

export function getMastery(record: SRMRecord | null): MasteryLevel {
  if (!record || record.streak === 0) return "unseen";
  if (record.streak <= 2) return "learning";
  if (record.streak <= 4) return "consolidating";
  return "mastered";
}

export function getAllRecords(): SRMRecord[] {
  if (typeof window === "undefined") return [];
  const records: SRMRecord[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(KEY_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            records.push(JSON.parse(raw) as SRMRecord);
          } catch {}
        }
      }
    }
  } catch {}
  return records;
}

export function getTodayJSTString(): string {
  return getTodayJST();
}

export const MASTERY_LABEL: Record<MasteryLevel, string> = {
  unseen: "未学習",
  learning: "学習中",
  consolidating: "定着中",
  mastered: "習得",
};

export const MASTERY_CSS: Record<MasteryLevel, string> = {
  unseen: "mastery-unseen",
  learning: "mastery-learning",
  consolidating: "mastery-consolidating",
  mastered: "mastery-mastered",
};
