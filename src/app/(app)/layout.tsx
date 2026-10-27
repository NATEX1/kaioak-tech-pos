import type { ReactNode } from "react";
import { LogOut, ShieldCheck } from "lucide-react";

import { BrandMark } from "@/components/brand/brand-mark";
import { AppNav } from "@/components/layout/app-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { roleLabel, userInitial } from "@/lib/labels";
import { logoutAction } from "@/server/actions/auth";
import { requireUser } from "@/server/auth/session";
import { getShopSettings } from "@/server/services/settings";

export const instant = false;

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [user, settings] = await Promise.all([
    requireUser(),
    getShopSettings(),
  ]);

  return (
    <div className="min-h-svh bg-muted/25 print:block print:min-h-0 print:bg-white lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hidden border-r bg-sidebar text-sidebar-foreground print:hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:px-4 lg:py-5">
        <BrandMark
          shopName={settings.shopName}
          logoUrl={settings.logoUrl}
          subtitle="POS · ซ่อม · ประกอบ"
          className="shrink-0 px-3 pb-5"
          priority
        />

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <AppNav isAdmin={user.role === "ADMIN"} />
        </div>

        <div className="mt-auto shrink-0 space-y-3 border-t pt-4">
          <div className="flex items-center gap-3 rounded-xl bg-background p-3 ring-1 ring-foreground/5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {userInitial(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="line-clamp-2 break-words text-[13px] font-medium leading-4"
                title={user.name}
              >
                {user.name}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {roleLabel(user.role)}
              </p>
            </div>
          </div>
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
            >
              <LogOut aria-hidden />
              ออกจากระบบ
            </Button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 print:block">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur print:hidden sm:px-6 lg:px-8">
          <BrandMark
            shopName={settings.shopName}
            logoUrl={settings.logoUrl}
            size="sm"
            subtitle={roleLabel(user.role)}
            className="lg:hidden"
            priority
          />

          <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
            <ShieldCheck
              className="size-4 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
            เชื่อมต่ออย่างปลอดภัย · session หมดอายุเมื่อไม่ใช้งาน 30 นาที
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {userInitial(user.name)}
              </div>
              <div className="max-w-44">
                <p className="truncate text-sm font-medium leading-none">
                  {user.name}
                </p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>
            <form action={logoutAction} className="lg:hidden">
              <Button
                type="submit"
                variant="outline"
                size="icon"
                aria-label="ออกจากระบบ"
              >
                <LogOut aria-hidden />
              </Button>
            </form>
          </div>
        </header>

        <div className="border-b bg-background/80 print:hidden lg:hidden">
          <AppNav variant="mobile" isAdmin={user.role === "ADMIN"} />
        </div>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 print:max-w-none print:p-0 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
