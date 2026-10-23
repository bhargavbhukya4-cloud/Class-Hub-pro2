# CLASS HUB on Supabase + Vercel + GitHub

Files (all must sit directly in the repository, not inside a folder):
index.html, shim.js, config.js, check.html, schema.sql, README.md

## 1. Supabase
1. supabase.com -> New project (choose a database password, wait until it is ready).
2. SQL Editor -> New query -> paste ALL of schema.sql -> Run. (If only the last line `alter publication ...` errors, ignore it.)
3. Authentication -> Sign In / Providers -> turn ON "Allow anonymous sign-ins" -> Save.
4. Project Settings -> API: copy the Project URL (https://xxxx.supabase.co) and the anon public key.

## 2. Keys
Open config.js, replace PASTE_YOUR_PROJECT_URL and PASTE_YOUR_ANON_KEY with the two values from 1.4. Keep the quotes. Never use the service_role key.

## 3. GitHub
New repository (public or private) -> Add file -> Upload files -> unzip first, then drag all 6 files -> Commit changes.

## 4. Vercel
Add New -> Project -> Import the repository -> Framework Preset: Other -> leave Build Command and Output Directory empty -> Deploy.

## 5. Test
Open your-link/check.html. Every line must show a green tick. Then open your-link and create your first class.
