"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { SignInForm } from "@/features/auth/components/SignInForm";
import { LogoBadge } from "@/shared/icons/LogoBadge";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#fafbfa] px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[640px] w-[640px] rounded-full bg-ki-blue-soft/70 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.04] to-transparent"
      />

      <div className="relative w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center gap-3">
          <LogoBadge height={40} />
        </div>

        <div
          className="rounded-2xl border border-black/[0.05] bg-white p-7 sm:p-8 shadow-[0_1px_2px_rgba(8,26,18,0.04),0_12px_32px_-16px_rgba(8,26,18,0.08)]"
        >
          <div className="mb-6">
            <h1 className="text-xl font-bold text-ki-dark tracking-tight">Вход</h1>
            <p className="mt-1 text-xs text-gray-500">
              Введите данные администратора, чтобы продолжить
            </p>
          </div>

          <Suspense fallback={null}>
            <LoginNotice />
          </Suspense>

          <Suspense fallback={null}>
            <SignInForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

function LoginNotice() {
  const params = useSearchParams();
  const error = params.get("error");

  if (error === "service_unavailable") {
    return (
      <div className="mb-5 rounded-xl border border-red-100 bg-red-50/70 px-4 py-3 text-sm text-red-700">
        Сервис временно недоступен. Попробуйте войти снова через минуту.
      </div>
    );
  }
  return null;
}
