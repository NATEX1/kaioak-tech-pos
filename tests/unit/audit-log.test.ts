import { describe, expect, it } from "vitest";

import {
  isInvalidAuditDateRange,
  parseAuditDateInput,
} from "@/lib/audit-dates";
import { auditActionLabel, auditActionTone } from "@/lib/audit-labels";

describe("audit date input", () => {
  it("parses a Bangkok calendar day at the requested boundary", () => {
    const start = parseAuditDateInput("2026-10-23", "start");
    const end = parseAuditDateInput("2026-10-23", "end");

    expect(start?.toISOString()).toBe("2026-10-22T17:00:00.000Z");
    expect(end?.toISOString()).toBe("2026-10-23T16:59:59.999Z");
  });

  it("rejects malformed and impossible dates instead of returning Invalid Date", () => {
    expect(parseAuditDateInput("not-a-date", "start")).toBeNull();
    expect(parseAuditDateInput("2026-13-01", "start")).toBeNull();
    expect(parseAuditDateInput("2026-02-30", "start")).toBeNull();
    expect(parseAuditDateInput("2026-10-23T00:00:00Z", "start")).toBeNull();
  });

  it("reports an inverted range as invalid", () => {
    expect(isInvalidAuditDateRange("2026-10-24", "2026-10-23")).toBe(true);
    expect(isInvalidAuditDateRange("2026-10-23", "2026-10-23")).toBe(false);
    expect(isInvalidAuditDateRange(undefined, undefined)).toBe(false);
  });
});

describe("audit action labels", () => {
  it("translates the action codes written by auth and settings", () => {
    expect(auditActionLabel("AUTH_LOGIN_SUCCESS")).toBe("เข้าสู่ระบบสำเร็จ");
    expect(auditActionLabel("AUTH_LOGIN_BLOCKED")).toBe(
      "ระงับการเข้าสู่ระบบชั่วคราว",
    );
    expect(auditActionLabel("SETTINGS_UPDATED")).toBe("แก้ไขข้อมูลร้าน");
    expect(auditActionLabel("STOCK_ADJUSTED")).toBe("ปรับปรุงสต๊อก");
  });

  it("translates product, category and user actions", () => {
    expect(auditActionLabel("PRODUCT_BARCODE_PRIMARY_CHANGED")).toBe(
      "เปลี่ยนบาร์โค้ดหลัก",
    );
    expect(auditActionLabel("PRODUCTS_IMPORTED")).toBe("นำเข้าสินค้าจาก CSV");
    expect(auditActionLabel("CATEGORY_RESTORED")).toBe("กู้คืนหมวดหมู่");
    expect(auditActionLabel("USER_PASSWORD_RESET")).toBe(
      "รีเซตรหัสผ่านผู้ใช้",
    );
  });

  it("falls back to the raw code for unknown actions", () => {
    expect(auditActionLabel("FUTURE_ACTION")).toBe("FUTURE_ACTION");
  });

  it("assigns a destructive tone to void/archive actions", () => {
    expect(auditActionTone("BILL_VOIDED")).toContain("rose");
    expect(auditActionTone("PRODUCT_ARCHIVED")).toContain("rose");
    expect(auditActionTone("AUTH_LOGIN_SUCCESS")).toContain("violet");
  });
});
