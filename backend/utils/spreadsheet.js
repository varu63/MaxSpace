/* ============================================================
   TABULAR PARSER (CSV + XLSX) — ZERO DEPENDENCIES
   Compliance import accepts a spreadsheet, not hand-typed JSON, so
   this module turns an uploaded CSV or Excel workbook into a header
   row plus an array of row objects. It is deliberately dependency
   free: the project keeps a minimal server dependency set, and
   Node's built-in zlib is enough to read an .xlsx (a ZIP of XML).

   Supported:
     • CSV / TSV  — RFC 4180 quoted fields, embedded commas, escaped
       quotes (""), CRLF or LF, optional UTF-8 BOM.
     • XLSX       — the first worksheet of a standard .xlsx package,
       with shared strings or inline strings. Stored (method 0) and
       deflated (method 8) zip entries are both read.

   Deliberately unsupported (and reported as a clear error rather than
   silently mis-parsed): password-protected workbooks, .xls (the old
   binary format) and macros.
   ============================================================ */

import zlib from "node:zlib";

/* ---------- CSV ---------- */

const detectDelimiter = (sample) => {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = 0;
  for (const candidate of candidates) {
    // Count only delimiters outside quotes.
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < sample.length; i += 1) {
      const ch = sample[i];
      if (ch === '"') {
        if (inQuotes && sample[i + 1] === '"') { i += 1; continue; }
        inQuotes = !inQuotes;
      } else if (!inQuotes && ch === candidate) {
        count += 1;
      }
    }
    if (count > bestCount) { best = candidate; bestCount = count; }
  }
  return best;
};

/* Parse delimited text into an array of raw string rows. */
export const parseDelimitedText = (input) => {
  const text = String(input ?? "").replace(/^\uFEFF/, "");
  if (!text.trim()) return [];

  const delimiter = detectDelimiter(text.slice(0, 8000));
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }

    if (ch === delimiter) { row.push(field); field = ""; continue; }

    if (ch === "\r") { if (text[i + 1] === "\n") i += 1; row.push(field); rows.push(row); row = []; field = ""; continue; }

    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }

    field += ch;
  }

  row.push(field);
  rows.push(row);

  // Drop fully empty trailing rows produced by a final newline.
  while (rows.length && rows[rows.length - 1].every((cell) => String(cell).trim() === "")) {
    rows.pop();
  }
  return rows;
};

/* ---------- Minimal ZIP reader ---------- */

const EOCD_SIGNATURE = 0x06054b50;
const CD_SIGNATURE = 0x02014b50;
const LFH_SIGNATURE = 0x04034b50;

/* Locate the End Of Central Directory record (it may sit behind a
   trailing comment, so scan backwards). */
const findEocd = (buffer) => {
  const minStart = Math.max(0, buffer.length - 0xffff - 22);
  for (let i = buffer.length - 22; i >= minStart; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  return -1;
};

/* Return { name, method, compressedSize, localHeaderOffset } per entry. */
const readZipCentralDirectory = (buffer) => {
  const eocd = findEocd(buffer);
  if (eocd === -1) throw new Error("Not a valid .xlsx file (no ZIP directory found).");
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();

  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(offset) !== CD_SIGNATURE) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    entries.set(name, { name, method, compressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
};

const readZipEntryData = (buffer, entry) => {
  const start = entry.localHeaderOffset;
  if (buffer.readUInt32LE(start) !== LFH_SIGNATURE) {
    throw new Error(`Corrupt .xlsx package (bad local header for ${entry.name}).`);
  }
  const nameLength = buffer.readUInt16LE(start + 26);
  const extraLength = buffer.readUInt16LE(start + 28);
  const dataStart = start + 30 + nameLength + extraLength;
  const raw = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(raw);
  if (entry.method === 8) return zlib.inflateRawSync(raw);
  throw new Error(`Unsupported .xlsx compression method ${entry.method}.`);
};

/* ---------- Minimal XML helpers ---------- */

const decodeXmlEntities = (value) =>
  String(value ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, "&");

const parseSharedStrings = (xml) => {
  if (!xml) return [];
  const strings = [];
  // Each <si> may hold plain text or several <r><t> runs.
  const siPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match;
  while ((match = siPattern.exec(xml)) !== null) {
    const inner = match[1];
    const texts = [];
    const tPattern = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tMatch;
    while ((tMatch = tPattern.exec(inner)) !== null) texts.push(decodeXmlEntities(tMatch[1]));
    strings.push(texts.join(""));
  }
  return strings;
};

/* Column letters "A" -> 0, "AB" -> 27. */
const columnIndexFromRef = (ref) => {
  const letters = String(ref || "").match(/^[A-Z]+/);
  if (!letters) return null;
  let index = 0;
  for (const ch of letters[0]) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
};

const parseSheetXml = (xml, sharedStrings) => {
  const rows = [];
  const rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowPattern.exec(xml)) !== null) {
    const rowXml = rowMatch[1];
    const cells = [];
    const cellPattern = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch;
    while ((cellMatch = cellPattern.exec(rowXml)) !== null) {
      const attrs = cellMatch[1] || "";
      const body = cellMatch[2] || "";
      const refMatch = /r="([A-Z]+\d+)"/.exec(attrs);
      const target = columnIndexFromRef(refMatch ? refMatch[1] : null);
      const index = target === null ? cells.length : target;
      const typeMatch = /t="([^"]+)"/.exec(attrs);
      const type = typeMatch ? typeMatch[1] : "n";

      let value = "";
      if (type === "inlineStr") {
        const texts = [];
        const tPattern = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
        let tMatch;
        while ((tMatch = tPattern.exec(body)) !== null) texts.push(decodeXmlEntities(tMatch[1]));
        value = texts.join("");
      } else {
        const vMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body);
        const raw = vMatch ? decodeXmlEntities(vMatch[1]) : "";
        if (type === "s") {
          const sharedIndex = Number(raw);
          value = Number.isInteger(sharedIndex) && sharedStrings[sharedIndex] !== undefined
            ? sharedStrings[sharedIndex]
            : "";
        } else {
          value = raw;
        }
      }
      cells[index] = value;
    }
    for (let i = 0; i < cells.length; i += 1) if (cells[i] === undefined) cells[i] = "";
    rows.push(cells);
  }
  return rows;
};

/* Parse the first worksheet of an .xlsx buffer into raw rows. */
export const parseXlsxBuffer = (buffer) => {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error("Not a valid .xlsx file. Save the workbook as .xlsx (Excel 2007+) or upload CSV.");
  }
  const entries = readZipCentralDirectory(buf);

  const sharedEntry = entries.get("xl/sharedStrings.xml");
  const sharedStrings = sharedEntry
    ? parseSharedStrings(readZipEntryData(buf, sharedEntry).toString("utf8"))
    : [];

  const sheetName = Array.from(entries.keys())
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort()[0];
  if (!sheetName) {
    throw new Error("This .xlsx contains no worksheet. Upload a workbook with a single sheet of compliance rows.");
  }

  const sheetXml = readZipEntryData(buf, entries.get(sheetName)).toString("utf8");
  const rows = parseSheetXml(sheetXml, sharedStrings);
  while (rows.length && rows[rows.length - 1].every((cell) => String(cell).trim() === "")) rows.pop();
  return rows;
};

/* ---------- Unified entry point ---------- */

export const isXlsxBuffer = (buffer) => {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
};

/* Turn raw rows into { headers, rows } where each row is an object
   keyed by the normalized (snake_case, lower) header name. The original
   header text is kept in `headerMap` so error messages can quote the
   exact column name the admin sees in their spreadsheet. */
export const rowsToObjects = (rawRows) => {
  if (!Array.isArray(rawRows) || !rawRows.length) return { headers: [], headerMap: {}, rows: [] };

  const headerRow = rawRows[0].map((cell) => String(cell ?? "").trim());
  const headerMap = {};
  const headers = [];
  headerRow.forEach((label, index) => {
    const key = normalizeHeaderKey(label);
    if (!key) return;
    // First occurrence wins; a duplicated column is reported by the
    // validator rather than silently shadowing an earlier value.
    if (headers.includes(key)) return;
    headers.push(key);
    headerMap[key] = { label: label || key, index };
  });

  const rows = rawRows.slice(1).map((cells, rowOffset) => {
    const obj = {};
    let empty = true;
    for (const [key, meta] of Object.entries(headerMap)) {
      const raw = cells[meta.index];
      const value = raw === undefined || raw === null ? "" : String(raw).trim();
      obj[key] = value;
      if (value !== "") empty = false;
    }
    return { __rowNumber: rowOffset + 2, __empty: empty, values: obj };
  });

  return { headers, headerMap, rows };
};

export const normalizeHeaderKey = (label) =>
  String(label ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-.]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

/* Parse a Buffer (CSV text or .xlsx bytes) into { headers, headerMap, rows }. */
export const parseSpreadsheetBuffer = (buffer) => {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || "");
  if (!buf.length) throw new Error("The uploaded file is empty.");
  const rawRows = isXlsxBuffer(buf)
    ? parseXlsxBuffer(buf)
    : parseDelimitedText(buf.toString("utf8"));
  if (!rawRows.length) {
    throw new Error("No rows found. The first row must contain the column headers.");
  }
  return rowsToObjects(rawRows);
};
