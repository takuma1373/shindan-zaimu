import type { Account } from "@/data/ledgerAccounts";
import type { JournalEntry } from "./ledger";

// 科目ごとの一般的な耐用年数（定額法・年）。ユーザーが個別に上書きできる。
export const DEFAULT_USEFUL_LIFE_YEARS: Record<string, number> = {
  equipment: 4,
  building: 22,
  vehicle: 6,
  software: 5,
};

// 上記テーブルに無い固定資産科目（のれん等）に使うフォールバック値
export const FALLBACK_USEFUL_LIFE_YEARS = 5;

// 減価償却の対象となる固定資産科目かどうか（土地は非償却資産のため対象外）
export function isDepreciableAccount(account: Account): boolean {
  if (account.id === "land") return false;
  return account.group === "asset_fixed_tangible" || account.group === "asset_fixed_intangible";
}

export function defaultUsefulLifeYears(accountId: string): number {
  return DEFAULT_USEFUL_LIFE_YEARS[accountId] ?? FALLBACK_USEFUL_LIFE_YEARS;
}

function elapsedMonths(acquisitionDate: string, asOf: Date): number {
  const start = new Date(`${acquisitionDate}T00:00:00`);
  let months = (asOf.getFullYear() - start.getFullYear()) * 12 + (asOf.getMonth() - start.getMonth());
  if (asOf.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

export interface FixedAsset {
  entryId: string;
  accountId: string;
  accountName: string;
  acquisitionDate: string;
  acquisitionCost: number;
  usefulLifeYears: number;
  elapsedMonths: number;
  accumulatedDepreciation: number;
  bookValue: number;
}

export function computeFixedAssets(
  accounts: Account[],
  entries: JournalEntry[],
  usefulLifeOverrides: Record<string, number>,
  asOf: Date = new Date()
): FixedAsset[] {
  return entries
    .filter((e) => {
      const account = accounts.find((a) => a.id === e.debit);
      return !!account && isDepreciableAccount(account);
    })
    .map((entry) => {
      const account = accounts.find((a) => a.id === entry.debit) as Account;
      const usefulLifeYears = usefulLifeOverrides[entry.id] ?? defaultUsefulLifeYears(account.id);
      const months = elapsedMonths(entry.date, asOf);
      const annualDepreciation = entry.amount / usefulLifeYears;
      const rawAccumulated = (annualDepreciation * months) / 12;
      const accumulatedDepreciation = Math.min(entry.amount - 1, rawAccumulated);
      const bookValue = entry.amount - accumulatedDepreciation;
      return {
        entryId: entry.id,
        accountId: account.id,
        accountName: account.name,
        acquisitionDate: entry.date,
        acquisitionCost: entry.amount,
        usefulLifeYears,
        elapsedMonths: months,
        accumulatedDepreciation,
        bookValue,
      };
    })
    .sort((a, b) => a.acquisitionDate.localeCompare(b.acquisitionDate));
}
