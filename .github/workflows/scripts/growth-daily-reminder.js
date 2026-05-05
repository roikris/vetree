const { createClient } = require('@supabase/supabase-js')
const ws = require('ws')

const PLATFORM_EMOJIS = {
  facebook_il: '📘',
  facebook_intl: '📘',
  whatsapp: '💬',
  reddit: '🤖',
  linkedin: '💼',
  twitter: '🐦',
  instagram: '📸',
  telegram: '✈️',
  kol: '🌟'
}

const PLATFORM_NAMES = {
  facebook_il: 'Facebook IL',
  facebook_intl: 'Facebook International',
  whatsapp: 'WhatsApp',
  reddit: 'Reddit',
  linkedin: 'LinkedIn',
  twitter: 'Twitter',
  instagram: 'Instagram',
  telegram: 'Telegram',
  kol: 'KOL Outreach'
}

async function sendDailyReminder() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL

  if (!supabaseUrl || !supabaseKey || !slackWebhookUrl) {
    console.error('Missing required environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    realtime: {
      transport: ws,
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  })

  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0]

    // Fetch today's growth tasks
    const { data: todaysTasks, error: tasksError } = await supabase
      .from('growth_tasks')
      .select('*')
      .eq('scheduled_date', today)
      .order('day_number', { ascending: true })

    if (tasksError) {
      throw new Error(`Error fetching tasks: ${tasksError.message}`)
    }

    // Get stats
    const { data: statsData, error: statsError } = await supabase
      .from('growth_tasks')
      .select('status, completed_at, day_number')

    if (statsError) {
      throw new Error(`Error fetching stats: ${statsError.message}`)
    }

    // Calculate stats
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const completedThisWeek = statsData.filter(
      t => t.status === 'done' &&
      t.completed_at &&
      new Date(t.completed_at) >= oneWeekAgo
    ).length

    const totalDone = statsData.filter(t => t.status === 'done').length
    const currentDay = todaysTasks.length > 0 ? todaysTasks[0].day_number : 1

    // Build Slack message
    let message = `🌿 *Vetree Growth — Day ${currentDay}/90*\n━━━━━━━━━━━━━━━\n`

    if (todaysTasks.length === 0) {
      message += '*No tasks scheduled for today!* 🎉\n'
    } else {
      const task = todaysTasks[0]
      const emoji = PLATFORM_EMOJIS[task.platform] || '📱'
      const platformName = PLATFORM_NAMES[task.platform] || task.platform
      const flag = task.language === 'he' ? '🇮🇱' : '🇺🇸'
      const status = task.status === 'done' ? '✅ Done' : task.status === 'pending' ? '⏳ Pending' : '⏭️ Skipped'

      message += `📅 *Today's post:* ${emoji} ${platformName} ${flag}\n`
      message += `Status: ${status}\n\n`

      if (task.status === 'pending') {
        message += `Go to <https://vetree.app/admin/growth|vetree.app/admin/growth> to generate and approve today's post 🌿\n\n`
      }
    }

    message += `━━━━━━━━━━━━━━━\n`
    message += `📊 Week progress: ${completedThisWeek}/7 done\n`
    message += `🎯 Total: ${totalDone}/90 completed`

    // Send to Slack
    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: message,
        mrkdwn: true
      })
    })

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.statusText}`)
    }

    console.log('✅ Daily reminder sent successfully!')
    console.log(`📅 Day ${currentDay}/90`)
    console.log(`📋 Tasks today: ${todaysTasks.length}`)
    console.log(`✅ Week progress: ${completedThisWeek}/7`)
    console.log(`🎯 Total progress: ${totalDone}/90`)

  } catch (error) {
    console.error('❌ Error sending daily reminder:', error)
    process.exit(1)
  }
}

sendDailyReminder()
