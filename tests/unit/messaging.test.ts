import { describe, expect, it } from "vitest";

import {
  buildRepairStatusMessage,
  normalizeWhatsAppPhone,
  renderMessageTemplate,
  whatsAppUrl,
} from "@/lib/messaging";

describe("messaging helpers", () => {
  it("renders known placeholders and keeps unknown ones", () => {
    expect(
      renderMessageTemplate("สวัสดี {customer} จาก {shop} {unknown}", {
        customer: "คุณเอ",
        shop: "KLYX LAB",
      }),
    ).toBe("สวัสดี คุณเอ จาก KLYX LAB {unknown}");
  });

  it("uses a custom template when provided", () => {
    expect(
      buildRepairStatusMessage({
        status: "REPAIRING",
        templates: { REPAIRING: "งาน {bill} กำลังซ่อม" },
        variables: { bill: "RP-001" },
      }),
    ).toBe("งาน RP-001 กำลังซ่อม");
  });

  it("normalizes Thai phone numbers for WhatsApp", () => {
    expect(normalizeWhatsAppPhone("081-234-5678")).toBe("66812345678");
    expect(whatsAppUrl("0812345678", "สวัสดี")).toContain(
      "https://wa.me/66812345678?text=",
    );
  });
});
