STACKOPS NEXUS WOW GAMER SOCIAL

SQL REQUIRED: YES
Run database-clean-reset-full.sql once in Supabase SQL editor for this version.

Files are in one main folder only. No subfolders.

Setup:
1. Run database-clean-reset-full.sql in Supabase.
2. Open config.js and paste SUPABASE_URL and SUPABASE_ANON_KEY.
3. Your UID is already included in config.js and SQL admin update:
   02cc6cac-0131-43a3-9385-5965ed5f1e85
4. If your profile row did not exist during SQL reset, sign up/login once, then run:

update public.profiles
set role='admin', account_status='approved', title='Founder Admin', badge='Admin Crown', is_verified=true
where id='02cc6cac-0131-43a3-9385-5965ed5f1e85';

What changed:
- Complete UI/UX redesign inspired by your Harvester reference: smooth intro, live counters, drawer menu, premium cards.
- Gamer style, minimalist, fast, not laggy.
- Admin console: approve/ban/verify users, approve/reject services.
- Plans up to Rs 10,000 with badges/titles.
- Coaching/service marketplace with commission tracking.
- Squad finder, feed, profile editor, uploads, storage buckets.
- Razorpay-ready demo payment hook.

Production notes:
- This is a frontend + Supabase backend prototype. For real money payments, use server-side Razorpay order creation and webhook verification before activating paid plans.
- Do not expose service role key in frontend.
