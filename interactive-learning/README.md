# Interactive Learning

An open study site: students pick a **course → chapter → study mode** without signing in.
An admin portal lets you upload notes, give Claude instructions, review the generated study set, and control how each chapter is studied.

Rename the site any time with `NEXT_PUBLIC_SITE_NAME`.

## What's in it

**Left menu** (bottom tab bar on phones): Home, Library, Games, Your chapters, Progress, Awards, Leaderboard.

- **Home:** study time and streak, "Jump back in" chapters, **Trending this week** (most-played sets), **For fun** games other students made, and UCLA courses.
- **Library:** official UCLA courses, sets students shared, and For Fun games.
- **Games:** every shared For Fun game, with map games in their own row.
- **Your chapters:** what you've made (shared or private) and what you've studied recently.
- **Progress:** today / week / quarter / streak, the last 14 days, and Learn mastery per chapter.
- **Awards:** badges for streaks, mastery, perfect rounds, trying every mode, hours studied.
- **Leaderboard:** study time this week and all time, for everyone who's signed in.
- **Search** in the header (press /): courses, professors, chapters, terms, student-made sets and their authors.

**Studying a chapter.** Opening a chapter starts the first mode right away (Learn by default) with every other mode as tiles below.
Modes: Learn (adaptive rounds), Flashcards, Quick-fire, **Map** (click the right US state or country), Journal Entries, Match, Ledger Rush.
Each set only shows the modes that fit it, in the order that fits it.

**Upload.** Anyone signed in chooses **For class** (notes for a course) or **For fun** (anything, e.g. US state capitals),
upload notes or just describe an idea, and Claude builds the set. Claude also picks the format: which modes fit and in what order, what the
two sides of a card are called (State / Capital instead of Term / Definition), and map places for geography. Students keep sets private or
share them with everyone. Upload is three steps: for class or for fun → "Claude builds it" (notes or an idea) or "Paste a quiz" → who can see it. **Paste a quiz** gives students a "Copy the format" prompt to use in Claude; they paste Claude's JSON answer back and it's published instantly with no API cost (format and checks: `src/lib/import-format.ts`). Shared sets show "Published by <name>" with a link to that student's page (/u/handle) listing everything they've shared.

**Accounts.** The site is open to everyone: browsing and studying need no account. Signing in (any email, via an emailed
sign-in link or Google) is only needed to get a profile, post chapters and quizzes, and appear on the leaderboard.

**Admin portal (`/admin`)** is hidden: the Admin button only appears after you log in through the small "Admin login" link in the footer.
- Courses, professors, chapters, notes, Claude generation, study settings (as before), plus card labels and map places in the content editor.
- **Student uploads:** every student set with its author's email. Hide anything from everyone, share it, delete it, or **Make official** to move a good class set into the official library.

Until Supabase is connected the site shows demo content (an accounting chapter and a For Fun "US State Capitals" map game).

## Setup (about 15 minutes)

### 1. Supabase
1. Create a project at supabase.com.
2. **SQL Editor → New query**, paste everything in `supabase/schema.sql`, click **Run**.
3. **Project Settings → API**: copy the Project URL, `anon` key and `service_role` key.

### 2. Claude API key
Create a key at console.anthropic.com → API Keys.

### 3. Run locally
```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```
Open http://localhost:3000, and http://localhost:3000/admin for the portal.

### 4. Deploy on Vercel
1. Push this folder to a new GitHub repo.
2. In Vercel: **Add New → Project**, import the repo.
3. Paste every variable from `.env.local` into **Settings → Environment Variables**.
4. Deploy.

## Your first chapter
1. `/admin` → add course (e.g. `MGMT 120B`), then add its professors and describe how each one tests.
2. Fill in **Course-wide instructions** (textbook, professor's style, exam format) and tick **Published**.
3. Add a chapter (pick the professor, or "Shared by every professor") → upload notes → add chapter instructions → **Generate draft**.
4. Review and edit the content, adjust study settings, tick **Published**, click **Save**.

## Already ran the old schema?
Run `supabase/schema.sql` again. It adds the professors table and the professor column on chapters without touching existing data.

## Turning on sign-in
Uploads, Your chapters and the Leaderboard need it.
1. Run `supabase/schema.sql` again (safe to re-run). It adds student sets, profiles, trending and the leaderboard (and removes the old UCLA-only rule if you ran an earlier version).
2. **Google (optional):** Google Cloud Console → create an OAuth client (Web) with redirect URI `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
   In Supabase → Authentication → Providers → Google, paste the client ID and secret and enable it.
3. **Email link:** Supabase → Authentication → Providers → Email is on by default. (For real traffic, add your own SMTP under Authentication → Emails.)
4. Supabase → Authentication → URL Configuration: add `https://your-site.com/auth/callback` (and `http://localhost:3000/auth/callback`).
5. In Vercel set `NEXT_PUBLIC_ENABLE_AUTH=true`. Redeploy.

Each upload is one Claude call on your API key; `UPLOADS_PER_DAY` (default 5) caps it per student.
Shared student sets go live right away; check **Admin → Student uploads** to hide anything that shouldn't be up.

## Maps
Map outlines are pre-drawn into `public/maps/` from public-domain US Census and Natural Earth data. To regenerate them
(only needed if you change the maps): `node scripts/build-maps.mjs`.

## Adding your own games
Every game reads the same chapter data, so a new game works for every course automatically.
1. Create `src/components/games/YourGame.tsx` that takes `GameProps` (see `Quiz.tsx` for a simple example).
2. Add its id to `MODES` and `MODE_INFO` in `src/lib/types.ts`.
3. Add a `case` in `src/components/games/GameHost.tsx`.

It then shows up as a toggle in each chapter's study settings.

## Project map
```
src/app/                      pages (public site, /admin, API)
src/app/admin/actions.ts      all admin saves (password-checked)
src/app/api/admin/generate    Claude generation endpoint
src/components/games/         the study modes
src/components/admin/         chapter editor
src/lib/claude.ts             prompt + how notes are sent to Claude
src/lib/db.ts                 database reads
supabase/schema.sql           tables, security rules, storage bucket
```

## Notes
- The Claude API key and Supabase service key stay on the server; students never trigger Claude calls.
- Generation can take a minute or two on long notes. The endpoint allows up to 5 minutes, which needs a Vercel plan that supports long functions; on the free plan, keep note uploads smaller or split chapters.
- Change the model with `ANTHROPIC_MODEL`.
