/**
 * URL base do projeto Supabase (só origem, sem /rest/v1 nem outros caminhos).
 * Se colares o endpoint REST completo, o cliente gera "Invalid path specified in request URL".
 */
export function normalizeSupabaseUrl(raw) {
  if (raw == null || typeof raw !== "string") return "";
  let u = raw.trim().replace(/^["']|["']$/g, "");
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    return parsed.origin;
  } catch {
    return u.replace(/\/+$/, "");
  }
}
