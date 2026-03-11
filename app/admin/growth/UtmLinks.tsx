'use client'

import { useState } from 'react'
import QRCode from 'qrcode'

type Platform = {
  name: string
  key: string
  emoji: string
}

const PLATFORMS: Platform[] = [
  { name: 'Facebook', key: 'facebook', emoji: '📘' },
  { name: 'WhatsApp', key: 'whatsapp', emoji: '💬' },
  { name: 'LinkedIn', key: 'linkedin', emoji: '💼' },
  { name: 'Twitter/X', key: 'twitter', emoji: '🐦' },
  { name: 'Instagram', key: 'instagram', emoji: '📸' },
  { name: 'Telegram', key: 'telegram', emoji: '✈️' },
  { name: 'Reddit', key: 'reddit', emoji: '🤖' }
]

export function UtmLinks() {
  const [campaign, setCampaign] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [qrPlatform, setQrPlatform] = useState<string | null>(null)

  const BASE_URL = 'https://vetree.app'

  const generateUtmLink = (platform: string) => {
    if (!campaign.trim()) return BASE_URL

    const params = new URLSearchParams({
      utm_source: platform,
      utm_medium: 'social',
      utm_campaign: campaign.trim()
    })

    return `${BASE_URL}/?${params.toString()}`
  }

  const togglePlatform = (platformKey: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformKey)
        ? prev.filter(p => p !== platformKey)
        : [...prev, platformKey]
    )
  }

  const copyLink = async (link: string, platformKey: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setCopiedLink(platformKey)
      setTimeout(() => setCopiedLink(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const copyAllLinks = async () => {
    const selectedLinks = PLATFORMS
      .filter(p => selectedPlatforms.includes(p.key))
      .map(p => `${p.name}: ${generateUtmLink(p.key)}`)
      .join('\n\n')

    try {
      await navigator.clipboard.writeText(selectedLinks)
      setCopiedLink('all')
      setTimeout(() => setCopiedLink(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const generateQR = async (link: string, platformKey: string) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(link, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      setQrCode(qrDataUrl)
      setQrPlatform(platformKey)
    } catch (error) {
      console.error('Failed to generate QR code:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-2">
          🔗 UTM Link Generator
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Generate trackable links for social media campaigns
        </p>
      </div>

      {/* Campaign Name Input */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
          Campaign Name
        </label>
        <input
          type="text"
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
          placeholder="e.g., march_launch, spring_promo, webinar_2024"
          className="w-full px-4 py-2 bg-white dark:bg-[#0F0F0F] border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#3D7A5F] dark:focus:ring-[#4E9A78]"
        />
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Use lowercase with underscores (e.g., march_launch). This will be used as utm_campaign parameter.
        </p>
      </div>

      {/* Platform Selection */}
      <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">
          Select Platforms
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {PLATFORMS.map((platform) => (
            <button
              key={platform.key}
              onClick={() => togglePlatform(platform.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                selectedPlatforms.includes(platform.key)
                  ? 'border-[#3D7A5F] dark:border-[#4E9A78] bg-[#3D7A5F]/10 dark:bg-[#4E9A78]/10 text-[#3D7A5F] dark:text-[#4E9A78]'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600'
              }`}
            >
              <span className="text-xl">{platform.emoji}</span>
              <span className="text-sm font-medium">{platform.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Generated Links */}
      {selectedPlatforms.length > 0 && campaign.trim() && (
        <div className="bg-white dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Generated Links
            </h3>
            <button
              onClick={copyAllLinks}
              className="px-4 py-2 bg-[#3D7A5F] dark:bg-[#4E9A78] text-white rounded-lg text-sm font-medium hover:bg-[#2F6349] dark:hover:bg-[#3D7A5F] transition-colors"
            >
              {copiedLink === 'all' ? '✓ Copied All' : 'Copy All Links'}
            </button>
          </div>

          <div className="space-y-3">
            {PLATFORMS
              .filter(p => selectedPlatforms.includes(p.key))
              .map((platform) => {
                const link = generateUtmLink(platform.key)
                return (
                  <div
                    key={platform.key}
                    className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg"
                  >
                    <span className="text-2xl">{platform.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                        {platform.name}
                      </div>
                      <div className="text-sm text-zinc-900 dark:text-zinc-100 font-mono truncate">
                        {link}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyLink(link, platform.key)}
                        className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded text-xs font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                      >
                        {copiedLink === platform.key ? '✓ Copied' : 'Copy'}
                      </button>
                      {platform.key === 'whatsapp' && (
                        <button
                          onClick={() => generateQR(link, platform.key)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors"
                        >
                          QR Code
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrCode && qrPlatform && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setQrCode(null)}>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-lg p-6 max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                WhatsApp QR Code
              </h3>
              <button
                onClick={() => setQrCode(null)}
                className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                ✕
              </button>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <img src={qrCode} alt="QR Code" className="w-full" />
            </div>
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400 text-center">
              Scan this code to visit vetree.app with tracking
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!campaign.trim() || selectedPlatforms.length === 0) && (
        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            {!campaign.trim()
              ? '👆 Enter a campaign name to get started'
              : '👆 Select at least one platform to generate links'}
          </p>
        </div>
      )}
    </div>
  )
}
