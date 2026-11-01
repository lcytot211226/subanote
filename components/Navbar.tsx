"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "./NotificationBell";
import Logo from "./Logo";
import {
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  CreditCardIcon,
} from "./icons";

/** 頁面選單:桌面版在導覽列中間,手機版改成底部分頁列(BottomNav),拇指比較好按。 */
export const NAV_LINKS = [
  { href: "/overview", label: "總覽", Icon: ChartBarIcon },
  { href: "/income", label: "收入", Icon: ArrowUpCircleIcon },
  { href: "/expense", label: "支出", Icon: ArrowDownCircleIcon },
  { href: "/cards", label: "信用卡", Icon: CreditCardIcon },
];

/** 未登入的頁面不顯示導覽列 / 底部分頁列 */
export const HIDDEN_PATHS = ["/", "/login", "/register", "/verify-email", "/forgot-password"];

function SettingsLink() {
  return (
    // 手機版的設定在底部分頁列最右邊(BottomNav),這裡只在 sm 以上顯示
    <Link
      href="/settings"
      aria-label="設定"
      title="設定"
      className="hidden rounded-md border border-zinc-300 p-2 text-zinc-700 hover:bg-zinc-100 sm:block dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      <Cog6ToothIcon className="h-5 w-5" />
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();

  if (HIDDEN_PATHS.includes(pathname)) {
    return null;
  }

  // 管理員入口、登出都移到 /settings,導覽列只留頁面選單 + 通知 / 設定 / 深淺色快速切換。
  // 手機版:頁面選單與設定移到底部分頁列(BottomNav),上方只剩 Logo 與通知 / 深淺色。
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
      {/* 桌面版用左右等寬(1fr)的三欄 grid,中間的選單才會真的置中,不受左右兩邊寬度不同影響 */}
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:grid sm:grid-cols-[1fr_auto_1fr]">
        <Link href="/overview" aria-label="Subanote 首頁" className="justify-self-start">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium ${
                pathname.startsWith(link.href)
                  ? "text-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 justify-self-end sm:gap-3">
          <NotificationBell />
          <SettingsLink />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
