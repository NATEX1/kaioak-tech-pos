"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  function toggleTheme() {
    const root = document.documentElement;
    const next = root.classList.contains("dark") ? "light" : "dark";

    root.classList.toggle("dark", next === "dark");
    root.style.colorScheme = next;

    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Theme switching still works for this page when storage is unavailable.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="สลับโหมดสว่าง/มืด"
      title="สลับโหมดสว่าง/มืด"
      className={cn(
        "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <Sun aria-hidden className="hidden size-4 dark:block" />
      <Moon aria-hidden className="size-4 dark:hidden" />
    </Button>
  );
}
