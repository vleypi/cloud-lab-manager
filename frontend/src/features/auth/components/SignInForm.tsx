"use client";

import { FormEvent, InputHTMLAttributes, useState } from "react";

import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/utils/cn";

import { AUTH_ERROR_MESSAGES } from "@/features/auth/constants/auth.constants";
import { useAdminSignIn } from "@/features/auth/hooks/useAdminSignIn";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const signIn = useAdminSignIn();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailError(null);
    setPasswordError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError(AUTH_ERROR_MESSAGES.EMPTY_EMAIL);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError(AUTH_ERROR_MESSAGES.INVALID_EMAIL);
      return;
    }
    if (!password) {
      setPasswordError(AUTH_ERROR_MESSAGES.EMPTY_PASSWORD);
      return;
    }

    signIn.mutate({ email: trimmedEmail, password });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <SoftField
        label="Email"
        type="email"
        placeholder="admin@cloud-lab-manager.local"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          setEmailError(null);
        }}
        autoFocus
        autoComplete="username"
        error={emailError}
      />

      <SoftField
        label="Пароль"
        type="password"
        placeholder="••••••••"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          setPasswordError(null);
        }}
        autoComplete="current-password"
        error={passwordError}
      />

      <Button type="submit" size="lg" fullWidth isLoading={signIn.isPending} className="mt-2">
        Войти
      </Button>
    </form>
  );
}

interface ISoftFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
}

function SoftField({ label, error, id, name, className, ...rest }: ISoftFieldProps) {
  const fieldId = id ?? name ?? label.toLowerCase();
  return (
    <div>
      <label
        htmlFor={fieldId}
        className="mb-2 ml-0.5 block text-[11px] font-medium uppercase tracking-wider text-gray-500"
      >
        {label}
      </label>
      <input
        id={fieldId}
        name={name ?? fieldId}
        className={cn(
          "w-full h-12 px-4 rounded-xl text-sm text-ki-dark font-medium",
          "bg-gray-50/70 border border-transparent placeholder:font-normal placeholder:text-gray-400",
          "transition-[background,border-color,box-shadow] duration-150",
          "hover:bg-gray-100/70",
          "focus:outline-none focus:bg-white focus:border-ki-blue/40 focus:ring-4 focus:ring-ki-blue/10",
          error && "bg-red-50/40 border-red-200/70 focus:bg-white focus:border-red-300 focus:ring-red-100",
          className,
        )}
        {...rest}
      />
      {error && <p className="mt-1.5 ml-0.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
