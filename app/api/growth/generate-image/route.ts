export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Admin auth check
    const serverClient = await createClient()
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: role } = await serverClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (role?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { post_text, platform, article_id, abstract_text } = body

    if (!post_text && !abstract_text) {
      return NextResponse.json({ error: 'post_text or abstract_text required' }, { status: 400 })
    }

    const isSquare = platform === 'instagram'
    const aspectRatio = isSquare ? '1:1' : '16:9'
    const formatNote = isSquare ? 'Square 1:1 format.' : 'Landscape 16:9 format.'

    const imagePrompt = abstract_text
      ? `Professional veterinary medical image for a social media post. Style: clean, clinical, photorealistic. No text overlays. ${formatNote} Suitable for ${platform}. Based on this veterinary research: ${abstract_text.slice(0, 500)}`
      : `Professional veterinary medical image to go with this post. Style: clean, clinical, photorealistic. No text overlays. ${formatNote} Post content: ${post_text.slice(0, 400)}`

    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Image generation not configured' }, { status: 503 })
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: imagePrompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio,
            outputMimeType: 'image/jpeg'
          }
        })
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      console.error('[generate-image] Gemini error:', errText)
      return NextResponse.json(
        { error: 'Image generation failed', details: errText },
        { status: 500 }
      )
    }

    const data = await response.json()
    const prediction = data.predictions?.[0]

    if (!prediction?.bytesBase64Encoded) {
      return NextResponse.json({ error: 'No image returned from API' }, { status: 500 })
    }

    return NextResponse.json({
      image_base64: prediction.bytesBase64Encoded,
      mime_type: prediction.mimeType || 'image/jpeg',
      aspect_ratio: aspectRatio
    })

  } catch (error) {
    console.error('[generate-image] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate image', details: String(error) },
      { status: 500 }
    )
  }
}
