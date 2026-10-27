"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Boxes,
  ClipboardList,
  FolderTree,
  PackageSearch,
  Store,
  TriangleAlert,
} from "lucide-react";

import { cn } from "@/lib/utils";

type InventoryNavProps = {
  isAdmin: boolean;
};

const commonItems = [
  { href: "/inventory", label: "ภาพรวมสต๊อก", icon: Boxes, exact: true },
  {
    href: "/inventory/products",
    label: "สินค้า",
    icon: PackageSearch,
    exact: false,
  },
  {
    href: "/inventory/low-stock",
    label: "สินค้าใกล้หมด",
    icon: TriangleAlert,
    exact: false,
  },
];

const adminItems = [
  {
    href: "/inventory/receipts",
    label: "รับสินค้า",
    icon: ClipboardList,
    exact: false,
  },
  {
    href: "/inventory/stock",
    label: "ความเคลื่อนไหว",
    icon: ArrowLeftRight,
    exact: false,
  },
  {
    href: "/inventory/import",
    label: "CSV",
    icon: ArrowLeftRight,
    exact: false,
  },
  {
    href: "/inventory/categories",
    label: "หมวดหมู่",
    icon: FolderTree,
    exact: false,
  },
  {
    href: "/inventory/suppliers",
    label: "ผู้จัดจำหน่าย",
    icon: Store,
    exact: false,
  },
];

export function InventoryNav({ isAdmin }: InventoryNavProps) {
  const pathname = usePathname();
  const items = isAdmin ? [...commonItems, ...adminItems] : commonItems;

  return (
    <nav
      aria-label="เมนูสินค้าและสต๊อก"
      className="flex gap-1 overflow-x-auto rounded-xl border bg-background p-1.5 shadow-xs"
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
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
