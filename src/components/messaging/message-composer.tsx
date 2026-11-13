"use client";

import { useState } from "react";
import { Copy, MessageCircle, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  lineAddUrl,
  lineShareUrl,
  whatsAppUrl,
} from "@/lib/messaging";

export function MessageComposer({
  customerName,
  phone,
  lineId,
  whatsapp,
  defaultMessage,
  triggerLabel = "แจ้งลูกค้า",
}: {
  customerName: string;
  phone?: string | null;
  lineId?: string | null;
  whatsapp?: string | null;
  defaultMessage: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(defaultMessage);
  const [copied, setCopied] = useState(false);

  const targetPhone = whatsapp?.trim() || phone?.trim() || "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          setMessage(defaultMessage);
          setOpen(true);
        }}
      >
        <MessageCircle aria-hidden />
        {triggerLabel}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border bg-background p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">ส่งข้อความถึงลูกค้า</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {customerName}
                  {phone ? ` · ${phone}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="ปิด"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="message-composer-text">ข้อความ</Label>
              <Textarea
                id="message-composer-text"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={7}
                className="min-h-40 text-sm leading-6"
              />
              <p className="text-[11px] leading-5 text-muted-foreground">
                แก้ไขข้อความก่อนส่งได้ ระบบจะเปิดแอป LINE หรือ WhatsApp
                พร้อมข้อความนี้ให้เลือกผู้รับ
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={copy}>
                <Copy aria-hidden />
                {copied ? "คัดลอกแล้ว" : "คัดลอก"}
              </Button>
              <a
                href={lineShareUrl(message)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted"
              >
                <Send className="size-4" aria-hidden />
                แชร์ LINE
              </a>
              {targetPhone ? (
                <a
                  href={whatsAppUrl(targetPhone, message)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted"
                >
                  <MessageCircle className="size-4" aria-hidden />
                  WhatsApp
                </a>
              ) : (
                <span className="inline-flex h-9 items-center justify-center rounded-lg border border-dashed px-3 text-xs text-muted-foreground">
                  ไม่มีเบอร์ WhatsApp
                </span>
              )}
              {lineId ? (
                <a
                  href={lineAddUrl(lineId)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted"
                >
                  <MessageCircle className="size-4" aria-hidden />
                  เปิด LINE ID
                </a>
              ) : (
                <span className="inline-flex h-9 items-center justify-center rounded-lg border border-dashed px-3 text-xs text-muted-foreground">
                  ไม่มี LINE ID
                </span>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
