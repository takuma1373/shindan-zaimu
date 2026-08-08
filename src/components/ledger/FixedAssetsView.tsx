"use client";

import { useState } from "react";
import type { Account } from "@/data/ledgerAccounts";
import type { JournalEntry } from "@/lib/ledger";
import { computeFixedAssets, type FixedAsset } from "@/lib/depreciation";

const fmt = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;

function formatElapsed(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest}ヶ月`;
  if (rest === 0) return `${years}年`;
  return `${years}年${rest}ヶ月`;
}

interface Props {
  accounts: Account[];
  entries: JournalEntry[];
  usefulLifeOverrides: Record<string, number>;
  onUpdateUsefulLife: (entryId: string, years: number) => Promise<void>;
}

function AssetCard({
  asset,
  onUpdateUsefulLife,
}: {
  asset: FixedAsset;
  onUpdateUsefulLife: (entryId: string, years: number) => Promise<void>;
}) {
  const [years, setYears] = useState(String(asset.usefulLifeYears));
  const [saving, setSaving] = useState(false);

  async function commit() {
    const n = Number(years);
    if (!Number.isInteger(n) || n <= 0 || n === asset.usefulLifeYears) {
      setYears(String(asset.usefulLifeYears));
      return;
    }
    setSaving(true);
    try {
      await onUpdateUsefulLife(asset.entryId, n);
    } finally {
      setSaving(false);
    }
  }

  const row = (label: string, value: string, bold = false) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
      <span style={{ fontSize: 12, color: "#6b7280" }}>{label}</span>
      <span style={{ fontSize: 12, color: "#1e293b", fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e5ea", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>{asset.accountName}</div>
      {row("取得日", asset.acquisitionDate)}
      {row("取得価額", fmt(asset.acquisitionCost))}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
        <span style={{ fontSize: 12, color: "#6b7280" }}>耐用年数</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="number"
            min={1}
            value={years}
            disabled={saving}
            onChange={(e) => setYears(e.target.value)}
            onBlur={commit}
            style={{
              width: 48,
              padding: "2px 6px",
              borderRadius: 6,
              border: "1px solid #e2e5ea",
              fontSize: 12,
              textAlign: "right",
            }}
          />
          <span style={{ fontSize: 12, color: "#1e293b" }}>年</span>
        </span>
      </div>
      {row("経過期間", formatElapsed(asset.elapsedMonths))}
      {row("累計償却額", fmt(asset.accumulatedDepreciation))}
      {row("残存価値", fmt(asset.bookValue), true)}
    </div>
  );
}

export default function FixedAssetsView({ accounts, entries, usefulLifeOverrides, onUpdateUsefulLife }: Props) {
  const assets = computeFixedAssets(accounts, entries, usefulLifeOverrides);

  return (
    <div style={{ padding: "8px 0" }}>
      <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10 }}>
        備品・建物・車両運搬具などの取得仕訳から、定額法による本日時点の残存価値をシミュレーション表示します（減価償却費の仕訳は別途手動で入力してください）。
      </p>
      {assets.length === 0 && (
        <p style={{ fontSize: 12, color: "#9ca3af" }}>
          対象となる固定資産の取得仕訳（借方：備品・建物・車両運搬具・ソフトウェアなど）がまだありません。
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {assets.map((asset) => (
          <AssetCard key={asset.entryId} asset={asset} onUpdateUsefulLife={onUpdateUsefulLife} />
        ))}
      </div>
    </div>
  );
}
