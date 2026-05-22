import { TBadgeTone } from "@/shared/ui/Badge";
import {
  TCheckKind,
  TCheckResultStatus,
  TCheckRunStatus,
  TCheckSection,
  TCheckSeverity,
} from "@/features/inspector/interfaces/inspector.interfaces";

export const RUN_STATUS_LABELS: Record<TCheckRunStatus, string> = {
  pending: "В очереди",
  running: "Выполняется",
  passed: "Пройдено",
  failed: "Не пройдено",
  error: "Ошибка инспектора",
};

export const RUN_STATUS_TONE: Record<TCheckRunStatus, TBadgeTone> = {
  pending: "neutral",
  running: "info",
  passed: "success",
  failed: "danger",
  error: "warn",
};

export const RUN_STATUS_PULSE: Record<TCheckRunStatus, boolean> = {
  pending: true,
  running: true,
  passed: false,
  failed: false,
  error: false,
};

export const TERMINAL_RUN_STATUSES: ReadonlySet<TCheckRunStatus> = new Set([
  "passed",
  "failed",
  "error",
]);

export const RESULT_STATUS_LABELS: Record<TCheckResultStatus, string> = {
  passed: "OK",
  failed: "Fail",
  skipped: "Skipped",
  error: "Error",
};

export const RESULT_STATUS_TONE: Record<TCheckResultStatus, TBadgeTone> = {
  passed: "success",
  failed: "danger",
  skipped: "neutral",
  error: "warn",
};

export const CHECK_KIND_LABELS: Record<string, string> = {
  package_installed: "Установлен пакет",
  systemd_active: "Активен systemd-юнит",
  port_listening: "Порт слушает",
  file_exists: "Файл существует",
  file_contains: "Файл содержит шаблон",
  command_exit_zero: "Команда успешна (exit 0)",
  command_output_matches: "Вывод команды соответствует",
  os_release: "Дистрибутив/версия ОС",
  user_exists: "Пользователь существует",
  process_running: "Процесс запущен",
  http_endpoint: "HTTP-эндпоинт",
  dns_resolves: "DNS-резолв",
  command_output_compare: "Численное сравнение",
};

export function describeKind(kind: TCheckKind): string {
  return CHECK_KIND_LABELS[kind] ?? kind;
}

export const SECTION_LABELS: Record<string, string> = {
  os: "Операционная система",
  software: "Программное обеспечение",
  network: "Сеть",
  other: "Прочее",
};

export const SECTION_ORDER: TCheckSection[] = ["os", "software", "network", "other"];

export const SECTION_TONE: Record<string, TBadgeTone> = {
  os: "violet",
  software: "info",
  network: "cyan",
  other: "neutral",
};

export function describeSection(section: TCheckSection): string {
  return SECTION_LABELS[section] ?? section;
}

export const SEVERITY_LABELS: Record<string, string> = {
  critical: "Критично",
  warning: "Важно",
  info: "Инфо",
};

export const SEVERITY_TONE: Record<string, TBadgeTone> = {
  critical: "danger",
  warning: "warn",
  info: "neutral",
};

export function describeSeverity(severity: TCheckSeverity): string {
  return SEVERITY_LABELS[severity] ?? severity;
}
