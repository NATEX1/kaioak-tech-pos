import { describe, expect, it } from "vitest";

import {
  isValidBarcode,
  isValidEan13,
  normalizeSerialNumber,
  splitSerialNumbers,
} from "@/lib/barcode";

describe("barcode validation", () => {
  it("accepts a valid EAN-13 and rejects a bad checksum", () => {
    expect(isValidEan13("4006381333931")).toBe(true);
    expect(isValidEan13("4006381333932")).toBe(false);
    expect(isValidEan13("400638133393")).toBe(false);
    expect(isValidEan13("40063813339X1")).toBe(false);
  });

  it("validates Code 128 as printable ASCII within the limit", () => {
    expect(isValidBarcode("8851000010001", "CODE128")).toBe(true);
    expect(isValidBarcode("ABC-123_xyz", "CODE128")).toBe(true);
    expect(isValidBarcode("ABC\n123", "CODE128")).toBe(false);
    expect(isValidBarcode("สินค้า", "CODE128")).toBe(false);
    expect(isValidBarcode("A".repeat(65), "CODE128")).toBe(false);
    expect(isValidBarcode("", "CODE128")).toBe(false);
  });

  it("splits scanned serial numbers from newline or comma separated text", () => {
    expect(splitSerialNumbers(" SN-1 \nSN-2, SN-3\n\n")).toEqual([
      "SN-1",
      "SN-2",
      "SN-3",
    ]);
    expect(normalizeSerialNumber("  SN-1  ")).toBe("SN-1");
  });
});
