'use client'

import { SynthesisPanel } from '@/components/synthesis/SynthesisPanel'

export function SynthesisPanelClient({ query }: { query: string }) {
  return <SynthesisPanel query={query} />
}
