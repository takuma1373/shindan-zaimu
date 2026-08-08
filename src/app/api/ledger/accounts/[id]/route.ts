import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import { DEFAULT_ACCOUNTS, validateAccountInput, type Account } from "@/data/ledgerAccounts";
import type { JournalEntry } from "@/lib/ledger";

const ACCOUNTS_KEY = "ledger:accounts";
const ENTRIES_KEY = "ledger:entries";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, category, group, isContra } = body;

    const error = validateAccountInput({ name, category, group });
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const accounts = (await kvGet<Account[]>(ACCOUNTS_KEY)) ?? DEFAULT_ACCOUNTS;
    const target = accounts.find((a) => a.id === id);
    if (!target) {
      return NextResponse.json({ error: "指定された科目が見つかりません" }, { status: 404 });
    }

    if (accounts.some((a) => a.id !== id && a.name === name.trim())) {
      return NextResponse.json({ error: "同名の科目が既に存在します" }, { status: 400 });
    }

    const updated: Account = { id, name: name.trim(), category, group, isContra: !!isContra };
    const next = accounts.map((a) => (a.id === id ? updated : a));
    await kvSet(ACCOUNTS_KEY, next);

    return NextResponse.json({ account: updated });
  } catch (error) {
    console.error("Account update error:", error);
    return NextResponse.json({ error: "科目の更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const entries = (await kvGet<JournalEntry[]>(ENTRIES_KEY)) ?? [];
    const inUse = entries.some((e) => e.debit === id || e.credit === id);
    if (inUse) {
      return NextResponse.json(
        { error: "この科目は仕訳で使用されているため削除できません" },
        { status: 400 }
      );
    }

    const accounts = (await kvGet<Account[]>(ACCOUNTS_KEY)) ?? DEFAULT_ACCOUNTS;
    const next = accounts.filter((a) => a.id !== id);
    if (next.length === accounts.length) {
      return NextResponse.json({ error: "指定された科目が見つかりません" }, { status: 404 });
    }

    await kvSet(ACCOUNTS_KEY, next);
    return NextResponse.json({ accounts: next });
  } catch (error) {
    console.error("Account delete error:", error);
    return NextResponse.json({ error: "科目の削除に失敗しました" }, { status: 500 });
  }
}
