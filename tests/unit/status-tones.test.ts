import { describe, expect, it } from "vitest";

import { auditActionTone } from "@/lib/audit-labels";
import {
  billStatusBadgeClass,
  quoteStatusBadgeClass,
  warrantyCheckResultClass,
} from "@/lib/bill-labels";
import { commissionEntryStatusClass } from "@/lib/commission-labels";
import { STATUS_TONE_CLASS } from "@/lib/status-tones";

describe("status tone classes", () => {
  it("pairs every light surface with a dark surface and readable text", () => {
    for (const className of Object.values(STATUS_TONE_CLASS)) {
      expect(className).toMatch(/\bbg-\S+/);
      expect(className).toContain("dark:bg-");
      expect(className).toContain("dark:text-");
      expect(className).toContain("dark:border-");
    }
  });

  it("keeps every badge helper theme-aware", () => {
    const billStatuses = [
      "PAID",
      "APPROVED",
      "PENDING_APPROVAL",
      "REJECTED",
      "VOIDED",
    ] as const;
    const quoteStatuses = [
      "SENT",
      "ACCEPTED",
      "CONVERTED",
      "EXPIRED",
      "CANCELLED",
    ] as const;
    const warrantyResults = [
      "FOUND_IN_WARRANTY",
      "FOUND_OUT_OF_WARRANTY",
      "NOT_FOUND",
    ] as const;
    const commissionStatuses = ["PENDING", "PAID", "REVERSED"] as const;

    const classes = [
      ...billStatuses.map(billStatusBadgeClass),
      ...quoteStatuses.map(quoteStatusBadgeClass),
      ...warrantyResults.map(warrantyCheckResultClass),
      ...commissionStatuses.map(commissionEntryStatusClass),
      auditActionTone("BILL_VOIDED"),
      auditActionTone("BILL_CREATED"),
      auditActionTone("BILL_UPDATED"),
      auditActionTone("AUTH_LOGIN_SUCCESS"),
      auditActionTone("FUTURE_ACTION"),
    ];

    for (const className of classes) {
      expect(className).toContain("dark:bg-");
      expect(className).toContain("dark:text-");
      expect(className).toContain("dark:border-");
    }
  });
});
