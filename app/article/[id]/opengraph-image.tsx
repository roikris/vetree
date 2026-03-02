import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Vetree Article'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Pre-build OG images for 100 newest articles at deploy time
export async function generateStaticParams() {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/articles?select=id&order=publication_date.desc&limit=100`,
    {
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      }
    }
  )

  const data = await response.json()
  return (data || []).map((article: { id: string }) => ({ id: article.id }))
}

// Allow on-demand generation for articles not in top 100
export const dynamicParams = true

// Revalidate every 24 hours (86400 seconds)
export const revalidate = 86400

type Params = Promise<{ id: string }>

export default async function Image({ params }: { params: Params }) {
  const { id } = await params

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/articles?id=eq.${id}&select=title,clinical_bottom_line,source_journal,strength_of_evidence`,
    {
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      }
    }
  )

  const data = await response.json()
  const article = data[0]

  if (!article) {
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
}
