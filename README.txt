StackOps — clean one-folder set based on your uploaded working UI

Base files came from your uploaded working UI layer:
- app.js
- index.html
- styles.css
- README.txt

Added:
- config.js
- stackops-logo.svg
- server.js
- package.json
- schema.sql

What was changed carefully:
- kept your uploaded UI structure and styling
- kept intro, views, report modal, detail modal, avatar upload, nav logic
- added safe Supabase config support
- added real Google OAuth call through Supabase
- added real email/password auth hooks through Supabase
- added backend starter files without changing the frontend architecture

Recommended first deploy:
1. Upload all files to your new repo root
2. Edit config.js
3. Set:
   supabaseUrl = your project URL
   supabaseAnonKey = your real anon public key
4. For first deploy, use Render Static Site
   Build Command: leave empty
   Publish Directory: .
5. Enable Google provider in Supabase
6. Add Google OAuth redirect URI:
   https://YOUR_PROJECT.supabase.co/auth/v1/callback

Note:
- server.js/package.json are included because you asked for backend files too
- for the first successful deployment, the frontend static site is still the correct service
- Riot login remains coming soon until you add a dedicated backend and approved Riot credentials
