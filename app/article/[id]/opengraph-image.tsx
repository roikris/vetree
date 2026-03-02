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
        <div style={{ fontSize: 24, color: '#3D7A5F', marginBottom: 20 }}>🌿 Vetree</div>
        <div style={{ fontSize: 20, color: '#333', background: '#f0f7f4', padding: 20, borderRadius: 8, marginBottom: 20 }}>
          {article?.clinical_bottom_line?.slice(0, 200) || 'No clinical bottom line - ID: ' + id}
        </div>
        <div style={{ fontSize: 28, fontWeight: 'bold', color: '#111' }}>
          {article?.title?.slice(0, 120) || 'No title found'}
        </div>
        <div style={{ marginTop: 'auto', fontSize: 16, color: '#888' }}>vetree.app</div>
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
