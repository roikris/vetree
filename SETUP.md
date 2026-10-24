# Vetree Setup Guide

Vetree is a veterinary research platform built with Next.js and Supabase.

## Prerequisites

- Node.js 18+ installed
- Supabase account and project

## Setup Steps

### 1. Environment Configuration

The `.env.local` file has already been created with your Supabase credentials:
- Supabase URL: https://gnykidzijppxvrvvchxq.supabase.co
- Supabase Anon Key: (configured)

**Important:** Never commit `.env.local` to version control (it's already in `.gitignore`).

### 2. Create the Database Table

You need to run the SQL migration in your Supabase dashboard to create the `articles` table:

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/gnykidzijppxvrvvchxq
2. Navigate to **SQL Editor** in the left sidebar
3. Open the file `supabase/migrations/001_create_articles_table.sql`
4. Copy the SQL content and paste it into the SQL Editor
5. Click **Run** to execute the migration

Alternatively, if you have the Supabase CLI installed:
```bash
supabase db push
```

### 3. Start the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Project Structure

```
vetree/
├── app/                    # Next.js app directory
├── lib/
│   └── supabase.ts        # Supabase client configuration
├── scripts/
├── supabase/
│   └── migrations/
│       └── 001_create_articles_table.sql
├── .env.local             # Environment variables (not in git)
└── package.json
```

## Database Schema

The `articles` table includes:
- All specified columns from requirements
- `created_at` and `updated_at` timestamps
- Indexes on `publication_date` and `labels` for faster queries
- Automatic `updated_at` trigger

## TypeScript Types

The `Article` type is defined in `lib/supabase.ts` and matches the database schema.

## Next Steps

1. Run the SQL migration in Supabase
2. Test the import with the sample CSV
3. Start building your frontend pages in the `app/` directory
4. Use the Supabase client from `lib/supabase.ts` to query articles

## Troubleshooting

### Database Connection Issues

- Verify your Supabase URL and anon key in `.env.local`
- Check that your Supabase project is active
- Ensure the `articles` table has been created

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
