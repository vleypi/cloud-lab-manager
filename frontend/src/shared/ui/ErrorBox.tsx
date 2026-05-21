import { cn } from "@/shared/utils/cn";
import { ApiError, isApiError } from "@/shared/utils/service.util";

interface IErrorBoxProps {
  error: unknown;
  title?: string;
  className?: string;
}

export function ErrorBox({ error, title = "Ошибка", className }: IErrorBoxProps) {
  const message = describeError(error);
  const code = isApiError(error) ? error.code : undefined;
  const status = isApiError(error) ? error.statusCode : undefined;

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-700",
        className,
      )}
    >
      <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z"
        />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-red-900">{title}</p>
        <p className="mt-0.5 break-words">{message}</p>
        {(code || status) && (
          <p className="mt-1.5 text-xs text-red-500/80 font-mono">
            {status && <>HTTP {status}</>}
            {status && code && " · "}
            {code}
          </p>
        )}
      </div>
    </div>
  );
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Произошла неизвестная ошибка";
}
