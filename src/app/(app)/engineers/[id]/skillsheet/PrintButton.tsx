"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 text-sm font-medium no-print"
    >
      🖨 印刷 / PDF出力
    </button>
  );
}
