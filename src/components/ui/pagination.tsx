import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PaginationProps = {
  page: number;
  pageSize: number;
  totalCount: number;
  /** Base URL path — query params will be appended */
  basePath: string;
  /** Existing query params to preserve when changing page */
  preserveParams?: Record<string, string | undefined>;
};

export function buildPageUrl(
  basePath: string,
  page: number,
  preserveParams: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(preserveParams)) {
    if (v) params.set(k, v);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({
  page,
  pageSize,
  totalCount,
  basePath,
  preserveParams = {},
}: PaginationProps) {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  // Show at most 5 page numbers around current
  const delta = 2;
  const range: number[] = [];
  for (
    let i = Math.max(1, page - delta);
    i <= Math.min(totalPages, page + delta);
    i++
  ) {
    range.push(i);
  }

  return (
    <nav
      aria-label="การแบ่งหน้า"
      className="flex items-center justify-between gap-3 px-4 py-3"
    >
      <p className="text-xs text-muted-foreground">
        หน้า {page.toLocaleString("th-TH")} จาก{" "}
        {totalPages.toLocaleString("th-TH")} ·{" "}
        {totalCount.toLocaleString("th-TH")} รายการทั้งหมด
      </p>

      <div className="flex items-center gap-1">
        <Link
          href={buildPageUrl(basePath, page - 1, preserveParams)}
          aria-disabled={!hasPrev}
          aria-label="หน้าก่อนหน้า"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "h-8 w-8",
            !hasPrev && "pointer-events-none opacity-40",
          )}
          tabIndex={hasPrev ? 0 : -1}
        >
          <ChevronLeft className="size-4" />
        </Link>

        {range[0] > 1 && (
          <>
            <Link
              href={buildPageUrl(basePath, 1, preserveParams)}
              className={cn(
                buttonVariants({ variant: "outline", size: "icon" }),
                "h-8 w-8 text-xs",
              )}
            >
              1
            </Link>
            {range[0] > 2 && (
              <span className="px-1 text-muted-foreground">…</span>
            )}
          </>
        )}

        {range.map((p) => (
          <Link
            key={p}
            href={buildPageUrl(basePath, p, preserveParams)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: "outline", size: "icon" }),
              "h-8 w-8 text-xs",
              p === page &&
                "border-primary bg-primary/10 text-primary pointer-events-none",
            )}
          >
            {p}
          </Link>
        ))}

        {range[range.length - 1] < totalPages && (
          <>
            {range[range.length - 1] < totalPages - 1 && (
              <span className="px-1 text-muted-foreground">…</span>
            )}
            <Link
              href={buildPageUrl(basePath, totalPages, preserveParams)}
              className={cn(
                buttonVariants({ variant: "outline", size: "icon" }),
                "h-8 w-8 text-xs",
              )}
            >
              {totalPages}
            </Link>
          </>
        )}

        <Link
          href={buildPageUrl(basePath, page + 1, preserveParams)}
          aria-disabled={!hasNext}
          aria-label="หน้าถัดไป"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "h-8 w-8",
            !hasNext && "pointer-events-none opacity-40",
          )}
          tabIndex={hasNext ? 0 : -1}
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </nav>
  );
}
