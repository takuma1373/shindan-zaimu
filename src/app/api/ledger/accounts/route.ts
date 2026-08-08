import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import { DEFAULT_ACCOUNTS, validateAccountInput, type Account } from "@/data/ledgerAccounts";

const ACCOUNTS_KEY = "ledger:accounts";

export async function GET() {
  let accounts = await kvGet<Account[]>(ACCOUNTS_KEY);
  if (!accounts) {
    accounts = DEFAULT_ACCOUNTS;
    await kvSet(ACCOUNTS_KEY, accounts);
  }
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, category, group, isContra } = body;

    const error = validateAccountInput({ name, category, group });
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const accounts = (await kvGet<Account[]>(ACCOUNTS_KEY)) ?? DEFAULT_ACCOUNTS;

    if (accounts.some((a) => a.name === name.trim())) {
      return NextResponse.json({ error: "同名の科目が既に存在します" }, { status: 400 });
    }

    const account: Account = {
      id: crypto.randomUUID(),
      name: name.trim(),
      category,
      group,
      isContra: !!isContra,
    };

    const next = [...accounts, account];
    await kvSet(ACCOUNTS_KEY, next);

    return NextResponse.json({ account });
  } catch (error) {
    console.error("Account create error:", error);
    return NextResponse.json({ error: "科目の作成に失敗しました" }, { status: 500 });
  }
}
