import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { ToastProvider } from "@/components/ToastProvider";
import RouteChangeToast from "@/components/RouteChangeToast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Subanote",
  description: "個人記帳 Web App",
  appleWebApp: {
    title: "Subanote",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#799ef6",
  // 讓 env(safe-area-inset-bottom) 在 iPhone 有 home bar 的機型上生效(底部分頁列 / 浮動按鈕要避開)
  viewportFit: "cover",
};

// 主題偏好的規則見 lib/theme.ts:localStorage 沒有 "theme" = 跟隨系統。
// 跟隨系統時還要監聽系統主題變化,使用者在系統切換深淺色時頁面會即時跟著變。
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var media = window.matchMedia("(prefers-color-scheme: dark)");
    var apply = function () {
      var stored = localStorage.getItem("theme");
      var isDark = stored === "dark" || stored === "light" ? stored === "dark" : media.matches;
      document.documentElement.classList.toggle("dark", isDark);
    };
    apply();
    media.addEventListener("change", function () {
      if (!localStorage.getItem("theme")) apply();
    });
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <RouteChangeToast />
          <Navbar />
          <main className="flex-1">{children}</main>
          <BottomNav />
        </ToastProvider>
      </body>
    </html>
  );
}
