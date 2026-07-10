'use client';

import { useState } from 'react';
import {
  JOURNAL_ENTRIES, INITIAL_BS, INITIAL_PL, CATEGORIES,
  type BSState, type BSAssetKey, type BSLiabilityKey, type BSEquityKey, type PLKey, type JournalEntry,
} from '@/data/journalEntries';

const fmt = (n: number) => Math.abs(n).toLocaleString('ja-JP');
const signed = (n: number) => (n >= 0 ? `+${fmt(n)}` : `-${fmt(n)}`);

// ── Reusable row components ──────────────────────────────────────

function DeltaBadge({ d }: { d: number }) {
  if (d === 0) return null;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 5, color: d > 0 ? '#16a34a' : '#dc2626' }}>
      {signed(d)}
    </span>
  );
}

interface BsRowProps {
  label: string;
  value: number;
  fkey: string;
  ck: Set<string>;
  deltas: Record<string, number>;
  invertDelta?: boolean;
}
function BsRow({ label, value, fkey, ck, deltas, invertDelta = false }: BsRowProps) {
  const isHl = ck.has(fkey);
  const raw = deltas[fkey] ?? 0;
  const d = invertDelta ? -raw : raw;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 10px', borderBottom: '1px solid #f1f5f9',
      background: isHl ? '#fef3c7' : 'transparent',
      borderLeft: isHl ? '3px solid #d97706' : '3px solid transparent',
    }}>
      <span style={{ fontSize: 12, color: '#374151' }}>{label}</span>
      <span>
        <span style={{ fontSize: 12, fontWeight: 600, color: value < 0 ? '#dc2626' : '#1e293b' }}>
          {value < 0 ? `-${fmt(value)}` : fmt(value)}
        </span>
        {isHl && <DeltaBadge d={d} />}
      </span>
    </div>
  );
}

function ComputedBsRow({ label, value, isHl, d }: { label: string; value: number; isHl: boolean; d: number }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 10px', borderBottom: '1px solid #f1f5f9',
      background: isHl ? '#fef3c7' : 'transparent',
      borderLeft: isHl ? '3px solid #d97706' : '3px solid transparent',
    }}>
      <span style={{ fontSize: 12, color: '#374151' }}>{label}</span>
      <span>
        <span style={{ fontSize: 12, fontWeight: 600, color: value < 0 ? '#dc2626' : '#1e293b' }}>
          {value < 0 ? `-${fmt(value)}` : fmt(value)}
        </span>
        {isHl && <DeltaBadge d={d} />}
      </span>
    </div>
  );
}

function TotalRow({ label, value, isHl, d }: { label: string; value: number; isHl: boolean; d: number }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 10px',
      borderTop: '2px solid #e2e5ea',
      background: isHl ? '#fef3c7' : '#f8fafc',
      borderLeft: isHl ? '3px solid #d97706' : '3px solid transparent',
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{label}</span>
      <span>
        <span style={{ fontSize: 13, fontWeight: 700, color: value < 0 ? '#dc2626' : '#1e293b' }}>
          {value < 0 ? `-${fmt(value)}` : fmt(value)}
        </span>
        {isHl && <DeltaBadge d={d} />}
      </span>
    </div>
  );
}

function PlRow({ label, value, fkey, ck, deltas, sign }: {
  label: string; value: number; fkey: string; ck: Set<string>;
  deltas: Record<string, number>; sign: '+' | '−' | '±';
}) {
  const isHl = ck.has(fkey);
  const d = deltas[fkey] ?? 0;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 10px', borderBottom: '1px solid #f1f5f9',
      background: isHl ? '#fef3c7' : 'transparent',
      borderLeft: isHl ? '3px solid #d97706' : '3px solid transparent',
    }}>
      <span style={{ fontSize: 12, color: '#374151' }}>
        <span style={{ fontSize: 10, color: '#94a3b8', marginRight: 4 }}>({sign})</span>
        {label}
      </span>
      <span>
        <span style={{ fontSize: 12, fontWeight: 600, color: value < 0 ? '#dc2626' : '#1e293b' }}>
          {value < 0 ? `-${fmt(value)}` : fmt(value)}
        </span>
        {isHl && <DeltaBadge d={d} />}
      </span>
    </div>
  );
}

function SectionHeader({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <div style={{ padding: '6px 10px', background: bg, fontWeight: 700, fontSize: 12, color }}>
      {label}
    </div>
  );
}

// ── Financial metrics ─────────────────────────────────────────────

function computeMetrics(bs: BSState, pl: Record<PLKey, number>): Record<string, number | null> {
  const ta = bs.assets.現金 + bs.assets.売掛金 + bs.assets.建物
    + bs.assets.繰延税金資産 + bs.assets.リース資産 + bs.assets.のれん
    - bs.assets.貸倒引当金;
  const tl = bs.liabilities.買掛金 + bs.liabilities.借入金 + bs.liabilities.未払法人税等
    + bs.liabilities.賞与引当金 + bs.liabilities.退職給付引当金 + bs.liabilities.リース債務
    + bs.liabilities.繰延税金負債 + bs.liabilities.未払配当金;
  const ni = pl.売上高 + pl.為替差益 + pl.法人税等調整額
    - pl.売上原価 - pl.減価償却費 - pl.法人税等
    - pl.貸倒引当金繰入 - pl.賞与引当金繰入 - pl.退職給付費用
    - pl.減損損失 - pl.のれん償却 - pl.支払利息 - pl.為替差損;
  const te = bs.equity.資本金 + bs.equity.繰越利益剰余金 - bs.equity.自己株式 + ni;
  const ca = Math.max(0, bs.assets.現金) + Math.max(0, bs.assets.売掛金 - bs.assets.貸倒引当金);
  const cl = bs.liabilities.買掛金 + bs.liabilities.未払法人税等
    + bs.liabilities.未払配当金 + bs.liabilities.賞与引当金;
  const ar = Math.max(0, bs.assets.売掛金 - bs.assets.貸倒引当金);

  return {
    自己資本比率: ta > 0 ? (te / ta) * 100 : null,
    流動比率: cl > 0 ? (ca / cl) * 100 : null,
    負債比率: te > 0 ? (tl / te) * 100 : null,
    ROA: ta > 0 ? (ni / ta) * 100 : null,
    ROE: te !== 0 ? (ni / te) * 100 : null,
    売上高純利益率: pl.売上高 > 0 ? (ni / pl.売上高) * 100 : null,
    総資産回転率: ta > 0 ? pl.売上高 / ta : null,
    売掛金回転日数: ar > 0 && pl.売上高 > 0 ? (ar / pl.売上高) * 365 : null,
  };
}

function RatioPanel({ bs, pl, prevBS, prevPL }: {
  bs: BSState; pl: Record<PLKey, number>;
  prevBS: BSState; prevPL: Record<PLKey, number>;
}) {
  const cur = computeMetrics(bs, pl);
  const prev = computeMetrics(prevBS, prevPL);

  const categories: {
    title: string; color: string; bg: string;
    items: { label: string; key: string; unit: string; good: 'high' | 'low'; dec: number }[];
  }[] = [
    {
      title: '安定性',
      color: '#0369a1',
      bg: '#e0f2fe',
      items: [
        { label: '自己資本比率', key: '自己資本比率', unit: '%', good: 'high', dec: 1 },
        { label: '流動比率', key: '流動比率', unit: '%', good: 'high', dec: 0 },
        { label: '負債比率', key: '負債比率', unit: '%', good: 'low', dec: 1 },
      ],
    },
    {
      title: '収益性',
      color: '#166534',
      bg: '#f0fdf4',
      items: [
        { label: 'ROA（総資産利益率）', key: 'ROA', unit: '%', good: 'high', dec: 1 },
        { label: 'ROE（自己資本利益率）', key: 'ROE', unit: '%', good: 'high', dec: 1 },
        { label: '売上高純利益率', key: '売上高純利益率', unit: '%', good: 'high', dec: 1 },
      ],
    },
    {
      title: '効率性',
      color: '#713f12',
      bg: '#fefce8',
      items: [
        { label: '総資産回転率', key: '総資産回転率', unit: '倍', good: 'high', dec: 2 },
        { label: '売掛金回転日数', key: '売掛金回転日数', unit: '日', good: 'low', dec: 0 },
      ],
    },
  ];

  return (
    <div style={{ marginTop: 10, padding: '10px 12px', background: 'white', borderRadius: 8, border: '1px solid #e2e5ea' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8 }}>財務指標</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {categories.map(cat => (
          <div key={cat.title} style={{ borderRadius: 6, border: '1px solid #e2e5ea', overflow: 'hidden' }}>
            <div style={{ padding: '5px 8px', background: cat.bg, fontWeight: 700, fontSize: 11, color: cat.color }}>
              {cat.title}
            </div>
            {cat.items.map(item => {
              const cv = cur[item.key];
              const pv = prev[item.key];
              const delta = cv !== null && pv !== null ? cv - pv : null;
              const sig = delta !== null && Math.abs(delta) >= 0.05;
              const improved = sig && ((item.good === 'high' && delta! > 0) || (item.good === 'low' && delta! < 0));
              const worsened = sig && ((item.good === 'high' && delta! < 0) || (item.good === 'low' && delta! > 0));
              const valColor = cv === null ? '#94a3b8'
                : improved ? '#16a34a' : worsened ? '#dc2626' : '#1e293b';

              return (
                <div key={item.key} style={{ padding: '7px 8px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{item.label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: valColor }}>
                      {cv === null ? '－' : `${cv.toFixed(item.dec)}${item.unit}`}
                    </span>
                    {sig && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: improved ? '#16a34a' : '#dc2626' }}>
                        {delta! > 0 ? '▲' : '▼'}{Math.abs(delta!).toFixed(item.dec)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── BS chart ─────────────────────────────────────────────────────

function BsChart({ bs, netIncome, totalAssets, ck, anyEquity, anyPL }: {
  bs: BSState; netIncome: number; totalAssets: number;
  ck: Set<string>; anyEquity: boolean; anyPL: boolean;
}) {
  const H = 160;
  type Seg = { label: string; value: number; color: string; hlKey: string };

  const assetSegs: Seg[] = [
    { label: '現金', value: bs.assets.現金, color: '#3b82f6', hlKey: 'assets_現金' },
    { label: '売掛金', value: Math.max(0, bs.assets.売掛金 - bs.assets.貸倒引当金), color: '#38bdf8', hlKey: 'assets_売掛金' },
    { label: '建物', value: Math.max(0, bs.assets.建物), color: '#818cf8', hlKey: 'assets_建物' },
    { label: '繰延税金資産', value: bs.assets.繰延税金資産, color: '#a78bfa', hlKey: 'assets_繰延税金資産' },
    { label: 'リース資産', value: bs.assets.リース資産, color: '#c084fc', hlKey: 'assets_リース資産' },
    { label: 'のれん', value: bs.assets.のれん, color: '#e879f9', hlKey: 'assets_のれん' },
  ].filter(s => s.value > 0);

  const liabSegs: Seg[] = [
    { label: '買掛金', value: bs.liabilities.買掛金, color: '#fb923c', hlKey: 'liabilities_買掛金' },
    { label: '借入金', value: bs.liabilities.借入金, color: '#ef4444', hlKey: 'liabilities_借入金' },
    { label: '未払法人税等', value: bs.liabilities.未払法人税等, color: '#dc2626', hlKey: 'liabilities_未払法人税等' },
    { label: '賞与引当金', value: bs.liabilities.賞与引当金, color: '#f43f5e', hlKey: 'liabilities_賞与引当金' },
    { label: '退職給付引当金', value: bs.liabilities.退職給付引当金, color: '#e11d48', hlKey: 'liabilities_退職給付引当金' },
    { label: 'リース債務', value: bs.liabilities.リース債務, color: '#be123c', hlKey: 'liabilities_リース債務' },
    { label: '繰延税金負債', value: bs.liabilities.繰延税金負債, color: '#fb7185', hlKey: 'liabilities_繰延税金負債' },
    { label: '未払配当金', value: bs.liabilities.未払配当金, color: '#fda4af', hlKey: 'liabilities_未払配当金' },
  ].filter(s => s.value > 0);

  const equitySegs: Seg[] = [
    { label: '資本金', value: Math.max(0, bs.equity.資本金 - bs.equity.自己株式), color: '#16a34a', hlKey: 'equity_資本金' },
    { label: '繰越利益剰余金', value: Math.max(0, bs.equity.繰越利益剰余金), color: '#4ade80', hlKey: 'equity_繰越利益剰余金' },
    { label: netIncome >= 0 ? '当期純利益' : '当期純損失', value: Math.abs(netIncome), color: netIncome >= 0 ? '#86efac' : '#fca5a5', hlKey: 'pl_net' },
  ].filter(s => s.value > 0);

  const rightSegs = [...liabSegs, ...equitySegs];

  const hlAsset = (seg: Seg) =>
    ck.has(seg.hlKey) || (ck.has('assets_貸倒引当金') && seg.hlKey === 'assets_売掛金');

  const hlRight = (seg: Seg) => {
    if (seg.hlKey === 'pl_net') return anyPL || anyEquity;
    return ck.has(seg.hlKey);
  };

  const renderBar = (segs: Seg[], hlFn: (s: Seg) => boolean) => (
    <div style={{
      height: H,
      display: 'flex',
      flexDirection: 'column-reverse',
      borderRadius: 4,
      overflow: 'hidden',
      border: '1px solid #e2e5ea',
      background: '#f8fafc',
    }}>
      {segs.map(seg => {
        const isHl = hlFn(seg);
        // minH estimates pixel height to decide if labels fit
        const minH = totalAssets > 0 ? (seg.value / totalAssets) * H : 0;
        return (
          <div
            key={seg.hlKey}
            style={{
              flex: seg.value,
              background: seg.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative',
              boxSizing: 'border-box',
              border: isHl ? '2.5px solid #d97706' : '1px solid rgba(255,255,255,0.25)',
              transition: 'flex 0.35s ease',
              zIndex: isHl ? 1 : 0,
            }}
            title={`${seg.label}: ${seg.value.toLocaleString('ja-JP')}`}
          >
            {minH >= 14 && (
              <div style={{
                fontSize: 9, color: 'white', fontWeight: 700,
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                textAlign: 'center', lineHeight: 1.4,
                padding: '0 3px', pointerEvents: 'none', userSelect: 'none',
              }}>
                {minH >= 28 && (
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 58 }}>
                    {seg.label}
                  </div>
                )}
                <div>{seg.value.toLocaleString('ja-JP')}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ marginTop: 10, padding: '10px 12px', background: 'white', borderRadius: 8, border: '1px solid #e2e5ea' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8 }}>BS構成グラフ</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#0369a1', fontWeight: 700, textAlign: 'center', marginBottom: 3 }}>資産</div>
          {assetSegs.length > 0
            ? renderBar(assetSegs, hlAsset)
            : <div style={{ height: H, background: '#f8fafc', borderRadius: 4, border: '1px solid #e2e5ea' }} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', height: H + 22, fontSize: 14, color: '#94a3b8', paddingTop: 22 }}>
          =
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#9d174d', fontWeight: 700, textAlign: 'center', marginBottom: 3 }}>負債 + 純資産</div>
          {rightSegs.length > 0
            ? renderBar(rightSegs, hlRight)
            : <div style={{ height: H, background: '#f8fafc', borderRadius: 4, border: '1px solid #e2e5ea' }} />}
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────

export default function BokiPage() {
  const [bs, setBS] = useState<BSState>(() => ({
    assets: { ...INITIAL_BS.assets },
    liabilities: { ...INITIAL_BS.liabilities },
    equity: { ...INITIAL_BS.equity },
  }));
  const [pl, setPL] = useState<Record<PLKey, number>>(() => ({ ...INITIAL_PL }));
  const [ck, setCK] = useState<Set<string>>(new Set());
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const applyEntry = (entry: JournalEntry) => {
    setSelectedId(entry.id);
    const newBS: BSState = {
      assets: { ...bs.assets },
      liabilities: { ...bs.liabilities },
      equity: { ...bs.equity },
    };
    const newPL = { ...pl };
    const newCK = new Set<string>();
    const newDeltas: Record<string, number> = {};

    for (const eff of entry.effects) {
      const key = `${eff.section}_${eff.field}`;
      if (eff.section === 'assets') {
        newBS.assets[eff.field as BSAssetKey] += eff.delta;
      } else if (eff.section === 'liabilities') {
        newBS.liabilities[eff.field as BSLiabilityKey] += eff.delta;
      } else if (eff.section === 'equity') {
        newBS.equity[eff.field as BSEquityKey] += eff.delta;
      } else {
        newPL[eff.field as PLKey] += eff.delta;
      }
      newCK.add(key);
      newDeltas[key] = (newDeltas[key] ?? 0) + eff.delta;
    }

    setBS(newBS);
    setPL(newPL);
    setCK(newCK);
    setDeltas(newDeltas);
  };

  const reset = () => {
    setBS({ assets: { ...INITIAL_BS.assets }, liabilities: { ...INITIAL_BS.liabilities }, equity: { ...INITIAL_BS.equity } });
    setPL({ ...INITIAL_PL });
    setCK(new Set());
    setDeltas({});
    setSelectedId(null);
  };

  // ── Derived BS values ──────────────────────────────────────────
  const totalAssets =
    bs.assets.現金 + bs.assets.売掛金 + bs.assets.建物 +
    bs.assets.繰延税金資産 + bs.assets.リース資産 + bs.assets.のれん -
    bs.assets.貸倒引当金;

  const totalLiabilities =
    bs.liabilities.買掛金 + bs.liabilities.借入金 + bs.liabilities.未払法人税等 +
    bs.liabilities.賞与引当金 + bs.liabilities.退職給付引当金 + bs.liabilities.リース債務 +
    bs.liabilities.繰延税金負債 + bs.liabilities.未払配当金;

  // PL流入を純資産に含める：当期純利益は期中に繰越利益剰余金へ加算される前の状態
  const netIncome =
    pl.売上高 + pl.為替差益 + pl.法人税等調整額 -
    pl.売上原価 - pl.減価償却費 - pl.法人税等 -
    pl.貸倒引当金繰入 - pl.賞与引当金繰入 - pl.退職給付費用 -
    pl.減損損失 - pl.のれん償却 - pl.支払利息 - pl.為替差損;

  const totalEquity = bs.equity.資本金 + bs.equity.繰越利益剰余金 - bs.equity.自己株式 + netIncome;
  const grossProfit = pl.売上高 - pl.売上原価;

  // ── Delta computations for totals ─────────────────────────────
  const da = (k: string) => deltas[k] ?? 0;

  const dAssets =
    da('assets_現金') + da('assets_売掛金') + da('assets_建物') +
    da('assets_繰延税金資産') + da('assets_リース資産') + da('assets_のれん') -
    da('assets_貸倒引当金');

  const dLiab =
    da('liabilities_買掛金') + da('liabilities_借入金') + da('liabilities_未払法人税等') +
    da('liabilities_賞与引当金') + da('liabilities_退職給付引当金') + da('liabilities_リース債務') +
    da('liabilities_繰延税金負債') + da('liabilities_未払配当金');

  const dNI =
    da('pl_売上高') + da('pl_為替差益') + da('pl_法人税等調整額') -
    da('pl_売上原価') - da('pl_減価償却費') - da('pl_法人税等') -
    da('pl_貸倒引当金繰入') - da('pl_賞与引当金繰入') - da('pl_退職給付費用') -
    da('pl_減損損失') - da('pl_のれん償却') - da('pl_支払利息') - da('pl_為替差損');

  const dEquity = da('equity_資本金') + da('equity_繰越利益剰余金') - da('equity_自己株式') + dNI;
  const dGP = da('pl_売上高') - da('pl_売上原価');

  // ── Highlight flags for computed totals ───────────────────────
  const anyAsset = ['現金','売掛金','建物','繰延税金資産','リース資産','のれん','貸倒引当金']
    .some(f => ck.has(`assets_${f}`));
  const anyLiab = ['買掛金','借入金','未払法人税等','賞与引当金','退職給付引当金','リース債務','繰延税金負債','未払配当金']
    .some(f => ck.has(`liabilities_${f}`));
  const anyPL = (Object.keys(INITIAL_PL) as PLKey[]).some(f => ck.has(`pl_${f}`));
  const anyEquity = ['資本金','繰越利益剰余金','自己株式'].some(f => ck.has(`equity_${f}`)) || anyPL;
  const gpChanged = ck.has('pl_売上高') || ck.has('pl_売上原価');

  // 直前の仕訳適用前の状態を復元（指標のδ計算用）
  const prevBS: BSState = {
    assets: {
      現金: bs.assets.現金 - da('assets_現金'),
      売掛金: bs.assets.売掛金 - da('assets_売掛金'),
      建物: bs.assets.建物 - da('assets_建物'),
      繰延税金資産: bs.assets.繰延税金資産 - da('assets_繰延税金資産'),
      リース資産: bs.assets.リース資産 - da('assets_リース資産'),
      のれん: bs.assets.のれん - da('assets_のれん'),
      貸倒引当金: bs.assets.貸倒引当金 - da('assets_貸倒引当金'),
    },
    liabilities: {
      買掛金: bs.liabilities.買掛金 - da('liabilities_買掛金'),
      借入金: bs.liabilities.借入金 - da('liabilities_借入金'),
      未払法人税等: bs.liabilities.未払法人税等 - da('liabilities_未払法人税等'),
      賞与引当金: bs.liabilities.賞与引当金 - da('liabilities_賞与引当金'),
      退職給付引当金: bs.liabilities.退職給付引当金 - da('liabilities_退職給付引当金'),
      リース債務: bs.liabilities.リース債務 - da('liabilities_リース債務'),
      繰延税金負債: bs.liabilities.繰延税金負債 - da('liabilities_繰延税金負債'),
      未払配当金: bs.liabilities.未払配当金 - da('liabilities_未払配当金'),
    },
    equity: {
      資本金: bs.equity.資本金 - da('equity_資本金'),
      繰越利益剰余金: bs.equity.繰越利益剰余金 - da('equity_繰越利益剰余金'),
      自己株式: bs.equity.自己株式 - da('equity_自己株式'),
    },
  };
  const prevPL: Record<PLKey, number> = {
    売上高: pl.売上高 - da('pl_売上高'),
    売上原価: pl.売上原価 - da('pl_売上原価'),
    減価償却費: pl.減価償却費 - da('pl_減価償却費'),
    法人税等: pl.法人税等 - da('pl_法人税等'),
    貸倒引当金繰入: pl.貸倒引当金繰入 - da('pl_貸倒引当金繰入'),
    賞与引当金繰入: pl.賞与引当金繰入 - da('pl_賞与引当金繰入'),
    退職給付費用: pl.退職給付費用 - da('pl_退職給付費用'),
    減損損失: pl.減損損失 - da('pl_減損損失'),
    のれん償却: pl.のれん償却 - da('pl_のれん償却'),
    支払利息: pl.支払利息 - da('pl_支払利息'),
    為替差益: pl.為替差益 - da('pl_為替差益'),
    為替差損: pl.為替差損 - da('pl_為替差損'),
    法人税等調整額: pl.法人税等調整額 - da('pl_法人税等調整額'),
  };

  // ── Group entries by category ──────────────────────────────────
  const grouped = CATEGORIES.map(cat => ({
    cat,
    entries: JOURNAL_ENTRIES.filter(e => e.category === cat),
  }));

  const cardStyle: React.CSSProperties = {
    background: 'white', borderRadius: 8, border: '1px solid #e2e5ea', overflow: 'hidden',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#f5f6f8', fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 14,
    }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', background: '#2563eb', color: 'white', flexShrink: 0,
        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>簿記シミュレーター</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>仕訳を選択→BS・PLが累積更新。金色=直前の変化</div>
        </div>
        <button
          onClick={reset}
          style={{
            padding: '6px 16px', background: 'white', color: '#2563eb',
            border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 13,
          }}
        >
          リセット
        </button>
      </header>

      {/* ── Body ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left panel: journal entry list ─────────────────── */}
        <div style={{ width: '38%', overflow: 'auto', background: 'white', borderRight: '1px solid #e2e5ea', flexShrink: 0 }}>
          {grouped.map(({ cat, entries }) => (
            <div key={cat}>
              <div style={{
                padding: '7px 12px', background: '#f1f5f9', fontWeight: 700,
                fontSize: 11, color: '#475569', borderBottom: '1px solid #e2e5ea',
                position: 'sticky', top: 0, zIndex: 1,
              }}>
                {cat}
              </div>
              {entries.map(entry => {
                const isSelected = selectedId === entry.id;
                return (
                  <div
                    key={entry.id}
                    onClick={() => applyEntry(entry)}
                    style={{
                      padding: '9px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                      background: isSelected ? '#eff6ff' : 'white',
                      borderLeft: isSelected ? '3px solid #2563eb' : '3px solid transparent',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#1e293b' }}>
                      {entry.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>
                      <span style={{ fontWeight: 600, marginRight: 4 }}>借方:</span>
                      {entry.debits.map((d, i) => (
                        <span key={i} style={{ marginRight: 6 }}>
                          {d.account}
                          <span style={{ fontWeight: 600, color: d.amount >= 0 ? '#16a34a' : '#dc2626' }}>
                            {d.amount >= 0 ? `+${fmt(d.amount)}` : `-${fmt(d.amount)}`}
                          </span>
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      <span style={{ fontWeight: 600, marginRight: 4 }}>貸方:</span>
                      {entry.credits.map((d, i) => (
                        <span key={i} style={{ marginRight: 6 }}>
                          {d.account}
                          <span style={{ fontWeight: 600, color: d.amount >= 0 ? '#16a34a' : '#dc2626' }}>
                            {d.amount >= 0 ? `+${fmt(d.amount)}` : `-${fmt(d.amount)}`}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* ── Right panel: BS + PL ───────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px' }}>

          {/* BS */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 8 }}>
              貸借対照表（BS）
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

              {/* 資産の部 */}
              <div style={cardStyle}>
                <SectionHeader label="資産の部" color="#0369a1" bg="#e0f2fe" />
                <BsRow label="現金" value={bs.assets.現金} fkey="assets_現金" ck={ck} deltas={deltas} />
                <BsRow label="売掛金" value={bs.assets.売掛金} fkey="assets_売掛金" ck={ck} deltas={deltas} />
                <BsRow label="貸倒引当金（△）" value={-bs.assets.貸倒引当金} fkey="assets_貸倒引当金" ck={ck} deltas={deltas} invertDelta />
                <BsRow label="建物" value={bs.assets.建物} fkey="assets_建物" ck={ck} deltas={deltas} />
                <BsRow label="繰延税金資産" value={bs.assets.繰延税金資産} fkey="assets_繰延税金資産" ck={ck} deltas={deltas} />
                <BsRow label="リース資産" value={bs.assets.リース資産} fkey="assets_リース資産" ck={ck} deltas={deltas} />
                <BsRow label="のれん" value={bs.assets.のれん} fkey="assets_のれん" ck={ck} deltas={deltas} />
                <TotalRow label="資産合計" value={totalAssets} isHl={anyAsset} d={dAssets} />
              </div>

              {/* 負債・純資産の部 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={cardStyle}>
                  <SectionHeader label="負債の部" color="#9d174d" bg="#fce7f3" />
                  <BsRow label="買掛金" value={bs.liabilities.買掛金} fkey="liabilities_買掛金" ck={ck} deltas={deltas} />
                  <BsRow label="借入金" value={bs.liabilities.借入金} fkey="liabilities_借入金" ck={ck} deltas={deltas} />
                  <BsRow label="未払法人税等" value={bs.liabilities.未払法人税等} fkey="liabilities_未払法人税等" ck={ck} deltas={deltas} />
                  <BsRow label="賞与引当金" value={bs.liabilities.賞与引当金} fkey="liabilities_賞与引当金" ck={ck} deltas={deltas} />
                  <BsRow label="退職給付引当金" value={bs.liabilities.退職給付引当金} fkey="liabilities_退職給付引当金" ck={ck} deltas={deltas} />
                  <BsRow label="リース債務" value={bs.liabilities.リース債務} fkey="liabilities_リース債務" ck={ck} deltas={deltas} />
                  <BsRow label="繰延税金負債" value={bs.liabilities.繰延税金負債} fkey="liabilities_繰延税金負債" ck={ck} deltas={deltas} />
                  <BsRow label="未払配当金" value={bs.liabilities.未払配当金} fkey="liabilities_未払配当金" ck={ck} deltas={deltas} />
                  <TotalRow label="負債合計" value={totalLiabilities} isHl={anyLiab} d={dLiab} />
                </div>
                <div style={cardStyle}>
                  <SectionHeader label="純資産の部" color="#166534" bg="#f0fdf4" />
                  <BsRow label="資本金" value={bs.equity.資本金} fkey="equity_資本金" ck={ck} deltas={deltas} />
                  <BsRow label="繰越利益剰余金" value={bs.equity.繰越利益剰余金} fkey="equity_繰越利益剰余金" ck={ck} deltas={deltas} />
                  <BsRow label="自己株式（△）" value={-bs.equity.自己株式} fkey="equity_自己株式" ck={ck} deltas={deltas} invertDelta />
                  <ComputedBsRow label="当期純利益" value={netIncome} isHl={anyPL} d={dNI} />
                  <TotalRow label="純資産合計" value={totalEquity} isHl={anyEquity} d={dEquity} />
                </div>
              </div>
            </div>

            {/* BS balance check */}
            <div style={{
              marginTop: 6, fontSize: 11, textAlign: 'right',
              color: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 ? '#16a34a' : '#dc2626',
            }}>
              負債純資産合計: {(totalLiabilities + totalEquity).toLocaleString('ja-JP')}
              {Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 ? ' ✓ バランス' : ' ✗ 不一致'}
            </div>

            {/* BS chart */}
            <BsChart
              bs={bs}
              netIncome={netIncome}
              totalAssets={totalAssets}
              ck={ck}
              anyEquity={anyEquity}
              anyPL={anyPL}
            />

            {/* Ratio indicators */}
            <RatioPanel bs={bs} pl={pl} prevBS={prevBS} prevPL={prevPL} />
          </div>

          {/* PL */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 8 }}>
              損益計算書（PL）
            </div>
            <div style={cardStyle}>
              <SectionHeader label="当期損益" color="#713f12" bg="#fefce8" />
              <PlRow label="売上高" value={pl.売上高} fkey="pl_売上高" ck={ck} deltas={deltas} sign="+" />
              <PlRow label="売上原価（仕入）" value={pl.売上原価} fkey="pl_売上原価" ck={ck} deltas={deltas} sign="−" />
              <TotalRow label="売上総利益" value={grossProfit} isHl={gpChanged} d={dGP} />
              <PlRow label="減価償却費" value={pl.減価償却費} fkey="pl_減価償却費" ck={ck} deltas={deltas} sign="−" />
              <PlRow label="貸倒引当金繰入" value={pl.貸倒引当金繰入} fkey="pl_貸倒引当金繰入" ck={ck} deltas={deltas} sign="−" />
              <PlRow label="賞与引当金繰入" value={pl.賞与引当金繰入} fkey="pl_賞与引当金繰入" ck={ck} deltas={deltas} sign="−" />
              <PlRow label="退職給付費用" value={pl.退職給付費用} fkey="pl_退職給付費用" ck={ck} deltas={deltas} sign="−" />
              <PlRow label="減損損失" value={pl.減損損失} fkey="pl_減損損失" ck={ck} deltas={deltas} sign="−" />
              <PlRow label="のれん償却" value={pl.のれん償却} fkey="pl_のれん償却" ck={ck} deltas={deltas} sign="−" />
              <PlRow label="支払利息" value={pl.支払利息} fkey="pl_支払利息" ck={ck} deltas={deltas} sign="−" />
              <PlRow label="為替差益" value={pl.為替差益} fkey="pl_為替差益" ck={ck} deltas={deltas} sign="+" />
              <PlRow label="為替差損" value={pl.為替差損} fkey="pl_為替差損" ck={ck} deltas={deltas} sign="−" />
              <PlRow label="法人税等" value={pl.法人税等} fkey="pl_法人税等" ck={ck} deltas={deltas} sign="−" />
              <PlRow label="法人税等調整額" value={pl.法人税等調整額} fkey="pl_法人税等調整額" ck={ck} deltas={deltas} sign="±" />
              <TotalRow label="当期純利益" value={netIncome} isHl={anyPL} d={dNI} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
