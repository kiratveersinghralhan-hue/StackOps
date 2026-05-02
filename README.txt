STACKOPS NEXUS — ADVANCED RIOT GAMER NETWORK

Folder rule followed:
- ZIP contains ONE main folder only: StackOps_Riot_Gamer_Hub
- No subfolders inside it
- All code/assets are flat files

FILES
1. index.html
   Main website UI: futuristic landing, dashboard, discover, services, plans, rewards, admin panel.
2. styles.css
   Full responsive animated gamer UI.
3. app.js
   Frontend logic + Supabase integration.
4. config.js
   Add your Supabase URL and anon key here.
5. supabase-reset-schema.sql
   Clean reset SQL + tables + RLS + storage buckets + plans + badges.
6. README.txt
   Setup and business notes.

SETUP
1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run supabase-reset-schema.sql.
4. Go to Project Settings > API.
5. Copy Project URL and anon public key into config.js.
6. Open index.html with VS Code Live Server, or deploy the folder to Netlify/Vercel.

MAKE YOURSELF ADMIN
1. Create an account on the website first.
2. In Supabase SQL Editor run:

update public.profiles
set role='admin', status='approved', title='ADMIN OVERLORD', badge_name='Admin Crown'
where email='your@email.com';

3. Refresh website.
4. Admin tab will appear.

ADMIN FEATURES INCLUDED
- Special admin name/title: ADMIN OVERLORD
- Admin Crown badge/banner
- Approve users
- Ban users
- Make another user admin
- Approve/reject services
- Verify/reject plan orders
- Apply plan rewards to users
- Manage plans/badges directly from Supabase tables

PLANS INCLUDED
- Recruit Pass: ₹199
- Elite Pass: ₹999
- Immortal Club: ₹2999
- Radiant Partner: ₹10000

BADGES/TITLES INCLUDED
- Admin Crown
- Verified Coach
- Radiant Crown
- Founder
- Squad Hunter
- Recruit

SERVICE MARKETPLACE INCLUDED
Users can list:
- Valorant coaching
- Profile verification services
- VOD review
- Team trial
- Custom graphics

Admin approves services. Users book services. Commission is saved in bookings table. Default commission is 15% and can be changed in config.js or service rows.

SUPABASE STORAGE BUCKETS CREATED
- avatars
- covers
- post-media
- service-media

Uploads are public-read and user-folder protected. Current frontend includes avatar upload. SQL is ready for cover/post/service media uploads too.

IMPORTANT PAYMENT NOTE
This package creates plan order and booking records, but real money collection needs a payment gateway such as Razorpay, Cashfree, Stripe, or UPI manual verification.
For India, Razorpay/Cashfree are common choices. Add gateway only after parent/guardian/business guidance if you are under 18.

GO-LIVE COST ESTIMATE
Minimum MVP:
- Domain: ₹800-₹1,200/year
- Supabase free/pro: ₹0-₹2,100/month
- Hosting: ₹0-₹1,500/month
- Basic logo/assets: ₹0-₹5,000 one time

Better production start:
- Supabase Pro: around ₹2,100/month
- Hosting/CDN: ₹1,000-₹3,000/month
- Domain/email: ₹1,000-₹3,000/year
- Payment gateway fees: usually per transaction
- Moderation/support budget: depends on users

Recommended launch scope:
1. Valorant only first.
2. Launch with profiles + find squad + premium plan requests + coaching marketplace.
3. Add chat/voice later after you have active users.
4. Focus on safety/moderation before aggressive growth.

LEGAL/BRAND NOTE
Do not claim official partnership with Riot Games unless you have written permission. Use language like "for Riot game communities" or "Valorant players" and follow Riot brand/API rules.

WHAT TO IMPROVE NEXT
- Add Razorpay payment integration.
- Add real chat with Supabase Realtime.
- Add friends table and accepted connections.
- Add service reviews/ratings.
- Add admin analytics dashboard.
- Add Riot API stats sync if you get API approval.
