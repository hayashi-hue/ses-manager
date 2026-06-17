"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions";
import { Field, Input } from "@/components/form";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="メールアドレス" required>
        <Input
          type="email"
          name="email"
          required
          autoComplete="username"
          placeholder="admin@ses-manager.local"
          defaultValue="admin@ses-manager.local"
        />
      </Field>
      <Field label="パスワード" required>
        <Input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          defaultValue="admin1234"
        />
      </Field>

      {state?.error && (
        <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition"
      >
        {pending ? "ログイン中…" : "ログイン"}
      </button>

      <div className="text-xs text-gray-400 border-t border-gray-100 pt-3 mt-2 space-y-0.5">
        <div>デモ用初期アカウント:</div>
        <div>管理者 admin@ses-manager.local / admin1234</div>
        <div>営業 sales@ses-manager.local / sales1234</div>
        <div>エンジニア yamada@ses-manager.local / eng1234</div>
        <div>エンジニア(離脱例) takahashi@ses-manager.local / eng1234</div>
      </div>
    </form>
  );
}
