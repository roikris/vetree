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
    const { post_text, abstract_text } = body

    if (!post_text && !abstract_text) {
      return NextResponse.json({ error: 'post_text or abstract_text required' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY
    console.log('[generate-image] GOOGLE_AI_API_KEY present:', !!apiKey, 'prefix:', apiKey?.slice(0, 6))
    if (!apiKey) {
      return NextResponse.json({ error: 'Image generation not configured' }, { status: 503 })
    }

    const content = abstract_text
      ? abstract_text.slice(0, 600)
      : post_text.slice(0, 400)

    const imagePrompt = `craft images that will pair well with the following professional oriented content on social media networks: ${content}`
    console.log('[generate-image] prompt length:', imagePrompt.length)

    // Initialize SDK inside function per CLAUDE.md
    const { GoogleGenAI } = await import('@google/genai')
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })

    const response = await ai.models.generateImages({
      model: 'gemini-3-pro-image',
      prompt: imagePrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    })

    console.log('[generate-image] generatedImages count:', response.generatedImages?.length)

    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes
    if (!imageBytes) {
      console.error('[generate-image] No imageBytes in response:', JSON.stringify(response).slice(0, 500))
      throw new Error('Gemini returned no image')
    }

    const imageBase64 = Buffer.from(imageBytes).toString('base64')

    return NextResponse.json({
      image: `data:image/jpeg;base64,${imageBase64}`
    })

  } catch (error: any) {
    console.error('[generate-image] Error:', error)
    console.error('[generate-image] Error name:', error?.name)
    console.error('[generate-image] Error message:', error?.message)
    console.error('[generate-image] Error stack:', error?.stack)
    return NextResponse.json(
      { error: 'Failed to generate images', details: String(error), message: error?.message },
      { status: 500 }
    )
  }
}
