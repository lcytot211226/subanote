"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HIDDEN_PATHS, NAV_LINKS } from "./Navbar";
import { Cog6ToothIcon } from "./icons";

// 手機底部分頁列:「總覽」放在正中間(最常用、拇指最好按),最右邊是設定(手機版上方導覽列不放設定按鈕)。
const BOTTOM_ORDER = ["/income", "/expense", "/overview", "/cards"];
const BOTTOM_LINKS = [
  ...BOTTOM_ORDER.map((href) => NAV_LINKS.find((l) => l.href === href)!),
  { href: "/settings", label: "設定", Icon: Cog6ToothIcon },
];

/**
 * 手機版的底部分頁列(sm 以上不顯示,桌面版頁面選單在 Navbar 中間)。
 * 前面放一個同高的佔位 div,讓頁面最底下的內容不會被固定在底部的分頁列擋住;
 * 浮動「+」按鈕(QuickAddButton / TransactionsClient)在手機上也相應往上移。
 */
export default function BottomNav() {
  const pathname = usePathname();

  if (HIDDEN_PATHS.includes(pathname)) {
    return null;
  }

  return (
    <>
      <div aria-hidden="true" className="h-[calc(4rem+env(safe-area-inset-bottom))] shrink-0 sm:hidden" />
      <nav
        aria-label="頁面選單"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden dark:border-zinc-800 dark:bg-black/90"
      >
        <ul className="grid h-16 grid-cols-5">
          {BOTTOM_LINKS.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:scale-95 motion-reduce:transition-none ${
                    active ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  <span
                    className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                      active ? "bg-zinc-100 dark:bg-zinc-800" : ""
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
