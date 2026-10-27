import type { Role } from "@/generated/prisma/enums";

const dateTimeFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "long",
  timeZone: "Asia/Bangkok",
});

export function roleLabel(role: Role): string {
  return role === "ADMIN" ? "ผู้ดูแลระบบ" : "ช่างเทคนิค";
}

export function formatThaiDateTime(value: Date | string | null): string {
  if (!value) {
    return "ยังไม่เคยเข้าสู่ระบบ";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return dateTimeFormatter.format(date);
}

export function formatThaiDate(value: Date | string | null): string {
  if (!value) {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return dateFormatter.format(date);
}

export function userInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
