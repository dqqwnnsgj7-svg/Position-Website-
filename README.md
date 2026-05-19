# Position

Evaluate job candidates faster and more fairly with AI.

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Add your Anthropic API key
Edit `.env.local` — the `ANTHROPIC_API_KEY` value is already filled in.

### 3. Set up the database

**First time:**
```bash
npm run db:setup
```

**If you already ran setup before and are updating to add new features:**
```bash
npx prisma migrate dev --name add_features
```

### 4. Start the app
```bash
npm run dev
```

Open http://localhost:3000

## What's in the app

- **Landing page** — welcome screen with sign up / sign in
- **Dashboard** — all hiring projects, searchable, with onboarding checklist
- **Projects** — job title, description, custom AI criteria, open slots, score threshold
- **Resume upload** — any file type, single or batch
- **AI evaluation** — pros, cons, analysis, score, interview questions (Claude claude-sonnet-4-6)
- **Pipeline views** — List View, QuickView (rapid card decisions), Compare (side-by-side)
- **Decisions** — Accept / Think About / Reject with email drafts and calendar links
- **Culture fit notes** — your private notes on each candidate
- **Settings** — change password, calendar preference (Google/Apple/Outlook/Other)
- **Password reset** — forgot password flow

## Stack
- Next.js 14 (App Router) · TypeScript
- Prisma + SQLite
- NextAuth.js
- Anthropic Claude claude-sonnet-4-6
- Tailwind CSS
