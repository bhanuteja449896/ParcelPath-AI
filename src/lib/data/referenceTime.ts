/**
 * Reference time reader (ARCHITECTURE.md D8).
 * `system_metadata.value` is jsonb; the ingest script stores
 * `{ iso: string, original: string }`. Older code assumed a plain string,
 * which broke every time-based heuristic. Handles both shapes defensively.
 */
export function extractReferenceTime(raw: unknown): Date {
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    const iso =
      typeof obj === "object" && obj !== null && "iso" in obj
        ? (obj as { iso: unknown }).iso
        : obj;
    const d = new Date(String(iso));
    if (!Number.isNaN(d.getTime())) return d;
  } catch {
    /* fall through */
  }
  return new Date();
}
