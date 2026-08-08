import { CATEGORY_INFO, GROUP_INFO, GROUP_ORDER, type Account } from "@/data/ledgerAccounts";

// ネイティブ<select>は2階層のoptgroupをサポートしないため、
// 「大区分／中区分」を結合したラベルで階層を疑似的に表現する。
export default function GroupedAccountOptions({ accounts }: { accounts: Account[] }) {
  return (
    <>
      {GROUP_ORDER.map((group) => {
        const groupAccounts = accounts.filter((a) => a.group === group);
        if (groupAccounts.length === 0) return null;
        const info = GROUP_INFO[group];
        return (
          <optgroup key={group} label={`${CATEGORY_INFO[info.category].label} ／ ${info.label}`}>
            {groupAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.isContra ? "（評価勘定）" : ""}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}
