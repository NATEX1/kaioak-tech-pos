import { describe, expect, it } from "vitest";

import {
  CsvParseError,
  escapeCsvCell,
  parseCsv,
  toCsv,
} from "@/lib/csv";

describe("CSV parsing", () => {
  it("handles a BOM, CRLF, quoted commas, escaped quotes and newlines", () => {
    const parsed = parseCsv(
      '\uFEFFsku,name,notes\r\nA-1,"Widget, Pro","Line 1\nLine 2"\r\nA-2,Speaker,"He said ""hi"""\r\n',
    );

    expect(parsed.headers).toEqual(["sku", "name", "notes"]);
    expect(parsed.records).toEqual([
      { sku: "A-1", name: "Widget, Pro", notes: "Line 1\nLine 2" },
      { sku: "A-2", name: "Speaker", notes: 'He said "hi"' },
    ]);
  });

  it("rejects duplicate headers", () => {
    expect(() => parseCsv("sku,sku\nA,B")).toThrow(CsvParseError);
  });

  it("rejects rows with a different number of columns", () => {
    expect(() => parseCsv("sku,name\nA-1")).toThrow(
      "จำนวนคอลัมน์ในแถวที่ 2 ไม่ตรงกับหัวตาราง",
    );
  });

  it("rejects characters after a closing quote", () => {
    expect(() => parseCsv('sku\n"A"x')).toThrow(CsvParseError);
  });

  it("rejects an unterminated quoted field", () => {
    expect(() => parseCsv('sku\n"A')).toThrow(CsvParseError);
  });

  it("rejects an empty file", () => {
    expect(() => parseCsv(" \n ")).toThrow(CsvParseError);
  });
});

describe("CSV output", () => {
  it("quotes all cells and neutralizes spreadsheet formulas", () => {
    expect(escapeCsvCell("normal")).toBe('"normal"');
    expect(escapeCsvCell('a "quote"')).toBe('"a ""quote"""');
    expect(escapeCsvCell("=SUM(A1:A2)")).toBe("\"'=SUM(A1:A2)\"");
    expect(escapeCsvCell("+123")).toBe("\"'+123\"");
    expect(escapeCsvCell("@cmd")).toBe("\"'@cmd\"");
    expect(escapeCsvCell("-123.50")).toBe('"-123.50"');
    expect(escapeCsvCell("-SUM(A1:A2)")).toBe("\"'-SUM(A1:A2)\"");
  });

  it("writes a valid header and data rows", () => {
    const csv = toCsv(["sku", "name"], [["A-1", "Widget, Pro"]]);
    expect(csv).toBe('"sku","name"\r\n"A-1","Widget, Pro"');
  });
});
