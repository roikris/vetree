# Content Generation Agent - Documentation

## Overview

The Content Generation Agent is an AI-powered tool that generates platform-specific social media content for Vetree's growth campaign. It learns from your feedback to improve content quality over time.

## Features

### 🤖 AI-Powered Generation
- Uses Claude Sonnet 4.5 to generate clinically relevant content
- References real articles from your database
- Platform-specific formatting (Twitter, Facebook, Instagram, etc.)
- Bilingual support (Hebrew & English)

### 📊 Learning System
The agent learns from every approval/skip:
- **Specialty preferences**: Learns which specialties you prefer
- **Hook patterns**: Identifies successful hook styles
- **Avoidance patterns**: Remembers what to avoid
- **Article tracking**: Never shows the same article twice for a platform/language combo

### ✨ Smart Article Selection
- Filters by preferred specialties
- Excludes large animal content (equine, livestock, etc.)
- Requires clinical_bottom_line and summary
- Prioritizes recent articles
- Avoids already-used articles per platform/language

## Setup

### 1. Run Database Migration

In Supabase SQL Editor:
```sql
-- Copy contents from:
supabase/migrations/011_create_growth_agent_tables.sql
```

This creates:
- `growth_agent_memory` - tracks article usage
- `growth_agent_preferences` - stores learning

### 2. Set Environment Variable

Add to your `.env.local`:
```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

Get your API key from: https://console.anthropic.com/

### 3. Install Dependencies

```bash
npm install
```

This will install `@anthropic-ai/sdk`.

## Usage

### Accessing the Agent

1. Navigate to `/admin/growth`
2. Click the **🤖 Content Agent** tab

### Generating Content

1. **Select Platform**: Choose where you'll post (Twitter, Facebook, etc.)
2. **Select Language**: Hebrew (🇮🇱) or English (🇺🇸)
3. **Click Generate**: Agent creates a post from a relevant article

### Review Generated Post

The agent shows you:
- **Post content** - Ready to copy and paste
- **Article details** - Title, journal, specialty tags
- **Article link** - Direct link to vetree.app article page

### Actions

#### ✅ Approve & Copy
- Saves this as a successful post
- **Automatically copies to clipboard**
- Teaches agent this specialty/hook style works
- Generates a new post immediately

#### ✏️ Edit & Approve
- Click "Edit" to modify the content
- Make your changes
- Click "Approve & Copy" when ready
- Still learns from the original hook pattern

#### ⏭ Skip
Choose a reason:
- **Not relevant specialty** → Agent avoids this specialty
- **Too generic** → Agent avoids this hook style
- **Already covered this topic** → Logged for reference
- **Wrong audience** → Logged for reference
- **Wrong tone** → Agent adjusts tone patterns
- **Other** → Generic skip

After skipping, a **new post is generated immediately**.

## Content Formula

### Hebrew Posts
```
[Hook line - specific to article finding]

[2-3 sentences of clinical insight]

📄 [Article title]
🔗 vetree.app/article/[id]
🌿 vetree.app
```

### English Posts
```
[Hook line - specific to article finding]

[2-3 sentences of clinical insight]

📄 [Article title]
🔗 vetree.app/article/[id]
🌿 vetree.app
```

### Hook Line Rules
- Must reference something **specific** from the article
- Never generic ("stay updated", "new research")
- Conversational and engaging
- Question or surprising fact format

### Clinical Insight Rules
- Actionable for first-opinion practice
- Based on article's clinical_bottom_line
- 2-3 sentences maximum
- Practical implications

## Learning System

### What Gets Tracked

**On Approve:**
- Article + specialty → preferred
- Hook pattern → preferred_hook_styles
- Increments approved_count

**On Skip:**
- Article specialty → avoided (if reason = "Not relevant specialty")
- Hook pattern → avoided_hook_styles (if reason = "Too generic" or "Wrong tone")
- Increments skipped_count

### Agent Stats Panel

Shows:
- **Approved count**: Total approved posts
- **Skipped count**: Total skipped posts
- **Articles used**: Unique articles used
- **Specialties learned**: Preferred specialties (green tags)
- **Avoided specialties**: Avoided specialties (red tags)

## API Routes

### POST /api/growth/generate-post

**Request:**
```json
{
  "platform": "twitter",
  "language": "en",
  "skip_reason": "Too generic" // optional
}
```

**Response:**
```json
{
  "post_content": "This changed how I approach...",
  "article_id": "abc123",
  "article_title": "Novel approach to...",
  "article_labels": ["cardiology", "emergency"],
  "hook_line": "This changed how I approach...",
  "article_url": "vetree.app/article/abc123",
  "source_journal": "JAVMA"
}
```

### POST /api/growth/feedback

**Request:**
```json
{
  "article_id": "abc123",
  "outcome": "approved", // or "skipped"
  "skip_reason": "Too generic", // if skipped
  "hook_line": "This changed...",
  "platform": "twitter",
  "language": "en",
  "article_labels": ["cardiology"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback saved successfully"
}
```

### GET /api/growth/stats

**Response:**
```json
{
  "approved_count": 15,
  "skipped_count": 5,
  "preferred_specialties": ["cardiology", "oncology"],
  "avoided_specialties": ["exotic"],
  "unique_articles_count": 18
}
```

## Prompting Strategy

### System Prompt
Establishes role:
- Veterinary content writer
- Writing for DVMs in practice
- Specific, not generic
- Clinically relevant

### User Prompt
Includes:
- Article details (title, bottom line, summary)
- Platform and language
- Current preferences (learned from feedback)
- Last skip reason (if applicable)
- Format requirements
- Character limits

### Claude Model
- **Model**: `claude-sonnet-4-20250514`
- **Max tokens**: 1024
- **Temperature**: Default (balanced creativity)

## Best Practices

### For Best Results

1. **Be Consistent**: Use the same skip reasons consistently so the agent learns
2. **Edit Sparingly**: If you're editing frequently, skip and let it regenerate
3. **Give Feedback**: Every approval/skip improves future generations
4. **Check Stats**: Monitor what the agent is learning
5. **Reset Learning**: If agent goes off-track, you can manually update `growth_agent_preferences` in Supabase

### Platform-Specific Tips

- **Twitter**: Keep it punchy, hook + insight only
- **Instagram**: More visual instructions in brackets
- **LinkedIn**: Professional tone, include hashtags
- **Hebrew posts**: Check clinical terminology sounds natural
- **Reddit**: More conversational, can be longer

## Troubleshooting

### "No suitable articles found"
- Check that articles have `clinical_bottom_line` and `summary`
- Verify articles aren't all large animal
- Check if too many articles are in `avoided_specialties`
- Reset preferences if needed

### Generated content is too generic
- Click **Skip → "Too generic"**
- Agent will adjust in next generation
- Check if hook_line is being tracked in preferences

### Same article keeps appearing
- This shouldn't happen! Check `growth_agent_memory` table
- Verify article_id is being saved correctly

### Agent not learning
- Check that feedback API is being called successfully
- Verify `growth_agent_preferences` is updating
- Check browser console for errors

## Database Schema

### growth_agent_memory
```sql
- id: uuid (PK)
- article_id: text (FK → articles)
- platform: text
- language: text (he/en)
- outcome: text (approved/skipped)
- skip_reason: text (nullable)
- hook_line: text (nullable)
- created_at: timestamptz
```

### growth_agent_preferences
```sql
- id: uuid (PK)
- preferred_specialties: text[] (array)
- avoided_specialties: text[] (array)
- preferred_hook_styles: text[] (array)
- avoided_hook_styles: text[] (array)
- approved_count: integer
- skipped_count: integer
- updated_at: timestamptz
```

## Future Enhancements

Potential improvements:
- A/B testing different hook styles
- Performance metrics per platform
- Scheduled auto-posting
- Multi-language support beyond he/en
- Visual content generation for Instagram
- Sentiment analysis on approved content
- Time-of-day optimization
