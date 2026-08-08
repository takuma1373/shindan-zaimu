import type { Metadata } from "next";
import RegisterSW from "./RegisterSW";

export const metadata: Metadata = {
  title: "複式簿記家計簿",
  description: "仕訳→元帳→試算表→BS/PLの流れで管理する複式簿記の家計簿",
  manifest: "/ledger-manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "複式簿記家計簿",
  },
  icons: {
    apple: "/ledger/icon-192",
  },
};

export default function LedgerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RegisterSW />
      {children}
    </>
  );
}
