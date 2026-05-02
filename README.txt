STACKOPS RIOT GAMER HUB - ONE MAIN FOLDER VERSION

What is included:
- index.html
- styles.css
- app.js
- config.js
- supabase-schema.sql
- README.txt

No subfolders are used.

How to run:
1. Unzip the project.
2. Open index.html in a browser.
3. For proper Supabase/Auth testing, use a local server:
   python -m http.server 8080
   Then open http://localhost:8080

Supabase setup:
1. Open Supabase dashboard.
2. Go to SQL Editor.
3. Paste and run supabase-schema.sql.
4. Confirm config.js has your Supabase URL and anon key.
5. Enable Email Auth in Supabase Auth settings.

Main features built:
- Futuristic animated Riot/Valorant gamer landing page
- Players discovery
- Gamer profile creation
- Squad/team creation
- Social feed posting
- Tournament/event creation
- Invite-to-play modal
- Supabase Auth sign in/sign up
- Supabase table read/write with demo fallback
- Premium/earning page
- Responsive mobile layout
- Animated canvas particles, radar HUD, boot screen, glass UI

Recommended MVP scope:
Start with Valorant only. Your first killer feature should be "Find teammates instantly" with rank, region, language, mic, timing, role and toxicity-safe reporting. After users come, add League of Legends, TFT and other Riot games.

Earning methods:
1. Premium subscription around ₹199/month.
2. Animated profile themes and badges.
3. Boosted posts and boosted team recruitment.
4. Paid tournament entry and prize pool fees.
5. Creator/team pages at around ₹499/month.
6. Coaching/service marketplace commission.
7. Sponsor/ad placements for gaming brands.

Estimated cost before going live:
- Domain: ₹800-₹1,500/year.
- Supabase free tier for MVP, then ₹2,000+/month when scaling.
- Hosting: free on Vercel/Netlify for MVP, then ₹1,500-₹5,000/month.
- Storage/CDN for clips/images later: ₹500-₹5,000/month early stage.
- Email/Auth costs: usually low at MVP.
- Marketing: minimum ₹5,000-₹25,000/month if you want users fast.

Realistic MVP launch budget:
₹2,000-₹8,000/month if simple.
₹15,000-₹50,000/month once you add media uploads, chat, tournaments and active users.

Important legal/product notes:
- Do not claim official Riot ownership unless you have permission.
- Use wording like "for Riot gamers" or "community hub".
- Check Riot developer/API policies before using Riot logos, ranked data or official game assets.
- Add Terms, Privacy Policy, moderation, report/block, and age-safe community rules before public launch.
