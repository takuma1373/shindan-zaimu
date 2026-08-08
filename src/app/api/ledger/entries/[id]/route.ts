import { NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import type { JournalEntry } from "@/lib/ledger";

const ENTRIES_KEY = "ledger:entries";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const entries = (await kvGet<JournalEntry[]>(ENTRIES_KEY)) ?? [];
    const next = entries.filter((e) => e.id !== id);

    if (next.length === entries.length) {
      return NextResponse.json({ error: "指定された仕訳が見つかりません" }, { status: 404 });
    }

    await kvSet(ENTRIES_KEY, next);
    return NextResponse.json({ entries: next });
  } catch (error) {
    console.error("Ledger entry delete error:", error);
    return NextResponse.json({ error: "仕訳の削除に失敗しました" }, { status: 500 });
  }
}
