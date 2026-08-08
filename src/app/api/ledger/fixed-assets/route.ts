import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import type { JournalEntry } from "@/lib/ledger";
import { isDepreciableAccount } from "@/lib/depreciation";
import { DEFAULT_ACCOUNTS, type Account } from "@/data/ledgerAccounts";

const ENTRIES_KEY = "ledger:entries";
const ACCOUNTS_KEY = "ledger:accounts";
const USEFUL_LIFE_KEY = "ledger:assetUsefulLife";

export async function GET() {
  const usefulLifeOverrides = (await kvGet<Record<string, number>>(USEFUL_LIFE_KEY)) ?? {};
  return NextResponse.json({ usefulLifeOverrides });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { entryId, usefulLifeYears } = body;

    if (!entryId || typeof entryId !== "string") {
      return NextResponse.json({ error: "資産（仕訳）を指定してください" }, { status: 400 });
    }
    if (typeof usefulLifeYears !== "number" || !Number.isInteger(usefulLifeYears) || usefulLifeYears <= 0) {
      return NextResponse.json({ error: "耐用年数は1以上の整数で入力してください" }, { status: 400 });
    }

    const entries = (await kvGet<JournalEntry[]>(ENTRIES_KEY)) ?? [];
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) {
      return NextResponse.json({ error: "指定された仕訳が見つかりません" }, { status: 404 });
    }

    const accounts = (await kvGet<Account[]>(ACCOUNTS_KEY)) ?? DEFAULT_ACCOUNTS;
    const account = accounts.find((a) => a.id === entry.debit);
    if (!account || !isDepreciableAccount(account)) {
      return NextResponse.json({ error: "この仕訳は固定資産の取得に該当しません" }, { status: 400 });
    }

    const usefulLifeOverrides = (await kvGet<Record<string, number>>(USEFUL_LIFE_KEY)) ?? {};
    usefulLifeOverrides[entryId] = usefulLifeYears;
    await kvSet(USEFUL_LIFE_KEY, usefulLifeOverrides);

    return NextResponse.json({ usefulLifeOverrides });
  } catch (error) {
    console.error("Fixed asset useful-life update error:", error);
    return NextResponse.json({ error: "耐用年数の更新に失敗しました" }, { status: 500 });
  }
}
