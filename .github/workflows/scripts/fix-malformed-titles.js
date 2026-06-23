/**
 * fix-malformed-titles.js
 *
 * Cleans article titles that were stored as PubMed JSON structures instead of plain text.
 * PubMed encodes italic text (e.g. species names like Candidatus, Culicoides) as:
 *   {"_": "text with  gaps", "i": ["ItalicWord1", "ItalicWord2"]}
 *
 * Reconstruction rules:
 *   - Leading space → italic word belongs at the start
 *   - Double-space "  " → next italic word fills the gap
 *   - Empty parens "()" → next italic word goes inside
 *
 * Run: node fix-malformed-titles.js
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars (or hardcoded below)
 */

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gnykidzijppxvrvvchxq.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

function reconstructTitle(raw) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed._ !== 'string') return null

  let text = parsed._
  const italics = Array.isArray(parsed.i) ? parsed.i : (parsed.i ? [parsed.i] : [])
  if (italics.length === 0) return text.trim()

  let idx = 0

  // Leading space: italic word belongs at start of title
  if (text.startsWith(' ') && idx < italics.length) {
    text = italics[idx++] + text
  }

  // Double-space placeholders (most common pattern)
  while (text.includes('  ') && idx < italics.length) {
    text = text.replace('  ', ' ' + italics[idx++] + ' ')
  }

  // Empty parens () — italic word was inside parentheses
  while (text.includes('()') && idx < italics.length) {
    text = text.replace('()', '(' + italics[idx++] + ')')
  }

  return text.replace(/ {2,}/g, ' ').trim()
}

async function main() {
  let fixed = 0, errors = 0, page = 0
  const pageSize = 500

  while (true) {
    const { data, error } = await supabase
      .from('articles')
      .select('id, title')
      .like('title', '{"_":%')
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) { console.error('Fetch error:', error); process.exit(1) }
    if (!data || data.length === 0) break

    console.log(`Processing batch: ${data.length} articles...`)

    for (const article of data) {
      const cleaned = reconstructTitle(article.title)
      if (!cleaned) continue

      const { error: updateError } = await supabase
        .from('articles')
        .update({ title: cleaned })
        .eq('id', article.id)

      if (updateError) {
        console.error(`  Error updating ${article.id}:`, updateError.message)
        errors++
      } else {
        fixed++
      }
    }

    if (data.length < pageSize) break
    page++
  }

  // Re-run until none remain (offset shifts as rows are fixed)
  if (fixed > 0) {
    console.log(`Fixed ${fixed} titles. Re-checking for remainder...`)
    fixed = 0
    page = 0
    while (true) {
      const { data } = await supabase
        .from('articles')
        .select('id, title')
        .like('title', '{"_":%')
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (!data || data.length === 0) break

      for (const article of data) {
        const cleaned = reconstructTitle(article.title)
        if (!cleaned) continue
        await supabase.from('articles').update({ title: cleaned }).eq('id', article.id)
        fixed++
      }
      if (data.length < pageSize) break
      page++
    }
    if (fixed > 0) console.log(`Fixed ${fixed} additional titles.`)
  }

  if (errors > 0) {
    console.error(`Completed with ${errors} errors`)
    process.exit(1)
  }

  console.log('Done. No malformed titles remaining.')
}

main()
