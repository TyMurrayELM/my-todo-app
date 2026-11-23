# my-todo-app (tabs.day)

React + Vite + Tailwind, with Supabase for sign-in and data. The site is hosted on
Vercel, which rebuilds and deploys whenever `main` changes.

## "Push it" means make it live

When the owner says "push it", put the change live without asking again:

1. Run the checks below and make sure they pass.
2. Commit, then push the commit to `main` (for example `git push origin HEAD:main`
   from a working branch). Keep history linear: fast-forward, no merge commits.
3. Say it's on `main` and that Vercel deploys it within a minute or two. Say plainly
   if you couldn't confirm the live site yourself.

Avoid jargon like "branch" or "main" in replies unless you explain it.

## Checks before committing

- `npm run lint`
- `npm test`
- `npm run build` (then delete `dist/`)
- Format only the files you changed with `npx prettier --write <files>`. Running
  prettier on all of `src` reformats unrelated files.

## Database changes

Schema lives in `supabase/people.sql` as numbered, re-runnable sections. Add a new
section at the end for any change. No Supabase connector is set up for Claude, so
the owner runs new SQL in the Supabase SQL editor. Give them the exact SQL to paste,
and tell them what will break until they run it.

## Code layout

- `src/lib/` holds pure helpers (no React, no Supabase) with `*.test.js` beside them.
  Put new logic here and test it.
- `src/hooks/useTodos.js` and `src/hooks/usePeople.js` own data loading and saving.
- `src/components/PeopleView.jsx` is the People (relationship manager) screen.
