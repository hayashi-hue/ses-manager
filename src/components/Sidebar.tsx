"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const STAFF_NAV = [
  { href: "/dashboard", label: "ダッシュボード", icon: "📊" },
  { href: "/engineers", label: "技術者管理", icon: "👷" },
  { href: "/projects", label: "案件管理", icon: "📁" },
  { href: "/assignments", label: "アサイン・要員配置", icon: "🔗" },
  { href: "/offers", label: "営業管理", icon: "📣" },
  { href: "/contracts", label: "契約管理", icon: "📝" },
  { href: "/timesheets", label: "工数・稼働実績", icon: "🕐" },
  { href: "/invoices", label: "請求管理", icon: "💴" },
  { href: "/workflows", label: "申請・承認", icon: "📋" },
  { href: "/clients", label: "取引先・営業", icon: "🏢" },
  { href: "/matching", label: "マッチング検索", icon: "🔍" },
];

const ENGINEER_NAV = [
  { href: "/mypage", label: "マイページ", icon: "🏠" },
];

export default function Sidebar({
  userName,
  role,
  roleKey,
}: {
  userName: string;
  role: string;
  roleKey: string;
}) {
  const pathname = usePathname();
  const NAV =
    roleKey === "ENGINEER"
      ? ENGINEER_NAV
      : roleKey === "ADMIN"
        ? [...STAFF_NAV, { href: "/settings/company", label: "会社情報設定", icon: "⚙️" }]
        : STAFF_NAV;
  return (
    <aside className="w-60 shrink-0 bg-slate-900 text-slate-100 min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="text-lg font-bold tracking-tight">SES業務管理</div>
        <div className="text-xs text-slate-400 mt-0.5">SES Operations Suite</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                active
                  ? "bg-indigo-600 text-white font-medium"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-slate-700">
        <div className="text-sm font-medium">{userName}</div>
        <div className="text-xs text-slate-400 mb-3">{role}</div>
        <form action="/api/logout" method="post">
          <button
            type="submit"
            className="w-full text-left text-xs text-slate-300 hover:text-white"
          >
            → ログアウト
          </button>
        </form>
      </div>
    </aside>
  );
}
