// deno-lint-ignore-file no-explicit-any
export function parseDurationToMinutes(input?: string | null): number | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  const m = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hrs = Number(m[1]);
  const mins = Number(m[2]);
  if (!Number.isFinite(hrs) || !Number.isFinite(mins)) return null;
  return hrs * 60 + mins;
}

// Minimal CSV parser that supports quoted fields
export function parseCsv(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Strip BOM — handles both proper \uFEFF and mis-decoded "ï»¿"
  const text = csvText.replace(/^\uFEFF/, "").replace(/^ï»¿/, "");

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (c === '"') {
      const next = text[i + 1];
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && c === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (c === "\n" || c === "\r")) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      // ignore totally empty last line
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    field += c;
  }

  // last field
  row.push(field);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

export function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

export function pick(row: string[], idx: number) {
  return (row[idx] ?? "").trim();
}
