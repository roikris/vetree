# Growth OS Setup Guide

## Overview
The Growth OS is a 90-day growth campaign management system for Vetree that helps track daily marketing tasks across multiple platforms.

## Database Setup

### 1. Run the Migration

In Supabase SQL Editor, run the migration file:

```bash
# Copy the contents of:
supabase/migrations/010_create_growth_tasks.sql
```

Or if using Supabase CLI:
```bash
supabase migration up
```

### 2. Seed the Database

Run the seed script to populate 90 days of tasks:

```bash
# Copy the contents of:
supabase/seeds/growth_tasks_seed.sql
```

This will create tasks starting from today with a 9-day rotation:
- Day 1: Facebook IL
- Day 2: WhatsApp
- Day 3: Reddit
- Day 4: LinkedIn (Personal)
- Day 5: Facebook International
- Day 6: Twitter
- Day 7: Instagram
- Day 8: Telegram
- Day 9: KOL Outreach

## Features

### Admin Dashboard (`/admin/growth`)

1. **Stats Header**
   - Campaign progress (Day X/90)
   - Tasks completed this week
   - Total tasks done
   - Platforms covered this week

2. **Weekly Calendar View**
   - Visual 7-day calendar with color-coded platforms
   - Click any day to see full content
   - Shows task status (pending/done/skipped)

3. **Today's Tasks**
   - Full task details with copyable content
   - One-click copy to clipboard
   - Mark as done or skip with optional notes
   - Platform badges and language indicators

4. **Upcoming Tasks**
   - Next 7 days preview
   - Quick overview of what's coming

5. **History Tab**
   - Filter by status (all/done/skipped)
   - View past tasks with notes
   - Track completion patterns

## GitHub Action - Daily Slack Reminders

The Growth OS includes an automated daily reminder via Slack.

### Setup

1. **Slack Webhook**
   - Create a Slack webhook URL for your channel
   - Add it to GitHub Secrets as `SLACK_WEBHOOK_URL`

2. **GitHub Secrets Required**
   - `SUPABASE_URL` (already configured)
   - `SUPABASE_SERVICE_ROLE_KEY` (already configured)
   - `SLACK_WEBHOOK_URL` (new - add this)

3. **Schedule**
   - Runs daily at 6:00 AM Israel time (3:00 AM UTC)
   - Can be triggered manually via GitHub Actions

### Slack Message Format

```
🌿 Vetree Growth — Day X/90
━━━━━━━━━━━━━━━
Today's tasks:

📘 Facebook IL — משרות ומודעות בתחום הוטרינריה
🇮🇱 [First 100 chars of content]...
[Link to admin dashboard]

━━━━━━━━━━━━━━━
📊 Week progress: X/7 done
🎯 Total: X/90 completed
```

## Platform Colors & Icons

- **Facebook (IL/Intl)**: 📘 Blue (#1877F2)
- **WhatsApp**: 💬 Green (#25D366)
- **Reddit**: 🤖 Orange (#FF4500)
- **LinkedIn**: 💼 Blue (#0A66C2)
- **Twitter**: 🐦 Black (#000000)
- **Instagram**: 📸 Pink (#E1306C)
- **Telegram**: ✈️ Light Blue (#26A5E4)
- **KOL**: 🌟 Sage Green (#3D7A5F)

## Content Strategy

Each task is built from **REAL articles** in the database:
- **Hook line**: Rotates through 15 unique hooks - never repeats
- **Clinical bottom line**: Direct from article's `clinical_bottom_line` field
- **Article link**: Specific URL to the actual article (vetree.app/article/[id])
- **Platform-specific format**: Tailored for each channel
- **Language**: Hebrew for Israeli platforms, English for international

### Content Formula

**Hebrew posts:**
```
[Hook line - שאלה או עובדה מפתיעה]
[clinical_bottom_line של המאמר]
[title של המאמר]
🔗 vetree.app/article/[id]
🌿 עוד תקצירים קליניים על vetree.app
```

**English posts:**
```
[Hook line - question or surprising fact]
[clinical_bottom_line of the article]
📄 [article title]
🔗 vetree.app/article/[article_id]
🌿 More evidence-based summaries at vetree.app
```

**Hook lines rotate** (15 Hebrew, 15 English) to ensure variety and prevent repetition.

### Article Selection Criteria

The seed script automatically selects 90 articles from the database that:
- Have a `clinical_bottom_line` (>50 characters)
- Cover relevant specialties: cardiology, oncology, pain management, dermatology, internal medicine, surgery, anesthesia, emergency, etc.
- Are sorted by publication date (most recent first)
- Cycle through to ensure variety

## Task Management Workflow

1. **Morning**: Receive Slack reminder with today's tasks
2. **Review**: Check admin dashboard for full details
3. **Copy**: One-click copy the prepared content
4. **Post**: Share on the designated platform
5. **Mark**: Click "Done" or "Skip" (with optional note)
6. **Track**: Monitor weekly and total progress

## Customization

To modify the seed data:
- Edit `supabase/seeds/growth_tasks_seed.sql`
- Adjust hook lines, content templates, or platform groups
- Modify article selection criteria (specialty filters, date ranges)
- Re-run the seed script (truncate `growth_tasks` table first)

**Note**: Re-running the seed will automatically select articles from the database based on current availability and the defined criteria.

## Troubleshooting

### Tasks not showing
- Check that the seed script ran successfully
- Verify scheduled_date is set correctly
- Ensure user has admin role

### Slack notifications not working
- Verify `SLACK_WEBHOOK_URL` is set in GitHub Secrets
- Check GitHub Actions logs for errors
- Test the webhook manually

### Permission errors
- Ensure RLS policies are active
- Verify user is in `user_roles` table with `role = 'admin'`

## Future Enhancements

Potential additions:
- Article linking (connect tasks to specific articles)
- Analytics tracking (engagement metrics per platform)
- Template management (create/edit content templates)
- Team assignments (assign tasks to different team members)
- Performance reporting (conversion tracking)
