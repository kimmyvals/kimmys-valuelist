# kimmy's valuelist

Community skin value list for Criminality. Built with TanStack Router, Supabase, and Tailwind CSS.

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a free project. Then:

- Open the **SQL Editor** and run the contents of `supabase/migrations/20260523072608_initial.sql` to set up all tables, RLS policies, and functions.
- Go to **Project Settings → API** and copy your **Project URL** and **anon / public key**.

### 2. Configure environment variables

```sh
cp .env.example .env
```

Fill in your Supabase URL and anon key. These are safe to use client-side — Supabase's row-level security handles access control.

### 3. Install and run

```sh
npm install   # or: bun install / pnpm install / yarn
npm run dev
```

### 4. Set up an editor account

Register an account through the site, then in your Supabase dashboard run:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'editor' FROM auth.users WHERE email = 'your@email.com';
```

Editors can add/edit/delete skins and trigger sheet syncs. Admins additionally have access to the inbox.

---

## Deployment

This is a static SPA — no server required.

### Cloudflare Pages

1. Connect your repo in the Cloudflare Pages dashboard.
2. Set build command: `npm run build`, output directory: `dist`.
3. Add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables.

### GitHub Pages

1. Build with `npm run build`.
2. Deploy the `dist/` folder. A `404.html` is included that handles client-side routing.
3. Set environment variables before building (or use a GitHub Actions workflow with secrets).

---

## Features

- Browse and search skin values by weapon, case, and rarity
- Trade calculator with shareable links
- Four mini-games: Daily Challenge, Market Tycoon, Value Trainer, Snowfall idle
- Editor role for managing skin data, synced from Google Sheets
- Seasonal themes, compact mode, and locally saved game progress (synced to cloud when signed in)

## Sheet Sync

The **Sync sheet** button (visible to editors) fetches the Google Sheet as a public CSV and upserts the data directly into your Supabase project using your editor credentials. No server or service role key required — Supabase's RLS policies allow editors to upsert skin rows.

The Sheet ID is hardcoded in `src/lib/sync.functions.ts`. Update `SHEET_ID` there to point to your own sheet.

## Images

Skin images are served from `public/skins/`. Editors can also upload images via the skin dialog, which stores them in Supabase Storage.
