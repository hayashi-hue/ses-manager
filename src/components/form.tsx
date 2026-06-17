import type { ReactNode } from "react";

export function Field({
  label,
  children,
  required,
  hint,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-rose-500 ml-1">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

const baseInput =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${baseInput} ${props.className || ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${baseInput} ${props.className || ""}`} />;
}

export function Select({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select {...props} className={`${baseInput} bg-white ${props.className || ""}`}>
      {children}
    </select>
  );
}

export function Options({ map, all }: { map: Record<string, string>; all?: boolean }) {
  return (
    <>
      {all && <option value="">すべて</option>}
      {Object.entries(map).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </>
  );
}

export function SubmitButton({
  children = "保存する",
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={`inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition ${className}`}
    >
      {children}
    </button>
  );
}
