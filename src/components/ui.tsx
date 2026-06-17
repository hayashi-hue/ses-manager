import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent = "text-gray-900",
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}</span>
        {icon && <span className="text-gray-300 text-2xl">{icon}</span>}
      </div>
      <div className={`text-2xl font-bold mt-2 ${accent}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </Card>
  );
}

export function Badge({
  children,
  className = "bg-gray-100 text-gray-700",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
}) {
  const cls =
    variant === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-700"
      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50";
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition ${cls}`}
    >
      {children}
    </Link>
  );
}

export function EmptyState({
  message,
  hint,
}: {
  message: string;
  hint?: string;
}) {
  return (
    <div className="text-center py-16">
      <div className="text-4xl mb-3">📭</div>
      <p className="text-gray-600 font-medium">{message}</p>
      {hint && <p className="text-sm text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

/** テーブル枠 */
export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
            {head}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-medium whitespace-nowrap ${className}`}>{children}</th>;
}

export function Td({
  children,
  className = "",
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-4 py-3 align-middle ${className}`}>
      {children}
    </td>
  );
}
