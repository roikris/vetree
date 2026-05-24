export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function callImagen(prompt: string, aspectRatio: string, apiKey: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 2,
          aspectRatio,
          outputMimeType: 'image/jpeg'
        }
      })
    }
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Imagen API error (${aspectRatio}): ${errText}`)
  }

  const data = await response.json()
  return (data.predictions || []).map((p: any) => ({
    image_base64: p.bytesBase64Encoded,
    mime_type: p.mimeType || 'image/jpeg',
    aspect_ratio: aspectRatio
  }))
}

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
    const { post_text, abstract_text } = body

    if (!post_text && !abstract_text) {
      return NextResponse.json({ error: 'post_text or abstract_text required' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Image generation not configured' }, { status: 503 })
    }

    const content = abstract_text
      ? abstract_text.slice(0, 600)
      : post_text.slice(0, 400)

    const imagePrompt = `craft images that will pair well with the following professional oriented content on social media networks: ${content}`

    // Generate 2 images at each ratio in parallel
    const [landscape, portrait] = await Promise.all([
      callImagen(imagePrompt, '16:9', apiKey),
      callImagen(imagePrompt, '4:5', apiKey)
    ])

    const images = [...landscape, ...portrait]

    if (images.length === 0) {
      return NextResponse.json({ error: 'No images returned from API' }, { status: 500 })
    }

    return NextResponse.json({ images })

  } catch (error) {
    console.error('[generate-image] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate images', details: String(error) },
      { status: 500 }
    )
  }
}
