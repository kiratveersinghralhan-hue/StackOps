STACKOPS NEXUS ULTRALITE PRODUCTION

SQL REQUIRED: YES
Reason: this update adds/changes backend tables for chat, orders/payments, matchmaking, squads, services, badges, plans, admin permissions, and storage policies.

IMPORTANT SETUP
1. In Supabase, run: supabase-reset-schema.sql
2. Make sure you already have an auth user with this UID:
   02cc6cac-0131-43a3-9385-5965ed5f1e85
3. The SQL makes that UID admin at the end. If the verification query returns no row, sign up/login once in the website, then run only this:

update public.profiles set
  role='admin',
  account_status='approved',
  title='Founder 👑',
  badge='Admin Crown',
  is_verified=true,
  is_banned=false
where id = '02cc6cac-0131-43a3-9385-5965ed5f1e85';

4. Open config.js and replace:
   YOUR_SUPABASE_URL
   YOUR_SUPABASE_ANON_KEY

5. Deploy the folder to Vercel/Netlify or open index.html locally for demo mode.

WHAT CHANGED
- Whole UI/UX redesigned to be faster and cleaner.
- Removed laggy heavy animation style.
- Added lightweight intro animation.
- Added smooth CSS-only page transitions.
- Added business-ready pages: squads, coaching marketplace, plans, chat, admin.
- Added plans up to ₹10,000.
- Added badges, titles, admin crown identity.
- Added admin approve/ban/verify/service controls.
- Added Supabase-ready backend schema.
- Added storage buckets: avatars, banners, posts, service-files.
- Added orders for payment integration.
- Added messages table for chat.
- Added matchmaking queue table.

PAYMENTS NOTE
This ZIP creates payment/order records only. Real payment collection needs Razorpay or Stripe server-side verification.
For India, Razorpay is recommended. Do not activate premium plans only from frontend clicks; verify payment using backend/Edge Function first.

PERFORMANCE NOTE
This version is intentionally lightweight: no video background, no canvas particles, no huge libraries, no nested folders.
