StackOps Clean Full Set (One Folder)

Contents:
- Frontend files for Render Static Site:
  index.html
  styles.css
  app.js
  config.js
  stackops-logo.svg

- Backend starter files (for later, not needed for first frontend deploy):
  server.js
  package.json

- Database starter:
  schema.sql

Recommended first deploy:
1. Use Render Static Site
2. Upload repo with all files
3. Build Command: leave empty
4. Publish Directory: .
5. Open config.js
6. Replace PASTE_YOUR_REAL_ANON_PUBLIC_KEY_HERE with your real anon public key

Google setup:
- Enable Google provider in Supabase
- Add Google Client ID and Secret in Supabase
- Add redirect URI in Google Cloud:
  https://YOUR_PROJECT.supabase.co/auth/v1/callback

Note:
This ZIP keeps frontend and backend files in one folder because you asked for no subfolders.
For the first successful deploy, the frontend static site is the one to use.
