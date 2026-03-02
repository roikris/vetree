import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Vetree Article'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Revalidate every 24 hours (86400 seconds)
export const revalidate = 86400

type Params = Promise<{ id: string }>

export default async function Image({ params }: { params: Params }) {
  try {
    const { id } = await params

    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    console.error('[OG Image] Starting generation for ID:', id)
    console.error('[OG Image] Env check - URL:', supabaseUrl ? 'OK' : 'MISSING')
    console.error('[OG Image] Env check - Key:', supabaseKey ? 'OK' : 'MISSING')

    // If env vars are missing, show debug image
    if (!supabaseUrl || !supabaseKey) {
      console.error('[OG Image] ERROR: Missing environment variables')
      return new ImageResponse(
        (
          <div style={{
            background: 'orange',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'sans-serif',
            padding: '40px',
          }}>
            <div style={{ fontSize: '48px', color: 'white', marginBottom: '20px' }}>⚠️ DEBUG</div>
            <div style={{ fontSize: '24px', color: 'white' }}>
              ENV: URL={supabaseUrl ? 'OK' : 'MISSING'} KEY={supabaseKey ? 'OK' : 'MISSING'}
            </div>
          </div>
        ),
        { ...size }
      )
    }

    const fetchUrl = `${supabaseUrl}/rest/v1/articles?id=eq.${id}&select=title,clinical_bottom_line,source_journal,strength_of_evidence`
    console.error('[OG Image] Fetching from:', fetchUrl)

    const response = await fetch(fetchUrl, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      }
    })

    console.error('[OG Image] Response status:', response.status)
    console.error('[OG Image] Response ok:', response.ok)

    const data = await response.json()
    console.error('[OG Image] Data received:', JSON.stringify(data).substring(0, 200))

    const article = data[0]

    if (!article) {
      console.error('[OG Image] No article found for ID:', id)
      return new ImageResponse(
        (
          <div style={{
            background: 'white',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'sans-serif',
          }}>
            <div style={{ fontSize: '48px', color: '#3D7A5F' }}>🌿 Vetree</div>
          </div>
        ),
        { ...size }
      )
    }

    console.error('[OG Image] Successfully loaded article:', article.title?.substring(0, 50))

    return new ImageResponse(
      (
        <div style={{
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '60px',
          fontFamily: 'system-ui, sans-serif',
        }}>
          {/* Vetree header */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
            <div style={{ fontSize: '28px', color: '#3D7A5F', fontWeight: 'bold' }}>🌿 Vetree</div>
            <div style={{ marginLeft: '12px', fontSize: '16px', color: '#888' }}>Evidence-based veterinary research, distilled.</div>
          </div>

          {/* Clinical Bottom Line */}
          {article.clinical_bottom_line && (
            <div style={{
              background: '#f0f7f4',
              border: '3px solid #3D7A5F',
              borderLeft: '8px solid #3D7A5F',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '32px',
              fontSize: '22px',
              color: '#2d5a45',
              lineHeight: 1.4,
              fontWeight: '500',
            }}>
              {article.clinical_bottom_line.length > 200
                ? article.clinical_bottom_line.slice(0, 200) + '...'
                : article.clinical_bottom_line}
            </div>
          )}

          {/* Title */}
          <div style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#111',
            lineHeight: 1.3,
            marginBottom: '24px',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
          }}>
            {article.title.length > 150
              ? article.title.slice(0, 150) + '...'
              : article.title}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #E5E5E5', paddingTop: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {article.source_journal && (
                <div style={{ fontSize: '16px', color: '#666', fontWeight: '500' }}>{article.source_journal}</div>
              )}
              {article.strength_of_evidence && (
                <div style={{ fontSize: '14px', color: '#888' }}>Evidence: {article.strength_of_evidence}</div>
              )}
            </div>
            <div style={{ fontSize: '20px', color: '#3D7A5F', fontWeight: 'bold' }}>vetree.app</div>
          </div>
        </div>
      ),
      { ...size }
    )
  } catch (error) {
    console.error('[OG Image] FATAL ERROR:', error)
    console.error('[OG Image] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return new ImageResponse(
      (
        <div style={{
          background: 'red',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '32px',
          padding: '40px',
          fontFamily: 'monospace',
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>❌ ERROR</div>
          <div style={{ fontSize: '24px', marginBottom: '20px' }}>OpenGraph Image Generation Failed</div>
          <div style={{ fontSize: '18px', textAlign: 'center', maxWidth: '900px', wordWrap: 'break-word' }}>
            {String(error)}
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  }
}
