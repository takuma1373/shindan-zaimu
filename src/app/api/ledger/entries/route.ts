import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import { validateEntry, type JournalEntry } from "@/lib/ledger";
import { DEFAULT_ACCOUNTS, type Account } from "@/data/ledgerAccounts";

const ENTRIES_KEY = "ledger:entries";
const ACCOUNTS_KEY = "ledger:accounts";

export async function GET() {
  const entries = (await kvGet<JournalEntry[]>(ENTRIES_KEY)) ?? [];
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, debit, credit, amount, memo } = body;

    const error = validateEntry({ date, debit, credit, amount });
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const accounts = (await kvGet<Account[]>(ACCOUNTS_KEY)) ?? DEFAULT_ACCOUNTS;
    const accountIds = new Set(accounts.map((a) => a.id));
    if (!accountIds.has(debit) || !accountIds.has(credit)) {
      return NextResponse.json({ error: "存在しない科目が指定されています" }, { status: 400 });
    }

    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      date,
      debit,
      credit,
      amount,
      memo: typeof memo === "string" ? memo : "",
    };

    const entries = (await kvGet<JournalEntry[]>(ENTRIES_KEY)) ?? [];
    entries.push(entry);
    await kvSet(ENTRIES_KEY, entries);

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Ledger entry create error:", error);
    return NextResponse.json({ error: "仕訳の保存に失敗しました" }, { status: 500 });
  }
}
