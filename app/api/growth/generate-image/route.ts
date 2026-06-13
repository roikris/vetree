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
      ? abstract_text.slice(0, 1500)
      : post_text.slice(0, 400)

    const imagePrompt = `craft 3-4 images that will pair well with the following professional oriented content on social media networks. make one in normal ratio and one in a 4:5 ratio: ${content}`
    console.log('[generate-image] prompt length:', imagePrompt.length)

    // Initialize SDK inside function per CLAUDE.md
    const { GoogleGenAI } = await import('@google/genai')
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: imagePrompt,
    })

    console.log('[generate-image] candidates count:', response.candidates?.length)

    let imageBase64: string | null = null
    const parts = response.candidates?.[0]?.content?.parts || []
    for (const part of parts) {
      if ((part as any).inlineData) {
        imageBase64 = (part as any).inlineData.data
        break
      }
    }

    if (!imageBase64) {
      console.error('[generate-image] No image in response. Part keys:',
        parts.map((p: any) => Object.keys(p)))
      throw new Error('Gemini returned no image')
    }

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
