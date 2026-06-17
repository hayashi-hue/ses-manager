"use client";

import { useRouter } from "next/navigation";

export default function MonthPicker({ value }: { value: string }) {
  const router = useRouter();
  return (
    <input
      type="month"
      defaultValue={value}
      onChange={(e) => {
        if (e.target.value) router.push(`/timesheets?ym=${e.target.value}`);
      }}
      className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
    />
  );
}
