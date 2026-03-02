import { ImageResponse } from 'next/og'

export const alt = 'Vetree Article'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export async function generateStaticParams() {
  return []
}

export const dynamicParams = true
export const revalidate = 86400

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/articles?id=eq.${id}&select=title,clinical_bottom_line,source_journal`
    const response = await fetch(url, {
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      }
    })
    const data = await response.json()
    const article = data[0]

    return new ImageResponse(
      <div style={{ background: 'white', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 60, fontFamily: 'sans-serif' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 32, color: '#3D7A5F', fontWeight: 'bold' }}>🌿 Vetree</div>
          <div style={{ marginLeft: 12, fontSize: 16, color: '#888' }}>Evidence-based veterinary research, distilled.</div>
        </div>

        {/* Clinical Bottom Line */}
        <div style={{ background: '#f0f7f4', borderLeft: '6px solid #3D7A5F', borderRadius: 8, padding: 24, marginBottom: 32, fontSize: 22, color: '#2d5a45', lineHeight: 1.4 }}>
          {article?.clinical_bottom_line?.slice(0, 200) || ''}
        </div>

        {/* Title */}
        <div style={{ fontSize: 30, fontWeight: 'bold', color: '#111', lineHeight: 1.3, flex: 1 }}>
          {article?.title?.slice(0, 140) || ''}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E5E5E5', paddingTop: 20, marginTop: 20 }}>
          <div style={{ fontSize: 16, color: '#666' }}>{article?.source_journal || ''}</div>
          <div style={{ fontSize: 18, color: '#3D7A5F', fontWeight: 'bold' }}>vetree.app</div>
        </div>
      </div>,
      { width: 1200, height: 630 }
    )
  } catch (error) {
    return new ImageResponse(
      <div style={{ background: 'red', color: 'white', fontSize: 40, padding: 40, width: '100%', height: '100%', display: 'flex' }}>
        ERROR: {String(error)}
      </div>,
      { width: 1200, height: 630 }
    )
  }
}
