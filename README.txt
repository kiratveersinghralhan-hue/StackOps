STACKOPS — Full One-Folder UI Update

Files:
- index.html
- styles.css
- app.js
- stackops-logo.svg

What this pack is:
- a one-folder full UI update pack
- includes new logo build intro animation
- includes soundless loading bar feel
- includes smoother transition into dashboard
- includes premium report modal
- includes clickable player/team/post/tournament details
- includes profile image upload area + generate avatar button

What it is NOT:
- It does not include your private backend/auth codebase because I do not have your full live source in this chat.
- Replace or merge these UI files into your current one-folder live project.
- Keep your existing Supabase auth/database hooks and route logic where marked in app.js.

Recommended merge:
1. Backup your current project.
2. Replace index.html, styles.css, and stackops-logo.svg with these versions.
3. Merge app.js carefully:
   - keep your current auth/session/profile/team/post/message functions
   - keep the new intro, modal, navigation, details, and avatar UI bindings
4. Push to GitHub and let Render redeploy.
5. Hard refresh the site.

Where to hook real auth:
- In app.js, inside submitAuthBtn click handler, replace the demo setLoggedIn(true) with your real sign-in/sign-up flow.
- Replace the Google button alert with your actual Supabase Google OAuth call.
- Leave Riot as coming soon unless fully configured.

Why I made it this way:
- You asked for a single-folder zip with full updated files.
- I can provide the complete UI layer cleanly.
- I cannot honestly recreate your exact live backend from scratch without your actual current source files.
