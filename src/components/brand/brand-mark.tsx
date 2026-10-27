import Image from "next/image";

import { cn } from "@/lib/utils";

export const DEFAULT_SHOP_NAME = "KAIOAK TECH";
export const DEFAULT_BRAND_LOGO = "/brand/kaioak-tech-mark.svg";
export const DEFAULT_BRAND_TAGLINE = "ซ่อมคอม · ประกอบคอม · อัพเกรด";

type BrandSize = "sm" | "md" | "lg";

const logoSizes: Record<BrandSize, string> = {
  sm: "size-9",
  md: "size-11",
  lg: "size-14",
};

const logoPixels: Record<BrandSize, number> = {
  sm: 36,
  md: 44,
  lg: 56,
};

function resolvedLogo(src?: string | null): string {
  const value = src?.trim();
  return value ? value : DEFAULT_BRAND_LOGO;
}

type BrandLogoProps = {
  src?: string | null;
  alt: string;
  size?: BrandSize;
  tile?: boolean;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({
  src,
  alt,
  size = "md",
  tile = true,
  className,
  priority = false,
}: BrandLogoProps) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden",
        logoSizes[size],
        tile
          ? "rounded-xl bg-[#071331] ring-1 ring-black/10 dark:ring-white/15"
          : "bg-transparent",
        className,
      )}
    >
      <Image
        src={resolvedLogo(src)}
        alt={alt}
        fill
        sizes={`${logoPixels[size]}px`}
        priority={priority}
        unoptimized
        className={cn("object-contain", tile && "p-1")}
      />
    </span>
  );
}

type BrandMarkProps = {
  shopName?: string | null;
  logoUrl?: string | null;
  size?: BrandSize;
  subtitle?: string | null;
  className?: string;
  textClassName?: string;
  subtitleClassName?: string;
  priority?: boolean;
};

export function BrandMark({
  shopName,
  logoUrl,
  size = "md",
  subtitle = DEFAULT_BRAND_TAGLINE,
  className,
  textClassName,
  subtitleClassName,
  priority = false,
}: BrandMarkProps) {
  const name = shopName?.trim() || DEFAULT_SHOP_NAME;

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <BrandLogo
        src={logoUrl}
        alt={`โลโก้ ${name}`}
        size={size}
        priority={priority}
      />
      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-semibold tracking-wide",
            size === "lg" ? "text-base" : "text-sm",
            textClassName,
          )}
        >
          {name}
        </p>
        {subtitle ? (
          <p
            className={cn(
              "mt-0.5 truncate text-muted-foreground",
              size === "sm" ? "text-[10px]" : "text-xs",
              subtitleClassName,
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
