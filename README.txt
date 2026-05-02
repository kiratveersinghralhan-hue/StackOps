STACKOPS NEXUS ADVANCED FIXED BUILD

What changed:
- Real working button handlers across navigation, login, profile, plans, squads, services and admin.
- Strong futuristic intro animation, animated background and premium UI.
- Supabase-ready frontend and reset SQL.
- Admin panel: approve users, ban users, make admin, approve/reject services, verify plan orders.
- Plans up to ₹10,000, badges, titles and service marketplace commission.
- One folder only. No subfolders.

Setup:
1. Open supabase-reset-schema.sql in Supabase SQL editor and run it.
2. Sign up/login on website once.
3. Run this SQL to make yourself admin:
   update public.profiles set role='admin', account_status='approved', title='Founder 👑', badge='Admin Crown', is_verified=true where id='02cc6cac-0131-43a3-9385-5965ed5f1e85';
4. Put your Supabase URL and anon key in config.js.
5. Open index.html using a local server, not directly as file.
   Example: npx serve .

Important:
For real payments, connect Razorpay/Stripe server-side. Current plan buying creates an order request for admin verification.
