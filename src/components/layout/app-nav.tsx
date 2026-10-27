"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Coins,
  Contact,
  LayoutDashboard,
  PackageSearch,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Store,
  UserRound,
  UsersRound,
} from "lucide-react";

import { cn } from "@/lib/utils";

type AppNavProps = {
  isAdmin: boolean;
  variant?: "desktop" | "mobile";
};

const baseItems = [
  { href: "/", label: "ภาพรวม", icon: LayoutDashboard, exact: true },
  {
    href: "/bills",
    label: "บิลและอนุมัติ",
    icon: ReceiptText,
    exact: false,
  },
  {
    href: "/commissions",
    label: "ค่าคอมมิชชั่น",
    icon: Coins,
    exact: false,
  },
  { href: "/customers", label: "ลูกค้า", icon: Contact, exact: false },
  {
    href: "/inventory",
    label: "สินค้าและสต๊อก",
    icon: PackageSearch,
    exact: false,
  },
  {
    href: "/warranty",
    label: "ตรวจสอบประกัน",
    icon: ShieldCheck,
    exact: false,
  },
  { href: "/profile", label: "โปรไฟล์ของฉัน", icon: UserRound, exact: false },
];

const adminItems = [
  {
    href: "/reports",
    label: "รายงานยอดขาย",
    icon: BarChart3,
    exact: false,
  },
  {
    href: "/audit-logs",
    label: "บันทึกระบบ",
    icon: ClipboardList,
    exact: false,
  },
  {
    href: "/settings/users",
    label: "จัดการผู้ใช้",
    icon: UsersRound,
    exact: false,
  },
  {
    href: "/settings/shop",
    label: "ข้อมูลร้าน",
    icon: Store,
    exact: false,
  },
];

export function AppNav({ isAdmin, variant = "desktop" }: AppNavProps) {
  const pathname = usePathname();
  const items = isAdmin
    ? [
        ...baseItems.slice(0, 6),
        ...adminItems,
        baseItems[6],
      ]
    : baseItems;

  return (
    <nav
      aria-label="เมนูหลัก"
      className={cn(
        variant === "desktop" && "grid gap-1",
        // Mobile: horizontally scrollable row with icon above label, so the
        // menu labels stay readable instead of shrinking to icons only
        variant === "mobile" && "flex gap-0.5 overflow-x-auto px-2 py-2",
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={variant === "mobile" ? item.label : undefined}
            title={variant === "mobile" ? item.label : undefined}
            className={cn(
              "inline-flex shrink-0 items-center rounded-lg text-sm font-medium transition-colors",
              variant === "desktop" && "gap-2 px-3 py-2.5",
              // Mobile: icon above a short label; the row scrolls sideways
              variant === "mobile" && "flex-col gap-0.5 px-2.5 py-2 text-[10px] leading-none",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "shrink-0",
                variant === "desktop" && "size-4",
                variant === "mobile" && "size-5",
              )}
              aria-hidden
            />
            {variant === "desktop" && item.label}
            {variant === "mobile" && (
              // Labels stay visible from 375 px upward; smaller screens fall
              // back to the accessible icon-only target
              <span className="hidden max-w-[4rem] truncate min-[375px]:inline">
                {item.label}
              </span>
            )}
          </Link>
        );
      })}
      {variant === "desktop" ? (
        <div className="mt-4 flex items-center gap-2 px-3 text-xs text-muted-foreground">
          <Settings2 className="size-3.5" aria-hidden />
          Phase 10 · Production Ready
        </div>
      ) : null}
    </nav>
  );
}
