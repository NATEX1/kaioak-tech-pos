"use client";

import { useEffect, useState } from "react";
import { QrCode } from "lucide-react";

import { buildPromptPayPayload } from "@/lib/promptpay";
import { cn } from "@/lib/utils";

export function PromptPayQr({
  promptpayId,
  amount,
  reference,
  className,
}: {
  promptpayId: string;
  amount: string;
  reference?: string | null;
  className?: string;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSvg(null);
    setError(null);

    try {
      const payload = buildPromptPayPayload({
        promptpayId,
        amount,
        reference: reference ?? undefined,
      });

      import("qrcode")
        .then((module) => {
          const QRCode = module.default ?? module;
          return QRCode.toString(payload, {
            type: "svg",
            margin: 1,
            width: 240,
            errorCorrectionLevel: "M",
          });
        })
        .then((markup) => {
          if (!cancelled) setSvg(markup);
        })
        .catch(() => {
          if (!cancelled) setError("สร้าง QR ไม่สำเร็จ");
        });
    } catch (qrFailure) {
      setError(
        qrFailure instanceof Error ? qrFailure.message : "สร้าง QR ไม่สำเร็จ",
      );
    }

    return () => {
      cancelled = true;
    };
  }, [promptpayId, amount, reference]);

  return (
    <div
      className={cn(
        "flex min-h-40 items-center justify-center rounded-xl border border-neutral-200 bg-white p-3",
        className,
      )}
    >
      {svg ? (
        <div
          className="size-48 [&>svg]:size-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : error ? (
        <p className="max-w-52 text-center text-xs text-rose-700">{error}</p>
      ) : (
        <div className="flex flex-col items-center gap-2 text-neutral-500">
          <QrCode className="size-10 animate-pulse" aria-hidden />
          <p className="text-xs">กำลังสร้าง QR…</p>
        </div>
      )}
    </div>
  );
}
