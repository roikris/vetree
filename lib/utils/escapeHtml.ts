// Escape text for HTML element content and quoted attribute values (emails, server-built HTML).
// Every value that isn't a fixed literal goes through this — article titles from PubMed and AI
// summaries can contain <, >, & ("p < 0.05", gene names), and tags come from user follows.
const MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, c => MAP[c])
}
