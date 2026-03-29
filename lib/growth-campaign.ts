// Growth Campaign Configuration
// 90-day social media campaign with rotating platforms

export const CAMPAIGN_START_DATE = new Date('2026-03-10').getTime() // Configurable start date
export const CAMPAIGN_TOTAL_DAYS = 90

// 9-day platform rotation cycle
export const PLATFORM_ROTATION = [
  { platform: 'facebook_il', language: 'he', icon: '📘', name: 'Facebook IL' },
  { platform: 'whatsapp', language: 'he', icon: '💬', name: 'WhatsApp' },
  { platform: 'reddit', language: 'en', icon: '🤖', name: 'Reddit' },
  { platform: 'linkedin', language: 'en', icon: '💼', name: 'LinkedIn' },
  { platform: 'facebook_intl', language: 'en', icon: '📘', name: 'Facebook Intl' },
  { platform: 'twitter', language: 'en', icon: '🐦', name: 'Twitter/X' },
  { platform: 'instagram', language: 'en', icon: '📸', name: 'Instagram' },
  { platform: 'telegram', language: 'en', icon: '✈️', name: 'Telegram' },
  { platform: 'tiktok', language: 'en', icon: '🎵', name: 'TikTok' },
  { platform: 'threads', language: 'en', icon: '🧵', name: 'Threads' }
]

// Calculate which day of the campaign we're on (1-90)
export function getCurrentCampaignDay(): number {
  const now = Date.now()
  const daysSinceStart = Math.ceil((now - CAMPAIGN_START_DATE) / (1000 * 60 * 60 * 24))
  return Math.max(1, Math.min(daysSinceStart, CAMPAIGN_TOTAL_DAYS))
}

// Get platform for a specific day number
export function getPlatformForDay(dayNumber: number) {
  const index = (dayNumber - 1) % PLATFORM_ROTATION.length
  return PLATFORM_ROTATION[index]
}

// Get today's platform
export function getTodaysPlatform() {
  return getPlatformForDay(getCurrentCampaignDay())
}

// Get this week's schedule (today + next 6 days)
export function getWeekSchedule() {
  const currentDay = getCurrentCampaignDay()
  const schedule = []

  for (let i = 0; i < 7; i++) {
    const dayNumber = currentDay + i
    if (dayNumber <= CAMPAIGN_TOTAL_DAYS) {
      schedule.push({
        dayNumber,
        date: new Date(CAMPAIGN_START_DATE + (dayNumber - 1) * 24 * 60 * 60 * 1000),
        ...getPlatformForDay(dayNumber),
        isToday: i === 0
      })
    }
  }

  return schedule
}
