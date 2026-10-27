export class CsvParseError extends Error {
  constructor(
    message: string,
    public readonly line: number,
  ) {
    super(message);
    this.name = "CsvParseError";
  }
}

export type CsvRecord = Record<string, string>;

/**
 * A strict, dependency-free RFC 4180-style parser for the small inventory
 * import files used by the shop. Quoted fields may contain commas and newlines.
 */
export function parseCsv(text: string): {
  headers: string[];
  records: CsvRecord[];
} {
  const input = text.replace(/^\uFEFF/, "");

  if (!input.trim()) {
    throw new CsvParseError("ไฟล์ CSV ว่างเปล่า", 1);
  }

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let afterQuote = false;
  let quotedField = false;
  let line = 1;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (inQuotes) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else {
        field += character;
        if (character === "\n") {
          line += 1;
        }
      }
      continue;
    }

    if (afterQuote) {
      if (character === ",") {
        row.push(field);
        field = "";
        quotedField = false;
        afterQuote = false;
        continue;
      }

      if (character === "\r" || character === "\n") {
        if (character === "\r" && input[index + 1] === "\n") {
          index += 1;
        }

        row.push(field);
        if (row.length > 1 || row[0] !== "") {
          rows.push(row);
        }
        field = "";
        row = [];
        quotedField = false;
        afterQuote = false;
        line += 1;
        continue;
      }

      throw new CsvParseError(
        "พบอักขระต่อจากเครื่องหมายคำพูดปิดใน CSV",
        line,
      );
    }

    if (character === '"') {
      if (field !== "") {
        throw new CsvParseError("รูปแบบเครื่องหมายคำพูดใน CSV ไม่ถูกต้อง", line);
      }
      inQuotes = true;
      quotedField = true;
      continue;
    }

    if (character === ",") {
      row.push(field);
      field = "";
      quotedField = false;
      continue;
    }

    if (character === "\r" || character === "\n") {
      if (character === "\r" && input[index + 1] === "\n") {
        index += 1;
      }

      row.push(field);
      if (row.length > 1 || row[0] !== "") {
        rows.push(row);
      }
      field = "";
      row = [];
      quotedField = false;
      line += 1;
      continue;
    }

    field += character;
  }

  if (inQuotes) {
    throw new CsvParseError("พบเครื่องหมายคำพูดที่ยังไม่ปิดใน CSV", line);
  }

  if (field !== "" || row.length > 0 || quotedField) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    throw new CsvParseError("ไม่พบข้อมูลในไฟล์ CSV", 1);
  }

  const rawHeaders = rows[0].map((header) => header.trim());
  const headers = rawHeaders.map((header) => header.toLowerCase());

  if (headers.some((header) => !header)) {
    throw new CsvParseError("หัวคอลัมน์ CSV ต้องไม่ว่าง", 1);
  }

  if (new Set(headers).size !== headers.length) {
    throw new CsvParseError("หัวคอลัมน์ CSV ซ้ำกัน", 1);
  }

  const records = rows.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new CsvParseError(
        `จำนวนคอลัมน์ในแถวที่ ${rowIndex + 2} ไม่ตรงกับหัวตาราง`,
        rowIndex + 2,
      );
    }

    return Object.fromEntries(
      headers.map((header, columnIndex) => [header, values[columnIndex] ?? ""]),
    );
  });

  return { headers, records };
}

/**
 * Prefixes spreadsheet formula triggers so exported text cannot run as a
 * formula when the CSV is opened in Excel or Sheets. Plain negative numbers
 * (for example commission reversals) stay numeric so totals remain usable.
 */
export function escapeCsvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);

  if (/^[=+@\t\r]/.test(text) || (text.startsWith("-") && !/^-\d+(?:\.\d+)?$/.test(text))) {
    text = `'${text}`;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  return [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ].join("\r\n");
}
