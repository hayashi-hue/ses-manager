import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-white">SES業務管理システム</div>
          <p className="text-sm text-slate-400 mt-2">
            技術者・案件・契約・請求を一括管理
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-7">
          <LoginForm />
        </div>
        <p className="text-center text-xs text-slate-500 mt-6">
          初期アカウントは README.md / 画面下部のヒントをご確認ください
        </p>
      </div>
    </div>
  );
}
