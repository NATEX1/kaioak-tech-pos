import { describe, expect, it } from "vitest";

import type { BillStatus } from "@/generated/prisma/enums";
import {
  getPrintDocumentEnglishTitle,
  getPrintDocumentTitle,
  getPrintDocumentWarning,
  printFormatHref,
  printFormatLabel,
} from "@/lib/print-documents";

const statuses: BillStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "PAID",
  "VOIDED",
];

describe("print document labels", () => {
  it("returns a Thai and English title for every bill status", () => {
    for (const status of statuses) {
      expect(getPrintDocumentTitle(status)).toBeTruthy();
      expect(getPrintDocumentEnglishTitle(status)).toBeTruthy();
    }

    expect(getPrintDocumentTitle("PAID")).toBe("ใบเสร็จรับเงิน");
    expect(getPrintDocumentTitle("APPROVED")).toContain("ใบส่งของ");
    expect(getPrintDocumentEnglishTitle("PAID")).toBe("RECEIPT");
  });

  it("marks non-final bills as non-accounting documents", () => {
    expect(getPrintDocumentWarning("DRAFT")).toContain("ยังไม่มีผลทางบัญชี");
    expect(getPrintDocumentWarning("PENDING_APPROVAL")).toContain(
      "ยังไม่มีผลทางบัญชี",
    );
    expect(getPrintDocumentWarning("REJECTED")).toContain("ตีกลับ");
    expect(getPrintDocumentWarning("VOIDED")).toContain("ยกเลิก");
    expect(getPrintDocumentWarning("APPROVED")).toBeNull();
    expect(getPrintDocumentWarning("PAID")).toBeNull();
  });

  it("builds stable A4 and 80 mm print routes", () => {
    expect(printFormatHref("bill_1", "a4")).toBe(
      "/print/bills/bill_1/a4",
    );
    expect(printFormatHref("bill_1", "thermal-80mm")).toBe(
      "/print/bills/bill_1/thermal-80mm",
    );
    expect(printFormatLabel("a4")).toBe("กระดาษ A4");
    expect(printFormatLabel("thermal-80mm")).toBe("สลิป 80 มม.");
  });

  it("distinguishes Tax Invoice titles when VAT is enabled", () => {
    // When VAT is enabled and customer has Tax ID -> full Tax Invoice
    expect(
      getPrintDocumentTitle("PAID", {
        vatEnabled: true,
        hasCustomerTaxId: true,
      }),
    ).toBe("ใบเสร็จรับเงิน / ใบกำกับภาษี");
    expect(
      getPrintDocumentEnglishTitle("PAID", {
        vatEnabled: true,
        hasCustomerTaxId: true,
      }),
    ).toBe("RECEIPT / TAX INVOICE");

    // When VAT is enabled and customer does not have Tax ID -> ABB Tax Invoice
    expect(
      getPrintDocumentTitle("PAID", {
        vatEnabled: true,
        hasCustomerTaxId: false,
      }),
    ).toBe("ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ");
    expect(
      getPrintDocumentEnglishTitle("PAID", {
        vatEnabled: true,
        hasCustomerTaxId: false,
      }),
    ).toBe("RECEIPT / ABB TAX INVOICE");

    // When VAT is not enabled -> simple receipt
    expect(
      getPrintDocumentTitle("PAID", {
        vatEnabled: false,
        hasCustomerTaxId: false,
      }),
    ).toBe("ใบเสร็จรับเงิน");
  });
});
